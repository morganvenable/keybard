"""
Browser tests for the dual-legend prototype (?legendStyle=stacked|corner|keycap):
plain digit and punctuation keys also show their shifted symbol. Run with
`npm run test:e2e:shifted-legends`.

For every style, key size (default, medium, small), panel position (sidebar,
bottom bar) and theme, on the simulated board with Standard Keys open:
  1. `/` shows `?` on the layout and in the US picker; letters keep one legend.
  2. Both legends of every dual key sit inside the key (inside its border), do
     not overlap each other, and share one font size and one color.
  3. Both legends keep the key's own legend color (no accent). In the picker
     that color meets WCAG AA (4.5:1) on the key; on the layout it is the
     existing white-on-layer-color legend (Keybard's fixed brand colors, 3.39:1
     on the primary layer), reported but not changed by this prototype.
Without the param no key draws two legends (no regression).

E2E_SHOTS=<dir> also saves screenshots of the layout and the picker.
Builds the app like fake_board_e2e.py (E2E_URL and E2E_SKIP_BUILD work the
same way). Exits 1 when a check fails.
"""
import json
import os
import sys

from playwright.sync_api import Page, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

STYLES = ["stacked", "corner", "keycap"]
SIZES = ["default", "medium", "small"]
POSITIONS = ["sidebar", "bottombar"]
THEMES = ["light", "dark"]
SHOTS = os.environ.get("E2E_SHOTS")

failures: list[str] = []


def check(cond: bool, label: str):
    if not cond:
        print("FAIL " + label)
        failures.append(label)


def settings_init(size: str, position: str) -> str:
    stored = {"key-size": size, "panel-position": position, "live-updating": True}
    return (f"(() => {{ const extra = {json.dumps(stored)}; const keys = Object.keys(localStorage).filter(k => /keyboard-settings$/.test(k));"
            " if (!keys.includes('keyboard-settings')) keys.push('keyboard-settings');"
            " for (const k of keys) { let v = {}; try { v = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch {}"
            " Object.assign(v, extra); localStorage.setItem(k, JSON.stringify(v)); } })()")


MEASURE_JS = r"""() => {
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const opaque = el => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const a = b.match(/[\d.]+/g);
    if (a && (a.length < 4 || Number(a[3]) > 0.5)) return b; } return 'rgb(255,255,255)'; };
  const out = [];
  for (const face of document.querySelectorAll('[data-dual-legend]')) {
    const key = face.closest('[data-keycap]');
    if (!key || !key.getClientRects().length) continue;
    const r = key.getBoundingClientRect();
    if (r.width === 0) continue;
    const cs = getComputedStyle(key);
    const scale = r.width / key.offsetWidth || 1;
    const bw = parseFloat(cs.borderLeftWidth) * scale;
    const inner = { l: r.left + bw, t: r.top + bw, r: r.right - bw, b: r.bottom - bw };
    const s = face.querySelector('[data-legend="shifted"]'), b = face.querySelector('[data-legend="base"]');
    const sr = s.getBoundingClientRect(), br = b.getBoundingClientRect();
    const inside = q => q.left >= inner.l - 0.5 && q.top >= inner.t - 0.5 && q.right <= inner.r + 0.5 && q.bottom <= inner.b + 0.5;
    const overlap = !(sr.right <= br.left || br.right <= sr.left || sr.bottom <= br.top || br.bottom <= sr.top);
    const fg = getComputedStyle(s).color, bg = opaque(key);
    const L1 = lum(fg), L2 = lum(bg);
    out.push({
      where: key.closest('[data-fitted-keyboard]') ? 'picker' : 'layout',
      code: key.getAttribute('data-keycode') || key.getAttribute('data-picker-key') || '',
      shifted: s.textContent, base: b.textContent,
      keyPx: Math.round(r.width * 10) / 10,
      sFont: getComputedStyle(s).fontSize, bFont: getComputedStyle(b).fontSize,
      fontPx: Math.round(parseFloat(getComputedStyle(s).fontSize) * scale * 10) / 10,
      sColor: fg, bColor: getComputedStyle(b).color, keyColor: cs.color, family: getComputedStyle(s).fontFamily,
      inS: inside(sr), inB: inside(br), overlap,
      contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
    });
  }
  return out;
}"""


def open_case(browser, url, style, size, position, theme, extra=""):
    context = browser.new_context(viewport={"width": 1920, "height": 1080}, color_scheme=theme, reduced_motion="reduce")
    context.add_init_script(settings_init(size, position))
    page = context.new_page()
    q = f"fakeBoard&panel=keyboard&theme={theme}" + (f"&legendStyle={style}" if style else "") + extra
    page.goto(f"{url}?{q}")
    wait_connected(page)
    page.locator("[data-fitted-keyboard]:visible").first.wait_for(timeout=20000)
    page.wait_for_timeout(600)
    return context, page


def shoot(page: Page, name: str):
    if not SHOTS:
        return
    os.makedirs(SHOTS, exist_ok=True)
    canvas = page.locator('[aria-label="Keyboard canvas"]:visible').first
    picker = page.locator("[data-fitted-keyboard]:visible").first
    canvas.screenshot(path=os.path.join(SHOTS, f"{name}-layout.png"))
    picker.screenshot(path=os.path.join(SHOTS, f"{name}-picker.png"))
    page.screenshot(path=os.path.join(SHOTS, f"{name}-full.png"))


def main():
    summary: dict[str, dict] = {}
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for position in POSITIONS:
                context, page = open_case(browser, url, None, "default", position, "light")
                check(page.locator("[data-dual-legend]").count() == 0, f"{position}: no param, no dual legends")
                check(page.locator("[data-legend-switcher]").count() == 0, f"{position}: no param, no switcher")
                context.close()
            for style in STYLES:
                for size in SIZES:
                    for position in POSITIONS:
                        for theme in THEMES:
                            tag = f"{style}/{size}/{position}/{theme}"
                            context, page = open_case(browser, url, style, size, position, theme)
                            m = page.evaluate(MEASURE_JS)
                            layout = [x for x in m if x["where"] == "layout"]
                            picker = [x for x in m if x["where"] == "picker"]
                            check(any(x["code"] == "KC_SLASH" and x["shifted"] == "?" for x in layout) or not any(x["code"] == "KC_SLASH" for x in layout),
                                  f"{tag}: layout / shows ?")
                            check(any(x["code"] == "/" and x["shifted"] == "?" for x in picker), f"{tag}: picker / shows ?")
                            check(len(layout) > 0, f"{tag}: layout has dual keys")
                            check(page.locator('[data-keycode="KC_A"] [data-dual-legend]').count() == 0, f"{tag}: A keeps one legend")
                            for x in m:
                                k = f"{tag} {x['where']} {x['code']}"
                                check(x["inS"] and x["inB"], f"{k}: legends inside the key ({x['keyPx']}px key)")
                                check(not x["overlap"], f"{k}: legends do not overlap")
                                check(x["sFont"] == x["bFont"], f"{k}: one font size")
                                check(x["sColor"] == x["bColor"], f"{k}: one color")
                                check("Inter" in x["family"], f"{k}: Inter font")
                                check(x["sColor"] == x["keyColor"], f"{k}: the key's own legend color")
                                if x["where"] == "picker":
                                    check(x["contrast"] >= 4.5, f"{k}: contrast {x['contrast']:.2f} >= 4.5")
                            for where, rows in (("layout", layout), ("picker", picker)):
                                if rows:
                                    s = summary.setdefault(f"{style}/{size}/{position}/{where}", {})
                                    s["keyPx"] = sorted({x["keyPx"] for x in rows})
                                    s["fontPx"] = sorted({x["fontPx"] for x in rows})
                                    s["minContrast"] = round(min(min(x["contrast"] for x in rows), s.get("minContrast", 99)), 2)
                            if size in ("default", "small"):
                                shoot(page, f"{style}-{size}-{position}-{theme}")
                            if style == "stacked" and size == "default" and position == "sidebar" and theme == "light":
                                page.locator('[data-legend-choice="corner"]').click()
                                page.wait_for_timeout(200)
                                check("legendStyle=corner" in page.url, "switcher writes the style to the URL")
                                check(page.locator('[data-dual-legend="corner"]').count() > 0, "switcher restyles keys live")
                                page.locator('[data-legend-choice="off"]').click()
                                page.wait_for_timeout(200)
                                check(page.locator("[data-dual-legend]").count() == 0, "switcher Off draws one legend")
                            context.close()
        finally:
            browser.close()
    for k, v in sorted(summary.items()):
        print(k, json.dumps(v))
    if SHOTS:
        with open(os.path.join(SHOTS, "summary.json"), "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=1)
    print(f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
