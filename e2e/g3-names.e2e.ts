// Group 3, binding names (C12): rename a combo and a tap dance from the
// editor title (Enter commits, Esc cancels); the name shows in the list, the
// key inspector, and survives an export and import of the .svil file.
import { test, expect, openDemo, editorHeading } from "./fixtures";
import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import { canvasKey, rail, openSettings, findingShot } from "./g3-helpers";

async function usePlacement(page: Page, label: string) {
    await openSettings(page);
    await page.getByRole("combobox", { name: "Binding Editor Placement", exact: true }).selectOption({ label });
}

async function openCombo(page: Page, index: number) {
    const panel = page.getByRole("complementary", { name: "Combos" });
    if (!(await panel.isVisible())) await rail(page, "Combos").click();
    const row = panel.locator(`[data-combo-row="${index}"]`);
    if (await row.count()) await row.click();
    else await panel.locator(`[data-binding-row="${index}"]`).click({ position: { x: 14, y: 14 } });
}

test.describe("C12 binding names", () => {
    test("rename a combo from its editor title (Under a half): Enter commits, Esc cancels", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await usePlacement(page, "Under a half");
        await openCombo(page, 1);
        const title = page.getByRole("button", { name: "Rename Combo 1" });
        await expect(title).toBeVisible();
        await title.click();
        const input = page.getByRole("textbox", { name: "Combo name" });
        await expect(input).toBeFocused();
        await input.fill("Submit");
        await input.press("Enter");
        await expect(page.getByRole("button", { name: "Rename Submit" })).toBeVisible();

        // Esc cancels an edit and keeps the old name, and leaves the editor open.
        await page.getByRole("button", { name: "Rename Submit" }).click();
        await page.getByRole("textbox", { name: "Combo name" }).fill("Discard me");
        await page.getByRole("textbox", { name: "Combo name" }).press("Escape");
        await expect(page.getByRole("button", { name: "Rename Submit" })).toBeVisible();
        await expect(page.locator(".binding-workspace")).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.locator(".binding-workspace")).toHaveCount(0);
        // The list row and the inspector show the name.
        const panel = page.getByRole("complementary", { name: "Combos" });
        if (!(await panel.isVisible())) await rail(page, "Combos").click();
        await expect(page.getByRole("button", { name: "Submit (Combo 1): J plus K gives Enter", exact: true })).toBeVisible();
        await expect(page.locator('[data-combo-row="1"] [data-combo-row-name]')).toHaveText("Submit");
        await page.mouse.move(5, 995);
        await canvasKey(page, "J").hover();
        await expect(page.locator('[data-key-inspector="card"] [data-readout-combo="1"]')).toContainText("Submit");
    });

    test("a combo name survives export and import of the .svil file", async ({ page }, testInfo) => {
        // Chromium's save picker cannot be driven; without it the app downloads the file.
        await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
        await openDemo(page, "demo=combos");
        await usePlacement(page, "Under a half");
        await openCombo(page, 1);
        await page.getByRole("button", { name: "Rename Combo 1" }).click();
        await page.getByRole("textbox", { name: "Combo name" }).fill("Submit");
        await page.getByRole("textbox", { name: "Combo name" }).press("Enter");
        await page.keyboard.press("Escape");

        await page.getByRole("button", { name: "Export Layout" }).click();
        const dialog = page.getByRole("dialog", { name: "Export Keyboard Configuration" });
        await expect(dialog.getByRole("combobox", { name: "Export format" })).toContainText(".svil");
        const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Export", exact: true }).click()]);
        expect(download.suggestedFilename()).toMatch(/\.svil$/);
        const file = testInfo.outputPath(download.suggestedFilename());
        await download.saveAs(file);
        const svil = JSON.parse(fs.readFileSync(file, "utf8"));
        expect(JSON.stringify(svil)).toContain("Submit");
        expect(JSON.stringify(svil)).toContain("Quick escape");

        // A fresh demo, then import the file: the names come back.
        await openDemo(page, "demo=combos");
        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Import Layout" }).click()]);
        await chooser.setFiles(file);
        const review = page.getByRole("dialog", { name: "Review layout import" });
        await expect(review).toBeVisible();
        await review.getByRole("button", { name: "Open layout" }).click();
        await expect(review).toHaveCount(0);
        await rail(page, "Combos").click();
        await expect(page.getByRole("button", { name: "Submit (Combo 1): J plus K gives Enter", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Quick escape (Combo 0): F plus D gives Esc", exact: true })).toBeVisible();
    });

    test("rename a combo from the editor title with the default placement", async ({ page }) => {
        // Was g3-12 (no rename in the side panel placement); fixed by the combo
        // names work: an unnamed combo offers "Name this combo", a named one
        // renames from its title.
        await openDemo(page, "demo=combos&edit=combo:1");
        await expect(editorHeading(page, "Editing Combo 1")).toBeVisible();
        await page.getByRole("button", { name: "Name this combo" }).click();
        const field = page.getByRole("textbox").first();
        await field.fill("Submit");
        await field.press("Enter");
        await expect(page.locator("[data-combo-editor-title]").filter({ visible: true }).first()).toContainText("Submit");
        await expect(page.getByRole("button", { name: /^Submit, rename Combo 1$/ })).toBeVisible();
    });

    test("rename a tap dance from the editor title", async ({ page }) => {
        // g3-13: tap dances have names (the editor and inspector show them), but
        // no placement offers a rename control for a tap dance anywhere.
        test.fail(true, "g3-13: a tap dance cannot be renamed");
        await openDemo(page, "demo=combos&edit=tapdance:0");
        await expect(page.getByRole("heading", { name: "Editing Tap Dance 0" })).toBeVisible();
        const rename = page.getByRole("button", { name: /^Rename Tap Dance/ });
        if (!(await rename.count())) await findingShot(page, "g3-13");
        await expect(rename).toBeVisible({ timeout: 2_000 });
        await rename.click();
        await page.getByRole("textbox").first().fill("Ctrl or A");
        await page.keyboard.press("Enter");
        await expect(page.locator("[data-binding-editor-subtitle]").filter({ visible: true }).first()).toHaveText("Ctrl or A");
    });

    test("a tap dance list row offers a rename, like a macro row", async ({ page }) => {
        test.fail(true, "g3-13: a tap dance cannot be renamed");
        await openDemo(page, "demo=combos");
        await rail(page, "Tap Dance Keys").click();
        await expect(page.getByRole("button", { name: /^Rename Tap Dance 0/ })).toBeVisible({ timeout: 2_000 });
    });
});
