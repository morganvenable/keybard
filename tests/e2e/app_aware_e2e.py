"""
Browser flow tests of the App Taps + app-aware base layers prototype
(?proto=app-aware): the built app, the QWERTY Example, no keyboard, a pretend
app signal. Run with `npm run test:e2e:app-aware`.

Flows (each in light and dark, plus the layout checks):
  1. Older board: nothing of the prototype shows.
  2. First run: the empty app menu offers the last app in front and the
     All-apps basics; one click adds the app with its ready-made holds.
  3. Adding an app from "Seen recently", with its set.
  4. Editing holds: Tap / Hold in the key card, a one-click hold, the app's
     own mark, "Same as All apps"; Hold in the picker writes a hold, not a tap.
  5. Understanding: the key card lists the hold in every app.
  6. Base layers: make a layer for a game, the layer badge, the status line,
     keys held, debounce, manual change, lock, lost contact, Stop.
  7. Test as: the status line, and leaving Keybard turns it off.
  8. Keybard Overlay mock: base-change note and hint strip.
  9. Tap dances: the hold slot follows app holds; the Tap Dances panel marks it.
 10. Repeat warning on Backspace, with Undo.
 11. Selector option b (chips) and legend looks b and c render.
 12. No overlap or clipping: legends stay in their keys, the menu stays on
     screen, the status line does not cover the layer name, no page scroll.
 13. Bottom bar layout: the picker panel carries the Tap / Hold switch.

It builds the app (vite build, base /keybard-e2e/) into a temporary folder
and serves it with vite preview. Set E2E_URL to test a server that is already
running (its full base URL), E2E_DIST to build into, E2E_SKIP_BUILD=1 to reuse
a build. Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from contextlib import contextmanager

from playwright.sync_api import Page, expect, sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_PATH = "/keybard-e2e/"
NPX = shutil.which("npx") or "npx"
PROTO = "?demo&proto=app-aware"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextmanager
def app_url():
    if os.environ.get("E2E_URL"):
        yield os.environ["E2E_URL"].rstrip("/") + "/"
        return
    out_dir = os.environ.get("E2E_DIST") or os.path.join(tempfile.gettempdir(), "keybard-e2e-app-aware")
    if not os.environ.get("E2E_SKIP_BUILD"):
        subprocess.run([NPX, "vite", "build", f"--base={BASE_PATH}", f"--outDir={out_dir}", "--emptyOutDir"],
                       cwd=ROOT, check=True)
    port = free_port()
    server = subprocess.Popen(
        [NPX, "vite", "preview", f"--base={BASE_PATH}", f"--outDir={out_dir}", "--host", "127.0.0.1",
         "--port", str(port), "--strictPort"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}{BASE_PATH}"
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(url, timeout=1)
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError(f"vite preview did not start at {url}")
        yield url
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


CHECKS = {"passed": 0}


def ok(name: str):
    CHECKS["passed"] += 1
    print(f"  ok  {name}")


class Run:
    def __init__(self, browser, url: str, theme: str):
        self.browser, self.url, self.theme = browser, url, theme

    def open(self, query: str, bottom_bar: bool = False) -> Page:
        ctx = self.browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        stored = {"theme": self.theme, "panel-position": "bottombar" if bottom_bar else "sidebar"}
        ctx.add_init_script(
            f"try {{ localStorage.setItem('keyboard-settings', {json.dumps(json.dumps(stored))}); }} catch {{}}")
        page = ctx.new_page()
        page.errors = []
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.goto(self.url + PROTO + query + f"&theme={self.theme}")
        layout_key(page, "KC_Q").wait_for(timeout=20000)
        page.wait_for_timeout(700)
        return page

    def close(self, page: Page):
        if page.errors:
            raise AssertionError(f"page errors: {page.errors[:3]}")
        page.context.close()


def layout_key(page: Page, keycode: str):
    return page.locator(f'[data-keyboard-view-instance] [data-keycode="{keycode}"]').first


def legend(page: Page, keycode: str):
    return layout_key(page, keycode).locator("[data-app-hold]")


def own_count(page: Page) -> int:
    return page.locator('[data-keyboard-view-instance] [data-app-hold="own"]').count()


def status(page: Page):
    return page.locator("[data-board-status-text]")


def dev(page: Page):
    panel = page.locator("[data-dev-panel]")
    if not panel.locator('[data-dev="front"]').count():
        panel.get_by_role("button", name="Pretend signals").click()
    return panel


def boxes_overlap(a, b) -> bool:
    return not (a["x"] + a["width"] <= b["x"] or b["x"] + b["width"] <= a["x"]
                or a["y"] + a["height"] <= b["y"] or b["y"] + b["height"] <= a["y"])


def layout_checks(page: Page, label: str):
    """One-line layout checks: legends inside keys, nothing off screen, no overlap, no page scroll."""
    bad = page.evaluate("""() => {
        const out = [];
        for (const el of document.querySelectorAll('[data-keyboard-view-instance] [data-app-hold]')) {
            const k = el.closest('[data-keycap]').getBoundingClientRect(), r = el.getBoundingClientRect();
            if (r.left < k.left - 0.5 || r.right > k.right + 0.5 || r.top < k.top - 0.5 || r.bottom > k.bottom + 0.5)
                out.push('legend outside key ' + el.closest('[data-keycap]').dataset.keycode);
        }
        for (const sel of ['[data-app-menu]', '[data-board-status]', '[data-app-selector]', '[data-dev-panel]', '[data-overlay-mock] > *']) {
            for (const el of document.querySelectorAll(sel)) {
                const r = el.getBoundingClientRect();
                if (r.width && (r.left < 0 || r.right > innerWidth + 0.5 || r.top < 0 || r.bottom > innerHeight + 0.5)) out.push(sel + ' off screen');
            }
        }
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways');
        return out;
    }""")
    if bad:
        raise AssertionError(f"{label}: {bad}")
    name = page.locator("[data-keyboard-view-instance]").first.get_by_text("Layer 0", exact=True)
    st = page.locator("[data-board-status]")
    if name.count() and st.count() and boxes_overlap(name.first.bounding_box(), st.first.bounding_box()):
        raise AssertionError(f"{label}: status line covers the layer name")
    ts = page.locator("[data-test-as]")
    if ts.count() and st.count() and boxes_overlap(ts.first.bounding_box(), st.first.bounding_box()):
        raise AssertionError(f"{label}: status line covers Test as")
    ok(f"layout: {label}")


def flow_old_board(r: Run):
    p = r.open("&board=old")
    expect(p.locator("[data-app-selector]")).to_have_count(0)
    layout_key(p, "KC_C").click()
    expect(p.locator("[data-app-hold-card]")).to_have_count(0)
    expect(p.locator("[data-dev-panel]")).to_have_count(0)
    # Mod-tap keys keep today's header legend.
    expect(layout_key(p, "LGUI_T(KC_TAB)").locator("[data-app-hold]")).to_have_count(0)
    ok("older board: nothing shows")
    r.close(p)


def flow_first_run(r: Run):
    p = r.open("")
    p.locator("[data-app-selector]").click()
    expect(p.locator("[data-menu-start]")).to_be_visible()
    layout_checks(p, "first run menu")
    p.locator('[data-menu-start-app="figma"]').click()
    expect(p.locator("[data-app-selector]")).to_contain_text("Figma")
    assert own_count(p) == 7, own_count(p)
    expect(legend(p, "KC_D")).to_have_attribute("data-app-hold", "own")
    ok("first run: Start with Figma adds it with 7 holds")
    p.locator("[data-app-selector]").click()
    p.locator("[data-menu-start-basics]").click()
    expect(p.locator("[data-app-selector]")).to_contain_text("All apps")
    expect(legend(p, "KC_Z")).to_have_text("Undo")
    ok("first run: All-apps basics")
    r.close(p)


def flow_no_overlay_and_mac(r: Run):
    p = r.open("&overlay=off&menu=add")
    expect(p.locator("[data-menu-seen]")).to_have_count(0)
    expect(p.locator('[data-menu-page="add"]')).to_contain_text("Get Keybard Overlay")
    expect(p.locator("[data-board-status]")).to_have_count(0)
    ok("no Overlay: no seen apps, an install link, no status line")
    r.close(p)
    p = r.open("&os=mac&menu=open")
    expect(p.locator("[data-menu-overlay-note]")).to_contain_text("coming to Mac")
    ok("Mac: the menu says the Overlay is coming")
    r.close(p)


def flow_add_app(r: Run):
    p = r.open("&scene=holds&menu=add")
    p.locator('[data-menu-seen-set="excel"]').click()
    expect(p.locator("[data-app-selector]")).to_contain_text("Excel")
    expect(legend(p, "KC_R")).to_have_attribute("data-app-hold", "own")
    expect(legend(p, "KC_C")).to_have_attribute("data-app-hold", "inherited")
    ok("add app: Excel with its set; inherited holds dimmed")
    p.locator("[data-app-selector]").click()
    p.locator('[data-menu-manage="excel"]').click()
    expect(p.locator('[data-menu-page="manage"]')).to_be_visible()
    expect(p.locator("[data-menu-recognition]")).to_contain_text("EXCEL.EXE")
    layout_checks(p, "manage menu")
    ok("manage: recognition tucked under Recognized by")
    r.close(p)


def flow_edit_holds(r: Run):
    p = r.open("&scene=holds&app=figma&key=KC_Z&pick=hold")
    card = p.locator("[data-app-hold-card]")
    expect(card.locator('[data-pick-mode="hold"]')).to_have_attribute("aria-checked", "true")
    expect(legend(p, "KC_Z")).to_have_attribute("data-app-hold", "inherited")
    card.locator('[data-hold-action="Copy"]').click()
    expect(legend(p, "KC_Z")).to_have_attribute("data-app-hold", "own")
    expect(legend(p, "KC_Z")).to_have_text("Copy")
    expect(card.locator('[data-hold-row="figma"] [data-own-mark]')).to_be_visible()
    ok("edit: one-click hold marks the key as Figma's own")
    card.locator("[data-hold-same]").click()
    expect(legend(p, "KC_Z")).to_have_attribute("data-app-hold", "inherited")
    ok("edit: Same as All apps removes the override")
    # Tap leaves the tap unchanged for every app; Hold in the picker writes a hold.
    p.get_by_text("Standard Keys", exact=True).first.click()
    expect(p.locator("[data-pick-target]")).to_be_visible()
    p.locator('[data-picker-key="q"]').first.click()
    expect(legend(p, "KC_Z")).to_have_text("Q")
    expect(layout_key(p, "KC_Z")).to_be_visible()
    ok("edit: Hold in the picker writes Figma's hold, the tap stays Z")
    layout_checks(p, "editing with picker open")
    r.close(p)


def flow_everywhere(r: Run):
    p = r.open("&scene=holds&app=figma")
    layout_key(p, "KC_D").hover()
    rows = p.locator("[data-hold-everywhere] [data-hold-row]")
    expect(rows).to_have_count(3)
    expect(p.locator('[data-hold-row="figma"]')).to_contain_text("Duplicate")
    expect(p.locator('[data-hold-row="code"]')).to_contain_text("Add next match")
    ok("understanding: hovering a key lists its hold in every app")
    r.close(p)


def flow_base_layers(r: Run):
    p = r.open("&scene=holds&menu=add")
    p.locator('[data-menu-seen="elden"]').click()
    p.locator("[data-app-selector]").click()
    p.locator('[data-menu-manage="elden"]').click()
    expect(p.locator("[data-menu-make-layer]")).to_contain_text("11 of 16 layers free")
    p.locator("[data-menu-make-layer]").click()
    expect(p.locator('[data-layer-app-badge="3"]')).to_be_visible()
    expect(p.locator('[data-menu-base]')).to_have_value("3")
    ok("base layers: make a layer for Elden Ring; layer 3 gets its badge")
    p.keyboard.press("Escape")
    d = dev(p)
    d.locator('[data-dev="front"]').select_option("elden")
    expect(status(p)).to_have_text("Board is on Game layer because Elden Ring is in front")
    expect(p.locator('[data-keyboard-view-instance] [data-keycode="KC_ENTER"], [data-keyboard-view-instance] [data-keycode="LT1(KC_ENTER)"]')).to_have_count(1)
    layout_checks(p, "game layer status")
    ok("base layers: status line names the layer and the app")
    d.locator('[data-dev="held"]').click()
    d.locator('[data-dev="front"]').select_option("figma")
    expect(status(p)).to_contain_text("when you let go of the keys")
    d.locator('[data-dev="held"]').click()
    expect(status(p)).to_contain_text("Figma is in front")
    ok("base layers: switches wait until keys are lifted")
    d.locator('[data-dev="front"]').select_option("elden")
    expect(status(p)).to_contain_text("Elden Ring is in front")
    d.locator('[data-dev="flicker"]').click()
    p.wait_for_timeout(600)
    expect(status(p)).to_contain_text("Elden Ring is in front")
    expect(p.locator("[data-dev-log]")).to_contain_text("Ignored a switch shorter than 150 ms")
    ok("base layers: an alt-tab flick is ignored")
    d.locator('[data-dev="manual"]').select_option("1")
    expect(status(p)).to_have_text("Board is on Layer 1 because you switched to it")
    d.locator('[data-dev="front"]').select_option("figma")
    p.wait_for_timeout(400)
    d.locator('[data-dev="front"]').select_option("elden")
    expect(status(p)).to_contain_text("Elden Ring is in front")
    ok("base layers: a manual change wins until the next app change")
    d.locator('[data-dev="locked"]').click()
    expect(status(p)).to_contain_text("because the screen is locked")
    d.locator('[data-dev="locked"]').click()
    d.locator('[data-dev="overlay"]').click()
    expect(p.locator("[data-board-status]")).to_have_count(0)
    d.locator('[data-dev="overlay"]').click()
    expect(status(p)).to_contain_text("Elden Ring is in front")
    ok("base layers: lock screen and lost contact mean home")
    p.locator("[data-status-stop]").click()
    expect(p.locator('[data-board-status="paused"]')).to_be_visible()
    p.locator("[data-status-resume]").click()
    expect(status(p)).to_contain_text("Elden Ring is in front")
    ok("base layers: Stop pauses app switching")
    r.close(p)


def flow_type_pause_keys(r: Run):
    p = r.open("&scene=game&app=elden")
    expect(p.locator('[data-keyboard-view-instance] [data-keycap]').filter(has_text="Type")).to_have_count(1)
    layout_key(p, "KC_ESCAPE").click()
    p.get_by_text("Layer Keys", exact=True).first.click()
    p.locator('[data-app-key="APP_PAUSE"]').first.click()
    expect(p.locator('[data-keyboard-view-instance] [data-keycap]').filter(has_text="Pause")).to_have_count(1)
    ok("base layers: game layer has Type; Pause placed from Layer Keys")
    r.close(p)


def flow_test_as(r: Run):
    p = r.open("&scene=holds&app=figma")
    p.locator("[data-test-as]").click()
    expect(p.locator('[data-board-status="test"]')).to_be_visible()
    expect(p.locator("[data-test-field]")).to_be_visible()
    layout_checks(p, "test as")
    p.evaluate("""() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
                          document.dispatchEvent(new Event('visibilitychange')); }""")
    expect(p.locator('[data-board-status="test"]')).to_have_count(0)
    ok("test as: on, with a text box; leaving Keybard turns it off")
    r.close(p)


def flow_overlay(r: Run):
    p = r.open("&scene=overlay")
    expect(p.locator("[data-overlay-note]")).to_contain_text("Game layer: Elden Ring")
    expect(p.locator("[data-overlay-strip]")).to_contain_text("Figma")
    layout_checks(p, "overlay mock")
    ok("Overlay mock: base-change note and hint strip")
    r.close(p)


def flow_tapdance(r: Run):
    p = r.open("&scene=tapdance")
    card = p.locator("[data-app-hold-card]")
    expect(card.locator('[data-hold-row="all"]')).to_contain_text("Tap dance 0's hold")
    expect(card.locator('[data-hold-row="figma"]')).to_contain_text("Select all")
    card.locator("[data-edit-tapdance]").click()
    expect(p.locator('[data-td-app-holds="0"]').first).to_have_text("+1")
    ok("tap dances: the hold slot follows app holds; the panel marks it")
    r.close(p)


def flow_warning(r: Run):
    p = r.open("&scene=warn")
    w = p.locator("[data-hold-warning]")
    expect(w).to_contain_text("Holding Backspace won't repeat now")
    expect(legend(p, "KC_BSPACE")).to_have_text("Del wd")
    w.get_by_role("button", name="Undo").click()
    expect(legend(p, "KC_BSPACE")).to_have_count(0)
    ok("warning: a hold on Backspace warns, does not block; Undo")
    r.close(p)


def flow_options(r: Run):
    p = r.open("&scene=holds&selector=b")
    expect(p.locator('[data-app-selector="b"]')).to_be_visible()
    p.locator('[data-app-chip="code"]').click()
    expect(legend(p, "KC_P")).to_have_attribute("data-app-hold", "own")
    layout_checks(p, "selector b")
    ok("selector b: chips switch the app")
    r.close(p)
    for look in ("b", "c"):
        p = r.open(f"&scene=holds&app=figma&look={look}")
        expect(legend(p, "KC_D")).to_have_class(f"kb-hold kb-hold--{look} kb-hold--own")
        layout_checks(p, f"look {look}")
        r.close(p)
    ok("looks b and c render")


def flow_bottom_bar(r: Run):
    p = r.open("&scene=holds&app=figma&key=KC_C&pick=hold", bottom_bar=True)
    p.get_by_text("Standard Keys", exact=True).first.click()
    sw = p.locator("[data-pick-target]")
    expect(sw).to_be_visible()
    expect(sw.locator('[data-pick-mode="hold"]')).to_have_attribute("aria-checked", "true")
    layout_checks(p, "bottom bar")
    ok("bottom bar: the picker panel carries Tap / Hold")
    r.close(p)


FLOWS = [flow_old_board, flow_first_run, flow_no_overlay_and_mac, flow_add_app, flow_edit_holds, flow_everywhere,
         flow_base_layers, flow_type_pause_keys, flow_test_as, flow_overlay, flow_tapdance, flow_warning,
         flow_options, flow_bottom_bar]


def main() -> int:
    failures = []
    with app_url() as url, sync_playwright() as pw:
        browser = pw.chromium.launch()
        for theme in ("light", "dark"):
            print(f"[{theme}]")
            r = Run(browser, url, theme)
            for flow in FLOWS:
                try:
                    flow(r)
                except Exception as e:  # noqa: BLE001
                    failures.append(f"{theme} {flow.__name__}: {e}")
                    print(f"  FAIL {flow.__name__}: {str(e)[:400]}")
        browser.close()
    print(f"\n{CHECKS['passed']} checks passed, {len(failures)} flows failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
