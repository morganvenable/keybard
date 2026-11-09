// Install, then restore, on the simulated board: the Scroll speed values the restore leaves.
// A board on x4.5 ran 1200 DPI; the install resets settings; the old backup has no Scroll speed.
import { describe, expect, it } from "vitest";
import { UpdaterClient } from "@/services/updater/client";
import { planInstall } from "@/services/updater/checks";
import { fakeSetup, fixtureOneImage } from "@/services/updater/fake-host";
import { memoryFlowStore, UpdateFlow, type RestoreReport } from "@/services/updater/flow";
import { HAND_LEFT } from "@/services/updater/protocol";
import { VirtualClock } from "@/services/updater/transport";
import { prepareImport } from "@/services/import-preflight";
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

function boardAfterInstall(module: "pmw3389" | "azoteq"): KeyboardInfo {
    const kb = createKbinfoWithFragments({ layers: 4 });
    kb.kbid = "a1b2c3d4e5f60718";
    kb.menus = menu(true);
    kb.feature_flags4 = SVIL_FLAG4_SCROLL_SPEED;
    const half = (side: "left" | "right") => ({ usb: side === "left", side, builtFor: module, detected: module, sensorStarted: true, auto: false });
    kb.pointing_hardware = { halves: [half("left"), half("right")] } as never;
    // Settings were reset by the install: DPI back to the default, Scroll speed 1.0x.
    kb.custom_values = [
        { key: "id_left_dpi", channel: 0, valueId: 1, data: [1] }, { key: "id_right_dpi", channel: 0, valueId: 2, data: [1] },
        { key: "id_left_scroll_speed", channel: 0, valueId: 61, data: [100, 0] }, { key: "id_right_scroll_speed", channel: 0, valueId: 62, data: [100, 0] },
    ];
    return kb;
}

/** What x4.5 backed up: 1200 DPI on both hands, no Scroll speed. */
function oldBackup(): string {
    const kb = boardAfterInstall("pmw3389");
    kb.menus = menu(false);
    kb.custom_values = [{ key: "id_left_dpi", channel: 0, valueId: 1, data: [2] }, { key: "id_right_dpi", channel: 0, valueId: 2, data: [2] }];
    return fileService.kbinfoToSvil(kb);
}

describe("install then restore an x4.5 backup onto Scroll speed firmware", () => {
    for (const [module, expected] of [["pmw3389", 150], ["azoteq", 150]] as const) {
        it(`${module}: 1200 DPI comes back as ${expected}% scroll speed`, async () => {
            const clock = new VirtualClock();
            const v3 = await fixtureOneImage("v3", 3000);
            const x4 = await fixtureOneImage("x4", 4000);
            const { board, host } = fakeSetup({ clock, running: v3 });
            const pin = { tag: x4.tag, kind: "x" as const, fwVersion: x4.fwVersion, updaterProtocol: 4, file: { uf2: "a.uf2", sha256: x4.files[HAND_LEFT].sha256, size: x4.files[HAND_LEFT].bytes.length }, notesUrl: "" };
            const p = await planInstall(new UpdaterClient(board), { kind: "release", release: pin, files: x4.files }, { clock, releases: [pin] });
            if ("id" in p) throw new Error(`plan failed: ${p.id}`);

            const landed: Array<number | undefined>[] = [];
            const svil = oldBackup();
            const restore = host.restoreLayout.bind(host);
            // The real restore's plan, on the board as the install left it.
            host.restoreLayout = async (text: string): Promise<RestoreReport> => {
                const review = prepareImport(fileService.svilToKBINFO(JSON.parse(text)), boardAfterInstall(module));
                landed.push(["id_left_scroll_speed", "id_right_scroll_speed"].map((key) => {
                    const d = review.keyboard.custom_values?.find((e) => e.key === key)?.data;
                    return d ? d[0] | (d[1] << 8) : undefined;
                }));
                return restore(text);
            };
            const flow = UpdateFlow.create(host, memoryFlowStore(), { plan: p, afterwards: "restore", backup: { fileName: "Kip-x4.5.svil", svil } });
            const state = await flow.run();
            expect(state.step).toBe("done");
            expect(host.restores).toBe(1);
            expect(landed).toEqual([[expected, expected]]);
        });
    }
});
