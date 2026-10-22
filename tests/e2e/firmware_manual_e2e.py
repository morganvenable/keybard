"""
Browser test of firmware installs from Settings > Firmware as a person runs them:
the built app (test-site build, so ?fwfake=1 backs Firmware with the mock board),
the QWERTY Example, no keyboard. Run with `npm run test:e2e:firmware`.

  1. A board on updater protocol 3 is named by its version string (x3.1.3), never
     "vNext1". Install by hand saves the layout first (no "Connect your keyboard
     to save its layout first"), offers Keep my layout (chosen) and Reset to the
     default layout, and after both halves' steps and Connect puts the layout back.
  2. Reset to the default layout in Install by hand puts nothing back.
  3. A protocol-4 board installs in Keybard: the sheet saves the layout, Start
     update runs to "Updated to x3.2" with the layout put back, and no native
     browser dialog appears at any point.
  4. One line, light and dark: the dialog has no sideways scroll, and each layout
     choice, step title and check row sits on one line.

Same server options as combo_editor_e2e.py (E2E_URL, E2E_SKIP_BUILD). E2E_URL must
be a test-site build (VITE_STORAGE_NAMESPACE=keybard-test), e.g.
https://morganvenable.github.io/keybard-test/. Exits 1 when a check fails.
"""
import os
import sys

# The mock board ships only in development and test-site builds.
os.environ.setdefault("VITE_STORAGE_NAMESPACE", "keybard-test")

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_editor_e2e import app_url  # noqa: E402

PROTO3 = "?demo&fwfake=1&proto=3&running=x3.1.3&panel=firmware&speed=20"
PROTO4 = "?demo&fwfake=1&panel=firmware&speed=20"


def open_firmware(browser, url: str, query: str, theme: str = "light"):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=theme, reduced_motion="reduce")
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
        const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.5;
        return { text: el.textContent.trim().slice(0, 60), lines: Math.round(el.getBoundingClientRect().height / lh) };
    });
    return { count: rows.length, wrapped: rows.filter((r) => r.lines > 1) };
}"""

WIDE_JS = """() => {
    const d = document.querySelector('[role=dialog]');
    return { page: document.documentElement.scrollWidth > innerWidth, dialog: !!d && d.scrollWidth > d.clientWidth + 1 };
}"""


def main() -> int:
    failures = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    def one_line(page, label: str):
        wide = page.evaluate(WIDE_JS)
        check(not any(wide.values()), f"{label}: no sideways scroll {wide}")
        rows = page.evaluate(ONE_LINE_JS, "[data-testid=layout-choice] label, [data-step] > div > span.font-semibold, [data-check] span.font-medium")
        check(rows["count"] > 0 and not rows["wrapped"], f"{label}: each of {rows['count']} choices, step titles and checks on one line {rows['wrapped']}")

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()

        # 1 and 4. Protocol 3: the real version, then Install by hand with the backup and restore.
        for theme in ["light", "dark"]:
            context, page, errors, dialogs = open_firmware(browser, url, PROTO3, theme)
            section = page.get_by_test_id("firmware-section")
            expect(section.get_by_text("x3.1.3")).to_be_visible(timeout=15000)
            check(section.get_by_text("vNext1").count() == 0, f"{theme}: no vNext1 label")
            section.get_by_role("button", name="Install x3.2").click()
            dialog = page.get_by_test_id("manual-install")
            expect(dialog).to_be_visible()
            expect(dialog.get_by_text("Kip-x3.1.3-2026-10-15.svil")).to_be_visible(timeout=15000)
            check(dialog.get_by_text("Connect your keyboard to save its layout first.").count() == 0, f"{theme}: no 'connect first' while connected")
            keep = dialog.get_by_role("radio", name="Keep my layout")
            check(keep.is_checked() and keep.is_enabled(), f"{theme}: Keep my layout chosen and enabled")
            check(dialog.get_by_role("radio", name="Reset to the default layout").count() == 1, f"{theme}: the default layout offered")
            one_line(page, f"{theme} manual install")
            for _ in range(2):
                dialog.get_by_role("button", name="Next").first.click()
            dialog.get_by_role("button", name="Connect").click()
            expect(dialog.get_by_text("Layout put back")).to_be_visible(timeout=15000)
            check(dialog.get_by_role("button", name="Done").is_enabled(), f"{theme}: Done after the restore")
            one_line(page, f"{theme} manual install, done")
            dialog.get_by_role("button", name="Done").click()
            expect(dialog).to_be_hidden()
            check(not dialogs, f"{theme}: no native dialogs {dialogs}")
            check(not errors, f"{theme}: no page errors {errors}")
            context.close()

        # 2. Reset to the default layout puts nothing back.
        context, page, errors, dialogs = open_firmware(browser, url, PROTO3)
        page.get_by_test_id("firmware-section").get_by_role("button", name="Install x3.2").click()
        dialog = page.get_by_test_id("manual-install")
        expect(dialog.get_by_text("Kip-x3.1.3-2026-10-15.svil")).to_be_visible(timeout=15000)
        dialog.get_by_role("radio", name="Reset to the default layout").check()
        check(dialog.get_by_text("Put your layout back").count() == 0, "defaults: no restore step")
        for _ in range(2):
            dialog.get_by_role("button", name="Next").first.click()
        dialog.get_by_role("button", name="Connect").click()
        expect(dialog.get_by_role("button", name="Done")).to_be_visible(timeout=15000)
        check(dialog.get_by_text("Layout put back").count() == 0, "defaults: nothing put back")
        context.close()

        # 3. Protocol 4: the in-app install, start to result, no native dialog.
        for theme in ["light", "dark"]:
            context, page, errors, dialogs = open_firmware(browser, url, PROTO4, theme)
            page.get_by_test_id("firmware-section").get_by_role("button", name="Update to x3.2").click()
            sheet = page.get_by_test_id("update-sheet")
            expect(sheet.get_by_text("Layout saved")).to_be_visible(timeout=20000)
            one_line(page, f"{theme} sheet")
            sheet.get_by_role("button", name="Start update").click()
            result = page.get_by_test_id("update-result")
            expect(result).to_be_visible(timeout=120000)
            check(result.get_by_text("Updated to x3.2").count() == 1, f"{theme}: updated to x3.2")
            check(result.get_by_text("Layout put back").count() == 1, f"{theme}: layout put back")
            check(not dialogs, f"{theme}: no native dialogs during the install {dialogs}")
            check(not errors, f"{theme}: no page errors {errors}")
            context.close()

        browser.close()

    print(f"\n{len(failures)} failed" if failures else "\nall passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
