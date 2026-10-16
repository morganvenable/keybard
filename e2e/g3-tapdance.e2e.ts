// Group 3, tap dance (C7): open a tap dance, fill its four actions and the
// tapping term, put TD(n) on a layout key, and read it in the key inspector.
// Demo: ?demo=combos (TD0 = A / hold LCtrl, TD1 = Esc / double-tap Lock).
import { test, expect, openDemo } from "./fixtures";
import type { Page } from "@playwright/test";
import { canvasKey, rail, pickerKey, spotlightOn, findingShot } from "./g3-helpers";

const slot = (page: Page, label: string) => page.locator(`[data-bar-slot="${label}"]`).first();

async function openTapDanceRow(page: Page, index: number) {
    const panel = page.getByRole("complementary", { name: "Tap Dance Keys" });
    if (!(await panel.isVisible())) await rail(page, "Tap Dance Keys").click();
    await panel.locator(`[data-binding-row="${index}"]`).click({ position: { x: 14, y: 14 } });
    await expect(page.getByRole("heading", { name: `Editing Tap Dance ${index}` })).toBeVisible();
}

test.describe("C7 tap dance", () => {
    test("the demo list shows TD0 and TD1 with their actions", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, "Tap Dance Keys").click();
        const panel = page.getByRole("complementary", { name: "Tap Dance Keys" });
        for (const h of ["Tap", "Hold", "Tap-Hold", "Double-Tap"]) await expect(panel.getByText(h, { exact: true }).first()).toBeVisible();
        await expect(panel.locator('[data-binding-row="0"]')).toContainText(/A/);
        await expect(panel.locator('[data-binding-row="1"]')).toContainText(/Esc/i);
    });

    test("fill all four actions in order, set the term, assign TD(2) and read it on the key", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openTapDanceRow(page, 2);
        expect(await spotlightOn(page)).toBe(true);
        // The Tap slot is selected first; each pick moves to the next slot on screen.
        await expect(slot(page, "Tap").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "X").click();
        await expect(slot(page, "Hold").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "TAB").click();
        await expect(slot(page, "Tap-Hold").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "Q").click();
        await expect(slot(page, "Double-Tap").locator("[data-editor-slot]")).toHaveAttribute("data-editor-slot-selected", "");
        await pickerKey(page, "ESC").click();
        await expect(slot(page, "Tap")).toContainText("X");
        await expect(slot(page, "Hold")).toContainText(/tab/i);
        await expect(slot(page, "Tap-Hold")).toContainText("Q");
        await expect(slot(page, "Double-Tap")).toContainText(/esc/i);

        const term = page.getByRole("spinbutton", { name: "Tapping term in milliseconds" });
        await term.fill("250");
        await term.press("Tab");
        await expect(term).toHaveValue("250");

        // (Esc after Tab is covered by its own test; leave with the back arrow.)
        await page.getByRole("button", { name: "Go back" }).click();
        await expect(page.getByRole("heading", { name: "Editing Tap Dance 2" })).toHaveCount(0);
        expect(await spotlightOn(page)).toBe(false);

        // The list row shows the four actions.
        const row = page.locator('[data-binding-row="2"]');
        if (!(await row.isVisible())) await rail(page, "Tap Dance Keys").click();
        await expect(row).toContainText("X");

        // Assign TD(2) to Caps: select the key, click the row's key.
        await canvasKey(page, "Caps").click();
        await page.locator('[data-binding-row="2"] [data-keycap]').last().click();
        const key = page.locator('[data-keyboard-instance] [data-key-x][data-keycode="TD(2)"]');
        await expect(key).toHaveCount(1);
        await expect(key).toHaveAttribute("aria-label", "TD 2");
        await expect(key).toContainText("2");

        // The inspector lists the actions and the term.
        await page.mouse.move(5, 995);
        await key.hover();
        const sec = page.locator('[data-key-inspector="card"] [data-inspector-section="tapdance"]');
        await expect(sec).toBeVisible();
        await expect(sec).toContainText("Tap Dance 2");
        await expect(sec).toContainText(/Tap\s*X/);
        await expect(sec).toContainText(/Hold\s*Tab/i);
        await expect(sec).toContainText(/Double-?\s*Tap\s*Esc/i);
        await expect(sec).toContainText("250 ms");
    });

    test("the tapping term field rejects nonsense and keeps a number", async ({ page }) => {
        await openDemo(page, "demo=combos&edit=tapdance:0");
        const term = page.getByRole("spinbutton", { name: "Tapping term in milliseconds" });
        await expect(term).toHaveValue("200");
        await term.fill("-50");
        await term.press("Tab");
        await expect(term).toHaveValue("0");
        await term.fill("99999");
        await term.press("Tab");
        await expect(term).toHaveValue("32767");
    });

    test("OFF in the editor shows as off in the key inspector", async ({ page }) => {
        await openDemo(page, "demo=combos");
        // Put TD(0) on Caps first.
        await canvasKey(page, "Caps").click();
        await rail(page, "Tap Dance Keys").click();
        await page.locator('[data-binding-row="0"] [data-keycap]').last().click();
        await openTapDanceRow(page, 0);
        const toggle = page.getByRole("group", { name: "Tap dance enabled" });
        await toggle.getByRole("button", { name: "OFF", exact: true }).click();
        await expect(toggle.getByRole("button", { name: "OFF", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "Go back" }).click();
        await page.mouse.move(5, 995);
        const td0 = page.locator('[data-keyboard-instance] [data-key-x][data-keycode="TD(0)"]').first();
        await td0.hover();
        const sec = page.locator('[data-key-inspector="card"] [data-inspector-section="tapdance"]');
        await expect(sec).toContainText("Tap Dance 0");
        await expect(sec.locator("h3")).toContainText("off");
    });

    test("Esc closes the editor after using one of its buttons", async ({ page }) => {
        // g3-02: Esc is ignored while focus is on any button, so after the
        // ON/OFF toggle (or tabbing out of the term field) Esc does nothing.
        test.fail(true, "g3-02: Esc does not close the binding editor after a click on one of its buttons");
        await openDemo(page, "demo=combos&edit=tapdance:0");
        const toggle = page.getByRole("group", { name: "Tap dance enabled" });
        await toggle.getByRole("button", { name: "OFF", exact: true }).click();
        await toggle.getByRole("button", { name: "ON", exact: true }).click();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
        if (await page.getByRole("heading", { name: "Editing Tap Dance 0" }).count()) await findingShot(page, "g3-02");
        await expect(page.getByRole("heading", { name: "Editing Tap Dance 0" })).toHaveCount(0);
    });

    test("Esc closes the editor after tabbing out of the term field", async ({ page }) => {
        test.fail(true, "g3-02: Esc does not close the binding editor after a click on one of its buttons");
        await openDemo(page, "demo=combos&edit=tapdance:0");
        const term = page.getByRole("spinbutton", { name: "Tapping term in milliseconds" });
        await term.fill("225");
        await term.press("Tab");
        await page.keyboard.press("Escape");
        await expect(page.getByRole("heading", { name: "Editing Tap Dance 0" })).toHaveCount(0);
    });
});

test.describe("C7 tap dance editor labels", () => {
    test("the slot labels under the keys are clearly apart", async ({ page }) => {
        // g3-15: "Tap-Hold" and "Double-Tap" sit 4px apart under 40px keys,
        // so they read as one phrase ("Tap-Hold Double-Tap").
        test.fail(true, "g3-15: tap dance slot labels nearly touch");
        await openDemo(page, "demo=combos&edit=tapdance:0");
        const labels = await page.locator('[data-editor-bar-row] [data-bar-slot] > span:last-child').evaluateAll((els) =>
            els.map((e) => ({ t: e.textContent, l: e.getBoundingClientRect().left, r: e.getBoundingClientRect().right, y: e.getBoundingClientRect().top })));
        const gaps = labels.slice(1).filter((b, i) => Math.abs(b.y - labels[i].y) < 3).map((b, i) => ({ pair: `${labels[i].t} | ${b.t}`, gap: Math.round(b.l - labels[i].r) }));
        const tight = gaps.filter((g) => g.gap < 6);
        if (tight.length) await findingShot(page, "g3-15");
        expect(tight, "labels closer than 6px").toEqual([]);
    });
});
