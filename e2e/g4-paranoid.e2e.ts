// Group 4, flow D14: Keybard Paranoid, the single-file no-network build.
// Build it first: npm run build:paranoid (writes dist-paranoid/keybard-paranoid.html).
// The test opens the file directly, as a user who double-clicks it would.
import { test, expect, CANVAS_KEY } from "./fixtures";
import { ROOT, shot } from "./g4-helpers";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FILE = path.resolve(ROOT, "dist-paranoid/keybard-paranoid.html");
const URL_ = pathToFileURL(FILE).href;

test.skip(!fs.existsSync(FILE), "Run npm run build:paranoid first (dist-paranoid/keybard-paranoid.html is missing).");

/** Open the paranoid file with every network request blocked and recorded. */
async function openParanoid(page: Page) {
    const attempted: string[] = [];
    await page.route("**/*", (route) => {
        const url = route.request().url();
        if (url.startsWith("file:") || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
        attempted.push(url);
        return route.abort();
    });
    page.on("request", (r) => {
        const url = r.url();
        if (!/^(file|data|blob):/.test(url) && !attempted.includes(url)) attempted.push(url);
    });
    await page.goto(URL_);
    return attempted;
}

test.describe("D14 Keybard Paranoid", () => {
    test("D14 the QWERTY Example loads with no network requests", async ({ page }) => {
        const attempted = await openParanoid(page);
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        expect(await page.locator(CANVAS_KEY).count()).toBeGreaterThan(40);
        await page.waitForTimeout(1_000);
        expect(attempted, "network requests the paranoid build tried to make").toEqual([]);
    });

    test("D14 there is no Manual rail item", async ({ page }) => {
        await openParanoid(page);
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Manual", exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Manual", exact: true })).toHaveCount(0);
    });

    test("D14 the Overlay dialog points to Start-Paranoid.cmd, with no Connect or Download", async ({ page }) => {
        const attempted = await openParanoid(page);
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await page.getByRole("button", { name: "Overlay", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("Start-Paranoid.cmd");
        await expect(dialog).toContainText(/paranoid mode/i);
        await expect(dialog.getByRole("button", { name: /^Connect/ })).toHaveCount(0);
        await expect(dialog.getByRole("link", { name: /Download/i })).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: /Download/i })).toHaveCount(0);
        expect(attempted).toEqual([]);
    });

    test("D14 the bundled layer library works offline", async ({ page }) => {
        const attempted = await openParanoid(page);
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await page.getByRole("button", { name: "Layouts", exact: true }).click();
        await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("button", { name: "Enlarge Colemak preview" })).toBeVisible();
        // Group titles are the file names, never a data: URL.
        await expect(page.getByText(/;base64,/)).toHaveCount(0);
        await page.getByRole("button", { name: "Copy Dvorak" }).click();
        const dialog = page.getByRole("dialog").filter({ hasText: "Clipboard has a copy of Dvorak" });
        await dialog.getByRole("button", { name: "Now" }).click();
        const labels = await page.locator(CANVAS_KEY).evaluateAll((els) => els.map((e) => (e.textContent || "").trim().toUpperCase()));
        for (const k of ["A", "O", "E", "U"]) expect(labels).toContain(k);
        expect(attempted).toEqual([]);
    });

    test("D14 export works offline", async ({ page }) => {
        await page.addInitScript(() => {
            const w = window as any;
            w.__saved = [];
            w.showSaveFilePicker = async (opts: any) => ({
                createWritable: async () => ({ write: async (b: any) => { w.__saved.push({ name: opts?.suggestedName, size: (await b.text()).length }); }, close: async () => {} }),
            });
        });
        const attempted = await openParanoid(page);
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await page.getByRole("button", { name: "Export Layout" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Export", exact: true }).click();
        await expect.poll(() => page.evaluate(() => (window as any).__saved.length)).toBe(1);
        expect(attempted).toEqual([]);
    });
});
