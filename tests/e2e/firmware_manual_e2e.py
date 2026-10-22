"""
Browser test of firmware updates from Settings > Firmware as a person runs them: the
built app (test-site build, so ?fwfake=1 backs Firmware with the mock board), the
QWERTY Example, no keyboard. Run with `npm run test:e2e:firmware`.

  1. Update from Keybard: Start (one sentence, the layout choice, Update), then
     "Confirm on your keyboard" only while the board waits for the two keys, then
     Updating with one bar, then Done ("x3.2 is installed. Your layout is back.").
  2. A warning (an older release): a sentence with what to do, and Update anyway.
  3. A refusal (a file that misses its pin): the sentence, Reload and Close, no Update.
  4. Install by hand, both halves updated: Connect reads both halves, puts the
     layout back and says it's done. No Next buttons and no check marks before.
  5. Install by hand, one half still old: only that half's file and steps, then
     Connect again finishes.
  6. One line, at phone width (430 px) and desktop, light and dark: no sideways
     scroll; titles, choices and buttons each on one line; one title per dialog,
     and it names the dialog.

FW_SHOTS=<folder> also saves a phone-width (light) screenshot of every state there.
Same server options as combo_editor_e2e.py (E2E_URL, E2E_SKIP_BUILD). E2E_URL must
be a test-site build (VITE_STORAGE_NAMESPACE=keybard-test), e.g.
https://morganvenable.github.io/keybard-test/. Exits 1 when a check fails.
"""
import os
import re
import sys

# The mock board ships only in development and test-site builds.
os.environ.setdefault("VITE_STORAGE_NAMESPACE", "keybard-test")

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_editor_e2e import app_url  # noqa: E402

BASE = "?demo&fwfake=1&panel=firmware"
PROTO4 = f"{BASE}&speed=4"
PROTO3 = f"{BASE}&proto=3&running=x3.1.3&speed=20"
SHOTS = os.environ.get("FW_SHOTS")
PHONE = {"width": 430, "height": 932}
DESKTOP = {"width": 1440, "height": 900}
WORDS = re.compile(r"\b(hold|approv\w*|chord\w*|TRRS|Viable|Keybard Host|keybard-ng)\b", re.I)


def open_firmware(browser, url: str, query: str, theme: str = "light", viewport=None):
    context = browser.new_context(viewport=viewport or DESKTOP, color_scheme=theme, reduced_motion="reduce")
    page = context.new_page()
    errors, dialogs = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # A native confirm or alert would freeze the page mid-install on a real keyboard.
    page.on("dialog", lambda d: (dialogs.append(f"{d.type}: {d.message}"), d.dismiss()))
    page.goto(f"{url}{query}&theme={theme}")
    expect(page.get_by_test_id("firmware-section")).to_be_visible(timeout=30000)
    return context, page, errors, dialogs


ONE_LINE_JS = """(sel) => {
    const rows = [...document.querySelectorAll(sel)].filter((el) => el.offsetParent).map((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        return { text: el.textContent.trim().slice(0, 60), lines: Math.round((el.getBoundingClientRect().height - pad) / lh) };
    });
    return { count: rows.length, wrapped: rows.filter((r) => r.lines > 1) };
}"""

WIDE_JS = """() => {
    const d = document.querySelector('[role=dialog]');
    return { page: document.documentElement.scrollWidth > innerWidth, dialog: !!d && d.scrollWidth > d.clientWidth + 1 };
}"""

TITLES_JS = """() => {
    const d = document.querySelector('[role=dialog]');
    if (!d) return null;
    const heads = [...d.querySelectorAll('h1,h2,h3,[role=heading]')].filter((h) => h.offsetParent);
    const by = d.getAttribute('aria-labelledby');
    const label = by ? document.getElementById(by)?.textContent.trim() : d.getAttribute('aria-label');
    const hidden = [...d.querySelectorAll('.sr-only')].map((e) => e.textContent.trim()).filter((t) => t && t !== 'Close');
    return { heads: heads.map((h) => h.textContent.trim()), label, hidden };
}"""


def main() -> int:
    failures = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    def shot(page, name: str):
        if not SHOTS or page.viewport_size["width"] != PHONE["width"]:
            return
        os.makedirs(SHOTS, exist_ok=True)
        target = page.locator("[role=dialog]") if page.locator("[role=dialog]").count() else page.get_by_test_id("firmware-section")
        target.first.screenshot(path=os.path.join(SHOTS, f"{name}.png"), animations="disabled")

    def layout(page, label: str):
        wide = page.evaluate(WIDE_JS)
        check(not any(wide.values()), f"{label}: no sideways scroll {wide}")
        rows = page.evaluate(ONE_LINE_JS, "[role=dialog] [data-testid=layout-choice] label, [role=dialog] h2, [role=dialog] button, [data-testid=firmware-section] button, [data-testid=firmware-halves] dd")
        check(rows["count"] > 0 and not rows["wrapped"], f"{label}: each of {rows['count']} titles, choices and buttons on one line {rows['wrapped']}")
        t = page.evaluate(TITLES_JS)
        if t:
            check(len(t["heads"]) == 1 and t["label"] == t["heads"][0] and not t["hidden"], f"{label}: one title, and it names the dialog {t}")
            text = page.locator("[role=dialog]").first.inner_text()
            check(not WORDS.search(text.replace("hold them for a second", "")), f"{label}: plain words only")

    def update_flow(page, label: str, shots: bool):
        section = page.get_by_test_id("firmware-section")
        expect(section.get_by_text("x3.2 is available")).to_be_visible(timeout=15000)
        check(section.get_by_role("link", name="What's new in x3.2 ↗").count() == 1, f"{label}: What's new links the release notes")
        check(section.get_by_text("· plugged in").count() == 1, f"{label}: the plugged-in half is named")
        layout(page, f"{label} card")
        if shots:
            shot(page, "01-card")
            section.get_by_role("button", name="Other versions and files").click()
            shot(page, "02-card-other-versions")
            section.get_by_role("button", name="Other versions and files").click()
        section.get_by_role("button", name="Update to x3.2").click()
        sheet = page.get_by_test_id("update-sheet")
        expect(sheet.get_by_text("Saved to Downloads as")).to_be_visible(timeout=20000)
        check(sheet.get_by_text("Keybard updates both halves through the cable to your computer. It takes about 2 minutes.").count() == 1, f"{label}: one sentence")
        check(sheet.get_by_role("radio", name="Put my layout back").is_checked(), f"{label}: Put my layout back chosen")
        check(page.get_by_test_id("update-confirm").count() == 0, f"{label}: no confirm screen before Update")
        check(sheet.locator("[data-problem]").count() == 0, f"{label}: no checks shown when they all pass")
        layout(page, f"{label} start")
        if shots:
            shot(page, "03-update-start")
        sheet.get_by_role("button", name="Update", exact=True).click()
        confirm = page.get_by_test_id("update-confirm")
        expect(confirm).to_be_visible(timeout=20000)
        check("press M and , together and hold them for a second" in confirm.inner_text(), f"{label}: says what to press and how")
        check("On the right half" in confirm.inner_text(), f"{label}: says which half")
        check(confirm.get_by_text("Firmware only changes when someone at the keyboard says so.").count() == 1, f"{label}: says why")
        if shots:
            shot(page, "04-update-confirm")
        layout(page, f"{label} confirm")
        progress = page.get_by_test_id("update-progress")
        expect(progress).to_be_visible(timeout=20000)
        check(confirm.count() == 0, f"{label}: the confirm screen goes once the keys are pressed")
        check(progress.get_by_role("progressbar").count() == 1, f"{label}: one progress bar")
        layout(page, f"{label} updating")
        if shots:
            page.wait_for_timeout(1500)
            shot(page, "05-update-updating")
        result = page.get_by_test_id("update-result")
        saw_confirm_again = False
        for _ in range(240):
            if result.count():
                break
            saw_confirm_again = saw_confirm_again or confirm.count() > 0
            page.wait_for_timeout(500)
        expect(result).to_be_visible(timeout=5000)
        check(not saw_confirm_again, f"{label}: asked for the keys once")
        check(result.get_by_role("heading", name="x3.2 is installed").count() == 1, f"{label}: x3.2 is installed")
        check(result.get_by_text("Your layout is back on the keyboard.").count() == 1, f"{label}: layout is back")
        layout(page, f"{label} done")
        if shots:
            shot(page, "06-update-done")

    def manual_open(page, label: str):
        section = page.get_by_test_id("firmware-section")
        expect(section.get_by_text("x3.1.3")).to_be_visible(timeout=15000)
        check(section.get_by_text("vNext1").count() == 0, f"{label}: no vNext1 label")
        section.get_by_role("button", name="Update to x3.2").click()
        dialog = page.get_by_test_id("manual-install")
        expect(dialog.get_by_text("Kip-x3.1.3-2026-10-15.svil")).to_be_visible(timeout=15000)
        return dialog

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()

        # 1. Update from Keybard, phone and desktop, light and dark.
        for vp_name, vp in [("phone", PHONE), ("desktop", DESKTOP)]:
            for theme in ["light", "dark"]:
                label = f"{vp_name} {theme} update"
                context, page, errors, dialogs = open_firmware(browser, url, PROTO4, theme, vp)
                update_flow(page, label, shots=vp is PHONE and theme == "light")
                check(not dialogs, f"{label}: no native dialogs {dialogs}")
                check(not errors, f"{label}: no page errors {errors}")
                context.close()

        # 2. A warning: an older release. A sentence and what to do; Update anyway.
        for vp_name, vp in [("phone", PHONE), ("desktop", DESKTOP)]:
            context, page, errors, dialogs = open_firmware(browser, url, f"{BASE}&running=x3.2&speed=20", "light", vp)
            section = page.get_by_test_id("firmware-section")
            expect(section.get_by_text("Your keyboard has the newest firmware.")).to_be_visible(timeout=15000)
            section.get_by_role("button", name="Other versions and files").click()
            section.get_by_role("button", name="Install v3").click()
            sheet = page.get_by_test_id("update-sheet")
            expect(sheet.get_by_text("v3 is older than x3.2.")).to_be_visible(timeout=20000)
            check(sheet.get_by_text("Settings added since v3 won't come back.").count() == 1, f"{vp_name} warning: says what it means")
            expect(sheet.get_by_role("button", name="Update anyway")).to_be_enabled(timeout=20000)
            layout(page, f"{vp_name} warning")
            shot(page, "07-update-warning")
            sheet.get_by_role("button", name="Update anyway").click()
            expect(page.get_by_test_id("update-result")).to_be_visible(timeout=60000)
            check(page.get_by_role("heading", name="v3 is installed").count() == 1, f"{vp_name} warning: v3 installed")
            check(not errors, f"{vp_name} warning: no page errors {errors}")
            context.close()

        # 3. A refusal: the carried files miss their pins. Reload and Close, no Update.
        for vp_name, vp in [("phone", PHONE), ("desktop", DESKTOP)]:
            context, page, errors, dialogs = open_firmware(browser, url, f"{BASE}&badfile=1&speed=20", "light", vp)
            page.get_by_test_id("firmware-section").get_by_role("button", name="Update to x3.2").click()
            sheet = page.get_by_test_id("update-sheet")
            expect(sheet.get_by_text("The firmware file failed its check.")).to_be_visible(timeout=20000)
            check(sheet.get_by_role("button", name="Reload").count() == 1 and sheet.get_by_role("button", name="Close").count() == 1, f"{vp_name} refusal: Reload and Close")
            check(sheet.get_by_role("button", name=re.compile(r"^Update")).count() == 0, f"{vp_name} refusal: no Update")
            check(sheet.get_by_role("radio").count() == 0, f"{vp_name} refusal: no layout choice")
            layout(page, f"{vp_name} refusal")
            shot(page, "08-update-refused")
            context.close()

        # 4. Install by hand, both halves updated: Connect, the layout back, Done.
        for vp_name, vp in [("phone", PHONE), ("desktop", DESKTOP)]:
            for theme in ["light", "dark"]:
                label = f"{vp_name} {theme} by hand"
                context, page, errors, dialogs = open_firmware(browser, url, PROTO3, theme, vp)
                dialog = manual_open(page, label)
                check(dialog.get_by_role("button", name="Next").count() == 0, f"{label}: no Next buttons")
                check(dialog.locator("svg").count() == 0, f"{label}: no check marks")
                check(dialog.get_by_role("radio", name="Put my layout back").is_checked(), f"{label}: Put my layout back chosen")
                check(dialog.get_by_role("radio", name="Start from a blank keyboard").count() == 0, f"{label}: no blank keyboard")
                check("about a quarter of a second apart" in dialog.inner_text(), f"{label}: the reset timing")
                check(dialog.locator("[data-file]").count() == 2, f"{label}: both files")
                layout(page, f"{label} instructions")
                if vp is PHONE and theme == "light":
                    shot(page, "09-by-hand-instructions")
                dialog.get_by_role("button", name="Connect keyboard").click()
                expect(dialog.get_by_role("heading", name="x3.2 is installed")).to_be_visible(timeout=20000)
                check(dialog.get_by_text("Your layout is back on the keyboard. From now on, updates install from Keybard.").count() == 1, f"{label}: layout back")
                layout(page, f"{label} done")
                if vp is PHONE and theme == "light":
                    shot(page, "12-by-hand-done")
                dialog.get_by_role("button", name="Done").click()
                expect(dialog).to_be_hidden()
                expect(page.get_by_test_id("firmware-halves")).to_contain_text("x3.2")
                check(not dialogs, f"{label}: no native dialogs {dialogs}")
                check(not errors, f"{label}: no page errors {errors}")
                context.close()

        # 5. Install by hand, one half still old: only that half; Connect again finishes.
        for vp_name, vp in [("phone", PHONE), ("desktop", DESKTOP)]:
            label = f"{vp_name} one half"
            context, page, errors, dialogs = open_firmware(browser, url, f"{PROTO3}&byhand=right", "light", vp)
            dialog = manual_open(page, label)
            dialog.get_by_role("button", name="Connect keyboard").click()
            expect(dialog.get_by_role("heading", name="The left half still runs x3.1.3")).to_be_visible(timeout=20000)
            check(dialog.get_by_text("The right half has x3.2. Install the left half's file, then connect again.").count() == 1, f"{label}: names both halves")
            files = [dialog.locator("[data-file]").nth(i).get_attribute("data-file") for i in range(dialog.locator("[data-file]").count())]
            check(files == ["left"], f"{label}: only the left half's file {files}")
            check("left half's U port" in dialog.inner_text() and "right half's U port" not in dialog.inner_text(), f"{label}: only the left half's steps")
            layout(page, f"{label}")
            shot(page, "10-by-hand-one-half")
            dialog.get_by_role("button", name="Connect again").click()
            expect(dialog.get_by_role("heading", name="x3.2 is installed")).to_be_visible(timeout=20000)
            check(not errors, f"{label}: no page errors {errors}")
            context.close()

        # Neither half changed: the instructions with one line (screenshot only at phone width).
        context, page, errors, dialogs = open_firmware(browser, url, f"{PROTO3}&byhand=none", "light", PHONE)
        dialog = manual_open(page, "neither")
        dialog.get_by_role("button", name="Connect keyboard").click()
        expect(dialog.get_by_test_id("manual-still")).to_be_visible(timeout=20000)
        check(dialog.get_by_role("heading", name="Install x3.2 by hand").count() == 1, "neither: the instructions stay")
        shot(page, "11-by-hand-neither")
        context.close()

        browser.close()

    print(f"\n{len(failures)} failed" if failures else "\nall passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
