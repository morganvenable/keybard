// Keybard's real load path against the simulated Svalboard: SvilUSB.openDevice,
// then keyboardService.load, every reply decoded by the services that parse a
// real board's replies.
import { afterEach, describe, expect, it } from "vitest";
import { seedBoard, SEED_NAMES } from "@/dev/fake-board/seed";
import { FakeSvalboardDevice } from "@/dev/fake-board/device";
import { LABEL_TYPE_COMBO, LABEL_TYPE_LAYER, LABEL_TYPE_MACRO, LABEL_TYPE_TAP_DANCE } from "@/dev/fake-board/board";
import { usbInstance } from "@/services/usb.service";
import { keyboardService } from "@/services/keyboard.service";
import { qmkService } from "@/services/qmk.service";
import { ComboService } from "@/services/combo.service";
import { LabelService } from "@/services/label.service";
import type { KeyboardInfo } from "@/types/keyboard.types";

async function connect(comboLabels = true) {
    const device = new FakeSvalboardDevice({ comboLabels, state: seedBoard(), persist: false, schedule: (fn) => setImmediate(fn) });
    await usbInstance.openDevice(device.asHIDDevice());
    const kb = await keyboardService.load({ rows: 0, cols: 0 } as KeyboardInfo);
    return { device, kb };
}

afterEach(async () => {
    await usbInstance.close();
});

describe("keyboardService.load against the simulated board", { timeout: 30000 }, () => {
    it("loads the definition, keymap, combos and names", async () => {
        const { kb } = await connect();
        expect(kb.name).toBe("Svalboard");
        expect(kb.svil_proto).toBe(3);
        expect(kb.keycode_version).toBe("0.0.9");
        expect(kb.feature_flags2! & 0x80).toBe(0x80);
        expect([kb.rows, kb.cols, kb.layers]).toEqual([10, 6, 16]);
        expect(kb.combo_count).toBe(256);
        expect(kb.macro_count).toBe(256);
        expect(kb.storage_reset).toBe(false);

        // The default layout's first key, and a layer-tap key
        expect(kb.keymap![0][0]).toBe(0xe0); // KC_LCTRL
        expect(kb.keymap!.length).toBe(16);

        const used = kb.combos!.filter((c) => c.keys[0] !== "KC_NO");
        expect(used.map((c) => [c.keys.filter((k) => k !== "KC_NO"), c.output])).toEqual([
            [["KC_F", "KC_D"], "KC_ESCAPE"],
            [["KC_J", "KC_K"], "KC_ENTER"],
            [["KC_S", "KC_D", "KC_F"], "KC_TAB"],
        ]);
        expect(used.every((c) => (c.options! & 0x8000) !== 0)).toBe(true);

        expect(kb.tapdances![0]).toMatchObject({ tap: "KC_A", hold: "KC_LCTRL", tapping_term: 200, enabled: true });
        expect(kb.macros![0].actions).toEqual([["tap", "KC_A"]]);
        expect(kb.macros![1].actions).toEqual([["text", "hello world"]]);
        expect(kb.key_overrides![0]).toMatchObject({ trigger: "KC_BSPACE", replacement: "KC_DELETE" });

        // Names stored on the board, combo names included
        expect(kb.cosmetic?.layer).toEqual(SEED_NAMES[LABEL_TYPE_LAYER]);
        expect(kb.cosmetic?.tapdances).toEqual(SEED_NAMES[LABEL_TYPE_TAP_DANCE]);
        expect(kb.cosmetic?.macros).toEqual(SEED_NAMES[LABEL_TYPE_MACRO]);
        expect(kb.cosmetic?.combos).toEqual(SEED_NAMES[LABEL_TYPE_COMBO]);

        // Fragments: 12 instances, both pointing slots detected as "none"
        expect(kb.fragmentState?.hwDetection.get(10)).toBe(4);
        expect(kb.fragmentState?.hwDetection.get(11)).toBe(4);
        expect(kb.pointing_hardware?.halves.map((h) => [h.side, h.detected])).toEqual([["right", "none"], ["left", "none"]]);
    });

    it("loads QMK settings", async () => {
        const { kb } = await connect();
        await qmkService.get(kb);
        expect(kb.settings?.[7]).toBe(200); // tapping term
        expect(kb.settings?.[2]).toBe(50); // combo term
    });

    it("stores a combo and its name written by Keybard's services", async () => {
        const { device, kb } = await connect();
        kb.combos![5] = { cmbid: 5, keys: ["KC_Q", "KC_W", "KC_NO", "KC_NO"], output: "KC_BSPACE", options: 0x8000 };
        await new ComboService(usbInstance).push(kb, 5);
        await new LabelService(usbInstance).saveName(kb, "combo", 5, "Wipe");
        await usbInstance.close();

        await usbInstance.openDevice(device.asHIDDevice());
        const again = await keyboardService.load({ rows: 0, cols: 0 } as KeyboardInfo);
        expect(again.combos![5]).toMatchObject({ keys: ["KC_Q", "KC_W", "KC_NO", "KC_NO"], output: "KC_BSPACE", options: 0x8000 });
        expect(again.cosmetic?.combos?.["5"]).toBe("Wipe");
    });

    it("loads firmware without combo names: no combo names from the board", async () => {
        const { kb } = await connect(false);
        expect(kb.feature_flags2! & 0x80).toBe(0);
        expect(kb.combos!.filter((c) => c.keys[0] !== "KC_NO")).toHaveLength(3);
        expect(kb.cosmetic?.combos ?? {}).toEqual({});
        expect(kb.cosmetic?.tapdances).toEqual(SEED_NAMES[LABEL_TYPE_TAP_DANCE]);
        await expect(new LabelService(usbInstance).saveName(kb, "combo", 0, "Esc")).rejects.toThrow();
    });
});
