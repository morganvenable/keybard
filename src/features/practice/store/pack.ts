// Per-keystroke event packing, layout 1 (spec §8.2): 5 × 32-bit words per event.
//
// | Word | Bits  | Field                                                      |
// | w0   | 0–31  | t × 10 (0.1 ms, unsigned)                                  |
// | w1   | 0–20  | expected code point                                        |
// |      | 21–22 | kind (0 hit, 1 miss, 2 backspace, 3 stray)                 |
// |      | 23    | confidence (0 inferred, 1 observed)                        |
// |      | 24–26 | errorClass (0 none, 1–6 in ERROR_CLASSES order)            |
// |      | 27–28 | shift of the pressed key (0 n, 1 f, 2 u, 3 unknown)        |
// |      | 29–30 | prerequisite count (0–2)                                   |
// |      | 31    | delayed output                                             |
// | w2   | 0–20  | typed code point (0x1FFFFF = null)                         |
// |      | 21–25 | layer (31 = unknown)                                       |
// |      | 26–31 | reserved (layout 2, M3)                                    |
// | w3   | 0–6   | index (127 = none)                                         |
// |      | 7–13  | prereq[0] (127 = none)                                     |
// |      | 14–20 | prereq[1] (127 = none)                                     |
// |      | 21–31 | skew ms, signed 11-bit, clamped to ±1023 (−1024 = null)    |
// | w4   | 0–15  | reach ms, clamped to 65,534 (65,535 = null)                |
// |      | 16–31 | target ms, same encoding                                   |
//
// `raw` and `ttt` are not stored: raw is rebuilt from `t` and the previous hit,
// ttt from raw, the prerequisite count and the 2,000 ms rule. layer, index and
// shift describe the key pressed: a hit's path is rebuilt from them. A miss's
// expected path is not stored (it differs from the pressed key), so a miss
// unpacks with path "" and its pressed key in phys, shift included; the expected
// path re-resolves from `expected` under the result's keymap fingerprint.
import { parsePathKey, pathKey, type Shift } from '../keymap/resolver';
import { ERROR_CLASSES, type KeystrokeEvent, type KeystrokeKind } from '../types';

export const EVENT_LAYOUT = 1;
export const WORDS_PER_EVENT = 5;
/** Steps slower than this are a pause, not typing (§6.5). */
export const MAX_STEP_MS = 2000;

const KINDS: KeystrokeKind[] = ['hit', 'miss', 'backspace', 'stray'];
const SHIFTS: Shift[] = ['n', 'f', 'u'];
const UNKNOWN_SHIFT = 3;
const NULL_CODE_POINT = 0x1fffff;
const NO_INDEX = 127;
const UNKNOWN_LAYER = 31;
const NULL_SKEW = -1024;
const NULL_MS = 0xffff;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function packMs(value: number | null) {
    return value == null ? NULL_MS : clamp(Math.round(value), 0, NULL_MS - 1);
}

function unpackMs(value: number) {
    return value === NULL_MS ? null : value;
}

function packIndex(value: number | undefined) {
    return value == null || value < 0 || value >= NO_INDEX ? NO_INDEX : value;
}

/** Packs events into an ArrayBuffer of 20 bytes per event. */
export function packEvents(events: readonly KeystrokeEvent[]): ArrayBuffer {
    const words = new Uint32Array(events.length * WORDS_PER_EVENT);
    events.forEach((e, i) => {
        const o = i * WORDS_PER_EVENT;
        // A miss's path is the expected one: its shift would not be the pressed key's.
        const pressed = e.kind === 'hit' ? (e.path ? parsePathKey(e.path)?.shift : undefined) : e.phys.shift;
        const shift = pressed ? SHIFTS.indexOf(pressed) : UNKNOWN_SHIFT;
        const prereqs = e.prereq.slice(0, 2);
        const errorClass = e.errorClass ? ERROR_CLASSES.indexOf(e.errorClass) + 1 : 0;
        const layer = e.phys.layer < 0 || e.phys.layer >= UNKNOWN_LAYER ? UNKNOWN_LAYER : e.phys.layer;
        const skew = e.phys.skew == null ? NULL_SKEW : clamp(Math.round(e.phys.skew), -1023, 1023);
        words[o] = clamp(Math.round(e.t * 10), 0, 0xffffffff);
        words[o + 1] = ((e.expected & 0x1fffff)
            | (KINDS.indexOf(e.kind) << 21)
            | ((e.phys.confidence === 'observed' ? 1 : 0) << 23)
            | (errorClass << 24)
            | (shift << 27)
            | (prereqs.length << 29)
            | ((e.delayed ? 1 : 0) << 31)) >>> 0;
        words[o + 2] = (((e.typed ?? NULL_CODE_POINT) & 0x1fffff) | (layer << 21)) >>> 0;
        words[o + 3] = (packIndex(e.phys.index)
            | (packIndex(prereqs[0]) << 7)
            | (packIndex(prereqs[1]) << 14)
            | ((skew & 0x7ff) << 21)) >>> 0;
        words[o + 4] = (packMs(e.phys.reach) | (packMs(e.phys.target) << 16)) >>> 0;
    });
    return words.buffer;
}

/** Unpacks events packed by packEvents(), rebuilding raw, ttt and path. */
export function unpackEvents(buffer: ArrayBuffer): KeystrokeEvent[] {
    if (buffer.byteLength % (WORDS_PER_EVENT * 4) !== 0) throw new Error('Practice events: bad packed length');
    const words = new Uint32Array(buffer);
    const events: KeystrokeEvent[] = [];
    let lastHit: number | null = null;
    for (let o = 0; o < words.length; o += WORDS_PER_EVENT) {
        const w1 = words[o + 1], w2 = words[o + 2], w3 = words[o + 3], w4 = words[o + 4];
        const t = words[o] / 10;
        const kind = KINDS[(w1 >>> 21) & 3];
        const errorClass = (w1 >>> 24) & 7;
        const shift: Shift | undefined = SHIFTS[(w1 >>> 27) & 3];
        const prereqCount = (w1 >>> 29) & 3;
        const typed = w2 & 0x1fffff;
        const layer = (w2 >>> 21) & 31;
        const index = w3 & 127;
        const prereq = [(w3 >>> 7) & 127, (w3 >>> 14) & 127].slice(0, prereqCount).filter((p) => p !== NO_INDEX);
        const skewBits = (w3 >>> 21) & 0x7ff;
        const skew = skewBits & 0x400 ? skewBits - 0x800 : skewBits;
        const raw = lastHit == null ? 0 : t - lastHit;
        const ttt = kind === 'hit' && lastHit != null && raw <= MAX_STEP_MS ? raw / (1 + prereqCount) : null;
        if (kind === 'hit') lastHit = t;
        const event: KeystrokeEvent = {
            t, expected: w1 & 0x1fffff,
            typed: typed === NULL_CODE_POINT ? null : typed,
            kind, raw, ttt,
            path: kind !== 'hit' || !shift || index === NO_INDEX || layer === UNKNOWN_LAYER ? '' : pathKey(layer, index, shift),
            prereq,
            phys: {
                index: index === NO_INDEX ? -1 : index,
                layer: layer === UNKNOWN_LAYER ? -1 : layer,
                confidence: (w1 >>> 23) & 1 ? 'observed' : 'inferred',
                skew: skew === NULL_SKEW ? null : skew,
                reach: unpackMs(w4 & 0xffff),
                target: unpackMs(w4 >>> 16),
            },
        };
        if (kind !== 'hit' && shift) event.phys.shift = shift;
        if (errorClass) event.errorClass = ERROR_CLASSES[errorClass - 1];
        if (w1 >>> 31) event.delayed = true;
        events.push(event);
    }
    return events;
}
