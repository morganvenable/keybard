"""
Browser flow of the Auto Mouse Layer setting against the simulated Svalboard
(?fakeBoard=pointing, firmware with VIA 63 and 64). Headless, 1440 x 900.
Run with `npm run test:e2e:automouse-layers`.

  1. The AutoMouse group shows Auto Mouse Layer, Everywhere chosen, no layer pills,
     no Choose Layers button and no dialog.
  2. Only on Selected Layers shows the pills under the row: one button per layer but the
     mouse layer, none pressed.
  3. Clicking pills toggles them at once (aria-pressed, struck through); a burst of clicks
     writes the final mask to the board once (VIA 64).
  4. Space and Enter on a focused pill toggle it too, and the board gets that mask.
  5. Everywhere hides the pills and keeps the mask; Only on Selected Layers shows it again.
  6. Older firmware (?fakeBoard=old): no Auto Mouse Layer setting at all.

With E2E_SHOTS=<dir>, saves Everywhere, two layers off, and a focused pill in light and dark.
E2E_URL and E2E_SKIP_BUILD work as in fake_board_e2e.py. Exits 1 when a check fails.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fake_board_e2e import app_url, wait_connected  # noqa: E402
from playwright.sync_api import expect, sync_playwright  # noqa: E402

SHOTS = os.environ.get("E2E_SHOTS")
FW = "window.keybardFakeBoard.device.firmware"


def main() -> int:
    failures: list[str] = []

    def check(ok: bool, what: str):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok:
            failures.append(what)

    with app_url() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for theme in ("light", "dark"):
            context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce",
                                          color_scheme=theme)
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"{url}?fakeBoard=pointing&theme={theme}&panel=pointing-automouse")
            wait_connected(page)
            expect(page.locator("[data-automouse-settings]")).to_be_visible(timeout=20000)
            page.wait_for_timeout(500)
            group = page.locator("[data-automouse-settings]")
            row = page.locator("[data-row='Auto Mouse Layer']")
            pills = page.locator("[data-automouse-pills]")

            def mask_writes():
                return page.evaluate(f"{FW}.customWrites.filter(w => w.id === 64).map(w => w.value[0] | (w.value[1] << 8))")

            # 1.
            check(row.is_visible(), f"{theme}: Auto Mouse Layer setting shown")
            check(row.get_by_role("radio", name="Everywhere").get_attribute("aria-checked") == "true",
                  f"{theme}: Everywhere is the default")
            check(pills.count() == 0, f"{theme}: no pills under Everywhere")
            check(page.get_by_role("button", name="Choose Layers").count() == 0, f"{theme}: no Choose Layers button")
            check(page.locator("[role='dialog']").count() == 0, f"{theme}: no dialog")
            if SHOTS:
                group.screenshot(path=os.path.join(SHOTS, f"v3-everywhere-{theme}.png"))

            # 2.
            row.get_by_role("radio", name="Only on Selected Layers").click()
            expect(pills).to_be_visible()
            buttons = pills.locator("button[data-layer]")
            check(buttons.count() == 15, f"{theme}: 15 pill buttons (mouse layer left out), got {buttons.count()}")
            check(pills.locator("[aria-pressed='true']").count() == 0, f"{theme}: none pressed at first")

            # 3.
            p1, p3, p5 = (pills.locator(f"[data-layer='{i}']") for i in (1, 3, 5))
            p1.click(); p3.click(); p5.click(); p5.click()
            check(p3.get_attribute("aria-pressed") == "true", f"{theme}: a clicked pill is pressed at once")
            check(p5.get_attribute("aria-pressed") == "false", f"{theme}: a second click turns it back")
            check(p3.get_attribute("aria-label") == "Layer 3: Auto Mouse off", f"{theme}: label says off")
            deco = p3.locator("span").evaluate("e => getComputedStyle(e).textDecorationLine")
            check("line-through" in deco, f"{theme}: an off layer is struck through")
            page.wait_for_function(f"{FW}.autoMouseLayerMask === 0b1010", timeout=5000)
            writes = mask_writes()
            check(writes == [0b1010], f"{theme}: the burst wrote the final mask once ({writes!r})")
            page.mouse.move(0, 0)
            if SHOTS:
                group.screenshot(path=os.path.join(SHOTS, f"v3-selected-{theme}.png"))

            # 4.
            p5.focus()
            page.keyboard.press("Space")
            check(p5.get_attribute("aria-pressed") == "true", f"{theme}: Space toggles a focused pill")
            p1.focus()
            page.keyboard.press("Enter")
            check(p1.get_attribute("aria-pressed") == "false", f"{theme}: Enter toggles a focused pill")
            page.wait_for_function(f"{FW}.autoMouseLayerMask === 0b101000", timeout=5000)
            check(mask_writes()[-1] == 0b101000, f"{theme}: keyboard toggles written")
            p1.focus()
            if SHOTS:
                group.screenshot(path=os.path.join(SHOTS, f"v3-focus-{theme}.png"))

            # 5.
            n = len(mask_writes())
            row.get_by_role("radio", name="Everywhere").click()
            expect(pills).to_have_count(0)
            page.wait_for_timeout(600)
            check(len(mask_writes()) == n and page.evaluate(f"{FW}.autoMouseLayerMask") == 0b101000,
                  f"{theme}: Everywhere keeps the mask")
            row.get_by_role("radio", name="Only on Selected Layers").click()
            offs = pills.locator("[aria-pressed='true']").evaluate_all("es => es.map(e => e.dataset.layer)")
            check(offs == ["3", "5"], f"{theme}: the layers survive Everywhere and back ({offs!r})")
            check(not errors, f"{theme}: no page errors {errors}")
            context.close()

        # 6.
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{url}?fakeBoard=old&panel=pointing-automouse")
        wait_connected(page)
        page.wait_for_timeout(2500)
        check(page.locator("[data-row='Auto Mouse Layer']").count() == 0, "older firmware: no Auto Mouse Layer setting")
        context.close()
        browser.close()

    print(f"\n{len(failures)} failed" if failures else "\nall passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
