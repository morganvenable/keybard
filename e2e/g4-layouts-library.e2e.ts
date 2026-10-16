// Group 4, flows D6, D7, D8: the Layouts library (search, enlarge, copy,
// delete, import, persistence, and dragging a layer onto the strip).
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { tmpFile, shot, ROOT } from "./g4-helpers";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ALT_ALPHAS = fs.readFileSync(path.resolve(ROOT, "src/default-layouts/sval-alt-alphas.svil"), "utf8");

async function openLayouts(page: Page) {
    await page.getByRole("button", { name: "Layouts", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search layouts" });
    await expect(search).toBeVisible();
    // The bundled layouts load into the library on first open.
    await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toBeVisible({ timeout: 15_000 });
    return search.locator("xpath=ancestor::section[1]");
}

const groupHeader = (page: Page, name: string) =>
    page.locator('[role=button][aria-expanded]').filter({ hasText: new RegExp(`^${name}\\d+ layers?$`) });

/** Canvas key labels as the user reads them (keys draw in upper case). */
async function canvasLabels(page: Page): Promise<string[]> {
    return page.locator(CANVAS_KEY).evaluateAll((els) => els.map((e) => (e.textContent || "").trim().toUpperCase()));
}

/** Drag a library layer by its title row onto a layer tab, with real mouse moves. */
async function dragLayerToTab(page: Page, layerName: string, tabLabel: string) {
    const handle = page.locator("span", { hasText: new RegExp(`^${layerName}$`) }).first();
    await handle.scrollIntoViewIfNeeded();
    const tab = page.getByRole("button", { name: tabLabel, exact: true }).first();
    const h = (await handle.boundingBox())!;
    const t = (await tab.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 30, h.y, { steps: 5 });
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 15 });
    await page.mouse.up();
}

async function goLayer(page: Page, n: number) {
    await page.getByRole("button", { name: String(n), exact: true }).first().click();
    await expect(page.getByRole("button", { name: new RegExp(`^Rename layer ${n}:`) })).toBeVisible();
}

test.describe("D6 Layouts library", () => {
    test("D6 search filters to the matching layer and can be cleared", async ({ page }) => {
        await openDemo(page);
        const panel = await openLayouts(page);
        const search = page.getByRole("textbox", { name: "Search layouts" });
        await search.fill("Dvorak");
        await expect(panel.getByRole("button", { name: "Enlarge Dvorak preview" })).toBeVisible();
        await expect(panel.getByRole("button", { name: "Enlarge Colemak preview" })).toHaveCount(0);
        await expect(panel.getByRole("button", { name: /Enlarge Home-row numbers/ })).toHaveCount(0);
        await search.fill("zzzz-nothing");
        await expect(panel.getByText('No layers match "zzzz-nothing"')).toBeVisible();
        await panel.getByRole("button", { name: "Clear search" }).click();
        await expect(search).toHaveValue("");
        await expect(panel.getByRole("button", { name: "Enlarge Colemak preview" })).toBeVisible();
    });

    test("D6 the search clear (x) button has an accessible name", async ({ page }) => {
        // g4-05: the small x inside the search box is an unlabeled icon button.
        test.fail(true, "g4-05: search clear button has no accessible name");
        await openDemo(page);
        await openLayouts(page);
        await page.getByRole("textbox", { name: "Search layouts" }).fill("Dv");
        await shot(page, "g4-05");
        await expect(page.getByRole("button", { name: /clear|reset/i })).toBeVisible({ timeout: 2_000 });
    });

    test("D6 Enlarge preview opens a large view that closes", async ({ page }) => {
        await openDemo(page);
        await openLayouts(page);
        await page.getByRole("button", { name: "Enlarge Dvorak preview" }).click();
        const close = page.getByRole("button", { name: "Close enlarged preview" });
        await expect(close).toBeVisible();
        await close.click();
        await expect(close).toBeHidden();
    });

    test("D6 Escape closes the enlarged preview", async ({ page }) => {
        // g4-06: the enlarged preview is a floating panel that ignores Escape.
        test.fail(true, "g4-06: Escape does not close the enlarged layout preview");
        await openDemo(page);
        await openLayouts(page);
        await page.getByRole("button", { name: "Enlarge Dvorak preview" }).click();
        const close = page.getByRole("button", { name: "Close enlarged preview" });
        await expect(close).toBeVisible();
        await shot(page, "g4-06");
        await page.keyboard.press("Escape");
        await expect(close).toBeHidden({ timeout: 2_000 });
    });

    test("D6 Copy a library layer, then paste it Now onto the current layer", async ({ page }) => {
        await openDemo(page);
        await goLayer(page, 3);
        const before = await canvasLabels(page);
        await openLayouts(page);
        await page.getByRole("button", { name: "Copy Dvorak" }).click();
        const dialog = page.getByRole("dialog").filter({ hasText: "Clipboard has a copy of Dvorak" });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Now" }).click();
        await expect(dialog).toBeHidden();
        const after = await canvasLabels(page);
        expect(after).not.toEqual(before);
        // Dvorak puts these letters on the home row.
        for (const k of ["A", "O", "E", "U"]) expect(after).toContain(k);
    });

    test("D6 Copy, then Later, then Ctrl+V on another layer pastes it", async ({ page }) => {
        await openDemo(page);
        await openLayouts(page);
        await page.getByRole("button", { name: "Copy Colemak" }).click();
        const dialog = page.getByRole("dialog").filter({ hasText: "Clipboard has a copy of Colemak" });
        await dialog.getByRole("button", { name: "Later" }).click();
        await expect(dialog).toBeHidden();
        await goLayer(page, 4);
        await page.locator("body").click({ position: { x: 700, y: 900 } });
        await page.keyboard.press("Control+v");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Now" }).click();
        for (const k of ["A", "R", "S", "T"]) expect(await canvasLabels(page)).toContain(k);
    });

    test("D6 Delete one layer from a saved layout survives a reload", async ({ page }) => {
        await openDemo(page);
        await openLayouts(page);
        await page.getByRole("button", { name: "Delete Graphite" }).click();
        const confirm = page.getByRole("dialog");
        await expect(confirm).toBeVisible();
        await confirm.getByRole("button", { name: /^(Clear|Delete|OK|Yes)/ }).click();
        await expect(confirm).toBeHidden();
        await expect(page.getByRole("button", { name: "Enlarge Graphite preview" })).toHaveCount(0);
        await page.goto("./?demo");
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await openLayouts(page);
        await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Enlarge Graphite preview" })).toHaveCount(0);
    });

    test("D6 Delete a whole layout asks first, then removes it", async ({ page }) => {
        await openDemo(page);
        await openLayouts(page);
        await groupHeader(page, "sval-alt-alphas").getByTitle("Delete layout").click();
        const confirm = page.getByRole("dialog");
        await expect(confirm).toBeVisible();
        await shot(page, "g4-07");
        await confirm.getByRole("button", { name: /^(Clear|Delete)$/ }).click();
        await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toHaveCount(0);
    });

    test("D6 the delete-layout confirm says Delete, matching the button", async ({ page }) => {
        // g4-07: the trash button is "Delete layout", but the confirm reads
        // "Clear Layouts sval-alt-alphas" with a "Clear" button.
        test.fail(true, "g4-07: delete confirm says 'Clear Layouts <name>' / 'Clear'");
        await openDemo(page);
        await openLayouts(page);
        await groupHeader(page, "sval-alt-alphas").getByTitle("Delete layout").click();
        const confirm = page.getByRole("dialog");
        await expect(confirm.getByRole("heading")).toHaveText(/^Delete (layout )?sval-alt-alphas\??$/i, { timeout: 2_000 });
    });

    test("D6 a deleted bundled layout stays deleted after a reload", async ({ page }) => {
        // g4-08: LayoutsPanel re-imports every bundled layout that is missing by
        // name each time it opens, so a deleted default layout comes back.
        test.fail(true, "g4-08: deleted bundled layouts come back after reload");
        await openDemo(page);
        await openLayouts(page);
        await groupHeader(page, "sval-alt-alphas").getByTitle("Delete layout").click();
        await page.getByRole("dialog").getByRole("button", { name: /^(Clear|Delete)$/ }).click();
        await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toHaveCount(0);
        await page.goto("./?demo");
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await page.getByRole("button", { name: "Layouts", exact: true }).click();
        await expect(page.getByRole("textbox", { name: "Search layouts" })).toBeVisible();
        await page.waitForTimeout(1_500);
        await shot(page, "g4-08");
        await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toHaveCount(0);
    });

    test("D6 layout groups show readable names, not file names", async ({ page }) => {
        // g4-09: the bundled groups are titled by file name: sval-default,
        // sval-alt-alphas, sval-num-sym-layers.
        test.fail(true, "g4-09: library group titles are raw file names");
        await openDemo(page);
        await openLayouts(page);
        await shot(page, "g4-09");
        await expect(page.locator('[role=button][aria-expanded]').filter({ hasText: /^sval-/ })).toHaveCount(0, { timeout: 2_000 });
    });
});

test.describe("D7 Layouts > Import", () => {
    test("D7 import a .svil into the library; it persists after reload", async ({ page }) => {
        await openDemo(page);
        await openLayouts(page);
        const js = JSON.parse(ALT_ALPHAS);
        js.cosmetic = { ...(js.cosmetic ?? {}), layer: { ...(js.cosmetic?.layer ?? {}), "0": "Workman Test" } };
        const file = tmpFile("my-alphas.svil", JSON.stringify(js));
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import", exact: true }).click();
        await (await chooser).setFiles(file);
        await expect(page.getByRole("button", { name: "Enlarge Workman Test preview" })).toBeVisible();
        const stored = await page.evaluate(() => localStorage.getItem("keybard-imported-layouts") ?? "");
        expect(stored).toContain("Workman Test");
        await page.goto("./?demo");
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await openLayouts(page);
        await expect(page.getByRole("button", { name: "Enlarge Workman Test preview" })).toBeVisible();
    });

    test("D7 importing a non-layout file into the library shows a clear error", async ({ page, allowConsoleError }) => {
        allowConsoleError(/Failed to import layout/);
        await openDemo(page);
        await openLayouts(page);
        const chooser = page.getByRole("button", { name: "Import", exact: true });
        const fc = page.waitForEvent("filechooser");
        await chooser.click();
        await (await fc).setFiles(tmpFile("notes.json", "{\"hello\": 1}"));
        const panel = page.getByRole("textbox", { name: "Search layouts" }).locator("xpath=ancestor::section[1]");
        await expect(panel.locator(".text-red-600, .dark\\:text-red-400").first()).toBeVisible();
        await expect(panel.getByText(/JSON at position|Unexpected (end|token)|undefined|Cannot read/)).toHaveCount(0);
    });

    test("D7 clearing every layout shows the 'No layouts loaded' empty state", async ({ page }) => {
        await openDemo(page);
        await openLayouts(page);
        for (const name of ["sval-num-sym-layers", "sval-default", "sval-alt-alphas"]) {
            await groupHeader(page, name).getByTitle("Delete layout").click();
            await page.getByRole("dialog").getByRole("button", { name: /^(Clear|Delete)$/ }).click();
            await expect(groupHeader(page, name)).toHaveCount(0);
        }
        await expect(page.getByText("No layouts loaded")).toBeVisible();
    });

    test("D7 the empty-state text is grammatical", async ({ page }) => {
        // g4-10: "save one of your current layers from it's contextual menu".
        test.fail(true, "g4-10: empty state says \"it's\" for \"its\"");
        await openDemo(page);
        await openLayouts(page);
        for (const name of ["sval-num-sym-layers", "sval-default", "sval-alt-alphas"]) {
            await groupHeader(page, name).getByTitle("Delete layout").click();
            await page.getByRole("dialog").getByRole("button", { name: /^(Clear|Delete)$/ }).click();
        }
        await expect(page.getByText("No layouts loaded")).toBeVisible();
        await shot(page, "g4-10");
        await expect(page.getByText(/it's contextual menu/)).toHaveCount(0, { timeout: 1_000 });
    });
});

test.describe("D8 drag a layer from Layouts onto the strip", () => {
    test("D8 drag Colemak onto layer 2: confirm, then OK replaces it", async ({ page }) => {
        await openDemo(page);
        await goLayer(page, 2);
        const before = await canvasLabels(page);
        await openLayouts(page);
        await dragLayerToTab(page, "Colemak", "2");
        const dialog = page.getByRole("dialog").filter({ hasText: /Colemak/ });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("Replace");
        await dialog.getByRole("button", { name: "OK" }).click();
        await expect(dialog).toBeHidden();
        await goLayer(page, 2);
        const after = await canvasLabels(page);
        expect(after).not.toEqual(before);
        for (const k of ["A", "R", "S", "T"]) expect(after).toContain(k);
    });

    test("D8 Cancel in the replace confirm leaves the layer alone", async ({ page }) => {
        await openDemo(page);
        await goLayer(page, 2);
        const before = await canvasLabels(page);
        await openLayouts(page);
        await dragLayerToTab(page, "Colemak", "2");
        const dialog = page.getByRole("dialog").filter({ hasText: /Colemak/ });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toBeHidden();
        expect(await canvasLabels(page)).toEqual(before);
    });
});
