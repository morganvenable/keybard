// Group 1, area A: entry points and review URL params (A1-A4, A6, A7, A15).
import { test, expect, openDemo, CANVAS_KEY } from "./fixtures";
import { detailPanel, findingShot, knownBug, openRailPanel } from "./g1-helpers";

const LAYER_LABELS = [...Array.from({ length: 15 }, (_, i) => String(i)), "mouse"];

async function expectDemoEditor(page: import("@playwright/test").Page) {
    await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(CANVAS_KEY)).toHaveCount(52);
    // The editing target is announced (screen-reader status, no visible row).
    const status = page.getByRole("status").filter({ hasText: "Offline draft" });
    await expect(status).toContainText("Offline draft: QWERTY example (demo)");
    await expect(status).toContainText("No keyboard writes. Export to keep edits.");
    const canvas = page.getByRole("region", { name: "Keyboard canvas" });
    for (const label of LAYER_LABELS) {
        await expect(canvas.getByRole("button", { name: label, exact: true })).toHaveCount(1);
    }
}

test.describe("A1-A3 entry points", () => {
    test("A1 the bare URL opens the connect page", async ({ page }) => {
        await page.goto("./");
        await expect(page.getByRole("button", { name: "Connect Keyboard", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Load File", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "QWERTY Example", exact: true })).toBeVisible();
        await expect(page.locator(CANVAS_KEY)).toHaveCount(0);
        // Focus lands on Connect so Enter connects.
        await expect(page.getByRole("button", { name: "Connect Keyboard", exact: true })).toBeFocused();
    });

    test("A1 the browser tab is titled with the product name as written everywhere else", async ({ page }) => {
        // g1-01: the tab title reads "KeyBard"; the app, manual and site write "Keybard".
        knownBug(test, "g1-01");
        await page.goto("./");
        await findingShot(page, "g1-01");
        await expect(page).toHaveTitle(/^Keybard\b/);
    });

    test("A2 QWERTY Example loads the offline draft", async ({ page }) => {
        await page.goto("./");
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expectDemoEditor(page);
        await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeVisible();
    });

    test("A3 ?demo loads the example with no click, and a reload returns to it", async ({ page }) => {
        await openDemo(page);
        await expectDemoEditor(page);
        await page.reload();
        await expectDemoEditor(page);
    });

    test("A3 the demo on the landing page and ?demo show the same layout", async ({ page }) => {
        await openDemo(page);
        const viaParam = await page.locator(CANVAS_KEY).allInnerTexts();
        await page.goto("./");
        await page.getByRole("button", { name: "QWERTY Example", exact: true }).click();
        await expect(page.locator(CANVAS_KEY)).toHaveCount(52);
        expect(await page.locator(CANVAS_KEY).allInnerTexts()).toEqual(viaParam);
    });
});

test.describe("A4 ?demo=combos", () => {
    test("lists 3 combos (two named), 2 tap dances and 2 macros", async ({ page }) => {
        await openDemo(page, "demo=combos");
        await openRailPanel(page, "Combos");
        const panel = detailPanel(page);
        await expect(panel.getByRole("heading", { name: "Combos" })).toBeVisible();
        const rows = panel.getByRole("button", { name: /(^Combo \d+:)|(\(Combo \d+\):)/ });
        await expect(rows).toHaveCount(3);
        await expect(rows.nth(0)).toHaveAccessibleName("Quick escape (Combo 0): F plus D gives Esc");
        await expect(rows.nth(1)).toHaveAccessibleName("Combo 1: J plus K gives Enter");
        await expect(rows.nth(2)).toHaveAccessibleName("Next field (Combo 2): S plus D plus F gives Tab");
        await expect(rows.nth(0)).toContainText("Quick escape");
        await expect(rows.nth(1)).not.toContainText(/Quick escape|Next field/);

        await openRailPanel(page, "Tap Dance Keys");
        await expect(panel.getByRole("heading", { name: "Tap Dance Keys" })).toBeVisible();
        await expect(panel).toContainText("LCtrl");
        await expect(panel).toContainText("Esc");

        await openRailPanel(page, "Macro Keys");
        await expect(panel.getByRole("heading", { name: "Macro Keys" })).toBeVisible();
        await expect(panel).toContainText('"hello world"');
        await expect(panel).toContainText("100ms");
    });
});

test.describe("A6 ?edit opens an editor", () => {
    const cases = [
        { edit: "combo:0", heading: "Editing Combo 0", list: "Combos", sub: "Quick escape" },
        { edit: "tapdance:1", heading: "Editing Tap Dance 1", list: "Tap Dance Keys", sub: null },
        { edit: "macro:1", heading: "Editing Macro 1", list: "Macro Keys", sub: null },
    ];
    for (const c of cases) {
        test(`edit=${c.edit} opens that editor and Esc closes it`, async ({ page }) => {
            await openDemo(page, `demo=combos&edit=${c.edit}`);
            const panel = detailPanel(page);
            await expect(panel).toHaveAttribute("data-binding-open", "true");
            await expect(panel).toHaveAccessibleName(c.heading);
            await expect(panel.getByRole("heading", { name: c.heading })).toBeVisible();
            if (c.sub) await expect(panel).toContainText(c.sub);
            await page.keyboard.press("Escape");
            await expect(panel).not.toHaveAttribute("data-binding-open", "true");
            await expect(panel).toHaveAccessibleName(c.list);
        });
    }
});

test.describe("A7 bad ?edit values", () => {
    for (const edit of ["combo:999", "garbage", "macro:-1", "tapdance:"]) {
        test(`edit=${edit} opens no editor and the page stays usable`, async ({ page }) => {
            await openDemo(page, `demo=combos&edit=${encodeURIComponent(edit)}`);
            await page.waitForTimeout(800);
            await expect(page.locator('aside.detail-panel[data-binding-open="true"]')).toHaveCount(0);
            await expect(page.getByRole("alert")).toHaveCount(0);
            // Usable: select a key and open a panel.
            const key = page.locator(CANVAS_KEY).nth(10);
            await key.click();
            await openRailPanel(page, "Combos");
            await expect(detailPanel(page).getByRole("heading", { name: "Combos" })).toBeVisible();
        });
    }
});

test.describe("A15 Connect with no keyboard", () => {
    test("closing the device chooser changes nothing", async ({ page }) => {
        await page.addInitScript(() => {
            if (navigator.hid) navigator.hid.requestDevice = async () => [];
        });
        await openDemo(page);
        await page.getByRole("button", { name: "Connect", exact: true }).click();
        await page.waitForTimeout(500);
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page.locator(CANVAS_KEY)).toHaveCount(52);
        await expect(page.getByRole("status").filter({ hasText: "Offline draft" })).toContainText("QWERTY example (demo)");
    });

    test("a chooser failure shows a clear message and keeps the demo", async ({ page, allowConsoleError }) => {
        // g1-02: the alert shows the raw browser exception ("Failed to execute requestDevice: ...")
        // instead of saying what happened and what to do; Connect also logs console.error.
        knownBug(test, "g1-02");
        void allowConsoleError;
        await page.addInitScript(() => {
            if (navigator.hid) navigator.hid.requestDevice = async () => {
                throw new DOMException("Failed to execute 'requestDevice' on 'HID': Must be handling a user gesture to show a permission request.", "SecurityError");
            };
        });
        await openDemo(page);
        await page.getByRole("button", { name: "Connect", exact: true }).click();
        const alert = page.getByRole("alert");
        await expect(alert).toBeVisible();
        await expect(page.locator(CANVAS_KEY)).toHaveCount(52);
        await findingShot(page, "g1-02");
        await expect(alert).not.toContainText(/Failed to execute|requestDevice|DOMException|HID'/);
        await expect(alert).toContainText(/keyboard|connect/i);
    });

    test("in a browser without WebHID, Connect explains what is needed", async ({ page }) => {
        // g1-03: without WebHID the editor's Connect button stays enabled and shows
        // "Cannot read properties of undefined (reading 'requestDevice')".
        knownBug(test, "g1-03");
        await page.addInitScript(() => {
            // As in Firefox and Safari: no navigator.hid at all.
            delete (Navigator.prototype as unknown as { hid?: unknown }).hid;
        });
        await openDemo(page);
        const connect = page.getByRole("button", { name: "Connect", exact: true });
        if (await connect.isEnabled()) {
            await connect.click();
            await page.waitForTimeout(500);
        }
        await findingShot(page, "g1-03");
        const alert = page.getByRole("alert");
        if (await alert.count()) {
            await expect(alert).not.toContainText(/Cannot read|undefined|requestDevice/);
            await expect(alert).toContainText(/WebHID|browser|Chrome|Edge/i);
        } else {
            await expect(connect).toBeDisabled();
        }
        await expect(page.locator(CANVAS_KEY)).toHaveCount(52);
    });
});
