// Group 1, area A: theme. A5 (?theme review param) and A8 (Settings > Appearance).
import { test, expect, openDemo } from "./fixtures";
import { detailPanel, openRailPanel } from "./g1-helpers";
import type { Page } from "@playwright/test";

const html = (page: Page) => page.locator("html");
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function appearance(page: Page) {
    await openRailPanel(page, "Settings");
    await detailPanel(page).getByRole("button", { name: "General", exact: true }).click();
    return detailPanel(page).getByRole("combobox", { name: "Appearance" });
}

test.describe("A5 ?theme forces the theme for one load", () => {
    test.use({ colorScheme: "light" });

    test("theme=dark is dark for that load only and is not saved", async ({ page }) => {
        await openDemo(page, "demo&theme=dark");
        await expect(html(page)).toHaveClass(/\bdark\b/);
        const darkBg = await bodyBackground(page);
        // The saved setting is untouched.
        await expect(await appearance(page)).not.toHaveValue("dark");
        await openDemo(page, "demo");
        await expect(html(page)).not.toHaveClass(/\bdark\b/);
        expect(await bodyBackground(page)).not.toBe(darkBg);
    });

    test("theme=light overrides a saved Dark, and the next load is dark again", async ({ page }) => {
        await openDemo(page);
        await (await appearance(page)).selectOption({ label: "Dark" });
        await expect(html(page)).toHaveClass(/\bdark\b/);
        await openDemo(page, "demo&theme=light");
        await expect(html(page)).not.toHaveClass(/\bdark\b/);
        await expect(await appearance(page)).toHaveValue("dark");
        await openDemo(page, "demo");
        await expect(html(page)).toHaveClass(/\bdark\b/);
    });

    test("theme with any other value is ignored", async ({ page }) => {
        await openDemo(page, "demo&theme=purple");
        await expect(html(page)).not.toHaveClass(/\bdark\b/);
    });
});

test.describe("A8 Settings > Appearance", () => {
    test.use({ colorScheme: "light" });

    test("Dark and Light apply at once and persist after a reload", async ({ page }) => {
        await openDemo(page);
        const select = await appearance(page);
        const lightBg = await bodyBackground(page);

        await select.selectOption({ label: "Dark" });
        await expect(html(page)).toHaveClass(/\bdark\b/);
        expect(await bodyBackground(page)).not.toBe(lightBg);
        await page.reload();
        await expect(page.locator("[data-keyboard-instance] [data-key-x]").first()).toBeVisible({ timeout: 20_000 });
        await expect(html(page)).toHaveClass(/\bdark\b/);
        await expect(await appearance(page)).toHaveValue("dark");

        await (await appearance(page)).selectOption({ label: "Light" });
        await expect(html(page)).not.toHaveClass(/\bdark\b/);
        await page.reload();
        await expect(page.locator("[data-keyboard-instance] [data-key-x]").first()).toBeVisible({ timeout: 20_000 });
        await expect(html(page)).not.toHaveClass(/\bdark\b/);
        await expect(await appearance(page)).toHaveValue("light");
    });

    test("the theme is right from the first paint after a reload (no flash)", async ({ page }) => {
        await openDemo(page);
        await (await appearance(page)).selectOption({ label: "Dark" });
        await expect(html(page)).toHaveClass(/\bdark\b/);
        // Read the class as soon as the document exists, before the app runs.
        await page.addInitScript(() => {
            document.addEventListener("readystatechange", () => {
                if (document.readyState === "interactive") (window as unknown as { __early: string }).__early = document.documentElement.className;
            }, { once: true });
        });
        await page.reload();
        const early = await page.evaluate(() => (window as unknown as { __early?: string }).__early ?? "");
        expect(early).toMatch(/\bdark\b/);
    });

    test("System follows the operating system, live", async ({ page }) => {
        await openDemo(page);
        await (await appearance(page)).selectOption({ label: "System" });
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(html(page)).toHaveClass(/\bdark\b/);
        await page.emulateMedia({ colorScheme: "light" });
        await expect(html(page)).not.toHaveClass(/\bdark\b/);
        await page.reload();
        await expect(page.locator("[data-keyboard-instance] [data-key-x]").first()).toBeVisible({ timeout: 20_000 });
        await expect(await appearance(page)).toHaveValue("system");
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(html(page)).toHaveClass(/\bdark\b/);
    });
});
