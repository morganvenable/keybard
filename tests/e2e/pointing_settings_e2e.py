"""
Browser flow of Settings > Pointing against the simulated Svalboard
(?fakeBoard=pointing: a PMW3389 trackball on the left half, an Azoteq
touchpad on the right, built-in gestures). One size (1440 x 900) and one
theme (light). Run with `npm run test:e2e:pointing-settings`.

  1. Open: ?panel=pointing-settings lands on Settings with the Pointing card
     open, one card per hand titled by its module, Pointer speed, Scroll
     speed and Scroll Mode in each, Gestures first on the touchpad hand,
     Natural Scroll and Axis Lock once. The pad lists DPI up to 1200 only.
  2. Collapse: the Pointing card collapses, and is still collapsed on the next visit.
  3. Advanced: closed on a first visit; opened, its four groups show; a group
     collapsed is still collapsed on the next visit, and so is Advanced open.
  4. Deep links: ?panel=pointing-advanced opens Advanced for that visit only;
     ?panel=settings&tune=touchpad opens the live view.
  5. Scroll speed writes VIA 61 as a percent and reads it back.
  6. The rail: Pointing Devices holds keys only, with a link that lands on
     Settings > Pointing.

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Needs Python
Playwright with Chromium. Exits 1 when a check fails.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

BOARD = "fakeBoard=pointing&theme=light"
CARD = "#settings-section-pointing"


def main() -> int:
    failures: list[str] = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def go(query: str):
            page.goto(f"{url}?{BOARD}&{query}")
            wait_connected(page)
            expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
            page.wait_for_timeout(400)

        def card_open() -> bool:
            return page.locator(f"{CARD}-title button").get_attribute("aria-expanded") == "true"

        def advanced():
            return page.locator("[data-disclosure=pointing-advanced] > h5 button")

        def advanced_open() -> bool:
            return advanced().get_attribute("aria-expanded") == "true"

        def group(id: str):
            return page.locator(f"[data-disclosure={id}] > h6 button")

        # 1. Open.
        go("panel=pointing-settings")
        check(page.locator(f"{CARD}-title").is_visible() and card_open(), "?panel=pointing-settings opens the Pointing card")
        left, right = page.locator("[data-hand=left]"), page.locator("[data-hand=right]")
        check("Trackball, PMW3389" in left.locator("h5").inner_text(), "left hand titled by its PMW3389 trackball")
        check("Touchpad, Azoteq" in right.locator("h5").inner_text(), "right hand titled by its Azoteq touchpad")
        rows = lambda hand: hand.evaluate("e => [...e.querySelectorAll('[data-row]')].map(r => r.dataset.row)")  # noqa: E731
        check(rows(left) == ["Pointer speed", "Scroll speed", "Scroll Mode"], f"left simple view {rows(left)}")
        check(rows(right) == ["Gestures", "Pointer speed", "Scroll speed", "Scroll Mode"], f"right simple view, Gestures first {rows(right)}")
        check(page.locator("[data-shared] [data-row]").evaluate_all("e => e.map(r => r.dataset.row)") == ["Natural Scroll", "Axis Lock"],
              "Natural Scroll and Axis Lock shared once")
        check(left.locator("[data-row-value]").first.inner_text() == "1.0×", "Scroll speed reads 1.0×")
        right.get_by_role("combobox", name="Pointer speed").click()
        options = page.get_by_role("option").all_inner_texts()
        check(options == ["200", "400", "600", "800", "1200"], f"the pad lists DPI up to 1200 only {options}")
        page.keyboard.press("Escape")
        wide = page.evaluate("document.documentElement.scrollWidth > innerWidth")
        check(not wide, "no sideways scroll")

        # 2. Collapse, remembered.
        page.locator(f"{CARD}-title button").click()
        check(not card_open(), "the Pointing card collapses")
        go("panel=settings")
        check(not card_open(), "still collapsed on the next visit")
        page.locator(f"{CARD}-title button").click()
        check(card_open(), "opens again")

        # 3. Advanced and its groups.
        check(not advanced_open(), "Advanced is closed on a first visit")
        advanced().click()
        check(advanced_open(), "Advanced opens")
        titles = page.locator("[data-disclosure=pointing-advanced] h6").all_inner_texts()
        check(titles == ["Auto mouse layer", "Touchpad taps and drag", "Touchpad scrolling", "Live view"], f"Advanced groups {titles}")
        group("pointing-taps").click()
        check(group("pointing-taps").get_attribute("aria-expanded") == "false", "a group collapses")
        go("panel=settings")
        check(advanced_open(), "Advanced is still open on the next visit")
        check(group("pointing-taps").get_attribute("aria-expanded") == "false", "the group is still collapsed on the next visit")
        check(group("pointing-live").get_attribute("aria-expanded") == "true", "the other groups stay open")
        group("pointing-taps").click()
        advanced().click()

        # 4. Deep links.
        go("panel=pointing-advanced")
        check(card_open() and advanced_open(), "?panel=pointing-advanced opens Advanced")
        page.goto(f"{url}?{BOARD}&panel=pointing-settings")
        wait_connected(page)
        page.wait_for_timeout(600)
        check(not advanced_open(), "Advanced opened for that visit only")
        go("panel=settings&tune=touchpad")
        expect(page.locator("[data-touchpad-tuning-dialog]")).to_be_visible(timeout=10000)
        check(True, "?panel=settings&tune=touchpad opens the live view")
        page.keyboard.press("Escape")

        # 5. Scroll speed writes VIA 61 as a percent.
        go("panel=pointing-settings")
        slider = page.locator("[data-hand=left]").get_by_role("slider", name="Scroll speed")
        slider.focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_function("window.keybardFakeBoard.device.firmware.customWrites.some(w => w.id === 61)", timeout=8000)
        pct = page.evaluate("window.keybardFakeBoard.device.firmware.scrollSpeedPct[0]")
        check(pct == 120, f"one step up writes 120 percent to VIA 61 ({pct})")
        page.wait_for_timeout(500)
        check(page.locator("[data-hand=left] [data-row-value]").first.inner_text() == "1.2×", "reads back as 1.2×")

        # 6. The rail.
        page.goto(f"{url}?{BOARD}&panel=pointing")
        wait_connected(page)
        page.wait_for_timeout(500)
        check(page.locator("[data-pointing-settings-link]").first.is_visible(), "Pointing Devices links to Settings > Pointing")
        check(page.get_by_role("combobox", name="DPI").count() == 0 and page.get_by_text("Scroll Mode").count() == 0,
              "no firmware menu on the rail")
        check(page.get_by_text("Mouse Buttons").first.is_visible(), "the rail keeps its keys")
        page.locator("[data-pointing-settings-link]").first.click()
        page.wait_for_timeout(800)
        check(page.locator(f"{CARD}-title").is_visible() and card_open(), "the link lands on Settings > Pointing")
        check(not errors, f"no page errors: {errors}")
        context.close()
        browser.close()

    print(f"{len(failures)} failed" if failures else "all passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
