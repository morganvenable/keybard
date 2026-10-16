// Group 3: the binding spotlight (C13) and the key inspector's "where else
// used" sections (C14).
import { test, expect, openDemo } from "./fixtures";
import type { Page } from "@playwright/test";
import { canvasKey, rail, pickerKey, spotlightOn, openSettings } from "./g3-helpers";

const editing = (page: Page, what: string) => page.getByRole("heading", { name: `Editing ${what}` });

async function scrimAlpha(page: Page) {
    // The page-wide scrim (the strongest one) is what dims the page.
    const all = await page.locator("[data-binding-scrim]").evaluateAll((els) => els.map((e) => {
        const c = getComputedStyle(e).backgroundColor;
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return { color: c, alpha: 1 };
        const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { color: c, alpha: parts.length > 3 ? parts[3] : 1 };
    }));
    return all.sort((a, b) => b.alpha - a.alpha)[0];
}

test.describe("C13 binding spotlight", () => {
    for (const theme of ["light", "dark"] as const) {
        test(`${theme}: clicks outside never exit; rail pickers switch; the scrim dims`, async ({ page }) => {
            await openDemo(page, `demo=combos&theme=${theme}&edit=combo:0`);
            await expect(editing(page, "Combo 0")).toBeVisible();
            expect(await spotlightOn(page)).toBe(true);
            await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b).*$/);
            const scrim = await scrimAlpha(page);
            expect(scrim.alpha, `scrim ${scrim.color}`).toBeGreaterThan(0.05);
            expect(scrim.alpha).toBeLessThan(0.95);

            // A click on empty canvas: the editor stays; the hint names the way out.
            const canvas = page.getByRole("region", { name: "Keyboard canvas" });
            const box = (await canvas.boundingBox())!;
            await page.mouse.click(box.x + box.width - 20, box.y + box.height - 20);
            await expect(editing(page, "Combo 0")).toBeVisible();
            await expect(page.getByRole("status").filter({ hasText: "Done with Combo 0? Go back to use the rest." })).toHaveCount(1);

            // A picker category on the rail switches the picker, the editor stays.
            await rail(page, "Special Keys").click();
            await expect(editing(page, "Combo 0")).toBeVisible();
            await expect(page.getByRole("button", { name: "Special Keys" }).first()).toHaveAttribute("aria-pressed", "true");
            await rail(page, "Layer Keys").click();
            await expect(editing(page, "Combo 0")).toBeVisible();
            await expect(page.getByRole("button", { name: "Layer Keys" }).first()).toHaveAttribute("aria-pressed", "true");

            // A rail item that is not a picker (Layouts) does not exit either.
            await rail(page, "Layouts").click({ force: true });
            await expect(editing(page, "Combo 0")).toBeVisible();
            expect(await spotlightOn(page)).toBe(true);

            // The back arrow exits.
            await page.getByRole("button", { name: "Go back" }).click();
            await expect(editing(page, "Combo 0")).toHaveCount(0);
            expect(await spotlightOn(page)).toBe(false);
            await expect(page.locator("[data-binding-scrim]")).toHaveCount(0);
        });
    }

    test("a tap dance editor keeps Standard Keys when Tap Dance Keys is chosen on the rail", async ({ page }) => {
        await openDemo(page, "demo=combos&edit=tapdance:1");
        await expect(editing(page, "Tap Dance 1")).toBeVisible();
        await rail(page, "Tap Dance Keys").click({ force: true });
        await expect(editing(page, "Tap Dance 1")).toBeVisible();
        // A tap dance cannot hold a tap dance: the picker does not offer TD keys.
        await expect(page.locator('[data-binding-row] [data-keycap]').filter({ visible: true })).toHaveCount(0);
    });

    test("a canvas key click while editing a combo fills the slot, it does not select the key", async ({ page }) => {
        await openDemo(page, "demo=combos&edit=combo:1");
        await page.getByRole("group", { name: "Trigger key 2" }).click();
        await canvasKey(page, "L").click();
        await expect(page.getByRole("group", { name: "Trigger key 2" })).toContainText("L");
        await expect(editing(page, "Combo 1")).toBeVisible();
    });
});

async function makeCombo(page: Page, index: number, keys: string[], out: string) {
    const panel = page.getByRole("complementary", { name: "Combos" });
    if (!(await panel.isVisible())) await rail(page, "Combos").click();
    await panel.locator(`[data-binding-row="${index}"]`).click({ position: { x: 14, y: 14 } });
    await expect(editing(page, `Combo ${index}`)).toBeVisible();
    for (const k of keys) await canvasKey(page, k).click();
    await page.getByRole("group", { name: "Combo output" }).click();
    await pickerKey(page, out).click();
    await page.getByRole("button", { name: "Go back" }).click();
    await expect(editing(page, `Combo ${index}`)).toHaveCount(0);
}

async function openRow(page: Page, railName: string, panelName: string | RegExp, index: number, heading: string) {
    const panel = page.getByRole("complementary", { name: panelName });
    if (!(await panel.isVisible())) await rail(page, railName).click();
    await panel.locator(`[data-binding-row="${index}"]`).click({ position: { x: 14, y: 14 } });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

test.describe("C14 key inspector: where else used", () => {
    test("a key in a combo, a tap dance, a macro, an override and a leader lists each", async ({ page }) => {
        test.setTimeout(90_000);
        await openDemo(page, "demo=combos");
        // A is M0's step and TD0's tap already. Add a combo, an override and a leader.
        await makeCombo(page, 3, ["A", "Z"], "X");
        await openRow(page, "Overrides", "Overrides", 0, "Editing Override 0");
        await pickerKey(page, "A").click();
        await pickerKey(page, "B").click();
        await page.getByRole("button", { name: "Go back" }).click();
        await openRow(page, "Leaders", /Leader/, 0, "Editing Leader 0");
        await pickerKey(page, "A").click();
        await pickerKey(page, "S").click();
        await page.getByRole("group", { name: "Leader sequence", exact: true }).locator('[data-bar-slot="Output"] [data-editor-slot]').click();
        await pickerKey(page, "ESC").click();
        await page.getByRole("button", { name: "Go back" }).click();

        await page.mouse.move(5, 995);
        await canvasKey(page, "A").hover();
        const card = page.locator('[data-key-inspector="card"]');
        await expect(card).toBeVisible();
        await expect(card.locator('[data-inspector-section="combos"]')).toContainText("Combo 3");
        await expect(card.locator('[data-inspector-section="overrides"]')).toContainText("Override 0");
        await expect(card.locator('[data-inspector-section="leaders"]')).toContainText("Leader 0");
        const used = card.locator('[data-inspector-section="used"]');
        await expect(used).toContainText(/Tap Dance 0/);
        await expect(used).toContainText(/Macro 0/);
        // The card fits the window.
        const b = (await card.boundingBox())!;
        expect(b.y + b.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    });

    test("over six combos: hovering lists six and '+N More Combos'; pinning lists all", async ({ page }) => {
        test.setTimeout(120_000);
        await openDemo(page, "demo=combos");
        // F is in combos 0 and 2; add five more with F.
        const others = ["G", "V", "R", "T", "C"];
        for (const [n, k] of others.entries()) await makeCombo(page, 3 + n, ["F", k], "X");
        await page.mouse.move(5, 995);
        await canvasKey(page, "F").hover();
        const card = page.locator('[data-key-inspector="card"]');
        await expect(card).toContainText("in 7 combos");
        await expect(card.locator("[data-readout-combo]")).toHaveCount(6);
        await expect(card.locator("[data-inspector-more-combos]")).toHaveText("+1 More Combos");
        // Combos past the fold cap of three (0, 2, 3 are drawn) say so.
        await expect(card.locator('[data-readout-combo="3"] [data-readout-not-shown]')).toHaveCount(0);
        await expect(card.locator('[data-readout-combo="4"] [data-readout-not-shown]')).toHaveText("not shown on key");

        await canvasKey(page, "F").click();
        await page.mouse.move(5, 995);
        await expect(card).toContainText("Pinned · Esc clears");
        await expect(card.locator("[data-readout-combo]")).toHaveCount(7);
        await expect(card.locator("[data-inspector-more-combos]")).toHaveCount(0);
        // A pinned card scrolls when it is taller than its lane; every row can be reached.
        await card.locator('[data-readout-combo="7"]').scrollIntoViewIfNeeded();
        await expect(card.locator('[data-readout-combo="7"]')).toBeInViewport();
        await page.keyboard.press("Escape");
        await expect(card).toHaveCount(0);
    });

    test("Combo Indicators Off still lists combos in the inspector, without color marks", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openSettings(page);
        await page.getByRole("combobox", { name: "Combo Indicators", exact: true }).selectOption({ label: "Off" });
        await page.mouse.move(5, 995);
        await canvasKey(page, "F").hover();
        const card = page.locator('[data-key-inspector="card"]');
        await expect(card.locator('[data-readout-combo="0"]')).toContainText("Quick escape");
        await expect(card.locator("[data-fold-glyph]")).toHaveCount(0);
    });
});
