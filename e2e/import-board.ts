// A mocked board for the layout import flow. Runs against the Vite dev server
// (playwright.import.config.ts), which serves source modules, so the page can
// swap Keybard's USB layer for one that talks to a ByteBoard held here in Node.
// No real HID device is ever opened: navigator.hid is replaced before the app loads.
//
// The board keeps raw bytes (tables, custom values, keymap) as the firmware does,
// and the app reads them back through its own services, so a reload and reconnect
// shows what the board really holds.
import type { Page } from "@playwright/test";
import { expect } from "./fixtures";
import { ByteBoard } from "../tests/mocks/byte-board";

/** Open Keybard with the board attached (not yet connected). `layout` gives the board's shape, menus and names. */
export async function openWithByteBoard(page: Page, board: ByteBoard, layout: string) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "hid", {
            value: {
                getDevices: async () => [],
                requestDevice: async () => { throw new Error("Real HID disabled in UX flow tests"); },
                addEventListener: () => {}, removeEventListener: () => {},
            },
            configurable: true,
        });
    });
    const bound = await page.evaluate(() => typeof (window as unknown as { __byteSval?: unknown }).__byteSval === "function").catch(() => false);
    if (!bound) {
        await page.exposeFunction("__byteSval", (cmd: number, args: number[]) => board.sval(cmd, args));
        await page.exposeFunction("__byteVia", (cmd: number, args: number[]) => board.via(cmd, args));
        await page.exposeFunction("__byteKeymap", () => board.keymap);
    }
    await page.goto("./");
    await expect(page.getByRole("button", { name: "Connect Keyboard", exact: true })).toBeVisible({ timeout: 20_000 });
    const root = new URL(page.url()).pathname;
    await page.evaluate(async ({ root, layout }) => {
        const imp = (p: string) => import(/* @vite-ignore */ root + p);
        const { fileService } = await imp("services/file.service.ts");
        const { usbInstance, SvilUSB } = await imp("services/usb.service.ts");
        const { keyboardService } = await imp("services/keyboard.service.ts");
        const { qmkService } = await imp("services/qmk.service.ts");
        const { keyService } = await imp("services/key.service.ts");
        const { svalService } = await imp("services/sval.service.ts");
        const { identityService } = await imp("services/identity.service.ts");
        type W = { __byteSval: (c: number, a: number[]) => Promise<number[]>; __byteVia: (c: number, a: number[]) => Promise<number[]>; __byteKeymap: () => Promise<number[]> };
        const w = window as unknown as W;
        const shape = await fileService.loadFile(new File([layout], "board.svil"));
        shape.name = "test board"; shape.svil_proto = 3; shape.macros_size = 4096;
        shape.settings = {};
        delete shape.fragmentState; // this board models no hardware positions
        svalService.setupCosmeticLayerNames(shape); keyService.generateAllKeycodes(shape);
        identityService.getInfo = async () => ({ available: true, name: "test board", nameMaxBytes: 16, serialSource: 1, serial: "sval:0123456789ABCDEF" });
        SvilUSB.requestDevice = async () => ({ productName: "test board" });
        usbInstance.open = async () => true;
        usbInstance.hasDevice = () => true;
        usbInstance.openDevice = async () => true;
        usbInstance.close = async () => {};
        usbInstance.getDeviceName = () => "test board";
        usbInstance.svilProtocolVersion = 3;
        usbInstance.sendSvil = async (cmd: number, args: number[] = []) => new Uint8Array(await w.__byteSval(cmd, [...args]));
        usbInstance.send = async (cmd: number, args: number[] = [], options: { skipBytes?: number } = {}) =>
            new Uint8Array((await w.__byteVia(cmd, [...args])).slice(options.skipBytes ?? 0));
        keyboardService.init = async () => {};
        // The board's own tables, read through Keybard's readers; custom values and
        // layer colors are read by the connect flow itself, through usbInstance.send.
        keyboardService.load = async () => {
            const kb = structuredClone(shape);
            const flat = await w.__byteKeymap();
            const size = kb.rows * kb.cols;
            kb.keymap = Array.from({ length: kb.layers }, (_, l) => flat.slice(l * size, (l + 1) * size));
            await (keyboardService as unknown as { tapdance: { get: (k: unknown) => Promise<void> } }).tapdance.get(kb);
            await (keyboardService as unknown as { combo: { get: (k: unknown) => Promise<void> } }).combo.get(kb);
            return kb;
        };
        keyboardService.getActiveLayerIndex = async () => 0;
        keyboardService.getLayerIndexes = async () => ({ active: 0, defaultLayer: 0 });
        qmkService.get = async (kb: { settings: object }) => { kb.settings = {}; };
    }, { root, layout });
}

export async function connect(page: Page) {
    await page.getByRole("button", { name: "Connect Keyboard", exact: true }).click();
    await expect(page.getByRole("button", { name: /Switch to (Manual Updates|Live Updating)/ })).toBeVisible({ timeout: 20_000 });
}

/** Turn Live Updating on or off with the toolbar toggle, as a user does. */
export async function setLiveUpdating(page: Page, live: boolean) {
    const toggle = page.getByRole("button", { name: live ? "Switch to Live Updating" : "Switch to Manual Updates", exact: true });
    if (await toggle.isVisible()) await toggle.click();
    await expect(page.getByRole("button", { name: live ? "Switch to Manual Updates" : "Switch to Live Updating", exact: true })).toBeVisible();
}

/** Keycode numbers for names, as this page's Keybard parses them. */
export async function parseKeys(page: Page, names: string[]): Promise<number[]> {
    const root = new URL(page.url()).pathname;
    return page.evaluate(async ({ root, names }) => {
        const { keyService } = await import(/* @vite-ignore */ root + "services/key.service.ts");
        return names.map((n: string) => keyService.parse(n));
    }, { root, names });
}
