"""
Browser tests of the touchpad tuning dialog's Prototype group (dev firmware
only: the dev protocol 0xFC, op 0x42) against the simulated Svalboard. Run
with `npm run test:e2e:touchpad-prototype`.

  1. Release firmware (?fakeBoard=touchpad): Keybard asks, the board answers
     with a wrapper error frame, and no Prototype group shows.
  2. Dev firmware (?fakeBoard=touchpad-dev): the group shows the board's
     state, read back when the dialog opens.
  7. Frame (sniper and boost value 3, supported bit 4): Boost to Frame sends
     [3,1,0,0,3,0] and reads back; without bit 4 Frame is disabled unless in use.
  3. Sniper to Scaling sends one set with all four values, and the UI shows
     the reply; a value the board refuses says so and keeps the board's value;
     an option the board doesn't support is disabled.
  4. A stored surface that differs from the active one shows a restart as
     pending.
  5. Large: the set, then the restart; the board drops off USB, the group
     says "Reconnect to apply"; Reconnect brings it back with Large active.
  6. Layout: visible, not clipped, no sideways overflow, text contrast at
     least 4.5:1 (390 and 1440 px, light and dark).

E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Needs Python
Playwright with Chromium. Exits 1 when a check fails.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import Page, expect, sync_playwright  # noqa: E402

TUNE = "panel=pointing&tune=touchpad"
DEV = "fakeBoard=touchpad-dev"
RELEASE = "fakeBoard=touchpad"
GROUP = "[data-ptp-prototype]"


def open_page(browser, url, board, query=TUNE, viewport=(1440, 1000), scheme="light"):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, color_scheme=scheme, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?{board}&{query}&theme={scheme}")
    wait_connected(page)
    if "tune=" in query:
        expect(page.get_by_role("dialog", name="Touchpad tuning")).to_be_visible(timeout=15000)
    return context, page, errors


def checked(page: Page, control: str) -> str:
    return page.locator(f"{GROUP} [data-proto-control='{control}'] [role=radio][aria-checked=true]").inner_text()


def radio(page: Page, control: str, label: str):
    return page.locator(f"{GROUP} [data-proto-control='{control}']").get_by_role("radio", name=label)


def requests(page: Page):
    return page.evaluate("window.keybardFakeBoard.device.firmware.protoRequests")


def flow_hidden(browser, url):
    context, page, errors = open_page(browser, url, RELEASE)
    page.locator("[data-touchpad-tuning]").wait_for(timeout=15000)
    page.wait_for_timeout(1500)
    asked = page.evaluate("window.keybardFakeBoard.device.sent.some(r => r[0] === 0xdd && r[5] === 0xfc && r[6] === 0x42)")
    assert asked, "Keybard never asked the board"
    expect(page.locator(GROUP)).to_have_count(0)
    assert not errors, errors
    context.close()


def flow_read_back(browser, url):
    # The board's state set before the dialog opens (the simulated config isn't saved across loads).
    context, page, errors = open_page(browser, url, DEV, query="panel=pointing")
    page.evaluate("Object.assign(window.keybardFakeBoard.device.firmware.proto, {scroll: 1, sniper: 1, boost: 2})")
    page.get_by_role("button", name="Tune touchpad…").click()
    expect(page.get_by_role("dialog", name="Touchpad tuning")).to_be_visible(timeout=15000)
    expect(page.locator(GROUP)).to_be_visible(timeout=5000)
    expect(page.locator(f"{GROUP} h3")).to_have_text("Prototype")
    assert checked(page, "scroll") == "Takeover", checked(page, "scroll")
    assert checked(page, "sniper") == "Takeover", checked(page, "sniper")
    assert checked(page, "boost") == "Scaling", checked(page, "boost")
    assert checked(page, "surface") == "Standard", checked(page, "surface")
    expect(page.locator("[data-surface-active='0']")).to_be_visible()
    expect(page.locator("[data-reboot-pending]")).to_have_count(0)
    assert not errors, errors
    context.close()


def flow_sniper_scaling(browser, url):
    context, page, errors = open_page(browser, url, DEV)
    expect(page.locator(GROUP)).to_be_visible(timeout=15000)
    assert checked(page, "sniper") == "Off"
    before = len(requests(page))
    radio(page, "sniper", "Scaling").click()
    expect(radio(page, "sniper", "Scaling")).to_have_attribute("aria-checked", "true", timeout=3000)
    sets = [r for r in requests(page)[before:] if r[:2] == [3, 1]]
    assert sets == [[3, 1, 0, 2, 0, 0]], sets
    assert page.evaluate("window.keybardFakeBoard.device.firmware.proto.sniper") == 2
    # The board stops supporting scaling: its refusal shows, and the board's value stays.
    page.evaluate("window.keybardFakeBoard.device.firmware.protoSupported = 0x1b")
    radio(page, "boost", "Scaling").click()
    expect(page.locator("[data-proto-error]")).to_have_text("The board didn't take that.", timeout=3000)
    assert checked(page, "boost") == "Off", checked(page, "boost")
    # The reply carried the new mask: Scaling is now disabled for boost (not in use), still shown for sniper (in use).
    expect(radio(page, "boost", "Scaling")).to_be_disabled()
    expect(radio(page, "sniper", "Scaling")).to_be_enabled()
    assert not errors, errors
    context.close()


def flow_frame(browser, url):
    context, page, errors = open_page(browser, url, DEV)
    expect(page.locator(GROUP)).to_be_visible(timeout=15000)
    for control in ("sniper", "boost"):
        labels = page.locator(f"{GROUP} [data-proto-control='{control}'] [role=radio]").all_inner_texts()
        assert labels == ["Off", "Takeover", "Scaling", "Frame"], labels
    before = len(requests(page))
    radio(page, "boost", "Frame").click()
    expect(radio(page, "boost", "Frame")).to_have_attribute("aria-checked", "true", timeout=3000)
    sets = [r for r in requests(page)[before:] if r[:2] == [3, 1]]
    assert sets == [[3, 1, 0, 0, 3, 0]], sets
    assert page.evaluate("window.keybardFakeBoard.device.firmware.proto.boost") == 3
    context.close()
    # Read back on a fresh open; then older dev firmware (bit 4 clear) disables Frame where it isn't in use.
    context, page, errors2 = open_page(browser, url, DEV, query="panel=pointing")
    page.evaluate("Object.assign(window.keybardFakeBoard.device.firmware.proto, {boost: 3}); window.keybardFakeBoard.device.firmware.protoSupported = 0x0f")
    page.get_by_role("button", name="Tune touchpad…").click()
    expect(page.locator(GROUP)).to_be_visible(timeout=15000)
    assert checked(page, "boost") == "Frame", checked(page, "boost")
    expect(radio(page, "sniper", "Frame")).to_be_disabled()
    expect(radio(page, "boost", "Takeover")).to_be_enabled()
    assert not errors and not errors2, errors + errors2
    context.close()


def flow_pending(browser, url):
    context, page, errors = open_page(browser, url, DEV, query="panel=pointing")
    page.evaluate("Object.assign(window.keybardFakeBoard.device.firmware.proto, {surface: 1, surfaceActive: 0})")
    page.get_by_role("button", name="Tune touchpad…").click()
    expect(page.locator(GROUP)).to_be_visible(timeout=15000)
    assert checked(page, "surface") == "Large"
    expect(page.locator("[data-reboot-pending]")).to_be_visible()
    expect(page.locator("[data-surface-active='0']")).to_have_text("Active: Standard")
    assert not errors, errors
    context.close()


def flow_large(browser, url):
    context, page, errors = open_page(browser, url, DEV)
    expect(page.locator(GROUP)).to_be_visible(timeout=15000)
    before = len(requests(page))
    radio(page, "surface", "Large").click()
    expect(page.locator("[data-reconnect]")).to_be_visible(timeout=5000)
    expect(page.locator("[data-reconnect]")).to_contain_text("Reconnect to apply")
    sent = requests(page)[before:]
    assert [3, 1, 0, 0, 0, 1] in sent and any(r[0] == 5 for r in sent), sent
    assert sent.index([3, 1, 0, 0, 0, 1]) < next(i for i, r in enumerate(sent) if r[0] == 5), sent
    expect(radio(page, "surface", "Large")).to_be_disabled()
    # Back on USB, then Reconnect.
    page.wait_for_function("window.keybardFakeBoard.device.present", timeout=5000)
    page.locator("[data-reconnect]").get_by_role("button", name="Reconnect").click()
    wait_connected(page)
    expect(page.locator("[data-surface-active='1']")).to_be_visible(timeout=15000)
    assert checked(page, "surface") == "Large"
    expect(page.locator("[data-reboot-pending]")).to_have_count(0)
    expect(page.locator("[data-reconnect]")).to_have_count(0)
    assert not errors, errors
    context.close()


LAYOUT_JS = """() => {
  const g = document.querySelector('[data-ptp-prototype]');
  const body = document.querySelector('[data-touchpad-tuning-body]');
  const gb = g.getBoundingClientRect(), bb = body.getBoundingClientRect();
  const out = []; let lowest = 99, checkedText = 0;
  for (const el of g.querySelectorAll('[data-proto-control], [role=radio]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) out.push('empty ' + el.textContent);
    if (r.left < bb.left - 0.5 || r.right > bb.right + 0.5) out.push('clipped ' + el.textContent.slice(0, 30));
  }
  if (document.documentElement.scrollWidth > window.innerWidth) out.push('page scrolls sideways');
  if (body.scrollWidth > body.clientWidth + 1) out.push('dialog scrolls sideways');
  // Any CSS color (oklch, color-mix...) to sRGB with alpha, through a canvas.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => top.slice(0, 3).map((v, i) => v * top[3] + under[i] * (1 - top[3]));
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 0.99) break; }
    let rgb = layers.length && layers[layers.length - 1][3] >= 0.99 ? layers.pop().slice(0, 3) : (matchMedia('(prefers-color-scheme: dark)').matches ? [0, 0, 0] : [255, 255, 255]);
    while (layers.length) rgb = over(layers.pop(), rgb); return rgb; };
  const lumRgb = (rgb) => { const [r, gg, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
  for (const el of g.querySelectorAll('h3, span, [role=radio]:not(:disabled)')) {
    if (!el.textContent.trim() || el.children.length && el.tagName !== 'BUTTON') continue;
    const bg = bgOf(el), fg = rgba(getComputedStyle(el).color);
    const a = lumRgb(over(fg, bg)), b = lumRgb(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    lowest = Math.min(lowest, ratio); checkedText++;
    if (ratio < 4.5) out.push(`contrast ${ratio.toFixed(2)} ${el.textContent.trim().slice(0, 30)}`);
  }
  return { out, lowest, checkedText };
}"""


def flow_layout(browser, url):
    for viewport in ((390, 844), (1440, 1000)):
        for scheme in ("light", "dark"):
            context, page, errors = open_page(browser, url, DEV, viewport=viewport, scheme=scheme)
            group = page.locator(GROUP)
            expect(group).to_be_visible(timeout=15000)
            group.scroll_into_view_if_needed()
            expect(group).to_be_in_viewport()
            result = page.evaluate(LAYOUT_JS)
            assert not result["out"], f"{viewport} {scheme}: {result['out']}"
            assert result["checkedText"] >= 10, f"only {result['checkedText']} text items checked"
            print(f"     {viewport[0]} px {scheme}: lowest text contrast {result['lowest']:.1f}:1")
            assert not errors, errors
            context.close()


def main() -> int:
    flows = [
        ("1. release firmware: asked, wrapper error, no Prototype group", flow_hidden),
        ("2. dev firmware: the group reads back the board's state", flow_read_back),
        ("3. Sniper to Scaling: one full set, the reply shown; a refusal says so; unsupported disabled", flow_sniper_scaling),
        ("7. Boost: Frame sends the set and reads back; Frame disabled without bit 4", flow_frame),
        ("4. stored surface differs from active: restart pending", flow_pending),
        ("5. Large: set, restart, Reconnect to apply, back with Large active", flow_large),
        ("6. layout: visible, not clipped, contrast (390, 1440, light and dark)", flow_layout),
    ]
    only = os.environ.get("E2E_ONLY")
    if only:
        flows = [f for f in flows if f[0].split(".")[0] in only.split(",")]
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
                print(f"FAIL {label}: {lines[0]}")
                for line in lines[1:8]:
                    print(f"     {line}")
        browser.close()
    print(f"{len(flows) - failed}/{len(flows)} flows passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
