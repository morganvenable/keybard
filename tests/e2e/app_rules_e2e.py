"""
Browser flow of the App Layers panel (app rules) against the simulated Svalboard (?fakeBoard, firmware
with GET_INFO byte 22 bit 0 and the 0x40/0x41 commands). Headless, 1440 x 900, light and dark.
Run with `npm run test:e2e:app-rules`.

  1. ?panel=app-layers opens the App Layers panel, "0 of 64 max", with More marked on the rail
     (App Layers has no rail item of its own). More lists Overrides, Alt-Repeat and App Layers, and
     its App Layers entry opens the panel again; ?panel=app-rules (the older name) opens it too.
  2. Add a rule, type notepad.exe: the label follows the app.
  3. Pick a default layer and a front layer; set one pill on and one off.
  4. After the debounce, one BEGIN/WRITE/COMMIT lands on the board with that rule.
  4b. Website: a second rule for https://cad.onshape.com/documents is kept as onshape.com (13-byte
     label), with the note and hint; the board holds site:onshape.com's ID and the site as label.
  5. Reload (the board keeps its settings): the rules read back from the board, the second as Website.
  6. Bottom bar: the section shows there too.
  6b. Bottom bar: More lists App Layers too.
  7. Older firmware (?fakeBoard=old): More lists Overrides and Alt-Repeat, no App Layers; no editor.

With E2E_SHOTS=<dir>, saves editor-<theme>.png (sidebar), website-<theme>.png and editor-bottombar-<theme>.png.
E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Exits 1 when a check fails.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

SHOTS = os.environ.get("E2E_SHOTS")
FW = "window.keybardFakeBoard.device.firmware"
NOTEPAD_ID = 0xB884A32C
ONSHAPE_ID = 0xB2AF5B45  # site:onshape.com


def main() -> int:
    failures: list[str] = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for theme in ("light", "dark"):
            context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce",
                                          color_scheme=theme)
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"{url}?fakeBoard&theme={theme}&panel=app-layers")
            wait_connected(page)
            section = page.locator("[data-app-rules]")
            expect(section).to_be_visible(timeout=20000)

            # 1.
            check(page.get_by_test_id("app-rules-count").inner_text() == "0 of 64 max", f"{theme}: empty list, 64 max")
            check(page.locator("[data-app-layers-panel]").count() == 1, f"{theme}: in the App Layers panel")
            more = page.get_by_role("button", name="More", exact=True)
            check(page.get_by_role("button", name="App Layers", exact=True).count() == 0, f"{theme}: no App Layers rail item")
            check(more.get_attribute("aria-pressed") == "true", f"{theme}: More marked on the rail")
            more.click()
            tools = page.locator("[data-more-tool]")
            expect(tools.first).to_be_visible()
            names = tools.evaluate_all("es => es.map(e => e.dataset.moreTool)")
            check(names == ["overrides", "altrepeat", "app-layers"], f"{theme}: More lists {names}")
            if SHOTS:
                page.screenshot(path=os.path.join(SHOTS, f"more-{theme}.png"), clip={"x": 0, "y": 0, "width": 760, "height": 900})
            page.locator("[data-more-tool='app-layers']").click()
            expect(section).to_be_visible()
            check(page.locator("[data-app-layers-panel]").count() == 1 and more.get_attribute("aria-pressed") == "true",
                  f"{theme}: More's App Layers opens the panel, More still marked")
            page.goto(f"{url}?fakeBoard&theme={theme}&panel=app-rules")
            wait_connected(page)
            expect(section).to_be_visible(timeout=20000)
            check(page.locator("[data-app-layers-panel]").count() == 1, f"{theme}: ?panel=app-rules opens App Layers")

            # 2.
            section.get_by_role("button", name="Add rule").click()
            rule = section.locator("[data-app-rule='0']")
            expect(rule).to_be_visible()
            rule.get_by_test_id("app-rule-key").fill("notepad.exe")
            check(rule.get_by_test_id("app-rule-label").input_value() == "notepad.exe", f"{theme}: label follows the app")
            names = (rule.get_by_text("Turn on layer").count(), rule.get_by_text("Other layers while the app is in front").count(),
                     rule.get_by_text("Front layer").count())
            check(names[0] >= 1 and names[1] == 1 and names[2] == 0, f"{theme}: plain labels {names}")

            # 3.
            rule.get_by_test_id("app-rule-default").select_option("1")
            rule.get_by_test_id("app-rule-front").select_option("2")
            pills = rule.locator("[data-app-rule-pills]")
            on, off = pills.locator("[data-layer='3']"), pills.locator("[data-layer='4']")
            on.click()
            off.click(); off.click()
            check(on.get_attribute("data-state") == "on", f"{theme}: layer 3 pill on")
            check(off.get_attribute("data-state") == "off", f"{theme}: layer 4 pill off")
            deco = off.locator("span").evaluate("e => getComputedStyle(e).textDecorationLine")
            check("line-through" in deco, f"{theme}: an off layer is struck through")

            # 4.
            page.wait_for_function(f"{FW}.state.appRules[1] === 1 && {FW}.appRulesOps.includes(4)", timeout=5000)
            ops = page.evaluate(f"{FW}.appRulesOps")
            check(ops.count(3) == 1 and ops.count(4) == 1, f"{theme}: one BEGIN and one COMMIT for the burst ({ops!r})")
            rec = page.evaluate(f"Array.from({FW}.state.appRules.slice(0, 28))")
            app = rec[4] | (rec[5] << 8) | (rec[6] << 16) | (rec[7] << 24)
            check(app == NOTEPAD_ID, f"{theme}: the board holds notepad.exe's ID ({app:#x})")
            check(rec[8] == 1 and rec[9] == 2, f"{theme}: default layer 1, front layer 2 ({rec[8]}, {rec[9]})")
            check((rec[10] | rec[11] << 8) == 1 << 3 and (rec[12] | rec[13] << 8) == 1 << 4, f"{theme}: on mask layer 3, off mask layer 4")
            page.mouse.move(0, 0)
            if SHOTS:
                section.scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                section.screenshot(path=os.path.join(SHOTS, f"editor-{theme}.png"))
                page.screenshot(path=os.path.join(SHOTS, f"editor-page-{theme}.png"))

            # 4b.
            section.get_by_role("button", name="Add rule").click()
            site_rule = section.locator("[data-app-rule='1']")
            expect(site_rule).to_be_visible()
            site_rule.get_by_test_id("app-rule-kind").select_option("site")
            check(site_rule.get_by_test_id("app-rule-pick").count() == 0, f"{theme}: no running-app picker for a website")
            site_rule.get_by_test_id("app-rule-site").fill("https://cad.onshape.com/documents")
            check(site_rule.get_by_test_id("app-rule-label").input_value() == "onshape.com", f"{theme}: website label is the site, shortened to fit")
            check(site_rule.get_by_test_id("app-rule-label").get_attribute("readonly") is not None, f"{theme}: website label is read-only")
            hint = site_rule.get_by_test_id("app-rule-site-hint").inner_text()
            check("Kept as onshape.com" in hint and "Matches onshape.com and every address under it" in hint, f"{theme}: website note and hint ({hint!r})")
            site_rule.get_by_test_id("app-rule-front").select_option("3")
            page.wait_for_function(f"{FW}.state.appRules[1] === 2 && {FW}.state.appRules[33] === 3", timeout=5000)
            rec = page.evaluate(f"Array.from({FW}.state.appRules.slice(28, 52))")
            sid = rec[0] | (rec[1] << 8) | (rec[2] << 16) | (rec[3] << 24)
            label = bytes(rec[11:24]).split(b"\0", 1)[0].decode()
            check(sid == ONSHAPE_ID and label == "onshape.com", f"{theme}: the board holds site:onshape.com ({sid:#x}, {label!r})")
            page.mouse.move(0, 0)
            if SHOTS:
                site_rule.scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                site_rule.screenshot(path=os.path.join(SHOTS, f"website-{theme}.png"))

            # 5.
            page.reload()
            wait_connected(page)
            expect(section).to_be_visible(timeout=20000)
            rule = section.locator("[data-app-rule='0']")
            expect(rule).to_be_visible()
            check(rule.get_by_test_id("app-rule-key").input_value() == "notepad.exe", f"{theme}: app read back")
            check(rule.get_by_test_id("app-rule-default").input_value() == "1", f"{theme}: default layer read back")
            check(rule.get_by_test_id("app-rule-front").input_value() == "2", f"{theme}: front layer read back")
            states = rule.locator("[data-app-rule-pills] [data-layer]").evaluate_all("es => es.map(e => e.dataset.state)")
            check(states[3] == "on" and states[4] == "off" and states.count("neutral") == len(states) - 2,
                  f"{theme}: pills read back ({states!r})")
            site_rule = section.locator("[data-app-rule='1']")
            check(site_rule.get_by_test_id("app-rule-kind").input_value() == "site", f"{theme}: website rule read back as Website")
            check(site_rule.get_by_test_id("app-rule-site").input_value() == "onshape.com", f"{theme}: site read back from the label")

            # 6.
            page.goto(f"{url}?fakeBoard&theme={theme}&panel=app-layers&panelPosition=bottombar")
            wait_connected(page)
            expect(section).to_be_visible(timeout=20000)
            check(section.locator("[data-app-rule='0']").count() == 1, f"{theme}: bottom bar shows the rule")
            check(section.locator("[data-app-rule='1'] [data-testid='app-rule-site']").count() == 1, f"{theme}: bottom bar shows the website rule")
            if SHOTS:
                section.scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                page.screenshot(path=os.path.join(SHOTS, f"editor-bottombar-{theme}.png"))
            # 6b.
            page.get_by_role("button", name="More", exact=True).click()
            expect(page.locator("[data-more-tool='app-layers']")).to_be_visible()
            check(page.locator("[data-more-tool]").count() == 3, f"{theme}: bottom bar More lists the three editors")
            if SHOTS:
                page.wait_for_timeout(200)
                page.screenshot(path=os.path.join(SHOTS, f"more-bottombar-{theme}.png"))
            check(not errors, f"{theme}: no page errors {errors}")
            context.close()

        # 7.
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{url}?fakeBoard=old&panel=layers")
        wait_connected(page)
        page.wait_for_timeout(2500)
        check(page.locator("[data-app-rules]").count() == 0, "older firmware: no App Layers editor in Layer Keys")
        check(page.get_by_role("button", name="App Layers", exact=True).count() == 0, "older firmware: no App Layers rail item")
        page.get_by_role("button", name="More", exact=True).click()
        expect(page.locator("[data-more-tool]").first).to_be_visible()
        names = page.locator("[data-more-tool]").evaluate_all("es => es.map(e => e.dataset.moreTool)")
        check(names == ["overrides", "altrepeat"], f"older firmware: More lists {names}, no App Layers")
        context.close()
        browser.close()

    print(f"\n{len(failures)} failed" if failures else "\nall passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
