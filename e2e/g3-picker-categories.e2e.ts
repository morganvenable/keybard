// Group 3, picker categories while a binding editor is open: the panel has no
// category icon column of its own, and the rail's picker categories switch the
// picker for every editor kind, in the side layout, the bottom bar and at a
// narrow width. Demo layout only: ?demo=combos.
import { test, expect, openDemo, editorHeading } from "./fixtures";
import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import { rail, sidePanel, overflowingElements } from "./g3-helpers";

const SHOT = "C:/Users/morga/Svalboard/tools/corner-viewer/img/combo/no-icon-column.png";

const CATEGORIES = [
    { id: "keyboard", title: "Standard Keys" },
    { id: "pointing", title: "Pointing Devices" },
    { id: "special", title: "Special Keys" },
    { id: "layers", title: "Layer Keys" },
    { id: "mouse", title: "Mouse Keys" },
    { id: "tapdances", title: "Tap Dance Keys" },
    { id: "macros", title: "Macro Keys" },
];

const EDITORS = [
    { kind: "macro", panel: "Macro Keys", heading: "Editing Macro 1", own: "macros" },
    { kind: "combo", panel: "Combos", heading: "Editing Combo 0", own: null },
    { kind: "tap dance", panel: "Tap Dance Keys", heading: "Editing Tap Dance 0", own: "tapdances" },
] as const;

async function openEditor(page: Page, e: typeof EDITORS[number]) {
    const panel = page.getByRole("complementary", { name: e.panel });
    if (!(await panel.isVisible())) await rail(page, e.panel).click();
    await expect(panel).toBeVisible();
    if (e.kind === "combo") {
        const named = panel.locator('[data-combo-row="0"]');
        if (await named.count()) await named.click();
        else await panel.getByText("0", { exact: true }).first().click();
    } else {
        const index = /(\d+)$/.exec(e.heading)![1];
        const row = panel.locator(`[data-binding-row="${index}"]`);
        // The bottom bar lists cards without row markers: open the card by its name.
        if (await row.count()) await row.click({ position: { x: 14, y: 14 } });
        else await panel.locator("div.cursor-pointer")
            .filter({ has: page.getByRole("button", { name: `Rename ${e.heading.replace(/^Editing /, "")}`, exact: true }) })
            .first().click({ position: { x: 4, y: 4 } });
    }
    await expect(editorHeading(page, e.heading)).toBeVisible();
}

async function expectNoIconColumn(page: Page) {
    await expect(page.locator("[data-picker-rail]")).toHaveCount(0);
    await expect(page.locator("[data-picker-strip]")).toHaveCount(0);
    // No category buttons inside the panel: only the rail carries them.
    for (const c of CATEGORIES) {
        await expect(sidePanel(page).getByRole("button", { name: c.title, exact: true })).toHaveCount(0);
    }
}

/** The rail item the picker shows (the rail marks it while editing). */
const railCurrent = (page: Page, title: string) =>
    rail(page, title).locator("xpath=ancestor-or-self::*[@data-spotlight-current][1]");

for (const e of EDITORS) {
    test(`${e.kind} editor: no icon column; every usable rail category switches the picker`, async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openEditor(page, e);
        await expectNoIconColumn(page);
        for (const c of CATEGORIES.filter((c) => c.id !== e.own)) {
            await rail(page, c.title).click();
            await expect(page.locator(`[data-picker-body="${c.id}"]`)).toBeVisible();
            // The editor stays open.
            await expect(editorHeading(page, e.heading)).toBeVisible();
        }
        // Layout: the picker uses the panel's width, no sideways scroll, nothing clipped.
        await rail(page, "Standard Keys").click();
        await page.waitForTimeout(400);
        expect(await overflowingElements(sidePanel(page)), "picker content overflow").toEqual([]);
    });
}

test("macro editor screenshot without the icon column", async ({ page }) => {
    await openDemo(page, "demo=combos");
    await openEditor(page, EDITORS[0]);
    await expectNoIconColumn(page);
    await page.waitForTimeout(600);
    // The picker reaches near the panel's right edge (no 64px reserved for a strip).
    const gap = await page.locator("[data-picker-body]").evaluate((el) => {
        const scroller = el.parentElement!;
        return parseFloat(getComputedStyle(scroller).paddingRight);
    });
    expect(gap).toBeLessThanOrEqual(16);
    fs.mkdirSync(SHOT.replace(/\/[^/]+$/, ""), { recursive: true });
    await page.screenshot({ path: SHOT });
});

test("narrow width (800px): the rail still switches the macro editor's picker", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openDemo(page, "demo=combos");
    await openEditor(page, EDITORS[0]);
    await expectNoIconColumn(page);
    await rail(page, "Layer Keys").click();
    await expect(page.locator('[data-picker-body="layers"]')).toBeVisible();
    await rail(page, "Pointing Devices").click();
    await expect(page.locator('[data-picker-body="pointing"]')).toBeVisible();
    expect(await overflowingElements(sidePanel(page)), "picker content overflow").toEqual([]);
});

for (const e of [EDITORS[0], EDITORS[1]]) {
    test(`bottom bar, ${e.kind} editor: no icon column; the rail switches the picker`, async ({ page }) => {
        await openDemo(page, "demo=combos");
        await rail(page, e.panel).click();
        await page.getByRole("button", { name: "Bottom bar layout" }).click();
        await expect(sidePanel(page)).toHaveAttribute("data-placement", "bottom");
        await openEditor(page, e);
        await expectNoIconColumn(page);
        for (const c of [CATEGORIES[3], CATEGORIES[1], CATEGORIES[2], CATEGORIES[0]]) {
            await rail(page, c.title).click();
            await expect(railCurrent(page, c.title)).toHaveCount(1);
            await expect(editorHeading(page, e.heading)).toBeVisible();
        }
    });
}

test("?railMode=collapse keeps the panel's strip: the rail is under the scrim there", async ({ page }) => {
    await openDemo(page, "demo=combos&railMode=collapse");
    await openEditor(page, EDITORS[0]);
    await expect(page.locator("[data-picker-rail] [data-picker-strip]")).toBeVisible();
    await page.locator("[data-picker-strip]").getByRole("button", { name: "Layer Keys" }).click();
    await expect(page.locator('[data-picker-body="layers"]')).toBeVisible();
});
