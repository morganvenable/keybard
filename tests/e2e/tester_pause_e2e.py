"""
Browser tests of the matrix tester (typing pause, flicker latch, drawing) against
the simulated Svalboard (?fakeBoard). Its replies come 4 ms after each request:
the round trip of a flicker latch read on the trackball test board (3.9 ms
median; a VIA matrix read is 3.0 ms). Run with `npm run test:e2e:tester-pause`.

  1. Opening the tester sends TYPING_PAUSE on; the note is two short lines
     ("Typing paused while testing", "Leave this screen to type again · Hold
     Esc 2 s to leave") and lists no blocked keys.
  2. The pause is renewed while the tester stays open.
  3. Holding the board's Esc key shows "Keep holding to close: 2", then "1",
     in whole steps, and closes at about 2 s; the pause ends with an off.
  4. Tapping Esc only lights it.
  5. Losing window focus sends off at once and stops renewing; focus resumes.
  6. Tab stays inside the tester. The editors' spotlight scrim covers the rest
     of the editor: a click on the rail, Settings or a layer tab lands
     on the scrim, the layer bar is inert, and the tester's note and Close stay
     above it. The scrim goes when the tester closes.
  7. Keybard's shortcuts and listeners see no keys.
  8. Escape from another keyboard and Close both exit.
  9. Older firmware (?fakeBoard=nopause): its one-line note ("Your firmware
     can't pause typing. Update to block keys while testing."), no pause requests, keys
     swallowed, Escape exits, Update firmware opens the firmware settings;
     keys still light from VIA's matrix state.
 10. The note fits at phone and desktop widths, light and dark, each line on
     one line at desktop, under the scrim checks; one note style (no ?testerNote).
 11. A one-scan flicker shows for at least one frame and counts; Reset counts clears.
 12. Tester keys have no transition or animation.
 13. Nothing renders in React while nothing changes, or while keys change fast.
 14. With keys changing at a high rate, frames keep the display rate with no
     long tasks; reads per second, frame rate, main-thread time per frame and
     main-thread busy share are printed.

It builds the app like fake_board_e2e.py (E2E_URL and E2E_SKIP_BUILD work the
same). SHOT_DIR=path also saves screenshots of the tester, light and dark.
Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

REPLY_DELAY_MS = 4  # flicker latch read round trip on the trackball test board
TESTER = "[data-matrix-tester]"
METRICS = {}

# Counts React commits (the DevTools hook React calls on every commit).
COMMIT_PROBE = """
window.__commits = 0;
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true, renderers: new Map(), inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
  onCommitFiberRoot() { window.__commits++; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
};
"""


def open_board(browser, url: str, board: str = "fakeBoard", params: str = "", viewport=(1440, 900), scheme="light"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme,
                                  reduced_motion="reduce")
    context.add_init_script(COMMIT_PROBE)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&theme={scheme}{('&' + params) if params else ''}")
    wait_connected(page)
    page.evaluate(f"window.keybardFakeBoard.device.replyDelayMs = {REPLY_DELAY_MS}")
    return context, page, errors


def open_tester(page: Page):
    page.get_by_role("button", name="Matrix Tester", exact=True).first.click()
    expect(page.locator(TESTER)).to_be_visible()


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def requests(page: Page):
    return fw(page, "f.pauseRequests.map(r => r.op)")


def pause_state(page: Page) -> str:
    return fw(page, "f.typingPauseState()")


def press(page: Page, row: int, col: int, down: bool):
    fw(page, f"f.{'press' if down else 'release'}({row}, {col})")


def exit_key(page: Page):
    key = page.locator("[data-tester-exit-mark] [data-exit-key]").first.get_attribute("data-exit-key")
    row, col = key.split("-")
    return int(row), int(col)


def countdown(page: Page):
    el = page.locator("[data-tester-exit-countdown]")
    return None if el.get_attribute("hidden") is not None else el.inner_text()


def spy_listeners(page: Page):
    """A bubble-phase listener on window, as Keybard's shortcuts use; it records what reaches it."""
    page.evaluate("""() => {
        window.__seen = [];
        for (const t of ['keydown', 'keyup']) window.addEventListener(t, (e) => window.__seen.push(t + ':' + e.key));
    }""")


def flow_open_sends_on(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    page.wait_for_timeout(200)
    assert requests(page)[:1] == [1], requests(page)
    assert pause_state(page) == "paused"
    note = page.locator("[data-tester-note='paused']")
    lines = note.locator("[data-tester-note-line]")
    expect(lines).to_have_text(["Typing paused while testing", "Leave this screen to type again · Hold Esc 2 s to leave"])
    for word in ("Windows", "Tab", "Ctrl", "media"):
        expect(note).not_to_contain_text(word)
    assert page.locator(TESTER).get_attribute("data-typing-pause") == "on"
    assert page.locator(TESTER).get_attribute("data-flicker-latch") == "on"
    assert not errors, errors
    context.close()


def flow_renews(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    page.wait_for_timeout(3000)  # twice the board's lease
    assert pause_state(page) == "paused"
    ons = [op for op in requests(page) if op == 1]
    assert len(ons) >= 5, f"only {len(ons)} renewals in 3 s"
    context.close()


def flow_hold_esc_exits(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    row, col = exit_key(page)
    assert (row, col) == (3, 4), (row, col)  # the seeded keymap's Esc
    before = len(requests(page))
    # The countdown's text, frame by frame, from the moment the switch goes down.
    page.evaluate("""() => {
        window.__cd = []; const t0 = performance.now();
        const f = () => {
            const el = document.querySelector('[data-tester-exit-countdown]');
            const text = !document.querySelector('[data-matrix-tester]') ? 'closed' : (el && !el.hidden ? el.textContent : '');
            const last = window.__cd[window.__cd.length - 1];
            if (!last || last[1] !== text) window.__cd.push([performance.now() - t0, text]);
            if (text !== 'closed') requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
    }""")
    press(page, row, col, True)
    expect(page.locator(TESTER)).to_have_count(0, timeout=4000)
    log = page.evaluate("window.__cd")
    if len(log) >= 2 and log[-2][1] == "" and log[-1][1] == "closed":
        log = log[:-2] + [[log[-2][0], "closed"]]  # hidden on the frame it closes
    texts = [t for _, t in log]
    assert texts == ["", "Keep holding to close: 2", "Keep holding to close: 1", "closed"], log
    shown, one, closed = log[1][0], log[2][0], log[3][0]
    assert shown <= 60, f"the countdown showed {shown:.0f} ms after the press"
    assert 980 <= one - shown <= 1040, f"stepped to 1 after {one - shown:.0f} ms"
    assert 1980 <= closed - shown <= 2060, f"closed {closed - shown:.0f} ms into the hold"
    press(page, row, col, False)
    page.wait_for_timeout(200)
    assert 0 in requests(page)[before:], requests(page)[before:]
    assert pause_state(page) in ("ending", "off")
    assert not errors, errors
    context.close()


def flow_tap_esc_lights(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    row, col = exit_key(page)
    press(page, row, col, True)
    page.wait_for_timeout(300)
    assert countdown(page) == "Keep holding to close: 2"
    assert page.locator(f"[data-matrix-key='{row}-{col}']").get_attribute("data-down") is not None
    press(page, row, col, False)
    page.wait_for_timeout(100)
    assert countdown(page) is None
    page.wait_for_timeout(2000)
    expect(page.locator(TESTER)).to_be_visible()
    assert pause_state(page) == "paused"
    context.close()


def flow_blur_sends_off(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    page.wait_for_timeout(600)
    n = len(requests(page))
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    page.wait_for_timeout(100)
    after = requests(page)[n:]
    assert after[:1] == [0], f"blur sent {after}"
    page.wait_for_timeout(1200)
    assert 1 not in requests(page)[n:], "renewed while unfocused"
    assert pause_state(page) in ("ending", "off")
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    page.wait_for_timeout(100)
    assert requests(page)[-1] == 1
    assert pause_state(page) == "paused"
    context.close()


def flow_tab_stays(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    for _ in range(6):
        page.keyboard.press("Tab")
    inside = page.evaluate(f"!!document.activeElement.closest('{TESTER}')")
    assert inside, page.evaluate("document.activeElement.outerHTML.slice(0, 120)")
    assert page.evaluate(f"!document.querySelector('{TESTER}').closest('[inert]')"), "the tester itself is inert"
    spotlight_checks(page)
    page.locator("[data-tester-close]").click()
    expect(page.locator(TESTER)).to_have_count(0)
    expect(page.locator("[data-binding-scrim]")).to_have_count(0)
    context.close()


# What a click at the middle of an element lands on: "scrim", "tester" or something else.
HIT = """(el) => { const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !at ? 'none' : at.closest('[data-binding-scrim]') ? 'scrim' : at.closest('[data-matrix-tester]') ? 'tester' : at.outerHTML.slice(0, 80); }"""
LAYER_BAR = "button[aria-label^='Layer 0:']"


def spotlight_checks(page: Page, label: str = ""):
    """The tester under the editors' spotlight: the scrim is there; outside is dimmed and out of reach."""
    scrim = page.locator("[data-binding-scrim]")
    expect(scrim).to_have_count(1)
    color = scrim.evaluate("e => getComputedStyle(e).backgroundColor")
    assert color not in ("rgba(0, 0, 0, 0)", "transparent"), f"{label} scrim has no color: {color}"
    outside = {
        "rail": page.locator("[data-sidebar='menu'] button[aria-label]").first,
        "layer bar": page.locator(LAYER_BAR).first,
        "Settings": page.locator("[data-sidebar='menu'] button[aria-label^='Settings']").first,
        "Combos": page.locator("[data-sidebar='menu'] button[aria-label='Combos']").first,
        "toolbar": page.get_by_text("Live Updating", exact=True).first,
    }
    seen = 0
    for name, el in outside.items():
        if el.count() == 0 or not el.is_visible():
            continue
        seen += 1
        hit = el.evaluate(HIT)
        assert hit == "scrim", f"{label} a click on the {name} lands on {hit!r}, not the scrim"
    need = 3 if page.viewport_size["width"] >= 1000 else 1
    assert seen >= need, f"{label} only {seen} outside areas found"
    layers = page.locator(LAYER_BAR)
    if layers.count():
        assert layers.first.evaluate("e => !!e.closest('[inert]')"), f"{label} the layer bar is not inert"
    for sel in ("[data-tester-close]", "[data-tester-note]"):
        hit = page.locator(sel).first.evaluate(HIT)
        assert hit == "tester", f"{label} {sel} is covered: {hit!r}"


def flow_shortcuts_off(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    spy_listeners(page)
    sidebar = page.locator("[data-state][data-collapsible]").first
    state = sidebar.get_attribute("data-state") if sidebar.count() else None
    for k in ("Control+b", "Control+v", "Delete", "Backspace", "a", "Shift", "Meta"):
        page.keyboard.press(k)
    page.wait_for_timeout(200)
    assert page.evaluate("window.__seen.length") == 0, page.evaluate("window.__seen")
    if state is not None:
        assert sidebar.get_attribute("data-state") == state, "Ctrl+B toggled the sidebar"
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(page.locator(TESTER)).to_be_visible()
    context.close()


def flow_escape_and_close(browser, url):
    context, page, errors = open_board(browser, url)
    open_tester(page)
    page.wait_for_timeout(300)
    n = len(requests(page))
    page.keyboard.press("Escape")
    expect(page.locator(TESTER)).to_have_count(0)
    page.wait_for_timeout(150)
    assert 0 in requests(page)[n:]
    open_tester(page)
    page.locator("[data-tester-close]").click()
    expect(page.locator(TESTER)).to_have_count(0)
    spy_listeners(page)  # the editor works again: keys reach the page
    page.keyboard.press("a")
    assert page.evaluate("window.__seen.length") > 0
    context.close()


def flow_older_firmware(browser, url):
    context, page, errors = open_board(browser, url, board="fakeBoard=nopause")
    open_tester(page)
    note = page.locator("[data-tester-note='unsupported']")
    expect(note.locator("[data-tester-note-line]")).to_have_text(["Your firmware can't pause typing. Update to block keys while testing."])
    expect(note.locator("[data-tester-update-firmware]")).to_have_text("Update")
    assert page.locator(TESTER).get_attribute("data-typing-pause") == "unsupported"
    assert page.locator(TESTER).get_attribute("data-flicker-latch") == "off"
    press(page, 2, 2, True)
    expect(page.locator("[data-matrix-key='2-2']")).to_have_attribute("data-down", "")
    press(page, 2, 2, False)
    expect(page.locator("[data-matrix-key='2-2']")).not_to_have_attribute("data-down", "")
    expect(page.locator("[data-key-count]")).to_have_count(0)
    page.wait_for_timeout(500)
    assert requests(page) == [], requests(page)
    spy_listeners(page)
    for k in ("Tab", "a", "Meta", "Control+b"):
        page.keyboard.press(k)
    assert page.evaluate("window.__seen.length") == 0
    page.keyboard.press("Escape")
    expect(page.locator(TESTER)).to_have_count(0)
    open_tester(page)
    note.locator("[data-tester-update-firmware]").click()
    expect(page.locator(TESTER)).to_have_count(0)
    expect(page.locator("[data-settings-section='firmware']").first).to_be_visible(timeout=5000)
    assert not errors, errors
    context.close()


def flow_layout(browser, url):
    for width, height in ((390, 844), (1440, 900)):
        for scheme in ("light", "dark"):
            for board in ("fakeBoard", "fakeBoard=nopause"):
                label = f"{board} @ {width} {scheme}"
                context, page, errors = open_board(browser, url, board=board, params="tester", viewport=(width, height), scheme=scheme)
                note = page.locator("[data-tester-note]")
                expect(note).to_be_visible()
                page.wait_for_timeout(300)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"{label}: sideways scroll"
                row = page.locator("[data-tester-note-row]").bounding_box()
                assert row and row["x"] >= 0 and row["x"] + row["width"] <= width + 1, f"{label}: {row}"
                assert note.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), f"{label}: note overflows"
                if width >= 1440:
                    one = note.locator("[data-tester-note-line]").evaluate_all(
                        "ls => ls.every(l => l.getBoundingClientRect().height <= parseFloat(getComputedStyle(l).lineHeight) * 1.5)")
                    assert one, f"{label}: a note line wraps"
                spotlight_checks(page, label)
                assert page.locator("[data-tester-note-style]").count() == 0, f"{label}: a note style"
                assert not errors, errors
                context.close()


def flow_flicker(browser, url):
    context, page, errors = open_board(browser, url, params="tester")
    expect(page.locator(TESTER)).to_be_visible()
    page.wait_for_timeout(300)
    page.evaluate("""() => {
        window.__downs = 0;
        const el = document.querySelector("[data-matrix-key='2-3']");
        new MutationObserver((ms) => { for (const m of ms) if (el.hasAttribute('data-down')) window.__downs++; })
            .observe(el, { attributes: true, attributeFilter: ['data-down'] });
    }""")
    fw(page, "f.flicker(2, 3)")  # down and up within one scan, between two reads
    badge = page.locator("[data-key-count='2-3']")
    expect(badge).to_have_text("1")
    page.wait_for_timeout(100)
    assert page.evaluate("window.__downs") >= 1, "the flicker never showed"
    key = page.locator("[data-matrix-key='2-3']")
    assert key.get_attribute("data-down") is None, "the key stayed lit after the flicker"
    assert key.get_attribute("data-seen") is not None
    fw(page, "f.flicker(2, 3)")
    expect(badge).to_have_text("2")
    page.locator("[data-tester-reset-counts]").click()
    expect(badge).to_be_hidden()
    fw(page, "f.flicker(2, 3)")
    expect(badge).to_have_text("1")
    assert not errors, errors
    context.close()


def flow_no_animation(browser, url):
    context, page, errors = open_board(browser, url, params="tester")
    expect(page.locator(TESTER)).to_be_visible()
    press(page, 1, 1, True)
    expect(page.locator("[data-matrix-key='1-1']")).to_have_attribute("data-down", "")
    bad = page.evaluate("""() => [...document.querySelectorAll('[data-matrix-key], [data-matrix-key] *, [data-key-count], [data-tester-exit-countdown]')]
        .map(e => getComputedStyle(e)).filter(s => s.transitionDuration.split(',').some(d => parseFloat(d) !== 0)
            || s.animationDuration.split(',').some(d => parseFloat(d) !== 0) || s.animationName !== 'none')
        .map(s => s.transitionDuration + ' / ' + s.animationDuration + ' ' + s.animationName)""")
    assert not bad, bad[:5]
    context.close()


def flow_no_renders(browser, url):
    context, page, errors = open_board(browser, url, params="tester")
    expect(page.locator(TESTER)).to_be_visible()
    page.wait_for_timeout(1000)
    c0 = page.evaluate("window.__commits")
    r0 = page.evaluate("window.keybardTester.stats()")
    page.wait_for_timeout(2000)
    idle = page.evaluate("window.__commits") - c0
    r1 = page.evaluate("window.keybardTester.stats()")
    page.evaluate("""() => { const f = window.keybardFakeBoard.device.firmware; let i = 0;
        window.__churn = setInterval(() => { const r = i % 10, c = (i >> 3) % 5; (i & 1) ? f.release(r, c) : f.press(r, c); i++; }, 2); }""")
    c1 = page.evaluate("window.__commits")
    page.wait_for_timeout(2000)
    busy = page.evaluate("window.__commits") - c1
    r2 = page.evaluate("window.keybardTester.stats()")
    page.evaluate("clearInterval(window.__churn)")
    METRICS["react_commits_idle_2s"] = idle
    METRICS["react_commits_busy_2s"] = busy
    assert (r1["renders"], r1["gridRenders"]) == (r0["renders"], r0["gridRenders"]), f"the tester rendered while idle: {r0} {r1}"
    assert (r2["renders"], r2["gridRenders"]) == (r1["renders"], r1["gridRenders"]), f"the tester rendered while keys changed: {r1} {r2}"
    assert r2["drawnFrames"] > r1["drawnFrames"], "keys changed but no frame drew them"
    assert idle <= 1, f"{idle} React commits in 2 s with nothing changing"
    assert busy <= 2, f"{busy} React commits in 2 s while keys change fast"
    context.close()


def flow_perf(browser, url):
    context, page, errors = open_board(browser, url, params="tester")
    expect(page.locator(TESTER)).to_be_visible()
    cdp = context.new_cdp_session(page)
    cdp.send("Performance.enable")

    def task_s():
        return {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}["TaskDuration"]

    def window(seconds):
        page.evaluate("""() => { window.__f = []; window.__long = 0;
            try { new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask', buffered: false }); } catch (e) {}
            const tick = (t) => { window.__f.push(t); if (window.__f.length < 100000) window.__raf = requestAnimationFrame(tick); };
            window.__raf = requestAnimationFrame(tick); }""")
        s0 = page.evaluate("window.keybardTester.stats()")
        t0 = task_s()
        page.wait_for_timeout(int(seconds * 1000))
        t1 = task_s()
        s1 = page.evaluate("window.keybardTester.stats()")
        f = page.evaluate("cancelAnimationFrame(window.__raf), window.__f")
        long_tasks = page.evaluate("window.__long")
        gaps = sorted(b - a for a, b in zip(f, f[1:]))
        fps = (len(f) - 1) / ((f[-1] - f[0]) / 1000)
        return dict(fps=round(fps, 1), worst_frame_gap_ms=round(gaps[-1], 1), long_tasks=long_tasks,
                    reads_per_s=round((s1["reads"] - s0["reads"]) / seconds),
                    main_thread_busy_pct=round(100 * (t1 - t0) / seconds, 1),
                    main_thread_ms_per_frame=round(1000 * (t1 - t0) / max(1, len(f) - 1), 2))

    idle = window(3)
    page.evaluate("""() => { const f = window.keybardFakeBoard.device.firmware; let i = 0;
        window.__churn = setInterval(() => { for (let k = 0; k < 4; k++) { const r = i % 10, c = (i >> 3) % 5; (i & 1) ? f.release(r, c) : f.press(r, c); i++; } }, 1); }""")
    busy = window(3)
    page.evaluate("clearInterval(window.__churn)")
    METRICS["mock_idle"] = idle
    METRICS["mock_keys_changing"] = busy
    assert busy["fps"] >= 0.9 * idle["fps"], f"frames dropped while keys change: {busy['fps']} vs {idle['fps']} fps"
    assert busy["long_tasks"] == 0, f"{busy['long_tasks']} long tasks"
    assert busy["worst_frame_gap_ms"] < 50, f"a {busy['worst_frame_gap_ms']} ms frame gap"
    assert busy["reads_per_s"] >= 100, f"only {busy['reads_per_s']} reads/s"
    context.close()


def shots(browser, url, out):
    os.makedirs(out, exist_ok=True)
    for scheme in ("light", "dark"):
        for board, kind in (("fakeBoard", "paused"), ("fakeBoard=nopause", "old")):
            context, page, _ = open_board(browser, url, board=board, params="tester", scheme=scheme)
            expect(page.locator("[data-tester-note]")).to_be_visible()
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(out, f"tester-{kind}-{scheme}.png"))
            context.close()
        context, page, _ = open_board(browser, url, params="tester", viewport=(390, 844), scheme=scheme)
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(out, f"tester-paused-{scheme}-phone.png"))
        context.close()
    # Holding Esc, flickers counted, a key down.
    context, page, _ = open_board(browser, url, params="tester")
    page.wait_for_timeout(300)
    for _ in range(3):
        fw(page, "f.flicker(2, 3)")
        page.wait_for_timeout(30)
    fw(page, "f.flicker(7, 1)")
    press(page, 6, 2, True)
    row, col = exit_key(page)
    press(page, row, col, True)
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(out, "hold-esc-and-counts.png"))
    context.close()


def main() -> int:
    flows = [
        ("1. opening the tester sends the pause on; the note names Esc", flow_open_sends_on),
        ("2. the pause is renewed while the tester is open", flow_renews),
        ("3. holding Esc counts down 2, 1 in whole steps and closes at 2 s; off is sent", flow_hold_esc_exits),
        ("4. tapping Esc only lights it", flow_tap_esc_lights),
        ("5. blur sends off at once and stops renewing; focus resumes", flow_blur_sends_off),
        ("6. Tab stays inside the tester; the spotlight scrim covers the editor", flow_tab_stays),
        ("7. Keybard's shortcuts and listeners see no keys", flow_shortcuts_off),
        ("8. Escape from another keyboard and Close both exit", flow_escape_and_close),
        ("9. older firmware: its note, no requests, keys swallowed, Escape exits, Update firmware", flow_older_firmware),
        ("10. the note fits at phone and desktop widths, light and dark, one line each", flow_layout),
        ("11. a one-scan flicker shows and counts; Reset counts clears", flow_flicker),
        ("12. tester keys have no transition or animation", flow_no_animation),
        ("13. no React renders while idle or while keys change fast", flow_no_renders),
        ("14. frames keep the display rate with keys changing fast; no long tasks", flow_perf),
    ]
    failed = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        print(f"Testing {url}")
        for label, flow in flows:
            try:
                flow(browser, url)
                print(f"PASS {label}")
            except Exception as error:  # noqa: BLE001 - report every flow
                failed += 1
                lines = str(error).strip().splitlines() or [repr(error)]
                print(f"FAIL {label}\n     {lines[0]}")
                print("     " + "\n     ".join(lines[1:12]))
        if os.environ.get("SHOT_DIR"):
            shots(browser, url, os.environ["SHOT_DIR"])
            print(f"screenshots in {os.environ['SHOT_DIR']}")
        browser.close()
    print("metrics " + json.dumps(METRICS))
    print(f"{len(flows) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
