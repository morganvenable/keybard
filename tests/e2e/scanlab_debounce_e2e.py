"""
Browser tests of the Scan Lab's optical debounce switch against the simulated
Svalboard (?fakeBoard). Run with `npm run test:e2e:scanlab-debounce`.

  1. ?fakeBoard&panel=scanlab opens the Scan Lab with the switch: "Debounce
     (optical keys)", checked (the board's default), with the note that the
     thumb Double Down is always debounced.
  2. Turning it off writes value 48 = 0 and saves; the box reads back off
     from the board, both halves report off, and nothing else is written.
     Turning it on again writes 1.
  3. Read back: a mode changed on the board (not through the panel) shows
     when the panel opens again.
  4. Older firmware (?fakeBoard=nopause, no STATUS byte 23): the Scan Lab
     opens, its status cards show, and the switch is not there.
  5. The switch has no transition or animation.
  6. Layout: the section fits inside the panel at phone and desktop widths,
     light and dark.

It builds the app like fake_board_e2e.py (E2E_URL and E2E_SKIP_BUILD work the
same). SHOT_DIR=path also saves screenshots of the panel, light and dark.
Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

SECTION = "[data-testid='debounce-section']"
BOX = "[data-testid='debounce-optical']"


def open_lab(browser, url: str, board: str = "fakeBoard", viewport=(1440, 900), scheme="light"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme,
                                  reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&panel=scanlab&theme={scheme}")
    wait_connected(page)
    expect(page.locator("[data-testid='status-1']")).to_contain_text("pre 90 µs · post 90 µs", timeout=15000)
    return context, page, errors


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def flow_shows(browser, url):
    context, page, errors = open_lab(browser, url)
    section = page.locator(SECTION)
    expect(section).to_be_visible()
    expect(section).to_contain_text("Debounce (optical keys)")
    expect(section).to_contain_text("The thumb Double Down is always debounced.")
    expect(page.locator(BOX)).to_be_checked()
    assert fw(page, "f.opticalDebounceOn") is True
    assert not errors, errors
    context.close()


def flow_toggle(browser, url):
    context, page, errors = open_lab(browser, url)
    custom_before = fw(page, "Array.from(f.state.custom)")
    page.locator(BOX).click()
    expect(page.locator(BOX)).not_to_be_checked()
    expect(page.get_by_text("Turning optical debounce off…")).to_have_count(0, timeout=5000)
    assert fw(page, "f.opticalDebounceOn") is False
    assert fw(page, "f.debounceWrites") == [{"value": 0, "saved": True}], fw(page, "f.debounceWrites")
    assert fw(page, "Array.from(f.state.custom)") == custom_before, "another setting was written"
    expect(page.locator(BOX)).not_to_be_checked()
    expect(page.locator("[data-testid='debounce-half-note']")).to_have_count(0)
    page.locator(BOX).click()
    expect(page.locator(BOX)).to_be_checked()
    expect(page.get_by_text("Turning optical debounce on…")).to_have_count(0, timeout=5000)
    assert fw(page, "f.opticalDebounceOn") is True
    assert fw(page, "f.debounceWrites")[-1] == {"value": 1, "saved": True}
    assert not errors, errors
    context.close()


def flow_reads_back(browser, url):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light", reduced_motion="reduce")
    page = context.new_page()
    page.goto(f"{url}?fakeBoard&theme=light&panel=about")  # Settings, open at About
    wait_connected(page)
    fw(page, "(f.opticalDebounceOn = false)")  # changed on the board, not through the panel
    page.get_by_text(re.compile("^Scan Lab")).first.click()
    expect(page.locator(BOX)).not_to_be_checked(timeout=15000)
    assert fw(page, "f.debounceWrites") == [], "opening the panel wrote the mode"
    context.close()


def flow_old_firmware(browser, url):
    context, page, errors = open_lab(browser, url, board="fakeBoard=nopause")
    expect(page.locator("[data-testid='status-0']")).to_contain_text("Revision")
    page.wait_for_timeout(500)
    expect(page.locator(SECTION)).to_have_count(0)
    expect(page.get_by_text("Debounce (optical keys)")).to_have_count(0)
    assert not errors, errors
    context.close()


def flow_no_animation(browser, url):
    context, page, errors = open_lab(browser, url)
    expect(page.locator(SECTION)).to_be_visible()
    bad = page.evaluate("""() => [...document.querySelectorAll("[data-testid='debounce-section'], [data-testid='debounce-section'] *")]
        .map(e => getComputedStyle(e)).filter(s => s.transitionDuration.split(',').some(d => parseFloat(d) !== 0)
            || s.animationDuration.split(',').some(d => parseFloat(d) !== 0) || s.animationName !== 'none')
        .map(s => s.transitionDuration + ' / ' + s.animationDuration + ' ' + s.animationName)""")
    assert not bad, bad[:5]
    context.close()


def flow_layout(browser, url):
    for width, height in ((390, 844), (1440, 900)):
        for scheme in ("light", "dark"):
            context, page, errors = open_lab(browser, url, viewport=(width, height), scheme=scheme)
            section = page.locator(SECTION)
            expect(section).to_be_visible()
            box = section.bounding_box()
            assert box and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, f"{width} {scheme}: {box}"
            assert section.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), f"the section overflows at {width}px"
            # Dark mode: the label is drawn in the theme's ink, not a fixed color.
            ink = page.evaluate("getComputedStyle(document.querySelector(\"[data-testid='debounce-section'] label\")).color")
            bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
            assert ink != bg, f"label color {ink} on {bg}"
            context.close()


def shots(browser, url, out):
    os.makedirs(out, exist_ok=True)
    for scheme in ("light", "dark"):
        for board, kind in (("fakeBoard", "switch"), ("fakeBoard=nopause", "old-firmware")):
            context, page, _ = open_lab(browser, url, board=board, scheme=scheme)
            page.wait_for_timeout(600)
            page.screenshot(path=os.path.join(out, f"scanlab-{kind}-{scheme}.png"))
            if kind == "switch":
                page.locator(SECTION).screenshot(path=os.path.join(out, f"scanlab-switch-section-on-{scheme}.png"))
                page.locator(BOX).click()
                expect(page.locator(BOX)).not_to_be_checked()
                expect(page.get_by_text("Turning optical debounce off…")).to_have_count(0, timeout=5000)
                page.locator(SECTION).screenshot(path=os.path.join(out, f"scanlab-switch-section-off-{scheme}.png"))
            context.close()
        context, page, _ = open_lab(browser, url, viewport=(390, 844), scheme=scheme)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(out, f"scanlab-switch-{scheme}-phone.png"))
        context.close()


def main() -> int:
    flows = [
        ("1. ?panel=scanlab shows the switch, on, with the Double Down note", flow_shows),
        ("2. off writes value 48 = 0 and saves, reads back off; on writes 1", flow_toggle),
        ("3. a mode changed on the board shows when the panel opens again", flow_reads_back),
        ("4. older firmware: no switch", flow_old_firmware),
        ("5. the switch has no transition or animation", flow_no_animation),
        ("6. the section fits at phone and desktop widths, light and dark", flow_layout),
    ]
    failed = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        print(f"Testing {url}")
        for label, flow in flows:
            try:
                flow(browser, url)
                print(f"PASS {label}")
            except Exception as error:  # noqa: BLE001 - report every flow
                failed += 1
                lines = str(error).strip().splitlines() or [repr(error)]
                print(f"FAIL {label}\n     {lines[0]}")
                print("     " + "\n     ".join(lines[1:12]))
        if os.environ.get("SHOT_DIR"):
            shots(browser, url, os.environ["SHOT_DIR"])
            print(f"screenshots in {os.environ['SHOT_DIR']}")
        browser.close()
    print(f"{len(flows) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
