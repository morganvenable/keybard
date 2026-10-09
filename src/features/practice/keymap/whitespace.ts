// Keycode → whitespace and control characters (spec §9.4 step 3). These are
// checked before any label lookup: getLabelForKeycode returns display labels
// ("Space", "enter", "tab"), which the single-character rule would drop, leaving
// space, the most common character, with no path.

/** Code points Practice types for whitespace keys, keyed by QMK keycode name. */
export const WHITESPACE_KEYCODES: Readonly<Record<string, number>> = {
    KC_SPACE: 0x0020,
    KC_SPC: 0x0020,
    KC_ENTER: 0x000a,
    KC_ENT: 0x000a,
    KC_KP_ENTER: 0x000a,
    KC_PENT: 0x000a,
    KC_TAB: 0x0009,
};

/** The whitespace character a keycode name types, or null. */
export function whitespaceFor(keycode: string): number | null {
    return WHITESPACE_KEYCODES[keycode] ?? null;
}

/** True for the characters this table produces. */
export function isWhitespaceChar(codePoint: number): boolean {
    return codePoint === 0x0020 || codePoint === 0x000a || codePoint === 0x0009;
}
