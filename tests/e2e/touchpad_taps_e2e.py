"""
Browser tests of the touchpad tap setting (svalboard/qmk "Touchpad taps": VIA
values 51-54, GET_INFO byte 20 bit 4) in the Tune touchpad modal, against the
simulated Svalboard. Run with `npm run test:e2e:touchpad-taps`.

The taps, hold, dead zone, scroll start and palm rejection live in the Tune
touchpad modal, opened from the touchpad card in Pointing Devices (the rail or
the tray) or from Settings > Hardware.

  1. ?fakeBoard=touchpad-gestures (an Azoteq pad on each half, on built-in
     gestures): the modal has Tap to Click, Two-Finger Tap to Right Click and
     Press and Hold to Drag, all on, and Hold Time 300 ms.
  2. Each switch writes its value and saves; the board's setting follows, and
     turning it back on returns the board to the defaults.
  3. Hold Time steps to 350 ms and writes; Press and Hold off grays it out
     (still shown, unusable), and on enables it again.
  4. A board without a touchpad (?fakeBoard) and firmware without the setting
     (?fakeBoard=old) have no Tune touchpad button and no tap settings.
  5. The bottom tray: its touchpad card opens the same modal with the switches,
     and closing it returns to the tray.
  6. No animation or transition added; the settings fit at phone and desktop
     widths, light and dark, with ink that differs from the page.

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. SHOT_DIR=path saves
screenshots. Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

TAP = "Tap to Click"
TWO = "Two-Finger Tap to Right Click"
HOLD = "Press and Hold to Drag"
HOLD_MS = "Hold Time"
DIALOG = "[data-touchpad-tuning-dialog]"


def open_page(browser, url: str, board="fakeBoard=touchpad-gestures", viewport=(1440, 900), scheme="light", bottom_bar=False, tune=True):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme,
                                  reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    extra = "&panelPosition=bottombar" if bottom_bar else ""
    page.goto(f"{url}?{board}&panel=pointing&theme={scheme}{extra}")
    wait_connected(page)
    if tune:
        # Open it the way a person does: the touchpad card's button.
        page.locator("[data-tuner=touchpad]").first.click()
        expect(page.locator(DIALOG)).to_be_visible(timeout=15000)
    return context, page, errors


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def toggle(page: Page, label: str):
    return page.locator(DIALOG).get_by_role("group", name=label, exact=True)


def is_on(page: Page, label: str) -> bool:
    return toggle(page, label).get_by_role("button", name="ON", exact=True).get_attribute("aria-pressed") == "true"


def hold_value(page: Page) -> str:
    return page.locator(f"{DIALOG} [data-step='{HOLD_MS}'] [data-step-value]").inner_text()


def saves_after(page: Page, vid: int) -> int:
    """VIA id_custom_save requests sent after the last SET of vid."""
    return page.evaluate(f"""(() => {{
        const sent = window.keybardFakeBoard.device.sent.map(r => Array.from(r));
        const via = sent.filter(r => r[0] === 0xdd && r[5] === 0xfe);
        let last = -1; via.forEach((r, i) => {{ if (r[6] === 0x07 && r[8] === {vid}) last = i; }});
        return last < 0 ? 0 : via.slice(last + 1).filter(r => r[6] === 0x09).length;
    }})()""")


def section(page: Page):
    return page.locator("[data-touchpad-settings]")


def flow_defaults(browser, url):
    context, page, errors = open_page(browser, url)
    expect(toggle(page, TAP)).to_be_visible(timeout=15000)
    for label in (TAP, TWO, HOLD):
        assert is_on(page, label), f"{label} is not on"
    assert hold_value(page) == "300 ms", hold_value(page)
    assert fw(page, "f.padSetting") == 0
    assert not errors, errors
    context.close()


def flow_switches(browser, url):
    context, page, errors = open_page(browser, url)
    expect(toggle(page, TAP)).to_be_visible(timeout=15000)
    for label, vid, bit in ((TAP, 51, 1), (TWO, 52, 2), (HOLD, 53, 4)):
        toggle(page, label).get_by_role("button", name="OFF", exact=True).click()
        page.wait_for_function(f"(window.keybardFakeBoard.device.firmware.padSetting & {bit}) !== 0", timeout=5000)
        page.wait_for_function(f"window.keybardFakeBoard.device.firmware.customWrites.some(w => w.id === {vid} && w.value[0] === 0)", timeout=5000)
        page.wait_for_timeout(300)
        assert saves_after(page, vid) >= 1, f"{label}: not saved"
        assert not is_on(page, label)
        toggle(page, label).get_by_role("button", name="ON", exact=True).click()
        page.wait_for_function(f"(window.keybardFakeBoard.device.firmware.padSetting & {bit}) === 0", timeout=5000)
    assert fw(page, "f.padSetting") == 0, "the defaults are not back"
    assert not errors, errors
    context.close()


def flow_hold_time(browser, url):
    context, page, errors = open_page(browser, url)
    slider = page.locator(DIALOG).get_by_role("slider", name=HOLD_MS)
    expect(slider).to_be_visible(timeout=15000)
    slider.focus()
    slider.press("ArrowRight")
    page.wait_for_function("((window.keybardFakeBoard.device.firmware.padSetting >> 3) & 15) === 7", timeout=5000)  # 350 ms
    assert hold_value(page) == "350 ms", hold_value(page)
    toggle(page, HOLD).get_by_role("button", name="OFF", exact=True).click()
    page.wait_for_function("(window.keybardFakeBoard.device.firmware.padSetting & 4) !== 0", timeout=5000)
    row = page.locator(f"{DIALOG} [data-step='{HOLD_MS}']")
    assert row.get_attribute("data-disabled") is not None, "Hold Time is not grayed out with Press and Hold off"
    assert hold_value(page) == "350 ms", "still shown"
    toggle(page, HOLD).get_by_role("button", name="ON", exact=True).click()
    page.wait_for_function("(window.keybardFakeBoard.device.firmware.padSetting & 4) === 0", timeout=5000)
    assert row.get_attribute("data-disabled") is None, "Hold Time stays disabled with Press and Hold on"
    assert not errors, errors
    context.close()


def flow_hidden(browser, url):
    for board, why in (("fakeBoard", "no touchpad"), ("fakeBoard=old", "firmware without the setting")):
        context, page, errors = open_page(browser, url, board=board, tune=False)
        expect(page.locator("[data-shared], [data-no-module]").first).to_be_visible(timeout=15000)
        assert page.locator("[data-tuner=touchpad]").count() == 0, f"{why}: a Tune touchpad button is shown"
        page.goto(f"{url}?{board}&panel=pointing&tune=touchpad")
        wait_connected(page)
        page.wait_for_timeout(800)
        assert toggle(page, TAP).count() == 0, f"{why}: Tap to Click is shown"
        assert section(page).count() == 0, f"{why}: tap settings are shown"
        assert not errors, errors
        context.close()


def flow_tray(browser, url):
    context, page, errors = open_page(browser, url, bottom_bar=True)
    assert page.locator("[data-pointing-tray] [data-tuner=touchpad]").count() == 2, "the tray's touchpad card has no tuner (one per touchpad hand)"
    expect(toggle(page, TAP)).to_be_visible(timeout=15000)
    expect(toggle(page, HOLD)).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.locator(DIALOG)).to_be_hidden(timeout=5000)
    assert page.locator("[data-pointing-tray]").is_visible(), "closing the modal did not return to the tray"
    assert not errors, errors
    context.close()


def flow_no_animation(browser, url):
    context, page, _ = open_page(browser, url)
    expect(toggle(page, TAP)).to_be_visible(timeout=15000)
    # The shared ON/OFF toggle, slider, number field and dropdown keep their existing hover fades.
    shared = "[data-slot='slider-thumb'], [data-slot='input'], [data-slot='select-trigger'], [role='group'] > button"
    bad = section(page).evaluate(f"""root => [root, ...root.querySelectorAll('*')].filter(e => {{
        const s = getComputedStyle(e);
        const anim = s.animationName !== 'none';
        const trans = s.transitionDuration.split(',').some(d => parseFloat(d) !== 0) && !e.matches({shared!r});
        return anim || trans; }}).map(e => e.tagName + ' ' + String(e.className).slice(0, 60))""")
    assert not bad, bad[:5]
    context.close()


def flow_layout(browser, url):
    # One-line layout check: the settings fit inside the viewport, light and dark.
    for width, height in ((390, 844), (1440, 900)):
        for scheme in ("light", "dark"):
            context, page, _ = open_page(browser, url, viewport=(width, height), scheme=scheme)
            expect(toggle(page, TAP)).to_be_visible(timeout=15000)
            sec = section(page)
            sec.scroll_into_view_if_needed()
            box = sec.bounding_box()
            assert box and box["x"] >= 0 and box["x"] + box["width"] <= width + 1 and sec.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), f"tap settings at {width}px {scheme}: {box}"
            ink = sec.locator("h3").first.evaluate("e => getComputedStyle(e).color")
            bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
            assert ink != bg, f"heading ink {ink} on {bg}"
            context.close()


def shots(browser, url, out):
    os.makedirs(out, exist_ok=True)
    for scheme in ("light", "dark"):
        for width, height, tag in ((1440, 900, ""), (390, 844, "-phone")):
            context, page, _ = open_page(browser, url, viewport=(width, height), scheme=scheme)
            expect(toggle(page, TAP)).to_be_visible(timeout=15000)
            section(page).scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            page.screenshot(path=os.path.join(out, f"touchpad-taps-{scheme}{tag}.png"))
            context.close()
        context, page, _ = open_page(browser, url, scheme=scheme, bottom_bar=True)
        expect(toggle(page, TAP)).to_be_visible(timeout=15000)
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(out, f"touchpad-taps-{scheme}-bottombar.png"))
        context.close()


def main() -> int:
    flows = [
        ("1. touchpad board: three switches on, hold 300 ms", flow_defaults),
        ("2. each switch writes, saves, and back on is the defaults", flow_switches),
        ("3. hold time steps to 350, grayed out with press and hold off", flow_hold_time),
        ("4. no touchpad, or older firmware: no tuner, no tap settings", flow_hidden),
        ("5. the tray's touchpad card opens the same modal and returns to the tray", flow_tray),
        ("6. no animation added", flow_no_animation),
        ("7. layout: fits at phone and desktop, light and dark", flow_layout),
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
