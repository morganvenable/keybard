"""
Browser tests of the scan timing (µs only, no turbo picker) and the auto mouse
layer timeout (ms entry, up to 2000) against the simulated Svalboard
(?fakeBoard). Run with `npm run test:e2e:scan-timing`.

  1. No turbo picker anywhere: the Scan Lab (status cards, Apply timing and
     Tuning), the Pointing Devices panel and Settings show no scan speed
     preset, no "turbo" and no "explicit".
  2. ?fakeBoard=turbo6 is a board that ran turbo 6 with both waits at 0 before
     updating: the Tuning waits and the status cards show 15 / 15 µs, the
     timing the migration landed on. Changing one wait writes it, saves, reads
     both back, and nothing writes value 9.
  3. Auto mouse timeout: ?panel=pointing shows "Layer Timeout (ms)" as a number
     field. 1234 is stored as 1230, 5000 as 2000 (the clamp) and 50 as 100;
     each write is followed by a read of value 49 from the board; "No Layer
     Timeout" hides the field and keeps the time.
  4. No animation on these controls, and no transition on anything this
     change adds. (The shared Slider, Input and ON/OFF toggle keep their
     existing 0.15 s color fade on hover and focus; nothing here changes them.)
  5. Layout: the Tuning section and the auto mouse controls fit at phone and
     desktop widths, light and dark, with ink that differs from the page.
  6. The idle settings read per stage (Enter idle after, Idle scan interval,
     Enter deep idle after, Deep idle scan interval), all in ms, in Tuning and
     in Scan Lab's Power tuning. Deep idle is shown in ms and stored in whole
     seconds (2500 -> 3000, with a note). No number box cuts off 2000, 60000
     or 7200000.

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. SHOT_DIR=path saves
screenshots. Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

TUNING = "section[aria-labelledby='developer-tuning-heading']"
PRE = "Sensor settling time · µs"
POST = "Pause after sensor reading · µs"
AM = "Layer Timeout (ms)"
NO_AM = "No Layer Timeout"


def open_page(browser, url: str, board="fakeBoard", panel="scanlab", viewport=(1440, 900), scheme="light"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme,
                                  reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&panel={panel}&theme={scheme}")
    wait_connected(page)
    return context, page, errors


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def custom16(page: Page, vid: int) -> int:
    return fw(page, f"f.state.custom[{vid * 2}] | (f.state.custom[{vid * 2 + 1}] << 8)")


def number(page: Page, label: str):
    return page.get_by_role("spinbutton", name=label, exact=True)


def gets_after_last_set(page: Page, vid: int) -> int:
    """VIA custom-value GETs of vid sent after the last SET of it (wrapped report bytes 6-8)."""
    return page.evaluate(f"""(() => {{
        const sent = window.keybardFakeBoard.device.sent.map(r => Array.from(r));
        const via = sent.filter(r => r[0] === 0xdd && r[5] === 0xfe && r[7] === 0 && r[8] === {vid});
        let last = -1; via.forEach((r, i) => {{ if (r[6] === 0x07) last = i; }});
        return via.slice(last + 1).filter(r => r[6] === 0x08).length;
    }})()""")


def no_turbo_text(page: Page, where: str):
    text = page.locator("body").inner_text()
    for bad in ("Key scan speed", "Scan Speed", "turbo", "Turbo table", "explicit"):
        hits = [m.group(0) for m in re.finditer(re.escape(bad), text, re.I)]
        # The SV_TURBO_SCAN key in a key picker is a key, not a picker; no picker is open here.
        assert not hits, f"{where}: found {bad!r}"


def flow_no_turbo(browser, url):
    context, page, errors = open_page(browser, url)
    expect(page.locator(TUNING)).to_be_visible(timeout=15000)
    expect(number(page, PRE)).to_be_visible()
    no_turbo_text(page, "Scan Lab")
    assert page.get_by_role("button", name=re.compile("turbo", re.I)).count() == 0
    assert page.get_by_role("combobox", name=re.compile("scan speed|turbo", re.I)).count() == 0
    context.close()
    for panel in ("pointing", "settings"):
        context, page, errors = open_page(browser, url, panel=panel)
        page.wait_for_timeout(800)
        no_turbo_text(page, panel)
        assert not errors, errors
        context.close()


def flow_turbo6(browser, url):
    context, page, errors = open_page(browser, url, board="fakeBoard=turbo6")
    expect(page.locator("[data-testid='status-1']")).to_contain_text("pre 15 µs · post 15 µs", timeout=15000)
    expect(number(page, PRE)).to_have_value("15")
    expect(number(page, POST)).to_have_value("15")
    assert (custom16(page, 13), custom16(page, 14)) == (15, 15)
    field = number(page, PRE)
    field.fill("40")
    field.press("Enter")
    expect(field).to_have_value("40")
    page.wait_for_function("window.keybardFakeBoard.device.firmware.customWrites.some(w => w.id === 13)", timeout=5000)
    page.wait_for_timeout(400)
    assert (custom16(page, 13), custom16(page, 14)) == (40, 15), (custom16(page, 13), custom16(page, 14))
    writes = fw(page, "f.customWrites.map(w => w.id)")
    assert 9 not in writes, writes
    assert gets_after_last_set(page, 13) >= 1 and gets_after_last_set(page, 14) >= 1, "the waits were not read back"
    expect(number(page, POST)).to_have_value("15")
    assert not errors, errors
    context.close()


def flow_automouse(browser, url):
    context, page, errors = open_page(browser, url, panel="pointing")
    field = number(page, AM)
    expect(field).to_be_visible(timeout=15000)
    expect(field).to_have_value("500")
    for typed, stored in (("1234", 1230), ("5000", 2000), ("50", 100), ("2000", 2000)):
        field.fill(typed)
        field.press("Enter")
        expect(field).to_have_value(str(stored))
        page.wait_for_function(f"(window.keybardFakeBoard.device.firmware.state.custom[98] | (window.keybardFakeBoard.device.firmware.state.custom[99] << 8)) === {stored}", timeout=5000)
        page.wait_for_timeout(300)
        assert gets_after_last_set(page, 49) >= 1, f"{typed}: value 49 not read back"
    # Read back: the board's own stored value wins over what was typed.
    page.evaluate("""(() => { const f = window.keybardFakeBoard.device.firmware;
        const orig = f.receive.bind(f);
        f.receive = (r) => { const out = orig(r); if (r[0] === 0xdd && r[5] === 0xfe && r[6] === 0x07 && r[8] === 49) { f.state.custom[98] = 0x6e; f.state.custom[99] = 0x05; } return out; };
    })()""")  # the board stores 1390 whatever is sent
    field.fill("700")
    field.press("Enter")
    expect(field).to_have_value("1390", timeout=5000)
    toggle = page.get_by_role("group", name=NO_AM)
    toggle.get_by_role("button", name="ON", exact=True).click()
    expect(number(page, AM)).to_have_count(0, timeout=5000)
    page.wait_for_timeout(300)
    assert fw(page, "f.state.custom[10]") == 5, "no timeout not set (old choice 5)"
    toggle.get_by_role("button", name="OFF", exact=True).click()
    expect(number(page, AM)).to_have_value("1390", timeout=5000)
    assert not errors, errors
    context.close()


# The shared controls' own hover and focus color fades (unchanged by this work).
SHARED = "[data-slot='slider-thumb'], [data-slot='input'], [role='group'] > button, [data-slot='select-trigger']"


def no_animation(page: Page, selector: str):
    bad = page.evaluate(f"""() => [...document.querySelectorAll({selector!r})].flatMap(root => [root, ...root.querySelectorAll('*')])
        .filter(e => {{ const s = getComputedStyle(e);
            const anim = s.animationDuration.split(',').some(d => parseFloat(d) !== 0) || s.animationName !== 'none';
            const trans = s.transitionDuration.split(',').some(d => parseFloat(d) !== 0) && !e.matches({SHARED!r});
            return anim || trans; }})
        .map(e => e.tagName + ' ' + getComputedStyle(e).transitionDuration + ' / ' + getComputedStyle(e).animationName + ' ' + String(e.className).slice(0, 60))""")
    assert not bad, bad[:5]


def automouse_block(page: Page):
    # The control's own box (label, slider and field), in the sidebar or the compact bottom bar.
    return number(page, AM).locator(f"xpath=ancestor::div[.//span[normalize-space()='{AM}']][1]")


def flow_no_animation(browser, url):
    context, page, _ = open_page(browser, url)
    expect(page.locator(TUNING)).to_be_visible(timeout=15000)
    no_animation(page, TUNING)
    context.close()
    context, page, _ = open_page(browser, url, panel="pointing")
    expect(number(page, AM)).to_be_visible(timeout=15000)
    automouse_block(page).evaluate("e => e.setAttribute('data-e2e-am', '')")
    no_animation(page, "[data-e2e-am]")
    context.close()


def fits(page: Page, loc, width: int, what: str):
    box = loc.bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, f"{what} at {width}px: {box}"
    assert loc.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), f"{what} overflows at {width}px"
    ink = loc.evaluate("e => getComputedStyle(e).color")
    bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    assert ink != bg, f"{what}: ink {ink} on {bg}"


def flow_layout(browser, url):
    for width, height in ((390, 844), (1440, 900)):
        for scheme in ("light", "dark"):
            context, page, _ = open_page(browser, url, board="fakeBoard=turbo6", viewport=(width, height), scheme=scheme)
            tuning = page.locator(TUNING)
            expect(tuning).to_be_visible(timeout=15000)
            tuning.scroll_into_view_if_needed()
            fits(page, tuning, width, f"Tuning {scheme}")
            context.close()
            context, page, _ = open_page(browser, url, panel="pointing", viewport=(width, height), scheme=scheme)
            expect(number(page, AM)).to_be_visible(timeout=15000)
            number(page, AM).scroll_into_view_if_needed()
            fits(page, automouse_block(page), width, f"auto mouse {scheme}")
            context.close()


IDLE_LABELS = ["Enter idle after · ms", "Idle scan interval · ms", "Enter deep idle after · ms", "Deep idle scan interval · ms"]


def not_clipped(box, what: str):
    """The number box shows its whole value: nothing scrolled out of sight."""
    assert box.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), f"{what}: value {box.input_value()!r} is cut off"


def flow_idle_order_units(browser, url):
    for width, height in ((390, 844), (1440, 900)):
        context, page, errors = open_page(browser, url, viewport=(width, height))
        tuning = page.locator(TUNING)
        expect(tuning).to_be_visible(timeout=15000)
        boxes = [tuning.get_by_role("spinbutton", name=label, exact=True) for label in IDLE_LABELS]
        for box in boxes:
            box.scroll_into_view_if_needed()
            expect(box).to_be_visible()
        shown = tuning.evaluate("t => [...t.querySelectorAll('input[type=number]')].map(e => e.getAttribute('aria-label'))")
        assert [label for label in shown if label in IDLE_LABELS] == IDLE_LABELS, f"{width}px: idle settings out of order: {shown}"
        assert tuning.get_by_text(re.compile(r"· s$")).count() == 0, "a timing is still labeled in seconds"
        for label, box, value in ((IDLE_LABELS[0], boxes[0], "2000"), (IDLE_LABELS[1], boxes[1], "60000"), (IDLE_LABELS[3], boxes[3], "60000"), (IDLE_LABELS[2], boxes[2], "7200000")):
            box.fill(value)
            not_clipped(box, f"{width}px {label}")
        # Deep idle: shown in ms, stored in whole seconds.
        boxes[2].fill("2500")
        boxes[2].blur()
        expect(boxes[2]).to_have_value("3000")
        expect(tuning.get_by_text("Rounded to whole seconds: 3000 ms")).to_be_visible()
        page.wait_for_function("(window.keybardFakeBoard.device.firmware.state.custom[46] | (window.keybardFakeBoard.device.firmware.state.custom[47] << 8)) === 3", timeout=5000)
        # Scan Lab's own Power tuning fields: same order and units, nothing cut off.
        page.get_by_text("Power tuning").click()
        fields = page.locator("[data-testid='idle-stage-fields'] input")
        labels = [fields.nth(i).evaluate("e => e.labels[0].firstChild.textContent.trim()") for i in range(fields.count())]
        assert labels == IDLE_LABELS, labels
        deep = page.locator("#scanlab-deep-after")
        deep.fill("7200000")
        not_clipped(deep, f"{width}px Scan Lab deep idle")
        assert not errors, errors
        context.close()


def shots(browser, url, out):
    os.makedirs(out, exist_ok=True)
    for scheme in ("light", "dark"):
        context, page, _ = open_page(browser, url, board="fakeBoard=turbo6", scheme=scheme)
        expect(page.locator(TUNING)).to_be_visible(timeout=15000)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(out, f"scanlab-turbo6-{scheme}.png"))
        page.locator(TUNING).scroll_into_view_if_needed()
        page.locator(TUNING).screenshot(path=os.path.join(out, f"tuning-turbo6-{scheme}.png"))
        context.close()
        context, page, _ = open_page(browser, url, panel="pointing", scheme=scheme)
        expect(number(page, AM)).to_be_visible(timeout=15000)
        number(page, AM).scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(out, f"pointing-automouse-{scheme}.png"))
        context.close()
        context, page, _ = open_page(browser, url, panel="pointing", viewport=(390, 844), scheme=scheme)
        expect(number(page, AM)).to_be_visible(timeout=15000)
        number(page, AM).scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(out, f"pointing-automouse-{scheme}-phone.png"))
        context.close()


def main() -> int:
    flows = [
        ("1. no turbo picker in the Scan Lab, Pointing Devices or Settings", flow_no_turbo),
        ("2. a board that was on turbo 6 shows 15 / 15 µs; a wait write saves and reads back", flow_turbo6),
        ("3. auto mouse ms entry: 1234 -> 1230, 5000 -> 2000, 50 -> 100, read back, no timeout", flow_automouse),
        ("4. no animation, and no transition added", flow_no_animation),
        ("5. Tuning and auto mouse fit at phone and desktop widths, light and dark", flow_layout),
        ("6. idle settings per stage, all in ms, no number box cuts off its value", flow_idle_order_units),
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
