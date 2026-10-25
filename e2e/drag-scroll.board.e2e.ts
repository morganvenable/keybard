// Drag scroll on a board with pointing tools: the scroll keys sit in Pointing
// Devices beside the tool keys, and placing one writes its QK_USER code (0x7E50
// for Scroll Toggle), never a code in the tools' QK_KB block (0x7E00-0x7E3F).
// The board is mocked in the page: no HID device is opened.
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// keyboards/svalboard/keymaps/sval/sval.json customKeycodes, in order: QK_USER 0x7E40 + position.
const FIRMWARE_CUSTOM: [string, string][] = [
    ["SV_LEFT_DPI_INC", "Left\nDPI +"], ["SV_LEFT_DPI_DEC", "Left\nDPI -"], ["SV_RIGHT_DPI_INC", "Right\nDPI +"], ["SV_RIGHT_DPI_DEC", "Right\nDPI -"],
    ["SV_LEFT_SCROLL_TOGGLE", "Scroll\nLeft\nToggle"], ["SV_RIGHT_SCROLL_TOGGLE", "Scroll\nRight\nToggle"], ["SV_RECALIBRATE_POINTER", "Fix\nDrift"], ["SV_MH_CHANGE_TIMEOUTS", "Mouse\nKey\nTimer"],
    ["SV_CAPS_WORD", "Caps\nWord"], ["SV_AXIS_SCROLL_LOCK", "Axis\nScroll\nLock"], ["SV_TOGGLE_23_67", "MO 23\n(45=67)"], ["SV_TOGGLE_45_67", "MO 45\n(23=67)"],
    ["SV_SNIPER_2", "Sniper\n2x"], ["SV_SNIPER_3", "Sniper\n3x"], ["SV_SNIPER_5", "Sniper\n5x"], ["SV_SCROLL_HOLD", "Scroll\nToggle\nHold"],
    ["SV_SCROLL_TOGGLE", "Scroll\nToggle"], ["SV_OUTPUT_STATUS", "Output\nStatus"], ["SV_TOGGLE_AUTOMOUSE", "AutoMouse\nToggle"], ["SV_TURBO_SCAN", "Turbo\nScan"],
    ["SV_NATURAL_SCROLL_TOGGLE", "Natural\nScroll"], ["SV_SNIPER_2_TG", "Sniper\n2xTG"], ["SV_SNIPER_3_TG", "Sniper\n3xTG"], ["SV_SNIPER_5_TG", "Sniper\n5xTG"],
    ["SV_BOOST_2", "Boost\n2x"], ["SV_BOOST_3", "Boost\n3x"], ["SV_BOOST_5", "Boost\n5x"], ["SV_BOOST_2_TG", "Boost\n2xTG"], ["SV_BOOST_3_TG", "Boost\n3xTG"], ["SV_BOOST_5_TG", "Boost\n5xTG"],
];
// Layer 0 starts like the daily driver's layer 14: Stop tools, Tool 1 hold, Left DPI +, Output Status.
const FIRST_KEYS = [0x7e10, 0x7e00, 0x7e40, 0x7e51];

async function openWithToolsBoard(page: Page) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "hid", {
            value: { getDevices: async () => [], requestDevice: async () => { throw new Error("Real HID disabled in UX flow tests"); }, addEventListener: () => {}, removeEventListener: () => {} },
            configurable: true,
        });
    });
    await page.goto("./");
    await expect(page.getByRole("button", { name: "Connect Keyboard", exact: true })).toBeVisible({ timeout: 20_000 });
    const root = new URL(page.url()).pathname;
    await page.evaluate(async ({ root, custom, first }) => {
        const imp = (p: string) => import(/* @vite-ignore */ root + p);
        const { fileService } = await imp("services/file.service.ts");
        const { usbInstance, SvilUSB } = await imp("services/usb.service.ts");
        const { keyboardService } = await imp("services/keyboard.service.ts");
        const { qmkService } = await imp("services/qmk.service.ts");
        const { customValueService } = await imp("services/custom-value.service.ts");
        const { keyService } = await imp("services/key.service.ts");
        const { svalService } = await imp("services/sval.service.ts");
        const { identityService } = await imp("services/identity.service.ts");
        const { upgradePointControls, POINT_DEFAULTS } = await imp("constants/point-controls.ts");
        const content = await (await fetch(root.replace(/\/?$/, "/") + "default-layouts/sval-default.svil")).text();
        const fixture = await fileService.loadFile(new File([content], "test-board.svil"));
        Object.assign(fixture, { name: "test board", svil_proto: 3, macros_size: 4096, feature_flags2: 0x80, settings: {} });
        fixture.custom_keycodes = custom.map(([name, shortName]: [string, string]) => ({ name, shortName, title: name }));
        fixture.pointing_controls = upgradePointControls({ version: 1, profiles: structuredClone(POINT_DEFAULTS) }, 5);
        first.forEach((code: number, i: number) => { fixture.keymap[0][i] = code; });
        svalService.setupCosmeticLayerNames(fixture); keyService.generateAllKeycodes(fixture);
        const w = window as unknown as { __writes: number[][] };
        w.__writes = [];
        identityService.getInfo = async () => ({ available: true, name: "test board", nameMaxBytes: 16, serialSource: 1, serial: "sval:0123456789ABCDEF" });
        SvilUSB.requestDevice = async () => ({ productName: "test board" });
        Object.assign(usbInstance, {
            open: async () => true, hasDevice: () => true, openDevice: async () => true, close: async () => {},
            getDeviceName: () => "test board", getAllLayerColors: async () => [],
            send: async () => { throw new Error("Unmocked HID command blocked"); },
            sendSvil: async () => { throw new Error("Unmocked Sval command blocked"); },
        });
        Object.assign(keyboardService, {
            init: async () => {}, load: async () => structuredClone(fixture), getActiveLayerIndex: async () => 0,
            updateKey: async (layer: number, row: number, col: number, code: number) => { w.__writes.push([layer, row, col, code]); },
            updateKeyBlock: async (index: number, codes: number[]) => { codes.forEach((code, i) => w.__writes.push([-1, index + i, 0, code])); },
        });
        qmkService.get = async (kb: { settings: object }) => { kb.settings = {}; };
        customValueService.loadAllMenuValues = async () => [];
    }, { root, custom: FIRMWARE_CUSTOM, first: FIRST_KEYS });
    await page.getByRole("button", { name: "Connect Keyboard", exact: true }).click();
    const live = page.getByRole("button", { name: "Switch to Live Updating", exact: true });
    await expect(live.or(page.getByRole("button", { name: "Switch to Manual Updates", exact: true }))).toBeVisible({ timeout: 20_000 });
    if (await live.isVisible()) await live.click();
}

const canvasKey = (page: Page, keycode: string) => page.locator(`[data-keyboard-instance] [data-keycode="${keycode}"]`).first();

test("drag scroll keys are placeable beside the pointing tools and write their own codes", async ({ page }) => {
    await openWithToolsBoard(page);

    // Tool keys and SV_ keys read as themselves, not as each other.
    await expect(canvasKey(page, "SV_POINT_STOP_ALL")).toBeVisible();
    await expect(canvasKey(page, "SV_POINT_TOOL1_HOLD")).toBeVisible();
    await expect(canvasKey(page, "SV_LEFT_DPI_INC")).toBeVisible();
    await expect(canvasKey(page, "SV_OUTPUT_STATUS")).toBeVisible();
    await expect(page.locator('[data-keyboard-instance] [data-keycode="SV_SCROLL_TOGGLE"]')).toHaveCount(0);

    // Select the Stop tools key, open Pointing Devices, and place Scroll Toggle.
    await canvasKey(page, "SV_POINT_STOP_ALL").click();
    const scroll = page.getByRole("region", { name: "Drag scroll keys" }).first();
    if (!(await scroll.isVisible())) await page.getByRole("button", { name: "Pointing Devices", exact: true }).first().click();
    await expect(scroll).toBeVisible();
    for (const k of ["SV_SCROLL_TOGGLE", "SV_LEFT_SCROLL_TOGGLE", "SV_RIGHT_SCROLL_TOGGLE"]) {
        await expect(scroll.locator(`[data-keycode="${k}"]`)).toBeVisible();
    }
    // Scroll Hold is offered once, in the Scroll row beside Velocity Scroll.
    await expect(scroll.locator('[data-keycode="SV_SCROLL_HOLD"]')).toHaveCount(0);
    await expect(scroll.locator("xpath=..").locator('[data-keycode="SV_SCROLL_HOLD"]')).toHaveCount(1);
    await scroll.locator('[data-keycode="SV_SCROLL_TOGGLE"]').click();

    await expect(canvasKey(page, "SV_SCROLL_TOGGLE")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __writes: number[][] }).__writes.map(w => w[3]))).toContain(0x7e50);
    const written = await page.evaluate(() => (window as unknown as { __writes: number[][] }).__writes.map(w => w[3]));
    expect(written.filter(code => code >= 0x7e00 && code <= 0x7e3f), "no write lands in the tools block").toEqual([]);
});
