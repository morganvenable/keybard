"""
Install by hand on a board with firmware from before the updater (mock board, &proto=0).
The page carries the x4 file inside it (&embedfw=1) and every request for firmware files
fails, so the file comes from memory. (The hosted fetch is covered by the unit test.) The by-hand screen appears, clicking the file card downloads the .uf2
under its own name, and the bytes' SHA-256 equals the pin. `npm run test:e2e:by-hand`.
The mock board needs VITE_STORAGE_NAMESPACE=keybard-test, set for this build only.
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import time

from playwright.sync_api import expect, sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NPX = shutil.which("npx") or "npx"
OUT = os.path.join(ROOT, ".e2e-dist", "byhand")
BASE = "/byhand/"


def main() -> int:
    failures = []

    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    env = dict(os.environ, VITE_STORAGE_NAMESPACE="keybard-test")
    subprocess.run([NPX, "vite", "build", f"--base={BASE}", f"--outDir={OUT}", "--emptyOutDir"], cwd=ROOT, env=env, check=True)
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--directory", os.path.dirname(OUT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    page_url = f"http://127.0.0.1:8765{BASE}"
    time.sleep(1)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        # the file must come from memory: any request for it fails
        page.route("**/firmware/**", lambda r: r.abort())
        page.goto(page_url + "?demo&fwfake=1&panel=firmware&embedfw=1&proto=0&running=x3.1.3&speed=20")
        section = page.get_by_test_id("firmware-section")
        expect(section).to_be_visible(timeout=30000)
        section.get_by_role("button", name=re.compile("Update to|Install")).first.click()
        dialog = page.get_by_test_id("manual-install")
        expect(dialog).to_be_visible(timeout=15000)
        card = dialog.locator("[data-file=both]")
        expect(card).to_be_visible()
        with page.expect_download(timeout=15000) as dl:
            card.click()
        d = dl.value
        pin_sha = page.evaluate("window.__pinSha")
        check(d.suggested_filename == "svalboard_sval_x4.uf2", f"file name {d.suggested_filename}")
        got = open(d.path(), "rb").read()
        check(hashlib.sha256(got).hexdigest() == pin_sha, "downloaded bytes match the pin")
        check(not errors, f"no page errors {errors}")
        browser.close()
    server.terminate()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
