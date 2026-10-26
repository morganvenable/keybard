// QMK's QK_USER range: QK_USER (0x7E40) to QK_USER_MAX (0x7FFF), 448 codes. A
// board's custom keycodes (customKeycodes in its definition) take these codes in
// order: position n is QK_USER_<n>, 0x7E40 + n. The keycode catalog (keygen.ts)
// names only QK_USER_0..QK_USER_31; Keybard names the rest as a board reports them.
// QK_KB / USERnn (0x7E00-0x7E3F) is a separate range and is not covered here.

export const QK_USER = 0x7e40;
export const QK_USER_MAX = 0x7fff;
/** How many custom keycodes fit in the QK_USER range. */
export const QK_USER_COUNT = QK_USER_MAX - QK_USER + 1;

/** The catalog name for position n: QK_USER for 0, QK_USER_<n> after. */
export function qkUserName(n: number): string {
    return n === 0 ? 'QK_USER' : `QK_USER_${n}`;
}

/**
 * The position a QK_USER name stands for (QK_USER, QK_USER_0, QK_USER_447), or
 * null for anything else, including positions past QK_USER_MAX.
 */
export function qkUserIndex(name: unknown): number | null {
    if (typeof name !== 'string') return null;
    if (name === 'QK_USER') return 0;
    const m = /^QK_USER_(0|[1-9]\d{0,2})$/.exec(name);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n < QK_USER_COUNT ? n : null;
}
