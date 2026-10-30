"""
Browser tests: every native menu (<select>) is readable in dark theme. Run with
`npm run test:e2e:select-contrast`.

A native select's open list draws each <option> with the option's own colors.
Options inherit the select's text color (light in dark theme), and Chromium
draws the list white when the select's background is transparent, so the
Standard Keys keyboard layout menu was light text on white. The check reads
the computed colors of every option (a transparent background counts as the
white Chromium draws) and needs a contrast of at least 4.5:1.

  1. Standard Keys (?panel=keyboard) in dark theme: the keyboard layout menu
     and every other select on the page.
  2. Settings in dark theme: every select there, and an open cluster menu
     (the app's own popup menu).
  3. The same pages in light theme, so the fix doesn't break light mode.

Builds the app like fake_board_e2e.py (E2E_URL and E2E_SKIP_BUILD work the
same way). Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import re
import sys

from playwright.sync_api import Page, expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402

failures: list[str] = []

# Any CSS color (oklch included) as sRGB "rgba(r, g, b, a)", drawn on a canvas.
TO_RGB = """
const toRgb = (c) => {
    const x = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1); x.fillStyle = c; x.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = x.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
};
"""

# An open popup menu's items (role=option or menuitem): each item's text color and the first
# background behind it that isn't transparent.
READ_POPUP_ITEMS = "() => {" + TO_RGB + r"""
    return [...document.querySelectorAll('[role=listbox] [role=option], [role=menu] [role=menuitem]')].map(o => {
        let e = o, bg = 'rgba(0, 0, 0, 0)';
        while (e) { const b = toRgb(getComputedStyle(e).backgroundColor); if (!b.endsWith(', 0)')) { bg = b; break; } e = e.parentElement; }
        return ['(popup)', o.textContent.trim(), toRgb(getComputedStyle(o).color), bg];
    });
}"""

# Every option's colors, as [select label, option text, color, background].
READ_OPTIONS = "(all) => {" + TO_RGB + """
    return [...document.querySelectorAll('select')].filter(s => all || s.offsetParent !== null).flatMap(s => {
        const name = s.getAttribute('aria-label') || s.getAttribute('title') || s.name || '(select)';
        return [...s.options].map(o => {
            const cs = getComputedStyle(o);
            return [name, o.textContent.trim(), toRgb(cs.color), toRgb(cs.backgroundColor)];
        });
    });
}"""


def rgba(css: str):
    nums = [float(x) for x in css[css.index("(") + 1:css.index(")")].replace("/", ",").replace(" ", ",").split(",") if x]
    r, g, b = nums[:3]
    a = nums[3] if len(nums) > 3 else 1.0
    return r, g, b, a


def over_white(css: str):
    """The option's background as drawn: a transparent one shows Chromium's white list."""
    r, g, b, a = rgba(css)
    return tuple(c * a + 255 * (1 - a) for c in (r, g, b))


def luminance(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg) -> float:
    a, b = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def check(cond: bool, label: str):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        failures.append(label)


def check_options(page: Page, label: str, must_include: str | None = None, include_hidden: bool = False, rows=None) -> int:
    if rows is None:
        rows = page.evaluate(READ_OPTIONS, include_hidden)
    check(len(rows) > 0, f"{label}: has menus")
    if must_include:
        check(any(r[0] == must_include for r in rows), f"{label}: the {must_include} menu is there")
    worst = None
    for name, text, color, bg in rows:
        back = over_white(bg)
        r, g, b, a = rgba(color)
        fore = tuple(c * a + bc * (1 - a) for c, bc in zip((r, g, b), back))
        ratio = contrast(fore, back)
        if worst is None or ratio < worst[0]:
            worst = (ratio, name, text, color, bg)
    if worst:
        ratio, name, text, color, bg = worst
        check(ratio >= 4.5, f"{label}: lowest option contrast {ratio:.1f}:1 ({name} / {text}: {color} on {bg})")
    return len(rows)


def open_page(browser, url: str, theme: str, panel: str):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=theme, reduced_motion="reduce")
    page = context.new_page()
    page.goto(f"{url}?fakeBoard&theme={theme}&panel={panel}")
    wait_connected(page)
    if theme == "dark":
        expect(page.locator("html")).to_have_class(re.compile(r"\bdark\b"), timeout=10000)
    return context, page


def flow_standard_keys(browser, url, theme):
    context, page = open_page(browser, url, theme, "keyboard")
    try:
        expect(page.get_by_role("combobox", name="Keyboard layout").first).to_be_visible(timeout=15000)
        check_options(page, f"Standard Keys, {theme}", must_include="Keyboard layout")
    finally:
        context.close()


def flow_settings(browser, url, theme):
    context, page = open_page(browser, url, theme, "settings")
    try:
        expect(page.get_by_role("heading", name="Settings").first).to_be_visible(timeout=15000)
        # Native selects anywhere in Settings, in open sections or not.
        check_options(page, f"Settings menus, {theme}", include_hidden=True)
        # The app's own popup menus (the cluster pickers), opened.
        page.get_by_role("combobox", name="Left Pinky").first.click()
        expect(page.get_by_role("option").first).to_be_visible(timeout=5000)
        check_options(page, f"Settings cluster menu, {theme}", rows=page.evaluate(READ_POPUP_ITEMS))
        page.keyboard.press("Escape")
    finally:
        context.close()


def main():
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for theme in ("dark", "light"):
                flow_standard_keys(browser, url, theme)
                flow_settings(browser, url, theme)
        finally:
            browser.close()
    if failures:
        print(f"\n{len(failures)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    main()
