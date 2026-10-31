"""
Browser tests of Touchpad tuning (svalboard/qmk "Touchpad tuning" and
"Touchpad touch": VIA values 55-57, GET_INFO byte 20 bits 5 and 6) against the
simulated Svalboard, whose two pads play scripted touches through a model of
the chip's tap and press-and-hold rules. Run with
`npm run test:e2e:touchpad-tuning`.

  1. Settings entry: ?panel=touchpad and ?panel=settings&section=touchpad open
     Settings at Touchpad tuning, beside Hardware, with the dead zone 0.8 mm,
     tap time 150 ms, hold time 300 ms and the build's scroll start 1.05 mm.
  2. Dialog entry: Pointing Devices has "Tune touchpad…" in its Touchpad
     section (and no tuning values of its own); it opens the same view in a
     dialog, as ?panel=pointing&tune=touchpad does; Escape closes it.
  3. Both pads show live: a touch shows within about 100 ms of touch-down,
     and each touch that ends is listed with what it did.
  4. The dead zone writes and saves (0.8 -> 0.5 mm, VIA 55), the board's
     setting follows, and the rolling tap is then listed as canceled; back to
     0.8 mm it taps again. Tap time and hold time write 56 and 54.
  5. The layouts: ?tuneLayout=a and b draw a timer ring, c a timeline.
  6. Not shown: no touchpad (?fakeBoard), or firmware without the setting
     (?fakeBoard=old): no Touchpad chip or card, no link.
  7. No animation beyond the live finger and timer; layout: no sideways
     overflow at 390 and 1440 px, light and dark, ink unlike the page.

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. SHOT_DIR=path saves
screenshots. Needs Python Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

TITLE = "Touchpad tuning"
LINK = "Tune touchpad…"


def open_page(browser, url: str, query: str, board="fakeBoard=touchpad", viewport=(1440, 1000), scheme="light"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&{query}&theme={scheme}")
    wait_connected(page)
    return context, page, errors


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def view(page: Page):
    return page.locator("[data-touchpad-tuning]").first


def step_value(page: Page, label: str) -> str:
    return page.locator(f"[data-step='{label}'] [data-step-value]").first.inner_text()


def flow_settings(browser, url):
    for query in ("panel=touchpad", "panel=settings&section=touchpad"):
        context, page, errors = open_page(browser, url, query)
        expect(page.get_by_role("heading", name=TITLE)).to_be_visible(timeout=15000)
        expect(view(page)).to_be_visible(timeout=5000)
        chips = page.get_by_role("navigation", name="Settings sections").get_by_role("button").all_inner_texts()
        assert chips[:2] == ["Hardware", "Touchpad"], chips
        for label, want in (("Dead zone", "0.8 mm"), ("Tap time", "150 ms"), ("Hold time", "300 ms"), ("Scroll start", "1.05 mm")):
            assert step_value(page, label) == want, f"{query}: {label} {step_value(page, label)}"
        assert not errors, errors
        context.close()


def flow_dialog(browser, url):
    context, page, errors = open_page(browser, url, "panel=pointing")
    link = page.get_by_role("button", name=LINK)
    expect(link).to_be_visible(timeout=15000)
    assert page.locator("[data-step]").count() == 0, "Pointing Devices shows tuning controls"
    for name in ("Dead Zone (0.01 mm)", "Tap Time (ms)", "Scroll Start (0.01 mm)"):
        assert page.get_by_text(name).count() == 0, f"{name} shown in Pointing Devices"
    link.click()
    dialog = page.get_by_role("dialog", name=TITLE)
    expect(dialog).to_be_visible(timeout=5000)
    expect(dialog.locator("[data-step='Dead zone']")).to_be_visible()
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden(timeout=5000)
    context.close()
    context, page, errors2 = open_page(browser, url, "panel=pointing&tune=touchpad")
    expect(page.get_by_role("dialog", name=TITLE)).to_be_visible(timeout=15000)
    assert not errors and not errors2, errors + errors2
    context.close()


LATENCY_JS = """() => {
    // Touch-down time from the board's own clock: a read that first shows a
    // finger down says how long it has been down. Then when the finger shows.
    const f = window.keybardFakeBoard.device.firmware;
    const page = f.touchPage.bind(f);
    window.__lat = [];
    let downAt = null;
    f.touchPage = (out) => {
        page(out);
        const down = (out[14] & 2) !== 0, ms = out[24] | (out[25] << 8);
        if (down && downAt === null) downAt = performance.now() - ms;
        if (!down) downAt = null;
    };
    const target = document.querySelector("[data-pad='left'] [data-pad-svg]");
    let shown = false;
    new MutationObserver(() => {
        const now = !!target.querySelector("[data-finger]");
        if (now && !shown && downAt !== null) window.__lat.push(performance.now() - downAt);
        shown = now;
    }).observe(target, { subtree: true, childList: true });
}"""


def flow_live(browser, url):
    context, page, errors = open_page(browser, url, "panel=touchpad")
    expect(page.locator("[data-pad='left'] [data-pad-svg]")).to_be_visible(timeout=15000)
    expect(page.locator("[data-pad='right'] [data-pad-svg]")).to_be_visible()
    page.evaluate(LATENCY_JS)
    page.wait_for_function("window.__lat.length >= 4", timeout=30000)
    lat = page.evaluate("window.__lat")
    # The page reads every 90 ms while the pads rest, every 30 ms while busy; a frame to draw.
    assert max(lat) <= 130 and sum(lat) / len(lat) <= 100, f"touch-down to screen, ms: {[round(x) for x in lat]}"
    for side in ("left", "right"):
        page.locator(f"[data-pad='{side}'] [data-outcome]").first.wait_for(timeout=15000)
    kinds = page.locator("[data-outcome]").evaluate_all("els => els.map(e => e.dataset.outcome)")
    assert set(kinds) & {"tap", "hold", "right", "canceled", "late"}, kinds
    assert not errors, errors
    context.close()
    print(f"     touch-down to screen: {', '.join(str(round(x)) for x in lat)} ms")


def press_slider(page: Page, label: str, key: str, times: int):
    slider = page.get_by_role("slider", name=label)
    slider.focus()
    for _ in range(times):
        slider.press(key)


def saves_after(page: Page, vid: int) -> int:
    return page.evaluate(f"""(() => {{
        const sent = window.keybardFakeBoard.device.sent.map(r => Array.from(r));
        const via = sent.filter(r => r[0] === 0xdd && r[5] === 0xfe);
        let last = -1; via.forEach((r, i) => {{ if (r[6] === 0x07 && r[8] === {vid}) last = i; }});
        return last < 0 ? 0 : via.slice(last + 1).filter(r => r[6] === 0x09).length;
    }})()""")


def flow_dead_zone(browser, url):
    context, page, errors = open_page(browser, url, "panel=touchpad")
    expect(page.locator("[data-step='Dead zone']")).to_be_visible(timeout=15000)
    press_slider(page, "Dead zone", "ArrowLeft", 3)  # 0.8 -> 0.7 -> 0.6 -> 0.5
    page.wait_for_function("window.keybardFakeBoard.device.firmware.padTuning.deadZone === 50", timeout=5000)
    page.wait_for_timeout(300)
    assert saves_after(page, 55) >= 1, "dead zone not saved"
    assert step_value(page, "Dead zone") == "0.5 mm"
    # The rolling tap (0.6 mm at the lift) is now canceled.
    page.locator("[data-pad] [data-outcome='canceled']", has_text="moved 0.6").first.wait_for(timeout=15000)
    press_slider(page, "Dead zone", "ArrowRight", 3)
    page.wait_for_function("window.keybardFakeBoard.device.firmware.padTuning.deadZone === 80", timeout=5000)
    press_slider(page, "Tap time", "ArrowRight", 1)
    page.wait_for_function("window.keybardFakeBoard.device.firmware.padTuning.tapMs === 175", timeout=5000)
    press_slider(page, "Hold time", "ArrowRight", 1)
    page.wait_for_function("((window.keybardFakeBoard.device.firmware.padSetting >> 3) & 15) === 7", timeout=5000)  # 350 ms
    assert step_value(page, "Hold time") == "350 ms"
    assert not errors, errors
    context.close()


def flow_layouts(browser, url):
    for layout, timer in (("a", "data-timer-ring"), ("b", "data-timer-ring"), ("c", "data-timer-bar")):
        context, page, errors = open_page(browser, url, f"panel=pointing&tune=touchpad&tuneLayout={layout}")
        dialog = page.get_by_role("dialog", name=TITLE)
        expect(dialog).to_be_visible(timeout=15000)
        assert dialog.locator("[data-touchpad-tuning]").get_attribute("data-touchpad-tuning") == layout
        dialog.locator(f"[{timer}]").first.wait_for(timeout=15000)
        assert not errors, errors
        context.close()


def flow_hidden(browser, url):
    for board, why in (("fakeBoard", "no touchpad"), ("fakeBoard=old", "firmware without the setting")):
        context, page, errors = open_page(browser, url, "panel=settings", board=board)
        expect(page.get_by_role("navigation", name="Settings sections")).to_be_visible(timeout=15000)
        chips = page.get_by_role("navigation", name="Settings sections").get_by_role("button").all_inner_texts()
        assert "Touchpad" not in chips, f"{why}: {chips}"
        assert page.get_by_role("heading", name=TITLE).count() == 0, f"{why}: the card shows"
        context.close()
        context, page, errors2 = open_page(browser, url, "panel=pointing", board=board)
        expect(page.get_by_role("group", name="Natural Scroll", exact=True)).to_be_visible(timeout=15000)
        assert page.get_by_role("button", name=LINK).count() == 0, f"{why}: the link shows"
        assert not errors and not errors2, errors + errors2
        context.close()


def flow_no_animation(browser, url):
    context, page, _ = open_page(browser, url, "panel=touchpad")
    expect(view(page)).to_be_visible(timeout=15000)
    page.wait_for_timeout(500)
    shared = "[data-slot='slider-thumb'], [data-slot='slider-range'], [data-slot='slider-track'], [data-slot='slider']"
    bad = view(page).evaluate(f"""root => [root, ...root.querySelectorAll('*')].filter(e => {{
        const s = getComputedStyle(e);
        const trans = s.transitionDuration.split(',').some(d => parseFloat(d) !== 0) && !e.matches({shared!r});
        return s.animationName !== 'none' || trans; }}).map(e => e.tagName + ' ' + String(e.className).slice(0, 60))""")
    assert not bad, bad[:5]
    context.close()


def flow_layout_checks(browser, url):
    for width, height in ((390, 844), (1440, 1000)):
        for scheme in ("light", "dark"):
            for query in ("panel=touchpad", "panel=pointing&tune=touchpad"):
                context, page, _ = open_page(browser, url, query, viewport=(width, height), scheme=scheme)
                v = view(page)
                expect(v).to_be_visible(timeout=15000)
                over = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                box = v.bounding_box()
                assert over <= 1 and box and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, f"{query} {width}px {scheme}: overflow {over}, {box}"
                ink = page.locator("[data-step='Dead zone'] [data-step-value]").evaluate("e => getComputedStyle(e).color")
                bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
                assert ink != bg, f"ink {ink} on {bg}"
                context.close()


def shots(browser, url, out):
    os.makedirs(out, exist_ok=True)
    for layout in ("a", "b", "c"):
        for scheme in ("light", "dark"):
            for query, tag in ((f"panel=touchpad&tuneLayout={layout}", "settings"), (f"panel=pointing&tune=touchpad&tuneLayout={layout}", "dialog")):
                context, page, _ = open_page(browser, url, query, scheme=scheme)
                expect(view(page)).to_be_visible(timeout=15000)
                page.wait_for_timeout(4000)
                page.screenshot(path=os.path.join(out, f"tuning-{layout}-{tag}-{scheme}.png"))
                context.close()


def main() -> int:
    flows = [
        ("1. Settings: ?panel=touchpad and ?panel=settings&section=touchpad, defaults", flow_settings),
        ("2. Pointing Devices: Tune touchpad… opens the dialog; ?tune=touchpad too", flow_dialog),
        ("3. both pads live, touch-down shows within ~100 ms, touches listed", flow_live),
        ("4. dead zone 0.5 mm writes, saves, cancels the rolling tap; tap and hold times", flow_dead_zone),
        ("5. layouts a, b (ring) and c (timeline)", flow_layouts),
        ("6. no touchpad, or older firmware: no card, no chip, no link", flow_hidden),
        ("7. no animation beyond the live finger and timer", flow_no_animation),
        ("8. layout: 390 and 1440 px, light and dark, no overflow", flow_layout_checks),
    ]
    failed = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        print(f"Testing {url}")
        for label, flow in flows:
            started = time.time()
            try:
                flow(browser, url)
                print(f"PASS {label} ({time.time() - started:.0f} s)")
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
