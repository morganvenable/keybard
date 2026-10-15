// Screenshot Keybard's Settings-related panels and dialogs in light and dark.
const { chromium } = require(process.env.PW_PATH);
const path = require("path");

const BASE = "http://localhost:5214/keybard-ng/";
const OUT = process.argv[2];
const only = process.argv[3]; // optional: "light" or "dark"

// Expose KeyboardProvider setters and stop the auto-load on fake connect.
async function patchContext(page) {
    await page.route(/\/contexts\/KeyboardContext\.tsx(\?.*)?$/, async (route) => {
        const resp = await route.fetch();
        let body = await resp.text();
        body = body.replace(
            "const [connectionFirmware, setConnectionFirmware] = useState(null);",
            "const [connectionFirmware, setConnectionFirmware] = useState(null);\n  window.__kb = { setKeyboardState, setIsConnected, setConnectionState, setConnectionFirmware, get keyboard() { return keyboard; } };"
        );
        body = body.replace("loadKeyboard().catch((error) => {", "Promise.resolve().catch((error) => {");
        await route.fulfill({ response: resp, body });
    });
}

const wait = (page, ms = 500) => page.waitForTimeout(ms);

async function shot(page, name, theme) {
    const file = path.join(OUT, `${name}-${theme}.png`);
    await wait(page, 600);
    await page.screenshot({ path: file });
    console.log("shot", file);
}

async function nav(page, label) {
    await page.locator(`button[aria-label="${label}"]`).first().click();
    await wait(page, 700);
}

async function closePanel(page) {
    await page.keyboard.press("Escape");
    await wait(page, 300);
}

async function category(page, label) {
    await page.locator("section button", { hasText: new RegExp(`^${label}$`) }).first().click();
    await wait(page, 600);
}

async function run(theme) {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
    await ctx.addInitScript(() => {
        try { localStorage.setItem("keyboard-settings", JSON.stringify({ theme: "system" })); } catch {}
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("pageerror", e.message));
    await patchContext(page);
    await page.goto(BASE);
    await wait(page, 2000);

    const step = async (name, fn) => {
        try { await fn(); } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); }
    };

    await step("connect", async () => shot(page, "01-connect-screen", theme));

    // Unsupported firmware card on the connect screen.
    await step("unsupported-connect", async () => {
        await page.evaluate(() => window.__kb.setConnectionFirmware({ kind: "svalboard-vial", reportedVersion: "vial-0.7.1" }));
        await shot(page, "02-unsupported-firmware-connect", theme);
        await page.evaluate(() => window.__kb.setConnectionFirmware(null));
    });

    // Offline example
    await page.getByRole("button", { name: /QWERTY Example/ }).click();
    await wait(page, 2500);
    await step("editor", async () => shot(page, "03-editor-offline", theme));

    await step("nav-expanded", async () => {
        await page.locator('button[aria-label="Expand navigation"]').click();
        await wait(page, 600);
        await shot(page, "04-nav-expanded", theme);
        await page.locator('button[aria-label="Collapse navigation"]').click();
        await wait(page, 400);
    });

    await step("settings-general", async () => { await nav(page, "Settings"); await shot(page, "10-settings-general", theme); });
    await step("settings-fragments", async () => { await category(page, "Fragments"); await shot(page, "11-settings-fragments", theme); });
    await step("settings-backups", async () => { await category(page, "Backups"); await shot(page, "12-settings-backups", theme); });
    await step("settings-developer", async () => { await category(page, "Developer"); await shot(page, "13-settings-developer", theme); });
    await step("qmk-settings", async () => {
        await category(page, "General");
        await page.locator('button[aria-label="QMK Settings..."]').click();
        await wait(page, 700);
        await shot(page, "14-qmk-settings", theme);
    });
    await step("print", async () => {
        await nav(page, "Settings");
        await category(page, "General");
        await page.locator('button[aria-label="Print Layers..."]').click();
        await wait(page, 600);
        await shot(page, "15-print-dialog", theme);
        await closePanel(page);
    });
    await step("about-offline", async () => { await nav(page, "About"); await shot(page, "20-about-offline", theme); });
    await step("layouts", async () => { await nav(page, "Layouts"); await shot(page, "21-layouts", theme); });
    await step("quickstart", async () => { await nav(page, "Quick Start"); await shot(page, "22-quick-start", theme); });
    await step("overlay", async () => {
        await nav(page, "Overlay");
        await shot(page, "23-overlay-dialog", theme);
        await closePanel(page);
    });
    await step("export", async () => {
        await page.locator('button[aria-label="Export Layout"]').first().click();
        await wait(page, 600);
        await shot(page, "24-export-dialog", theme);
        await closePanel(page);
    });

    const closeActive = async () => {
        const b = page.locator('[data-sidebar] button[aria-pressed="true"]');
        if (await b.count()) { await b.first().click(); await wait(page, 600); }
    };
    // Fake a connected vLaunch board with a firmware notice.
    await step("fake-connect", async () => {
        await page.evaluate(() => {
            const kb = { ...window.__kb.keyboard, kbid: "fake-1", svil_proto: 3, keycode_version: "0.0.9", keycode_version_reported: true, feature_flags: 0x60, feature_flags2: 0, sval_firmware: undefined };
            window.__kb.setKeyboardState(kb);
            window.__kb.setConnectionState("connected");
            window.__kb.setIsConnected(true);
        });
        await closeActive();
        await wait(page, 1500);
        await shot(page, "30-connected-firmware-note", theme);
    });
    await step("about-connected", async () => { await nav(page, "About"); await shot(page, "31-about-connected-outdated", theme); });
    await step("settings-connected", async () => { await nav(page, "Settings"); await category(page, "General"); await shot(page, "32-settings-general-connected", theme); });
    await step("unsupported-editor", async () => {
        await closeActive();
        await page.evaluate(() => window.__kb.setConnectionFirmware({ kind: "outdated-sval", svilProto: 2 }));
        await shot(page, "33-unsupported-firmware-editor", theme);
        await page.evaluate(() => window.__kb.setConnectionFirmware(null));
    });

    // Dialogs: each needs a fresh kbid so the per-connection acknowledgement doesn't hide it.
    const setFlags = (extra) => page.evaluate((extra) => window.__kb.setKeyboardState({ ...window.__kb.keyboard, ...extra }), extra);
    await step("storage-reset", async () => {
        await setFlags({ kbid: "fake-2", storage_reset: true });
        await shot(page, "40-storage-reset-dialog", theme);
        await page.getByRole("button", { name: "OK" }).click();
        await setFlags({ storage_reset: false });
    });
    await step("storage-write-failed", async () => {
        await setFlags({ kbid: "fake-3", storage_write_failed: true });
        await shot(page, "41-storage-write-failed-dialog", theme);
        await page.getByRole("button", { name: "OK" }).click();
        await setFlags({ storage_write_failed: false });
    });
    await step("trackball-mismatch", async () => {
        const half = (side, usb, builtFor, detected) => ({ usb, side, builtFor, detected, sensorStarted: true, auto: false, productId: 0x47, inverseProductId: 0xb8 });
        await setFlags({ kbid: "fake-4", pointing_hardware: { halves: [half("right", true, "pmw3360", "pmw3389"), half("left", false, "none", "trackpoint")] } });
        await shot(page, "42-trackball-mismatch-dialog", theme);
        await page.getByRole("button", { name: "OK" }).click();
    });
    await step("not-picked-up", async () => {
        const half = (side, usb) => ({ usb, side, builtFor: "pmw3360", detected: "pmw3389", sensorStarted: true, auto: true, productId: 0x47, inverseProductId: 0xb8 });
        await setFlags({ kbid: "fake-5", pointing_hardware: { halves: [half("right", true)] } });
        await shot(page, "43-pointing-not-picked-up-dialog", theme);
        await page.getByRole("button", { name: "OK" }).click();
    });

    await browser.close();
}

(async () => {
    for (const theme of ["light", "dark"]) {
        if (only && only !== theme) continue;
        await run(theme);
    }
})();
