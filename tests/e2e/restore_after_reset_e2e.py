"""
Browser tests of putting a layout back after the board reset its settings, against
the simulated Svalboard (?fakeBoard). A firmware update is simulated the way the page
sees a real one: the board goes away, restarts on a build whose first boot resets every
stored setting (keymap, macros, tables, QMK settings, custom values, labels) and sets the
reset notice (GET_INFO storage flags bit 2), and comes back. Run with
`npm run test:e2e:restore`.

Each flow runs with Live Updating on and off. Another permitted board is plugged in
(listed first, as on a desk with several boards) in the flows that reconnect on their own.

  1. After-update restore: the app's own firmware host takes the pre-update backup,
     waits for the reconnect, reads the storage flags, restores the backup and clears
     the notice, as the update does. The updated board's keymap and tables then equal
     the backup, and the other board is untouched.
  2. The reset dialog: after a reset with no update running in this tab, "Restore my
     layout" puts the newest backup back. The board equals the backup.
  3. Manual import after an update: the update keeps the defaults, then the backup file
     is imported (Review layout import, then Apply import, or Stage import and Apply).
     Every key and table lands on the updated board; the other board is untouched.
  4. Manual import onto a stale editor: the board resets its settings while Keybard
     still shows the old layout (no reconnect). The import still puts everything back.
  5. Read-back failure: when the board drops keymap writes, the restore writes them
     once more and then fails with a message that names the keys.

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Needs Python Playwright
with Chromium. Exits 1 when a check fails.
"""
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

# What the board stores, compared before the update and after the restore.
TABLES = ["keymap", "combo", "tapDance", "keyOverride", "altRepeatKey", "leader", "qmkSettings"]
MACRO_BYTES = 4096


def settings_init(live: bool) -> str:
    stored = {"live-updating": live, "panel-position": "sidebar"}
    return (f"(() => {{ const extra = {json.dumps(stored)}; for (const k of Object.keys(localStorage).concat(['keyboard-settings']))"
            " if (/keyboard-settings$/.test(k)) { const v = JSON.parse(localStorage.getItem(k) || '{}');"
            " Object.assign(v, extra); localStorage.setItem(k, JSON.stringify(v)); } })()")


def fw(page: Page, js: str):
    return page.evaluate(f"(() => {{ const f = window.keybardFakeBoard.device.firmware; return {js}; }})()")


def board_state(page: Page) -> dict:
    out = fw(page, "Object.fromEntries(" + json.dumps(TABLES) + ".map((k) => [k, Array.from(f.state[k])]))")
    out["macros"] = fw(page, f"Array.from(f.state.macros.subarray(0, {MACRO_BYTES}))")
    return out


def differences(want: dict, got: dict) -> dict:
    """Per table, how many entries differ (keymap in keys, the rest in bytes)."""
    out = {}
    for name, a in want.items():
        b = got[name]
        if name == "keymap":
            n = sum(1 for i in range(0, len(a), 2) if a[i:i + 2] != b[i:i + 2])
        else:
            n = sum(1 for x, y in zip(a, b) if x != y)
        if n:
            out[name] = n
    return out


# A layout far from the defaults: every key on layers 0-3 moved, and tables in use.
CUSTOMIZE = r"""(() => {
    const f = window.keybardFakeBoard.device.firmware, s = f.state;
    const keys = s.keymap.length / 2, perLayer = 60;
    for (let layer = 0; layer < 4; layer++) {
        for (let i = 0; i < perLayer; i++) {
            const at = (layer * perLayer + i) * 2;
            const code = 0x04 + ((i * 7 + layer * 5) % 0x60);   // letters, digits, punctuation
            s.keymap[at] = code >> 8; s.keymap[at + 1] = code & 0xff;
        }
    }
    // Combo 5: KC_A + KC_B -> KC_ESC, enabled, term 40
    const c = 5 * 12; [0x04, 0x05, 0, 0].forEach((k, j) => { s.combo[c + j * 2] = k & 0xff; s.combo[c + j * 2 + 1] = k >> 8; });
    s.combo[c + 8] = 0x29; s.combo[c + 9] = 0; s.combo[c + 10] = 40; s.combo[c + 11] = 0x80;
    // Tap dance 3: KC_Q / KC_W, enabled, term 250
    const t = 3 * 10; [0x14, 0x1a, 0, 0].forEach((k, j) => { s.tapDance[t + j * 2] = k & 0xff; s.tapDance[t + j * 2 + 1] = k >> 8; });
    s.tapDance[t + 8] = 250; s.tapDance[t + 9] = 0x80;
    // QMK setting: tapping term 230 (offset 24)
    s.qmkSettings[24] = 230; s.qmkSettings[25] = 0;
    f.changed();
    return keys;
})()"""


def open_page(browser, url: str, live: bool, other_board: bool = False):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light", reduced_motion="reduce",
                                  accept_downloads=True)
    context.add_init_script(settings_init(live))
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?fakeBoard&theme=light")
    wait_connected(page)
    # Start from the customer's own layout, loaded by Keybard as any board's is.
    page.evaluate(CUSTOMIZE)
    page.reload()
    wait_connected(page)
    page.wait_for_function("() => !!window.keybardFakeBoard?.firmwareHost", timeout=15000)
    if other_board:
        page.evaluate("() => { window.keybardOtherBoard = window.keybardFakeBoard.addOtherBoard(); }")
    return context, page, errors


def other_board_state(page: Page) -> list:
    return page.evaluate("() => Array.from(window.keybardOtherBoard.firmware.state.keymap)")


def board_differs_from_defaults(page: Page, want: dict):
    fresh = board_state(page)
    gone = differences(want, fresh)
    assert gone.get("keymap", 0) > 200 and gone.get("combo") and gone.get("tapDance"), f"the simulated update didn't reset the board: {gone}"


# The update's after-steps, in the order flow.ts runs them, through the real app host.
AFTER_UPDATE = r"""async ({ goneMs, dropKeys, restore }) => {
    const fb = window.keybardFakeBoard, host = fb.firmwareHost;
    const backup = await host.makeBackup({ fromTag: "x4.3", toTag: "v4.3.5" });
    const update = fb.device.simulateFirmwareUpdate({ goneMs });
    await new Promise((r) => setTimeout(r, 300));          // the restart is seen
    const t = await host.waitForDevice(60000);
    await update;
    if (!t) return { error: "the keyboard didn't come back" };
    if (dropKeys) fb.device.firmware.dropKeymapWrites = dropKeys;
    const flags = await host.readStorageFlags();
    let report = null, error = null;
    if (restore) {
        try { report = await host.restoreLayout(backup.svil); } catch (e) { error = e && e.message ? e.message : String(e); }
    }
    await host.clearStorageReset();
    return { flags, report, error, svil: backup.svil };
}"""


def after_update(page: Page, drop_keys: int = 0, restore: bool = True) -> dict:
    return page.evaluate(AFTER_UPDATE, {"goneMs": 1500, "dropKeys": drop_keys, "restore": restore})


def flow_after_update_restore(browser, url, live: bool):
    context, page, errors = open_page(browser, url, live, other_board=True)
    want = board_state(page)
    other_before = other_board_state(page)
    result = after_update(page)
    page.wait_for_timeout(500)
    problems = []
    diff = differences(want, board_state(page))
    if diff:
        problems.append(f"the updated board differs from the backup: {diff}")
    if other_board_state(page) != other_before:
        problems.append("the restore wrote to the other board")
    if not result["flags"] & 0x04:
        problems.append(f"the storage flags read after the reconnect ({result['flags']:#x}) aren't the updated board's (0x4): Keybard reconnected to another board")
    if result["error"]:
        problems.append(f"the restore failed: {result['error']}")
    if fw(page, "f.state.storageFlags") != 0:
        problems.append("the updated board's reset notice wasn't cleared")
    assert not problems, f"after-update restore (live {live}): " + "; ".join(problems)
    assert not errors, errors
    context.close()


def flow_reset_dialog(browser, url, live: bool):
    """No update in this tab: the board comes back reset, and the reset dialog offers the backup."""
    context, page, errors = open_page(browser, url, live)
    want = board_state(page)
    page.evaluate("""async () => {
        const fb = window.keybardFakeBoard;
        await fb.firmwareHost.makeBackup({ fromTag: "x4.3", toTag: "v4.3.5" });
        await fb.device.simulateFirmwareUpdate({ goneMs: 1500 });
    }""")
    # Keybard reconnects to the permitted board on its own, as after unplugging it.
    reconnect(page)
    dialog = page.get_by_role("dialog")
    button = dialog.get_by_role("button", name=re.compile("Restore my layout"))
    expect(button).to_be_visible(timeout=20000)
    button.click()
    expect(dialog).to_have_count(0, timeout=30000)
    page.wait_for_timeout(500)
    diff = differences(want, board_state(page))
    assert not diff, f"reset dialog restore (live {live}): the board differs from the backup: {diff}"
    assert fw(page, "f.state.storageFlags") == 0, "the reset notice wasn't cleared"
    assert not errors, errors
    context.close()


def reconnect(page: Page):
    """Connect to the permitted board again (the Connect screen's own button for it)."""
    page.evaluate("""async () => {
        for (let i = 0; i < 40; i++) {
            const [d] = await navigator.hid.getDevices();
            if (d && d.present !== false) break;
            await new Promise((r) => setTimeout(r, 250));
        }
    }""")
    connect = page.get_by_role("button", name=re.compile("Simulated Svalboard|Connect", re.I)).first
    if not page.get_by_text("Editing keyboard: Simulated Svalboard").first.is_visible():
        connect.click()
    wait_connected(page)


def import_file(page: Page, live: bool, svil_text: str):
    path = os.path.join(tempfile.mkdtemp(), "backup.svil")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svil_text)
    page.locator("input[type=file][accept*='.svil']").first.set_input_files(path)
    review = page.get_by_role("dialog", name="Review layout import")
    expect(review).to_be_visible(timeout=15000)
    review.get_by_role("button", name="Apply import" if live else "Stage import").click()
    expect(review).to_have_count(0, timeout=30000)
    if not live:
        apply = page.get_by_role("button", name=re.compile(r"^Apply \d+ Changes?"))
        try:
            expect(apply.first).to_be_visible(timeout=10000)
        except AssertionError:
            raise AssertionError("Stage import staged nothing to Apply") from None
        apply.first.click()
        expect(apply).to_have_count(0, timeout=30000)
    page.wait_for_timeout(3000)


def flow_manual_import(browser, url, live: bool):
    """An update that keeps the defaults, then the backup file imported by hand."""
    context, page, errors = open_page(browser, url, live, other_board=True)
    want = board_state(page)
    other_before = other_board_state(page)
    result = after_update(page, restore=False)
    assert not result.get("error"), result.get("error")
    page.wait_for_timeout(500)
    board_differs_from_defaults(page, want)
    import_file(page, live, result["svil"])
    diff = differences(want, board_state(page))
    assert not diff, f"manual import after an update (live {live}): the updated board differs from the file: {diff}"
    assert other_board_state(page) == other_before, "the import wrote to the other board"
    assert not errors, errors
    context.close()


def flow_import_stale(browser, url, live: bool):
    """The board resets while Keybard still shows the old layout; then the file is imported."""
    context, page, errors = open_page(browser, url, live)
    want = board_state(page)
    svil_text = page.evaluate("async () => (await window.keybardFakeBoard.firmwareHost.makeBackup({ fromTag: 'x4.3', toTag: 'v4.3.5' })).svil")
    fw(page, "(f.firstBootReset(0), 0)")
    board_differs_from_defaults(page, want)
    import_file(page, live, svil_text)
    diff = differences(want, board_state(page))
    assert not diff, f"import onto a stale editor (live {live}): the board differs from the file: {diff}"
    assert not errors, errors
    context.close()


def flow_read_back_failure(browser, url, live: bool):
    context, page, errors = open_page(browser, url, live)
    result = after_update(page, drop_keys=1_000_000)
    assert result["error"], "a restore whose key writes never landed reported success"
    assert re.search(r"didn't keep part of the layout: \d+ keys", result["error"]), f"the failure doesn't name the keys: {result['error']}"
    context.close()


FLOWS = {
    "after-update": flow_after_update_restore,
    "reset-dialog": flow_reset_dialog,
    "manual-import": flow_manual_import,
    "import-stale": flow_import_stale,
    "read-back-failure": flow_read_back_failure,
}


def main() -> int:
    only = set(sys.argv[1:])
    failed = 0
    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for name, flow in FLOWS.items():
                if only and name not in only:
                    continue
                for live in (True, False):
                    label = f"{name} (Live Updating {'on' if live else 'off'})"
                    try:
                        flow(browser, url, live)
                        print(f"PASS {label}")
                    except Exception as e:  # noqa: BLE001
                        failed += 1
                        print(f"FAIL {label}: {e}")
        finally:
            browser.close()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
