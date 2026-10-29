// Which switch closes the matrix tester when held (MatrixTester.tsx).
//
// While the tester is open the board's typing is paused, so Esc from the
// Svalboard never reaches the page; Keybard watches the switch instead. It
// looks on the base layer: the tester shows physical switches, and the base
// layer is where a person knows their Esc key to be. The active layer can
// change while they test (layer keys still work during the pause), which
// would move the exit key in the middle of a hold.

const KC_ESC = 0x29;
// Mod-tap (0x2000-0x3FFF) and layer-tap (0x4000-0x4FFF): the low byte is the tap key.
const isTapEsc = (kc: number) => kc >= 0x2000 && kc <= 0x4fff && (kc & 0xff) === KC_ESC;

export const EXIT_HOLD_MS = 2000;

export interface MatrixPos {
    row: number;
    col: number;
}

export interface TesterExitKey {
    /** Every switch here must be held for EXIT_HOLD_MS. */
    keys: MatrixPos[];
    /** How the note names it. */
    name: string;
    /** True when no key is bound to Esc and the fallback pair is used. */
    fallback: boolean;
}

/**
 * The fallback when the base layer has no Esc: both index-finger center keys
 * (left row 1 col 2, right row 6 col 2 on a Svalboard). Two keys, one on each
 * half, are never held together by accident while testing a single key.
 */
export const FALLBACK_EXIT: TesterExitKey = {
    keys: [{ row: 1, col: 2 }, { row: 6, col: 2 }],
    name: "both index-finger center keys",
    fallback: true,
};

/**
 * The exit key for a keymap (layers of keycodes, row * cols + col). A plain
 * KC_ESC wins over a tap-Esc (a mod-tap or layer-tap with Esc on tap); the
 * first in matrix order wins among equals.
 */
export function findTesterExitKey(keymap: number[][] | undefined | null, cols: number, baseLayer = 0): TesterExitKey {
    const layer = keymap?.[baseLayer] ?? keymap?.[0];
    if (!layer || cols <= 0) return FALLBACK_EXIT;
    let tap: number | null = null;
    for (let pos = 0; pos < layer.length; pos++) {
        if (layer[pos] === KC_ESC) return { keys: [{ row: Math.floor(pos / cols), col: pos % cols }], name: "Esc", fallback: false };
        if (tap === null && isTapEsc(layer[pos])) tap = pos;
    }
    if (tap !== null) return { keys: [{ row: Math.floor(tap / cols), col: tap % cols }], name: "Esc", fallback: false };
    return FALLBACK_EXIT;
}

export const isExitHeld = (exit: TesterExitKey, pressed: (row: number, col: number) => boolean) =>
    exit.keys.length > 0 && exit.keys.every((k) => pressed(k.row, k.col));
