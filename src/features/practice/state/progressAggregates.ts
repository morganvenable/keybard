// The Progress page's physical sections (spec §5.0.2, §5.8, M4): the Keyboard
// heatmap, the Fingers grid, the Thumbs table, the Layers table and History,
// computed from the period's result records. Pure, so the page and the tests
// read the same numbers.
//
// Where the numbers come from:
// - A heatmap key that types a practiced character on the shown layer takes that
//   character's Speed and Accuracy from its character stats, so the heatmap and
//   the Characters table agree (§12 M4). Keys typing whitespace or characters
//   with no stats (Space, Enter) use the key's own samples (`k`, §8.3).
// - Errors and Usage are about the physical key, so they always come from `k`:
//   Errors = (misses expected on the key + strays pressed on it) / (hits + misses
//   + strays), Usage = the key's presses (hits + strays) / all presses in scope.
// - Fingers and Thumbs add up `k` over every layer; Thumbs adds the layer-reach
//   samples (`r`) of the layer and Shift keys, which type nothing themselves.
// - Layers adds up the character samples (`h`) by the layer of their path.
// A record's mean time `t` is weighted by its hits, which is how buildResultRecord averaged it.
import type { KeyPlace } from '../keymap/geometry';
import { type KeymapResolution, layerAction, parsePathKey, resolveBinding } from '../keymap/resolver';
import type { StoredResult } from '../store/db';
import { parseSampleKey } from '../store/results';
import type { LessonType } from '../types';
import { speedToTime, timeToSpeed } from '../vendor/keybr/result/index.ts';
import type { CharacterStats } from './progressView';

export type HeatMetric = 'speed' | 'accuracy' | 'errors' | 'usage';
export const HEAT_METRICS: readonly HeatMetric[] = ['speed', 'accuracy', 'errors', 'usage'];

/** A heat face (§5.0.2): far, mid, near or at target for Speed, Accuracy and Errors; the blue ramp for Usage. */
export type HeatLevel = 'far' | 'mid' | 'near' | 'target' | 'use-1' | 'use-2' | 'use-3' | 'use-4' | 'none';

/** §5.8 thresholds. Speed is confidence (target time / time to type), Accuracy and Errors are 0–1. */
export const HEAT_THRESHOLDS = {
    speed: [0.5, 0.75, 1],
    accuracy: [0.9, 0.95, 0.98],
    errors: [0.1, 0.05, 0.02],
} as const;

/** Usage quartile boundaries over the values shown (§5.8): `[q1, q2, q3]`. */
export type UsageQuartiles = readonly [number, number, number];

export function usageQuartiles(values: readonly number[]): UsageQuartiles {
    const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
    if (!sorted.length) return [0, 0, 0];
    const at = (q: number) => {
        // Linear interpolation between closest ranks.
        const pos = (sorted.length - 1) * q;
        const lo = Math.floor(pos), hi = Math.ceil(pos);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    };
    return [at(0.25), at(0.5), at(0.75)];
}

/**
 * The heat face of a value. Speed takes a confidence, Accuracy and Errors a share
 * (0–1), Usage a share and the quartiles of the values shown. null → no data.
 */
export function heatLevel(metric: HeatMetric, value: number | null, quartiles?: UsageQuartiles): HeatLevel {
    if (value == null || !Number.isFinite(value)) return 'none';
    switch (metric) {
        case 'speed': {
            const [far, mid, near] = HEAT_THRESHOLDS.speed;
            return value < far ? 'far' : value < mid ? 'mid' : value < near ? 'near' : 'target';
        }
        case 'accuracy': {
            const [far, mid, near] = HEAT_THRESHOLDS.accuracy;
            return value < far ? 'far' : value < mid ? 'mid' : value < near ? 'near' : 'target';
        }
        case 'errors': {
            const [far, mid, near] = HEAT_THRESHOLDS.errors;
            return value > far ? 'far' : value > mid ? 'mid' : value > near ? 'near' : 'target';
        }
        case 'usage': {
            if (value <= 0) return 'none';
            const [q1, q2, q3] = quartiles ?? [0, 0, 0];
            return value < q1 ? 'use-1' : value < q2 ? 'use-2' : value < q3 ? 'use-3' : 'use-4';
        }
    }
}

/** Physical samples of one key or a group of keys, added up from `k` (and `r`). */
export interface KeyTotals {
    /** Hits typed on it. */
    h: number;
    /** Misses expected on it. */
    m: number;
    /** Stray presses on it. */
    s: number;
    /** Sum of time × hits, and the hits behind it (time to type, or the live target time). */
    time: number;
    timed: number;
    /** Layer-reach samples (Thumbs): presses as a prerequisite and their total ms. */
    reachN: number;
    reachTime: number;
}

export const emptyTotals = (): KeyTotals => ({ h: 0, m: 0, s: 0, time: 0, timed: 0, reachN: 0, reachTime: 0 });

export function addTotals(into: KeyTotals, from: KeyTotals): KeyTotals {
    into.h += from.h; into.m += from.m; into.s += from.s;
    into.time += from.time; into.timed += from.timed;
    into.reachN += from.reachN; into.reachTime += from.reachTime;
    return into;
}

/** Presses of the key: hits on it and strays on it. */
export const presses = (t: KeyTotals) => t.h + t.s + t.reachN;

/** Mean time to type, ms; null without timed hits. */
export const meanTime = (t: KeyTotals) => (t.timed > 0 && t.time > 0 ? t.time / t.timed : null);
/** Mean layer reach, ms; null without reach samples. */
export const meanReach = (t: KeyTotals) => (t.reachN > 0 ? t.reachTime / t.reachN : null);
/** Hits without a miss over hits, as the Characters table counts accuracy. */
export const keyAccuracy = (t: KeyTotals) => (t.h > 0 ? Math.max(0, t.h - t.m) / t.h : null);
/** Misses on the key plus strays on it, as a share of everything that happened on it (§5.8 Errors). */
export const keyErrors = (t: KeyTotals) => (t.h + t.m + t.s > 0 ? (t.m + t.s) / (t.h + t.m + t.s) : null);

/** Every key's totals in the period, per `index@layer` and per index over all layers. */
export interface PhysicalTotals {
    byKeyLayer: Map<string, KeyTotals>;
    byKey: Map<number, KeyTotals>;
    /** Presses of every key in scope (Usage's denominator). */
    allPresses: number;
    /** Layers with any sample (the heatmap's layer pills). */
    layers: number[];
}

export function physicalTotals(records: readonly StoredResult[]): PhysicalTotals {
    const byKeyLayer = new Map<string, KeyTotals>();
    const byKey = new Map<number, KeyTotals>();
    const layers = new Set<number>();
    const get = <K>(map: Map<K, KeyTotals>, key: K) => {
        let t = map.get(key);
        if (!t) map.set(key, (t = emptyTotals()));
        return t;
    };
    for (const record of records) {
        for (const [key, k] of Object.entries(record.k)) {
            const m = /^(\d+)@(\d+)$/.exec(key);
            if (!m) continue;
            const index = Number(m[1]), layer = Number(m[2]);
            const add: KeyTotals = { h: k.h, m: k.m, s: k.s, time: k.t > 0 ? k.t * k.h : 0, timed: k.t > 0 ? k.h : 0, reachN: 0, reachTime: 0 };
            addTotals(get(byKeyLayer, `${index}@${layer}`), add);
            addTotals(get(byKey, index), add);
            layers.add(layer);
        }
        for (const [key, r] of Object.entries(record.r)) {
            const index = Number(key);
            if (!Number.isInteger(index) || r.n <= 0) continue;
            const t = get(byKey, index);
            t.reachN += r.n;
            t.reachTime += r.t * r.n;
        }
        for (const key of Object.keys(record.h)) {
            const path = parseSampleKey(key)?.path;
            const layer = path ? parsePathKey(path)?.layer : undefined;
            if (layer != null) layers.add(layer);
        }
    }
    let allPresses = 0;
    for (const t of byKey.values()) allPresses += presses(t);
    return { byKeyLayer, byKey, allPresses, layers: [...layers].sort((a, b) => a - b) };
}

/** A metric's value for a key or group: confidence for Speed, a share otherwise. */
export interface MetricValues {
    /** Confidence (target time / time), or null. */
    speed: number | null;
    /** Speed in CPM, for the printed value. */
    cpm: number | null;
    accuracy: number | null;
    errors: number | null;
    usage: number | null;
    /** The Speed value is layer reach, in ms (Thumbs, live). */
    reachMs: number | null;
}

export function metricValue(values: MetricValues, metric: HeatMetric): number | null {
    return metric === 'speed' ? values.speed : values[metric];
}

/** Values of a physical total: Speed from its mean time, or from its layer reach when it was mostly a prerequisite. */
export function totalsValues(t: KeyTotals, targetSpeed: number, allPresses: number): MetricValues {
    const time = meanTime(t);
    // A layer or Shift key held more often than tapped: its Speed is layer reach (§5.8 Thumbs).
    const reach = t.reachN > 0 && t.reachN >= t.h ? meanReach(t) : null;
    const targetTime = speedToTime(targetSpeed);
    return {
        speed: reach != null && reach > 0 ? targetTime / reach : time != null ? targetTime / time : null,
        cpm: time != null ? timeToSpeed(time) : null,
        accuracy: keyAccuracy(t),
        errors: keyErrors(t),
        usage: allPresses > 0 && presses(t) > 0 ? presses(t) / allPresses : null,
        reachMs: reach,
    };
}

// ---- Keyboard heatmap (§5.8 item 3)

export interface HeatKey {
    index: number;
    /** The character the key types on the shown layer (its legend), or null. */
    char: number | null;
    /** Its character stats when it has any in the period (Speed and Accuracy come from them). */
    stats: CharacterStats | null;
    values: MetricValues;
    /** Nothing practiced on this key on this layer: the no-data look. */
    noData: boolean;
}

export interface HeatmapInput {
    keymap: readonly (readonly number[])[];
    resolution: KeymapResolution;
    indices: readonly number[];
    layer: number;
    defaultLayer: number;
    totals: PhysicalTotals;
    /** The period's character stats, by code point. */
    characters: ReadonlyMap<number, CharacterStats>;
    targetSpeed: number;
}

/** The heatmap's keys on one layer. */
export function heatmapKeys({ keymap, resolution, indices, layer, defaultLayer, totals, characters, targetSpeed }: HeatmapInput): HeatKey[] {
    const mask = ((1 << defaultLayer) | (1 << layer)) >>> 0;
    return indices.map((index) => {
        const binding = resolveBinding(keymap, index, mask);
        // A key transparent on this layer shows another layer's character: it belongs to that layer's view.
        const own = binding.layer === layer;
        const char = own ? resolution.charAt(index, layer, 'n') ?? resolution.charAt(index, layer, 'f') : null;
        const stats = char != null ? characters.get(char) ?? null : null;
        const key = totals.byKeyLayer.get(`${index}@${layer}`);
        const physical = key ? totalsValues(key, targetSpeed, totals.allPresses) : null;
        const practiced = stats != null && stats.samples > 0;
        const values: MetricValues = {
            speed: practiced ? stats.confidence : physical?.speed ?? null,
            cpm: practiced ? stats.speed : physical?.cpm ?? null,
            accuracy: practiced ? stats.accuracy : physical?.accuracy ?? null,
            errors: physical?.errors ?? null,
            usage: physical?.usage ?? null,
            reachMs: null,
        };
        return { index, char, stats: practiced ? stats : null, values, noData: !own || (!practiced && !key) };
    });
}

// ---- Fingers grid (§5.8 item 4) and Thumbs (item 5)

export const FINGER_COLUMNS = [
    { hand: 'left', finger: 'pinky', name: 'L-pinky' },
    { hand: 'left', finger: 'ring', name: 'L-ring' },
    { hand: 'left', finger: 'middle', name: 'L-middle' },
    { hand: 'left', finger: 'index', name: 'L-index' },
    { hand: 'right', finger: 'index', name: 'R-index' },
    { hand: 'right', finger: 'middle', name: 'R-middle' },
    { hand: 'right', finger: 'ring', name: 'R-ring' },
    { hand: 'right', finger: 'pinky', name: 'R-pinky' },
] as const;

export const FINGER_ROWS = ['C', 'N', 'S', 'E', 'W', '2S'] as const;
export type FingerRow = (typeof FINGER_ROWS)[number];

/** A group of keys (a finger × direction cell, a finger, a thumb key, a layer) and what happened on them. */
export interface KeyGroup {
    /** "L-middle · N", "L-middle", "L-thumb T1". */
    name: string;
    indices: number[];
    totals: KeyTotals;
    values: MetricValues;
    /** Characters the group's keys type on any layer (P5's chips, Drill this group). */
    chars: number[];
}

/** Characters a set of keys types, on any layer, in the resolver's order. */
export function charsOnKeys(resolution: KeymapResolution, indices: readonly number[]): number[] {
    const keys = new Set(indices);
    const out: number[] = [];
    for (const [char, paths] of resolution.paths) {
        if (paths.some((p) => p.targets.length === 1 && p.taps === 1 && keys.has(p.index) && p.shift !== 'u')) out.push(char);
    }
    return out;
}

function group(name: string, indices: number[], totals: PhysicalTotals, targetSpeed: number, resolution: KeymapResolution): KeyGroup {
    const sum = emptyTotals();
    for (const i of indices) {
        const t = totals.byKey.get(i);
        if (t) addTotals(sum, t);
    }
    return { name, indices, totals: sum, values: totalsValues(sum, targetSpeed, totals.allPresses), chars: charsOnKeys(resolution, indices) };
}

export interface FingersGrid {
    /** The rows shown: C, N, S, E, W, and 2S only on 6-key clusters. */
    rows: FingerRow[];
    /** cells[row][column]: null where the board has no such key. */
    cells: (KeyGroup | null)[][];
    /** The Finger totals row, one per column. */
    totals: KeyGroup[];
}

export function fingersGrid(
    places: readonly KeyPlace[], totals: PhysicalTotals, targetSpeed: number, resolution: KeymapResolution, doubleSouth: boolean,
): FingersGrid {
    const rows = FINGER_ROWS.filter((r) => r !== '2S' || doubleSouth);
    const at = (hand: string, finger: string, key: string) => places.filter((p) => !p.isThumb && p.hand === hand && p.finger === finger && p.key === key).map((p) => p.index);
    const cells = rows.map((row) => FINGER_COLUMNS.map((col) => {
        const indices = at(col.hand, col.finger, row);
        return indices.length ? group(`${col.name} · ${row}`, indices, totals, targetSpeed, resolution) : null;
    }));
    const columnTotals = FINGER_COLUMNS.map((col, c) => group(col.name, cells.flatMap((r) => (r[c] ? r[c]!.indices : [])), totals, targetSpeed, resolution));
    return { rows: [...rows], cells, totals: columnTotals };
}

export interface ThumbRow {
    key: string;
    index: number;
    group: KeyGroup;
}

/** Thumbs T1–T6 per hand (§5.8 item 5), each with its totals and layer reach. */
export function thumbRows(places: readonly KeyPlace[], totals: PhysicalTotals, targetSpeed: number, resolution: KeymapResolution): { left: ThumbRow[]; right: ThumbRow[] } {
    const side = (hand: 'left' | 'right') => places
        .filter((p) => p.isThumb && p.hand === hand)
        .sort((a, b) => String(a.key).localeCompare(String(b.key)))
        .map((p) => ({ key: String(p.key), index: p.index, group: group(`${hand === 'left' ? 'L' : 'R'}-thumb ${p.key}`, [p.index], totals, targetSpeed, resolution) }));
    return { left: side('left'), right: side('right') };
}

// ---- Layers (§5.8 item 6)

export interface LayerRow {
    layer: number;
    /** Distinct characters with samples on the layer. */
    characters: number;
    /** CPM from the samples' mean time to type; null without timed samples. */
    cpm: number | null;
    accuracy: number | null;
    /** Mean layer reach (live) of the keys that hold this layer, ms. */
    reachMs: number | null;
    /** Share of all character samples in scope. */
    share: number;
    /** Characters typed on the layer (Drill this group). */
    chars: number[];
}

export function layerRows(records: readonly StoredResult[], keymap: readonly (readonly number[])[], defaultLayer: number, stringify: (code: number) => string): LayerRow[] {
    const byLayer = new Map<number, { h: number; m: number; time: number; timed: number; chars: Set<number> }>();
    let all = 0;
    const reach = new Map<number, { n: number; time: number }>();
    const holds = new Map<number, number | null>();
    const holdLayer = (index: number) => {
        if (!holds.has(index)) {
            const { code } = resolveBinding(keymap, index, (1 << defaultLayer) >>> 0);
            holds.set(index, layerAction(stringify(code))?.toLayer ?? null);
        }
        return holds.get(index)!;
    };
    for (const record of records) {
        for (const [key, s] of Object.entries(record.h)) {
            const parsed = parseSampleKey(key);
            const path = parsed?.path ? parsePathKey(parsed.path) : null;
            if (!parsed || !path) continue;
            let row = byLayer.get(path.layer);
            if (!row) byLayer.set(path.layer, (row = { h: 0, m: 0, time: 0, timed: 0, chars: new Set() }));
            row.h += s.h;
            row.m += s.m;
            const n = s.h - s.m;
            if (s.t > 0 && n > 0) { row.time += s.t * n; row.timed += n; }
            row.chars.add(parsed.char);
            all += s.h;
        }
        for (const [key, r] of Object.entries(record.r)) {
            const layer = holdLayer(Number(key));
            if (layer == null || r.n <= 0) continue;
            const sum = reach.get(layer) ?? { n: 0, time: 0 };
            sum.n += r.n;
            sum.time += r.t * r.n;
            reach.set(layer, sum);
        }
    }
    return [...byLayer].sort(([a], [b]) => a - b).map(([layer, row]) => {
        const r = reach.get(layer);
        return {
            layer,
            characters: row.chars.size,
            cpm: row.timed > 0 && row.time > 0 ? timeToSpeed(row.time / row.timed) : null,
            accuracy: row.h > 0 ? Math.max(0, row.h - row.m) / row.h : null,
            reachMs: r && r.n > 0 ? r.time / r.n : null,
            share: all > 0 ? row.h / all : 0,
            chars: [...row.chars],
        };
    });
}

// ---- Inferred labels (§5.8 "Title suffix Inferred", §5.7 Inferred only)

/** More than half of the period's hits were inferred from the keymap, not seen on the board. */
export function mostlyInferred(records: readonly StoredResult[]): boolean {
    let obs = 0, inf = 0;
    for (const r of records) { obs += r.x.obs; inf += r.x.inf; }
    return inf + obs > 0 && inf > obs;
}

/** Characters every one of whose lessons in the period had no observed hit (P5 "Inferred only"). */
export function inferredOnlyChars(records: readonly StoredResult[]): Set<number> {
    const seenLive = new Set<number>();
    const all = new Set<number>();
    for (const record of records) {
        for (const key of Object.keys(record.h)) {
            const char = parseSampleKey(key)?.char;
            if (char == null) continue;
            all.add(char);
            if (record.x.obs > 0) seenLive.add(char);
        }
    }
    return new Set([...all].filter((c) => !seenLive.has(c)));
}

// ---- History (§5.8 item 8)

export const HISTORY_PAGE = 50;

export interface HistoryRow {
    id: number;
    ts: number;
    type: LessonType;
    scope: StoredResult['x']['scope'];
    /** CPM. */
    speed: number;
    accuracy: number;
    length: number;
    src: StoredResult['x']['src'];
}

/** One page of History, newest first. */
export function historyPage(records: readonly StoredResult[], page: number, size = HISTORY_PAGE): { rows: HistoryRow[]; pages: number } {
    const pages = Math.max(1, Math.ceil(records.length / size));
    const p = Math.max(0, Math.min(page, pages - 1));
    const newest = [...records].sort((a, b) => b.ts - a.ts || b.id - a.id).slice(p * size, (p + 1) * size);
    return {
        pages,
        rows: newest.map((r) => ({
            id: r.id, ts: r.ts, type: r.x.type, scope: r.x.scope,
            speed: r.t > 0 ? (r.n / (r.t / 1000)) * 60 : 0,
            accuracy: r.n > 0 ? (r.n - r.e) / r.n : 0,
            length: r.n, src: r.x.src,
        })),
    };
}
