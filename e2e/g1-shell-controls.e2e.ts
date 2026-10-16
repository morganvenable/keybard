// Group 1, area A: the navigation rail (A9) and the key size / panel mode
// controls in the bottom-right corner (A10).
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { canvasKeyWidth, detailPanel, FINDING_IMG_DIR, findingShot, KEY_SIZE_BUTTON, keySizeAuto, knownBug, layoutModeAuto, openRailPanel, rail, railItem } from "./g1-helpers";
import type { Page } from "@playwright/test";

async function railWidth(page: Page) {
    return Math.round((await rail(page).boundingBox())!.width);
}
async function canvasLeft(page: Page) {
    return Math.round((await page.getByRole("region", { name: "Keyboard canvas" }).boundingBox())!.x);
}
/** The rail's right edge never overlaps the canvas's first key. */
async function expectNoRailOverlap(page: Page) {
    const r = (await rail(page).boundingBox())!;
    const keys = await page.locator(CANVAS_KEY).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    expect(Math.min(...keys)).toBeGreaterThanOrEqual(r.x + r.width - 1);
}

test.describe("A9 collapse the navigation rail", () => {
    test("collapse shows icons with tooltips; it survives a reload; Ctrl+B toggles it", async ({ page }) => {
        await openDemo(page);
        // The rail eases to its width after load; measure it once it has settled.
        await expect.poll(async () => {
            const a = await railWidth(page);
            await page.waitForTimeout(200);
            return Math.abs((await railWidth(page)) - a) < 0.5;
        }).toBe(true);
        const wide = await railWidth(page);
        const leftWide = await canvasLeft(page);
        await expectNoRailOverlap(page);

        await page.getByRole("button", { name: "Collapse navigation" }).click();
        await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
        await expect.poll(() => railWidth(page)).toBeLessThan(wide - 60);
        // Labels hide; each item keeps its accessible name and shows a tooltip on hover.
        await expect(rail(page).getByText("Combos", { exact: true })).toBeHidden();
        await railItem(page, "Combos").hover();
        await expect(page.getByRole("tooltip")).toHaveText("Combos");
        // The canvas reflows into the freed space, without overlap.
        await expect.poll(() => canvasLeft(page)).toBeLessThan(leftWide);
        await expectNoRailOverlap(page);

        await page.reload();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();

        await page.locator("body").click({ position: { x: 900, y: 700 } });
        await page.keyboard.press("Control+b");
        await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
        await expect.poll(async () => Math.abs((await railWidth(page)) - wide)).toBeLessThan(1);
        await expectNoRailOverlap(page);
        await page.keyboard.press("Control+b");
        await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
    });

    test("Ctrl+B does nothing while typing in a field", async ({ page }) => {
        // g1-06: Ctrl+B in a text field (the Layouts search) collapses the rail; the
        // other editor shortcuts ignore keys typed into fields.
        knownBug(test, "g1-06");
        await openDemo(page);
        await openRailPanel(page, "Layouts");
        const search = detailPanel(page).getByRole("textbox").first();
        await search.click();
        await expect(search).toBeFocused();
        await page.keyboard.press("Control+b");
        await page.waitForTimeout(300);
        await findingShot(page, "g1-06");
        await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
    });

    test("a rail item click while collapsed opens its panel", async ({ page }) => {
        await openDemo(page);
        await page.getByRole("button", { name: "Collapse navigation" }).click();
        await railItem(page, "Combos").click();
        await expect(detailPanel(page)).toBeVisible();
        await expect(detailPanel(page)).toHaveAccessibleName("Combos");
        // The panel tucks over the rail's edge by design, but never covers a rail icon.
        const p = (await detailPanel(page).boundingBox())!;
        const iconRight = await rail(page).locator("li svg").evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().right)));
        expect(p.x).toBeGreaterThanOrEqual(iconRight);
    });
});

test.describe("A10 key size and panel mode", () => {
    test("Normal, Medium and Small resize the keys and show which is chosen", async ({ page }) => {
        await openDemo(page);
        const sizes: Record<string, number> = {};
        for (const size of ["normal", "medium", "small"] as const) {
            const button = page.getByRole("button", { name: KEY_SIZE_BUTTON[size] });
            await button.click();
            await expect(button).toHaveAttribute("aria-pressed", "true");
            await expect(keySizeAuto(page)).toHaveAttribute("aria-pressed", "false");
            for (const other of ["normal", "medium", "small"] as const) {
                if (other !== size) await expect(page.getByRole("button", { name: KEY_SIZE_BUTTON[other] })).toHaveAttribute("aria-pressed", "false");
            }
            await page.waitForTimeout(300);
            sizes[size] = await canvasKeyWidth(page);
        }
        expect(sizes.normal).toBeGreaterThan(sizes.medium);
        expect(sizes.medium).toBeGreaterThan(sizes.small);
    });

    test("Auto picks the size from the window and follows a resize", async ({ page }) => {
        await openDemo(page);
        await keySizeAuto(page).click();
        await expect(keySizeAuto(page)).toHaveAttribute("aria-pressed", "true");
        await page.setViewportSize({ width: 1600, height: 1000 });
        await page.waitForTimeout(500);
        const big = await canvasKeyWidth(page);
        await page.setViewportSize({ width: 900, height: 800 });
        await page.waitForTimeout(500);
        const small = await canvasKeyWidth(page);
        expect(small).toBeLessThan(big);
        // The keyboard still fits the canvas at the smaller width.
        const keys = await page.locator(CANVAS_KEY).evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().right)));
        expect(keys).toBeLessThanOrEqual(900);
    });

    test("Bottom bar puts the panel under the keyboard; Sidebar puts it back", async ({ page }) => {
        await openDemo(page);
        await openRailPanel(page, "Combos");
        await page.getByRole("button", { name: "Bottom bar layout" }).click();
        await expect(page.getByRole("button", { name: "Bottom bar layout" })).toHaveAttribute("aria-pressed", "true");
        await expect(layoutModeAuto(page)).toHaveAttribute("aria-pressed", "false");
        const panel = detailPanel(page);
        await expect(panel).toHaveAttribute("data-placement", "bottom");
        await page.waitForTimeout(400);
        const p = (await panel.boundingBox())!;
        const keysBottom = await page.locator(CANVAS_KEY).evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
        expect(p.y, "the bottom panel starts below the keys").toBeGreaterThanOrEqual(keysBottom - 1);
        await expect(panel.getByRole("heading", { name: "Combos" })).toBeVisible();

        await page.getByRole("button", { name: "Sidebar layout" }).click();
        await expect(panel).toHaveAttribute("data-placement", "side");
        await layoutModeAuto(page).click();
        await expect(layoutModeAuto(page)).toHaveAttribute("aria-pressed", "true");
    });

    test("the size and layout controls stay put and stay visible with the bottom panel open", async ({ page }) => {
        await openDemo(page);
        await openRailPanel(page, "Combos");
        await page.getByRole("button", { name: "Bottom bar layout" }).click();
        await page.waitForTimeout(400);
        // A user must still reach the controls to switch back.
        await expect(page.getByRole("button", { name: "Sidebar layout" })).toBeInViewport();
        await page.getByRole("button", { name: "Sidebar layout" }).click();
        await expect(detailPanel(page)).toHaveAttribute("data-placement", "side");
    });

    test("a chosen key size and panel mode survive a reload", async ({ page }) => {
        // g1-04 (F-keysize-not-persisted): both reset to Auto after a reload; they live only
        // in React state. Intent unconfirmed; the owner's rule is that preferences persist.
        knownBug(test, "g1-04");
        await openDemo(page);
        await page.getByRole("button", { name: KEY_SIZE_BUTTON.small }).click();
        await page.getByRole("button", { name: "Bottom bar layout" }).click();
        await page.reload();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await findingShot(page, "g1-04");
        await expect(page.getByRole("button", { name: KEY_SIZE_BUTTON.small })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: "Bottom bar layout" })).toHaveAttribute("aria-pressed", "true");
    });

    test("the controls have distinct, consistently written names", async ({ page }) => {
        // g1-05: screen readers hear "Normal", "medium", "small" (lower case) and two
        // buttons both named "Auto" with nothing to say which is key size and which is layout.
        knownBug(test, "g1-05");
        await openDemo(page);
        await page.getByRole("button", { name: "Bottom bar layout" }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${FINDING_IMG_DIR}/g1-05.png`, clip: { x: 1000, y: 940, width: 440, height: 60 } });
        await expect(page.getByRole("button", { name: "Medium", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "Small", exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /auto.*(key|size)/i })).toHaveCount(1);
        await expect(page.getByRole("button", { name: /auto.*(layout|panel)/i })).toHaveCount(1);
    });
});

test.describe("A10/A11 phone width", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("a chosen key size changes the keys, and Normal keys are readable", async ({ page }) => {
        // g1-19: on a phone even Normal draws keys about 21px wide (the layout is
        // scaled to fit the width), so the labels are hard to read.
        knownBug(test, "g1-19");
        await openDemo(page);
        const widths: Record<string, number> = {};
        for (const size of ["normal", "medium", "small"] as const) {
            await page.getByRole("button", { name: KEY_SIZE_BUTTON[size] }).click();
            await page.waitForTimeout(300);
            widths[size] = await canvasKeyWidth(page);
        }
        await page.getByRole("button", { name: KEY_SIZE_BUTTON.normal }).click();
        await page.waitForTimeout(300);
        await findingShot(page, "g1-19");
        expect(widths.normal, JSON.stringify(widths)).toBeGreaterThan(widths.small);
        expect(widths.normal).toBeGreaterThanOrEqual(28);
    });
});
