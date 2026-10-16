// Group 4, flows D9 to D13: Settings > Print Layers, QMK Settings, Backups,
// Developer (Scan Lab, Key Proof Sheet) and Fragments, with the demo layout.
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { shot, overflowingChildren, scrollBoxOf } from "./g4-helpers";
import type { Page } from "@playwright/test";

/** Stand in for the browser print dialog: count the call, then fire afterprint like a real one. */
async function stubPrint(page: Page) {
    await page.addInitScript(() => {
        const w = window as any;
        w.__printed = 0;
        w.print = () => {
            w.__printed++;
            setTimeout(() => window.dispatchEvent(new Event("afterprint")), 1500);
        };
    });
}

async function openSettings(page: Page, category?: string) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("button", { name: "General", exact: true })).toBeVisible();
    if (category) {
        await page.getByRole("button", { name: category, exact: true }).click();
        await expect(page.getByRole("button", { name: category, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
}

/** The side panel that holds the open rail panel (it has a close button and a heading). */
const sidePanel = (page: Page, heading: string) =>
    page.locator("div,section,aside").filter({ has: page.getByRole("heading", { name: heading, exact: true }) }).last();

test.describe("D9 Print Layers", () => {
    test.beforeEach(async ({ page }) => { await stubPrint(page); });

    test("D9 Print renders the non-empty layers and calls print", async ({ page }) => {
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "Print Layers..." }).click();
        const dialog = page.getByRole("dialog", { name: "Print Keyboard Layout" });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("Non-empty layers: 4 of 16");
        await dialog.getByRole("button", { name: "Print", exact: true }).click();
        await expect(dialog).toBeHidden();
        const sheet = page.locator(".printable-keymap-wrapper");
        await expect(sheet).toBeAttached();
        await expect(sheet.locator(".print-layer")).toHaveCount(4);
        await expect.poll(() => page.evaluate(() => (window as any).__printed)).toBe(1);
        // afterprint clears the sheet so the editor is usable again.
        await expect(sheet).toHaveCount(0);
        await page.getByRole("button", { name: "Standard Keys", exact: true }).click();
    });

    test("D9 Cancel closes the print dialog without printing", async ({ page }) => {
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "Print Layers..." }).click();
        const dialog = page.getByRole("dialog", { name: "Print Keyboard Layout" });
        await dialog.getByRole("button", { name: "Cancel" }).click();
        await expect(dialog).toBeHidden();
        expect(await page.evaluate(() => (window as any).__printed)).toBe(0);
    });

    test("D9 the print dialog names the keyboard", async ({ page }) => {
        // g4-11: with the demo (and any loaded file) the dialog and the printout say "Keyboard: Unknown".
        test.fail(true, "g4-11: Print says 'Keyboard: Unknown'");
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "Print Layers..." }).click();
        const dialog = page.getByRole("dialog", { name: "Print Keyboard Layout" });
        await expect(dialog).toBeVisible();
        await shot(page, "g4-11");
        await expect(dialog).not.toContainText("Unknown", { timeout: 1_000 });
    });

    test("D9 the printout uses the same key labels as the editor", async ({ page }) => {
        // g4-12: the printout shows raw keycodes (LGUI_T(KC_TAB), LT1(KC_ENTER),
        // LT14(KC_NO), MO(1)) where the editor shows Tab / GUI, Enter / L1, MO 1.
        test.fail(true, "g4-12: printout shows raw QMK keycodes");
        await page.addInitScript(() => { (window as any).print = () => { (window as any).__printed = 1; }; });
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "Print Layers..." }).click();
        await page.getByRole("dialog", { name: "Print Keyboard Layout" }).getByRole("button", { name: "Print", exact: true }).click();
        const sheet = page.locator(".printable-keymap-wrapper");
        await expect(sheet.locator(".print-layer").first()).toBeAttached();
        await page.emulateMedia({ media: "print" });
        await shot(page, "g4-12");
        await page.emulateMedia({ media: "screen" });
        await expect(sheet).not.toContainText(/\b(KC_[A-Z]+|LGUI_T\(|LT\d+\()/, { timeout: 1_000 });
    });

    test("D9 Print lets the user choose which layers to print", async ({ page }) => {
        // g4-13: the dialog prints every non-empty layer; there is no way to pick layers.
        test.fail(true, "g4-13: no layer choice in Print Layers");
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "Print Layers..." }).click();
        const dialog = page.getByRole("dialog", { name: "Print Keyboard Layout" });
        await expect(dialog).toBeVisible();
        await shot(page, "g4-13");
        await expect(dialog.getByRole("checkbox").first()).toBeVisible({ timeout: 1_000 });
    });
});

test.describe("D10 QMK Settings", () => {
    test("D10 QMK Settings opens with the demo and a value can be changed", async ({ page }) => {
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "QMK Settings..." }).click();
        await expect(page.getByText("Configure firmware behavior. Changes follow your update mode.")).toBeVisible();
        await expect(page.getByText("Tapping Term", { exact: true })).toBeVisible();
        const term = page.getByRole("spinbutton").first();
        if (await term.count()) {
            await term.fill("250");
            await term.press("Tab");
            await expect(term).toHaveValue("250");
        }
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible();
    });

    test("D10 QMK Settings fits the side panel", async ({ page }) => {
        await openDemo(page);
        await openSettings(page);
        await page.getByRole("button", { name: "QMK Settings..." }).click();
        const heading = page.getByRole("heading", { name: "QMK Settings" }).first();
        await expect(heading).toBeVisible();
        const panel = scrollBoxOf(page.getByText("Configure firmware behavior. Changes follow your update mode."));
        expect((await panel.boundingBox())!.width).toBeLessThan(700);
        expect(await overflowingChildren(panel)).toEqual([]);
    });
});

test("D10 QMK Settings values sit inside their stated ranges", async ({ page }) => {
    // g4-17: with the demo, "Leader timeout (ms)" shows 0 under "Range: 50 - 5000".
    test.fail(true, "g4-17: Leader timeout 0 shown with Range 50 - 5000");
    await openDemo(page);
    await openSettings(page);
    await page.getByRole("button", { name: "QMK Settings..." }).click();
    await expect(page.getByText("Configure firmware behavior. Changes follow your update mode.")).toBeVisible();
    if (!(await page.getByText("Leader timeout (ms)").isVisible())) await page.getByText("Leader Key", { exact: true }).click();
    await expect(page.getByText("Leader timeout (ms)")).toBeVisible();
    // Expand every group, then compare each number field with the range printed under its label.
    const out = await page.evaluate(() => {
        const bad: string[] = [];
        document.querySelectorAll<HTMLInputElement>("input[type=number]").forEach((input) => {
            const row = input.closest("div")?.parentElement;
            const m = /Range:\s*(\d+)\s*-\s*(\d+)/.exec(row?.textContent || "");
            if (!m) return;
            const v = Number(input.value);
            if (v < Number(m[1]) || v > Number(m[2])) bad.push(`${(row?.textContent || "").split("Range")[0].trim()}: ${v} not in ${m[1]}-${m[2]}`);
        });
        return bad;
    });
    await page.getByText("Leader timeout (ms)").scrollIntoViewIfNeeded();
    await shot(page, "g4-17");
    expect(out).toEqual([]);
});

test.describe("D11 Backups", () => {
    test("D11 Backups shows an empty state with the demo", async ({ page }) => {
        await openDemo(page);
        await openSettings(page, "Backups");
        await expect(page.getByText(/No backups yet|Backups unavailable in this browser\./)).toBeVisible();
        await expect(page.getByRole("button", { name: "Choose backup folder" })).toBeVisible();
    });

    test("D11 cancelling the backup folder picker is not an error", async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).showDirectoryPicker = async () => { throw new DOMException("The user aborted a request.", "AbortError"); };
        });
        await openDemo(page);
        await openSettings(page, "Backups");
        await page.getByRole("button", { name: "Choose backup folder" }).click();
        await page.waitForTimeout(500);
        await expect(page.getByRole("alert")).toHaveCount(0, { timeout: 1_000 });
    });
});

test.describe("D12 Developer tools", () => {
    test("D12 Scan Lab explains that a board is needed", async ({ page }) => {
        await openDemo(page);
        await openSettings(page, "Developer");
        await page.getByRole("button", { name: "Scan Lab..." }).click();
        await expect(page.getByText("Connect a keyboard to use the Scan Lab.")).toBeVisible();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible();
    });

    test("D12 Key Proof Sheet renders, and the back arrow returns to the editor", async ({ page }) => {
        await openDemo(page);
        await openSettings(page, "Developer");
        await page.getByRole("button", { name: "Key Proof Sheet..." }).click();
        await expect(page.getByRole("heading", { name: "Key Proof Sheet" })).toBeVisible();
        await expect(page.getByText(/\(\d+ keys in \d+ categories\)/)).toBeVisible();
        await page.getByRole("button", { name: "Collapse All" }).click();
        await page.getByRole("button", { name: "Expand All" }).click();
        await page.locator("header button").first().click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible();
        await expect(page.getByText(/QWERTY example \(demo\)/).first()).toBeVisible();
    });

    test("D12 the Key Proof Sheet back button has a name", async ({ page }) => {
        // g4-14: the back arrow is an icon-only button with no label or tooltip.
        test.fail(true, "g4-14: proof sheet back button is unlabeled");
        await openDemo(page);
        await openSettings(page, "Developer");
        await page.getByRole("button", { name: "Key Proof Sheet..." }).click();
        await expect(page.getByRole("heading", { name: "Key Proof Sheet" })).toBeVisible();
        await shot(page, "g4-14");
        await expect(page.locator("header button").first()).toHaveAccessibleName(/back|editor|close/i, { timeout: 1_000 });
    });
});

test.describe("D13 Fragments", () => {
    test("D13 Fragments lists left and right clusters and fits the panel", async ({ page }) => {
        await openDemo(page);
        await openSettings(page, "Fragments");
        await expect(page.getByText("Left", { exact: true })).toBeVisible();
        await expect(page.getByText("Right", { exact: true })).toBeVisible();
        const combos = page.getByRole("combobox");
        expect(await combos.count()).toBeGreaterThanOrEqual(10);
        const section = scrollBoxOf(page.getByRole("button", { name: "Fragments", exact: true }));
        expect((await section.boundingBox())!.width).toBeLessThan(700);
        expect(await overflowingChildren(section)).toEqual([]);
    });

    test("D13 ?demo=pointing&panel=fragments opens Settings on Fragments", async ({ page }) => {
        await openDemo(page, "demo=pointing&panel=fragments");
        await expect(page.getByRole("button", { name: "Fragments", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByText("Left", { exact: true })).toBeVisible();
    });

    test("D13 a fragment preset changes the keys on the canvas", async ({ page }) => {
        await openDemo(page);
        await openSettings(page, "Fragments");
        const before = await page.locator(CANVAS_KEY).count();
        const sixKey = page.getByRole("button", { name: /6-key/i }).first();
        await sixKey.click();
        await expect.poll(() => page.locator(CANVAS_KEY).count()).not.toBe(before);
        await page.getByRole("button", { name: /^Default|default/i }).first().click();
        await expect.poll(() => page.locator(CANVAS_KEY).count()).toBe(before);
    });

    test("D13 choosing a fragment for one cluster updates the canvas", async ({ page }) => {
        await openDemo(page);
        await openSettings(page, "Fragments");
        const before = await page.locator(CANVAS_KEY).count();
        const pinky = page.getByRole("combobox").first();
        const current = (await pinky.textContent())?.trim();
        await pinky.click();
        const other = page.getByRole("option").filter({ hasNotText: current ?? "" }).first();
        const otherName = (await other.textContent())?.trim();
        await other.click();
        await expect(pinky).toContainText(otherName ?? "");
        await expect.poll(() => page.locator(CANVAS_KEY).count()).not.toBe(before);
    });
});
