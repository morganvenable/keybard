"""
Browser test of Settings > About as each site shows it, with the other site's
version.json mocked. Run with `npm run test:e2e:about-versions`.

Builds three Keybards: next.keybard.svalboard.com (x4.4, --mode next),
keybard.svalboard.com (v4.3.6, --mode svalboard) and an untagged test build.
Each is opened at ?panel=about in light and dark theme.

  1. This build's version comes first, with its site and "(this one)"; the
     other site follows with the version its version.json names. Each version
     has its word beside it (Stable for v, Bleeding edge for x; none for a
     commit or an unknown version). Every site is a link to that site, and no
     link is labeled Stable or Bleeding edge.
  2. Release notes link this release's notes (the releases list when untagged).
  3. On next, the banner says which firmware to flash and which site to use.
  4. When version.json cannot be read, the site shows with no version and the
     banner names only the site.
  5. Every text in About and the banner has a contrast of at least 4.5:1 (AA).
     At phone width (375 px) the rows fit with no sideways scroll and the
     word, version and site columns stay aligned.
  6. No page errors.

E2E_SKIP_BUILD reuses the last builds. E2E_SHOTS=<dir> saves a screenshot of
About (and the banner) per site and theme. Exits 1 when a check fails.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from contextlib import contextmanager

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_editor_e2e import NPX, ROOT, free_port  # noqa: E402
from select_contrast_e2e import contrast, rgba  # noqa: E402

BASE_PATH = "/keybard-e2e-about/"
TABLE = "[role=table][aria-label='Keybard']"
FILES = {
    "https://keybard.svalboard.com/version.json": {"tag": "v4.3.6", "firmware": "v4.3.5"},
    "https://next.keybard.svalboard.com/version.json": {"tag": "x4.4", "firmware": "x4.4"},
}
# name, vite mode, RELEASE_TAG
BUILDS = [("next", "next", "x4.4"), ("production", "svalboard", "v4.3.6"), ("untagged", "production", "")]

failures: list[str] = []


def check(cond: bool, label: str):
    print(("PASS " if cond else "FAIL ") + label)
    if not cond:
        failures.append(label)


def out_dir(name: str) -> str:
    return os.path.join(ROOT, f".e2e-dist-about-{name}")


def build(name: str, mode: str, tag: str):
    env = {**os.environ, "RELEASE_TAG": tag}
    subprocess.run([NPX, "vite", "build", "--mode", mode, f"--base={BASE_PATH}", f"--outDir={out_dir(name)}", "--emptyOutDir"],
                   cwd=ROOT, check=True, env=env)


@contextmanager
def serve(name: str):
    port = free_port()
    server = subprocess.Popen(
        [NPX, "vite", "preview", f"--base={BASE_PATH}", f"--outDir={out_dir(name)}", "--host", "127.0.0.1",
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
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(server.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


# Every text node's element in a subtree: [text, color, first non-transparent background behind it].
READ_COLORS = """(root) => {
    const toRgb = (c) => {
        const x = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        x.clearRect(0, 0, 1, 1); x.fillStyle = c; x.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = x.getImageData(0, 0, 1, 1).data;
        return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    };
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        let e = el, bg = 'rgba(255, 255, 255, 1)';
        while (e) { const b = toRgb(getComputedStyle(e).backgroundColor); if (!b.endsWith(', 0)')) { bg = b; break; } e = e.parentElement; }
        out.push([n.textContent.trim(), toRgb(getComputedStyle(el).color), bg]);
    }
    return out;
}"""


def check_contrast(page, locator, label: str):
    rows = locator.evaluate(READ_COLORS)
    worst = min(((contrast(rgba(c)[:3], rgba(b)[:3]), t, c, b) for t, c, b in rows), default=None)
    check(worst is not None and worst[0] >= 4.5,
          f"{label}: lowest contrast {worst[0]:.1f}:1 ({worst[1]!r}: {worst[2]} on {worst[3]})" if worst else f"{label}: no text")


def open_about(browser, url: str, theme: str, reachable: bool):
    context = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=theme, reduced_motion="reduce")
    reads: list[str] = []

    def version_file(route):
        reads.append(route.request.url)
        body = FILES.get(route.request.url.split("?")[0])
        if not reachable or body is None:
            route.abort()
            return
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body),
                      headers={"Access-Control-Allow-Origin": "*"})

    context.route(re.compile(r"^https://(next\.)?keybard\.svalboard\.com/"), version_file)
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{url}?demo=combos&panel=about&theme={theme}")
    expect(page.get_by_label("Search settings")).to_be_visible(timeout=20000)
    if theme == "dark":
        expect(page.locator("html")).to_have_class(re.compile(r"\bdark\b"), timeout=10000)
    return context, page, errors, reads


def rows(page) -> list[str]:
    return page.locator(TABLE).evaluate(
        "t => [...t.querySelectorAll('[role=row]')].map(tr => [...tr.querySelectorAll(':scope > [role=cell]')].map(td => td.textContent.trim()).join(' | '))")


EXPECTED = {
    "next": ["Bleeding edge | x4.4 | next.keybard.svalboard.com, firmware x4.4(this one)",
             "Stable | v4.3.6 | keybard.svalboard.com, firmware v4.3.5"],
    "production": [re.compile(r"^Stable \| v4\.3\.6 \| keybard\.svalboard\.com(, firmware v[\d.]+)?\(this one\)$"),
                   "Bleeding edge | x4.4 | next.keybard.svalboard.com, firmware x4.4"],
    "untagged": [re.compile(r"^ \| build [0-9a-f]+ \| \(this one\)$"),
                 "Stable | v4.3.6 | keybard.svalboard.com, firmware v4.3.5",
                 "Bleeding edge | x4.4 | next.keybard.svalboard.com, firmware x4.4"],
}
FAILED_READ = {
    "next": " | version not known | keybard.svalboard.com",
    "production": " | version not known | next.keybard.svalboard.com",
}


def phone(page, name: str, theme: str, shots: str | None):
    """Phone width: the rows fit the card, nothing scrolls sideways, columns stay aligned."""
    page.set_viewport_size({"width": 375, "height": 812})
    page.wait_for_timeout(300)
    page.evaluate("() => document.getElementById('settings-section-about').scrollIntoView({ block: 'center' })")
    page.wait_for_timeout(200)
    fit = page.evaluate("""() => {
        const t = document.querySelector("[role=table][aria-label='Keybard']");
        const card = document.getElementById('settings-section-about');
        const tr = t.getBoundingClientRect(), cr = card.getBoundingClientRect();
        const rows = [...t.querySelectorAll('[role=row]')].map(r => [...r.querySelectorAll(':scope > [role=cell]')]);
        const lefts = (i) => rows.map(r => Math.round(r[i].getBoundingClientRect().left));
        const cells = rows.flat().map(c => c.getBoundingClientRect());
        return {
            inside: tr.left >= cr.left - 1 && tr.right <= cr.right + 1 && cells.every(c => c.right <= cr.right + 1),
            noScroll: document.documentElement.scrollWidth <= innerWidth + 1,
            aligned: [0, 1, 2].every(i => new Set(lefts(i)).size === 1),
            right: Math.round(tr.right), card: Math.round(cr.right),
        };
    }""")
    check(fit["inside"] and fit["noScroll"] and fit["aligned"], f"{name}/{theme}: phone width fits and stays aligned {fit}")
    check_contrast(page, page.locator(TABLE), f"{name}/{theme}: About versions at phone width")
    if shots:
        os.makedirs(shots, exist_ok=True)
        page.locator("#settings-section-about").screenshot(path=os.path.join(shots, f"about-{name}-{theme}-phone.png"))
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_timeout(300)


def matches(got: list[str], want: list) -> bool:
    return len(got) == len(want) and all(w.match(g) if isinstance(w, re.Pattern) else g == w for g, w in zip(got, want))


def flow(browser, name: str, tag: str, url: str, theme: str, shots: str | None):
    context, page, errors, reads = open_about(browser, url, theme, reachable=True)
    try:
        about = page.locator("#settings-section-about")
        dl = page.locator(TABLE)
        expect(dl).to_be_visible(timeout=10000)
        want = EXPECTED[name]
        deadline = time.time() + 5
        while time.time() < deadline and not matches(rows(page), want):
            page.wait_for_timeout(100)
        got = rows(page)
        check(matches(got, want), f"{name}/{theme}: rows {got}")
        for host in ("keybard.svalboard.com", "next.keybard.svalboard.com"):
            link = dl.get_by_role("link", name=host, exact=True)
            check(link.count() == 1 and link.get_attribute("href") == f"https://{host}/", f"{name}/{theme}: {host} links to its site")
        check(about.get_by_role("link", name=re.compile("stable|bleeding", re.I)).count() == 0,
              f"{name}/{theme}: no link is labeled Stable or Bleeding edge")
        words = dl.evaluate("t => [...t.querySelectorAll('[role=row]')].map(tr => [...tr.querySelectorAll(':scope > [role=cell]')].slice(0, 2).map(c => c.textContent.trim()))")
        check(all((w == "Stable") == v.startswith("v") and (w == "Bleeding edge") == v.startswith("x") and (w == "" or re.match(r"^[vx]\d", v))
                  for w, v in words), f"{name}/{theme}: each word sits beside its own version {words}")
        notes = about.get_by_role("link", name="Release notes").get_attribute("href")
        want_notes = f"https://github.com/svalboard/keybard/releases/tag/{tag}" if tag else "https://github.com/svalboard/keybard/releases"
        check(notes == want_notes, f"{name}/{theme}: release notes link {notes}")
        own = {"next": "next", "production": "keybard"}.get(name)
        check(bool(reads) and (all(("next." in r) != (own == "next") for r in reads) if own else len(reads) == 2),
              f"{name}/{theme}: reads only the other site's version.json ({reads})")
        check_contrast(page, dl, f"{name}/{theme}: About versions")
        check_contrast(page, about.locator("p").last, f"{name}/{theme}: About links")
        banner = page.get_by_role("note").filter(has_text="Bleeding edge")
        if name == "next":
            expect(banner).to_have_text(re.compile("firmware"), timeout=5000)
            check(banner.inner_text().strip() ==
                  "Bleeding edge: may break. For the stable version, flash firmware v4.3.5 and use keybard.svalboard.com.",
                  f"{name}/{theme}: banner {banner.inner_text()!r}")
            check(banner.get_by_role("link").get_attribute("href") == "https://keybard.svalboard.com/", f"{name}/{theme}: banner links to keybard.svalboard.com")
            check_contrast(page, banner, f"{name}/{theme}: banner")
        else:
            check(banner.count() == 0, f"{name}/{theme}: no bleeding-edge banner")
        phone(page, name, theme, shots)
        if shots:
            os.makedirs(shots, exist_ok=True)
            page.evaluate("() => document.getElementById('settings-section-about').scrollIntoView({ block: 'center' })")
            page.wait_for_timeout(200)
            about.screenshot(path=os.path.join(shots, f"about-{name}-{theme}.png"))
            if name == "next":
                banner.screenshot(path=os.path.join(shots, f"banner-next-{theme}.png"))
        check(not errors, f"{name}/{theme}: no page errors {errors}")
    finally:
        context.close()

    if name not in FAILED_READ:
        return
    context, page, errors, _ = open_about(browser, url, theme, reachable=False)
    try:
        dl = page.locator(TABLE)
        expect(dl).to_be_visible(timeout=10000)
        page.wait_for_timeout(500)
        got = rows(page)
        check(len(got) == 2 and got[1] == FAILED_READ[name], f"{name}/{theme}: unreadable version.json shows the site with no version {got}")
        if name == "next":
            text = page.get_by_role("note").inner_text().strip()
            check(text == "Bleeding edge: may break. For the stable version, use keybard.svalboard.com.", f"{name}/{theme}: banner without a version {text!r}")
    finally:
        context.close()


def main() -> int:
    if not os.environ.get("E2E_SKIP_BUILD"):
        for name, mode, tag in BUILDS:
            build(name, mode, tag)
    shots = os.environ.get("E2E_SHOTS")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for name, _, tag in BUILDS:
                with serve(name) as url:
                    for theme in ("light", "dark"):
                        flow(browser, name, tag, url, theme, shots)
        finally:
            browser.close()
    print(f"\n{len(failures)} failure(s)" if failures else "\nAll checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
