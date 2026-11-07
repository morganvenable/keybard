// POINTING_SENSOR (Sval 0x39): how a PMW3360 or PMW3389 trackball sensor sees its
// surface. Wire format: svalboard/qmk keyboards/svalboard/docs/protocol.md,
// "Pointing sensor". Only the SAMPLES op is read here; the host keeps the history.

/** GET_INFO byte 21 (feature_flags4) bit 3. */
export const SVIL_FLAG4_POINTING_SENSOR = 0x08;
export const hasPointingSensor = (flags4: number | undefined | null): boolean => ((flags4 ?? 0) & SVIL_FLAG4_POINTING_SENSOR) !== 0;

export const SENSOR_OP_SAMPLES = 0;
export const SENSOR_OP_STATS = 1;
/** Each bin is a 50 ms fold of the half's sensor reads. */
export const SENSOR_BIN_MS = 50;
export const SENSOR_MAX_BINS_PER_REPLY = 2;

const REPLY_BYTES = 1 + 25;
const BIN_BYTES = 9;

export interface SensorBin {
    /** 16-bit sequence number; counts on and wraps. */
    seq: number;
    squalMean: number;
    squalMin: number;
    squalMax: number;
    rawSum: number;
    rawMax: number;
    rawMin: number;
    shutter: number;
    /** Reads with motion in the bin (0 to 127). */
    moving: number;
    /** The ball was lifted at some read of the bin. */
    lifted: boolean;
}

export interface SensorSamples {
    /** A PMW sensor runs on that hand. */
    present: boolean;
    is3389: boolean;
    /** The cursor was older than the ring or ahead of it; the reply starts at the oldest bin. */
    lost: boolean;
    more: boolean;
    right: boolean;
    /** Sequence number of the next bin to be made. */
    head: number;
    bins: SensorBin[];
}

/** Distance from a to b on the 16-bit sequence (positive when b is newer). */
export const seqDiff = (b: number, a: number): number => ((b - a + 0x8000) & 0xffff) - 0x8000;

/**
 * Parses a SAMPLES reply (command echo first). Null unless the echo matches and
 * the reply is complete; a half without a sensor (format 0) is null too.
 */
export function parseSensorSamples(reply: Uint8Array, cmd = 0x39): SensorSamples | null {
    if (!reply || reply.length < REPLY_BYTES || reply[0] !== cmd || reply[1] !== 1) return null;
    const p = 1;
    const flags = reply[p + 1];
    if (((flags >> 5) & 3) !== SENSOR_OP_SAMPLES) return null;
    const firstSeq = reply[p + 2] | (reply[p + 3] << 8);
    const count = Math.min(reply[p + 4], SENSOR_MAX_BINS_PER_REPLY);
    const head = reply[p + 5] | (reply[p + 6] << 8);
    const bins: SensorBin[] = [];
    for (let i = 0; i < count; i++) {
        const o = p + 7 + i * BIN_BYTES;
        if (o + BIN_BYTES > reply.length) break;
        bins.push({
            seq: (firstSeq + i) & 0xffff,
            squalMean: reply[o],
            squalMin: reply[o + 1],
            squalMax: reply[o + 2],
            rawSum: reply[o + 3],
            rawMax: reply[o + 4],
            rawMin: reply[o + 5],
            shutter: reply[o + 6] | (reply[o + 7] << 8),
            moving: reply[o + 8] & 0x7f,
            lifted: (reply[o + 8] & 0x80) !== 0,
        });
    }
    return {
        present: (flags & 0x01) !== 0,
        is3389: (flags & 0x02) !== 0,
        lost: (flags & 0x04) !== 0,
        more: (flags & 0x08) !== 0,
        right: (flags & 0x10) !== 0,
        head,
        bins,
    };
}

export interface SensorWindowStats {
    bins: number;
    /** Newest bin's mean. */
    live: number;
    avg: number;
    min: number;
    max: number;
}

/**
 * SQUAL over the bins: the live value (newest bin), the average of the bins' means, and the
 * lowest and highest single read. With sinceSeq, the lowest and highest cover only the bins
 * from that sequence on (the Reset button); the average always covers every bin given.
 */
export function squalStats(bins: readonly SensorBin[], sinceSeq: number | null = null): SensorWindowStats | null {
    if (bins.length === 0) return null;
    let sum = 0, min = 255, max = 0, extremes = 0;
    for (const b of bins) {
        sum += b.squalMean;
        if (sinceSeq !== null && seqDiff(b.seq, sinceSeq) < 0) continue;
        extremes++;
        if (b.squalMin < min) min = b.squalMin;
        if (b.squalMax > max) max = b.squalMax;
    }
    const last = bins[bins.length - 1];
    if (extremes === 0) { min = last.squalMin; max = last.squalMax; }
    return { bins: bins.length, live: last.squalMean, avg: sum / bins.length, min, max };
}
