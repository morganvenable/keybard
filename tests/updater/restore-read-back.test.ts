// A restore or import plans against the board as read just now, reads it back after the
// writes, writes what didn't land once more, and then names what the board still didn't keep.
// And after an update, Keybard reconnects to the board that restarted, not to whichever
// permitted board is listed first.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/keyboard.service", () => ({
    keyboardService: {
        updateKey: vi.fn(async (l: number, r: number, c: number, code: number) => board.write(l, r * 2 + c, code)),
        updateCombo: vi.fn(async () => {}),
        saveSvil: vi.fn(async () => {}),
    },
}));

import { describeWrites, landLayout, LayoutNotLanded, restoreLayoutToBoard } from "@/features/firmware/restore";
import { pickBoard } from "@/features/firmware/useAppFirmwareHost";
import { fileService } from "@/services/file.service";
import { boardSerialOf, SerialSource } from "@/services/identity.service";
import type { KeyboardInfo } from "@/types/keyboard.types";

const layout = (keymap: number[][]): KeyboardInfo => ({
    rows: 1, cols: 2, layers: keymap.length, keymap, svil_proto: 3, macros: [], macro_count: 0, macros_size: 64,
    combos: [], combo_count: 0, tapdances: [], tapdance_count: 0, key_overrides: [], key_override_count: 0, cosmetic: {},
});

/** A board whose keymap writes can be dropped. */
const board = {
    keymap: [[0, 0], [0, 0]],
    drop: 0,
    write(layer: number, index: number, code: number) {
        if (this.drop > 0) { this.drop--; return; }
        this.keymap[layer][index] = code;
    },
    read: async () => layout(structuredClone(board.keymap)),
};

/** A change queue as ChangesContext runs it with Live Updating on (live) or off. */
function changes(live: boolean) {
    const waiting: Array<() => Promise<void>> = [];
    return {
        commits: 0,
        queue: async (_desc: string, cb: () => Promise<void>) => { if (live) await cb(); else waiting.push(cb); },
        async commit() { this.commits++; for (const cb of waiting.splice(0)) await cb(); return true; },
    };
}

describe.each([true, false])("landing a layout (Live Updating %s)", (live) => {
    const wanted = layout([[4, 5], [6, 7]]);

    it("writes what differs from the board as read, and reads it back", async () => {
        board.keymap = [[0, 0], [0, 0]];
        board.drop = 0;
        const ch = changes(live);
        const read = vi.fn(board.read);
        const last = await landLayout(wanted, await board.read(), { queue: ch.queue, commit: () => ch.commit(), readBoard: read });
        expect(board.keymap).toEqual([[4, 5], [6, 7]]);
        expect(last.board.keymap).toEqual([[4, 5], [6, 7]]);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it("writes what didn't land once more", async () => {
        board.keymap = [[0, 0], [0, 0]];
        board.drop = 2;
        const ch = changes(live);
        await landLayout(wanted, await board.read(), { queue: ch.queue, commit: () => ch.commit(), readBoard: board.read });
        expect(board.keymap).toEqual([[4, 5], [6, 7]]);
        expect(ch.commits).toBe(2);
    });

    it("then fails, naming what the board didn't keep, with the board as read", async () => {
        board.keymap = [[0, 0], [0, 0]];
        board.drop = 1_000;
        const ch = changes(live);
        const error = await landLayout(wanted, await board.read(), { queue: ch.queue, commit: () => ch.commit(), readBoard: board.read }).catch((e) => e);
        expect(error).toBeInstanceOf(LayoutNotLanded);
        expect(error.message).toBe("The keyboard didn't keep part of the layout: 4 keys. Try again, or restore it from Backups.");
        expect(error.board.keymap).toEqual([[0, 0], [0, 0]]);
        expect(ch.commits).toBe(2);
    });

    it("restores against the board as read, never the editor's copy, and shows the board when it fails", async () => {
        // The editor still shows the old layout; the board holds its defaults.
        board.keymap = [[0, 0], [0, 0]];
        board.drop = 1_000;
        const svil = fileService.kbinfoToSvil(structuredClone(wanted), true);
        const shown: KeyboardInfo[] = [];
        const ch = changes(live);
        const error = await restoreLayoutToBoard(svil, { readBoard: board.read, setKeyboard: (kb) => { shown.push(kb); }, queue: ch.queue, commit: () => ch.commit(), markSaved: vi.fn() }).catch((e) => e);
        expect(error).toBeInstanceOf(LayoutNotLanded);
        expect(shown.at(-1)?.keymap).toEqual([[0, 0], [0, 0]]);
    });
});

describe("what didn't land, in words", () => {
    it("counts each kind once and leaves the saves out", () => {
        const w = (metadata: Record<string, unknown>) => ({ desc: "", cb: async () => {}, metadata });
        expect(describeWrites([
            w({ type: "key", layer: 0, writeKey: "key:0:0:0" }), w({ type: "key", layer: 1, writeKey: "key:1:0:0" }),
            w({ type: "combo", writeKey: "combo:3" }), w({ type: "macro", writeKey: "macros" }),
            w({ type: "key", writeKey: "setting:2" }), w({ type: "key", writeKey: "save-svil" }), w({ type: "custom_ui", writeKey: "custom-save:0" }),
        ])).toEqual(["2 keys", "the macros", "1 combo", "1 QMK setting"]);
    });
});

describe("the reconnect after an update", () => {
    const daily = { name: "daily" } as unknown as HIDDevice;
    const test = { name: "test" } as unknown as HIDDevice;
    const serialOf = new Map([[daily, "sval:E465B0621736062B"], [test, "sval:E465B0621725122B"]]);
    const probe = async (d: HIDDevice) => serialOf.get(d) ?? null;

    it("opens the board that restarted, wherever it is listed", async () => {
        expect(await pickBoard([daily, test], "sval:E465B0621725122B", () => false, probe)).toBe(test);
    });

    it("waits while that board isn't back, rather than open another", async () => {
        expect(await pickBoard([daily], "sval:E465B0621725122B", () => false, probe)).toBeNull();
    });

    it("with no serial to go by, takes only a lone board", async () => {
        expect(await pickBoard([test], null, () => false, probe)).toBe(test);
        expect(await pickBoard([daily, test], null, () => false, probe)).toBeNull();
    });
});

// A board with one custom value (Left DPI) and one QMK setting, whose firmware can ignore a
// value it doesn't take (as svalboard.c does for a DPI choice out of range).
describe.each([true, false])("settings on the read-back (Live Updating %s)", (live) => {
    const menus = [{ label: "Pointing", content: [{ label: "Left DPI", type: "dropdown", options: ["400", "800"], content: ["id_left_dpi", 0, 0] }] }];
    const stored = { dpi: 0, ignoreDpi: false, failReads: 0 };
    const withSettings = (keymap: number[][], dpi: number | undefined): KeyboardInfo => ({
        ...layout(keymap), menus: menus as never,
        ...(dpi === undefined ? {} : { custom_values: [{ key: "id_left_dpi", channel: 0, valueId: 0, data: [dpi] }] }),
    });
    const read = async (): Promise<KeyboardInfo> => {
        if (stored.failReads > 0) { stored.failReads--; throw new Error("read timed out"); }
        return withSettings(structuredClone(board.keymap), stored.dpi);
    };
    beforeEach(async () => {
        board.keymap = [[0, 0], [0, 0]];
        board.drop = 0;
        stored.dpi = 0;
        stored.ignoreDpi = false;
        stored.failReads = 0;
        const { customValueService } = await import("@/services/custom-value.service");
        vi.spyOn(customValueService, "setRaw").mockImplementation(async (_ch: number, _id: number, data: number[]) => { if (!stored.ignoreDpi) stored.dpi = data[0]; });
        vi.spyOn(customValueService, "save").mockImplementation(async () => {});
    });
    afterEach(() => { vi.restoreAllMocks(); });
    const wanted = () => withSettings([[4, 5], [6, 7]], 1);

    it("a read-back that couldn't read the settings doesn't count them as different", async () => {
        const ch = changes(live);
        // Every read-back misses the custom values (a read that timed out twice).
        const unread = async () => { const kb = await read(); delete kb.custom_values; return kb; };
        const landed = await landLayout(wanted(), await read(), { queue: ch.queue, commit: () => ch.commit(), readBoard: unread });
        expect(board.keymap).toEqual([[4, 5], [6, 7]]);
        expect(landed.notKept).toEqual([]);
    });

    it("a board whose settings couldn't be read gets the file's values, and says they weren't checked", async () => {
        const ch = changes(live);
        // Every read misses the custom values: the first one too, and the read-backs.
        const unread = async () => { const kb = await read(); delete kb.custom_values; return kb; };
        const landed = await landLayout(wanted(), await unread(), { queue: ch.queue, commit: () => ch.commit(), readBoard: unread });
        expect(stored.dpi).toBe(1);
        expect(landed.unchecked).toEqual(["Pointing: Left DPI"]);
    });

    it("a read-back that fails once is read again", async () => {
        const ch = changes(live);
        const first = await read();
        stored.failReads = 1;
        const landed = await landLayout(wanted(), first, { queue: ch.queue, commit: () => ch.commit(), readBoard: read });
        expect(landed.board.keymap).toEqual([[4, 5], [6, 7]]);
    });

    it("a setting the board doesn't keep is reported, not a failure", async () => {
        stored.ignoreDpi = true;
        const ch = changes(live);
        const landed = await landLayout(wanted(), await read(), { queue: ch.queue, commit: () => ch.commit(), readBoard: read });
        expect(board.keymap).toEqual([[4, 5], [6, 7]]);
        expect(landed.notKept).toEqual(["Pointing: Left DPI"]);
    });

    it("the restore reports it as kept differently, and marks saved what the board holds", async () => {
        stored.ignoreDpi = true;
        const ch = changes(live);
        const svil = fileService.kbinfoToSvil(structuredClone(wanted()), true);
        const markSaved = vi.fn();
        const report = await restoreLayoutToBoard(svil, { readBoard: read, setKeyboard: () => {}, queue: ch.queue, commit: () => ch.commit(), markSaved });
        expect(report.notKept).toEqual(["Pointing: Left DPI"]);
        expect(report.unavailable ?? []).not.toContain("Pointing: Left DPI");
        const saved = markSaved.mock.calls.at(-1)?.[0] as KeyboardInfo;
        expect(saved.custom_values?.find((v) => v.key === "id_left_dpi")?.data).toEqual([0]);
        expect(saved.keymap).toEqual([[4, 5], [6, 7]]);
    });
});

describe("a board's serial", () => {
    it("is used only when it lasts: a random serial needs the identity region to keep it", () => {
        const info = { name: "", nameMaxBytes: 64, serial: "sval:1234567890ABCDEF" };
        expect(boardSerialOf({ ...info, available: true, serialSource: SerialSource.Random })).toBe("sval:1234567890ABCDEF");
        expect(boardSerialOf({ ...info, available: false, serialSource: SerialSource.Random })).toBeNull();
        expect(boardSerialOf({ ...info, available: false, serialSource: SerialSource.FlashId })).toBe("sval:1234567890ABCDEF");
    });
});
