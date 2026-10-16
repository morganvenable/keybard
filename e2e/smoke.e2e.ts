import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";

test.describe("smoke", () => {
    test("landing page offers the QWERTY Example", async ({ page }) => {
        await page.goto("./");
        await expect(page.getByRole("button", { name: "QWERTY Example", exact: true })).toBeVisible();
    });

    test("clicking QWERTY Example loads a layout", async ({ page }) => {
        await page.goto("./");
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        expect(await page.locator(CANVAS_KEY).count()).toBeGreaterThan(40);
    });

    test("?demo loads the example with no console errors", async ({ page }) => {
        await openDemo(page);
        await expect(page.getByRole("button", { name: "Standard Keys", exact: true })).toBeVisible();
    });
});
