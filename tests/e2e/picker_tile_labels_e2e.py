"""
Browser check: no picker key tile clips its label. Every tile in every picker
(Special Keys with More keys open, Mouse Keys, Layer Keys, More, Standard Keys)
is rendered at each key size the app uses (Normal 60px, Medium 45px, Small
30px), and every glyph of every label is measured against its tile. A label
fails when any glyph lies outside the tile, or when a line break falls inside a
word. Run with `npm run test:e2e:tile-labels`.

  E2E_URL / E2E_SKIP_BUILD work as in fake_board_e2e.py.
  TILE_SIZES=small,medium,default and TILE_THEMES=light,dark choose the runs.
  SHOTS_DIR=<dir> also saves a screenshot of each picker panel per size and theme.
  TILE_REPORT=<file> writes every clipped label as JSON.

Needs Python Playwright with Chromium. Exits 1 when any label clips.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

PANELS = ["special", "mouse", "layers", "more", "keyboard"]
SIZES = os.environ.get("TILE_SIZES", "small,medium,default").split(",")
THEMES = os.environ.get("TILE_THEMES", "light").split(",")
SHOTS = os.environ.get("SHOTS_DIR")

# Every picker tile outside the keyboard canvas: each text glyph must lie inside the tile's
# padding box, and a line may only break between words.
MEASURE_JS = r"""
() => {
  const panel = document.querySelector('aside[data-placement]') || document.body;
  const caps = [...panel.querySelectorAll('[data-keycap]')].filter(el =>
    !el.closest('[aria-label="Keyboard canvas"]') && el.getClientRects().length > 0);
  const bad = [], short = [];
  for (const cap of caps) {
    const sh = cap.querySelector('[data-tile-label="short"]');
    if (sh) short.push({ name: cap.getAttribute('title') || '', shown: [...sh.querySelectorAll('span > span')].map(l => l.textContent).join(' / ') });
    const box = cap.getBoundingClientRect();
    const cs = getComputedStyle(cap);
    const inner = {
      l: box.left + parseFloat(cs.borderLeftWidth) - 0.5,
      r: box.right - parseFloat(cs.borderRightWidth) + 0.5,
      t: box.top + parseFloat(cs.borderTopWidth) - 0.5,
      b: box.bottom - parseFloat(cs.borderBottomWidth) + 0.5,
    };
    const walker = document.createTreeWalker(cap, NodeFilter.SHOW_TEXT);
    let reason = null, text = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.textContent;
      text += s + ' ';
      let prev = null;
      for (let i = 0; i < s.length; i++) {
        if (/\s/.test(s[i])) { prev = null; continue; }
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + 1);
        const rect = r.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        // A glyph's box is the font's whole ascent and descent, taller than its ink: allow a
        // quarter of the font size above and below.
        const slack = 0.25 * parseFloat(getComputedStyle(n.parentElement).fontSize);
        if (rect.left < inner.l || rect.right > inner.r || rect.top < inner.t - slack || rect.bottom > inner.b + slack) {
          reason = reason || 'outside';
        }
        // Two letters of one word on different lines: a break inside a word.
        if (prev && /[\p{L}\p{N}]/u.test(s[i]) && /[\p{L}\p{N}]/u.test(s[i - 1]) && rect.top > prev.bottom - 1) {
          reason = reason || 'mid-word break';
        }
        prev = rect;
      }
    }
    if (cap.querySelector('[data-tile-label="broken"]')) reason = reason || 'broken word';
    if (reason) bad.push({
      keycode: cap.getAttribute('title') || '',
      text: text.trim().replace(/\s+/g, ' '),
      shown: cap.innerText.replace(/\s+/g, ' / ').trim(),
      reason,
    });
  }
  return { tiles: caps.length, bad, short };
}
"""


def open_panel(page, url, panel):
    q = "?fakeBoard"
    q += "&panel=keyboard" if panel == "keyboard" else f"&panel={panel}"
    if panel == "special" or panel == "mouse" or panel == "more" or panel == "layers":
        q += "&moreKeys"
    page.goto(url + q)
    wait_connected(page)
    page.wait_for_timeout(1200)


def main():
    report = []
    total_bad = 0
    total_tiles = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for theme in THEMES:
            for size in SIZES:
                ctx = browser.new_context(viewport={"width": 1500, "height": 4400 if SHOTS else 950}, color_scheme=theme, reduced_motion="reduce")
                prefs = json.dumps({"theme": theme, "key-size": size, "panel-position": "sidebar"})
                ctx.add_init_script(f"try {{ localStorage.setItem('keyboard-settings', {json.dumps(prefs)}); }} catch {{}}")
                page = ctx.new_page()
                for panel in PANELS:
                    open_panel(page, url, panel)
                    res = page.evaluate(MEASURE_JS)
                    total_tiles += res["tiles"]
                    total_bad += len(res["bad"])
                    print(f"{theme:5} {size:7} {panel:9} tiles={res['tiles']:4} clipped={len(res['bad'])}")
                    for sh in res["short"]:
                        print(f"    short           {sh['name']!r} -> {sh['shown']!r}")
                    for b in res["bad"]:
                        print(f"    {b['reason']:15} {b['keycode']:24} {b['text']!r}")
                        report.append({"theme": theme, "size": size, "panel": panel, **b})
                    if SHOTS:
                        os.makedirs(SHOTS, exist_ok=True)
                        side = page.locator("aside[data-placement]").first
                        target = side if side.count() else page
                        target.screenshot(path=os.path.join(SHOTS, f"{panel}-{size}-{theme}.png"))
                ctx.close()
        browser.close()
    if os.environ.get("TILE_REPORT"):
        with open(os.environ["TILE_REPORT"], "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
    print(f"{total_tiles} tiles measured, {total_bad} clipped")
    sys.exit(1 if total_bad else 0)


if __name__ == "__main__":
    main()
