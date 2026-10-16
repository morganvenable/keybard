// Group 5, area E14: owner-review URL params (railMode, pickerShape, comboEditor,
// foldIdle, pinCue, spot, spotLight, railJoin, railBar). Each value must render
// without console errors or side-panel overflow, and none may save anything.
import { test, expect, openDemo } from "./fixtures";
import { rail, sidePanel, storageSnapshot, expectNoSidePanelOverflow, clippedElements, known, findingShot } from "./g5-helpers";

type Case = { param: string; values: string[]; editor?: boolean };
const CASES: Case[] = [
    { param: "railMode", values: ["lift", "collapse", "modal"], editor: true },
    { param: "pickerShape", values: ["rect", "L"] },
    { param: "comboEditor", values: ["half", "dock", "anchored", "float", "panel"], editor: true },
    { param: "foldIdle", values: ["0", "5000"] },
    { param: "pinCue", values: ["shadow", "divider", "notch"], editor: true },
    { param: "spot", values: ["medium", "soft", "deep"], editor: true },
    { param: "spotLight", values: ["text", "tint", "pill"], editor: true },
    { param: "railJoin", values: ["tuck", "gutter"], editor: true },
    { param: "railBar", values: ["flush", "gap2", "kiss"] },
];

for (const c of CASES) {
    for (const v of c.values) {
        test(`E14 ?${c.param}=${v} renders cleanly and saves nothing`, async ({ page }) => {
            // Baseline: what a plain load stores.
            await openDemo(page, "demo=combos");
            const before = await storageSnapshot(page);

            const extra = c.editor ? `&edit=combo:0${c.param === "pinCue" ? "&comboEditor=panel" : ""}` : "";
            await openDemo(page, `demo=combos&${c.param}=${v}${extra}`);
            if (c.editor) {
                // The combo editor is open on combo 0 ("Quick escape").
                await expect(page.getByText("Quick escape").filter({ visible: true }).first()).toBeVisible();
            } else {
                await rail(page, "Standard Keys").click();
                await expect(sidePanel(page)).toBeVisible();
            }
            // Variant hooks that the page exposes for some params.
            if (c.param === "comboEditor") {
                if (v === "panel") await expect(sidePanel(page)).toHaveAttribute("data-editor-placement", "panel");
                else await expect(sidePanel(page)).toHaveAttribute("data-combo-placement", v);
                // Wherever it is placed, the editor is fully inside the window.
                const ed = page.locator("[aria-label='Binding editor']").filter({ visible: true }).first();
                const box = (await ed.boundingBox())!;
                const vp = page.viewportSize()!;
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
                expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
            }
            if (c.param === "pickerShape" && v === "L") await expect(sidePanel(page)).toHaveAttribute("data-picker-shape", "L");
            if (c.param === "railBar") await expect(page.locator(`[data-rail-bar='${v}']`)).toHaveCount(1);
            if (c.param === "pinCue") await expect(page.locator(`[data-pin-cue='${v}']`)).toHaveCount(1);
            if (c.param === "railMode" && v === "collapse") await expect(page.locator("html")).toHaveAttribute("data-rail-mode", "collapse");
            await expectNoSidePanelOverflow(page);
            // (The combo editor's Clear key buttons are checked on hover in the g5-08 test below.)
            expect(await clippedElements(page, "nav button, aside.detail-panel button:not([aria-label='Clear key'])")).toEqual([]);
            // Escape leaves the editor; the page stays usable.
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-keyboard-instance] [data-key-x]").first()).toBeVisible();

            // Nothing was saved by the param: a plain reload matches the baseline.
            await openDemo(page, "demo=combos");
            expect(await storageSnapshot(page)).toEqual(before);
        });
    }
}

test("E14 unknown review values fall back without errors", async ({ page }) => {
    await openDemo(page, "demo=combos&railMode=zzz&pickerShape=zzz&comboEditor=zzz&foldIdle=-5&pinCue=zzz&spot=zzz&edit=combo:0");
    await expect(page.getByText("Quick escape").filter({ visible: true }).first()).toBeVisible();
    await expectNoSidePanelOverflow(page);
});

// g5-08: in the half, anchored and float placements the first trigger key's Clear
// (trash) button, shown on hover to the key's left, is cut off by the editor card.
for (const placement of ["panel", "half", "dock", "anchored", "float"]) {
    test(`E14 ?comboEditor=${placement}: the hover Clear button of trigger key 1 is fully visible`, async ({ page }) => {
        if (["half", "anchored", "float"].includes(placement)) known("g5-08", "Clear key button of Key 1 is clipped by the editor card");
        await openDemo(page, `demo=combos&edit=combo:0&comboEditor=${placement}`);
        const clear = page.getByRole("button", { name: "Clear key" }).filter({ visible: true }).first();
        const wrap = clear.locator("xpath=ancestor::*[contains(@class,'group/editorkey')][1]");
        const wb = (await wrap.boundingBox())!;
        await page.mouse.move(wb.x + wb.width - 8, wb.y + wb.height / 2);
        await expect(clear.locator("xpath=../..")).toHaveCSS("opacity", "1");
        const cut = await clippedElements(page, "button[aria-label='Clear key']");
        if (cut.length) await findingShot(page, "g5-08");
        expect(cut).toEqual([]);
    });
}
