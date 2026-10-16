// Group 2, area B: the layout editor. Pick a key, assign it, drag, layers,
// layer actions and the keyboard shortcuts, done the way a user does them.
// Demo layout only (no keyboard). A test marked test.fail() documents a
// finding (g2-NN): it passes while the app is wrong, and fails once it is fixed.
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import {
    POS, keyAt, keyWith, openRail, selectKey, isSelected, pickerKey, canvasKeycodes,
    setSetting, closePanel, shotFinding, SELECTED,
} from "./g2-helpers";
import type { Page } from "@playwright/test";

/** The layer strip tabs (they open a context menu on right click). */
const TABS = "[data-slot='context-menu-trigger']";
const layerTab = (page: Page, i: number | string) =>
    page.getByRole("region", { name: "Keyboard canvas" }).locator(TABS).filter({ hasText: new RegExp(`^${i}$`) }).first();

async function layerTabOrder(page: Page): Promise<string[]> {
    return page.getByRole("region", { name: "Keyboard canvas" }).locator(TABS).evaluateAll(
        (els) => els.filter((e) => (e as HTMLElement).offsetWidth > 0).map((e) => (e.textContent || "").trim()),
    );
}

/** The active tab is drawn dark; the class is the only signal (see g2-09). */
const ACTIVE_TAB = /(^|\s)bg-gray-800(\s|$)/;

async function layerMenu(page: Page, layer: number, item: string) {
    await page.getByRole("button", { name: `Actions for layer ${layer}` }).click();
    await page.getByRole("menuitem", { name: item }).click();
}

test.describe("B. Layout editor", () => {
    // ------------------------------------------------------------------ B1
    test("B1 click a key to select it, click again to clear", async ({ page }) => {
        await openDemo(page);
        const esc = keyAt(page, POS.esc);
        await expect(esc).not.toHaveClass(SELECTED);
        await esc.click();
        await expect(esc).toHaveClass(SELECTED);
        // The inspector names the key the user picked.
        await expect(page.getByText("Layer 0 · R3 C4 · Matrix 22")).toBeVisible();
        await esc.click();
        await expect(esc).not.toHaveClass(SELECTED);
        // Selecting another key moves the selection; only one key is selected.
        await keyAt(page, POS.a).click();
        await keyAt(page, POS.s).click();
        await expect(page.locator(`${CANVAS_KEY}.bg-red-500`)).toHaveCount(1);
        await expect(keyAt(page, POS.s)).toHaveClass(SELECTED);
    });

    // ------------------------------------------------------------------ B2
    test("B2 assign B from the Standard Keys picker", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        const esc = await selectKey(page, POS.esc);
        await pickerKey(panel, "b").click();
        await expect(esc).toHaveAttribute("data-keycode", "KC_B");
        await expect(esc).toHaveText(/^b$/i);
        // The demo has no keyboard, so the change shows as an Undo in the toolbar.
        const undo = page.getByRole("button", { name: "Undo", exact: true });
        await expect(undo).toBeVisible();
        await undo.click();
        await expect(esc).toHaveAttribute("data-keycode", "KC_ESCAPE");
    });

    test("B2b with no key selected, clicking a picker key changes nothing", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        const before = await canvasKeycodes(page);
        await pickerKey(panel, "b").click();
        expect(await canvasKeycodes(page)).toEqual(before);
    });

    // ------------------------------------------------------------------ B3
    test("B3 modifier strip: Shift+Ctrl on the left, then the right, then None", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        const esc = keyAt(page, POS.esc);
        const hand = panel.getByRole("group", { name: "Modifier hand" });
        await expect(hand.getByRole("button", { name: "L" })).toHaveAttribute("aria-pressed", "true");

        await selectKey(page, POS.esc);
        await panel.getByRole("button", { name: "SHIFT", exact: true }).click();
        await panel.getByRole("button", { name: "CTRL", exact: true }).click();
        await pickerKey(panel, "a").click();
        await expect(esc).toHaveAttribute("data-keycode", "C_S(KC_A)");
        // The keycap names the modifiers along with the key.
        await expect(esc).toContainText(/C_S|LCS|ctrl|shift/i);

        // Selecting a key that holds left-hand modifiers turns the toggle to L, so pick R after selecting.
        await selectKey(page, POS.esc);
        await expect(hand.getByRole("button", { name: "L" })).toHaveAttribute("aria-pressed", "true");
        await hand.getByRole("button", { name: "R" }).click();
        await expect(hand.getByRole("button", { name: "R" })).toHaveAttribute("aria-pressed", "true");
        await pickerKey(panel, "a").click();
        await expect(esc).toHaveAttribute("data-keycode", "RSC(KC_A)");
        await expect(esc).toContainText(/RSC|R ?ctrl|R ?shift/i);

        // Selecting the key again shows R, because the key now holds right-hand modifiers.
        await selectKey(page, POS.esc);
        await expect(hand.getByRole("button", { name: "R" })).toHaveAttribute("aria-pressed", "true");
        await panel.getByRole("button", { name: "None", exact: true }).click();
        await pickerKey(panel, "a").click();
        await expect(esc).toHaveAttribute("data-keycode", "KC_A");
    });

    test("B3b modifier toggles tell assistive tech which are on", async ({ page }) => {
        test.fail(true, "g2-04: SHIFT/CTRL/ALT/GUI toggles have no aria-pressed; only the color shows they are on");
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        const shift = panel.getByRole("button", { name: "SHIFT", exact: true });
        await shift.click();
        await shotFinding(page, "g2-04", panel);
        await expect(shift).toHaveAttribute("aria-pressed", "true", { timeout: 2000 });
    });

    // ------------------------------------------------------------------ B4
    for (const m of ["MO", "DF", "TG", "TT", "OSL", "TO"] as const) {
        test(`B4 Layer Keys: ${m} to layer 3`, async ({ page }) => {
            await openDemo(page);
            const panel = await openRail(page, "Layer Keys");
            await panel.getByRole("button", { name: m, exact: true }).click();
            await expect(panel.getByRole("button", { name: m, exact: true })).toHaveAttribute("aria-pressed", "true");
            const esc = await selectKey(page, POS.esc);
            await panel.locator("[data-binding-row='3'] [data-keycap]").click();
            await expect(esc).toHaveAttribute("data-keycode", `${m}(3)`);
            await expect(esc).toContainText(m);
            await expect(esc).toContainText("3");
            await expect(esc.locator("svg")).toHaveCount(1); // the layer icon
        });
    }

    test("B4 Layer Keys: PDF to layer 3 makes a PDF key", async ({ page }) => {
        test.fail(true, "g2-10: the picker shows 'PDF 3' but the key becomes DF(3) and reads 'DF 3' (a plain default-layer key, not a persistent one)");
        await openDemo(page);
        const panel = await openRail(page, "Layer Keys");
        await panel.getByRole("button", { name: "PDF", exact: true }).click();
        const pdf = panel.locator("[data-binding-row='3'] [data-keycap]");
        await expect(pdf).toContainText("PDF");
        const esc = await selectKey(page, POS.esc);
        await pdf.click();
        await expect(esc).not.toHaveAttribute("data-keycode", "KC_ESCAPE");
        await shotFinding(page, "g2-10");
        await expect(esc).toContainText("PDF", { timeout: 2000 });
        await expect(esc).toHaveAttribute("data-keycode", "PDF(3)", { timeout: 1000 });
    });

    test("B4 Layer Keys: LT to layer 3 keeps the key's tap action", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Layer Keys");
        await panel.getByRole("button", { name: "LT", exact: true }).click();
        const esc = await selectKey(page, POS.esc);
        await panel.locator("[data-binding-row='3'] [data-keycap]").click();
        await expect(esc).toHaveAttribute("data-keycode", "LT3(KC_ESCAPE)");
        await expect(esc).toContainText(/LT3/i);
        await expect(esc).toContainText(/esc/i);
    });

    test("B4 Layer Keys: LT on a key with no plain tap key asks for one", async ({ page }) => {
        test.fail(true, "g2-05: LT on a key that holds MO(1) wipes the key to KC_NO (blank keycap) with no prompt for a tap key");
        await openDemo(page);
        const panel = await openRail(page, "Layer Keys");
        await panel.getByRole("button", { name: "LT", exact: true }).click();
        const mo = await selectKey(page, 32); // MO(1) in the demo
        await panel.locator("[data-binding-row='3'] [data-keycap]").click();
        await shotFinding(page, "g2-05");
        // Expected: an LT3 key (with a way to pick its tap key), never a blank key.
        await expect(mo).toHaveAttribute("data-keycode", /^LT3\(/, { timeout: 2000 });
    });

    // ------------------------------------------------------------------ B5
    for (const rail of ["Special Keys", "Mouse Keys"]) {
        test(`B5 ${rail}: the canvas label matches the picker label`, async ({ page }) => {
            await openDemo(page);
            const panel = await openRail(page, rail);
            const pick = panel.locator("[data-keycap]").nth(2);
            const pickerLabel = (await pick.innerText()).replace(/\s+/g, " ").trim().toLowerCase();
            const esc = await selectKey(page, POS.esc);
            await pick.click();
            await expect(esc).not.toHaveAttribute("data-keycode", "KC_ESCAPE");
            const canvasLabel = (await esc.innerText()).replace(/\s+/g, " ").trim().toLowerCase();
            expect(canvasLabel, `picker "${pickerLabel}" vs canvas "${canvasLabel}"`).toBe(pickerLabel);
        });
    }

    // ------------------------------------------------------------------ B6
    test("B6 Settings > International Keyboards: German (QWERTZ) swaps Z and Y", async ({ page }) => {
        test.fail(true, "g2-06: Settings > International Keyboards changes nothing; key labels follow only the separate language list in Standard Keys");
        await openDemo(page);
        await setSetting(page, "International Keyboards", "German (QWERTZ)");
        await shotFinding(page, "g2-06");
        // The KC_Y key should read Z, and the KC_Z key Y.
        await expect(keyWith(page, "KC_Y")).toHaveText(/^z$/i, { timeout: 2000 });
    });

    test("B6 Settings > International Keyboards is kept after a reload", async ({ page }) => {
        await openDemo(page);
        await setSetting(page, "International Keyboards", "German (QWERTZ)");
        await page.reload();
        await openDemo(page);
        const settings = await openRail(page, "Settings");
        const value = await settings.getByRole("combobox", { name: "International Keyboards" })
            .evaluate((el) => { const sel = el as HTMLSelectElement; return sel.options[sel.selectedIndex]?.text; });
        expect(value).toBe("German (QWERTZ)");
    });

    test("B6 Standard Keys language German swaps Z and Y in the picker and on the canvas", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        await panel.getByRole("combobox").first().selectOption({ label: "German" });
        await expect(pickerKey(panel, "z")).toHaveText(/^z$/i);
        await expect(panel.locator("[data-picker-key='ü']").first()).toBeVisible();
        await expect(keyWith(page, "KC_Y")).toHaveText(/^z$/i);
        await expect(keyWith(page, "KC_Z")).toHaveText(/^y$/i);
    });

    test("B6 Standard Keys language is kept after a reload", async ({ page }) => {
        test.fail(true, "g2-13: the Standard Keys language (German) resets to English (US) after a reload, so labels go back to QWERTY");
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        await panel.getByRole("combobox").first().selectOption({ label: "German" });
        await expect(keyWith(page, "KC_Y")).toHaveText(/^z$/i);
        await page.reload();
        await openDemo(page);
        await openRail(page, "Standard Keys");
        await shotFinding(page, "g2-13");
        await expect(keyWith(page, "KC_Y")).toHaveText(/^z$/i, { timeout: 2000 });
    });

    // ------------------------------------------------------------------ B7
    test("B7 Delete, Backspace, Shift+Backspace on a selected key", async ({ page }) => {
        await openDemo(page);
        await setSetting(page, "Typing Binds a Key", "OFF");
        await closePanel(page);
        const esc = await selectKey(page, POS.esc);
        await page.keyboard.press("Delete");
        await expect(esc).toHaveAttribute("data-keycode", "KC_TRNS");
        await selectKey(page, POS.esc);
        await page.keyboard.press("Backspace");
        await expect(esc).toHaveAttribute("data-keycode", "KC_NO");
        await selectKey(page, POS.esc);
        await page.keyboard.press("Shift+Backspace");
        await expect(esc).toHaveAttribute("data-keycode", "KC_TRNS");
    });

    test("B7b Backspace in a text field does not touch the selected key", async ({ page }) => {
        await openDemo(page);
        await setSetting(page, "Typing Binds a Key", "OFF");
        const settings = page.getByRole("complementary", { name: "Settings" });
        const a = await selectKey(page, POS.a);
        const field = settings.getByRole("spinbutton", { name: "Ball Gloss" });
        await field.click();
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Delete");
        await expect(a).toHaveAttribute("data-keycode", "KC_A");
    });

    // ------------------------------------------------------------------ B8
    test("B8 Typing Binds a Key: q, Ctrl+Shift+A, Right Shift+A", async ({ page }) => {
        await openDemo(page);
        const settings = await openRail(page, "Settings");
        await expect(settings.getByRole("group", { name: "Typing Binds a Key" }).getByRole("button", { name: "ON" }))
            .toHaveAttribute("aria-pressed", "true");
        await closePanel(page);
        const k = keyAt(page, POS.esc);
        await selectKey(page, POS.esc);
        await page.keyboard.press("q");
        await expect(k).toHaveAttribute("data-keycode", "KC_Q");

        await selectKey(page, POS.esc);
        await page.keyboard.press("Control+Shift+KeyA");
        await expect(k).toHaveAttribute("data-keycode", "C_S(KC_A)");

        await selectKey(page, POS.esc);
        await page.keyboard.down("ShiftRight");
        await page.keyboard.press("KeyA");
        await page.keyboard.up("ShiftRight");
        await expect(k).toHaveAttribute("data-keycode", "RSFT(KC_A)");
    });

    test("B8b Esc with a key selected clears the selection and binds nothing", async ({ page }) => {
        test.fail(true, "g2-11: Esc does not clear a selected canvas key; it stays red and the next typed key still binds to it");
        await openDemo(page);
        const a = await selectKey(page, POS.a);
        await page.keyboard.press("Escape");
        await shotFinding(page, "g2-11");
        await expect(a).not.toHaveClass(SELECTED, { timeout: 2000 });
        await expect(a).toHaveAttribute("data-keycode", "KC_A");
    });

    test("B8c after a typed bind the inspector shows the new key, not the old one", async ({ page }) => {
        test.fail(true, "g2-01: after typing q onto Esc, the pinned inspector card still says 'Esc' and the key keeps its pin outline");
        await openDemo(page);
        const k = await selectKey(page, POS.esc);
        await page.keyboard.press("q");
        await expect(k).toHaveAttribute("data-keycode", "KC_Q");
        const card = page.getByText(/Pinned · Esc clears/).locator("..").locator("..");
        await shotFinding(page, "g2-01");
        await expect(page.getByRole("region", { name: "Keyboard canvas" }).locator("strong").first())
            .not.toHaveText("Esc", { timeout: 2000 });
        void card;
    });

    // ------------------------------------------------------------------ B9
    test("B9 Serial Assignment by key direction advances after each assign", async ({ page }) => {
        await openDemo(page);
        await setSetting(page, "Serial Assignment", "Svalboard by key direction");
        const panel = await openRail(page, "Standard Keys");
        // Svalboard order starts with the North keys: 27, 21, 15, 9, ...
        await selectKey(page, 27);
        await pickerKey(panel, "1").click();
        await expect(keyAt(page, 27)).toHaveAttribute("data-keycode", "KC_1");
        await expect(keyAt(page, 21)).toHaveClass(SELECTED);
        await pickerKey(panel, "2").click();
        await expect(keyAt(page, 21)).toHaveAttribute("data-keycode", "KC_2");
        await expect(keyAt(page, 15)).toHaveClass(SELECTED);
        await pickerKey(panel, "3").click();
        await expect(keyAt(page, 15)).toHaveAttribute("data-keycode", "KC_3");
        await expect(keyAt(page, 9)).toHaveClass(SELECTED);
    });

    test("B9b with Serial Assignment None the selection clears after an assign", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        const k = await selectKey(page, 27);
        await pickerKey(panel, "1").click();
        await expect(k).toHaveAttribute("data-keycode", "KC_1");
        await expect(page.locator(`${CANVAS_KEY}.bg-red-500`)).toHaveCount(0);
    });

    // ------------------------------------------------------------------ B10
    async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, release = true) {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + 8, from.y + 8, { steps: 4 });
        await page.mouse.move(to.x, to.y, { steps: 12 });
        if (release) await page.mouse.up();
    }
    const center = async (l: import("@playwright/test").Locator) => {
        const b = (await l.boundingBox())!;
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };

    test("B10 drag key A onto key S swaps them", async ({ page }) => {
        await openDemo(page);
        const a = keyAt(page, 26); // KC_A
        const s = keyAt(page, 20); // KC_S
        await drag(page, await center(a), await center(s));
        await expect(keyAt(page, 20)).toHaveAttribute("data-keycode", "KC_A");
        await expect(keyAt(page, 26)).toHaveAttribute("data-keycode", "KC_S");
    });

    test("B10 drag a picker key onto a canvas key assigns it", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Standard Keys");
        await drag(page, await center(pickerKey(panel, "b")), await center(keyAt(page, POS.esc)));
        await expect(keyAt(page, POS.esc)).toHaveAttribute("data-keycode", "KC_B");
    });

    test("B10 Esc during a drag cancels it", async ({ page }) => {
        await openDemo(page);
        const before = await canvasKeycodes(page);
        await drag(page, await center(keyAt(page, 26)), await center(keyAt(page, 20)), false);
        await page.keyboard.press("Escape");
        await page.mouse.up();
        expect(await canvasKeycodes(page)).toEqual(before);
    });

    // ------------------------------------------------------------------ B11
    test("B11 layer strip: layers 1, 14 and mouse show on the canvas", async ({ page }) => {
        await openDemo(page);
        const badge = page.getByRole("button", { name: /^Rename layer \d+:/ });
        for (const [tab, idx] of [["1", 1], ["14", 14], ["mouse", 15]] as const) {
            const before = await canvasKeycodes(page);
            await layerTab(page, tab).click();
            await expect(layerTab(page, tab)).toHaveClass(ACTIVE_TAB);
            await expect(badge).toHaveAttribute("aria-label", new RegExp(`^Rename layer ${idx}:`));
            const after = await canvasKeycodes(page);
            expect(after, `layer ${tab} shows its own keys`).not.toEqual(before);
        }
        await layerTab(page, "0").click();
        await expect(keyAt(page, POS.esc)).toHaveAttribute("data-keycode", "KC_ESCAPE");
    });

    test("B11 Reverse Layer Order flips the strip", async ({ page }) => {
        await openDemo(page);
        const before = await layerTabOrder(page);
        await page.getByRole("button", { name: "Reverse Layer Order" }).click();
        await expect.poll(() => layerTabOrder(page)).toEqual([...before].reverse());
        await page.getByRole("button", { name: "Reverse Layer Order" }).click();
        await expect.poll(() => layerTabOrder(page)).toEqual(before);
    });

    test("B11 Hide Transparent Layers hides empty layers from the strip", async ({ page }) => {
        await openDemo(page);
        const all = await layerTabOrder(page);
        const hide = page.getByRole("button", { name: "Hide Transparent Layers" });
        await hide.click();
        await expect(page.getByRole("button", { name: "Show All Layers" })).toBeVisible();
        const shown = await layerTabOrder(page);
        expect(shown.length).toBeLessThan(all.length);
        expect(shown).toContain("0");
        // Every hidden layer is all transparent: switch back and check one.
        const hidden = all.filter((l) => !shown.includes(l));
        await page.getByRole("button", { name: "Show All Layers" }).click();
        await layerTab(page, hidden[0]).click();
        const codes = await canvasKeycodes(page);
        expect(codes.every((c) => c === "KC_TRNS")).toBe(true);
    });

    test("B11b the layer tooltip and its button agree on the name", async ({ page }) => {
        test.fail(true, "g2-07: the button is 'Reverse Layer Order' but its tooltip says 'Flip Layer View'");
        await openDemo(page);
        const btn = page.getByRole("button", { name: "Reverse Layer Order" });
        await btn.hover();
        const tip = page.getByRole("tooltip");
        await expect(tip).toBeVisible();
        await shotFinding(page, "g2-07");
        await expect(tip).toHaveText(/Reverse Layer Order/, { timeout: 1500 });
    });

    // ------------------------------------------------------------------ B12
    test("B12 layer color: a preset recolors the keys", async ({ page }) => {
        await openDemo(page);
        const esc = keyAt(page, POS.esc);
        const bgBefore = await esc.evaluate((e) => getComputedStyle(e).backgroundColor);
        await page.getByRole("button", { name: "Change color for layer 0" }).click();
        const choices = page.locator("[data-color-choice]");
        await expect(choices.first()).toBeVisible();
        const pressed = choices.locator("xpath=self::*[@aria-pressed='true']");
        await expect(pressed).toHaveCount(1);
        // Pick a color other than the current one.
        const other = choices.locator("xpath=self::*[@aria-pressed='false']").nth(2);
        await other.click();
        await expect.poll(() => esc.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(bgBefore);
        // Esc closes the color list.
        if (await choices.first().isVisible()) {
            await page.keyboard.press("Escape");
            await expect(choices.first()).toBeHidden();
        }
    });

    test("B12 layer color: a custom hex recolors the keys", async ({ page }) => {
        await openDemo(page);
        const esc = keyAt(page, POS.esc);
        await page.getByRole("button", { name: "Change color for layer 0" }).click();
        await page.getByRole("button", { name: "Custom layer color" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        // The dialog edits the LED color first; the keys on screen use "Key color".
        await dialog.getByRole("button", { name: "Key color" }).click();
        await expect(dialog.getByRole("button", { name: "Key color" })).toHaveAttribute("aria-pressed", "true");
        await dialog.getByRole("button", { name: /^Edit hex color/ }).click();
        const hex = dialog.getByRole("textbox", { name: "Hex color" });
        await hex.fill("#3366ff");
        await hex.press("Enter");
        await dialog.getByRole("button", { name: "Apply" }).click();
        await expect(dialog).toBeHidden();
        // The color goes through HSV, so allow a small rounding step per channel.
        await expect.poll(async () => {
            const rgb = (await esc.evaluate((e) => getComputedStyle(e).backgroundColor)).match(/\d+/g)!.map(Number);
            return [51, 102, 255].every((v, i) => Math.abs(v - rgb[i]) <= 4);
        }).toBe(true);
    });

    test("B12 rename a layer: Enter commits, Esc cancels", async ({ page }) => {
        await openDemo(page);
        await page.getByRole("button", { name: "Rename layer 0: Layer 0" }).click();
        const input = page.getByRole("textbox", { name: "Rename layer 0" });
        await expect(input).toBeFocused();
        await input.fill("Home");
        await input.press("Enter");
        await expect(page.getByRole("button", { name: /^Rename layer 0: .*Home/ })).toBeVisible();
        await expect(layerTab(page, "Home")).toBeVisible();
        // Esc keeps the old name.
        await page.getByRole("button", { name: /^Rename layer 0:/ }).click();
        await page.getByRole("textbox", { name: "Rename layer 0" }).fill("Throwaway");
        await page.getByRole("textbox", { name: "Rename layer 0" }).press("Escape");
        await expect(page.getByRole("button", { name: /^Rename layer 0: .*Home/ })).toBeVisible();
        await expect(page.getByText("Throwaway")).toHaveCount(0);
    });

    test("B12 a renamed layer and its color survive Export .svil", async ({ page }) => {
        // Use the plain download path (the save picker is a native window Playwright cannot drive).
        await page.addInitScript(() => { delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker; });
        await openDemo(page);
        await page.getByRole("button", { name: "Rename layer 0: Layer 0" }).click();
        await page.getByRole("textbox", { name: "Rename layer 0" }).fill("Home");
        await page.getByRole("textbox", { name: "Rename layer 0" }).press("Enter");
        await page.getByRole("button", { name: "Export Layout" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            dialog.getByRole("button", { name: "Export", exact: true }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.svil$/);
        const body = await (await download.createReadStream()).toArray();
        expect(Buffer.concat(body).toString("utf8")).toContain("Home");
    });

    // ------------------------------------------------------------------ B13
    test("B13 Copy Layer 0, click layer 3, Ctrl+V opens the paste dialog", async ({ page }) => {
        test.fail(true, "g2-12: Ctrl+V does nothing right after clicking a layer tab (focus stays on the tab button, which the shortcut ignores)");
        await openDemo(page);
        await layerMenu(page, 0, "Copy Layer");
        await layerTab(page, "3").click();
        await expect(layerTab(page, "3")).toHaveClass(ACTIVE_TAB);
        await page.keyboard.press("Control+v");
        await shotFinding(page, "g2-12");
        await expect(page.getByRole("dialog")).toContainText("Clipboard has a copy of", { timeout: 2000 });
    });

    test("B13 Copy Layer 0, paste onto layer 3 with Ctrl+V", async ({ page }) => {
        await openDemo(page);
        const layer0 = await canvasKeycodes(page);
        await layerMenu(page, 0, "Copy Layer");
        await layerTab(page, "3").click();
        await expect(layerTab(page, "3")).toHaveClass(ACTIVE_TAB);
        // Move focus off the tab, then paste.
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.keyboard.press("Control+v");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("Clipboard has a copy of");
        await dialog.getByRole("button", { name: "Now" }).click();
        await expect(dialog).toBeHidden();
        await expect.poll(() => canvasKeycodes(page)).toEqual(layer0);
    });

    test("B13 Paste Layer from the menu", async ({ page }) => {
        await openDemo(page);
        const layer0 = await canvasKeycodes(page);
        await layerMenu(page, 0, "Copy Layer");
        const dialog = page.getByRole("dialog");
        // Copy may offer to paste at once; "Later" keeps the clipboard.
        if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: "Later" }).click();
        await layerTab(page, "4").click();
        await layerMenu(page, 4, "Paste Layer");
        if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: "Now" }).click();
        await expect.poll(() => canvasKeycodes(page)).toEqual(layer0);
    });

    test("B13 Paste Layer with nothing copied explains why and changes nothing", async ({ page }) => {
        // Paste reads the system clipboard (a layer copied in another window counts),
        // so the item stays enabled; with no layer there it must say so.
        await openDemo(page);
        const before = await canvasKeycodes(page);
        await expect(page.getByText(/clipboard/i)).toHaveCount(0);
        await layerMenu(page, 0, "Paste Layer");
        await expect(page.getByText(/clipboard/i).first()).toBeVisible();
        expect(await canvasKeycodes(page)).toEqual(before);
    });

    test("B13 Make All Blank, Make All Transparent and the switch items", async ({ page }) => {
        await openDemo(page);
        await layerMenu(page, 0, "Make All Blank");
        await expect.poll(async () => (await canvasKeycodes(page)).every((c) => c === "KC_NO")).toBe(true);
        await page.getByRole("button", { name: "Actions for layer 0" }).click();
        await expect(page.getByRole("menuitem", { name: "Switch Transparent to Blank" })).toBeDisabled();
        await expect(page.getByRole("menuitem", { name: "Switch Blank to Transparent" })).toBeEnabled();
        await page.getByRole("menuitem", { name: "Switch Blank to Transparent" }).click();
        await expect.poll(async () => (await canvasKeycodes(page)).every((c) => c === "KC_TRNS")).toBe(true);
        await page.getByRole("button", { name: "Actions for layer 0" }).click();
        await expect(page.getByRole("menuitem", { name: "Switch Blank to Transparent" })).toBeDisabled();
        await page.getByRole("menuitem", { name: "Switch Transparent to Blank" }).click();
        await expect.poll(async () => (await canvasKeycodes(page)).every((c) => c === "KC_NO")).toBe(true);
        await layerMenu(page, 0, "Make All Transparent");
        await expect.poll(async () => (await canvasKeycodes(page)).every((c) => c === "KC_TRNS")).toBe(true);
    });

    test("B13 Copy Layer works on a layer that holds a DF key", async ({ page }) => {
        await openDemo(page);
        const panel = await openRail(page, "Layer Keys");
        await panel.getByRole("button", { name: "DF", exact: true }).click();
        await selectKey(page, POS.esc);
        await panel.locator("[data-binding-row='3'] [data-keycap]").click();
        await expect(keyAt(page, POS.esc)).toHaveAttribute("data-keycode", "DF(3)");
        const layer0 = await canvasKeycodes(page);
        await layerMenu(page, 0, "Copy Layer");
        await layerTab(page, "4").click();
        await layerMenu(page, 4, "Paste Layer");
        const dialog = page.getByRole("dialog");
        if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: "Now" }).click();
        await expect.poll(() => canvasKeycodes(page)).toEqual(layer0);
    });

    test("B13 right-click a layer tab offers Copy and Paste", async ({ page }) => {
        await openDemo(page);
        await layerTab(page, "2").click({ button: "right" });
        const menu = page.getByRole("menu");
        await expect(menu.getByRole("menuitem", { name: "Copy Layer" })).toBeVisible();
        await expect(menu.getByRole("menuitem", { name: "Paste Layer" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
    });

    test("B11 the active layer tab is exposed to assistive tech", async ({ page }) => {
        test.fail(true, "g2-09: layer tabs carry no aria-pressed/aria-current; only the dark fill shows which layer is open");
        await openDemo(page);
        await layerTab(page, "2").click();
        await expect(layerTab(page, "2")).toHaveClass(ACTIVE_TAB);
        await shotFinding(page, "g2-09", page.getByRole("region", { name: "Keyboard canvas" }));
        const state = await layerTab(page, "2").evaluate((e) => e.getAttribute("aria-pressed") || e.getAttribute("aria-current") || e.getAttribute("aria-selected"));
        expect(state).toMatch(/true|page/);
    });

    // ------------------------------------------------------------------ B14
    test("B14 Save Layer... keeps 'Mine' in Layouts after a reload", async ({ page }) => {
        await openDemo(page);
        await layerMenu(page, 0, "Save Layer...");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const save = dialog.getByRole("button", { name: "Save", exact: true });
        const name = dialog.getByLabel("Layer Name *");
        await expect(name).toHaveValue("Layer 0");
        await name.fill("");
        await expect(save).toBeDisabled();
        await name.fill("Mine");
        await save.click();
        await expect(dialog).toBeHidden();
        await page.reload();
        await openDemo(page);
        const layouts = await openRail(page, "Layouts");
        await expect(layouts.getByText("Mine", { exact: true }).first()).toBeVisible();
    });

    // ------------------------------------------------------------------ B15
    test("B15 an unsaved edit warns before reload; after it the connect page shows", async ({ page }) => {
        await page.goto("./");
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        const panel = await openRail(page, "Standard Keys");
        await selectKey(page, POS.esc);
        await pickerKey(panel, "b").click();
        await expect(keyAt(page, POS.esc)).toHaveAttribute("data-keycode", "KC_B");
        let sawPrompt = false;
        page.on("dialog", async (d) => {
            if (d.type() === "beforeunload") sawPrompt = true;
            await d.accept();
        });
        await page.reload();
        expect(sawPrompt, "a beforeunload prompt").toBe(true);
        await expect(page.getByRole("button", { name: "QWERTY Example", exact: true })).toBeVisible();
        await expect(page.locator(CANVAS_KEY)).toHaveCount(0);
    });

    test("B15b with no edits, reload does not warn", async ({ page }) => {
        await page.goto("./");
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await keyAt(page, POS.esc).click();
        let sawPrompt = false;
        page.on("dialog", async (d) => { sawPrompt = true; await d.accept(); });
        await page.reload();
        await expect(page.getByRole("button", { name: "QWERTY Example", exact: true })).toBeVisible();
        expect(sawPrompt).toBe(false);
    });

    void isSelected;
});
