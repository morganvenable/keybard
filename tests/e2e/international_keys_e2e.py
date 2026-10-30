"""
Browser tests: the JIS conversion keys can be placed from the Special Keys
panel on the simulated board, are written with QMK's keycodes, and come back
after a reload with their legends. Run with `npm run test:e2e:international`.

  1. Special Keys > International: select a key on the board, click 変換
     (Henkan), 無変換 (Muhenkan) and かな (Kana) onto three keys.
  2. The board stores QMK's values (svalboard/qmk quantum/keycodes.h):
     KC_INTERNATIONAL_4 0x008A, KC_INTERNATIONAL_5 0x008B, KC_INTERNATIONAL_2
     0x0088, at the keys that held Q, W and E on layer 0.
  3. After a reload, read from the board, the keys show those keycodes and
     their legends.

Builds the app like fake_board_e2e.py (E2E_URL and E2E_SKIP_BUILD work the
same way). Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import sys

from playwright.sync_api import Page, expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")  # the legends print on any console

failures: list[str] = []

# (the key it replaces, the picker keycode, QMK's value, the legend)
PLACE = [
    ("KC_Q", "KC_HENK", 0x008A, "変換"),
    ("KC_W", "KC_MHEN", 0x008B, "無変換"),
    ("KC_E", "KC_KANA", 0x0088, "カタカナ"),
]

KEYMAP_JS = "Array.from(window.keybardFakeBoard.device.firmware.state.keymap)"


def check(cond: bool, label: str):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        failures.append(label)


def words(page: Page) -> list[int]:
    b = page.evaluate(KEYMAP_JS)
    return [b[i] << 8 | b[i + 1] for i in range(0, len(b), 2)]


def board_key(page: Page, keycode: str):
    return page.locator(f'[aria-label="Keyboard canvas"] [data-keycap][data-keycode="{keycode}"]:visible').first


def main():
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light", reduced_motion="reduce")
        page = context.new_page()
        try:
            page.goto(f"{url}?fakeBoard&theme=light")
            wait_connected(page)
            before = words(page)
            per_layer = len(before) // 16
            page.get_by_role("button", name="Special Keys", exact=True).first.click()
            section = page.locator("[data-international-keys]:visible").first
            expect(section).to_be_visible(timeout=10000)
            check(section.locator("[data-picker-keycode]").count() == 18, "International offers 18 keys")
            henkan = section.locator('[data-picker-keycode="KC_HENK"]')
            check(henkan.get_attribute("title", timeout=5000).startswith("Henkan 変換"), "変換 is named Henkan 変換")
            for old, kc, code, legend in PLACE:
                board_key(page, old).click()
                section.locator(f'[data-picker-keycode="{kc}"]').click()
                expect(board_key(page, kc)).to_be_visible(timeout=10000)
            page.wait_for_timeout(1000)  # live updating writes each change at once
            after = words(page)
            for old, kc, code, legend in PLACE:
                old_code = {"KC_Q": 0x0014, "KC_W": 0x001A, "KC_E": 0x0008}[old]
                was = [i for i, w in enumerate(before[:per_layer]) if w == old_code]
                check(len(was) == 1, f"{old} was on one key of layer 0")
                if was:
                    check(after[was[0]] == code, f"{kc} stored as 0x{code:04X} (board has 0x{after[was[0]]:04X})")
            page.reload()
            wait_connected(page)
            for old, kc, code, legend in PLACE:
                key = board_key(page, kc)
                check(key.count() == 1, f"{kc} reads back from the board after a reload")
                if key.count():
                    check(legend in key.inner_text(), f"{kc} shows {legend} (shows {key.inner_text()!r})")
        finally:
            context.close()
            browser.close()
    if failures:
        print(f"\n{len(failures)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    main()
