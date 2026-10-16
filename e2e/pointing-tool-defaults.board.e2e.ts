// Every tool shows the default step and pace of the action it runs, and a per-tool rate
// limit is saved like every other setting: written with Live Updating on, kept across a
// power cycle (reload + reconnect).
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
    if (!(await tuning.isVisible())) await page.getByRole("button", { name: "Pointing Devices", exact: true }).first().click();
    await expect(tuning).toBeVisible();
    return tuning;
}

// The v5 payload: shared speed (13 bits) and universal (1), then 28 bits per tool:
// speed (13), use shared (1), rate limit in ms (8), reversal - 1 (6). Bytes 16-18 hold
// 5 bits per tool: action (3) and the two reverse flags.
const bits = (bytes: number[], start: number, width: number) => {
    let value = 0;
    for (let i = 0; i < width; i++) value |= ((bytes[(start + i) >> 3] >> ((start + i) & 7)) & 1) << i;
    return value;
};
const savedInterval = (bytes: number[], tool: number) => bits(bytes, 14 + 28 * tool + 14, 8);
const savedAction = (bytes: number[], tool: number) => bits(bytes, 128 + 5 * tool, 3);

test.describe("pointing tool defaults per action", () => {
    test.beforeEach(({ allowConsoleError }) => allowConsoleError(/React does not recognize the/));

    test("each tool shows its action's default step and pace, and follows an action change", async ({ page }) => {
        const board = new MockBoard();
        await bootBoard(page, board);
        const tuning = await openPointingTools(page);
        const defaults = tuning.getByRole("region", { name: "Tool defaults" });
        await expect(defaults.getByTestId("tool-defaults-1")).toHaveText("Volume: default about 2 mm a step, no default limit.");
        await expect(defaults.getByTestId("tool-defaults-2")).toHaveText("Arrows: default about 5 mm a step, about 15 a second.");
        await expect(defaults.getByTestId("tool-defaults-3")).toHaveText("Tabs: default about 10 mm a step, about 7 a second.");
        await expect(defaults.getByTestId("tool-defaults-4")).toHaveText("Tasks: default about 10 mm a step, about 7 a second.");

        await tuning.getByRole("button", { name: "Tool 2 · Arrows", exact: true }).click();
        const rates = tuning.getByRole("region", { name: "Output rate limits" });
        await expect(rates.getByText("Default: about 15 a second.")).toBeVisible();
        await tuning.getByRole("combobox", { name: "Tool 2 action" }).selectOption({ label: "Zoom" });
        await expect(defaults.getByTestId("tool-defaults-2")).toHaveText("Zoom: default about 6 mm a step, about 10 a second.");
        await expect(rates.getByText("Default: about 10 a second.")).toBeVisible();
        await tuning.getByRole("combobox", { name: "Tool 2 action" }).selectOption({ label: "Volume" });
        await expect(defaults.getByTestId("tool-defaults-2")).toHaveText("Volume: default about 2 mm a step, no default limit.");
        await expect(rates.getByText(/^Uncapped/)).toBeVisible();

        // The shared speed is a multiplier on top of every action's default step.
        await tuning.getByRole("button", { name: "Shared defaults", exact: true }).click();
        const slider = tuning.getByRole("slider", { name: "Horizontal speed" });
        await slider.focus();
        for (let i = 0; i < 63 && !(await tuning.getByText("2.00×").first().isVisible()); i++) await page.keyboard.press("ArrowRight");
        await expect(defaults.getByTestId("tool-defaults-3")).toHaveText("Tabs: default about 10 mm a step, about 7 a second. At 2.00×: about 5 mm a step.");
    });

    test("a per-tool rate limit is saved under the normal save model and survives a power cycle", async ({ page }) => {
        const board = new MockBoard();
        await bootBoard(page, board);
        await setLiveUpdating(page, true);
        let tuning = await openPointingTools(page);
        await tuning.getByRole("button", { name: "Tool 2 · Arrows", exact: true }).click();
        await tuning.getByRole("combobox", { name: "Tool 2 action" }).selectOption({ label: "Zoom" });
        await tuning.getByLabel("Limit Tool 2 · Zoom action rate").check();
        // A new limit starts at the action's default pace: about 10 a second for Zoom.
        const limit = tuning.getByLabel("Tool 2 · Zoom maximum actions / second");
        await expect(limit).toHaveValue("10");
        await limit.fill("5");
        // No save step: the board receives the settled value by itself.
        await expect.poll(() => board.sets.length && savedInterval(board.sets.at(-1)!, 1)).toBe(200);
        expect(savedAction(board.sets.at(-1)!, 1)).toBe(4);
        expect(savedInterval(board.sets.at(-1)!, 0)).toBe(0); // the other tools keep their defaults
        expect(board.staleSets).toBe(0);

        await bootBoard(page, board);
        tuning = await openPointingTools(page);
        await tuning.getByRole("button", { name: /^Tool 2 · Zoom/ }).click();
        await expect(tuning.getByLabel("Limit Tool 2 · Zoom action rate")).toBeChecked();
        await expect(tuning.getByLabel("Tool 2 · Zoom maximum actions / second")).toHaveValue("5");
        await expect(tuning.getByRole("region", { name: "Tool defaults" }).getByTestId("tool-defaults-2")).toHaveText("Zoom: default about 6 mm a step, about 10 a second.");
    });
});
