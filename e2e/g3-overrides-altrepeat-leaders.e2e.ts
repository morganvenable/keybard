// Group 3: key overrides (C9), alt-repeat (C10) and leader sequences (C11).
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import type { Page } from "@playwright/test";
import { canvasKey, rail, pickerKey, openSettings, findingShot, overflowingElements, sidePanel } from "./g3-helpers";

const slot = (page: Page, label: string) => page.locator(`[data-bar-slot="${label}"]`).first();

async function openRow(page: Page, railName: string, panelName: string | RegExp, index: number, heading: string) {
    const panel = page.getByRole("complementary", { name: panelName });
    if (!(await panel.isVisible())) await rail(page, railName).click();
    await expect(panel).toBeVisible();
    await panel.locator(`[data-binding-row="${index}"]`).click({ position: { x: 14, y: 14 } });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

test.describe("C9 key overrides", () => {
    test("Shift + Bksp -> Del on layers 0 and 1: the row and the inspector read it; options fit the panel", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openRow(page, "Overrides", "Overrides", 0, "Editing Override 0");
        await expect(slot(page, "Trigger").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "BACKSP").click();
        await expect(slot(page, "Trigger")).toContainText(/bksp|backsp/i);
        await expect(slot(page, "Replacement").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "DEL").click();
        await expect(slot(page, "Replacement")).toContainText(/del/i);

        const options = page.getByRole("button", { name: "Options" });
        await options.click();
        await expect(options).toHaveAttribute("aria-expanded", "true");
        await page.getByRole("button", { name: "Trigger", exact: true }).click();
        const ed = page.locator(".binding-workspace");
        await ed.getByRole("button", { name: "SHIFT", exact: true }).click();
        // Layers: keep 0 and 1 only.
        const layers = ed.getByText("Layers", { exact: true }).locator("xpath=..");
        for (let i = 2; i < 16; i++) await layers.getByText(String(i), { exact: true }).click();
        await ed.getByRole("group", { name: "Override enabled" }).getByRole("button", { name: "ON", exact: true }).click();

        // The options fit the side panel.
        expect(await overflowingElements(sidePanel(page))).toEqual([]);

        await page.getByRole("button", { name: "Go back" }).click();
        const panel = page.getByRole("complementary", { name: "Overrides" });
        if (!(await panel.isVisible())) await rail(page, "Overrides").click();
        const row = panel.locator('[data-binding-row="0"]');
        await expect(row).toContainText(/bksp|backsp/i);
        await expect(row).toContainText(/del/i);
        // (The row leaving out Shift is checked on its own below.)

        // The Bksp key's inspector lists the override with its layers.
        await page.mouse.move(5, 995);
        await canvasKey(page, "Bksp").hover();
        const sec = page.locator('[data-key-inspector="card"] [data-inspector-section="overrides"]');
        await expect(sec).toBeVisible();
        await expect(sec).toContainText("Override 0");
        await expect(sec).toContainText(/shift/i);
        await expect(sec).toContainText("Layers 0, 1");
    });

    test("the list row shows the trigger's modifiers", async ({ page }) => {
        // g3-10: the Overrides row draws only "Bksp -> Del", so Shift + Bksp -> Del
        // reads as a plain remap of Bksp. The inspector does show the Shift.
        test.fail(true, "g3-10: the Overrides list row leaves out the trigger modifiers");
        await openDemo(page, "demo=combos");
        await openRow(page, "Overrides", "Overrides", 0, "Editing Override 0");
        await pickerKey(page, "BACKSP").click();
        await pickerKey(page, "DEL").click();
        await page.getByRole("button", { name: "Options" }).click();
        await page.locator(".binding-workspace").getByRole("button", { name: "SHIFT", exact: true }).click();
        await page.getByRole("button", { name: "Go back" }).click();
        const panel = page.getByRole("complementary", { name: "Overrides" });
        if (!(await panel.isVisible())) await rail(page, "Overrides").click();
        const row = panel.locator('[data-binding-row="0"]');
        await expect(row).toContainText(/bksp/i);
        if (!/shift|⇧/i.test((await row.textContent()) || "")) await findingShot(page, "g3-10");
        await expect(row).toContainText(/shift|⇧/i, { timeout: 2_000 });
    });

    test("override modifier choices never leave one choice alone on a line", async ({ page }) => {
        // g3-06: in the side panel the trigger Modifiers row wraps "GUI" onto
        // a line of its own under NONE / SHIFT / CTRL / ALT.
        test.fail(true, "g3-06: GUI wraps alone in the override Modifiers row");
        await openDemo(page, "demo=combos");
        await openRow(page, "Overrides", "Overrides", 0, "Editing Override 0");
        await page.getByRole("button", { name: "Options" }).click();
        const ed = page.locator(".binding-workspace");
        const gui = ed.getByRole("button", { name: "GUI", exact: true });
        const none = ed.getByRole("button", { name: "NONE", exact: true });
        const g = (await gui.boundingBox())!, n = (await none.boundingBox())!;
        if (Math.abs(g.y - n.y) > 4) await findingShot(page, "g3-06");
        expect(Math.abs(g.y - n.y), "GUI sits on the same line as NONE").toBeLessThanOrEqual(4);
    });

    test("override layer toggles work from the keyboard", async ({ page }) => {
        // g3-08: the 16 layer toggles are plain divs: no role, no focus, no state.
        test.fail(true, "g3-08: override layer toggles are not keyboard reachable and have no pressed state");
        await openDemo(page, "demo=combos");
        await openRow(page, "Overrides", "Overrides", 0, "Editing Override 0");
        await page.getByRole("button", { name: "Options" }).click();
        const ed = page.locator(".binding-workspace");
        const layer3 = ed.getByRole("button", { name: "3", exact: true });
        if (!(await layer3.count())) {
            await ed.getByText("Layers", { exact: true }).scrollIntoViewIfNeeded();
            await findingShot(page, "g3-08");
        }
        await expect(layer3).toHaveCount(1, { timeout: 2_000 });
        await expect(layer3).toHaveAttribute("aria-pressed", "true");
    });
});

test.describe("C10 alt-repeat", () => {
    test("the rail item appears only with Show Alt-Repeat on, and the setting persists", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await expect(rail(page, "Alt-Repeat")).toHaveCount(0);
        await openSettings(page);
        const sw = page.getByRole("switch", { name: "Show Alt-Repeat" });
        await sw.click();
        await expect(sw).toHaveAttribute("aria-checked", "true");
        await expect(rail(page, "Alt-Repeat")).toBeVisible();

        await openDemo(page, "demo=combos");
        await expect(rail(page, "Alt-Repeat")).toBeVisible();

        await openSettings(page);
        await page.getByRole("switch", { name: "Show Alt-Repeat" }).click();
        await expect(rail(page, "Alt-Repeat")).toHaveCount(0);
        await openDemo(page, "demo=combos");
        await expect(rail(page, "Alt-Repeat")).toHaveCount(0);
    });

    test("empty state in the bottom bar, then add Q -> W", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openSettings(page);
        await page.getByRole("switch", { name: "Show Alt-Repeat" }).click();
        await rail(page, "Alt-Repeat").click();
        const panel = page.getByRole("complementary", { name: "Alt-Repeat" });
        await expect(panel).toBeVisible();
        await expect(panel.getByText(/Alt-Repeat keys remap/)).toBeVisible();

        // Bottom bar: the empty state reads "No alt-repeat keys configured."
        await page.getByRole("button", { name: "Bottom bar layout" }).click();
        await expect(page.getByText("No alt-repeat keys configured.")).toBeVisible();
        await page.getByRole("button", { name: "Sidebar layout" }).click();

        await openRow(page, "Alt-Repeat", "Alt-Repeat", 0, "Editing Alt-Repeat 0");
        const slots = page.locator(".binding-workspace [data-bar-slot]");
        await expect(slots).toHaveCount(2);
        await pickerKey(page, "Q").click();
        await pickerKey(page, "W").click();
        await expect(slots.nth(0)).toContainText("Q");
        await expect(slots.nth(1)).toContainText("W");
        await page.getByRole("button", { name: "Go back" }).click();
        const row = page.getByRole("complementary", { name: "Alt-Repeat" }).locator('[data-binding-row="0"]');
        await expect(row).toContainText("Q");
        await expect(row).toContainText("W");
        await expect(page.getByText("No alt-repeat keys configured.")).toHaveCount(0);
    });

    test("the inspector names Alt-Repeat the way the rail does", async ({ page }) => {
        // g3-09: the rail and panel say "Alt-Repeat"; the key inspector says
        // "Alt Repeat" (section title and row labels).
        test.fail(true, "g3-09: the inspector says 'Alt Repeat', the rail 'Alt-Repeat'");
        await openDemo(page, "demo=combos");
        await openSettings(page);
        await page.getByRole("switch", { name: "Show Alt-Repeat" }).click();
        await openRow(page, "Alt-Repeat", "Alt-Repeat", 0, "Editing Alt-Repeat 0");
        await pickerKey(page, "Q").click();
        await pickerKey(page, "W").click();
        await page.getByRole("button", { name: "Go back" }).click();
        await page.mouse.move(5, 995);
        await canvasKey(page, "Q").hover();
        const sec = page.locator('[data-key-inspector="card"] [data-inspector-section="altrepeat"]');
        await expect(sec).toBeVisible();
        if (!(await sec.textContent())?.includes("Alt-Repeat")) await findingShot(page, "g3-09");
        await expect(sec.locator("h3")).toHaveText(/Alt-Repeat/);
    });
});

test.describe("C11 leader sequences", () => {
    test("a five-key sequence stays on one line in the list and the editor", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openRow(page, "Leaders", /Leader/, 0, "Editing Leader 0");
        const seq = page.getByRole("group", { name: "Leader sequence", exact: true });
        await expect(seq).toBeVisible();
        for (const k of ["A", "S", "D", "F", "G"]) await pickerKey(page, k).click();
        // After five keys the output slot is selected.
        await expect(slot(page, "Output").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "ESC").click();
        for (const [i, k] of ["A", "S", "D", "F", "G"].entries()) await expect(slot(page, `Key ${i + 1}`)).toContainText(k);
        await expect(slot(page, "Output")).toContainText(/esc/i);
        const slotTops = await seq.locator("[data-bar-slot]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
        expect(slotTops.length).toBe(6);
        expect(Math.max(...slotTops) - Math.min(...slotTops), "editor slots on one line").toBeLessThanOrEqual(4);
        expect(await overflowingElements(sidePanel(page))).toEqual([]);

        await page.getByRole("button", { name: "Go back" }).click();
        const panel = page.getByRole("complementary", { name: /Leader/ });
        if (!(await panel.isVisible())) await rail(page, "Leaders").click();
        const row = panel.locator('[data-binding-row="0"]');
        await expect(row).toContainText("A");
        await expect(row).toContainText("G");
        // The five keys and the output sit on one line.
        const keys = row.locator("[data-keycap]");
        const tops = await keys.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
        expect(tops.length).toBe(6);
        expect(Math.max(...tops) - Math.min(...tops), "sequence row on one line").toBeLessThanOrEqual(4);
        expect(await overflowingElements(sidePanel(page))).toEqual([]);
        await expect(row.getByRole("group").getByRole("button", { name: "ON", exact: true })).toBeVisible();

        // The inspector lists the leader on its keys.
        await page.mouse.move(5, 995);
        await canvasKey(page, "G").hover();
        await expect(page.locator('[data-key-inspector="card"] [data-inspector-section="leaders"]')).toContainText("Leader 0");
    });

    test("Leader Timeout and Per-key timing are offered only with a board connected", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, "Leaders").click();
        await expect(page.getByText("Leader Timeout")).toHaveCount(0);
        await expect(page.getByText("Per-key timing")).toHaveCount(0);
        // The placeable Leader key is offered.
        await expect(page.getByRole("complementary", { name: /Leader/ }).locator("[data-keycap]").first()).toContainText(/leader/i);
    });

    test("the panel title matches its rail item", async ({ page }) => {
        // g3-07 (F-leaders-title): the rail says "Leaders", the panel heading
        // "Leader Sequences", and the editor "Editing Leader 0".
        test.fail(true, "g3-07: rail 'Leaders' vs panel heading 'Leader Sequences'");
        await openDemo(page, "demo=combos");
        await rail(page, "Leaders").click();
        const heading = page.getByRole("complementary").getByRole("heading", { level: 2 }).first();
        await expect(heading).toBeVisible();
        if ((await heading.textContent())?.trim() !== "Leaders") await findingShot(page, "g3-07");
        await expect(heading).toHaveText("Leaders");
    });

    test("a placed Leader key reads Leader on the layout", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await canvasKey(page, "Caps").click();
        await rail(page, "Leaders").click();
        await page.getByRole("complementary", { name: /Leader/ }).locator("[data-keycap]").first().click();
        await expect(page.locator(`${CANVAS_KEY}[data-keycode="QK_LEADER"]`)).toHaveCount(1);
    });
});

test.describe("C9-C11 a filled entry is switched on", () => {
    // g3-11: a combo, tap dance or key override you fill in turns ON, but an
    // alt-repeat key or a leader sequence you fill in stays OFF, so it does
    // nothing until you notice the toggle.
    const cases = [
        { name: "alt-repeat", rail: "Alt-Repeat", panel: "Alt-Repeat" as string | RegExp, heading: "Editing Alt-Repeat 0", keys: ["Q", "W"], group: "Alt-repeat enabled", alt: true },
        { name: "leader", rail: "Leaders", panel: /Leader/ as string | RegExp, heading: "Editing Leader 0", keys: ["A", "S", "D", "F", "G", "ESC"], group: "Leader sequence enabled", alt: false },
    ];
    for (const c of cases) {
        test(`a new ${c.name} is ON once it has keys`, async ({ page }) => {
            test.fail(true, "g3-11: new overrides, alt-repeat keys and leaders stay OFF");
            await openDemo(page, "demo=combos");
            if (c.alt) {
                await openSettings(page);
                await page.getByRole("switch", { name: "Show Alt-Repeat" }).click();
            }
            await openRow(page, c.rail, c.panel, 0, c.heading);
            for (const k of c.keys) await pickerKey(page, k).click();
            const on = page.locator(".binding-workspace").getByRole("group", { name: /enabled/ }).getByRole("button", { name: "ON", exact: true });
            if ((await on.getAttribute("aria-pressed")) !== "true" && c.name === "leader") await findingShot(page, "g3-11");
            await expect(on).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
        });
    }

    test("a new override is ON once it has keys", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openRow(page, "Overrides", "Overrides", 0, "Editing Override 0");
        const on = page.getByRole("group", { name: "Override enabled" }).getByRole("button", { name: "ON", exact: true });
        await expect(on).toHaveAttribute("aria-pressed", "false");
        await pickerKey(page, "BACKSP").click();
        await pickerKey(page, "DEL").click();
        await expect(on).toHaveAttribute("aria-pressed", "true");
    });
});
