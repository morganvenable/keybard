// Practice data shapes shared by the engine, the store and (from M1b) the UI.
// Field names follow spec §8.1–§8.3.
import type { Shift } from './keymap/resolver';

/** The six miss classes of §6.6, in packing order (1–6). */
export const ERROR_CLASSES = ['wrong-layer', 'wrong-direction', 'wrong-finger', 'wrong-hand', 'wrong-shift', 'unknown'] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

export type KeystrokeKind = 'hit' | 'miss' | 'backspace' | 'stray';

/** One keystroke of a lesson, in memory (§8.2). */
export interface KeystrokeEvent {
    /** ms since lesson start (DOM event.timeStamp clock). */
    t: number;
    /** Expected code point. */
    expected: number;
    /** Code point typed; null for backspace. */
    typed: number | null;
    kind: KeystrokeKind;
    /** ms since the previous step (0 for the first). */
    raw: number;
    /** Normalized time to type (§6.5); null when dropped (> 2000 ms) or not a hit. */
    ttt: number | null;
    /** Path key used ("1:27:f"); "" when there is none. */
    path: string;
    /** Matrix indices of new prerequisites (§6.5), at most 2. */
    prereq: number[];
    phys: {
        /** Matrix index, -1 if none. */
        index: number;
        /** Effective layer, -1 if unknown. */
        layer: number;
        confidence: 'observed' | 'inferred';
        /** ms between the matched edge and the input event (live). */
        skew: number | null;
        reach: number | null;
        target: number | null;
    };
    errorClass?: ErrorClass;
    /** Output came after the target's press edge (§6.5). */
    delayed?: boolean;
}

export type LessonType = 'guided' | 'drill' | 'words' | 'custom';
export type InputSource = 'usb' | 'host' | 'keymap';

/** Per (character | path key) sample in a result (§8.3 `h`). */
export interface PathSample {
    /** Hits. */
    h: number;
    /** Misses. */
    m: number;
    /** Mean time to type, ms (0 when unmeasured). */
    t: number;
}

/** Per matrix index @ layer (§8.3 `k`); `s` counts stray presses. */
export interface KeySampleRecord extends PathSample {
    s: number;
}

/** Layer reach per prerequisite index (§8.3 `r`). */
export interface ReachSample {
    n: number;
    t: number;
}

export interface DrillScope {
    layer: number | null;
    group: string | null;
    dirs: string[] | null;
    hands: string[] | null;
    thumbs: boolean;
}

/** A finished lesson (§8.3). Borrows keybr's legacy field names; not readable by keybr. */
export interface ResultRecord {
    schema: 1;
    /** IndexedDB key, set once stored. */
    id?: number;
    profileId: string;
    l: 'custom';
    m: 'generated' | 'natural' | 'numbers';
    ts: number;
    n: number;
    t: number;
    e: number;
    h: Record<string, PathSample>;
    k: Record<string, KeySampleRecord>;
    r: Record<string, ReachSample>;
    x: {
        type: LessonType;
        scope: DrillScope;
        target: number;
        src: InputSource;
        obs: number;
        inf: number;
        board: string;
        os: string;
        km: string;
    };
}

export interface ProfileRecord {
    schema: 1;
    id: string;
    name: string;
    createdAt: number;
    lastUsedAt: number;
    language: 'en';
    startDone: boolean;
}

/** Packed keystrokes of one result (§8.2 layout 1). */
export interface EventsRecord {
    schema: 1;
    resultId: number;
    profileId: string;
    layout: 1;
    packed: ArrayBuffer;
}

/** Per-character key stats as replayed, keyed by code point. */
export interface SnapshotKeyStats {
    codePoint: number;
    samples: {
        index: number;
        timeStamp: number;
        hitCount: number;
        missCount: number;
        timeToType: number;
        filteredTimeToType: number;
    }[];
    timeToType: number | null;
    bestTimeToType: number | null;
}

export interface SnapshotRecord {
    schema: 1;
    profileId: string;
    engineVersion: string;
    resultCount: number;
    keymapFingerprint: string;
    keyStats: SnapshotKeyStats[];
    updatedAt: number;
}

export type { Shift };
