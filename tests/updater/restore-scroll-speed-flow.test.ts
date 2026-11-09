// Install, then restore, on the simulated board: the Scroll speed values that land on it.
// A board on x4.5 ran 1200 DPI; the install resets settings; the old backup has no Scroll speed.
// The restore is the real one (restoreLayoutToBoard); its VIA writes go to a store in memory.
import { beforeEach, describe, expect, it, vi } from "vitest";

/** VIA custom values on the simulated board, by value id: the raw little-endian bytes. */
const via = new Map<number, number[]>();
vi.mock("@/services/custom-value.service", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/services/custom-value.service")>();
    const svc = real.customValueService;
    svc.setRaw = vi.fn(async (_channel: number, valueId: number, data: number[]) => { via.set(valueId, [...data]); });
    svc.save = vi.fn(async () => {});
    return real;
});
vi.mock("@/services/keyboard.service", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/services/keyboard.service")>();
    real.keyboardService.saveSvil = vi.fn(async () => {}) as never; // the Sval save; nothing to save in memory
    return real;
});

import { UpdaterClient } from "@/services/updater/client";
import { planInstall } from "@/services/updater/checks";
import { fakeSetup, fixtureOneImage } from "@/services/updater/fake-host";
import { memoryFlowStore, UpdateFlow } from "@/services/updater/flow";
import { HAND_LEFT } from "@/services/updater/protocol";
import { VirtualClock } from "@/services/updater/transport";
import { restoreLayoutToBoard } from "@/features/firmware/restore";
import { fileService } from "@/services/file.service";
import { SVIL_FLAG4_SCROLL_SPEED } from "@/utils/pointing-settings";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { createKbinfoWithFragments } from "../fixtures/fragments.fixture";

const DPIS = [400, 800, 1200, 1600];
const menu = (withSpeed: boolean) => [{ label: "Pointing Device", content: [
    { label: "L", type: "dropdown", options: DPIS, content: ["id_left_dpi", 0, 1] },
    { label: "R", type: "dropdown", options: DPIS, content: ["id_right_dpi", 0, 2] },
    ...(withSpeed ? [
        { label: "LS", type: "range", options: [20, 1000, 1], content: ["id_left_scroll_speed", 0, 61] },
        { label: "RS", type: "range", options: [20, 1000, 1], content: ["id_right_scroll_speed", 0, 62] }] : []),
] }] as never;

type Module = "pmw3389" | "azoteq" | "trackpoint";

/** The board as the install left it, read from the VIA store: settings reset, Scroll speed 1.0x. */
function readBoard(modules: [Module, Module], withSpeed: boolean): KeyboardInfo {
    const kb = createKbinfoWithFragments({ layers: 4 });
    kb.kbid = "a1b2c3d4e5f60718";
    kb.menus = menu(withSpeed);
    kb.feature_flags4 = withSpeed ? SVIL_FLAG4_SCROLL_SPEED : 0;
    const half = (side: "left" | "right", module: Module) => ({ usb: side === "left", side, builtFor: module, detected: module, sensorStarted: true, auto: false });
    kb.pointing_hardware = { halves: [half("left", modules[0]), half("right", modules[1])] } as never;
    const keys: Array<[string, number]> = [["id_left_dpi", 1], ["id_right_dpi", 2], ...(withSpeed ? [["id_left_scroll_speed", 61], ["id_right_scroll_speed", 62]] as Array<[string, number]> : [])];
    kb.custom_values = keys.map(([key, valueId]) => ({ key, channel: 0, valueId, data: [...via.get(valueId)!] }));
    return kb;
}

/** What x4.5 backed up: 1200 DPI on both hands, no Scroll speed. */
function oldBackup(): string {
    const kb = createKbinfoWithFragments({ layers: 4 });
    kb.kbid = "a1b2c3d4e5f60718";
    kb.menus = menu(false);
    kb.custom_values = [{ key: "id_left_dpi", channel: 0, valueId: 1, data: [2] }, { key: "id_right_dpi", channel: 0, valueId: 2, data: [2] }];
    return fileService.kbinfoToSvil(kb);
}

const u16 = (id: number) => { const d = via.get(id); return d ? d[0] | (d[1] << 8) : undefined; };

async function installThenRestore(modules: [Module, Module], withSpeed: boolean) {
    const clock = new VirtualClock();
    const v3 = await fixtureOneImage("v3", 3000);
    const x4 = await fixtureOneImage("x4", 4000);
    const { board, host } = fakeSetup({ clock, running: v3 });
    const pin = { tag: x4.tag, kind: "x" as const, fwVersion: x4.fwVersion, updaterProtocol: 4, file: { uf2: "a.uf2", sha256: x4.files[HAND_LEFT].sha256, size: x4.files[HAND_LEFT].bytes.length }, notesUrl: "" };
    const p = await planInstall(new UpdaterClient(board), { kind: "release", release: pin, files: x4.files }, { clock, releases: [pin] });
    if ("id" in p) throw new Error(`plan failed: ${p.id}`);
    const simulated = host.restoreLayout.bind(host);
    host.restoreLayout = async (text: string) => {
        await simulated(text); // the simulated board's own settings restore and bookkeeping
        const queued: Array<() => Promise<void>> = [];
        return restoreLayoutToBoard(text, {
            readBoard: async () => readBoard(modules, withSpeed),
            setKeyboard: () => {},
            queue: async (_d: string, cb: () => Promise<void>) => { queued.push(cb); },
            commit: async () => { for (const cb of queued.splice(0)) await cb(); return true; },
        } as never);
    };
    const flow = UpdateFlow.create(host, memoryFlowStore(), { plan: p, afterwards: "restore", backup: { fileName: "Kip-x4.5.svil", svil: oldBackup() } });
    const state = await flow.run();
    return { state, host };
}

describe("install then restore an x4.5 backup (1200 DPI, no Scroll speed)", () => {
    beforeEach(() => {
        via.clear();
        // The install reset everything: DPI index 1 (800), Scroll speed 100%.
        via.set(1, [1]); via.set(2, [1]); via.set(61, [100, 0]); via.set(62, [100, 0]);
    });

    for (const [modules, expected] of [
        [["pmw3389", "pmw3389"], [150, 150]],
        [["azoteq", "pmw3389"], [150, 150]],
        [["trackpoint", "azoteq"], [100, 150]],
    ] as Array<[[Module, Module], [number, number]]>) {
        it(`${modules.join(" + ")}: the board ends at 1200 DPI and Scroll speed ${expected.join("/")}%`, async () => {
            const { state, host } = await installThenRestore(modules, true);
            expect(state.step).toBe("done");
            expect(host.restores).toBe(1);
            expect([via.get(1), via.get(2)]).toEqual([[2], [2]]);
            expect([u16(61), u16(62)]).toEqual(expected);
        });
    }

    it("firmware without Scroll speed: DPI comes back, 61 and 62 are never written", async () => {
        via.delete(61); via.delete(62);
        const { state } = await installThenRestore(["pmw3389", "azoteq"], false);
        expect(state.step).toBe("done");
        expect([via.get(1), via.get(2)]).toEqual([[2], [2]]);
        expect(via.has(61) || via.has(62)).toBe(false);
    });
});
