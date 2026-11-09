"""
Browser flow of the Pointing Devices panel against the simulated Svalboards
(?fakeBoard=pointing: a PMW3389 trackball on the left half, an Azoteq touchpad
on the right, built-in gestures; two-balls; ball-trackpoint; no-module).
One size (1440 x 900) and one theme (light). Run with
`npm run test:e2e:pointing-settings`.

  1. Panel order on the trackball + touchpad board: one card per hand titled by
     its module, Pointer speed, Scroll speed and Scroll Mode in each, Gestures
     first on the touchpad hand, then Natural Scroll and Axis Lock (visible, not
     under Advanced), then the keys, then a closed Advanced. The pad lists DPI up
     to 1200 only. Settings has no Pointing or Touchpad cards.
  2. Advanced: closed on a first visit, holds Auto Mouse only, and is still open
     on the next visit once opened.
  3. Deep links: ?panel=pointing-advanced opens Advanced for that visit only.
  4. Scroll speed writes VIA 61 as a percent and reads it back.
  5. The other boards: two balls (no Gestures, no touchpad tuner), ball plus
     TrackPoint (speed list 200 to 3200, no tuner), no module (one line, no
     Natural Scroll or Axis Lock, the keys stay).
  6. The tray (?panelPosition=bottombar): hands first, then the key groups,
     Advanced last, scrolling sideways.

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Needs Python
Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

BOARD = "fakeBoard=pointing&theme=light"


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

        def go(query: str, board: str = BOARD):
            page.goto(f"{url}?{board}&{query}")
            wait_connected(page)
            if "panel=settings" not in query:
                expect(page.locator("[data-pointing-top], [data-pointing-tray]").first).to_be_visible(timeout=20000)
            page.wait_for_timeout(500)

        def advanced():
            return page.locator("[data-disclosure=pointing-advanced] > h5 button")

        def advanced_open() -> bool:
            return advanced().get_attribute("aria-expanded") == "true"

        rows = lambda hand: hand.evaluate("e => [...e.querySelectorAll('[data-row]')].map(r => r.dataset.row)")  # noqa: E731

        # 1. Panel order.
        go("panel=pointing")
        left, right = page.locator("[data-hand=left]"), page.locator("[data-hand=right]")
        check("Trackball, PMW3389" in left.locator("h5").inner_text(), "left hand titled by its PMW3389 trackball")
        check("Touchpad, Azoteq" in right.locator("h5").inner_text(), "right hand titled by its Azoteq touchpad")
        check(rows(left) == ["Pointer speed", "Scroll speed", "Scroll Mode"], f"left simple view {rows(left)}")
        check(rows(right) == ["Gestures", "Pointer speed", "Scroll speed", "Scroll Mode"], f"right simple view, Gestures first {rows(right)}")
        check(left.locator("[data-tuner=trackball]").inner_text() == "Trackball sensors", "left card ends in Trackball sensors")
        check(right.locator("[data-tuner=touchpad]").inner_text() == "Tune touchpad", "right card ends in Tune touchpad")
        shared = page.locator("[data-shared] [data-row]").evaluate_all("e => e.map(r => r.dataset.row)")
        check(shared == ["Natural Scroll", "Axis Lock"], f"Natural Scroll and Axis Lock shared once {shared}")
        check(page.locator("[data-shared]").is_visible(), "Natural Scroll and Axis Lock are visible, not under Advanced")
        check(left.locator("[data-row-value]").first.inner_text() == "1.0×", "Scroll speed reads 1.0×")
        # Order down the page: cards, shared rows, keys, Advanced.
        ys = page.evaluate("""() => {
          const y = s => document.querySelector(s).getBoundingClientRect().top;
          return [y('[data-hand=left]'), y('[data-hand=right]'), y('[data-shared]'), y('[data-key-group=Scroll]'),
                  y('[data-key-group="Pointer Speed"]'), y('[data-key-group=Pointer]'), y('[data-disclosure=pointing-advanced]')];
        }""")
        check(ys[0] <= ys[1] <= ys[2] < ys[3] < ys[4] < ys[5] < ys[6], f"order: cards, shared, Scroll, Pointer Speed, Pointer, Advanced {ys}")
        right.get_by_role("combobox", name="Pointer speed").click()
        options = page.get_by_role("option").all_inner_texts()
        check(options == ["200", "400", "600", "800", "1200"], f"the pad lists DPI up to 1200 only {options}")
        page.keyboard.press("Escape")
        check(not page.evaluate("document.documentElement.scrollWidth > innerWidth"), "no sideways scroll")

        # Settings has no Pointing or Touchpad cards, and Hardware has the tuners and the link.
        go("panel=settings")
        expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
        titles = page.locator("[data-settings-section] > h4").all_inner_texts()
        check("Pointing" not in titles and "Touchpad tuning" not in titles, f"Settings has no Pointing or Touchpad cards {titles}")
        check(page.locator("[data-pointing-instance] [data-tuner]").count() == 2, "Hardware rows carry the tuner buttons")
        check(page.locator("[data-pointing-devices-link]").is_visible(), "Hardware links to Pointing Devices")

        # 2. Advanced.
        go("panel=pointing")
        check(not advanced_open(), "Advanced is closed on a first visit")
        advanced().click()
        check(advanced_open(), "Advanced opens")
        titles = page.locator("[data-disclosure=pointing-advanced] [data-row]").evaluate_all("e => e.map(r => r.dataset.row)")
        check(titles[0] == "Enable Auto Mouse" and "Tap to Click" not in titles, f"Advanced holds Auto Mouse only {titles}")
        go("panel=pointing")
        check(advanced_open(), "Advanced is still open on the next visit")
        advanced().click()

        # 3. Deep link.
        go("panel=pointing-advanced")
        check(advanced_open(), "?panel=pointing-advanced opens Advanced")
        go("panel=pointing")
        check(not advanced_open(), "Advanced opened for that visit only")

        # 4. Scroll speed writes VIA 61 as a percent.
        slider = page.locator("[data-hand=left]").get_by_role("slider", name="Scroll speed")
        slider.focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_function("window.keybardFakeBoard.device.firmware.customWrites.some(w => w.id === 61)", timeout=8000)
        pct = page.evaluate("window.keybardFakeBoard.device.firmware.scrollSpeedPct[0]")
        check(pct == 120, f"one step up writes 120 percent to VIA 61 ({pct})")
        page.wait_for_timeout(500)
        check(page.locator("[data-hand=left] [data-row-value]").first.inner_text() == "1.2×", "reads back as 1.2×")

        # 5. The other boards.
        go("panel=pointing", "fakeBoard=two-balls&theme=light")
        check(page.locator("[data-hand]").count() == 2 and page.locator("[data-hand] [data-row=Gestures]").count() == 0, "two balls: two cards, no Gestures")
        tuners = page.locator("[data-tuner]").evaluate_all("e => e.map(b => b.textContent)")
        check(tuners == ["Trackball sensors", "Trackball sensors"], f"two balls: no touchpad tuner {tuners}")
        go("panel=pointing", "fakeBoard=ball-trackpoint&theme=light")
        tp = page.locator("[data-hand=right]")
        check("TrackPoint" in tp.locator("h5").inner_text() and tp.locator("[data-tuner]").count() == 0, "ball plus TrackPoint: TrackPoint card, no tuner")
        tp.get_by_role("combobox", name="Pointer speed").click()
        options = page.get_by_role("option").all_inner_texts()
        check(options == ["200", "400", "600", "800", "1200", "1600", "2400", "3200"], f"the TrackPoint lists 200 to 3200 {options}")
        page.keyboard.press("Escape")
        go("panel=pointing", "fakeBoard=no-module&theme=light")
        check(page.locator("[data-no-module]").inner_text() == "No pointing module detected", "no module: the one line")
        check(page.locator("[data-hand]").count() == 0 and page.locator("[data-shared]").count() == 0, "no module: no cards, no Natural Scroll or Axis Lock")
        check(page.get_by_text("Mouse Buttons").first.is_visible() and page.locator("[data-key-group=Scroll]").is_visible(), "no module: the keys stay")

        # 6. The tray.
        go("panel=pointing&panelPosition=bottombar")
        cols = page.locator("[data-pointing-tray] > [data-tray-column]").evaluate_all("e => e.map(c => c.dataset.trayColumn)")
        check(cols[:3] == ["hand-left", "hand-right", "shared"] and cols[-1] == "advanced", f"tray columns {cols}")
        xs = page.evaluate("""() => ['[data-tray-column=hand-left]', '[data-key-group=Scroll]', '[data-tray-column=advanced]']
            .map(s => document.querySelector(s).getBoundingClientRect().left)""")
        check(xs[0] < xs[1] < xs[2], f"tray: hands, then keys, then Advanced, left to right {xs}")

        check(not errors, f"no page errors: {errors}")
        context.close()
        browser.close()

    print(f"{len(failures)} failed" if failures else "all passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
