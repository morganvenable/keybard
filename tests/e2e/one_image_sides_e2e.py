"""
Browser tests of which half is which, on the one-image firmware, as a customer
meets it: the firmware harness's mock board (src/firmware-harness.html), no
keyboard. Run with `npm run test:e2e:sides`.

Board status (Firmware page):
  1. same: both halves right. The warning shows; "Make the other half the left
     half" fixes it in one click, and the warning goes.
  2. unknown-other / unknown-usb: "Which half is plugged into your computer?",
     the likely half first; one click fixes it.
  3. strap-same: choosing the side the thumb cluster disagrees with shows the
     explanation (status 4) and the support line; nothing is retried.
Update:
  4. migrate: a per-hand board updates to the one image; one approval; the
     result says each half kept its side.
  5. after-unknown: both come back unknown; Keybard puts them back by itself.
  6. ask / ask-same: the flow asks which half is plugged in; one click; result.
  7. strap: the flow explains a refused side, then the one-click fix works.
  8. same before the update: the sheet asks to set the sides first, then
     offers the update.
Each in light and dark, with one-line layout checks (nothing past the right
edge, no horizontal scroll, buttons on screen) and no page errors.

The harness is development only, so this starts `vite` (dev) on a free port.
Set E2E_URL to a dev server already running (e.g. http://127.0.0.1:5173/keybard/).
Set E2E_SHOTS=<dir> to save a screenshot of each state. Exits 1 when a check fails.
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
NPX = shutil.which("npx") or "npx"
SHOTS = os.environ.get("E2E_SHOTS")
SPEED = 40


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextmanager
def dev_url():
    if os.environ.get("E2E_URL"):
        yield os.environ["E2E_URL"].rstrip("/") + "/"
        return
    port = free_port()
    server = subprocess.Popen([NPX, "vite", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
                              cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/keybard/"
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(url + "firmware-harness.html", timeout=2)
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError(f"vite did not start at {url}")
        yield url
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


LAYOUT_JS = """() => {
    const doc = document.documentElement;
    const out = [];
    if (doc.scrollWidth > doc.clientWidth + 1) out.push(`page scrolls sideways (${doc.scrollWidth} > ${doc.clientWidth})`);
    for (const el of document.querySelectorAll('[data-testid="side-fix"], [data-testid="side-fix"] button, [role="dialog"], [data-testid="update-result"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 40)}" is off screen`);
    }
    return out;
}"""


class Run:
    def __init__(self, browser, url, theme, failures):
        self.browser, self.url, self.theme, self.failures = browser, url, theme, failures

    def check(self, ok, what):
        if not ok:
            self.failures.append(f"{self.theme}: {what}")

    def open(self, scenario: str, width=1280, height=900):
        context = self.browser.new_context(viewport={"width": width, "height": height}, color_scheme=self.theme, reduced_motion="reduce")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"{self.url}firmware-harness.html?fake=1&sides={scenario}&speed={SPEED}&theme={self.theme}")
        expect(page.get_by_test_id("firmware-section")).to_be_visible(timeout=30000)
        return context, page, errors

    def layout(self, page: Page, where: str):
        for problem in page.evaluate(LAYOUT_JS):
            self.check(False, f"{where}: {problem}")

    def shot(self, page: Page, name: str, locator=None):
        if not SHOTS:
            return
        os.makedirs(SHOTS, exist_ok=True)
        path = os.path.join(SHOTS, f"{name}-{self.theme}.png")
        (locator or page).screenshot(path=path)

    def close(self, context, errors, where):
        self.failures.extend(f"{self.theme}, {where}: page error: {e}" for e in errors)
        context.close()


def board_fix(r: Run, scenario: str, click, gone=True, note=None):
    context, page, errors = r.open(scenario)
    fix = page.get_by_test_id("side-fix")
    expect(fix).to_be_visible(timeout=10000)
    r.check(page.get_by_text("Set which half is which").first.is_visible(), f"{scenario}: no 'Set which half is which' heading")
    r.layout(page, scenario)
    r.shot(page, f"board-{scenario}", page.get_by_test_id("firmware-section"))
    click(page)
    if note:
        expect(page.get_by_test_id("side-note")).to_contain_text(note, timeout=15000)
        r.check("https://www.svalboard.com/discord" in page.get_by_test_id("side-note").inner_text(), f"{scenario}: the note has no support link")
        r.layout(page, f"{scenario} note")
        r.shot(page, f"board-{scenario}-note", page.get_by_test_id("firmware-section"))
    if gone:
        expect(page.get_by_test_id("side-fix")).to_have_count(0, timeout=20000)
        r.shot(page, f"board-{scenario}-fixed", page.get_by_test_id("firmware-section"))
    r.close(context, errors, scenario)


def start_update(page: Page):
    page.get_by_role("button", name=re.compile(r"^(Update to|Install) x4")).click()


def run_update(r: Run, scenario: str, answer=None, expect_note=None, result_text="Each half kept its side", ask_shot=None):
    context, page, errors = r.open(scenario)
    start_update(page)
    sheet = page.get_by_test_id("update-sheet")
    expect(sheet).to_be_visible(timeout=20000)
    start = page.get_by_role("button", name=re.compile(r"^(Start update|Update anyway)$"))
    expect(start).to_be_enabled(timeout=20000)
    if scenario == "migrate":
        r.shot(page, "sheet-migrate", page.get_by_role("dialog"))
    start.click()
    if answer:
        ask = page.get_by_test_id("flow-sides")
        expect(ask).to_be_visible(timeout=90000)
        r.check(ask.get_by_text("Which half is plugged into your computer?").is_visible() or scenario.endswith("same") or scenario == "strap", f"{scenario}: no question")
        if expect_note:
            expect(ask.get_by_test_id("side-note")).to_contain_text(expect_note)
        r.layout(page, f"{scenario} question")
        r.shot(page, ask_shot or f"flow-{scenario}", page.get_by_role("dialog"))
        answer(page.get_by_test_id("flow-sides"))
    result = page.get_by_test_id("update-result")
    expect(result).to_be_visible(timeout=120000)
    expect(page.get_by_test_id("result-sides")).to_have_text(result_text)
    r.check(page.locator("text=Halves differ").count() == 0, f"{scenario}: 'Halves differ' after the update")
    r.layout(page, f"{scenario} result")
    r.shot(page, f"result-{scenario}", page.get_by_role("dialog"))
    r.close(context, errors, scenario)


def sheet_first(r: Run):
    context, page, errors = r.open("same")
    start_update(page)
    first = page.get_by_test_id("sheet-sides")
    expect(first).to_be_visible(timeout=20000)
    r.check(first.get_by_text("Set which half is which first").is_visible(), "sheet: no 'Set which half is which first'")
    r.layout(page, "sheet first")
    r.shot(page, "sheet-sides-first", page.get_by_role("dialog"))
    first.get_by_role("button", name="Make the other half the left half").click()
    expect(page.get_by_test_id("update-sheet")).to_be_visible(timeout=30000)
    expect(page.locator('[data-check="sides"]')).to_have_attribute("data-state", "ok")
    r.close(context, errors, "sheet first")


def run(browser, url, theme, failures):
    r = Run(browser, url, theme, failures)
    steps = [
        ("same", lambda: board_fix(r, "same", lambda p: p.get_by_role("button", name="Make the other half the left half").click())),
        ("unknown-other", lambda: board_fix(r, "unknown-other", lambda p: (
            r.check(p.locator('[data-side-answer="right"]').get_attribute("class").find("kb-primary") >= 0, "unknown-other: right isn't offered first"),
            p.locator('[data-side-answer="right"]').click()))),
        ("unknown-usb", lambda: board_fix(r, "unknown-usb", lambda p: p.locator('[data-side-answer="left"]').click())),
        ("unknown-both", lambda: board_fix(r, "unknown-both", lambda p: p.locator('[data-side-answer="left"]').click())),
        ("strap-same", lambda: board_fix(r, "strap-same", lambda p: p.locator('[data-side-action="fix-usb"]').click(), gone=False, note="right thumb cluster")),
        ("migrate", lambda: run_update(r, "migrate")),
        ("after-unknown", lambda: run_update(r, "after-unknown", result_text="Each half knows its side now")),
        ("ask", lambda: run_update(r, "ask", answer=lambda p: p.locator('[data-side-answer="left"]').click(), result_text="Each half knows its side now")),
        ("ask-same", lambda: run_update(r, "ask-same", answer=lambda p: p.locator('[data-side-action="fix-other"]').click(), result_text="Each half knows its side now")),
        ("strap", lambda: run_update(r, "strap", answer=lambda p: p.locator('[data-side-action="fix-usb"]').click(), expect_note="right thumb cluster", result_text="Each half knows its side now")),
        ("sheet first", lambda: sheet_first(r)),
    ]
    only = os.environ.get("E2E_ONLY")
    for name, step in steps:
        if only and name not in only.split(","):
            continue
        try:
            step()
        except Exception as e:  # a step that could not run is a failure, not a crash
            failures.append(f"{theme}, {name}: {str(e).splitlines()[0]}")


def main() -> int:
    failures = []
    with dev_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for theme in ("light", "dark"):
            run(browser, url, theme, failures)
        browser.close()
    for f in failures:
        print("FAIL", f)
    print("one-image sides e2e:", "FAILED" if failures else "passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
