"""
Browser flow: Tune touchpad and Trackball sensors are modals that return to the
place they were opened from (?fakeBoard=pointing). Run with
`npm run test:e2e:pointing-modals`. Set E2E_SHOTS to a folder for screenshots.

  1. From the Pointing Devices panel (rail): each hand's tuner button opens its
     modal; closing it leaves the panel as it was (cards, scroll position, the
     panel still the active one).
  2. From Settings > Hardware: the module rows' buttons open the same modals;
     closing returns to Settings with Hardware still open and the scroll kept.
  3. From the bottom tray: the same, and closing returns to the tray.
  4. The trackball view polls the board only while open.
  5. ?tune=trackball and ?panel=trackball land on Pointing Devices with the
     modal open; closing it leaves the panel.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

SHOTS = os.environ.get("E2E_SHOTS")
MODALS = (
    ("trackball", "[data-tuner=trackball]", "[data-trackball-sensor-dialog]"),
    ("touchpad", "[data-tuner=touchpad]", "[data-touchpad-tuning-dialog]"),
)
SCROLLER = """(sel) => {
  let e = document.querySelector(sel);
  while (e && e.scrollHeight <= e.clientHeight + 1) e = e.parentElement;
  return e;
}"""


def main() -> int:
    failures: list[str] = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for scheme in ("light", "dark"):
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=scheme, reduced_motion="reduce")
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            def go(query: str):
                page.goto(f"{url}?fakeBoard=pointing&theme={scheme}&{query}")
                wait_connected(page)
                page.wait_for_timeout(900)

            def shot(name: str):
                if SHOTS:
                    os.makedirs(SHOTS, exist_ok=True)
                    page.screenshot(path=os.path.join(SHOTS, f"{name}-{scheme}.png"))

            def open_and_close(name: str, button: str, dialog: str, scope: str, still_here, what: str):
                page.locator(f"{scope} {button}").first.click()
                expect(page.locator(dialog)).to_be_visible(timeout=10000)
                page.wait_for_timeout(1200)
                shot(f"{name}-modal-over-{what.replace(' ', '-')}")
                page.keyboard.press("Escape")
                expect(page.locator(dialog)).to_be_hidden(timeout=5000)
                page.wait_for_timeout(300)
                check(still_here(), f"{scheme} {name}: back on {what} after closing")

            # 1. The rail.
            go("panel=pointing")
            panel_here = lambda: page.locator("[data-pointing-top]").is_visible() and page.locator("[data-hand]").count() == 2  # noqa: E731
            for name, button, dialog in MODALS:
                scroller = page.evaluate_handle(SCROLLER, "[data-pointing-top]").as_element()
                before = scroller.evaluate("e => e.scrollTop") if scroller else 0
                open_and_close(name, button, dialog, "[data-pointing-top]", panel_here, "Pointing Devices")
                after = scroller.evaluate("e => e.scrollTop") if scroller else 0
                check(abs(after - before) <= 2, f"{scheme} {name}: panel scroll kept ({before} -> {after})")

            # 2. Settings > Hardware.
            go("panel=settings")
            expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
            settings_here = lambda: page.get_by_label("Search settings").is_visible() and page.locator("[data-pointing-instance]").first.is_visible()  # noqa: E731
            for name, button, dialog in MODALS:
                open_and_close(name, button, dialog, "[data-pointing-instance]", settings_here, "Settings Hardware")
            check(page.locator("[data-settings-section=pointing]").count() == 0, f"{scheme}: Settings has no Pointing card")

            # 3. The tray.
            go("panel=pointing&panelPosition=bottombar")
            tray_here = lambda: page.locator("[data-pointing-tray]").is_visible() and page.locator("[data-hand]").count() == 2  # noqa: E731
            for name, button, dialog in MODALS:
                open_and_close(name, button, dialog, "[data-pointing-tray]", tray_here, "the tray")

            # 4 and 5. Deep links; the view unmounts on close, which stops its polling.
            for query in ("panel=pointing&tune=trackball", "panel=trackball"):
                go(query)
                expect(page.locator("[data-trackball-sensor-dialog]")).to_be_visible(timeout=10000)
                expect(page.get_by_test_id("trackball-panel")).to_be_visible(timeout=15000)
                page.keyboard.press("Escape")
                expect(page.locator("[data-trackball-sensor-dialog]")).to_be_hidden(timeout=5000)
                check(panel_here(), f"{scheme} ?{query}: lands on Pointing Devices and stays there after closing")
                check(page.get_by_test_id("trackball-panel").count() == 0, f"{scheme} ?{query}: sensor view unmounted (polling stopped)")
            go("panel=settings&tune=touchpad")
            expect(page.locator("[data-touchpad-tuning-dialog]")).to_be_visible(timeout=10000)
            page.keyboard.press("Escape")
            check(settings_here(), f"{scheme} ?panel=settings&tune=touchpad: returns to Settings")
            check(not errors, f"{scheme}: no page errors {errors}")
            ctx.close()
        browser.close()
    print("FAILED" if failures else "all ok")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
