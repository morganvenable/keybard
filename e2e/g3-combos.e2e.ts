// Group 3, combos: folded-corner indicators, the hover readout, the Combo
// Indicators settings, adding, editing and clearing a combo, and where the
// combo editor sits. Demo layout: ?demo=combos (combo 0 F+D -> Esc "Quick
// escape", combo 1 J+K -> Enter, combo 2 S+D+F -> Tab "Next field").
import { test, expect, openDemo, CANVAS_KEY, editorHeading } from "./fixtures";
import type { Page } from "@playwright/test";
import {
    canvasKey, rail, sidePanel, editor, spotlightOn, openSettings, findingShot,
    overflowingElements, pickerKey,
} from "./g3-helpers";

const fold = (page: Page, key: string) => canvasKey(page, key).locator("svg[data-combo-fold]");

async function keyBoxes(page: Page) {
    const read = () => page.locator(CANVAS_KEY).evaluateAll((els) =>
        els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(","); }));
    // Wait for the layout to settle (fonts, auto-size) before comparing.
    let last = await read();
    for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(150);
        const next = await read();
        if (next.join("|") === last.join("|")) return next;
        last = next;
    }
    return last;
}

/** Open a combo's editor from its row in the Combos panel. */
async function openComboRow(page: Page, index: number) {
    const panel = page.getByRole("complementary", { name: "Combos" });
    if (!(await panel.isVisible())) await rail(page, "Combos").click();
    await expect(panel).toBeVisible();
    const named = panel.locator(`[data-combo-row="${index}"]`);
    if (await named.count()) await named.click();
    else await panel.getByText(String(index), { exact: true }).first().click();
    await expect(editorHeading(page, `Editing Combo ${index}`)).toBeVisible();
}

test.describe("C1 combo folded corners", () => {
    test("member keys carry folds in combo-number order, others none", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await expect(fold(page, "F")).toHaveAttribute("data-combo-order", "0,2");
        await expect(fold(page, "D")).toHaveAttribute("data-combo-order", "0,2");
        await expect(fold(page, "S")).toHaveAttribute("data-combo-order", "2");
        await expect(fold(page, "J")).toHaveAttribute("data-combo-order", "1");
        await expect(fold(page, "K")).toHaveAttribute("data-combo-order", "1");
        await expect(fold(page, "Q")).toHaveCount(0);
        await expect(fold(page, "A")).toHaveCount(0);
    });

    test("each combo keeps one color on every key it marks", async ({ page }) => {
        await openDemo(page, "demo=combos");
        const fillOf = (key: string, combo: number) =>
            fold(page, key).locator(`polygon[data-fold-piece="${combo}"]`).first().getAttribute("fill");
        const c2 = await Promise.all(["S", "D", "F"].map((k) => fillOf(k, 2)));
        expect(new Set(c2).size, `combo 2 fills ${c2}`).toBe(1);
        const c0 = await Promise.all(["F", "D"].map((k) => fillOf(k, 0)));
        expect(new Set(c0).size).toBe(1);
        expect(c0[0]).not.toBe(c2[0]);
        const c1 = await fillOf("J", 1);
        expect([c0[0], c2[0]]).not.toContain(c1);
    });

    test("a key in four combos draws only the three lowest", async ({ page }) => {
        await openDemo(page, "demo=combos");
        // Combo 3: F + G -> X, combo 4: F + V -> Y, made in the editor.
        for (const [i, other, out] of [[3, "G", "X"], [4, "V", "Y"]] as const) {
            await openComboRow(page, i);
            await canvasKey(page, "F").click();
            await canvasKey(page, other).click();
            await page.getByRole("group", { name: "Combo output" }).click();
            await pickerKey(page, out).click();
            await page.keyboard.press("Escape");
            await expect(editorHeading(page, `Editing Combo ${i}`)).toHaveCount(0);
        }
        await page.mouse.move(5, 995); // no row or key previewed
        await expect(fold(page, "F")).toHaveAttribute("data-combo-order", "0,2,3");
        await expect(fold(page, "F").locator("polygon[data-fold-piece]")).toHaveCount(3);
        // No overflow mark and no numerals.
        await expect(fold(page, "F").locator("text")).toHaveCount(0);
        await expect(fold(page, "V")).toHaveAttribute("data-combo-order", "4");
    });
});

test.describe("C2 hover readout", () => {
    test("hover shows the named combo, leaving fades it, a click pins it, Esc clears", async ({ page }) => {
        await openDemo(page, "demo=combos");
        const before = await keyBoxes(page);
        const card = page.locator('[data-key-inspector="card"]');
        await canvasKey(page, "D").hover();
        await expect(card).toBeVisible();
        await expect(card.locator("[data-inspector-title]")).toHaveText("D");
        const line0 = card.locator('[data-readout-combo="0"]');
        await expect(line0).toContainText("Quick escape");
        await expect(line0.getByLabel(/F plus D gives Esc/)).toBeVisible();
        await expect(line0).toContainText(/F\s*\+\s*D\s*→\s*Esc/i);
        await expect(card.locator('[data-readout-combo="2"]')).toContainText("Next field");
        expect(await keyBoxes(page), "keys moved while the card showed").toEqual(before);

        // Leave the keyboard: the card fades away.
        await page.mouse.move(5, 995);
        await expect(card).toHaveCount(0, { timeout: 2_000 });

        // Click to pin: the card stays after the mouse leaves.
        await canvasKey(page, "F").click();
        await page.mouse.move(5, 995);
        await expect(card).toBeVisible();
        await expect(card).toContainText("Pinned · Esc clears");
        await expect(card.locator('[data-readout-combo="0"]')).toContainText("Quick escape");
        expect(await keyBoxes(page), "keys moved while pinned").toEqual(before);

        await page.keyboard.press("Escape");
        await expect(card).toHaveCount(0, { timeout: 2_000 });
        expect(await keyBoxes(page)).toEqual(before);
    });

    test("an unnamed combo reads by its number", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await canvasKey(page, "J").hover();
        const line = page.locator('[data-key-inspector="card"] [data-readout-combo="1"]');
        await expect(line).toContainText("Combo 1");
        await expect(line).toContainText(/J\s*\+\s*K\s*→\s*Enter/i);
    });

    test("hovering a combo row in the panel lights its keys on the layout", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, "Combos").click();
        await page.locator('[data-combo-row="1"]').hover();
        await expect(page.locator('[data-combo-row="1"]')).toHaveAttribute("data-lit", "true");
        // Keys J and K show their fold large; F does not (it is not in combo 1).
        await expect(fold(page, "J").locator("[data-fold-big]")).toHaveCount(1);
        await expect(fold(page, "F").locator("[data-fold-big]")).toHaveCount(0);
    });
});

test.describe("C3 Combo Indicators setting", () => {
    test("Off hides folds, Small and Large show them; Colorblind swaps the palette; all persist", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openSettings(page);
        const sel = page.getByRole("combobox", { name: "Combo Indicators", exact: true });
        await sel.selectOption({ label: "Off" });
        await expect(page.locator(`${CANVAS_KEY} svg[data-combo-fold]`)).toHaveCount(0);

        await sel.selectOption({ label: "Large" });
        await expect(fold(page, "F")).toHaveCount(1);
        const large = await fold(page, "F").locator("[data-fold-scale]").evaluate((g) => getComputedStyle(g).transform);

        await sel.selectOption({ label: "Small" });
        await expect(fold(page, "F")).toHaveCount(1);
        await page.mouse.move(5, 995); // at rest, away from the keyboard
        await page.waitForTimeout(600);
        const small = await fold(page, "F").locator("[data-fold-scale]").evaluate((g) => getComputedStyle(g).transform);
        expect(small, "Small draws the fold smaller at rest than Large").not.toBe(large);

        const cb = page.getByRole("switch", { name: "Colorblind-Friendly Combo Colors" });
        await cb.click();
        await expect(page.locator("html")).toHaveAttribute("data-combo-palette", "colorblind");
        await expect(fold(page, "F").locator("polygon[data-fold-texture]").first()).toBeAttached();

        await page.reload();
        await expect(page.getByRole("button", { name: "QWERTY Example", exact: true }).or(page.locator(CANVAS_KEY).first())).toBeVisible({ timeout: 20_000 });
        await openDemo(page, "demo=combos");
        await expect(page.locator("html")).toHaveAttribute("data-combo-palette", "colorblind");
        await openSettings(page);
        await expect(page.getByRole("combobox", { name: "Combo Indicators", exact: true })).toHaveValue("small");
        await expect(page.getByRole("switch", { name: "Colorblind-Friendly Combo Colors" })).toHaveAttribute("aria-checked", "true");

        await page.getByRole("combobox", { name: "Combo Indicators", exact: true }).selectOption({ label: "Off" });
        await openDemo(page, "demo=combos");
        await expect(page.locator(`${CANVAS_KEY} svg[data-combo-fold]`)).toHaveCount(0);
    });
});

test.describe("C4 add a combo", () => {
    test("pick two trigger keys on the canvas and an output; the row and folds appear; OFF and ON", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openComboRow(page, 3);
        expect(await spotlightOn(page)).toBe(true);
        // The first trigger slot is selected; canvas clicks fill it and move on.
        await canvasKey(page, "Q").click();
        await expect(page.getByRole("group", { name: "Trigger key 1" })).toContainText("Q");
        await canvasKey(page, "W").click();
        await expect(page.getByRole("group", { name: "Trigger key 2" })).toContainText("W");
        await page.getByRole("group", { name: "Combo output" }).click();
        await pickerKey(page, "ESC").click();
        await expect(page.getByRole("group", { name: "Combo output" })).toContainText(/esc/i);

        await page.keyboard.press("Escape");
        await expect(editorHeading(page, "Editing Combo 3")).toHaveCount(0);
        if (!(await page.getByRole("complementary", { name: "Combos" }).isVisible())) await rail(page, "Combos").click();
        await expect(page.getByRole("button", { name: "Combo 3: Q plus W gives Esc", exact: true })).toBeVisible();
        const row = page.locator('[data-combo-row="3"]');
        await expect(fold(page, "Q")).toHaveAttribute("data-combo-order", "3");
        await expect(fold(page, "W")).toHaveAttribute("data-combo-order", "3");

        // OFF: the row dims and the canvas no longer marks the keys as an active combo.
        const fill = () => fold(page, "Q").locator('polygon[data-fold-piece="3"]').getAttribute("fill");
        const onFill = await fill();
        await row.getByRole("button", { name: "OFF", exact: true }).click();
        await expect(row.getByRole("button", { name: "OFF", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect.poll(fill).not.toBe(onFill);
        await expect(row).toHaveAttribute("aria-label", /Combo 3.*off|off.*Combo 3/i);
        await row.getByRole("button", { name: "ON", exact: true }).click();
        await expect.poll(fill).toBe(onFill);
        await expect(row).toHaveAttribute("aria-label", "Combo 3: Q plus W gives Esc");
    });

    test("Combo Timeout is offered only with a board connected", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, "Combos").click();
        // Offline draft: no keyboard writes, so the firmware timeout is not shown.
        await expect(page.getByText("Combo Timeout")).toHaveCount(0);
    });
});

const PLACEMENTS = [
    { value: "panel", label: "In the side panel" },
    { value: "half", label: "Under a half" },
    { value: "dock", label: "Below the keyboard" },
    { value: "anchored", label: "Under the combo's keys" },
    { value: "float", label: "Floating" },
] as const;

test.describe("C5 binding editor placement", () => {
    for (const p of PLACEMENTS) {
        test(`${p.value}: combo 0 opens there, covers nothing, fits, Esc closes`, async ({ page }) => {
            await openDemo(page, "demo=combos");
            await openSettings(page);
            await page.getByRole("combobox", { name: "Binding Editor Placement", exact: true }).selectOption({ label: p.label });
            await openComboRow(page, 0);
            const ed = editor(page);
            await expect(ed).toBeVisible();
            await expect(ed.getByRole("group", { name: "Trigger key 1" })).toContainText("F");
            await page.waitForTimeout(500); // placement motion
            // The editor covers no key of the layout.
            const covered = await page.evaluate(({ sel }) => {
                const ed = document.querySelector(".binding-workspace")!.getBoundingClientRect();
                return Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((k) => {
                    const r = k.getBoundingClientRect();
                    return r.width > 0 && r.left < ed.right - 1 && r.right > ed.left + 1 && r.top < ed.bottom - 1 && r.bottom > ed.top + 1;
                }).map((k) => k.getAttribute("aria-label")?.split(":")[0]);
            }, { sel: CANVAS_KEY });
            expect(covered, "layout keys under the editor").toEqual([]);
            // The editor is fully on screen.
            const box = (await ed.boundingBox())!;
            const vp = page.viewportSize()!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
            expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
            // Nothing pokes out of the side panel.
            // A card placed outside the panel is checked against the window above.
            expect(await overflowingElements(sidePanel(page), p.value === "panel" ? "" : ".binding-workspace")).toEqual([]);
            // (The slot clear buttons are checked on their own below.)
            expect(await overflowingElements(ed, "[data-editor-slot] .absolute")).toEqual([]);
            await page.keyboard.press("Escape");
            await expect(ed).toHaveCount(0);
            expect(await spotlightOn(page)).toBe(false);
        });
    }
});

test.describe("C6 edit and clear a combo", () => {
    test("removing a trigger, clearing the output and clearing the combo update the layout live", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openComboRow(page, 2);
        const t1 = page.getByRole("group", { name: "Trigger key 1" });
        await expect(t1).toContainText("S");
        await t1.hover();
        await t1.getByRole("button", { name: "Clear key" }).click();
        await expect(t1).not.toContainText("S");
        await expect(fold(page, "S")).toHaveCount(0);
        // While combo 2 is edited, its member keys show only combo 2.
        await expect(fold(page, "F")).toHaveAttribute("data-combo-order", "2");

        const out = page.getByRole("group", { name: "Combo output" });
        await out.hover();
        await out.getByRole("button", { name: "Clear key" }).click();
        await expect(out).not.toContainText(/tab/i);

        await page.getByRole("button", { name: "Clear Next field" }).click();
        const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /^(Clear|Delete|Yes|Confirm)/ }).click();
        await page.keyboard.press("Escape");
        await expect(fold(page, "F")).toHaveAttribute("data-combo-order", "0");
        await expect(fold(page, "D")).toHaveAttribute("data-combo-order", "0");
        await rail(page, "Combos").click();
        await expect(page.locator('[data-combo-row="2"]')).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Next field \(Combo 2\)/ })).toHaveCount(0);
    });
});

test.describe("C5 slot clear buttons stay inside the editor card", () => {
    for (const p of PLACEMENTS.filter((x) => x.value !== "panel")) {
        const fails = ["half", "anchored", "float"].includes(p.value);
        test(`${p.value}: hovering the first trigger shows its clear button inside the card`, async ({ page }) => {
            // g3-01: in the Under a half, Under the combo's keys and Floating cards,
            // the first slot's clear (trash) button sits on the card's left border,
            // half outside the card.
            test.fail(fails, "g3-01: slot clear button straddles the editor card's edge");
            await openDemo(page, "demo=combos");
            await openSettings(page);
            await page.getByRole("combobox", { name: "Binding Editor Placement", exact: true }).selectOption({ label: p.label });
            await openComboRow(page, 0);
            const ed = editor(page);
            await page.waitForTimeout(500);
            const t1 = ed.getByRole("group", { name: "Trigger key 1" });
            await t1.hover();
            const clear = t1.getByRole("button", { name: "Clear key" });
            await expect(clear).toBeVisible();
            const c = (await clear.boundingBox())!;
            const e = (await ed.boundingBox())!;
            if (fails && c.x < e.x) await findingShot(page, "g3-01");
            expect(c.x, "clear button left edge vs card left edge").toBeGreaterThanOrEqual(e.x);
            expect(c.x + c.width).toBeLessThanOrEqual(e.x + e.width);
        });
    }
});
