// Group 5 layout checks for the views and pointing area: in light and dark, at
// Normal / Medium / Small key sizes and at a phone width, every view mode keeps
// the toolbar and layer strip on one line (or visibly scrollable), nothing is
// cut off, the pointing devices stay on screen, and the side panel never
// overflows sideways.
import type { Page } from "@playwright/test";
import { test, expect, openDemo } from "./fixtures";
import {
    tool, rail, setKeySize, clippedElements, clippedText, sidePanelOverflow, findingShot, known,
} from "./g5-helpers";

const TOOLBAR = [
    "Import Layout", "Export Layout", "Matrix Tester", "Exit Matrix Tester", "Show Multiple Layers", "Show Single Layer",
    "3D View", "Exit 3D View", "Hide Thumbs", "Show Thumbs", "Hide All Transparent Keys", "Show All Transparent Keys",
    "Overview", "Disable Overview",
];
const TOOLBAR_SEL = TOOLBAR.map((n) => `button[aria-label="${n}"]`).join(", ");
/** Layer tabs: the toolbar strip (multi/3D/overview) and each view's own strip. */
const STRIP_SEL = "button[aria-label^='Layer '][aria-pressed], [data-keyboard-view-instance] > div button";

type Mode = { name: string; enter: (p: Page) => Promise<void> };
const MODES: Mode[] = [
    { name: "single", enter: async () => {} },
    { name: "multiple layers", enter: async (p) => { await tool(p, "Show Multiple Layers").click(); } },
    { name: "3D", enter: async (p) => { await tool(p, "3D View").click(); } },
    { name: "overview", enter: async (p) => { await tool(p, "Overview").click(); } },
    { name: "matrix tester", enter: async (p) => { await tool(p, "Matrix Tester").click(); } },
];

async function checkRows(page: Page, where: string) {
    await page.waitForTimeout(400);
    const cutTools = await clippedElements(page, TOOLBAR_SEL);
    const cutTabs = await clippedElements(page, STRIP_SEL);
    const cutText = await clippedText(page, "[data-keyboard-view-instance] > div");
    return [...cutTools.map((t) => `${where}: toolbar ${t}`), ...cutTabs.map((t) => `${where}: layer tab ${t}`), ...cutText.map((t) => `${where}: text ${t}`)];
}

for (const theme of ["light", "dark"] as const) {
    for (const size of ["Normal", "Medium", "Small"] as const) {
        test(`views at 1440, ${theme}, ${size}: toolbar and layer strip stay whole in every mode`, async ({ page }) => {
            await openDemo(page, `demo=pointing&motion=0&theme=${theme}`);
            await setKeySize(page, size);
            const problems: string[] = [];
            for (const m of MODES) {
                await openDemo(page, `demo=pointing&motion=0&theme=${theme}`);
                await setKeySize(page, size);
                await m.enter(page);
                problems.push(...(await checkRows(page, m.name)));
                // The pointing devices stay inside the window in the flat views.
                if (m.name === "single" || m.name === "multiple layers") {
                    for (const side of ["left", "right"]) {
                        const b = await page.locator(`canvas[data-pointing-device='${side}']`).first().boundingBox();
                        if (b && (b.x < 0 || b.x + b.width > 1440)) problems.push(`${m.name}: ${side} device off screen`);
                    }
                }
            }
            expect(problems).toEqual([]);
        });
    }
}

// g5-09: with any side panel open at 1440 wide, the layer strip is cut mid-label
// ("1:" for 13) and 14 / mouse are unreachable; the strip neither wraps nor scrolls.
for (const theme of ["light", "dark"] as const) {
    test(`with the Pointing Devices panel open at 1440 (${theme}) the layer strip stays whole`, async ({ page }) => {
        known("g5-09", "layer strip clipped under an open side panel at 1440");
        await openDemo(page, `demo=pointing&motion=0&theme=${theme}`);
        await rail(page, "Pointing Devices").click();
        await expect(page.locator("aside.detail-panel")).toBeVisible();
        expect(await sidePanelOverflow(page)).toEqual([]);
        const problems = await checkRows(page, "panel open");
        if (problems.length) await findingShot(page, "g5-09");
        expect(problems).toEqual([]);
    });
}

test("phone width (390): the pointing demo keeps both devices on screen and the view toggles reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page, "demo=pointing&motion=0");
    for (const side of ["left", "right"]) {
        const b = (await page.locator(`canvas[data-pointing-device='${side}']`).boundingBox())!;
        expect(b.x, `${side} left edge`).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width, `${side} right edge`).toBeLessThanOrEqual(391);
    }
});

// g5-10: at phone width the view toggles at the end of the toolbar (3D View,
// Hide Thumbs, Hide All Transparent Keys, Overview) are cut off and cannot be scrolled to.
test("phone width (390): every view toggle in the toolbar is whole or scrolls into view", async ({ page }) => {
    known("g5-10", "toolbar view toggles clipped at 390 px (same root cause as F-phone-toolbar)");
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page, "demo=pointing&motion=0");
    const cut = await clippedElements(page, TOOLBAR_SEL);
    if (cut.length) await findingShot(page, "g5-10");
    expect(cut).toEqual([]);
});
