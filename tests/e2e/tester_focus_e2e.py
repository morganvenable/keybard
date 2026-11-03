"""
Browser tests of the matrix tester across focus changes, against the simulated
Svalboard (?fakeBoard, flicker latch; ?fakeBoard=nopause, VIA matrix state).
Run with `npm run test:e2e:tester-focus`.

While Keybard is not in front of you (the window lost focus, or the tab is
hidden) the board types into the other app, so the tester does not listen.
Coming back, it starts again from a fresh reading of the board:

  1. Keys pressed and released while away never light, never count and are
     not marked seen, during the time away or on coming back.
  2. A key held while leaving and released while away does not show down on
     coming back, not even for one frame. A key held all the way through shows
     down (it is) but does not count a second press.
  3. Esc held when focus left never closes the tester: not while away, not on
     coming back with Esc released, not on coming back with Esc still held.
     Only a fresh press, started after coming back, counts down and closes.
     An auto-repeated Escape key event arriving on coming back does not close
     it either.
  4. Normal use: a press lights at once and counts, the release clears it, and
     holding Esc 2 s closes; Escape from another keyboard closes.

Every flow runs with the window losing focus and with the tab hidden, on the
board with the flicker latch and on the older board without it, and with Live
Updating on and off. The time away is simulated: window blur/focus events with
document.hasFocus() reporting the same, and document.visibilityState with
visibilitychange. It builds the app like fake_board_e2e.py (E2E_URL and
E2E_SKIP_BUILD work the same). SHOT_DIR=path saves before/after screenshots.
Exits 1 when a check fails.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url  # noqa: E402
from tester_pause_e2e import TESTER, exit_key, fw, open_board, open_tester, press  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

# Controls for the simulated time away, and a frame-by-frame record of every lit key.
AWAY_PROBE = """
(() => {
  let focused = true, hidden = false;
  Document.prototype.hasFocus = function () { return focused; };
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get() { return hidden ? 'hidden' : 'visible'; } });
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get() { return hidden; } });
  window.__away = (how) => {
    if (how === 'blur') { focused = false; window.dispatchEvent(new Event('blur')); }
    else { hidden = true; document.dispatchEvent(new Event('visibilitychange')); }
  };
  window.__back = (how) => {
    if (how === 'blur') { focused = true; window.dispatchEvent(new Event('focus')); }
    else { hidden = false; document.dispatchEvent(new Event('visibilitychange')); }
  };
  // Every frame from now: the keys showing down, and whether the tester is open.
  window.__record = () => {
    window.__frames = [];
    const tick = () => {
      const open = !!document.querySelector('[data-matrix-tester]');
      const down = [...document.querySelectorAll('[data-matrix-key][data-down]')].map(e => e.dataset.matrixKey);
      window.__frames.push({ open, down });
      if (open && window.__frames.length < 5000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
})();
"""

BOARDS = (("latch", "fakeBoard"), ("no latch", "fakeBoard=nopause"))
HOWS = ("blur", "hidden")


def start(browser, url, board, live):
    context, page, errors = open_board(browser, url, board=board)
    page.evaluate(AWAY_PROBE)
    set_live(page, live)
    open_tester(page)
    page.wait_for_function("window.keybardTester && window.keybardTester.stats().reads > 10")
    page.evaluate("window.__record()")
    return context, page, errors


def set_live(page: Page, live: bool):
    to_live = page.get_by_role("button", name="Switch to Live Updating")
    to_manual = page.get_by_role("button", name="Switch to Manual Updates")
    if live and to_live.count():
        to_live.first.click()
        expect(to_manual.first).to_be_visible()
    if not live and to_manual.count():
        to_manual.first.click()
        expect(to_live.first).to_be_visible()


def away(page: Page, how: str):
    page.evaluate(f"window.__away('{how}')")


def back(page: Page, how: str):
    page.evaluate(f"window.__back('{how}')")


def frames_since(page: Page, mark: int):
    return page.evaluate("window.__frames")[mark:]


def frame_mark(page: Page) -> int:
    return page.evaluate("window.__frames.length")


def lit_in(frames, key):
    return [i for i, f in enumerate(frames) if key in f["down"]]


def count(page: Page, key: str):
    el = page.locator(f"[data-key-count='{key}']")
    if el.count() == 0 or el.get_attribute("hidden") is not None:
        return 0
    return int(el.inner_text())


def seen(page: Page, key: str) -> bool:
    return page.locator(f"[data-matrix-key='{key}']").get_attribute("data-seen") is not None


def flow_pressed_while_away(browser, url, board, how, live):
    context, page, errors = start(browser, url, board, live)
    away(page, how)
    page.wait_for_timeout(150)
    mark = frame_mark(page)
    press(page, 2, 3, True)
    page.wait_for_timeout(150)
    press(page, 2, 3, False)
    fw(page, "f.flicker(7, 1)")
    page.wait_for_timeout(300)
    back(page, how)
    page.wait_for_timeout(500)
    frames = frames_since(page, mark)
    assert not lit_in(frames, "2-3"), f"2-3 lit in {len(lit_in(frames, '2-3'))} frames, pressed while away"
    assert not lit_in(frames, "7-1"), "7-1 lit: flickered while away"
    assert not seen(page, "2-3") and not seen(page, "7-1"), "a key pressed while away shows as seen"
    assert count(page, "2-3") == 0 and count(page, "7-1") == 0, "a press while away counted"
    # Back in front: presses light at once again.
    press(page, 2, 3, True)
    expect(page.locator("[data-matrix-key='2-3']")).to_have_attribute("data-down", "", timeout=500)
    press(page, 2, 3, False)
    assert not errors, errors
    context.close()


def flow_held_while_leaving(browser, url, board, how, live):
    context, page, errors = start(browser, url, board, live)
    press(page, 1, 1, True)  # released while away
    press(page, 1, 3, True)  # held all the way through
    expect(page.locator("[data-matrix-key='1-1']")).to_have_attribute("data-down", "")
    page.wait_for_timeout(300)
    counted = count(page, "1-3")
    away(page, how)
    page.wait_for_timeout(150)
    press(page, 1, 1, False)
    page.wait_for_timeout(300)
    mark = frame_mark(page)
    back(page, how)
    page.wait_for_timeout(500)
    frames = frames_since(page, mark)
    assert not lit_in(frames, "1-1"), f"1-1 showed down in {len(lit_in(frames, '1-1'))} frames after coming back; it was released while away"
    expect(page.locator("[data-matrix-key='1-3']")).to_have_attribute("data-down", "")
    assert count(page, "1-3") == counted, f"the held key counted again: {counted} -> {count(page, '1-3')}"
    assert not errors, errors
    context.close()


def flow_esc_held_while_leaving(browser, url, board, how, live):
    context, page, errors = start(browser, url, board, live)
    row, col = exit_key(page) if page.locator("[data-tester-exit-mark]").count() else (3, 4)
    press(page, row, col, True)
    page.wait_for_timeout(400)
    away(page, how)
    page.wait_for_timeout(2600)  # longer than the hold
    expect(page.locator(TESTER)).to_be_visible()
    # (a) back with Esc released
    press(page, row, col, False)
    back(page, how)
    page.wait_for_timeout(600)
    expect(page.locator(TESTER)).to_be_visible()
    # (b) Esc goes down while away and is still held on coming back
    away(page, how)
    press(page, row, col, True)
    page.wait_for_timeout(2600)
    back(page, how)
    page.wait_for_timeout(2600)
    expect(page.locator(TESTER)).to_be_visible()
    # An auto-repeated Escape key event on coming back (the OS repeats a held key to the new window).
    page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', repeat: true, bubbles: true }))")
    page.wait_for_timeout(200)
    expect(page.locator(TESTER)).to_be_visible()
    # (c) a fresh press after coming back closes it.
    press(page, row, col, False)
    page.wait_for_timeout(200)
    press(page, row, col, True)
    expect(page.locator(TESTER)).to_have_count(0, timeout=3500)
    press(page, row, col, False)
    assert not errors, errors
    context.close()


def flow_normal_use(browser, url, board, how, live):
    context, page, errors = start(browser, url, board, live)
    if how == "hidden":  # once away and back first, then normal use must be unchanged
        away(page, how)
        page.wait_for_timeout(200)
        back(page, how)
        page.wait_for_timeout(200)
    key = page.locator("[data-matrix-key='2-2']")
    press(page, 2, 2, True)
    expect(key).to_have_attribute("data-down", "", timeout=200)
    press(page, 2, 2, False)
    expect(key).not_to_have_attribute("data-down", "", timeout=200)
    assert seen(page, "2-2")
    if board == "fakeBoard":
        expect(page.locator("[data-key-count='2-2']")).to_have_text("1")
    row, col = exit_key(page) if page.locator("[data-tester-exit-mark]").count() else (3, 4)
    press(page, row, col, True)
    expect(page.locator(TESTER)).to_have_count(0, timeout=3500)
    press(page, row, col, False)
    open_tester(page)
    page.wait_for_timeout(200)
    page.keyboard.press("Escape")
    expect(page.locator(TESTER)).to_have_count(0)
    assert not errors, errors
    context.close()


# Holds every animation frame callback after the next frame, so each drawn frame can be photographed.
FRAME_GATE = """
(() => {
  const raf = window.requestAnimationFrame.bind(window);
  let frozen = false, armed = false, held = [];
  window.requestAnimationFrame = (cb) => {
    if (frozen) { held.push(cb); return 0; }
    return raf((t) => { if (armed) { frozen = true; armed = false; } cb(t); });
  };
  // Let exactly one more frame run, then stop; resolves once it has run.
  window.__oneFrame = () => new Promise((done) => {
    armed = true; frozen = false;
    const run = held; held = [];
    run.forEach((cb) => window.requestAnimationFrame(cb));
    raf(() => setTimeout(done, 0));
  });
  window.__thaw = () => { frozen = false; armed = false; const run = held; held = []; run.forEach((cb) => raf(cb)); };
})();
"""


def shots(browser, url, out, prefix=""):
    """Frame by frame on coming back to the tab: a key held while leaving and
    released while away (1-1), keys pressed while away (2-3, 2-4, 7-1, 7-2, 6-3),
    and Esc held while leaving and still held on coming back (3-4)."""
    os.makedirs(out, exist_ok=True)
    context, page, _ = open_board(browser, url)
    page.evaluate(AWAY_PROBE)
    open_tester(page)
    page.wait_for_function("window.keybardTester && window.keybardTester.stats().reads > 10")
    press(page, 1, 1, True)
    page.wait_for_timeout(200)
    page.screenshot(path=os.path.join(out, f"{prefix}0-before-leaving.png"))
    away(page, "hidden")
    page.wait_for_timeout(100)
    press(page, 1, 1, False)
    for r, c in ((2, 3), (2, 4), (7, 1), (7, 2), (6, 3)):
        fw(page, f"f.flicker({r}, {c})")
    page.wait_for_timeout(200)
    page.evaluate(FRAME_GATE)
    page.evaluate("window.__back('hidden')")
    for i in range(1, 5):
        page.evaluate("window.__oneFrame()")
        page.wait_for_timeout(30)  # replies land meanwhile; the next frame draws them
        page.screenshot(path=os.path.join(out, f"{prefix}{i}-frame-{i}.png"))
    page.evaluate("window.__thaw()")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(out, f"{prefix}5-settled.png"))
    context.close()
    # Esc held while switching away (window focus), released, then back.
    context, page, _ = open_board(browser, url)
    page.evaluate(AWAY_PROBE)
    open_tester(page)
    page.wait_for_function("window.keybardTester && window.keybardTester.stats().reads > 10")
    row, col = exit_key(page)
    press(page, row, col, True)
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(out, f"{prefix}esc-0-held.png"))
    away(page, "blur")
    page.wait_for_timeout(2600)
    page.screenshot(path=os.path.join(out, f"{prefix}esc-1-away.png"))
    press(page, row, col, False)
    back(page, "blur")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(out, f"{prefix}esc-2-back.png"))
    context.close()


def main() -> int:
    flows = []
    for name, fn in (("1. pressed while away", flow_pressed_while_away),
                     ("2. held while leaving", flow_held_while_leaving),
                     ("3. Esc held while leaving", flow_esc_held_while_leaving),
                     ("4. normal use", flow_normal_use)):
        for label, board in BOARDS:
            for how in HOWS:
                for live in (True, False):
                    flows.append((f"{name} [{label}, {how}, live {'on' if live else 'off'}]", fn, board, how, live))
    only = os.environ.get("ONLY")
    if only:
        flows = [f for f in flows if only in f[0]]
    failed = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        print(f"Testing {url}")
        try:
            for label, flow, board, how, live in flows:
                try:
                    flow(browser, url, board, how, live)
                    print(f"PASS {label}")
                except Exception as error:  # noqa: BLE001 - report every flow
                    failed += 1
                    lines = str(error).strip().splitlines() or [repr(error)]
                    print(f"FAIL {label}\n     {lines[0]}")
            if os.environ.get("SHOT_DIR"):
                shots(browser, url, os.environ["SHOT_DIR"])
                print(f"screenshots in {os.environ['SHOT_DIR']}")
        finally:
            browser.close()
    print(f"{len(flows) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
