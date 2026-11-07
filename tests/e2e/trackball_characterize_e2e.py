"""
Browser flow of the Trackball characterization panel against the simulated
Svalboard (?fakeBoard), which answers POINTING_SENSOR (0x39) with synthetic
samples. Opens the panel by its deep link (?panel=trackball), checks that both
hands fill in SQUAL numbers and the charts draw, that the window buttons and
Reset min/max work, and saves light and dark screenshots when
TRACKBALL_SHOTS names a folder. Run: python tests/e2e/trackball_characterize_e2e.py
"""
import os
import sys

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402

SHOTS = os.environ.get("TRACKBALL_SHOTS")


def run(url: str, scheme: str) -> list:
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=scheme, reduced_motion="reduce")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"{url}?comboEditor=panel&theme={scheme}&fakeBoard&panel=trackball")
        wait_connected(page)
        panel = page.get_by_test_id("trackball-panel")
        expect(panel).to_be_visible(timeout=15000)
        expect(page.get_by_test_id("sensor-0")).to_contain_text("PMW3389", timeout=15000)
        expect(page.get_by_test_id("sensor-1")).to_contain_text("PMW3389")
        page.wait_for_timeout(4000)  # a few seconds of history
        for h in (0, 1):
            assert page.get_by_test_id(f"squal-live-{h}").inner_text().strip().isdigit()
        for chart in ("squal", "shutter", "rawsum", "rawminmax", "motion"):
            assert page.get_by_test_id(f"chart-{chart}").locator("polyline").count() >= 2, chart
        left_min = float(page.get_by_test_id("squal-min-0").inner_text())
        left_max = float(page.get_by_test_id("squal-max-0").inner_text())
        assert left_min < left_max
        page.get_by_test_id("window-2").click()
        page.get_by_test_id("reset-extremes").click()
        page.wait_for_timeout(400)
        reset_span = float(page.get_by_test_id("squal-max-0").inner_text()) - float(page.get_by_test_id("squal-min-0").inner_text())
        assert reset_span <= left_max - left_min, "reset narrows the span"
        page.get_by_test_id("window-60").click()
        page.get_by_test_id("window-10").click()
        page.wait_for_timeout(1500)
        if SHOTS:
            os.makedirs(SHOTS, exist_ok=True)
            panel.screenshot(path=os.path.join(SHOTS, f"trackball-panel-{scheme}.png"))
            page.screenshot(path=os.path.join(SHOTS, f"trackball-page-{scheme}.png"))
        browser.close()
    return errors


if __name__ == "__main__":
    bad = []
    with app_url() as url:
        for scheme in ("light", "dark"):
            errs = run(url, scheme)
            print(scheme, "ok" if not errs else errs)
            bad += errs
    sys.exit(1 if bad else 0)
