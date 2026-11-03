// The one board reader: a part whose read fails is tried once more, and a part that fails
// twice is left out (unread), never filled in with something that looks like the board's.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fails = vi.hoisted(() => ({ qmk: 0, custom: 0 }));
vi.mock("@/services/keyboard.service", () => ({
    keyboardService: { init: async () => {}, load: async (kb: Record<string, unknown>) => Object.assign(kb, { menus: [{ label: "M", content: [] }], keymap: [[4]] }) },
}));
vi.mock("@/services/qmk.service", () => ({
    qmkService: { get: async (kb: Record<string, unknown>) => { if (fails.qmk-- > 0) throw new Error("timeout"); kb.settings = { 2: 200 }; } },
}));
const colors = vi.hoisted(() => ({ list: [] as Array<{ hue: number; sat: number } | null> }));
vi.mock("@/services/usb.service", () => ({ usbInstance: { getAllLayerColors: async () => colors.list } }));
vi.mock("@/services/custom-value.service", () => ({
    customValueService: { clearCache: () => {}, loadAllMenuValues: async () => { if (fails.custom-- > 0) throw new Error("timeout"); return [{ key: "id_left_dpi", data: [1] }]; } },
}));

import { readBoard } from "@/services/board-read";

beforeEach(() => { fails.qmk = 0; fails.custom = 0; colors.list = []; vi.spyOn(console, "warn").mockImplementation(() => {}); });

describe("reading the board", () => {
    it("reads a part again when its read fails once", async () => {
        fails.qmk = 1;
        fails.custom = 1;
        const kb = await readBoard();
        expect(kb.settings).toEqual({ 2: 200 });
        expect(kb.custom_values).toEqual([{ key: "id_left_dpi", data: [1] }]);
    });

    it("leaves a part out when it fails twice", async () => {
        fails.qmk = 2;
        fails.custom = 2;
        const kb = await readBoard();
        expect(kb.settings).toBeUndefined();
        // Marked not read, so the settings panels say so instead of "no settings".
        expect(kb.settings_unread).toBe(true);
        expect(kb.custom_values).toBeUndefined();
        expect(kb.keymap).toEqual([[4]]);
    });

    it("marks nothing unread when the settings read", async () => {
        const kb = await readBoard();
        expect(kb.settings_unread).toBeUndefined();
    });

    it("shows each layer color as the board holds it: a preset only on an exact match, never the nearest", async () => {
        // green's LED color exactly; a hue between blue and purple; a layer whose read failed; hue 0 sat 0.
        colors.list = [{ hue: 90, sat: 255 }, { hue: 170, sat: 200 }, null, { hue: 0, sat: 0 }];
        const kb = await readBoard();
        expect(kb.cosmetic?.layer_colors?.["0"]).toBe("green");
        expect(kb.cosmetic?.layer_colors?.["1"]).toMatch(/^#[0-9a-f]{6}$/i);
        expect(kb.cosmetic?.layer_colors?.["2"]).toBeUndefined();
        expect(kb.layer_colors?.[2]).toBeUndefined();
        expect(kb.layer_colors?.[1]).toMatchObject({ hue: 170, sat: 200 });
        // Grey, light grey and white share hue 0 and sat 0 (they differ only in brightness, which isn't per layer).
        expect(kb.cosmetic?.layer_colors?.["3"]).toBe("#ffffff");
    });
});
