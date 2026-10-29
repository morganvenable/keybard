// Sval FLICKER_LATCH (0x3D): every raw switch change since the last read, both halves,
// before debounce (keyboards/svalboard/docs/protocol.md, "Flicker latch").
//
//   [0x3D][0]        -> [0x3D][0][status][flags][rows][raw:rows][pressed:rows][released:rows]
//   [0x3D][1][half]  -> [0x3D][1][status][valid][half][changes: 5 rows x 6 cols]
//
// Reads clear what they return. One byte per row, bit = column.

/** GET_INFO byte 20, bit 3. */
export const SVIL_FLAG3_FLICKER_LATCH = 0x08;
export const CMD_SVIL_FLICKER_LATCH = 0x3d;
export const FLICKER_READ = 0;
export const FLICKER_COUNTS = 1;
/** The reply needs a 64-byte report (34 bytes after the command). */
export const FLICKER_MIN_REPORT = 64;

export interface FlickerRead {
    /** Which row blocks came back: bit 0 left (rows 0-4), bit 1 right (5-9). */
    halves: number;
    raw: Uint8Array;
    pressed: Uint8Array;
    released: Uint8Array;
}

export interface FlickerCounts {
    half: number;
    /** Changes per switch, rows of `cols`, this half's rows only. */
    changes: Uint8Array;
}

export const hasFlickerLatch = (featureFlags3: number | undefined | null, reportLength: number): boolean =>
    ((featureFlags3 ?? 0) & SVIL_FLAG3_FLICKER_LATCH) !== 0 && reportLength >= FLICKER_MIN_REPORT;

export function parseFlickerRead(reply: Uint8Array | null | undefined): FlickerRead | null {
    if (!reply || reply[0] !== CMD_SVIL_FLICKER_LATCH || reply[1] !== FLICKER_READ || reply[2] !== 0) return null;
    const rows = reply[4];
    if (!rows || reply.length < 5 + 3 * rows) return null;
    return {
        halves: reply[3],
        raw: reply.slice(5, 5 + rows),
        pressed: reply.slice(5 + rows, 5 + 2 * rows),
        released: reply.slice(5 + 2 * rows, 5 + 3 * rows),
    };
}

export function parseFlickerCounts(reply: Uint8Array | null | undefined, halfRows: number, cols: number): FlickerCounts | null {
    if (!reply || reply[0] !== CMD_SVIL_FLICKER_LATCH || reply[1] !== FLICKER_COUNTS || reply[2] !== 0 || !(reply[3] & 1)) return null;
    if (reply.length < 5 + halfRows * cols) return null;
    return { half: reply[4], changes: reply.slice(5, 5 + halfRows * cols) };
}

/**
 * A switch's presses since the last read, from its changes and whether it was
 * down at that read: half the changes, the odd one a press if it was up.
 */
export const pressesFrom = (changes: number, wasDown: boolean): number => (wasDown ? Math.floor(changes / 2) : Math.ceil(changes / 2));
