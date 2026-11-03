// Everything Keybard reads from the connected board when it loads it: the definition,
// keymap, tables, labels, QMK settings, layer colors and custom values. One reader for the
// editor's load (KeyboardContext) and for every restore and import, which plan and check
// their writes against what the board holds now, never against a copy kept in memory.

import type { KeyboardInfo } from "../types/keyboard.types";
import { customValueService } from "./custom-value.service";
import { keyboardService } from "./keyboard.service";
import { qmkService } from "./qmk.service";
import { usbInstance } from "./usb.service";
import { getClosestPresetColor } from "../utils/color-conversion";

/** A read that fails is tried once more: one timed-out report must not drop a part. */
const twice = <T>(read: () => Promise<T>): Promise<T> => read().catch(() => read());

/**
 * Read the whole board, as the editor loads it. A part that fails twice only warns and is
 * left out (no `settings`, no `custom_values`): unread, which a comparison must not take
 * for "different".
 */
export async function readBoard(): Promise<KeyboardInfo> {
    const kbinfo: KeyboardInfo = { rows: 0, cols: 0 };
    await keyboardService.init(kbinfo);
    const loaded = await keyboardService.load(kbinfo);

    try {
        await twice(() => qmkService.get(loaded));
    } catch (error) {
        console.warn("Failed to load QMK settings:", error);
        // Shown as not read: never as a board that has no such settings, nor as zeros.
        delete loaded.settings;
        loaded.settings_unread = true;
    }

    try {
        const layerColors = await twice(() => usbInstance.getAllLayerColors());
        // Brightness isn't per layer: shown at full. A layer whose read failed is left unset.
        loaded.layer_colors = layerColors.map((c) => (c ? { hue: c.hue, sat: c.sat, val: 255 } : undefined)) as KeyboardInfo["layer_colors"];
        // The keyboard display shows the preset paired with the LED color (they differ on purpose).
        loaded.cosmetic ??= { layer: {}, layer_colors: {} };
        loaded.cosmetic.layer_colors ??= {};
        layerColors.forEach((c, idx) => {
            if (c) loaded.cosmetic!.layer_colors![idx.toString()] = getClosestPresetColor(c.hue, c.sat, 255);
        });
    } catch (error) {
        console.warn("Failed to load layer colors:", error);
    }

    if (loaded.menus) {
        try {
            // Values cached from an earlier read must not stand in for what the board holds now.
            const menus = loaded.menus;
            loaded.custom_values = await twice(() => { customValueService.clearCache(); return customValueService.loadAllMenuValues(menus); });
        } catch (error) {
            console.warn("Failed to load custom values:", error);
        }
    }
    return loaded;
}
