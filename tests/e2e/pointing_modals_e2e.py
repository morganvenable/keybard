"""
Browser flow: the touchpad live view and the trackball sensor view are both
modals over Settings (?fakeBoard=pointing). Run with
`npm run test:e2e:pointing-modals`. Set E2E_SHOTS to a folder for screenshots.

  1. Open from Settings > Pointing > Advanced > Live view, then close: Settings
     is still open, Pointing and Advanced still expanded, scroll kept.
  2. The same for the touchpad live view.
  3. The trackball view polls the board only while open.
  4. ?panel=trackball opens Settings plus the trackball modal.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

SHOTS = os.environ.get("E2E_SHOTS")
CARD = "#settings-section-pointing"
SCROLLER = """() => {
  let e = document.querySelector('[data-pointing-section]');
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
            polls = {"n": 0}

            def go(query: str):
                page.goto(f"{url}?fakeBoard=pointing&theme={scheme}&{query}")
                wait_connected(page)
                expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
                page.wait_for_timeout(400)

            def adv():
                return page.locator("[data-disclosure=pointing-advanced] > h5 button")

            go("panel=pointing-settings")
            if adv().get_attribute("aria-expanded") != "true":
                adv().click()
            page.locator("[data-row='Trackball sensors']").scroll_into_view_if_needed()
            page.wait_for_timeout(300)

            def state():
                return page.evaluate(f"""() => {{
                    const s = ({SCROLLER})();
                    return {{ top: s ? s.scrollTop : -1 }};
                }}""")

            for name, row, button, dialog in (
                ("trackball", "Trackball sensors", "Open sensor view", "[data-trackball-sensor-dialog]"),
                ("touchpad", "Touchpads", "Open live view", "[data-touchpad-tuning-dialog]"),
            ):
                before = state()["top"]
                page.locator(f"[data-row='{row}']").get_by_role("button", name=button).click()
                expect(page.locator(dialog)).to_be_visible(timeout=10000)
                page.wait_for_timeout(1500)
                if SHOTS:
                    os.makedirs(SHOTS, exist_ok=True)
                    page.screenshot(path=os.path.join(SHOTS, f"{name}-modal-over-settings-{scheme}.png"))
                page.keyboard.press("Escape")
                expect(page.locator(dialog)).to_be_hidden(timeout=5000)
                page.wait_for_timeout(300)
                check(page.get_by_label("Search settings").is_visible(), f"{scheme} {name}: Settings still open after close")
                check(page.locator(f"{CARD}-title button").get_attribute("aria-expanded") == "true", f"{scheme} {name}: Pointing still expanded")
                check(adv().get_attribute("aria-expanded") == "true", f"{scheme} {name}: Advanced still expanded")
                after = state()["top"]
                check(abs(after - before) <= 2, f"{scheme} {name}: scroll kept ({before} -> {after})")

            # Deep link, then close; the view unmounts, which stops its polling.
            go("panel=trackball")
            expect(page.locator("[data-trackball-sensor-dialog]")).to_be_visible(timeout=10000)
            expect(page.get_by_test_id("trackball-panel")).to_be_visible(timeout=15000)
            check(page.get_by_label("Search settings").is_visible(), f"{scheme}: ?panel=trackball opens Settings behind the modal")
            page.keyboard.press("Escape")
            expect(page.locator("[data-trackball-sensor-dialog]")).to_be_hidden(timeout=5000)
            check(page.get_by_label("Search settings").is_visible(), f"{scheme}: Settings stays after closing the deep-linked modal")
            check(page.get_by_test_id("trackball-panel").count() == 0, f"{scheme}: sensor view unmounted (polling stopped)")
            check(not errors, f"{scheme}: no page errors {errors}")
            ctx.close()
        browser.close()
    print("FAILED" if failures else "all ok")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
