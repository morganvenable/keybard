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
German with AltGr Symbols (run_german, run_toggle; ?keyLegends=german&altgrLegends=on|off): digits get
shifted upper right, base lower left, AltGr lower right; letters with an AltGr character (Q, E, M, ss)
get base and AltGr; legends are whole, apart, clear of bands and folds, one size and color, at every key
size, panel position and theme, in the picker (also with CTRL on) and the layout; keys with a combo fold
or too little room beside a band keep two legends; RALT(KC_7) shows its AltGr character alone; with the
setting off none draws; Settings shows the toggle only with an AltGr layout.
And the picker's Shift: with the picker's own L SHIFT on, the 1 key shows `!`
alone and binds LSFT(KC_1) (named KC_EXLM), as shown; R SHIFT binds RSFT(KC_1);
with it off, KC_1. Caps Lock leaves the picker as it is. The SHIFT modifier
button shows `!` alone too.

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
    stored = {"key-size": size, "panel-position": position, "live-updating": True, "shifted-legends": shifted, "altgr-legends": False}
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
    const s = face.querySelector('[data-legend="shifted"]'), b = face.querySelector('[data-legend="base"]'), a3 = face.querySelector('[data-legend="altgr"]');
    const legends = [['shifted', s], ['base', b], ['altgr', a3]].filter(x => x[1]);
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
    const inks = legends.map(([n, el]) => [n, el, ink(el)]);
    const inside = q => q.left >= inner.l - 0.5 && q.top >= inner.t - 0.5 && q.right <= inner.r + 0.5 && q.bottom <= inner.b + 0.5;
    const apart = (x, y) => x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top;
    let overlap = false;
    for (let i = 0; i < inks.length; i++) for (let j = i + 1; j < inks.length; j++) if (!apart(inks[i][2], inks[j][2])) overlap = true;
    // Key indicators: the header band (mod-tap, layer-tap), the modifier band, and combo
    // folds (drawn at their large size; see the style the test adds).
    const hits = [];
    const bands = [...key.querySelectorAll(':scope > span')];
    for (const band of bands) {
      const q = band.getBoundingClientRect();
      for (const [n, , r2] of inks) if (meet(r2, q)) hits.push(n + '/band ' + band.textContent.trim());
    }
    const folds = [...key.querySelectorAll('[data-combo-fold] :is(path, polygon)')];
    for (const fold of folds) {
      const f = fold.getBoundingClientRect();
      if (!f.width || !f.height) continue;
      // The fold is the triangle below the line from its bottom-left to its top-right.
      const inTri = q => !(q.right <= f.left || q.bottom <= f.top || q.left >= f.right || q.top >= f.bottom) &&
        ((q.right - f.left) / f.width + (q.bottom - f.top) / f.height > 1);
      for (const [n, , r2] of inks) if (inTri(r2)) hits.push(n + '/fold');
    }
    const fg = getComputedStyle(b).color, bg = opaque(key);
    const L1 = lum(fg), L2 = lum(bg);
    out.push({
      where: key.closest('[data-fitted-keyboard]') ? 'picker' : 'layout',
      code: key.getAttribute('data-keycode') || key.getAttribute('data-picker-key') || '',
      shifted: s ? s.textContent : '', base: b.textContent, altgr: a3 ? a3.textContent : '',
      n: legends.length, allIn: inks.every(x => inside(x[2])),
      sameFont: new Set(legends.map(x => getComputedStyle(x[1]).fontSize)).size === 1,
      sameColor: new Set(legends.map(x => getComputedStyle(x[1]).color)).size === 1,
      noTransform: legends.every(x => getComputedStyle(x[1]).textTransform === 'none'),
      keyPx: Math.round(r.width * 10) / 10,
      sFont: getComputedStyle(b).fontSize, bFont: getComputedStyle(b).fontSize,
      fontPx: Math.round(parseFloat(getComputedStyle(b).fontSize) * scale * 10) / 10,
      sColor: fg, bColor: getComputedStyle(b).color, keyColor: cs.color, family: getComputedStyle(b).fontFamily,
      inS: inside(inks[0][2]), inB: inside(inks[inks.length - 1][2]), overlap, hits: [...new Set(hits)],
      kind: bands.length ? 'banded' : folds.length ? 'fold' : 'plain',
      contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
    });
  }
  return out;
}"""


LAYOUT = '[aria-label="Keyboard canvas"]'


def open_case(browser, url, size, position, theme, shifted=True, query=""):
    context = browser.new_context(viewport={"width": 1920, "height": 1080}, color_scheme=theme, reduced_motion="reduce")
    context.add_init_script(settings_init(size, position, shifted))
    page = context.new_page()
    page.goto(f"{url}?fakeBoard=legends&panel=keyboard&theme={theme}{query}")
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
        check(x["allIn"], f"{k}: glyphs whole inside the key ({x['keyPx']}px key)")
        check(not x["overlap"], f"{k}: the glyphs do not overlap")
        check(not x["hits"], f"{k}: glyphs clear of bands and folds ({x['hits']})")
        check(x["sameFont"], f"{k}: one font size")
        check(x["sameColor"], f"{k}: one color")
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


NOMINAL = {"default": 15, "medium": 12, "small": 10}
KEYPX = {"default": 60, "medium": 45, "small": 30}
GERMAN = "&keyLegends=german"


def run_german(browser, url, size, position, theme, summary):
    """German selected, AltGr Symbols on: three legends where they fit, two where not."""
    tag = f"german-on/{size}/{position}/{theme}"
    context, page = open_case(browser, url, size, position, theme, query=GERMAN + "&altgrLegends=on")
    m = page.evaluate(MEASURE_JS)
    layout = [x for x in m if x["where"] == "layout"]
    picker = [x for x in m if x["where"] == "picker"]

    def find(rows, code):
        return next((x for x in rows if x["code"] == code), None)

    # Picker: digits get three legends; letters with an AltGr character get base + AltGr.
    for key, sh, ag in (("2", '"', "²"), ("3", "§", "³"), ("7", "/", "{"), ("8", "(", "["), ("9", ")", "]"), ("0", "=", "}"), ("+", "*", "~")):
        x = find(picker, key)
        check(x is not None and x["shifted"] == sh and x["altgr"] == ag, f"{tag}: picker {key} shows {sh} / {ag} (got {x and (x['shifted'], x['altgr'])})")
    for key, ag in (("q", "@"), ("e", "€"), ("m", "µ"), ("ß", "\\")):
        x = find(picker, key)
        check(x is not None and x["shifted"] == "" and x["altgr"] == ag and x["n"] == 2, f"{tag}: picker {key} shows its base and {ag} (got {x and (x['shifted'], x['altgr'], x['n'])})")
    check(find(picker, "w") is None, f"{tag}: picker W has no AltGr character and keeps one legend")
    # Layout: plain digit keys (KC_2 on the G key), a letter, a mod-tap, a combo key, and RALT alone.
    x = find(layout, "KC_2")
    check(x is not None and x["n"] == 3 and x["altgr"] == "²" and x["shifted"] == '"', f"{tag}: layout KC_2 shows three legends")
    if x:
        check(abs(x["fontPx"] - NOMINAL[size] * x["keyPx"] / KEYPX[size]) < 0.2, f"{tag}: KC_2 at the full {NOMINAL[size]}px, as the key is scaled (got {x['fontPx']})")
    x = find(layout, "KC_8")
    check(x is not None and x["altgr"] == "" and x["shifted"] == "(", f"{tag}: KC_8 in a combo keeps the two-legend diagonal (the fold takes the corner)")
    x = find(layout, "KC_Q")
    check(x is not None and x["altgr"] == "@" and x["shifted"] == "", f"{tag}: layout Q shows base and @")
    x = find(layout, "LCTL_T(KC_2)")
    check(x is not None and x["altgr"] == "" and x["shifted"] == '"', f"{tag}: mod-tap 2 (in a combo, so it has a fold) keeps the two-legend diagonal (got {x and x['altgr']!r})")
    ralt = page.locator(f'{LAYOUT} [data-keycap][data-keycode="RALT(KC_7)"]').first
    check(ralt.count() > 0 and ralt.locator("[data-dual-legend]").count() == 0 and "{" in ralt.inner_text() and "7" not in ralt.inner_text(),
          f"{tag}: RALT(KC_7) shows the AltGr character alone, not 7 (drew {ralt.inner_text()!r})")
    for x in m:
        k = f"{tag} {x['where']} {x['code']}"
        check(x["allIn"], f"{k}: glyphs whole inside the key ({x['keyPx']}px key)")
        check(not x["overlap"], f"{k}: the glyphs do not overlap")
        check(not x["hits"], f"{k}: glyphs clear of bands and folds ({x['hits']})")
        check(x["sameFont"] and x["sameColor"] and x["noTransform"], f"{k}: one size, one color, drawn as written")
        check(x["sColor"] == x["keyColor"], f"{k}: the key's own legend color")
        if x["where"] == "layout" and x["kind"] == "plain":
            check(abs(x["fontPx"] - NOMINAL[size] * x["keyPx"] / KEYPX[size]) < 0.2, f"{k}: font {x['fontPx']}px is the full {NOMINAL[size]}px, as the key is scaled")
        if x["where"].startswith("picker"):
            check(x["contrast"] >= 4.5, f"{k}: contrast {x['contrast']:.2f} >= 4.5")
    s = summary.setdefault(f"german/{size}", {"three": set(), "two": set(), "fontPx": set()})
    for x in layout:
        (s["three"] if x["n"] == 3 else s["two"]).add(x["code"])
        s["fontPx"].add(x["fontPx"])
    shoot(page, f"german-on-{size}-{position}-{theme}")
    # With the picker's CTRL on every picker key gets a band: three legends stay only where they fit.
    ctrl = page.get_by_role("button", name="CTRL", exact=True).first
    if ctrl.is_visible():
        ctrl.click()
        page.wait_for_timeout(300)
        for x in [y for y in page.evaluate(MEASURE_JS) if y["where"] == "picker"]:
            k = f"{tag} picker+ctrl {x['code']}"
            check(x["allIn"] and not x["overlap"] and not x["hits"], f"{k}: glyphs whole, apart, clear of the band ({x['hits']})")
            check(x["sameFont"] and x["sameColor"], f"{k}: one size, one color")
            s.setdefault("ctrlLegends", set()).add(x["n"])
        page.get_by_role("button", name="None", exact=True).first.click()
    context.close()

    tag = f"german-off/{size}/{position}/{theme}"
    context, page = open_case(browser, url, size, position, theme, query=GERMAN + "&altgrLegends=off")
    check(page.locator('[data-legend="altgr"]').count() == 0, f"{tag}: no AltGr legend anywhere")
    check(page.locator("[data-dual-legend]").count() > 0, f"{tag}: Shifted Key Symbols still draw")
    ralt = page.locator(f'{LAYOUT} [data-keycap][data-keycode="RALT(KC_7)"]').first
    check("7" in ralt.inner_text() and "{" not in ralt.inner_text(), f"{tag}: RALT(KC_7) draws its base key")
    q = page.locator(f'{LAYOUT} [data-keycap][data-keycode="KC_Q"]').first
    check(q.locator("[data-dual-legend]").count() == 0, f"{tag}: Q keeps one legend")
    context.close()


def run_toggle(browser, url):
    """Settings > Appearance and editing: the AltGr symbols row only with an AltGr layout; it turns the legends on and off."""
    for lang, shown in (("", False), (GERMAN, True)):
        tag = f"toggle/{lang or 'us'}"
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, reduced_motion="reduce")
        context.add_init_script(settings_init("default", "sidebar"))
        page = context.new_page()
        page.goto(f"{url}?fakeBoard=legends&panel=settings{lang}")
        wait_connected(page)
        page.locator("[data-settings-section='appearance']").wait_for(timeout=20000)
        head = page.locator("[data-settings-section='appearance'] [aria-expanded]").first
        if head.get_attribute("aria-expanded") != "true":
            head.click()
        page.wait_for_timeout(300)
        row = page.get_by_role("group", name="AltGr symbols")
        check((row.count() == 1) == shown, f"{tag}: the AltGr symbols row is {'shown' if shown else 'hidden'}")
        if shown:
            check(page.locator('[data-legend="altgr"]').count() == 0, f"{tag}: off by default, no AltGr legend")
            row.get_by_role("button", name="ON", exact=True).click()
            page.wait_for_timeout(500)
            check(page.locator('[data-legend="altgr"]').count() > 0, f"{tag}: on, AltGr legends show")
            row.get_by_role("button", name="OFF", exact=True).click()
            page.wait_for_timeout(500)
            check(page.locator('[data-legend="altgr"]').count() == 0, f"{tag}: off again, they go")
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
    # The picker's R SHIFT: binds right Shift plus the key.
    context, page = open_case(browser, url, "default", position, "light")
    picker = page.locator("[data-fitted-keyboard]:visible").first
    page.locator(f'{LAYOUT} [data-keycap][data-keycode="KC_E"]:visible').first.click()
    picker.locator('[data-picker-key="{shiftright}"]').first.click()
    page.wait_for_timeout(400)
    bind_from_picker(page, "KC_R", "1")
    codes = layout_codes(page)
    check(any(c and c.startswith("RSFT(") and "KC_1" in c for c in codes), f"{tag}: with picker R SHIFT on, the 1 key binds right Shift+1 ({[c for c in codes if c and 'KC_1' in c]})")
    context.close()
    # Caps Lock binds Caps Lock and leaves the picker as it is: 1 still shows both legends, binds KC_1.
    context, page = open_case(browser, url, "default", position, "light")
    picker = page.locator("[data-fitted-keyboard]:visible").first
    one = picker.locator('[data-picker-key="1"]').first
    page.locator(f'{LAYOUT} [data-keycap][data-keycode="KC_E"]:visible').first.click()
    picker.locator('[data-picker-key="{capslock}"]').first.click()
    page.wait_for_timeout(400)
    check(one.locator("[data-dual-legend]").count() == 1, f"{tag}: after Caps Lock, 1 still shows both legends")
    bind_from_picker(page, "KC_R", "1")
    check("KC_1" in layout_codes(page) and "KC_EXLM" not in layout_codes(page), f"{tag}: after Caps Lock, the 1 key binds KC_1")
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
                        run_german(browser, url, size, position, theme, summary)
            run_toggle(browser, url)
        finally:
            browser.close()
    for k, v in sorted(summary.items()):
        print(k, json.dumps(v, default=lambda s: sorted(s)))
    if SHOTS:
        with open(os.path.join(SHOTS, "summary.json"), "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=1, default=lambda s: sorted(s))
    print(f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
