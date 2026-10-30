"""
Browser test of the leader and combo timeouts against the simulated Svalboard.
Run with `npm run test:e2e:leader-timeout`.

  1. ?fakeBoard=leader0 is a board whose settings reset (before x4.3.2) stored
     a leader timeout of 0. The Leaders panel shows 300 ms, the value the
     firmware now uses in its place. Leaving the field and applying writes 300
     to the board, never 0.
  2. Emptying the Leader Timeout field keeps the shown value, and nothing is
     written.
  3. Typing 0 in the Combo Timeout field stores its 10 ms minimum, and an
     emptied field keeps the value instead of writing 0.
  4. Layout: both fields fit their panel with no sideways scroll, in the light
     and dark themes.

Same server options as combo_editor_e2e.py (E2E_URL, E2E_SKIP_BUILD).
Exits 1 when a check fails.
"""
import os
import re
import sys

from playwright.sync_api import Page, expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_editor_e2e import app_url  # noqa: E402
from fake_board_e2e import wait_connected  # noqa: E402


def open_board(browser, url: str, board: str, scheme: str = "light"):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=scheme, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&theme={scheme}")
    wait_connected(page)
    return context, page, errors


def setting16(page: Page, offset: int) -> int:
    return page.evaluate(f"(() => {{ const q = window.keybardFakeBoard.device.state.qmkSettings; return q[{offset}] | (q[{offset + 1}] << 8); }})()")


def open_panel(page: Page, name: str):
    page.get_by_role("button", name=name, exact=True).first.click()


def apply_all(page: Page):
    button = page.get_by_role("button", name=re.compile(r"^Apply \d+ Changes?"))
    if button.count():
        button.first.click()


def no_sideways_scroll(page: Page, where: str):
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 0, f"{where}: page scrolls sideways by {overflow}px"


def flow_leader_zero(browser, url):
    context, page, errors = open_board(browser, url, "fakeBoard=leader0")
    assert setting16(page, 40) == 0, "the simulated board should start with a stored 0"
    open_panel(page, "Leaders")
    field = page.get_by_role("spinbutton", name="Leader Timeout")
    expect(field).to_have_value("300", timeout=15000)
    field.focus()
    field.blur()
    apply_all(page)
    page.wait_for_function("(() => { const q = window.keybardFakeBoard.device.state.qmkSettings; return (q[40] | (q[41] << 8)) === 300; })()", timeout=8000)
    expect(field).to_have_value("300")
    assert not errors, errors
    context.close()


def flow_leader_empty(browser, url):
    context, page, errors = open_board(browser, url, "fakeBoard")
    open_panel(page, "Leaders")
    field = page.get_by_role("spinbutton", name="Leader Timeout")
    expect(field).to_have_value("300", timeout=15000)
    writes_before = page.evaluate("window.keybardFakeBoard.device.sent.filter(r => r[0] === 0xdd && r[5] === 0xdf && r[6] === 0x12).length")
    field.fill("")
    field.blur()
    expect(field).to_have_value("300")
    apply_all(page)
    page.wait_for_timeout(600)
    writes_after = page.evaluate("window.keybardFakeBoard.device.sent.filter(r => r[0] === 0xdd && r[5] === 0xdf && r[6] === 0x12).length")
    assert writes_after == writes_before, f"{writes_after - writes_before} QMK setting writes after emptying the field"
    assert setting16(page, 40) == 300
    assert not errors, errors
    context.close()


def flow_combo_term(browser, url):
    context, page, errors = open_board(browser, url, "fakeBoard")
    open_panel(page, "Combos")
    field = page.get_by_role("spinbutton", name="Combo Timeout")
    expect(field).to_have_value("50", timeout=15000)
    field.fill("0")
    field.blur()
    expect(field).to_have_value("10")
    apply_all(page)
    page.wait_for_function("(() => { const q = window.keybardFakeBoard.device.state.qmkSettings; return (q[22] | (q[23] << 8)) === 10; })()", timeout=8000)
    field.fill("")
    field.blur()
    expect(field).to_have_value("10")
    apply_all(page)
    page.wait_for_timeout(600)
    assert setting16(page, 22) == 10, setting16(page, 22)
    assert not errors, errors
    context.close()


def flow_layout(browser, url):
    for scheme in ("light", "dark"):
        context, page, errors = open_board(browser, url, "fakeBoard=leader0", scheme)
        for panel, label in (("Leaders", "Leader Timeout"), ("Combos", "Combo Timeout")):
            open_panel(page, panel)
            field = page.get_by_role("spinbutton", name=label)
            expect(field).to_be_visible(timeout=15000)
            box = field.bounding_box()
            assert box and box["x"] + box["width"] <= 1440, f"{scheme} {panel}: field off screen"
            no_sideways_scroll(page, f"{scheme} {panel}")
        assert not errors, errors
        context.close()


def main():
    failures = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for flow in (flow_leader_zero, flow_leader_empty, flow_combo_term, flow_layout):
            try:
                flow(browser, url)
                print(f"ok   {flow.__name__}")
            except Exception as error:  # report every flow, then fail
                failures += 1
                print(f"FAIL {flow.__name__}: {error}")
        browser.close()
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
