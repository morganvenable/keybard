import type { KeyboardInfo } from "@/types/keyboard.types";
import { keyService } from "@/services/key.service";
import { shortKeyName } from "@/utils/combo-labels";
import { MATRIX_COLS } from "@/constants/svalboard-layout";
import { getState, placeKey, posKey, setHold } from "./store";

/** Pretend keycodes for the Type and Pause keys (the prototype never writes them to a board). */
export const APP_TYPE_KEY = "APP_TYPE";
export const APP_PAUSE_KEY = "APP_PAUSE";

/**
 * The picker and "typing binds a key" in the prototype: with Hold chosen, a
 * picked key becomes the selected app's hold instead of the key's tap.
 * Returns true when the prototype handled the pick.
 */
export function appAwareAssign(
    keyboard: KeyboardInfo | null | undefined,
    target: { layer?: number; row?: number; col?: number },
    keycode: number | string,
): boolean {
    const s = getState();
    if (!s.on || !s.supported || !keyboard) return false;
    const { layer, row, col } = target;
    if (layer === undefined || row === undefined || col === undefined) return false;
    const pos = posKey(layer, row, col);
    if (keycode === APP_TYPE_KEY || keycode === APP_PAUSE_KEY) {
        placeKey(pos, keycode === APP_TYPE_KEY ? "type" : "pause");
        return true;
    }
    if (s.pickMode === "hold") {
        const str = typeof keycode === "number" ? keyService.stringify(keycode) : keycode;
        const name = shortKeyName(str);
        const tap = keyService.stringify(Number(keyboard.keymap?.[layer]?.[row * MATRIX_COLS + col] ?? 0));
        setHold(pos, { code: str, name, short: name.length > 7 ? name.slice(0, 7) : name }, tap);
        return true;
    }
    if (s.placed[pos]) placeKey(pos, null);
    return false;
}
