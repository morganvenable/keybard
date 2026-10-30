"""
Browser tests of importing a layout whose settings changed shape between
firmware releases, against the simulated Svalboard (?fakeBoard), which runs
x4.3-style firmware: scan timing in µs only, the auto mouse timeout in ms.
Run with `npm run test:e2e:import-settings`.

  1. An x4.2-style layout (turbo preset 6 with both waits 0, auto mouse
     choice 1 = 300 ms) imports with no warning: the review shows "The
     following settings in this layout have been replaced by:", a line per
     setting and "Release details available at" the x4.3 release page, as
     information (no warning color). Applying writes 15 / 15 µs and 300 ms
     to the board, with the timeout on, and nothing writes value 5 or 9.
  2. Infinite (choice 5) lands as No Layer Timeout on.
  3. A setting this firmware doesn't have shows one calm line, "aren't
     available on this firmware", with its menu label under Details, and no
     internal id, "not supported" or "didn't fit" anywhere.
  4. Layout: the review fits at phone and desktop widths, light and dark.

The layout files are synthetic, written by this script. E2E_URL and
E2E_SKIP_BUILD work as in fake_board_e2e.py. Needs Python Playwright with
Chromium. Exits 1 when a check fails.
"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

RELEASE_URL = "https://github.com/svalboard/qmk/releases/tag/x4.3"
# The simulated board's SVAL_KEYBOARD_UID, as a .svil stores it (a decimal integer).
UID = int("4829f621f27d181b", 16)
ROWS, COLS = 10, 6

OLD_MENUS = [{"label": "Pointing Device", "content": [
    {"label": "Auto Mouse", "content": [
        {"label": "Enable Auto Mouse", "type": "toggle", "content": ["id_automouse_enable", 0, 4]},
        {"showIf": "{id_automouse_enable} == 1", "content": [
            {"label": "Layer Timeout", "type": "dropdown",
             "options": ["200 ms", "300 ms", "400 ms", "500 ms", "800 ms", "Infinite"],
             "content": ["id_automouse_timeout", 0, 5]}]}]},
    {"label": "Advanced", "content": [
        {"label": "Scan Speed", "type": "dropdown", "options": ["0", "1", "2", "3", "4", "5", "6"],
         "content": ["id_turbo_scan", 0, 9]},
        {"label": "Scan Pre-wait (us, 0 = auto)", "type": "range", "options": [0, 1000],
         "content": ["id_scan_prewait_us", 0, 13]},
        {"label": "Scan Post-wait (us, 0 = auto)", "type": "range", "options": [0, 1000],
         "content": ["id_scan_postwait_us", 0, 14]}]}]},
    {"label": "Lights", "content": [{"label": "Sparkle", "type": "toggle", "content": ["id_sparkle", 0, 60]}]}]


def svil(custom_values):
    """A minimal .svil: one layer of KC_NO and the given custom values."""
    return json.dumps({
        "version": 1, "uid": UID, "svil_protocol": 3, "via_protocol": 13,
        "layout": [[["KC_NO"] * COLS for _ in range(ROWS)]],
        "menus": OLD_MENUS, "custom_values": custom_values,
    })


def cv(key, vid, data):
    return {"key": key, "channel": 0, "valueId": vid, "data": data}


def write_file(name, text):
    path = os.path.join(tempfile.mkdtemp(prefix="kb-import-"), name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def open_page(browser, url, viewport=(1440, 900), scheme="light"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme,
                                  reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?fakeBoard&panel=settings&theme={scheme}")
    wait_connected(page)
    return context, page, errors


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def custom16(page: Page, vid: int) -> int:
    return fw(page, f"f.state.custom[{vid * 2}] | (f.state.custom[{vid * 2 + 1}] << 8)")


def review(page: Page, path: str):
    page.locator("input[type=file][accept*='.svil']").first.set_input_files(path)
    dialog = page.get_by_role("dialog", name="Review layout import")
    expect(dialog).to_be_visible(timeout=15000)
    return dialog


def no_scary_text(text: str, where: str):
    for bad in ("Review before applying", "didn't fit", "not supported", "will be skipped", "Cannot import", "id_"):
        assert bad not in text, f"{where}: found {bad!r}"


def apply(page: Page, dialog):
    dialog.get_by_role("button", name="Apply import").click()
    expect(dialog).to_have_count(0, timeout=20000)
    page.wait_for_timeout(800)


def flow_replaced(browser, url):
    context, page, errors = open_page(browser, url)
    fw(page, "(f.customWrites.length = 0, 0)")
    path = write_file("x42-layout.svil", svil([
        cv("id_turbo_scan", 9, [6]), cv("id_scan_prewait_us", 13, [0, 0]), cv("id_scan_postwait_us", 14, [0, 0]),
        cv("id_automouse_timeout", 5, [1])]))
    dialog = review(page, path)
    text = dialog.inner_text()
    no_scary_text(text, "x4.2 import")
    assert "aren't available" not in text and "isn't available" not in text, "x4.2 import: an unavailable note"
    note = dialog.get_by_test_id("settings-replaced")
    expect(note).to_contain_text("The following settings in this layout have been replaced by:")
    items = [t.strip() for t in note.get_by_role("listitem").all_inner_texts()]
    assert items == ["Scan speed (preset 6) → Scan wait before / after read (15 / 15 µs)",
                     "Auto mouse timeout (300 ms choice) → Auto mouse timeout: 300 ms"], items
    expect(note).to_contain_text(f"Release details available at {RELEASE_URL}")
    link = note.get_by_role("link", name=RELEASE_URL)
    expect(link).to_have_attribute("href", RELEASE_URL)
    expect(link).to_have_attribute("target", "_blank")
    # Information, not a warning: the neutral note box, no warning colors.
    cls = note.get_attribute("class") or ""
    assert "warn" not in cls and "red" not in cls, cls
    apply(page, dialog)
    assert (custom16(page, 13), custom16(page, 14)) == (15, 15), (custom16(page, 13), custom16(page, 14))
    assert custom16(page, 49) == 300, custom16(page, 49)
    assert fw(page, "f.state.custom[10]") != 5, "the timeout was turned off"
    writes = fw(page, "f.customWrites.map(w => w.id)")
    assert 9 not in writes and 5 not in writes, writes
    assert {13, 14, 49}.issubset(set(writes)), writes
    assert not errors, errors
    context.close()


def flow_infinite(browser, url):
    context, page, errors = open_page(browser, url)
    dialog = review(page, write_file("x42-infinite.svil", svil([cv("id_automouse_timeout", 5, [5])])))
    no_scary_text(dialog.inner_text(), "Infinite import")
    expect(dialog.get_by_test_id("settings-replaced").get_by_role("listitem")).to_have_text(
        ["Auto mouse timeout (Infinite choice) → No layer timeout: on"])
    apply(page, dialog)
    assert fw(page, "f.state.custom[10]") == 5, "No Layer Timeout not on"
    assert not errors, errors
    context.close()


def flow_unavailable(browser, url):
    context, page, errors = open_page(browser, url)
    dialog = review(page, write_file("unknown-setting.svil", svil([cv("id_sparkle", 60, [1])])))
    text = dialog.inner_text()
    no_scary_text(text, "unknown setting")
    note = dialog.get_by_test_id("settings-unavailable")
    expect(note).to_contain_text("One setting in this layout isn't available on this firmware, so it will be left unchanged.")
    expect(dialog.get_by_test_id("settings-replaced")).to_have_count(0)
    summary = note.locator("summary")
    expect(summary).to_have_text("Details")
    expect(note.get_by_text("Lights: Sparkle")).to_be_hidden()
    summary.click()
    expect(note.get_by_text("Lights: Sparkle")).to_be_visible()
    apply(page, dialog)
    assert not errors, errors
    context.close()


def flow_layout(browser, url):
    for scheme in ("light", "dark"):
        for viewport in ((390, 844), (1440, 900)):
            context, page, errors = open_page(browser, url, viewport=viewport, scheme=scheme)
            dialog = review(page, write_file("both.svil", svil([cv("id_turbo_scan", 9, [3]), cv("id_sparkle", 60, [1])])))
            for tid in ("settings-replaced", "settings-unavailable"):
                box = dialog.get_by_test_id(tid)
                box.scroll_into_view_if_needed()
                fits = box.evaluate("e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && e.scrollWidth <= e.clientWidth + 1; }")
                assert fits, f"{scheme} {viewport[0]}px: {tid} overflows"
                ink = box.evaluate("e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]")
                assert ink[0] != ink[1], f"{scheme} {viewport[0]}px: {tid} ink matches its background"
            assert not errors, errors
            context.close()


def main() -> int:
    flows = [
        ("1. x4.2 layout on x4.3: no warning, replacement note with the x4.3 link, values applied", flow_replaced),
        ("2. Infinite becomes No Layer Timeout", flow_infinite),
        ("3. a setting with no counterpart: one calm line, its name under Details", flow_unavailable),
        ("4. the notes fit at phone and desktop widths, light and dark", flow_layout),
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
        browser.close()
    print(f"{len(flows) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
