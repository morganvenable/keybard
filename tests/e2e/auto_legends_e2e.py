"""
Browser test of Settings > Appearance and editing > Key legends: Automatic, headless.
Run with `npm run test:e2e:auto-legends`.

The browser's keyboard map (navigator.keyboard.getLayoutMap) is stubbed, and the stub's layout can
be switched while the page is open, as a person switching their computer's layout would:
  1. Upgrade: someone still on the old default, English (US), lands on Automatic; someone who chose
     German keeps German.
  2. Automatic follows the computer: German, then French after a switch (read when the window comes
     back into focus), and Settings says which in a plain sentence.
  3. A layout Keybard has no legends for, and a browser with no keyboard map: keys show English (US),
     and Settings says so.
  4. Choosing a layout by hand sticks across a reload; choosing Automatic again follows the computer.

Builds the app like combo_editor_e2e.py (E2E_URL and E2E_SKIP_BUILD work the same way). Exits 1 when a check fails.
"""
import json
import os
import sys

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_editor_e2e import app_url  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

SETTINGS = "?demo=combos&panel=settings"
US = {"Backquote": "`", "Digit1": "1", "Digit2": "2", "Digit3": "3", "Digit4": "4", "Digit5": "5", "Digit6": "6", "Digit7": "7",
      "Digit8": "8", "Digit9": "9", "Digit0": "0", "Minus": "-", "Equal": "=", "KeyQ": "q", "KeyW": "w", "KeyE": "e", "KeyR": "r",
      "KeyT": "t", "KeyY": "y", "KeyU": "u", "KeyI": "i", "KeyO": "o", "KeyP": "p", "BracketLeft": "[", "BracketRight": "]",
      "Backslash": "\\", "KeyA": "a", "KeyS": "s", "KeyD": "d", "KeyF": "f", "KeyG": "g", "KeyH": "h", "KeyJ": "j", "KeyK": "k",
      "KeyL": "l", "Semicolon": ";", "Quote": "'", "IntlBackslash": "\\", "KeyZ": "z", "KeyX": "x", "KeyC": "c", "KeyV": "v",
      "KeyB": "b", "KeyN": "n", "KeyM": "m", "Comma": ",", "Period": ".", "Slash": "/"}
# As Chrome reports them on Windows: dead keys (^ and ´ on German) come back as their spacing characters.
MAPS = {
    "us": US,
    "german": {**US, "Backquote": "^", "Minus": "ß", "Equal": "´", "KeyY": "z", "KeyZ": "y", "BracketLeft": "ü", "BracketRight": "+",
               "Semicolon": "ö", "Quote": "ä", "Backslash": "#", "IntlBackslash": "<", "Slash": "-"},
    "french": {**US, "Backquote": "²", "Digit1": "&", "Digit2": "é", "Digit3": "\"", "Digit4": "'", "Digit5": "(", "Digit6": "-",
               "Digit7": "è", "Digit8": "_", "Digit9": "ç", "Digit0": "à", "Minus": ")", "KeyQ": "a", "KeyW": "z", "BracketLeft": "^",
               "BracketRight": "$", "KeyA": "q", "Semicolon": "m", "Quote": "ù", "Backslash": "*", "IntlBackslash": "<", "KeyZ": "w",
               "KeyM": ",", "Comma": ";", "Period": ":", "Slash": "!"},
    "dvorak": {**US, "KeyQ": "'", "KeyW": ",", "KeyE": ".", "KeyR": "p", "KeyT": "y", "KeyY": "f", "KeyU": "g", "KeyI": "c",
               "KeyO": "r", "KeyP": "l", "KeyS": "o", "KeyD": "e", "KeyF": "u", "KeyG": "i", "KeyH": "d", "KeyJ": "h", "KeyK": "t",
               "KeyL": "n", "Semicolon": "s", "KeyZ": ";", "KeyX": "q", "KeyC": "j", "KeyV": "k", "KeyB": "x", "KeyN": "b"},
}


def stub(layout: str | None) -> str:
    """An init script: navigator.keyboard.getLayoutMap answers with window.__layout's map (None: no keyboard map)."""
    if layout is None:
        return "try { Object.defineProperty(Navigator.prototype, 'keyboard', { get: () => undefined, configurable: true }); } catch {}"
    return (f"window.__maps = {json.dumps(MAPS)}; window.__layout = {json.dumps(layout)};"
            "Object.defineProperty(Navigator.prototype, 'keyboard', { configurable: true, get: () => ({"
            " getLayoutMap: async () => new Map(Object.entries(window.__maps[window.__layout])),"
            " addEventListener() {}, removeEventListener() {} }) });")


def main() -> int:
    failures = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()

        def open_settings(stored: dict | None, layout: str | None):
            context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
            context.add_init_script(stub(layout))
            if stored is not None:
                context.add_init_script(
                    "if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');"
                    f" localStorage.setItem('keyboard-settings', {json.dumps(json.dumps(stored))}); }}")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(url + SETTINGS)
            expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
            toggle = page.locator("#settings-section-appearance-title button")
            if toggle.get_attribute("aria-expanded") != "true":
                toggle.click()
            return context, page, errors

        def select(page):
            return page.get_by_role("combobox", name="Key legends")

        def described(page, text: str) -> bool:
            try:
                expect(select(page)).to_have_attribute("aria-description", text, timeout=5000)
                return True
            except AssertionError:
                return False

        def stored(page) -> str | None:
            return page.evaluate("() => JSON.parse(localStorage.getItem('keyboard-settings') || '{}')['international-keyboards'] ?? null")

        # 1, 2. Old default US becomes Automatic; Automatic follows German, then French.
        context, page, errors = open_settings({"__v": 2, "international-keyboards": "us"}, "german")
        check(select(page).input_value() == "auto", "old default US lands on Automatic")
        check(stored(page) == "auto", f"and Automatic is stored ({stored(page)})")
        options = select(page).locator("option").all_inner_texts()
        check(options[0] == "Automatic" and "Japanese" not in options and "German" in options,
              f"Automatic first; only layouts with their own map: {options}")
        check(described(page, "Your computer is using German, so keys show German."), "follows German")
        page.evaluate("window.__layout = 'french'")
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        check(described(page, "Your computer is using French, so keys show French."), "follows a switch to French")

        # 3. A layout Keybard has no legends for.
        page.evaluate("window.__layout = 'dvorak'")
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        check(described(page, "Keybard has no key legends for your computer's keyboard layout yet, so keys show English (US)."),
              "an unknown layout shows US and says so")

        # 4. A layout chosen by hand sticks; Automatic again follows.
        page.evaluate("window.__layout = 'german'")
        select(page).select_option("uk")
        check(described(page, "The keyboard layout your computer uses, so keys show what they type."), "a chosen layout has the usual help")
        page.reload()
        expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
        toggle = page.locator("#settings-section-appearance-title button")
        if toggle.get_attribute("aria-expanded") != "true":
            toggle.click()
        check(select(page).input_value() == "uk" and stored(page) == "uk", "English (UK) chosen by hand survives a reload")
        select(page).select_option("auto")
        check(described(page, "Your computer is using German, so keys show German."), "Automatic again follows the computer")
        check(not errors, f"no page errors {errors}")
        context.close()

        # 1. A chosen German is kept by the upgrade.
        context, page, errors = open_settings({"__v": 2, "international-keyboards": "german"}, "french")
        check(select(page).input_value() == "german" and stored(page) == "german", "a chosen German stays German")
        context.close()

        # 3. No keyboard map in this browser.
        context, page, errors = open_settings(None, None)
        check(select(page).input_value() == "auto", "a first visit starts on Automatic")
        check(described(page, "Keybard can't tell which keyboard layout your computer uses, so keys show English (US). "
                              "Choose your layout to change that."), "without a keyboard map: US, said plainly")
        context.close()
        browser.close()

    print(f"\n{len(failures)} failure(s)" if failures else "\nall checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
