// Group 5, area E (views): multi-layer views, 3D, transparent keys and thumbs,
// Overview, Matrix Tester, pending changes. Flows E1-E6.
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { tool, viewLayers, findingShot, clippedElements, known, layerTab, primaryView } from "./g5-helpers";

const PRIMARY_KEYS = "[data-keyboard-instance='primary'] [data-key-x]";

test.describe("E1 Show Multiple Layers and extra layer views", () => {
    test("multiple layers stack every layer, then return to one", async ({ page }) => {
        await openDemo(page);
        expect(await page.locator("[data-keyboard-instance]").count()).toBe(1);
        await tool(page, "Show Multiple Layers").click();
        await expect(tool(page, "Show Single Layer")).toHaveAttribute("aria-pressed", "true");
        // Every layer of the demo (0-14 + mouse) is stacked below the first.
        await expect.poll(() => page.locator("[data-keyboard-instance]").count()).toBeGreaterThan(8);
        const tops = await page.locator("[data-keyboard-instance]").evaluateAll((es) => es.slice(0, 3).map((e) => e.getBoundingClientRect().top));
        expect(tops[1]).toBeGreaterThan(tops[0]);
        expect(tops[2]).toBeGreaterThan(tops[1]);
        await tool(page, "Show Single Layer").click();
        await expect(tool(page, "Show Multiple Layers")).toHaveAttribute("aria-pressed", "false");
        await expect.poll(() => page.locator("[data-keyboard-instance]").count()).toBe(1);
    });

    test("an added layer view switches on its own and can be hidden", async ({ page }) => {
        await openDemo(page);
        await page.getByRole("button", { name: "Add keyboard layer view" }).click();
        const second = page.locator("[data-keyboard-view-instance='secondary-1']");
        await expect(second).toBeVisible();
        await expect.poll(() => viewLayers(page)).toEqual(["0", "1"]);
        // Pick layer 3 in the new view's own strip: only that view changes.
        await layerTab(second, 3).click();
        await expect.poll(() => viewLayers(page)).toEqual(["0", "3"]);
        await expect(layerTab(second, 3)).toHaveClass(/bg-gray-800/);
        await expect(layerTab(primaryView(page), 0)).toHaveClass(/bg-gray-800/);
        await second.getByRole("button", { name: "Hide layer view" }).click();
        await expect(second).toHaveCount(0);
        await expect.poll(() => viewLayers(page)).toEqual(["0"]);
    });

    // g5-01: a view switched to layer 0 cannot be hidden (its Hide button is disabled).
    test("an added view showing layer 0 can still be hidden", async ({ page }) => {
        known("g5-01", "Hide layer view is disabled while the added view shows layer 0");
        await openDemo(page);
        await page.getByRole("button", { name: "Add keyboard layer view" }).click();
        const second = page.locator("[data-keyboard-view-instance='secondary-1']");
        await layerTab(second, 0).click();
        await expect.poll(() => viewLayers(page)).toEqual(["0", "0"]);
        const hide = second.getByRole("button", { name: "Hide layer view" });
        if (await hide.isDisabled()) await findingShot(page, "g5-01");
        await expect(hide).toBeEnabled({ timeout: 2_000 });
        await hide.click();
        await expect(second).toHaveCount(0);
    });
});

// g5-06: the selected layer tab looks selected but says nothing to a screen reader.
test("the selected layer tab exposes its selected state", async ({ page }) => {
    known("g5-06", "layer tabs carry no aria-pressed / aria-current / aria-selected");
    await openDemo(page);
    const tab = layerTab(primaryView(page), 0);
    await expect(tab).toHaveClass(/bg-gray-800/);
    const state = await tab.evaluate((e) => e.getAttribute("aria-pressed") ?? e.getAttribute("aria-current") ?? e.getAttribute("aria-selected"));
    if (!state) await findingShot(page, "g5-06");
    expect(state).toMatch(/true|page/);
});

test.describe("E2 3D View", () => {
    test("3D shows the layer in perspective and toggling back restores the flat view", async ({ page }) => {
        await openDemo(page);
        const firstKey = page.locator(PRIMARY_KEYS).first();
        const flatBox = await firstKey.boundingBox();
        const flatBg = await firstKey.evaluate((e) => getComputedStyle(e).backgroundColor);
        await tool(page, "3D View").click();
        await expect(tool(page, "Exit 3D View")).toHaveAttribute("aria-pressed", "true");
        // Something above the keys carries a 3D transform, and the keys keep the layer color.
        await expect.poll(() => page.locator("[data-keyboard-instance='primary']").evaluate((el) => {
            for (let a: HTMLElement | null = el; a; a = a.parentElement) {
                const t = getComputedStyle(a).transform;
                if (t && t.startsWith("matrix3d")) return true;
            }
            return !!el.querySelector("[style*='rotate'], [style*='matrix3d']");
        })).toBe(true);
        expect(await firstKey.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(flatBg);
        await expect(page.locator(PRIMARY_KEYS)).toHaveCount(await page.locator(PRIMARY_KEYS).count());
        await tool(page, "Hide Thumbs").click();
        await expect(tool(page, "Show Thumbs")).toHaveAttribute("aria-pressed", "true");
        await tool(page, "Show Thumbs").click();
        await tool(page, "Exit 3D View").click();
        await expect(tool(page, "3D View")).toHaveAttribute("aria-pressed", "false");
        await expect.poll(async () => {
            const b = await firstKey.boundingBox();
            return b && flatBox ? Math.round(Math.abs(b.x - flatBox.x) + Math.abs(b.y - flatBox.y)) : 999;
        }, { timeout: 5_000 }).toBeLessThan(5);
    });

    // g5-02: the Hide Thumbs tooltip never changes to Show Thumbs (its aria-label does).
    test("the thumbs button's tooltip names what it will do", async ({ page }) => {
        known("g5-02", "tooltip stays 'Hide Thumbs' while the button would show them");
        await openDemo(page);
        await tool(page, "Hide Thumbs").click();
        const btn = tool(page, "Show Thumbs");
        await page.mouse.move(700, 700);
        await page.waitForTimeout(300);
        await btn.hover();
        const tip = page.getByRole("tooltip");
        await expect(tip).toBeVisible({ timeout: 3_000 });
        const text = (await tip.innerText()).trim();
        if (text !== "Show Thumbs") await findingShot(page, "g5-02");
        expect(text).toBe("Show Thumbs");
    });
});

test.describe("E3 Hide All Transparent Keys and Hide Thumbs", () => {
    test("transparent keys hide and show on a layer that has them, without moving keys", async ({ page }) => {
        await openDemo(page);
        await layerTab(page, 1).click();
        await expect.poll(() => viewLayers(page)).toEqual(["1"]);
        const keys = page.locator(PRIMARY_KEYS);
        // A hidden ▽ fades out (opacity 0) and the key below it shows instead.
        const trnsCount = () => keys.evaluateAll((es) => es.filter((e) => (e.textContent || "").trim() === "▽" && getComputedStyle(e).opacity !== "0").length);
        const before = await trnsCount();
        expect(before).toBeGreaterThan(0);
        const solid = keys.filter({ hasText: /^@$/ }).first();
        const solidBox = await solid.boundingBox();
        await tool(page, "Hide All Transparent Keys").click();
        await expect(tool(page, "Show All Transparent Keys")).toHaveAttribute("aria-pressed", "true");
        // The transparent keys now show the key that would fire (or hide), never the ▽ glyph.
        await expect.poll(trnsCount).toBeLessThan(before);
        const after = await solid.boundingBox();
        expect(Math.abs((after?.x ?? 0) - (solidBox?.x ?? 0))).toBeLessThan(2);
        expect(Math.abs((after?.y ?? 0) - (solidBox?.y ?? 0))).toBeLessThan(2);
        await tool(page, "Show All Transparent Keys").click();
        await expect.poll(trnsCount).toBe(before);
    });

    test("Hide Thumbs in the flat view hides the thumb keys and brings them back", async ({ page }) => {
        await openDemo(page);
        const visibleThumbs = () => page.locator(PRIMARY_KEYS).evaluateAll((es) => es.filter((e) => {
            const t = (e.textContent || "").trim();
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            return /space|enter|backsp/i.test(t) && r.width > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0.1;
        }).length);
        const before = await visibleThumbs();
        expect(before).toBeGreaterThan(0);
        const w = page.locator(PRIMARY_KEYS).filter({ hasText: /^w$/i }).first();
        const wBox = await w.boundingBox();
        await tool(page, "Hide Thumbs").click();
        await expect(tool(page, "Show Thumbs")).toHaveAttribute("aria-pressed", "true");
        await expect.poll(visibleThumbs, { message: "thumb keys still visible after Hide Thumbs" }).toBeLessThan(before);
        // Finger keys stay put.
        const wAfter = await w.boundingBox();
        expect(Math.abs((wAfter?.y ?? 0) - (wBox?.y ?? 0))).toBeLessThan(2);
        await tool(page, "Show Thumbs").click();
        await expect.poll(visibleThumbs).toBe(before);
    });
});

test.describe("E4 Overview", () => {
    test("Overview shows the used layers at once and clicking a layer selects it", async ({ page }) => {
        await openDemo(page);
        await tool(page, "Overview").click();
        await expect(tool(page, "Disable Overview")).toHaveAttribute("aria-pressed", "true");
        // The demo's used layers (0, 1, 2 and mouse), top layer first.
        await expect.poll(() => page.locator("[data-keyboard-view-instance]").count()).toBeGreaterThanOrEqual(4);
        // Overview's strip lists only the used layers, top layer first.
        const two = page.getByRole("button", { name: "Layer 2: 2" });
        await expect(two).toBeVisible();
        await expect(page.getByRole("button", { name: /^Layer 5:/ })).toHaveCount(0);
        await two.click();
        await expect(two).toHaveAttribute("aria-pressed", "true");
        // Overview text never overlaps: each stacked layer label sits on its own.
        expect(await clippedElements(page, "[data-keyboard-view-instance] button[aria-label^='Layer ']")).toEqual([]);
    });

    // g5-03: leaving Overview drops the layer the user picked there and returns to the old one.
    test("the layer picked in Overview is the one shown after leaving it", async ({ page }) => {
        known("g5-03", "Disable Overview restores the layer from before Overview");
        await openDemo(page);
        await tool(page, "Overview").click();
        await page.getByRole("button", { name: "Layer 2: 2" }).click();
        await tool(page, "Disable Overview").click();
        await expect.poll(() => page.locator("[data-keyboard-view-instance]").count()).toBe(1);
        const layers = await viewLayers(page);
        if (layers[0] !== "2") await findingShot(page, "g5-03");
        expect(layers).toEqual(["2"]);
    });
});

test.describe("E5 Matrix Tester", () => {
    test("opens on the demo with an empty matrix, clears, and closes cleanly", async ({ page }) => {
        await openDemo(page);
        await tool(page, "Matrix Tester").click();
        await expect(page.getByRole("button", { name: "Matrix Tester" }).filter({ hasText: "Matrix Tester" })).toBeVisible();
        await expect(tool(page, "Exit Matrix Tester")).toBeVisible();
        // No board: no key is lit; the layer keys are not shown.
        await expect(page.getByRole("button", { name: "Clear Matrix" })).toBeVisible();
        await page.getByRole("button", { name: "Clear Matrix" }).click();
        await page.getByTitle("Return to layer view").click();
        await expect(tool(page, "Matrix Tester")).toBeVisible();
        await expect(page.locator(PRIMARY_KEYS).filter({ hasText: /^w$/i })).toBeVisible();
    });

    // g5-04: the Matrix Tester says nothing about needing a board, and offers "Add keyboard layer view".
    test("without a board the Matrix Tester says a board is needed", async ({ page }) => {
        known("g5-04", "no hint that a board must be connected; an 'Add keyboard layer view' button floats under the matrix");
        await openDemo(page);
        await tool(page, "Matrix Tester").click();
        await expect(tool(page, "Exit Matrix Tester")).toBeVisible();
        const hint = page.getByText(/connect/i).filter({ hasNotText: /^Connect$/ });
        const addView = page.getByRole("button", { name: "Add keyboard layer view" });
        const ok = (await hint.count()) > 0 && !(await addView.isVisible());
        if (!ok) await findingShot(page, "g5-04");
        await expect(addView).toBeHidden();
        await expect(page.getByText(/connect (a|your) (keyboard|board)/i)).toBeVisible({ timeout: 2_000 });
    });
});

test.describe("E6 Pending changes", () => {
    // g5-05: edits in the demo cannot be reviewed or reverted one by one (the Pending
    // popover only exists while connected, and it has no Revert action).
    test("two edits are listed and one can be reverted", async ({ page }) => {
        known("g5-05", "no pending-changes review or per-edit revert in the offline draft");
        await openDemo(page);
        const q = page.locator(PRIMARY_KEYS).filter({ hasText: /^q$/i }).first();
        const z = page.locator(PRIMARY_KEYS).filter({ hasText: /^z$/i }).first();
        await q.click();
        await page.keyboard.press("Backspace");
        await z.click();
        await page.keyboard.press("Backspace");
        await expect(page.locator(CANVAS_KEY).filter({ hasText: /^q$/i })).toHaveCount(0);
        const trigger = page.getByRole("button", { name: /^Pending \(2\)$/ });
        if (!(await trigger.isVisible())) await findingShot(page, "g5-05");
        await trigger.click({ timeout: 2_000 });
        const list = page.getByRole("list", { name: "Changes waiting to be applied" });
        await expect(list.getByRole("listitem")).toHaveCount(2);
        await list.getByRole("button", { name: /revert/i }).first().click();
        await expect(page.locator(PRIMARY_KEYS).filter({ hasText: /^q$/i })).toHaveCount(1);
    });
});
