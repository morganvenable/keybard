// Pointing tools settings follow Keybard's one save model: with Live Updating
// on they reach the board as you change them; with it off they wait for Apply.
// A power cycle (reload + reconnect) shows what the board actually kept.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { MockBoard, openWithBoard, freshPointTools, connect, setLiveUpdating } from "./board";

async function bootBoard(page: Page, board: MockBoard) {
    await openWithBoard(page, board);
    board.pointTools ??= await freshPointTools(page);
    await connect(page);
}

async function openPointingTools(page: Page) {
    const tuning = page.getByRole("region", { name: "Pointing tools tuning" }).first();
    // The panel may already be open (Keybard remembers it across reloads); a second click would close it.
    if (!(await tuning.isVisible())) await page.getByRole("button", { name: "Pointing Devices", exact: true }).first().click();
    await expect(tuning).toBeVisible();
    return tuning;
}

/**
 * Step the shared speed slider from 1.00x up to 2.00x with the arrow keys, which
 * fire the same input events as a drag. Returns the slider position it ends on.
 */
async function setSharedSpeedTo2x(page: Page) {
    const tuning = await openPointingTools(page);
    const slider = tuning.getByRole("slider", { name: "Horizontal speed" });
    await expect(tuning.getByText("1.00×").first()).toBeVisible();
    await slider.focus();
    for (let i = 0; i < 63 && !(await tuning.getByText("2.00×").first().isVisible()); i++) await page.keyboard.press("ArrowRight");
    await expect(tuning.getByText("2.00×").first()).toBeVisible();
    return Number(await slider.inputValue());
}

async function powerCycle(page: Page, board: MockBoard) {
    await bootBoard(page, board);
    return openPointingTools(page);
}

test.describe("pointing tools save model", () => {
    // Dev-server React warnings from unrelated components; production builds don't log them.
    test.beforeEach(({ allowConsoleError }) => allowConsoleError(/React does not recognize the/));

    test("there is no separate save button for tool settings", async ({ page }) => {
        const board = new MockBoard();
        await bootBoard(page, board);
        const tuning = await openPointingTools(page);
        await expect(tuning.getByRole("button", { name: /Save tuning|Queue tuning|Keep tuning/ })).toHaveCount(0);
    });

    test("Live Updating on: a speed change reaches the board and survives a power cycle", async ({ page }) => {
        const board = new MockBoard();
        await bootBoard(page, board);
        await setLiveUpdating(page, true);
        const target = await setSharedSpeedTo2x(page);
        // No save step: the board receives the settled value by itself.
        await expect.poll(() => board.lastSharedSpeed).toBe(target);
        // The toolbar shows the same status as for any other live setting.
        await expect(page.getByText("Live Updating", { exact: true })).toBeVisible();
        // A slider run settles into a few writes, not one per step.
        expect(board.sets.length).toBeLessThanOrEqual(3);
        expect(board.staleSets).toBe(0);

        const tuning = await powerCycle(page, board);
        await expect(tuning.getByText("2.00×").first()).toBeVisible();
    });

    test("Live Updating on: tool action, direction and rate limit changes are written too", async ({ page }) => {
        const board = new MockBoard();
        await bootBoard(page, board);
        await setLiveUpdating(page, true);
        let tuning = await openPointingTools(page);
        await tuning.getByRole("button", { name: "Tool 2 · Arrows", exact: true }).click();
        await tuning.getByRole("combobox", { name: "Tool 2 action" }).selectOption({ label: "Zoom" });
        await tuning.getByLabel("Reverse vertical direction").check();
        await tuning.getByLabel("Limit Tool 2 · Zoom action rate").check();
        await expect.poll(() => board.sets.length).toBeGreaterThan(0);
        await expect(page.getByText("Live Updating", { exact: true })).toBeVisible();

        tuning = await powerCycle(page, board);
        await expect(tuning.getByRole("button", { name: /^Tool 2 · Zoom/ })).toBeVisible();
        await tuning.getByRole("button", { name: /^Tool 2 · Zoom/ }).click();
        await expect(tuning.getByLabel("Reverse vertical direction")).toBeChecked();
        await expect(tuning.getByLabel("Limit Tool 2 · Zoom action rate")).toBeChecked();
    });

    test("Live Updating off: changes wait for Apply, like every other setting", async ({ page }) => {
        const board = new MockBoard();
        await bootBoard(page, board);
        await setLiveUpdating(page, false);
        await setSharedSpeedTo2x(page);
        // Staged like any other setting: one pending change, nothing written.
        await expect(page.getByRole("button", { name: /Apply 1 Change/ })).toBeVisible();
        await page.waitForTimeout(600);
        expect(board.sets.length).toBe(0);

        // Unapplied: a power cycle keeps the old speed.
        let tuning = await powerCycle(page, board);
        await expect(tuning.getByText("1.00×").first()).toBeVisible();
        expect(board.sets.length).toBe(0);

        // Applied: the board keeps it.
        await setLiveUpdating(page, false);
        const target = await setSharedSpeedTo2x(page);
        await page.waitForTimeout(600); // let the slider run settle, as a person would before Apply
        await page.getByRole("button", { name: /Apply 1 Change/ }).click();
        await expect(page.getByRole("button", { name: "No pending changes" })).toBeVisible();
        expect(board.sets.length).toBe(1);
        expect(board.lastSharedSpeed).toBe(target);
        tuning = await powerCycle(page, board);
        await expect(tuning.getByText("2.00×").first()).toBeVisible();
    });
});

// Device gains (temporary control until the UX study's design): an edit reaches the board
// like any other setting and survives a power cycle.
test("touchpad and TrackPoint gains save to the board and come back after a power cycle", async ({ page }) => {
    const board = new MockBoard();
    await bootBoard(page, board);
    await setLiveUpdating(page, true);
    const tuning = await openPointingTools(page);
    const gains = tuning.getByRole("region", { name: "Device gains (temporary)" });
    await expect(gains.getByText("Device gains (temporary control)")).toBeVisible();
    await expect(gains.getByLabel("Touchpad gain")).toHaveValue("2");
    await gains.getByLabel("Touchpad gain").fill("3");
    await expect.poll(() => board.lastGains).toEqual([48, 32]);
    const again = await powerCycle(page, board);
    await expect(again.getByRole("region", { name: "Device gains (temporary)" }).getByLabel("Touchpad gain")).toHaveValue("3");
    await expect(again.getByRole("region", { name: "Device gains (temporary)" }).getByLabel("TrackPoint gain")).toHaveValue("2");
});
