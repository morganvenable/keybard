// A mocked test board for UX flow tests that need a connected keyboard.
// Runs against the Vite dev server (the "board" project), which serves source
// modules, so the page can swap Keybard's USB layer for this fake. No real HID
// device is ever opened: navigator.hid is replaced before the app loads.
//
// The board's state lives here in Node, not in the page, so a test can reload
// the page (a power cycle and reconnect) and read back what the board kept.
import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

const POINT_GET = 0x2f, POINT_SET = 0x30, POINT_STATUS = 0x31, POINT_STOP = 0x32;
const POINT_TOOLS_FLAG = 0x20; // GET_INFO feature_flags2 bit 5

/** What the board keeps across power cycles, plus a log of the writes it took. */
export class MockBoard {
    /** Pointing tools settings as stored on the board (v5 payload, 19 bytes). */
    pointTools: number[] | null = null;
    generation = 7;
    /** Every pointing tools SET the board accepted. */
    sets: number[][] = [];
    /** The shared horizontal speed (slider position) in the last accepted SET: the payload's first 6 bits. */
    get lastSharedSpeed(): number | undefined { const last = this.sets.at(-1); return last && last[0] & 63; }
    /** SET calls refused because the generation was stale. */
    staleSets = 0;

    handle(cmd: number, args: number[]): number[] {
        // Every reply carries the board's current settings and generation.
        const reply = (err: number) => [cmd, err, 5, this.generation & 255, this.generation >> 8, ...this.pointTools!];
        if (cmd === POINT_GET) return reply(0);
        if (cmd === POINT_SET) {
            const [version, lo, hi, ...bytes] = args;
            if (version !== 5) return reply(3);
            if ((lo | (hi << 8)) !== this.generation) { this.staleSets++; return reply(2); }
            this.pointTools = bytes.slice(0, 19);
            this.generation = (this.generation + 1) & 0xffff;
            this.sets.push(this.pointTools);
            return reply(0);
        }
        if (cmd === POINT_STATUS) return [POINT_STATUS, 1, ...new Array(18).fill(0)];
        if (cmd === POINT_STOP) return [POINT_STOP, 0, 1];
        throw new Error(`Unmocked board command 0x${cmd.toString(16)}`);
    }
}

/** Open Keybard with the mocked board attached (not yet connected). */
export async function openWithBoard(page: Page, board: MockBoard) {
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
    if (!(await hasBinding(page))) {
        await page.exposeFunction("__mockBoard", (cmd: number, args: number[]) => board.handle(cmd, args));
    }
    await page.goto("./");
    await expect(page.getByRole("button", { name: "Connect Keyboard", exact: true })).toBeVisible({ timeout: 20_000 });
    const root = new URL(page.url()).pathname;
    await page.evaluate(async ({ root, flag }) => {
        const imp = (p: string) => import(/* @vite-ignore */ root + p);
        const { fileService } = await imp("services/file.service.ts");
        const { usbInstance, SvilUSB } = await imp("services/usb.service.ts");
        const { keyboardService } = await imp("services/keyboard.service.ts");
        const { qmkService } = await imp("services/qmk.service.ts");
        const { customValueService } = await imp("services/custom-value.service.ts");
        const { keyService } = await imp("services/key.service.ts");
        const { svalService } = await imp("services/sval.service.ts");
        const { identityService } = await imp("services/identity.service.ts");
        const { pointControlsService } = await imp("services/point-controls.service.ts");
        const content = await (await fetch(root.replace(/\/?$/, "/") + "default-layouts/sval-default.svil")).text();
        const fixture = await fileService.loadFile(new File([content], "test-board.svil"));
        fixture.name = "test board"; fixture.svil_proto = 3; fixture.macros_size = 4096;
        fixture.feature_flags2 = flag;
        fixture.settings = {};
        svalService.setupCosmeticLayerNames(fixture); keyService.generateAllKeycodes(fixture);
        identityService.getInfo = async () => ({ available: true, name: "test board", nameMaxBytes: 16, serialSource: 1, serial: "sval:0123456789ABCDEF" });
        SvilUSB.requestDevice = async () => ({ productName: "test board" });
        usbInstance.open = async () => true;
        usbInstance.hasDevice = () => true;
        usbInstance.openDevice = async () => true;
        usbInstance.close = async () => {};
        usbInstance.getDeviceName = () => "test board";
        usbInstance.getAllLayerColors = async () => [];
        usbInstance.send = async () => { throw new Error("Unmocked HID command blocked"); };
        usbInstance.sendSvil = async (cmd: number, args: number[] = []) =>
            new Uint8Array(await (window as unknown as { __mockBoard: (c: number, a: number[]) => Promise<number[]> }).__mockBoard(cmd, [...args]));
        keyboardService.init = async () => {};
        keyboardService.load = async () => {
            const kb = structuredClone(fixture);
            kb.pointing_controls = await pointControlsService.load();
            return kb;
        };
        keyboardService.getActiveLayerIndex = async () => 0;
        qmkService.get = async (kb: { settings: object }) => { kb.settings = {}; };
        customValueService.loadAllMenuValues = async () => [];
    }, { root, flag: POINT_TOOLS_FLAG });
}

async function hasBinding(page: Page) {
    return page.evaluate(() => typeof (window as unknown as { __mockBoard?: unknown }).__mockBoard === "function").catch(() => false);
}

/** Factory-fresh pointing tools settings: every tool on the shared 1.00x speed, uncapped. */
export async function freshPointTools(page: Page): Promise<number[]> {
    return page.evaluate(async (root) => {
        const { upgradePointControls, encodePointControls, POINT_DEFAULTS } = await import(/* @vite-ignore */ root + "constants/point-controls.ts");
        const value = upgradePointControls({ version: 1, profiles: structuredClone(POINT_DEFAULTS) });
        value.universal = true;
        value.profiles.forEach((p: { useDefaults: boolean; interval: number }) => { p.useDefaults = true; p.interval = 0; });
        return encodePointControls(value);
    }, new URL(page.url()).pathname);
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
