"""
Browser flow of the Pointing Devices panel against the simulated Svalboards
(?fakeBoard=pointing: a PMW3389 trackball on the left half, an Azoteq touchpad
on the right, built-in gestures; two-balls; ball-trackpoint; no-module).
One size (1440 x 900) and one theme (light). Run with
`npm run test:e2e:pointing-settings`.

  1. Panel order on the trackball + touchpad board: one card per hand titled by
     its module, Pointer speed, Scroll speed and Scroll Mode in each, Gestures
     first on the touchpad hand, then Natural Scroll and Axis Lock (visible, not
     under AutoMouse), then the key groups (Mouse Buttons, Modifiers, Sniper Keys,
     Boost, Scroll, TrackPoint, DPI last; no More keys), then a closed AutoMouse. The pad lists DPI up
     to 1200 only. Settings has no Pointing or Touchpad cards.
  2. AutoMouse: closed on a first visit, holds the Auto Mouse settings then its keys, and is still open
     on the next visit once opened.
  3. Deep links: ?panel=pointing-automouse (and the old pointing-advanced) open AutoMouse for that visit only.
  4. Scroll speed writes VIA 61 as a percent and reads it back. With
     ?fakeBoard=pointing-os (Windows driving the pad) the touchpad card grays
     Pointer speed, Scroll speed and Scroll Mode with one line why, and follows
     the board live; on a Mac (?fakeBoard=pointing) they stay live.
  5. The other boards: two balls (no Gestures, no touchpad tuner), ball plus
     TrackPoint (speed list 200 to 3200, no tuner), no module (one line, no
     Natural Scroll or Axis Lock, the keys stay).
  6. The tray (?panelPosition=bottombar): hands first, then the key groups,
     AutoMouse last, scrolling sideways.

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

        def no_more_keys() -> bool:
            """The Pointing Devices panel (the section or tray holding its key groups) has no More keys disclosure."""
            return page.evaluate("""() => { const g = document.querySelector('[data-key-group]');
              const panel = g && g.closest('[data-pointing-tray], section');
              return !!panel && !/more keys/i.test(panel.textContent) && !panel.querySelector('[data-testid$=more-keys], details'); }""")

        def advanced():
            return page.locator("[data-disclosure=pointing-automouse] > h5 button")

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
        check(page.locator("[data-shared]").is_visible(), "Natural Scroll and Axis Lock are visible, not under AutoMouse")
        check(left.locator("[data-row-value]").first.inner_text() == "1.0×", "Scroll speed reads 1.0×")
        # Order down the page: cards, shared rows, the key groups (DPI last), AutoMouse.
        GROUPS = ["Mouse Buttons", "Modifiers", "Sniper Keys", "Boost", "Scroll", "TrackPoint", "DPI"]
        groups = page.locator("[data-key-group]:not([data-key-group=AutoMouse])").evaluate_all("e => e.map(g => g.dataset.keyGroup)")
        check(groups == GROUPS, f"key groups, most used first, DPI last {groups}")
        ys = page.evaluate("""() => {
          const y = s => document.querySelector(s).getBoundingClientRect().top;
          return [y('[data-hand=left]'), y('[data-hand=right]'), y('[data-shared]'), y('[data-key-group="Mouse Buttons"]'),
                  y('[data-key-group="Sniper Keys"]'), y('[data-key-group=Boost]'), y('[data-key-group=Scroll]'),
                  y('[data-key-group=TrackPoint]'), y('[data-key-group=DPI]'), y('[data-disclosure=pointing-automouse]')];
        }""")
        check(ys[0] <= ys[1] <= ys[2] < ys[3] < ys[4] < ys[5] < ys[6] < ys[7] < ys[8] < ys[9],
              f"order: cards, shared, Mouse Buttons, Sniper, Boost, Scroll, TrackPoint, DPI, AutoMouse {ys}")
        check(no_more_keys(), "the panel has no More keys disclosure")
        tiles = page.locator("[data-key-group] [data-keycap]").count()
        dpi_last = page.evaluate("""() => { const t = [...document.querySelectorAll('[data-key-group]:not([data-key-group=AutoMouse]) [data-keycap]')];
          const d = [...document.querySelectorAll('[data-key-group=DPI] [data-keycap]')];
          return d.length === 4 && t.slice(-4).every((e, i) => e === d[i]); }""")
        check(dpi_last, f"the four DPI keys are the last key tiles ({tiles} tiles)")
        faces = page.locator("[data-key-group] [data-keycap]").all_inner_texts()
        check(not any("Drag" in f or "Natural" in f or "Axis" in f for f in faces), "no Drag Scroll, Natural Scroll or Axis Lock key tile")
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

        # 2. AutoMouse.
        go("panel=pointing")
        check(not advanced_open(), "AutoMouse is closed on a first visit")
        advanced().click()
        check(advanced_open(), "AutoMouse opens")
        titles = page.locator("[data-disclosure=pointing-automouse] [data-row]").evaluate_all("e => e.map(r => r.dataset.row)")
        check(titles[0] == "Enable Auto Mouse" and "Tap to Click" not in titles, f"AutoMouse holds the Auto Mouse settings {titles}")
        am_keys = page.locator("[data-disclosure=pointing-automouse] [data-key-group=AutoMouse] [data-keycap]").count()
        check(am_keys == 2, f"AutoMouse holds AutoMouse Toggle and Layer Time ({am_keys})")
        go("panel=pointing")
        check(advanced_open(), "AutoMouse is still open on the next visit")
        advanced().click()

        # 3. Deep links.
        for name in ("pointing-automouse", "pointing-advanced"):
            go(f"panel={name}")
            check(advanced_open(), f"?panel={name} opens AutoMouse")
            go("panel=pointing")
            check(not advanced_open(), f"AutoMouse opened for that visit only ({name})")

        # 4. Scroll speed writes VIA 61 as a percent.
        slider = page.locator("[data-hand=left]").get_by_role("slider", name="Scroll speed")
        slider.focus()
        page.keyboard.press("ArrowRight")
        page.wait_for_function("window.keybardFakeBoard.device.firmware.customWrites.some(w => w.id === 61)", timeout=8000)
        pct = page.evaluate("window.keybardFakeBoard.device.firmware.scrollSpeedPct[0]")
        check(pct == 120, f"one step up writes 120 percent to VIA 61 ({pct})")
        page.wait_for_timeout(500)
        check(page.locator("[data-hand=left] [data-row-value]").first.inner_text() == "1.2×", "reads back as 1.2×")

        # 4b. The touchpad card while the computer drives the pad (0x2C bit 4).
        grayed = lambda: page.locator("[data-hand=right] [data-row][aria-disabled=true]").evaluate_all("e => e.map(r => r.dataset.row)")  # noqa: E731
        check(grayed() == [] and page.locator("[data-os-driven-note]").count() == 0, "a Mac in Automatic: the touchpad controls stay live")
        go("panel=pointing", "fakeBoard=pointing-os&theme=light")
        check(grayed() == ["Pointer speed", "Scroll speed", "Scroll Mode"], f"Windows driving: speed and Scroll Mode grayed {grayed()}")
        note = page.locator("[data-hand=right] [data-os-driven-note]")
        check(note.is_visible() and note.inner_text() == "The computer is driving this touchpad, so these settings apply only with Built-in gestures.", "Windows driving: the one line under Gestures")
        check(page.locator("[data-hand=right]").get_by_role("combobox", name="Pointer speed").is_disabled(), "Windows driving: Pointer speed takes no input")
        page.evaluate("window.keybardFakeBoard.device.firmware.hostTouchpad = false")
        page.wait_for_function("!document.querySelector('[data-os-driven-note]')", timeout=8000)
        check(grayed() == [], "live: the controls come back when the computer lets go of the pad")
        page.evaluate("window.keybardFakeBoard.device.firmware.hostTouchpad = true")
        page.wait_for_function("!!document.querySelector('[data-os-driven-note]')", timeout=8000)
        check(grayed() == ["Pointer speed", "Scroll speed", "Scroll Mode"], "live: grayed again when the computer drives the pad")

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
        check(cols[:3] == ["hand-left", "hand-right", "shared"] and cols[-1] == "automouse", f"tray columns {cols}")
        xs = page.evaluate("""() => ['[data-tray-column=hand-left]', '[data-key-group=Scroll]', '[data-tray-column=automouse]']
            .map(s => document.querySelector(s).getBoundingClientRect().left)""")
        check(xs[0] < xs[1] < xs[2], f"tray: hands, then keys, then AutoMouse, left to right {xs}")
        tray_groups = page.locator("[data-pointing-tray] [data-key-group]").evaluate_all("e => e.map(g => g.dataset.keyGroup)")
        check(tray_groups == GROUPS, f"tray key groups, DPI last {tray_groups}")
        check(no_more_keys(), "the tray has no More keys disclosure")

        check(not errors, f"no page errors: {errors}")
        context.close()
        browser.close()

    print(f"{len(failures)} failed" if failures else "all passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
