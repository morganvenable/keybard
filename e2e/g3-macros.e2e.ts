// Group 3, macros (C8): add steps of every kind, delete a selected step with
// the Delete key, rename a macro, and see the name in the list and on the key.
// Demo: ?demo=combos (M0 = A, M1 = H I "hello world" 100ms LShift-down A B C LShift-up).
import { test, expect, openDemo } from "./fixtures";
import type { Page } from "@playwright/test";
import { canvasKey, rail, pickerKey, findingShot, openSettings } from "./g3-helpers";

const actions = (page: Page) => page.getByRole("group", { name: "Macro actions" });
const slots = (page: Page) => actions(page).locator("[data-bar-slot]");

async function addAction(page: Page, label: string) {
    await page.getByRole("button", { name: "Add a macro action" }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
}

async function openMacroRow(page: Page, index: number) {
    const panel = page.getByRole("complementary", { name: "Macro Keys" });
    if (!(await panel.isVisible())) await rail(page, "Macro Keys").click();
    // Click the row's number (the name in the row is its own rename button).
    await panel.locator(`[data-binding-row="${index}"]`).click({ position: { x: 14, y: 14 } });
    await expect(page.getByRole("heading", { name: `Editing Macro ${index}` })).toBeVisible();
}

test.describe("C8 macros", () => {
    test("the demo list shows M0 and M1's steps", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, "Macro Keys").click();
        const panel = page.getByRole("complementary", { name: "Macro Keys" });
        await expect(panel.getByRole("button", { name: "Rename Macro 1", exact: true })).toBeVisible();
        await expect(panel.locator('[data-binding-row="1"]')).toContainText("hello world");
        await expect(panel.locator('[data-binding-row="1"]')).toContainText("100ms");
    });

    test("add tap, text, delay, down and up steps; Delete removes the selected step", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openMacroRow(page, 2);
        await expect(slots(page)).toHaveCount(1); // only "Add"

        await addAction(page, "Key Tap");
        await pickerKey(page, "A").click();
        await addAction(page, "Text");
        const text = page.getByRole("textbox", { name: "Macro text" });
        // (Focus on the new step is checked on its own below.)
        await text.fill("hi there");
        await addAction(page, "Delay");
        const delay = page.getByRole("textbox", { name: "Macro delay in milliseconds" });
        await delay.fill("50");
        await addAction(page, "Key Down");
        await pickerKey(page, "L SHIFT").click();
        await addAction(page, "Key Up");
        await pickerKey(page, "L SHIFT").click();

        const labels = await slots(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-bar-slot")));
        expect(labels).toEqual(["Tap", "Text", "Delay (ms)", "Down", "Up", "Add"]);
        await expect(actions(page)).toContainText("A");
        await expect(text).toHaveValue("hi there");
        await expect(delay).toHaveValue("50");

        // Remove the tap step with its clear button (Delete is covered below).
        await slots(page).first().hover();
        await slots(page).first().getByRole("button", { name: "Clear key" }).click();
        const after = await slots(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-bar-slot")));
        expect(after).toEqual(["Text", "Delay (ms)", "Down", "Up", "Add"]);

        // Typing in the text step never deletes steps.
        await text.click();
        await page.keyboard.press("Backspace");
        await expect(text).toHaveValue("hi ther");
        await expect(slots(page)).toHaveCount(5);

        await page.keyboard.press("Escape");
        if (!(await page.getByRole("complementary", { name: "Macro Keys" }).isVisible())) await rail(page, "Macro Keys").click();
        await expect(page.locator('[data-binding-row="2"]')).toContainText("hi ther");
    });

    test("rename a macro from its list row; the name shows in the list, the editor and on the key", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, "Macro Keys").click();
        await page.getByRole("button", { name: "Rename Macro 1", exact: true }).click();
        const input = page.getByRole("textbox", { name: "Rename Macro 1" });
        await expect(input).toBeFocused();
        await input.fill("Greeting");
        await input.press("Enter");
        await expect(page.getByRole("button", { name: "Rename Macro 1: Greeting" })).toBeVisible();

        // Esc cancels a rename.
        await page.getByRole("button", { name: "Rename Macro 1: Greeting" }).click();
        await page.getByRole("textbox", { name: "Rename Macro 1" }).fill("Nope");
        await page.getByRole("textbox", { name: "Rename Macro 1" }).press("Escape");
        await expect(page.getByRole("button", { name: "Rename Macro 1: Greeting" })).toBeVisible();

        // Put M1 on Caps; the key and the inspector carry the name.
        await canvasKey(page, "Caps").click();
        await page.locator('[data-binding-row="1"] [data-keycap]').last().click();
        const key = page.locator('[data-keyboard-instance] [data-key-x][data-keycode="M1"]');
        await expect(key).toHaveCount(1);
        await page.mouse.move(5, 995);
        await key.hover();
        await expect(page.locator('[data-inspector-section="macro"]')).toContainText("Greeting");

        // The editor header shows the name too.
        await openMacroRow(page, 1);
        await expect(page.locator("[data-binding-editor-subtitle]").filter({ visible: true }).first()).toHaveText("Greeting");
    });
});

test.describe("C8 macros: findings", () => {
    test("a new Text step takes the focus, ready to type", async ({ page }) => {
        // g3-04: after Add > Text, focus returns to the Add button, so typing goes nowhere.
        test.fail(true, "g3-04: a new Text step is not focused");
        await openDemo(page, "demo=combos");
        await openMacroRow(page, 2);
        await addAction(page, "Text");
        const text = page.getByRole("textbox", { name: "Macro text" });
        await page.waitForTimeout(300);
        if (!(await text.evaluate((e) => e === document.activeElement))) await findingShot(page, "g3-04");
        await expect(text).toBeFocused();
        await page.keyboard.type("typed");
        await expect(text).toHaveValue("typed");
    });

    test("a renamed macro shows its name on the layout key", async ({ page }) => {
        // g3-03: the key shows the macro's number only; the name shows in the
        // list, the editor header and the inspector, but not on the key or in
        // the key's accessible name. Confirm whether this is intended.
        test.fail(true, "g3-03: a macro's name is not shown on its layout key");
        await openDemo(page, "demo=combos");
        await rail(page, "Macro Keys").click();
        await page.getByRole("button", { name: "Rename Macro 1", exact: true }).click();
        await page.getByRole("textbox", { name: "Rename Macro 1" }).fill("Greeting");
        await page.getByRole("textbox", { name: "Rename Macro 1" }).press("Enter");
        await canvasKey(page, "Caps").click();
        await page.locator('[data-binding-row="1"] [data-keycap]').last().click();
        const key = page.locator('[data-keyboard-instance] [data-key-x][data-keycode="M1"]');
        await expect(key).toHaveCount(1);
        await page.mouse.move(5, 995);
        if (!/Greeting/i.test((await key.textContent()) || "")) await findingShot(page, "g3-03");
        await expect(key).toContainText(/Greeting/i, { timeout: 2_000 });
        await expect(key).toHaveAttribute("aria-label", /Greeting/);
    });
});

test.describe("C8 macros: Delete on a selected step", () => {
    async function threeSteps(page: Page) {
        await openMacroRow(page, 2);
        for (const k of ["A", "B", "C"]) {
            await addAction(page, "Key Tap");
            await pickerKey(page, k).click();
        }
        await expect(slots(page)).toHaveCount(4);
    }

    test("with Typing Binds a Key off, Delete removes the selected step", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openSettings(page);
        const sw = page.getByRole("switch", { name: "Typing Binds a Key" }).or(page.getByRole("group", { name: "Typing Binds a Key" }).getByRole("button", { name: "OFF", exact: true }));
        await sw.first().click();
        await threeSteps(page);
        await slots(page).nth(1).locator("[data-editor-slot]").click();
        await page.keyboard.press("Delete");
        await expect(slots(page)).toHaveCount(3);
        await expect(actions(page)).not.toContainText("B");
    });

    test("with the default settings, Delete removes the selected step", async ({ page }) => {
        // g3-05: Typing Binds a Key is on by default, and then Delete binds
        // Del into the selected step instead of removing it.
        test.fail(true, "g3-05: Delete binds Del into a selected macro step instead of removing it");
        await openDemo(page, "demo=combos");
        await threeSteps(page);
        await slots(page).nth(1).locator("[data-editor-slot]").click();
        await page.keyboard.press("Delete");
        await page.waitForTimeout(300);
        if ((await slots(page).count()) === 4) await findingShot(page, "g3-05");
        await expect(slots(page)).toHaveCount(3, { timeout: 2_000 });
    });
});
