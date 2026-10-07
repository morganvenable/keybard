import { keyService } from '@/services/key.service';

/**
 * Keymaps are saved by keycode name ("KC_A", "LSFT_T(KC_A)"), never by number.
 * A keycode number only means something in the firmware numbering that produced
 * it, and QMK renumbers; a name stays put. Numbers exist only in memory and on
 * the wire to the board, so convert here, at the storage boundary.
 */
export type StoredKeymap = (string | number)[];

export function keymapToNames(keymap: readonly number[]): string[] {
    return keymap.map(keycode => keyService.stringify(keycode));
}

function keycodeFromStored(value: unknown): number {
    // Numbers are what Keybard saved before keymaps were stored by name.
    if (typeof value === 'number') {
        if (Number.isInteger(value) && value >= 0 && value <= 0xFFFF) return value;
    } else if (typeof value === 'string' && value.trim()) {
        const keycode = keyService.parse(value.trim());
        if (Number.isInteger(keycode) && keycode >= 0 && keycode <= 0xFFFF) return keycode;
    }
    throw new Error(`Unknown keycode ${JSON.stringify(value)}`);
}

/** Read a saved keymap (names, or numbers from older saves); throws on anything unrecognised. */
export function keymapFromStored(stored: unknown): number[] {
    if (!Array.isArray(stored)) throw new Error('Saved keymap is not a list');
    return stored.map(keycodeFromStored);
}
