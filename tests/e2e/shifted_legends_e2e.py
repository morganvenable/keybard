"""
Browser tests for shifted legends: digit and punctuation keys also show the
symbol Shift types with them (Settings > Appearance and editing > Shifted Key
Symbols, on by default). Run with `npm run test:e2e:shifted-legends`.

For the setting on and off, every key size (default, medium, small), panel
position (sidebar, bottom bar) and theme, on the simulated board with legend
samples (?fakeBoard=legends: digit keys wrapped in a modifier, a mod-tap and a
layer-tap, some in combos) and Standard Keys open, then again with the
picker's CTRL modifier on (every picker key gets an LCTL band):
  1. On: `/` shows `?` on the layout and in the US picker; LCTL(KC_1),
     LCTL_T(KC_2), LT1(KC_3) and LALT(KC_SLASH) show both legends; LSFT(KC_4)
     keeps its `$` and letters keep one legend.
     Off: no key draws two legends, and LCTL(KC_1), LCTL_T(KC_2) and LT1(KC_3)
     draw 1, 2 and 3 (their base key), not !, @ and #.
  2. The ink of both legends of every dual key (canvas measureText with the
     span's font, at its baseline: the glyphs as drawn, not their text boxes)
     sits whole inside the key's border, so nothing is clipped, and the two do
     not overlap. Both share one font size and one color.
  3. No glyph meets a key indicator: the header band of a mod-tap or
     layer-tap, a modifier band, or a combo fold at its large size.
  4. Both legends keep the key's own legend color. In the picker that color
     meets WCAG AA (4.5:1) on the key; on the layout it is the existing legend
     on the layer color, unchanged here.
And the picker's Shift: with the picker's own L SHIFT on, the 1 key shows `!`
alone and binds LSFT(KC_1) (named KC_EXLM), as shown; with it off, KC_1. The
SHIFT modifier button shows `!` alone too.

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

SIZES = ["default", "medium", "small"]
POSITIONS = ["sidebar", "bottombar"]
THEMES = ["light", "dark"]
SHOTS = os.environ.get("E2E_SHOTS")

failures: list[str] = []


def check(cond: bool, label: str):
    if not cond:
        print("FAIL " + label)
        failures.append(label)


def settings_init(size: str, position: str, shifted: bool = True) -> str:
    stored = {"key-size": size, "panel-position": position, "live-updating": True, "shifted-legends": shifted}
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
  const ctx = document.createElement('canvas').getContext('2d');
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
    // The glyphs' ink, not their text boxes: canvas measureText with the span's own font, placed
    // at the span's baseline (a single line: half the leading, then the font's ascent).
    const ink = el => {
      const st = getComputedStyle(el), q = el.getBoundingClientRect();
      // Measured at 100px and scaled: canvas rounds glyph metrics to whole pixels at small sizes.
      ctx.font = `${st.fontWeight} 100px ${st.fontFamily}`;
      const t = st.textTransform === 'uppercase' ? el.textContent.toLocaleUpperCase() : el.textContent;
      const raw = ctx.measureText(t), em = parseFloat(st.fontSize) / 100;
      const mm = {};
      for (const k of ['actualBoundingBoxLeft', 'actualBoundingBoxRight', 'actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'fontBoundingBoxAscent', 'fontBoundingBoxDescent']) mm[k] = raw[k] * em;
      const lh = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.2;
      const baseline = (lh - (mm.fontBoundingBoxAscent + mm.fontBoundingBoxDescent)) / 2 + mm.fontBoundingBoxAscent;
      return { left: q.left - mm.actualBoundingBoxLeft * scale, right: q.left + mm.actualBoundingBoxRight * scale,
               top: q.top + (baseline - mm.actualBoundingBoxAscent) * scale, bottom: q.top + (baseline + mm.actualBoundingBoxDescent) * scale };
    };
    const sr = ink(s), br = ink(b);
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


LAYOUT = '[aria-label="Keyboard canvas"]'


def open_case(browser, url, size, position, theme, shifted=True):
    context = browser.new_context(viewport={"width": 1920, "height": 1080}, color_scheme=theme, reduced_motion="reduce")
    context.add_init_script(settings_init(size, position, shifted))
    page = context.new_page()
    page.goto(f"{url}?fakeBoard=legends&panel=keyboard&theme={theme}")
    wait_connected(page)
    page.locator("[data-fitted-keyboard]:visible").first.wait_for(timeout=20000)
    page.add_style_tag(content="[data-fold-scale]{transform:none!important}")
    page.wait_for_timeout(600)
    return context, page


def shoot(page: Page, name: str, picker_only=False):
    if not SHOTS:
        return
    os.makedirs(SHOTS, exist_ok=True)
    if not picker_only:
        page.locator(f"{LAYOUT}:visible").first.screenshot(path=os.path.join(SHOTS, f"{name}-layout.png"))
    page.locator("[data-fitted-keyboard]:visible").first.screenshot(path=os.path.join(SHOTS, f"{name}-picker.png"))


def key_text(page: Page, code: str) -> str:
    loc = page.locator(f'{LAYOUT} [data-keycap][data-keycode="{code}"]').first
    return loc.inner_text().replace("\n", " ") if loc.count() else ""


def run_case(browser, url, size, position, theme, summary):
    tag = f"on/{size}/{position}/{theme}"
    context, page = open_case(browser, url, size, position, theme)
    m = page.evaluate(MEASURE_JS)
    layout = [x for x in m if x["where"] == "layout"]
    picker = [x for x in m if x["where"] == "picker"]
    check(any(x["code"] == "/" and x["shifted"] == "?" for x in picker), f"{tag}: picker / shows ?")
    check(any(x["code"] == "KC_SLASH" and x["shifted"] == "?" for x in layout), f"{tag}: layout / shows ?")
    for code, sh in (("LCTL(KC_1)", "!"), ("LCTL_T(KC_2)", "@"), ("LT1(KC_3)", "#"), ("LALT(KC_SLASH)", "?")):
        check(any(x["code"] == code and x["shifted"] == sh for x in layout), f"{tag}: {code} shows {sh}")
    dollar = page.locator(f'{LAYOUT} [data-keycap][data-key-label="$"]')
    check(dollar.count() > 0, f"{tag}: LSFT(KC_4) is on the layout as $")
    check(dollar.locator("[data-dual-legend]").count() == 0, f"{tag}: LSFT(KC_4) keeps its one legend ($)")
    check(page.locator('[data-keycode="KC_A"] [data-dual-legend]').count() == 0, f"{tag}: A keeps one legend")
    if size in ("default", "small"):
        shoot(page, f"on-{size}-{position}-{theme}")
    ctrl = page.get_by_role("button", name="CTRL", exact=True).first
    if ctrl.is_visible():
        ctrl.click()
        page.wait_for_timeout(300)
        mc = [dict(x, where="picker+ctrl") for x in page.evaluate(MEASURE_JS) if x["where"] == "picker"]
        check(any(x["code"] == "/" and x["shifted"] == "?" for x in mc), f"{tag}: picker with CTRL, / shows ?")
        m += mc
        if size in ("default", "small"):
            shoot(page, f"on-{size}-{position}-{theme}-ctrl", picker_only=True)
        page.get_by_role("button", name="None", exact=True).first.click()
    else:
        check(False, f"{tag}: CTRL modifier button visible")
    for x in m:
        k = f"{tag} {x['where']} {x['code']}"
        check(x["inS"] and x["inB"], f"{k}: glyphs whole inside the key ({x['keyPx']}px key)")
        check(not x["overlap"], f"{k}: the two glyphs do not overlap")
        check(not x["hits"], f"{k}: glyphs clear of bands and folds ({x['hits']})")
        check(x["sFont"] == x["bFont"], f"{k}: one font size")
        check(x["sColor"] == x["bColor"], f"{k}: one color")
        check(x["sColor"] == x["keyColor"], f"{k}: the key's own legend color")
        check("Inter" in x["family"], f"{k}: Inter font")
        if x["where"].startswith("picker"):
            check(x["contrast"] >= 4.5, f"{k}: contrast {x['contrast']:.2f} >= 4.5")
    for where in ("layout", "picker", "picker+ctrl"):
        rows = [x for x in m if x["where"] == where]
        if rows:
            s = summary.setdefault(f"{size}/{position}/{where}", {})
            s["keyPx"] = sorted({x["keyPx"] for x in rows})
            s["fontPx"] = sorted({x["fontPx"] for x in rows})
            s["kinds"] = sorted({x["kind"] for x in rows})
            s["minContrast"] = round(min(min(x["contrast"] for x in rows), s.get("minContrast", 99)), 2)
    context.close()


def run_off(browser, url, size, position, theme):
    tag = f"off/{size}/{position}/{theme}"
    context, page = open_case(browser, url, size, position, theme, shifted=False)
    check(page.locator("[data-dual-legend]").count() == 0, f"{tag}: no key draws two legends")
    for code, want, wrong in (("LCTL(KC_1)", "1", "!"), ("LCTL_T(KC_2)", "2", "@"), ("LT1(KC_3)", "3", "#")):
        t = key_text(page, code)
        check(want in t.split() and wrong not in t, f"{tag}: {code} draws {want}, not {wrong} (drew {t!r})")
    check("$" in key_text(page, "KC_DLR") or page.locator(f'{LAYOUT} [data-keycap][data-key-label="$"]').count() > 0,
          f"{tag}: LSFT(KC_4) still draws $")
    if size in ("default", "small"):
        shoot(page, f"off-{size}-{position}-{theme}")
    context.close()


def layout_codes(page: Page) -> list:
    return page.locator(f"{LAYOUT} [data-keycap]:visible").evaluate_all("els => els.map(e => e.getAttribute('data-keycode'))")


def bind_from_picker(page: Page, target: str, picker_key: str):
    page.locator(f'{LAYOUT} [data-keycap][data-keycode="{target}"]:visible').first.click()
    page.locator(f'[data-fitted-keyboard] [data-picker-key="{picker_key}"]').first.click()
    page.wait_for_timeout(600)


def run_shift(browser, url, position):
    tag = f"shift/{position}"
    context, page = open_case(browser, url, "default", position, "light")
    picker = page.locator("[data-fitted-keyboard]:visible").first
    one = picker.locator('[data-picker-key="1"]').first
    # Plain: the 1 key shows both legends and binds KC_1.
    bind_from_picker(page, "KC_W", "1")
    check("KC_1" in layout_codes(page), f"{tag}: the 1 key binds KC_1")
    # The picker's own L SHIFT: shows ! alone and binds Shift+1.
    page.locator(f'{LAYOUT} [data-keycap][data-keycode="KC_E"]:visible').first.click()
    picker.locator('[data-picker-key="{shiftleft}"]').first.click()
    page.wait_for_timeout(400)
    check(one.inner_text().strip() == "!" and one.locator("[data-dual-legend]").count() == 0, f"{tag}: with picker Shift on, 1 shows ! alone")
    bind_from_picker(page, "KC_R", "1")
    check("KC_EXLM" in layout_codes(page), f"{tag}: with picker Shift on, the 1 key binds Shift+1 (KC_EXLM), as shown")
    # A letter with picker Shift on binds Shift plus the letter (what the key shows: Q).
    bind_from_picker(page, "KC_T", "q")
    check(any(c in ("LSFT(KC_Q)", "S(KC_Q)") for c in layout_codes(page)), f"{tag}: with picker Shift on, Q binds Shift+Q")
    context.close()
    # The SHIFT modifier button: ! alone, binds Shift+1.
    context, page = open_case(browser, url, "default", position, "light")
    page.get_by_role("button", name="SHIFT", exact=True).first.click()
    page.wait_for_timeout(300)
    one = page.locator('[data-fitted-keyboard]:visible [data-picker-key="1"]').first
    check(one.inner_text().strip() == "!" and one.locator("[data-dual-legend]").count() == 0, f"{tag}: SHIFT modifier, 1 shows ! alone")
    bind_from_picker(page, "KC_W", "1")
    check("KC_EXLM" in layout_codes(page), f"{tag}: SHIFT modifier, the 1 key binds Shift+1 (KC_EXLM)")
    if SHOTS:
        shoot(page, f"shift-modifier-{position}", picker_only=True)
    context.close()


def main():
    summary: dict[str, dict] = {}
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for position in POSITIONS:
                run_shift(browser, url, position)
            for size in SIZES:
                for position in POSITIONS:
                    for theme in THEMES:
                        run_case(browser, url, size, position, theme, summary)
                        run_off(browser, url, size, position, theme)
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
