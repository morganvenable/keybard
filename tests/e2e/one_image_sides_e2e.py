"""
Browser tests of which half is which, on the one-image firmware, as a customer
meets it: the firmware harness's mock board (src/firmware-harness.html), no
keyboard. Run with `npm run test:e2e:sides`.

Keybard never sets a side by itself: every answer leads to a confirmation
("Set the sides?") before any SET.

Board status (Firmware page):
  1. same: both halves right. "Which half is plugged into your computer?" with no
     main button (either half could be the wrong one); answer, confirm, fixed.
  2. unknown-other / unknown-usb / unknown-both: the likely half is the main
     button when Keybard can tell; answer, confirm, fixed.
  3. strap-same: choosing the side the thumb PCBA disagrees with shows the
     explanation (status 4) and the support line; nothing is retried.
Update:
  4. migrate: a per-hand board updates to the one image; one approval; the sides
     the firmware kept are shown once: "That's right", or "Swap" then confirm.
  5. after-unknown: both come back unknown; "Keep the plugged-in half as the
     right half?"; confirm; result.
  6. ask / ask-same: the flow asks which half is plugged in; answer, confirm.
  7. strap: Keybard's answer is refused (status 4): explained, asked again.
  8. same before the update: the sheet asks to set the sides first, then
     offers the update.
Each in light and dark, with one-line layout checks (nothing past the right
edge, no horizontal scroll, buttons on screen) and no page errors.

Review links: the app built as the test site builds it (?fwfake is in that
build only) lands on each state with no clicks (Settings > Firmware opens by
itself; &fwrun=1 starts the update). Each link is opened in light and dark.

The harness is development only, so this starts `vite` (dev) on a free port.
Set E2E_URL to a dev server already running (e.g. http://127.0.0.1:5173/keybard/).
Set E2E_LINK_URL to a test-site build already served, E2E_NO_HARNESS=1 or E2E_NO_LINKS=1 to skip a part.
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


def set_sides(scope):
    """The confirmation every SET goes through: it must show, then Set the sides."""
    confirm = scope.get_by_test_id("side-confirm")
    expect(confirm).to_be_visible(timeout=10000)
    confirm.locator('[data-side-action="set"]').click()


def board_fix(r: Run, scenario: str, answer: str, gone=True, note=None, primary=None):
    context, page, errors = r.open(scenario)
    fix = page.get_by_test_id("side-fix")
    expect(fix).to_be_visible(timeout=10000)
    r.check(page.get_by_text("Set which half is which").first.is_visible(), f"{scenario}: no 'Set which half is which' heading")
    for side in ("left", "right"):
        cls = fix.locator(f'[data-side-answer="{side}"]').get_attribute("class") or ""
        want = side == primary
        r.check(("bg-kb-primary" in cls) == want, f"{scenario}: {side} is {'not ' if want else ''}the main button")
    r.layout(page, scenario)
    r.shot(page, f"board-{scenario}", page.get_by_test_id("firmware-section"))
    fix.locator(f'[data-side-answer="{answer}"]').click()
    r.check(page.get_by_test_id("side-confirm").is_visible(), f"{scenario}: no confirmation before the write")
    r.layout(page, f"{scenario} confirm")
    r.shot(page, f"board-{scenario}-confirm", page.get_by_test_id("firmware-section"))
    set_sides(page)
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


def run_update(r: Run, scenario: str, steps, result_text="Each half kept its side", name=None):
    """steps: [(shot name, action on the flow-sides box)], one per question the flow asks."""
    name = name or scenario
    context, page, errors = r.open(scenario)
    start_update(page)
    expect(page.get_by_test_id("update-sheet")).to_be_visible(timeout=20000)
    start = page.get_by_role("button", name=re.compile(r"^(Start update|Update anyway)$"))
    expect(start).to_be_enabled(timeout=20000)
    if scenario == "migrate" and name == "migrate":
        r.shot(page, "sheet-migrate", page.get_by_role("dialog"))
    start.click()
    for shot, act in steps:
        box = page.get_by_test_id("flow-sides")
        expect(box).to_be_visible(timeout=90000)
        expect(box.locator('[data-side-action="confirm"], [data-side-answer]').first).to_be_visible(timeout=5000)
        r.layout(page, f"{name} {shot}")
        r.shot(page, f"flow-{shot}", page.get_by_role("dialog"))
        act(box, page)
        page.wait_for_timeout(300)
    result = page.get_by_test_id("update-result")
    expect(result).to_be_visible(timeout=120000)
    expect(page.get_by_test_id("result-sides")).to_have_text(result_text)
    r.check(page.locator("text=Halves differ").count() == 0, f"{name}: 'Halves differ' after the update")
    r.layout(page, f"{name} result")
    r.shot(page, f"result-{name}", page.get_by_role("dialog"))
    r.close(context, errors, name)


def sheet_first(r: Run):
    context, page, errors = r.open("same")
    start_update(page)
    first = page.get_by_test_id("sheet-sides")
    expect(first).to_be_visible(timeout=20000)
    r.check(first.get_by_text("Set which half is which first").is_visible(), "sheet: no 'Set which half is which first'")
    r.layout(page, "sheet first")
    r.shot(page, "sheet-sides-first", page.get_by_role("dialog"))
    first.locator('[data-side-answer="right"]').click()
    set_sides(first)
    expect(page.get_by_test_id("update-sheet")).to_be_visible(timeout=30000)
    expect(page.locator('[data-check="sides"]')).to_have_attribute("data-state", "ok")
    r.close(context, errors, "sheet first")


def run(browser, url, theme, failures):
    r = Run(browser, url, theme, failures)

    def confirm_right(box, page):
        r.check(box.get_by_text("Each half kept the side of the firmware it ran before.").is_visible(), "migrate: no 'kept the side' line")
        box.locator('[data-side-action="confirm"]').click()

    def swap(box, page):
        box.locator('[data-side-action="swap"]').click()
        expect(box.get_by_test_id("side-confirm")).to_contain_text("The half plugged into your computer becomes the left half.")
        r.shot(page, "flow-swap-confirm", page.get_by_role("dialog"))
        set_sides(box)

    def keep(side):
        def act(box, page):
            r.check(box.get_by_text(f"Keep the plugged-in half as the {side} half?").is_visible(), f"no 'Keep the plugged-in half as the {side} half?'")
            box.locator(f'[data-side-answer="{side}"]').click()
            r.shot(page, "flow-keep-confirm", page.get_by_role("dialog"))
            set_sides(box)
        return act

    def pick(side, note=None):
        def act(box, page):
            if note:
                expect(box.get_by_test_id("side-note")).to_contain_text(note)
            box.locator(f'[data-side-answer="{side}"]').click()
            set_sides(box)
        return act

    steps = [
        ("same", lambda: board_fix(r, "same", "right", primary=None)),
        ("unknown-other", lambda: board_fix(r, "unknown-other", "right", primary="right")),
        ("unknown-usb", lambda: board_fix(r, "unknown-usb", "right", primary="right")),
        ("unknown-both", lambda: board_fix(r, "unknown-both", "left", primary=None)),
        ("strap-same", lambda: board_fix(r, "strap-same", "left", primary="right", gone=False, note="right thumb PCBA")),
        ("migrate", lambda: run_update(r, "migrate", [("migrate-confirm", confirm_right)])),
        ("migrate swap", lambda: run_update(r, "migrate", [("migrate-confirm-swap", swap)], result_text="Each half knows its side now", name="migrate-swap")),
        ("after-unknown", lambda: run_update(r, "after-unknown", [("after-unknown", keep("right"))], result_text="Each half knows its side now")),
        ("ask", lambda: run_update(r, "ask", [("ask", pick("left"))], result_text="Each half knows its side now")),
        ("ask-same", lambda: run_update(r, "ask-same", [("ask-same", pick("right"))], result_text="Each half knows its side now")),
        ("strap", lambda: run_update(r, "strap", [("strap-1", keep("right")), ("strap", pick("left", note="right thumb PCBA"))], result_text="Each half knows its side now")),
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


# ---- review links on the test-site build (?fwfake), zero clicks -----------------------------

# (name, query, what must be on screen when the page settles)
LINKS = [
    ("same", "sides=same", "board"),
    ("unknown-other", "sides=unknown-other", "board"),
    ("unknown-usb", "sides=unknown-usb", "board"),
    ("unknown-both", "sides=unknown-both", "board"),
    ("strap-same", "sides=strap-same", "board"),
    ("sheet-first", "sides=same&fwrun=1", "sheet"),
    ("migrate", "sides=migrate&fwrun=1", "flow"),
    ("after-unknown", "sides=after-unknown&fwrun=1", "flow"),
    ("ask", "sides=ask&fwrun=1", "flow"),
    ("ask-same", "sides=ask-same&fwrun=1", "flow"),
    ("strap", "sides=strap&fwrun=1", "flow"),
]
LINK_SPEED = 10


def link_query(query: str, theme: str) -> str:
    return f"?demo&fwfake=1&{query}&speed={LINK_SPEED}&theme={theme}"


@contextmanager
def test_site_build():
    """The app built as the test site builds it (default mode, base /keybard-test/), served."""
    if os.environ.get("E2E_LINK_URL"):
        yield os.environ["E2E_LINK_URL"].rstrip("/") + "/"
        return
    out = os.path.join(ROOT, ".e2e-dist-fwfake")
    env = {**os.environ, "VITE_BASE_PATH": "/keybard-test/"}
    if not os.environ.get("E2E_SKIP_BUILD"):
        subprocess.run([NPX, "vite", "build", f"--outDir={out}", "--emptyOutDir"], cwd=ROOT, env=env, check=True,
                       stdout=subprocess.DEVNULL)
    port = free_port()
    server = subprocess.Popen([NPX, "vite", "preview", f"--outDir={out}", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
                              cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/keybard-test/"
    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(url, timeout=2)
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


def check_link(browser, url, name, query, kind, theme, failures):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=theme, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        page.goto(url + link_query(query, theme))
        target = {"board": page.get_by_test_id("firmware-section").get_by_test_id("side-fix"),
                  "sheet": page.get_by_test_id("sheet-sides"),
                  "flow": page.get_by_test_id("flow-sides")}[kind]
        expect(target).to_be_visible(timeout=120000)
        if SHOTS:
            os.makedirs(SHOTS, exist_ok=True)
            page.screenshot(path=os.path.join(SHOTS, f"link-{name}-{theme}.png"))
    except Exception as e:
        failures.append(f"{theme}, link {name}: {str(e).splitlines()[0]}")
    failures.extend(f"{theme}, link {name}: page error: {e}" for e in errors)
    context.close()


def main() -> int:
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if not os.environ.get("E2E_NO_HARNESS"):
            with dev_url() as url:
                for theme in ("light", "dark"):
                    run(browser, url, theme, failures)
        if not os.environ.get("E2E_NO_LINKS"):
            with test_site_build() as url:
                for theme in ("light", "dark"):
                    for name, query, kind in LINKS:
                        check_link(browser, url, name, query, kind, theme, failures)
        browser.close()
    for f in failures:
        print("FAIL", f)
    print("one-image sides e2e:", "FAILED" if failures else "passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
