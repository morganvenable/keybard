"""
Browser tests of Settings > About > Board status against the simulated
Svalboard (?fakeBoard). Run with `npm run test:e2e:status-report`.

  1. About shows "Board status" after Keybard's own facts, read from the board
     (Sval 0x3F: the build text, page 1, then the state, page 0), in groups:
     Firmware, Pointing, Auto Mouse, Computer, Scanning, Power.
  2. Refresh reads the board again and shows what changed on it (Scroll Mode
     turned on by a key on the board, the computer seen as a Mac).
  3. Copy puts the same report on the clipboard as plain text.
  4. Firmware without the command (?fakeBoard=touchpad-434, ?fakeBoard=old)
     and the example layout show no Board status and send no 0x3F.
  5. Searching "board status" or "output status" finds it.
  6. At 1440 and 390 px, light and dark, in the side panel and the bottom bar:
     every value on one line (the build text may wrap on a phone), no clipped text, nothing wider than the card, no sideways page scroll.
     Saves a screenshot of each (E2E_SHOTS, default
     the system temp folder, keybard-status-report).

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Needs Python
Playwright with Chromium. Exits 1 when a check fails.
"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

ROW = "[data-board-status]"
ROWS = "[data-testid=board-status-rows]"
REQUESTS_JS = "() => window.keybardFakeBoard.device.firmware.statusRequests.map(r => r.join(':'))"
SHOTS = os.environ.get("E2E_SHOTS", os.path.join(tempfile.gettempdir(), "keybard-status-report"))
GROUPS = ["Firmware", "Pointing", "Auto Mouse", "Computer", "Scanning", "Power"]


def settings_init(position: str) -> str:
    stored = {"panel-position": position, "settings-about-open": "open"}
    return (f"(() => {{ const extra = {json.dumps(stored)}; for (const k of Object.keys(localStorage).concat(['keyboard-settings']))"
            " if (/keyboard-settings$/.test(k)) { const v = JSON.parse(localStorage.getItem(k) || '{}');"
            " Object.assign(v, extra); localStorage.setItem(k, JSON.stringify(v)); } })()")


def open_page(browser, url, board="fakeBoard", viewport=(1440, 900), scheme="light", position="sidebar", query="panel=settings"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme, reduced_motion="reduce")
    context.add_init_script(settings_init(position))
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&{query}&theme={scheme}" if board else f"{url}?{query}&theme={scheme}")
    if board:
        wait_connected(page)
    expect(page.get_by_label("Search settings")).to_be_visible(timeout=30000)
    return context, page, errors


def value(page, label):
    return page.locator(f"{ROWS} dt", has_text=re.compile(f"^{re.escape(label)}$")).first.locator("xpath=following-sibling::dd[1]").inner_text()


def flow_read(browser, url):
    context, page, errors = open_page(browser, url)
    row = page.locator(ROW)
    expect(row).to_be_visible(timeout=10000)
    expect(row.get_by_text("Board status", exact=True)).to_be_visible()
    expect(page.locator(ROWS)).to_be_visible(timeout=5000)
    for g in GROUPS:
        expect(page.locator(ROWS).get_by_role("region", name=g)).to_be_visible()
    reqs = page.evaluate(REQUESTS_JS)
    assert reqs[0] == "1:0" and reqs[-1] == "0:0", f"reads {reqs}"
    assert value(page, "Build") == "svalboard/either:sval @ x4.6.7-fake", value(page, "Build")
    assert value(page, "Detected OS") == "Windows"
    # About: Keybard's facts first, then Board status.
    order = page.evaluate("""() => { const about = document.querySelector('#settings-section-about');
        const k = about.querySelector('dl[aria-label=Keybard]'), s = about.querySelector('[data-board-status]');
        return !!(k.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); }""")
    assert order, "Board status is not after Keybard's facts"
    assert not errors, errors
    context.close()
    print("ok   read from the board, grouped, after Keybard's facts")


def flow_refresh_copy(browser, url):
    context, page, errors = open_page(browser, url)
    context.grant_permissions(["clipboard-read", "clipboard-write"])
    expect(page.locator(ROWS)).to_be_visible(timeout=10000)
    was_on = value(page, "Left Scroll Mode") == "On"
    want = "Off" if was_on else "On"
    # A Scroll Mode key on the board, and a Mac plugged in: Keybard's own cache doesn't know.
    page.evaluate(f"() => {{ const fw = window.keybardFakeBoard.device.firmware; fw.state.custom[2] = {0 if was_on else 1}; fw.hostOs = 3; }}")
    before = len(page.evaluate(REQUESTS_JS))
    page.get_by_test_id("board-status-refresh").click()
    expect(page.locator(f"{ROWS} dd", has_text="macOS")).to_be_visible(timeout=5000)
    assert value(page, "Left Scroll Mode") == want, value(page, "Left Scroll Mode")
    assert len(page.evaluate(REQUESTS_JS)) > before
    page.get_by_test_id("board-status-copy").click()
    expect(page.get_by_test_id("board-status-copy")).to_have_text("Copied", timeout=3000)
    text = page.evaluate("() => navigator.clipboard.readText()").replace(chr(13), "")  # Windows clipboards use CRLF
    assert text.startswith("Svalboard status\n\nFirmware\nBuild: svalboard/either:sval @ x4.6.7-fake"), text[:120]
    assert "Detected OS: macOS" in text and f"Left Scroll Mode: {want}" in text, text
    for g in GROUPS:
        assert f"\n{g}\n" in text, f"no {g} heading in the copy"
    assert not errors, errors
    context.close()
    print("ok   Refresh shows the board's changes; Copy is the same report as plain text")


def flow_not_shown(browser, url):
    for board in ("fakeBoard=touchpad-434", "fakeBoard=old"):
        context, page, errors = open_page(browser, url, board=board)
        expect(page.locator("#settings-section-about")).to_be_visible()
        page.wait_for_timeout(500)
        assert page.locator(ROW).count() == 0, f"{board}: shown"
        assert page.evaluate(REQUESTS_JS) == [], f"{board}: sent 0x3F"
        assert not errors, errors
        context.close()
    context, page, errors = open_page(browser, url, board="", query="demo=combos&panel=settings")
    page.wait_for_timeout(500)
    assert page.locator(ROW).count() == 0, "example layout: shown"
    context.close()
    print("ok   not shown on older firmware or the example layout")


def flow_search(browser, url):
    context, page, errors = open_page(browser, url)
    search = page.get_by_label("Search settings")
    for words in ("board status", "output status"):
        search.fill(words)
        expect(page.locator(ROW)).to_be_visible(timeout=5000)
    context.close()
    print("ok   search finds it")


CLIP_JS = """(sel) => { const root = document.querySelector(sel); const box = root.getBoundingClientRect(); const bad = [];
    for (const el of root.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') bad.push('scrolls: ' + el.textContent.slice(0, 40));
        if (r.right > box.right + 1 || r.left < box.left - 1) bad.push('outside: ' + el.textContent.slice(0, 40));
        if (el.children.length === 0 && el.textContent && el.scrollWidth > el.clientWidth + 1) bad.push('clipped: ' + el.textContent.slice(0, 40));
    }
    return { bad, page: document.documentElement.scrollWidth, vw: innerWidth }; }"""


def flow_layout(browser, url):
    os.makedirs(SHOTS, exist_ok=True)
    for position in ("sidebar", "bottombar"):
        for width in (1440, 390):
            for scheme in ("light", "dark"):
                where = f"{position}-{width}-{scheme}"
                # Tall enough for the whole card in the side panel; the bottom bar keeps its own height.
                context, page, errors = open_page(browser, url, viewport=(width, 1500 if position == "sidebar" else 1000), scheme=scheme, position=position)
                row = page.locator(ROW)
                expect(page.locator(ROWS)).to_be_visible(timeout=10000)
                # Screenshots in context: the card's top, then its end.
                row.evaluate("e => e.scrollIntoView({ block: 'start' })")
                page.wait_for_timeout(200)
                page.screenshot(path=os.path.join(SHOTS, f"{where}-top.png"))
                row.evaluate("e => e.scrollIntoView({ block: 'end' })")
                page.wait_for_timeout(200)
                page.screenshot(path=os.path.join(SHOTS, f"{where}-end.png"))
                r = page.evaluate(CLIP_JS, ROW)
                assert not r["bad"], f"{where}: {r['bad'][:5]}"
                assert r["page"] <= r["vw"] + 1, f"{where}: page scrolls sideways"
                # One short line per value (the build text may wrap at phone width).
                tall = page.evaluate("""(sel) => [...document.querySelectorAll(sel + ' dd')].filter(d => {
                    const lh = parseFloat(getComputedStyle(d).lineHeight); return d.getBoundingClientRect().height > lh * 1.5; })
                    .map(d => d.previousElementSibling.textContent)""", ROWS)
                assert [t for t in tall if t != "Build"] == [], f"{where}: values wrap: {tall}"
                # The buttons sit inside the card and never overlap the label.
                b = page.evaluate("""(sel) => { const r = document.querySelector(sel), box = r.getBoundingClientRect();
                    const label = [...r.querySelectorAll('span')].find(s => s.textContent === 'Board status').getBoundingClientRect();
                    return [...r.querySelectorAll('button')].map(x => { const q = x.getBoundingClientRect();
                        return q.left >= box.left - 1 && q.right <= box.right + 1 &&
                            (q.left >= label.right || q.top >= label.bottom || q.bottom <= label.top); }); }""", ROW)
                assert all(b) and len(b) == 2, f"{where}: buttons outside the card or over the label {b}"
                assert not errors, errors
                context.close()
    print(f"ok   no clipped text at 1440 and 390, light and dark, side panel and bottom bar ({SHOTS})")


def main():
    failures = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for flow in (flow_read, flow_refresh_copy, flow_not_shown, flow_search, flow_layout):
                try:
                    flow(browser, url)
                except Exception as e:  # noqa: BLE001
                    failures += 1
                    print(f"FAIL {flow.__name__}: {e}")
        finally:
            browser.close()
    print("all status report flows pass" if not failures else f"{failures} flows failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
