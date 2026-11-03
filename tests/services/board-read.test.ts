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
vi.mock("@/services/usb.service", () => ({ usbInstance: { getAllLayerColors: async () => [] } }));
vi.mock("@/services/custom-value.service", () => ({
    customValueService: { clearCache: () => {}, loadAllMenuValues: async () => { if (fails.custom-- > 0) throw new Error("timeout"); return [{ key: "id_left_dpi", data: [1] }]; } },
}));

import { readBoard } from "@/services/board-read";

beforeEach(() => { fails.qmk = 0; fails.custom = 0; vi.spyOn(console, "warn").mockImplementation(() => {}); });

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
        expect(kb.custom_values).toBeUndefined();
        expect(kb.keymap).toEqual([[4]]);
    });
});
