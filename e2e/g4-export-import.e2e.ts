// Group 4, flows D1, D2, D4, D5: export from the toolbar, import it back,
// import bad files, and load a file from the landing page.
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { stubSavePicker, savedFiles, tmpFile, shot, ROOT } from "./g4-helpers";
import fs from "node:fs";
import path from "node:path";

const DEMO_SVIL = path.resolve(ROOT, "src/default-layouts/sval-default.svil");

/** Rename the current layer from its badge (Enter commits). */
async function renameLayer(page: import("@playwright/test").Page, layer: number, name: string) {
    await page.getByRole("button", { name: new RegExp(`^Rename layer ${layer}:`) }).click();
    const input = page.getByRole("textbox", { name: `Rename layer ${layer}` });
    await input.fill(name);
    await input.press("Enter");
    await expect(page.getByRole("button", { name: `Rename layer ${layer}: ${name}` })).toBeVisible();
}

async function exportFromToolbar(page: import("@playwright/test").Page, opts: { format?: "svil" | "vil"; macros?: boolean } = {}) {
    await page.getByRole("button", { name: "Export Layout" }).click();
    const dialog = page.getByRole("dialog", { name: "Export Keyboard Configuration" });
    await expect(dialog).toBeVisible();
    if (opts.format === "vil") {
        await dialog.getByRole("combobox", { name: "Export format" }).click();
        await page.getByRole("option", { name: /\.vil/ }).click();
    }
    if (opts.macros === false) await dialog.getByRole("switch").click();
    const before = (await savedFiles(page)).length;
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await savedFiles(page)).length).toBe(before + 1);
    return (await savedFiles(page))[before];
}

test.describe("D1 export layout", () => {
    test.beforeEach(async ({ page }) => { await stubSavePicker(page); });

    test("D1 .svil keeps layer names, colors and combo names", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await renameLayer(page, 0, "Home Row");
        await page.getByRole("button", { name: "Change color for layer 0" }).click();
        const choice = page.locator("[data-color-choice][aria-pressed=false]").first();
        const colorName = await choice.getAttribute("aria-label");
        await choice.click();
        const file = await exportFromToolbar(page);
        expect(file.name).toMatch(/\.svil$/);
        const js = JSON.parse(file.content);
        expect(js.cosmetic.layer["0"]).toBe("Home Row");
        expect(String(js.cosmetic.layer_colors["0"]).toLowerCase()).toBe(String(colorName).toLowerCase());
        expect(js.cosmetic.combos).toMatchObject({ "0": "Quick escape", "2": "Next field" });
        expect((js.macro as unknown[]).some((m) => Array.isArray(m) && m.length > 0)).toBe(true);
    });

    test("D1 .svil without macros leaves the macros out", async ({ page }) => {
        await openDemo(page, "demo=combos");
        const file = await exportFromToolbar(page, { macros: false });
        const js = JSON.parse(file.content);
        expect((js.macro ?? []).every((m: unknown[]) => !m || m.length === 0)).toBe(true);
    });

    test("D1 .vil export has the .vil extension and no Sval names", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await renameLayer(page, 0, "Home Row");
        const file = await exportFromToolbar(page, { format: "vil" });
        expect(file.name).toMatch(/\.vil$/);
        expect(file.content).not.toContain("Home Row");
        expect(file.content).not.toContain("Quick escape");
    });

    // g4-01: the toolbar export dialog does not say what .vil leaves out.
    // Settings > Export... does ("Legacy .vil omits Sval-specific settings, names, colors ...").
    test("D1 the toolbar export dialog says what .vil leaves out", async ({ page }) => {
        test.fail(true, "g4-01: toolbar Export dialog has no note that .vil drops names and colors");
        await openDemo(page);
        await page.getByRole("button", { name: "Export Layout" }).click();
        const dialog = page.getByRole("dialog", { name: "Export Keyboard Configuration" });
        await dialog.getByRole("combobox", { name: "Export format" }).click();
        await page.getByRole("option", { name: /\.vil/ }).click();
        await shot(page, "g4-01");
        await expect(dialog).toContainText(/names|colors/i, { timeout: 2_000 });
    });

    test("D1 cancelling the save dialog is not an error", async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).showSaveFilePicker = async () => { throw new DOMException("The user aborted a request.", "AbortError"); };
        });
        await openDemo(page);
        await page.getByRole("button", { name: "Export Layout" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Export", exact: true }).click();
        await page.waitForTimeout(500);
        expect(await savedFiles(page)).toEqual([]);
        await expect(page.getByRole("alert").filter({ hasText: /abort/i })).toHaveCount(0, { timeout: 1_000 });
    });
});

test.describe("D2 import the exported layout", () => {
    test.beforeEach(async ({ page }) => { await stubSavePicker(page); });

    test("D2 import review then Open layout restores the exported state", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await renameLayer(page, 0, "Exported Name");
        const file = await exportFromToolbar(page);
        const p = tmpFile("roundtrip.svil", file.content);

        // A fresh session (the demo again), then import the file.
        await page.goto("./?demo=combos");
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: /^Rename layer 0: Layer 0/ })).toBeVisible();
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import Layout" }).click();
        await (await chooser).setFiles(p);
        const review = page.getByRole("dialog", { name: "Review layout import" });
        await expect(review).toBeVisible();
        await expect(review).toContainText("roundtrip.svil");
        await expect(review.getByRole("listitem").first()).toBeVisible();
        await review.getByRole("button", { name: "Open layout" }).click();
        await expect(review).toBeHidden();
        await expect(page.getByRole("button", { name: "Rename layer 0: Exported Name" })).toBeVisible();
        // The combo names came back too.
        await page.getByRole("button", { name: "Combos", exact: true }).click();
        await expect(page.getByText("Quick escape").first()).toBeVisible();
    });

    test("D2 Cancel in the review keeps the current layout", async ({ page }) => {
        await openDemo(page);
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import Layout" }).click();
        await (await chooser).setFiles(path.resolve(ROOT, "public/sample-keyboard.vil"));
        const review = page.getByRole("dialog", { name: "Review layout import" });
        await expect(review).toBeVisible();
        await review.getByRole("button", { name: "Cancel" }).click();
        await expect(review).toBeHidden();
        await expect(page.getByText(/QWERTY example \(demo\)/).first()).toBeVisible();
    });

    test("D2 import after an offline edit opens the review", async ({ page }) => {
        await openDemo(page);
        await page.locator(CANVAS_KEY).first().click();
        await page.keyboard.press("Delete");
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import Layout" }).click();
        await (await chooser).setFiles(DEMO_SVIL);
        const review = page.getByRole("dialog", { name: "Review layout import" });
        await expect(review).toBeVisible();
        await expect(review).toContainText("This replaces the current offline layout.");
        await review.getByRole("button", { name: "Cancel" }).click();
    });
});

test.describe("D4 bad files", () => {
    for (const [label, name, content, pattern] of [
        ["an empty file", "empty.svil", "", /Invalid|Unknown|empty|file/i],
        ["malformed JSON", "broken.svil", "{\"uid\": 1, \"layout\": [", /Invalid|JSON|Unknown/i],
        ["JSON that is not a layout", "other.json", "{\"hello\": \"world\"}", /Unknown file format/i],
    ] as const) {
        test(`D4 importing ${label} shows a clear error and keeps the layout`, async ({ page, allowConsoleError }) => {
            // g4-02: a malformed file shows the raw parser text ("Unexpected end of JSON input").
            test.fail(name === "broken.svil", "g4-02: raw JSON parser message shown to the user");
            allowConsoleError(/Failed to (load|import|parse)|SyntaxError|Unexpected end|Unknown file format/i);
            await openDemo(page);
            const chooser = page.waitForEvent("filechooser");
            await page.getByRole("button", { name: "Import Layout" }).click();
            await (await chooser).setFiles(tmpFile(name, content));
            const err = page.getByRole("alert").filter({ hasText: pattern });
            await expect(err.first()).toBeVisible();
            await expect(page.locator(CANVAS_KEY).first()).toBeVisible();
            const text = (await err.first().textContent()) ?? "";
            if (name === "broken.svil") await shot(page, "g4-02");
            // A clear message, not a raw JavaScript parser message.
            expect(text, "the error text should be written for a person").not.toMatch(/Unexpected (end|token)|JSON\.parse|at position/);
        });
    }

    test("D4 a .svil with more combos than the board supports", async ({ page, allowConsoleError }) => {
        allowConsoleError(/combo/i);
        await openDemo(page);
        const js = JSON.parse(fs.readFileSync(DEMO_SVIL, "utf8"));
        const one = (js.combo as unknown[])[0];
        js.combo = Array.from({ length: (js.combo as unknown[]).length + 40 }, () => one);
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import Layout" }).click();
        await (await chooser).setFiles(tmpFile("too-many-combos.svil", JSON.stringify(js)));
        const review = page.getByRole("dialog", { name: "Review layout import" });
        const alert = page.getByRole("alert");
        await expect(review.or(alert.first())).toBeVisible();
        // Offline there is no board to compare with; the review must at least open
        // without a crash, and the app must stay usable.
        if (await review.isVisible()) {
            await review.getByRole("button", { name: "Open layout" }).click();
        }
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible();
    });
});

test.describe("D5 landing page Load File", () => {
    test("D5 Load File opens the editor with that layout", async ({ page }) => {
        await page.goto("./");
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Load File", exact: true }).click();
        await (await chooser).setFiles(DEMO_SVIL);
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByText(/sval-default\.svil/).first()).toBeVisible();
    });

    // g4-02: the landing page shows "Expected property name or '}' in JSON at position 1 (line 1 column 2)".
    test("D5 Load File with a bad file shows a clear error on the landing page", async ({ page, allowConsoleError }) => {
        test.fail(true, "g4-02: raw JSON parser message shown to the user");
        allowConsoleError(/./);
        await page.goto("./");
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Load File", exact: true }).click();
        await (await chooser).setFiles(tmpFile("broken.svil", "{not json"));
        await page.waitForTimeout(500);
        await shot(page, "g4-02-landing");
        await expect(page.getByRole("button", { name: "QWERTY Example", exact: true })).toBeVisible();
        await expect(page.getByText(/JSON at position|Unexpected (end|token)/)).toHaveCount(0, { timeout: 2_000 });
        await expect(page.getByText(/Invalid JSON|Invalid file|not a layout/i).first()).toBeVisible({ timeout: 2_000 });
    });
});
