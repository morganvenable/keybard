// Group 4, flow D3: import older formats (.vil, .viable, .json) from the toolbar.
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { stubSavePicker, savedFiles, tmpFile, shot, ROOT } from "./g4-helpers";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DEMO_SVIL = fs.readFileSync(path.resolve(ROOT, "src/default-layouts/sval-default.svil"), "utf8");
const OLD_SVIL = fs.readFileSync(path.resolve(ROOT, "public/old-sval-default.svil"), "utf8");

/** Put a distinctive key (F13) at layer 0, row 1, col 0 so the test can see it on the canvas. */
function withMarker(text: string, key = "KC_F13"): string {
    return text.replace(/("layout"\s*:\s*\[\s*\[\s*\[[^\]]*\]\s*,\s*\[\s*)"[^"]+"/, `$1"${key}"`);
}

async function importAndOpen(page: Page, file: string, findingId?: string) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import Layout" }).click();
    await (await chooser).setFiles(file);
    const review = page.getByRole("dialog", { name: "Review layout import" });
    if (findingId) {
        await expect(review.or(page.getByRole("alert").first())).toBeVisible();
        await shot(page, findingId);
    }
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Open layout" }).click();
    await expect(review).toBeHidden();
}

const canvasKey = (page: Page, label: string) =>
    page.locator(CANVAS_KEY).filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });

test.describe("D3 import older formats", () => {
    test("D3 the marker helper changes exactly one key", () => {
        expect(withMarker(DEMO_SVIL)).not.toBe(DEMO_SVIL);
        expect(withMarker(DEMO_SVIL).match(/KC_F13/g)?.length).toBe((DEMO_SVIL.match(/KC_F13/g)?.length ?? 0) + 1);
    });

    test("D3 a legacy .viable file opens with its keymap", async ({ page }) => {
        await openDemo(page);
        await expect(canvasKey(page, "F13")).toHaveCount(0);
        await importAndOpen(page, tmpFile("legacy.viable", withMarker(DEMO_SVIL)));
        await expect(canvasKey(page, "F13")).toHaveCount(1);
        await expect(page.getByText(/legacy\.viable/).first()).toBeVisible();
        expect(await page.locator(CANVAS_KEY).count()).toBeGreaterThan(40);
    });

    // g4-03: the older Svalboard default layout that ships with the app
    // (<base>/old-sval-default.svil) is refused with "This layout contains
    // unrecognized keycodes. No changes have been applied." It uses older names
    // (LSFT(KC_QUOTE), LSFT(KC_SCOLON), SV_OUTPUT_STATUS, SV_SNIPER_3, SV_*_DPI_*),
    // and the message does not say which keys are the problem.
    test("D3 an older Svalboard layout file (old key names) opens", async ({ page, allowConsoleError }) => {
        test.fail(true, "g4-03: old-sval-default.svil is refused as 'unrecognized keycodes'");
        allowConsoleError(/./);
        await openDemo(page);
        await importAndOpen(page, tmpFile("old-sval-default.svil", OLD_SVIL), "g4-03");
        expect(await page.locator(CANVAS_KEY).count()).toBeGreaterThan(40);
    });

    test("D3 a .json layout opens with its keymap", async ({ page }) => {
        await openDemo(page);
        await importAndOpen(page, tmpFile("layout.json", withMarker(DEMO_SVIL)));
        await expect(canvasKey(page, "F13")).toHaveCount(1);
    });

    // g4-04: a .vil exported by Keybard itself cannot be imported back: the
    // toolbar shows "h.slice is not a function" and nothing opens.
    test("D3 a Svalboard .vil (exported by Vial) opens with its keymap and Sval names default", async ({ page, allowConsoleError }) => {
        test.fail(true, "g4-04: importing an exported .vil fails with 'h.slice is not a function'");
        allowConsoleError(/slice/);
        await stubSavePicker(page);
        await openDemo(page, "demo=combos");
        // Make the .vil the way a user would: export it from the app.
        await page.getByRole("button", { name: "Export Layout" }).click();
        const dialog = page.getByRole("dialog", { name: "Export Keyboard Configuration" });
        await dialog.getByRole("combobox", { name: "Export format" }).click();
        await page.getByRole("option", { name: /\.vil/ }).click();
        await dialog.getByRole("button", { name: "Export", exact: true }).click();
        await expect.poll(async () => (await savedFiles(page)).length).toBe(1);
        const vil = (await savedFiles(page))[0].content;
        await importAndOpen(page, tmpFile("from-vial.vil", withMarker(vil)), "g4-04");
        await expect(canvasKey(page, "F13")).toHaveCount(1);
        // Sval-only fields default sensibly: default layer names, no combo names.
        await expect(page.getByRole("button", { name: /^Rename layer 0: Layer 0$/ })).toBeVisible();
        await page.getByRole("button", { name: "Combos", exact: true }).click();
        await expect(page.getByText("Quick escape")).toHaveCount(0);
    });

    test("D3 the review warns that a Svalboard .vil has no pointing or color settings", async ({ page, allowConsoleError }) => {
        test.fail(true, "g4-04: importing an exported .vil fails with 'h.slice is not a function'");
        allowConsoleError(/slice/);
        await stubSavePicker(page);
        await openDemo(page);
        await page.getByRole("button", { name: "Export Layout" }).click();
        const dialog = page.getByRole("dialog", { name: "Export Keyboard Configuration" });
        await dialog.getByRole("combobox", { name: "Export format" }).click();
        await page.getByRole("option", { name: /\.vil/ }).click();
        await dialog.getByRole("button", { name: "Export", exact: true }).click();
        await expect.poll(async () => (await savedFiles(page)).length).toBe(1);
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import Layout" }).click();
        await (await chooser).setFiles(tmpFile("from-vial.vil", (await savedFiles(page))[0].content));
        const review = page.getByRole("dialog", { name: "Review layout import" });
        await expect(review).toBeVisible();
        await expect(review).toContainText(/pointing|layer colors|hardware/i);
    });

    // A .vil from another keyboard (the app's sample-keyboard.vil, 4 layers of 5 x 10).
    test("D3 a .vil from another keyboard is refused or drawn cleanly", async ({ page, allowConsoleError }) => {
        allowConsoleError(/./);
        await openDemo(page);
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import Layout" }).click();
        await (await chooser).setFiles(path.resolve(ROOT, "public/sample-keyboard.vil"));
        const review = page.getByRole("dialog", { name: "Review layout import" });
        await expect(review.or(page.getByRole("alert").first())).toBeVisible();
        if (await review.isVisible()) {
            await review.getByRole("button", { name: "Open layout" }).click();
            await expect(review).toBeHidden();
        }
        await page.waitForTimeout(600);
        await expect(page.locator(CANVAS_KEY).first().or(page.getByRole("alert").first())).toBeVisible();
        const overlaps = await page.locator(CANVAS_KEY).evaluateAll((els) => {
            const boxes = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
            let n = 0;
            for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i], b = boxes[j];
                const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (w > 6 && h > 6) n++;
            }
            return n;
        });
        expect(overlaps, "canvas keys that overlap each other").toBe(0);
    });
});
