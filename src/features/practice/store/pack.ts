// Per-keystroke event packing (spec §8.2). Layout 1: 5 × 32-bit words per event.
// Layout 2 (M3) is used for a lesson with a combo or double-tap hit: w2's bits
// 26–29 say so, and a combo's other target keys follow the event in one extra
// word (see below). A lesson without them keeps layout 1.
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
// |      | 26–31 | layout 1: reserved; layout 2: see below                    |
// | w3   | 0–6   | index (127 = none)                                         |
// |      | 7–13  | prereq[0] (127 = none)                                     |
// |      | 14–20 | prereq[1] (127 = none)                                     |
// |      | 21–31 | skew ms, signed 11-bit, clamped to ±1023 (−1024 = null)    |
// | w4   | 0–15  | reach ms, clamped to 65,534 (65,535 = null)                |
// |      | 16–31 | target ms, same encoding                                   |
//
// Layout 2 adds, in w2:
// |      | 26    | double tap (a tap-dance double tap: the target pressed twice) |
// |      | 27–29 | other combo targets (0–4); when not 0, one extension word     |
// |      |       | follows the event: 4 × 7-bit matrix indices from bit 0        |
// |      | 30–31 | reserved                                                       |
//
// `raw` and `ttt` are not stored: raw is rebuilt from `t` and the previous hit,
// ttt from raw, the prerequisite count and the 2,000 ms rule. layer, index and
// shift describe the key pressed: a hit's path is rebuilt from them. A miss's
// expected path is not stored (it differs from the pressed key), so a miss
// unpacks with path "" and its pressed key in phys, shift included; the expected
// path re-resolves from `expected` under the result's keymap fingerprint.
import { parsePathKey, pathKey, type Shift } from '../keymap/resolver';
import { ERROR_CLASSES, type EventLayout, type KeystrokeEvent, type KeystrokeKind } from '../types';

/** The layout without combos or double taps. */
export const EVENT_LAYOUT = 1;
/** Combos and double taps (M3). */
export const EVENT_LAYOUT_COMBOS = 2;
const MAX_EXTRA_TARGETS = 4;
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
    return value == null || !Number.isInteger(value) || value < 0 || value >= NO_INDEX ? NO_INDEX : value;
}

/** A hit's combo or double tap, from its path key: the other targets and the taps. */
function hitShape(e: KeystrokeEvent): { extra: number[]; taps: 1 | 2 } {
    const parsed = e.kind === 'hit' && e.path ? parsePathKey(e.path) : null;
    if (!parsed) return { extra: [], taps: 1 };
    return { extra: parsed.targets.filter((t) => t !== e.phys.index).slice(0, MAX_EXTRA_TARGETS), taps: parsed.taps };
}

/** The layout a lesson's events need: 2 when a hit was a combo or a double tap. */
export function eventLayoutFor(events: readonly KeystrokeEvent[]): EventLayout {
    return events.some((e) => {
        const { extra, taps } = hitShape(e);
        return extra.length > 0 || taps === 2;
    }) ? EVENT_LAYOUT_COMBOS : EVENT_LAYOUT;
}

/** Packs events: 20 bytes per event, plus 4 for each combo hit in layout 2. */
export function packEvents(events: readonly KeystrokeEvent[], layout: EventLayout = eventLayoutFor(events)): ArrayBuffer {
    const shapes = events.map(hitShape);
    const extraWords = layout === EVENT_LAYOUT_COMBOS ? shapes.filter((s) => s.extra.length > 0).length : 0;
    const words = new Uint32Array(events.length * WORDS_PER_EVENT + extraWords);
    let o = 0;
    events.forEach((e, i) => {
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
        const { extra, taps } = shapes[i];
        const combo = layout === EVENT_LAYOUT_COMBOS ? (((taps === 2 ? 1 : 0) << 26) | (extra.length << 27)) : 0;
        words[o + 2] = (((e.typed ?? NULL_CODE_POINT) & 0x1fffff) | (layer << 21) | combo) >>> 0;
        words[o + 3] = (packIndex(e.phys.index)
            | (packIndex(prereqs[0]) << 7)
            | (packIndex(prereqs[1]) << 14)
            | ((skew & 0x7ff) << 21)) >>> 0;
        words[o + 4] = (packMs(e.phys.reach) | (packMs(e.phys.target) << 16)) >>> 0;
        o += WORDS_PER_EVENT;
        if (layout === EVENT_LAYOUT_COMBOS && extra.length) {
            words[o++] = extra.reduce((w, index, k) => (w | (packIndex(index) << (7 * k))) >>> 0, 0);
        }
    });
    return words.buffer;
}

/** Unpacks events packed by packEvents() in `layout`, rebuilding raw, ttt and path. */
export function unpackEvents(buffer: ArrayBuffer, layout: EventLayout = EVENT_LAYOUT): KeystrokeEvent[] {
    if (buffer.byteLength % 4 !== 0 || (layout === EVENT_LAYOUT && buffer.byteLength % (WORDS_PER_EVENT * 4) !== 0)) {
        throw new Error('Practice events: bad packed length');
    }
    const words = new Uint32Array(buffer);
    const events: KeystrokeEvent[] = [];
    let lastHit: number | null = null;
    for (let o = 0; o < words.length; o += WORDS_PER_EVENT) {
        if (o + WORDS_PER_EVENT > words.length) throw new Error('Practice events: bad packed length');
        const w0 = words[o], w1 = words[o + 1], w2 = words[o + 2], w3 = words[o + 3], w4 = words[o + 4];
        let targets: number[] = [];
        let taps: 1 | 2 = 1;
        if (layout === EVENT_LAYOUT_COMBOS) {
            taps = (w2 >>> 26) & 1 ? 2 : 1;
            const extra = (w2 >>> 27) & 7;
            if (extra) {
                if (o + WORDS_PER_EVENT >= words.length) throw new Error('Practice events: bad packed length');
                const ext = words[o + WORDS_PER_EVENT];
                targets = Array.from({ length: Math.min(extra, MAX_EXTRA_TARGETS) }, (_, k) => (ext >>> (7 * k)) & 127)
                    .filter((i) => i !== NO_INDEX);
                // Skip the extension word; the event's own words are read above.
                o++;
            }
        }
        const t = w0 / 10;
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
            path: kind !== 'hit' || !shift || index === NO_INDEX || layer === UNKNOWN_LAYER ? '' : pathKey(layer, [index, ...targets], shift, taps),
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
