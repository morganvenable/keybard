// Group 5, area E (overlay and Host): the Desktop overlay dialog from the rail,
// #overlay and #trainer, and the Host overlay surface (?hostOverlay). Flows E12-E13.
import type { Page } from "@playwright/test";
import { test, expect, openDemo } from "./fixtures";
import { rail, overlaps, clippedElements } from "./g5-helpers";

/** No Keybard Host is running: every call to its local port fails. */
async function noHost(page: Page) {
    await page.route(/^https?:\/\/(127\.0\.0\.1|localhost):5178\//, (r) => r.abort("connectionrefused"));
}

/** The Host download link: the Windows zip of a Keybard release. */
const HOST_ZIP = /^https:\/\/github\.com\/svalboard\/keybard\/releases\/download\/[^/]+\/KeybardHost-Windows\.zip$/;

test.describe("E12 Desktop overlay dialog", () => {
    test("the Overlay rail item opens the dialog; Connect without a Host fails with a clear message", async ({ page, allowConsoleError }) => {
        // The browser itself logs the refused request; the app must not add errors of its own.
        allowConsoleError(/Failed to load resource: net::ERR_CONNECTION_REFUSED/);
        await noHost(page);
        await openDemo(page);
        await rail(page, "Overlay").click();
        const dlg = page.getByRole("dialog", { name: "Desktop overlay" });
        await expect(dlg).toBeVisible();
        await expect(dlg).toContainText("Keybard Host shows your layout above your other windows.");
        await expect(dlg.getByRole("link", { name: "Download for Windows" })).toHaveAttribute("href", HOST_ZIP);
        await dlg.getByRole("button", { name: "Connect" }).click();
        const alert = dlg.getByRole("alert");
        await expect(alert).toBeVisible({ timeout: 10_000 });
        await expect(alert).toContainText("Could not reach Keybard Host");
        await expect(alert).toContainText("Start Keybard Host");
        // Nothing in the dialog is cut off.
        expect(await clippedElements(page, "[role=dialog] button, [role=dialog] a, [role=dialog] [role=alert]")).toEqual([]);
        // The demo stays loaded behind it.
        await dlg.getByRole("button", { name: "Close" }).click();
        await expect(dlg).toBeHidden();
        await expect(page.getByText("Offline draft: QWERTY example (demo)")).toBeVisible();
    });

    for (const hash of ["#overlay", "#trainer"]) {
        test(`${hash} opens the same dialog and Escape closes it`, async ({ page }) => {
            await noHost(page);
            await page.goto(`./?demo${hash}`);
            const dlg = page.getByRole("dialog", { name: "Desktop overlay" });
            await expect(dlg).toBeVisible({ timeout: 20_000 });
            await expect(dlg.getByRole("link", { name: "Download for Windows" })).toHaveAttribute("href", HOST_ZIP);
            await page.keyboard.press("Escape");
            await expect(dlg).toBeHidden();
        });
    }

    test("the dialog fits a phone-width window", async ({ page }) => {
        await noHost(page);
        await page.setViewportSize({ width: 390, height: 844 });
        // The hash is read when the page opens (the Host's Open Keybard link opens a new page).
        await page.goto("./?demo#overlay");
        const dlg = page.getByRole("dialog", { name: "Desktop overlay" });
        await expect(dlg).toBeVisible({ timeout: 20_000 });
        const box = (await dlg.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(await clippedElements(page, "[role=dialog] button, [role=dialog] a")).toEqual([]);
    });
});

test.describe("E13 Host overlay surface", () => {
    test("?hostOverlay&hostDemo=pointing draws the layout with a touchpad and a trackball", async ({ page }) => {
        await page.goto("./?hostOverlay&hostDemo=pointing");
        const keys = page.locator("g[data-key-id]");
        await expect(keys.first()).toBeVisible({ timeout: 20_000 });
        expect(await keys.count()).toBeGreaterThan(40);
        await expect(page.getByText("Space", { exact: true })).toBeVisible();
        const pad = page.locator("canvas[data-pointing-device='left']");
        const ball = page.locator("canvas[data-pointing-device='right']");
        await expect(pad).toHaveAttribute("data-pointing-kind", "pad");
        await expect(ball).toHaveAttribute("data-pointing-kind", "ball");
        // Laid out like the editor: pad on the left, ball on the right, neither on a key.
        const padBox = (await pad.boundingBox())!, ballBox = (await ball.boundingBox())!;
        expect(padBox.x).toBeLessThan(ballBox.x);
        const ballR = Number(/circle\(([\d.]+)px/.exec(await ball.evaluate((e) => (e as HTMLElement).style.clipPath))?.[1] ?? 0);
        const keyBoxes = await keys.evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, label: (e.textContent || "").trim() }; }));
        const cx = ballBox.x + ballBox.width / 2, cy = ballBox.y + ballBox.height / 2;
        expect(keyBoxes.filter((k) => overlaps(padBox, k, 10)).map((k) => k.label), "keys under the pad").toEqual([]);
        expect(keyBoxes.filter((k) => {
            const nx = Math.max(k.x, Math.min(cx, k.x + k.width)), ny = Math.max(k.y, Math.min(cy, k.y + k.height));
            return Math.hypot(cx - nx, cy - ny) < ballR - 2;
        }).map((k) => k.label), "keys under the ball").toEqual([]);
        // Every key is inside the window.
        for (const k of keyBoxes) {
            expect(k.x, `${k.label} left edge`).toBeGreaterThanOrEqual(0);
            expect(k.x + k.width, `${k.label} right edge`).toBeLessThanOrEqual(1440);
        }
    });

    test("?hostOverlay alone renders its transparent waiting surface with no errors", async ({ page }) => {
        await page.goto("./?hostOverlay");
        await page.waitForTimeout(1500);
        // The Host window is transparent until the Host sends a layout: nothing is drawn yet.
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
        await expect(page.locator("g[data-key-id]")).toHaveCount(0);
    });
});
