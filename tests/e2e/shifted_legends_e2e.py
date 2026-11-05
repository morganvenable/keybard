"""
Browser tests for the dual-legend prototype
(?legendStyle=stacked|diagonal|corner|keycap): digit and punctuation keys also
show their shifted symbol. Run with `npm run test:e2e:shifted-legends`.

For every style, key size (default, medium, small), panel position (sidebar,
bottom bar) and theme, on the simulated board with legend samples
(?fakeBoard=legends: digit keys wrapped in a modifier, a mod-tap and a
layer-tap, some in combos) and Standard Keys open, then again with the
picker's CTRL modifier on (every picker key gets an LCTL band):
  1. `/` shows `?` on the layout and in the US picker; LCTL(KC_1), LCTL_T(KC_2),
     LT1(KC_3) and LALT(KC_SLASH) show both legends; LSFT(KC_4) keeps its `$`
     and letters keep one legend.
  2. Both legends of every dual key sit inside the key (inside its border), do
     not overlap each other, and share one font size and one color.
  3. Both legends keep the key's own legend color (no accent). In the picker
     that color meets WCAG AA (4.5:1) on the key; on the layout it is the
     existing white-on-layer-color legend (Keybard's fixed brand colors, 3.39:1
     on the primary layer), reported but not changed by this prototype.
  4. Diagonal: on every key, no legend meets a key indicator (the header band
     of a mod-tap or layer-tap, a modifier band, or a combo fold at its large
     size), leaves the key or meets the other legend. For the other styles,
     those collisions on keys with a band are listed instead of failed.
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

STYLES = ["stacked", "diagonal", "corner", "keycap"]
# Must clear every band and combo fold; the others are measured and reported.
STRICT_INDICATORS = {"diagonal"}
SIZES = ["default", "medium", "small"]
POSITIONS = ["sidebar", "bottombar"]
THEMES = ["light", "dark"]
SHOTS = os.environ.get("E2E_SHOTS")
ONLY = os.environ.get("E2E_STYLES")  # e.g. "diagonal,stacked" for a quicker run

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
  const meet = (a, q) => !(a.right <= q.left + 0.25 || q.right <= a.left + 0.25 || a.bottom <= q.top + 0.25 || q.bottom <= a.top + 0.25);
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
    // Key indicators: the header band (mod-tap, layer-tap), the modifier band, and combo
    // folds (drawn at their large size; see the style the test adds).
    const hits = [];
    const bands = [...key.querySelectorAll(':scope > span')];
    for (const band of bands) {
      const q = band.getBoundingClientRect();
      if (meet(sr, q)) hits.push('shifted/band ' + band.textContent.trim());
      if (meet(br, q)) hits.push('base/band ' + band.textContent.trim());
    }
    const folds = [...key.querySelectorAll('[data-combo-fold] :is(path, polygon)')];
    for (const fold of folds) {
      const f = fold.getBoundingClientRect();
      if (!f.width || !f.height) continue;
      // The fold is the triangle below the line from its bottom-left to its top-right.
      const inTri = q => !(q.right <= f.left || q.bottom <= f.top || q.left >= f.right || q.top >= f.bottom) &&
        ((q.right - f.left) / f.width + (q.bottom - f.top) / f.height > 1);
      if (inTri(sr)) hits.push('shifted/fold');
      if (inTri(br)) hits.push('base/fold');
    }
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
      inS: inside(sr), inB: inside(br), overlap, hits: [...new Set(hits)],
      kind: bands.length ? 'banded' : folds.length ? 'fold' : 'plain',
      contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
    });
  }
  return out;
}"""


def open_case(browser, url, style, size, position, theme):
    context = browser.new_context(viewport={"width": 1920, "height": 1080}, color_scheme=theme, reduced_motion="reduce")
    context.add_init_script(settings_init(size, position))
    page = context.new_page()
    q = f"fakeBoard=legends&panel=keyboard&theme={theme}" + (f"&legendStyle={style}" if style else "")
    page.goto(f"{url}?{q}")
    wait_connected(page)
    page.locator("[data-fitted-keyboard]:visible").first.wait_for(timeout=20000)
    page.add_style_tag(content="[data-fold-scale]{transform:none!important}")
    page.wait_for_timeout(600)
    return context, page


def shoot(page: Page, name: str):
    if not SHOTS:
        return
    os.makedirs(SHOTS, exist_ok=True)
    page.locator('[aria-label="Keyboard canvas"]:visible').first.screenshot(path=os.path.join(SHOTS, f"{name}-layout.png"))
    page.locator("[data-fitted-keyboard]:visible").first.screenshot(path=os.path.join(SHOTS, f"{name}-picker.png"))
    page.screenshot(path=os.path.join(SHOTS, f"{name}-full.png"))


def shoot_picker(page: Page, name: str):
    if SHOTS:
        page.locator("[data-fitted-keyboard]:visible").first.screenshot(path=os.path.join(SHOTS, f"{name}-picker.png"))


def run_case(browser, url, style, size, position, theme, summary, collisions):
    tag = f"{style}/{size}/{position}/{theme}"
    context, page = open_case(browser, url, style, size, position, theme)
    m = page.evaluate(MEASURE_JS)
    layout = [x for x in m if x["where"] == "layout"]
    picker = [x for x in m if x["where"] == "picker"]
    check(any(x["code"] == "/" and x["shifted"] == "?" for x in picker), f"{tag}: picker / shows ?")
    check(any(x["code"] == "KC_SLASH" and x["shifted"] == "?" for x in layout), f"{tag}: layout / shows ?")
    for code, sh in (("LCTL(KC_1)", "!"), ("LCTL_T(KC_2)", "@"), ("LT1(KC_3)", "#"), ("LALT(KC_SLASH)", "?")):
        check(any(x["code"] == code and x["shifted"] == sh for x in layout), f"{tag}: {code} shows {sh}")
    # LSFT(KC_4) is named KC_DLR on the layout; it draws $ alone.
    dollar = page.locator('[aria-label="Keyboard canvas"] [data-keycap][data-key-label="$"]')
    check(dollar.count() > 0, f"{tag}: LSFT(KC_4) is on the layout as $")
    check(dollar.locator("[data-dual-legend]").count() == 0, f"{tag}: LSFT(KC_4) keeps its one legend ($)")
    check(page.locator('[data-keycode="KC_A"] [data-dual-legend]').count() == 0, f"{tag}: A keeps one legend")
    if size in ("default", "small"):
        shoot(page, f"{style}-{size}-{position}-{theme}")
    # The picker's CTRL modifier: every picker key gets an LCTL band.
    ctrl = page.get_by_role("button", name="CTRL", exact=True).first
    if ctrl.is_visible():
        ctrl.click()
        page.wait_for_timeout(300)
        mc = [dict(x, where="picker+ctrl") for x in page.evaluate(MEASURE_JS) if x["where"] == "picker"]
        check(any(x["code"] == "/" and x["shifted"] == "?" for x in mc), f"{tag}: picker with CTRL, / shows ?")
        m += mc
        if size in ("default", "small"):
            shoot_picker(page, f"{style}-{size}-{position}-{theme}-ctrl")
        page.get_by_role("button", name="None", exact=True).first.click()
    else:
        check(False, f"{tag}: CTRL modifier button visible")
    for x in m:
        k = f"{tag} {x['where']} {x['code']}"
        if style in STRICT_INDICATORS or x["kind"] != "banded":
            check(x["inS"] and x["inB"], f"{k}: legends inside the key ({x['keyPx']}px key)")
        elif not (x["inS"] and x["inB"]):
            x["hits"] = x["hits"] + ["outside the key"]
        if style in STRICT_INDICATORS or x["kind"] != "banded":
            check(not x["overlap"], f"{k}: legends do not overlap")
        elif x["overlap"]:
            x["hits"] = x["hits"] + ["the two legends overlap"]
        check(x["sFont"] == x["bFont"], f"{k}: one font size")
        check(x["sColor"] == x["bColor"], f"{k}: one color")
        check(x["sColor"] == x["keyColor"], f"{k}: the key's own legend color")
        check("Inter" in x["family"], f"{k}: Inter font")
        if x["where"].startswith("picker"):
            check(x["contrast"] >= 4.5, f"{k}: contrast {x['contrast']:.2f} >= 4.5")
        if x["hits"]:
            collisions.setdefault(style, set()).add(f"{size}/{position} {x['where']} {x['code']}: {', '.join(x['hits'])}")
        if style in STRICT_INDICATORS:
            check(not x["hits"], f"{k}: clear of indicators ({x['hits']})")
    for where in ("layout", "picker", "picker+ctrl"):
        rows = [x for x in m if x["where"] == where]
        if rows:
            s = summary.setdefault(f"{style}/{size}/{position}/{where}", {})
            s["keyPx"] = sorted({x["keyPx"] for x in rows})
            s["fontPx"] = sorted({x["fontPx"] for x in rows})
            s["kinds"] = sorted({x["kind"] for x in rows})
            s["minContrast"] = round(min(min(x["contrast"] for x in rows), s.get("minContrast", 99)), 2)
    if style == "stacked" and size == "default" and position == "sidebar" and theme == "light":
        page.locator('[data-legend-choice="diagonal"]').click()
        page.wait_for_timeout(200)
        check("legendStyle=diagonal" in page.url, "switcher writes the style to the URL")
        check(page.locator('[data-dual-legend="diagonal"]').count() > 0, "switcher restyles keys live")
        page.locator('[data-legend-choice="off"]').click()
        page.wait_for_timeout(200)
        check(page.locator("[data-dual-legend]").count() == 0, "switcher Off draws one legend")
    context.close()


def main():
    summary: dict[str, dict] = {}
    collisions: dict[str, set] = {}
    styles = [s for s in STYLES if not ONLY or s in ONLY.split(",")]
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for position in POSITIONS:
                context, page = open_case(browser, url, None, "default", position, "light")
                check(page.locator("[data-dual-legend]").count() == 0, f"{position}: no param, no dual legends")
                check(page.locator("[data-legend-switcher]").count() == 0, f"{position}: no param, no switcher")
                context.close()
            for style in styles:
                for size in SIZES:
                    for position in POSITIONS:
                        for theme in THEMES:
                            run_case(browser, url, style, size, position, theme, summary, collisions)
        finally:
            browser.close()
    for k, v in sorted(summary.items()):
        print(k, json.dumps(v))
    for style in styles:
        hits = sorted(collisions.get(style, ()))
        print(f"{style}: {len(hits)} key(s) where a legend meets an indicator")
        for h in hits[:12]:
            print("   ", h)
    if SHOTS:
        with open(os.path.join(SHOTS, "summary.json"), "w", encoding="utf-8") as f:
            json.dump({"sizes": summary, "collisions": {k: sorted(v) for k, v in collisions.items()}}, f, indent=1)
    print(f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
