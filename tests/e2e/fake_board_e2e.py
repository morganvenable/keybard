"""
Browser tests of Keybard against the simulated Svalboard (?fakeBoard): the
built app talks to a fake WebHID device that answers the real firmware
protocol, so Keybard's own connect, load, edit and Apply code runs. Run with
`npm run test:e2e:fake-board`.

  1. ?fakeBoard connects with no chooser: the keyboard renders as connected to
     "Simulated Svalboard", the page says it is simulated, and nothing errors.
  2. The Combos panel lists the board's seeded combos with the names the
     board stores.
  3. Edit and Apply (manual updates): rename a combo and turn another off,
     Apply; after a reload the board still has both.
  4. ?fakeBoard=old acts as firmware without combo names: it connects, the
     combos load, the board offers no combo names, and the label says so.
  5. Without the parameter nothing is simulated.

It builds the app (vite build, base /keybard-e2e/) into .e2e-dist and serves it
with vite preview. Set E2E_URL to test a server that is already running (its
full base URL, e.g. https://morganvenable.github.io/keybard-test/), and
E2E_SKIP_BUILD=1 to reuse .e2e-dist. Needs Python Playwright with Chromium:
  pip install playwright && python -m playwright install chromium
Exits 1 when a check fails.
"""
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from contextlib import contextmanager

from playwright.sync_api import Page, expect, sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_PATH = "/keybard-e2e/"
# At the repo root, not under vite's root (src/), where source scans would find it.
OUT_DIR = os.path.join(ROOT, ".e2e-dist")
NPX = shutil.which("npx") or "npx"
# The side panel editor, whatever this build's default placement is.
REVIEW = "comboEditor=panel&theme=light"


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextmanager
def app_url():
    if os.environ.get("E2E_URL"):
        yield os.environ["E2E_URL"].rstrip("/") + "/"
        return
    if not os.environ.get("E2E_SKIP_BUILD"):
        subprocess.run([NPX, "vite", "build", f"--base={BASE_PATH}", f"--outDir={OUT_DIR}", "--emptyOutDir"],
                       cwd=ROOT, check=True)
    port = free_port()
    server = subprocess.Popen(
        [NPX, "vite", "preview", f"--base={BASE_PATH}", f"--outDir={OUT_DIR}", "--host", "127.0.0.1",
         "--port", str(port), "--strictPort"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}{BASE_PATH}"
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(url, timeout=1)
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError(f"vite preview did not start at {url}")
        yield url
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


def open_board(browser, url: str, board: str = "fakeBoard"):
    """A fresh browser (so a fresh simulated board) on the app with the given ?fakeBoard value."""
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light", reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "[fake board]" in m.text else None)
    page.goto(f"{url}?{REVIEW}&{board}")
    wait_connected(page)
    return context, page, errors


def wait_connected(page: Page):
    page.locator("[data-keycap]:visible").first.wait_for(timeout=30000)
    expect(page.get_by_text("Editing keyboard: Simulated Svalboard").first).to_be_visible(timeout=30000)


def open_combos(page: Page):
    page.get_by_role("button", name="Combos", exact=True).first.click()
    expect(page.locator("[data-binding-row='0']").first).to_be_visible()


def list_name(page: Page, index: int):
    return page.locator(f"[data-combo-row='{index}'] [data-combo-row-name]")


def title(page: Page):
    return page.locator("aside.detail-panel [data-combo-editor-title]:visible").first


def open_combo(page: Page, index: int):
    page.locator(f"[data-binding-row='{index}']").first.click()
    expect(title(page)).to_be_visible()


def go_back(page: Page):
    page.locator("[data-binding-editor-back]:visible").first.click()
    expect(page.locator("[data-binding-row='0']").first).to_be_visible()


def enabled_group(page: Page):
    return page.get_by_role("group", name="Combo enabled").locator("visible=true").first


def combo_on(page: Page) -> bool:
    group = enabled_group(page)
    expect(group).to_be_visible()
    return group.get_by_role("button", name="ON", exact=True).get_attribute("aria-pressed") == "true"


def apply_button(page: Page):
    return page.get_by_role("button", name=re.compile(r"^Apply \d+ Changes?"))


def flow_connects(browser, url):
    context, page, errors = open_board(browser, url)
    badge = page.locator("[data-fake-board-badge='combo-names']")
    expect(badge).to_be_visible()
    expect(badge).to_contain_text("Simulated Svalboard")
    # Keybard's own load went through the simulated firmware
    sent = page.evaluate("window.keybardFakeBoard.device.sent.length")
    assert sent > 200, f"only {sent} reports reached the simulated board"
    page.wait_for_timeout(1500)  # the polls after a load (layer state) run without errors too
    assert not errors, errors
    context.close()


def flow_combos_listed(browser, url):
    context, page, errors = open_board(browser, url)
    open_combos(page)
    for i in range(3):
        expect(page.locator(f"[data-combo-row='{i}']").first).to_be_visible()
    expect(list_name(page, 0)).to_have_text("Quick escape")
    expect(list_name(page, 1)).to_have_count(0)
    expect(list_name(page, 2)).to_have_text("Next field")
    assert not errors, errors
    context.close()


def flow_edit_apply_reload(browser, url):
    context, page, errors = open_board(browser, url)
    manual = page.get_by_role("button", name="Switch to Manual Updates")
    if manual.count():
        manual.first.click()
    expect(page.get_by_role("button", name="No pending changes")).to_be_visible()
    open_combos(page)

    # Rename combo 1
    open_combo(page, 1)
    t = title(page)
    t.get_by_role("button", name="Name this combo").click()
    field = page.get_by_role("textbox", name="Name of Combo", exact=False)
    expect(field).to_be_focused()
    field.fill("Confirm")
    field.press("Enter")
    expect(t.get_by_role("heading", level=2)).to_have_text("Confirm")
    go_back(page)

    # Turn combo 2 off
    open_combo(page, 2)
    assert combo_on(page), "the seeded combo 2 starts on"
    enabled_group(page).get_by_role("button", name="OFF", exact=True).click()
    assert not combo_on(page)
    go_back(page)

    apply = apply_button(page)
    expect(apply).to_be_visible()
    apply.click()
    expect(page.get_by_role("button", name="No pending changes")).to_be_visible(timeout=15000)
    state = page.evaluate("""() => {
        const s = window.keybardFakeBoard.device.state;
        const name = new TextDecoder().decode(s.labels[3].slice(16, 32)).replace(/\\0+$/, '');
        return { name, term2: s.combo[2 * 12 + 10] | (s.combo[2 * 12 + 11] << 8) };
    }""")
    assert state["name"] == "Confirm", f"the board stores combo 1's name: {state}"
    assert not (state["term2"] & 0x8000), f"the board has combo 2 off: {state}"

    # The board keeps them across a reload, as a real board does
    page.reload()
    wait_connected(page)
    open_combos(page)
    expect(list_name(page, 1)).to_have_text("Confirm")
    expect(list_name(page, 0)).to_have_text("Quick escape")
    open_combo(page, 2)
    assert not combo_on(page), "combo 2 is still off after a reload"
    assert not errors, errors
    context.close()


def flow_old_firmware(browser, url):
    context, page, errors = open_board(browser, url, "fakeBoard=old")
    badge = page.locator("[data-fake-board-badge='old']")
    expect(badge).to_contain_text("firmware without combo names")
    flags2 = page.evaluate("window.keybardFakeBoard.device.firmware.featureFlags2")
    assert not (flags2 & 0x80), f"flags2 {flags2:#x} has the combo-names bit"
    open_combos(page)
    for i in range(3):
        expect(page.locator(f"[data-combo-row='{i}']").first).to_be_visible()
    # The board's stored names are not read on this firmware (this browser has none of its own)
    expect(page.locator("[data-combo-row-name]")).to_have_count(0)
    assert not errors, errors
    context.close()


def flow_off_without_param(browser, url):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="light")
    page = context.new_page()
    page.goto(f"{url}?theme=light")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    assert page.evaluate("window.keybardFakeBoard === undefined"), "the simulated board started without ?fakeBoard"
    expect(page.locator("[data-fake-board-badge]")).to_have_count(0)
    expect(page.get_by_role("button", name="Connect Keyboard")).to_be_visible()
    context.close()


def main() -> int:
    flows = [
        ("1. ?fakeBoard connects with no chooser, labeled simulated, no errors", flow_connects),
        ("2. the Combos panel lists the seeded combos and their stored names", flow_combos_listed),
        ("3. rename a combo and turn one off, Apply; both are still there after a reload", flow_edit_apply_reload),
        ("4. ?fakeBoard=old: firmware without combo names", flow_old_firmware),
        ("5. without the parameter nothing is simulated", flow_off_without_param),
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
                print(f"FAIL {label}\n     {str(error).strip().splitlines()[0] if str(error).strip() else repr(error)}")
                print("     " + "\n     ".join(str(error).strip().splitlines()[1:12]))
        browser.close()
    print(f"{len(flows) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
