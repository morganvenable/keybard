// Result records (spec §8.3): building them from a lesson, validating stored or
// imported ones, and turning them into keybr Results for the engine.
//
// `h` keeps one entry per (character | path key). keybr's engine sees one
// histogram per character: PracticeResult carries every path, and
// selectByPaths() keeps only the samples on a character's current paths, so a
// remap restarts that character alone (§6.1).
import { PRACTICE_LAYOUT } from '../keymap/svalKeyboard';
import { parsePathKey, type KeymapResolution } from '../keymap/resolver';
import { Result, TextType } from '../vendor/keybr/result/index.ts';
import {
    Histogram,
    makeStats,
    type Sample,
    type StatsOptions,
    type Step,
    validateSample,
} from '../vendor/keybr/textinput/index.ts';
import {
    type DrillScope,
    type InputSource,
    type KeySampleRecord,
    type KeystrokeEvent,
    type LessonType,
    type PathSample,
    type ReachSample,
    type ResultRecord,
} from '../types';
import { RECORD_SCHEMA } from './migrations';
import { MAX_STEP_MS } from './pack';

/** "<code point>|<path key>". */
export function sampleKey(char: number, path: string): string {
    return `${char}|${path}`;
}

export function parseSampleKey(key: string): { char: number; path: string } | null {
    const m = /^(\d+)\|(.*)$/.exec(key);
    if (!m) return null;
    const char = Number(m[1]);
    if (!Number.isSafeInteger(char) || char < 0 || char > 0x10ffff) return null;
    if (m[2] !== '' && !parsePathKey(m[2])) return null;
    return { char, path: m[2] };
}

/** "<index>@<layer>". */
export function keySampleKey(index: number, layer: number): string {
    return `${index}@${layer}`;
}

/** Merges path samples of one character as keybr's Histogram.from would have. */
function mergeSamples(char: number, samples: readonly PathSample[]): Sample {
    let hitCount = 0, missCount = 0, time = 0, timed = 0;
    for (const s of samples) {
        hitCount += s.h;
        missCount += s.m;
        const n = s.h - s.m;
        if (s.t > 0 && n > 0) { time += s.t * n; timed += n; }
    }
    return { codePoint: char, hitCount, missCount, timeToType: timed > 0 ? Math.round(time / timed) : 0 };
}

function histogramOf(record: ResultRecord, keep: (char: number, path: string) => boolean): Histogram {
    const byChar = new Map<number, PathSample[]>();
    for (const [key, sample] of Object.entries(record.h)) {
        const parsed = parseSampleKey(key);
        if (!parsed || !keep(parsed.char, parsed.path)) continue;
        let list = byChar.get(parsed.char);
        if (!list) byChar.set(parsed.char, (list = []));
        list.push(sample);
    }
    return new Histogram([...byChar].map(([char, list]) => mergeSamples(char, list)));
}

export function textTypeOf(record: Pick<ResultRecord, 'm'>): TextType {
    return TextType.ALL.get(record.m, TextType.GENERATED);
}

/** A keybr Result that keeps its Practice record (every path of every character). */
export class PracticeResult extends Result {
    constructor(readonly record: ResultRecord) {
        super(PRACTICE_LAYOUT, textTypeOf(record), record.ts, record.n, record.t, record.e, histogramOf(record, () => true));
    }
}

/**
 * The keybr Result the engine replays: only samples whose path key is a current
 * path of their character (§6.1). Samples with no path ("") never count.
 */
export function selectByPaths(record: ResultRecord, resolution: KeymapResolution): Result {
    return new Result(PRACTICE_LAYOUT, textTypeOf(record), record.ts, record.n, record.t, record.e,
        histogramOf(record, (char, path) => path !== '' && resolution.isCurrentPath(char, path)));
}

/**
 * A keybr TextInput step with the path key it is charged to. For a position the
 * user typed, the path used; for a position keybr's forgiveErrors closed without
 * a correct key (a replaced or skipped character, or Space skipping a word), the
 * expected (primary) path, so the miss still counts against that character (§6.6).
 */
export interface PracticeStep extends Step {
    path: string;
}

export interface LessonResultInput {
    profileId: string;
    type: LessonType;
    textType: 'generated' | 'natural' | 'numbers';
    ts: number;
    /**
     * The lesson's final TextInput steps (`TextInput.steps`), in order, with paths.
     * `timeToType` is the normalized time to type (§6.5), 0 when unmeasured.
     */
    steps: readonly PracticeStep[];
    /** Paused intervals, removed from the lesson time (§6.5). */
    paused?: StatsOptions['paused'];
    /** The lesson's keystroke events, in order: physical key stats, reach and confidence. */
    events: readonly KeystrokeEvent[];
    /** Target speed, CPM. */
    target: number;
    src: InputSource;
    board: string;
    os: string;
    km: string;
    scope?: Partial<DrillScope>;
}

const DEFAULT_SCOPE: DrillScope = { layer: null, group: null, dirs: null, hands: null, thumbs: true };

/**
 * Builds the §8.3 record of a finished lesson.
 *
 * `n`, `t`, `e` and `h` come from the TextInput steps, exactly as keybr's
 * makeStats() and Histogram.from() compute them (the 2 s gap rule included), with
 * `h` split per path. So positions that forgiveErrors closed without a correct
 * key are counted, every miss lands on the character keybr charges it to, the
 * trigger step is ignored as in keybr, and the sum of `h[*].m` equals `e` unless
 * the trigger step itself was a typo. Samples outside keybr's 40–12,000 ms window
 * are dropped like keybr's.
 *
 * `k`, `r`, `obs` and `inf` come from the keystroke events: per physical key, a
 * hit closes its key's attempt, which is a miss when a wrong key was typed for
 * it first. Times are `target` when live, else the normalized `ttt`.
 */
export function buildResultRecord(input: LessonResultInput): ResultRecord {
    const stats = makeStats(input.steps, { maxGap: MAX_STEP_MS, paused: input.paused });
    const h = new Map<string, { h: number; m: number; time: number; timed: number }>();
    const k = new Map<string, { h: number; m: number; s: number; time: number; timed: number }>();
    const r = new Map<string, { n: number; time: number }>();
    const counter = <T>(map: Map<string, T>, key: string, init: () => T) => {
        let value = map.get(key);
        if (!value) map.set(key, (value = init()));
        return value;
    };
    // As makeStats: the trigger step is ignored, and a step after a pause is untimed.
    for (let i = 1; i < input.steps.length; i++) {
        const step = input.steps[i];
        const sample = counter(h, sampleKey(step.codePoint, step.path), () => ({ h: 0, m: 0, time: 0, timed: 0 }));
        sample.h++;
        if (step.typo) sample.m++;
        else if (step.timeToType > 0 && step.timeStamp - input.steps[i - 1].timeStamp <= MAX_STEP_MS) {
            sample.time += step.timeToType;
            sample.timed++;
        }
    }
    let typo = false;
    let obs = 0, inf = 0;
    for (const event of input.events) {
        if (event.kind === 'miss') {
            typo = true;
            const expected = parsePathKey(event.path);
            if (expected) counter(k, keySampleKey(expected.index, expected.layer), () => ({ h: 0, m: 0, s: 0, time: 0, timed: 0 })).m++;
            continue;
        }
        if (event.kind === 'stray') {
            if (event.phys.index >= 0 && event.phys.layer >= 0) {
                counter(k, keySampleKey(event.phys.index, event.phys.layer), () => ({ h: 0, m: 0, s: 0, time: 0, timed: 0 })).s++;
            }
            continue;
        }
        if (event.kind !== 'hit') continue;
        if (event.phys.confidence === 'observed') obs++; else inf++;
        if (event.phys.index >= 0 && event.phys.layer >= 0) {
            const key = counter(k, keySampleKey(event.phys.index, event.phys.layer), () => ({ h: 0, m: 0, s: 0, time: 0, timed: 0 }));
            key.h++;
            const time = event.phys.target ?? event.ttt;
            if (!typo && time != null && time > 0) { key.time += time; key.timed++; }
        }
        if (event.phys.reach != null && event.prereq.length) {
            const reach = counter(r, String(event.prereq[0]), () => ({ n: 0, time: 0 }));
            reach.n++;
            reach.time += event.phys.reach;
        }
        typo = false;
    }
    const mean = (time: number, n: number) => (n > 0 ? Math.round(time / n) : 0);
    const hRecord: Record<string, PathSample> = {};
    for (const [key, s] of h) {
        const sample = { h: s.h, m: s.m, t: mean(s.time, s.timed) };
        if (validateSample({ codePoint: 0, hitCount: sample.h, missCount: sample.m, timeToType: sample.t })) hRecord[key] = sample;
    }
    const kRecord: Record<string, KeySampleRecord> = {};
    for (const [key, s] of k) kRecord[key] = { h: s.h, m: s.m, t: mean(s.time, s.timed), s: s.s };
    const rRecord: Record<string, ReachSample> = {};
    for (const [key, s] of r) rRecord[key] = { n: s.n, t: mean(s.time, s.n) };
    return {
        schema: RECORD_SCHEMA,
        profileId: input.profileId,
        l: 'custom',
        m: input.textType,
        ts: input.ts,
        n: stats.length,
        t: stats.time,
        e: stats.errors,
        h: hRecord,
        k: kRecord,
        r: rRecord,
        x: {
            type: input.type,
            scope: { ...DEFAULT_SCOPE, ...input.scope },
            target: input.target,
            src: input.src,
            obs,
            inf,
            board: input.board,
            os: input.os,
            km: input.km,
        },
    };
}

/** Result validity, as keybr's (§6.9): length ≥ 10, time ≥ 1 s, ≥ 3 distinct characters. */
export function isValidResult(record: ResultRecord): boolean {
    return new PracticeResult(record).validate();
}

// ---- Validation (import and stored data), in the style of keybr's resultFromJson.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const LESSON_TYPES: readonly LessonType[] = ['guided', 'drill', 'words', 'custom'];
const SOURCES: readonly InputSource[] = ['usb', 'host', 'keymap'];
const TEXT_TYPES = ['generated', 'natural', 'numbers'] as const;

function samples<T>(value: unknown, keyOk: (key: string) => boolean, read: (v: Record<string, unknown>) => T | null): Record<string, T> | null {
    if (!isObject(value)) return null;
    const out: Record<string, T> = {};
    for (const [key, raw] of Object.entries(value)) {
        if (!keyOk(key) || !isObject(raw)) return null;
        const sample = read(raw);
        if (!sample) return null;
        out[key] = sample;
    }
    return out;
}

function scopeFromJson(value: unknown): DrillScope | null {
    if (value === undefined) return { ...DEFAULT_SCOPE };
    if (!isObject(value)) return null;
    const list = (v: unknown) => (v === null || v === undefined ? null : Array.isArray(v) && v.every((s) => typeof s === 'string') ? (v as string[]) : undefined);
    const layer = value.layer === null || value.layer === undefined ? null : isCount(value.layer) ? value.layer : undefined;
    const group = value.group === null || value.group === undefined ? null : typeof value.group === 'string' ? value.group : undefined;
    const dirs = list(value.dirs), hands = list(value.hands);
    const thumbs = value.thumbs === undefined ? true : typeof value.thumbs === 'boolean' ? value.thumbs : undefined;
    if (layer === undefined || group === undefined || dirs === undefined || hands === undefined || thumbs === undefined) return null;
    return { layer, group, dirs, hands, thumbs };
}

/**
 * Validates a result record field by field; null when anything is malformed.
 * `schema` must be 1: a newer schema is the caller's read-only case (§8.6).
 */
export function resultRecordFromJson(json: unknown): ResultRecord | null {
    if (!isObject(json) || json.schema !== RECORD_SCHEMA) return null;
    const { profileId, l, m, ts, n, t, e, x } = json;
    if (typeof profileId !== 'string' || l !== 'custom' || !TEXT_TYPES.includes(m as never)) return null;
    if (!isTime(ts) || !isCount(n) || !isCount(t) || !isCount(e)) return null;
    const h = samples(json.h, (key) => parseSampleKey(key) != null,
        (v) => (isCount(v.h) && isCount(v.m) && isTime(v.t) ? { h: v.h, m: v.m, t: v.t } : null));
    const k = samples(json.k ?? {}, (key) => /^\d+@\d+$/.test(key),
        (v) => (isCount(v.h) && isCount(v.m) && isTime(v.t) && isCount(v.s ?? 0) ? { h: v.h, m: v.m, t: v.t, s: (v.s as number) ?? 0 } : null));
    const r = samples(json.r ?? {}, (key) => /^\d+$/.test(key),
        (v) => (isCount(v.n) && isTime(v.t) ? { n: v.n, t: v.t } : null));
    if (!h || !k || !r || !isObject(x)) return null;
    const scope = scopeFromJson(x.scope);
    if (!LESSON_TYPES.includes(x.type as never) || !scope || !isTime(x.target) || !SOURCES.includes(x.src as never)) return null;
    if (!isCount(x.obs ?? 0) || !isCount(x.inf ?? 0)) return null;
    for (const name of ['board', 'os', 'km'] as const) if (typeof x[name] !== 'string') return null;
    const record: ResultRecord = {
        schema: RECORD_SCHEMA, profileId, l, m: m as ResultRecord['m'], ts, n, t, e, h, k, r,
        x: {
            type: x.type as LessonType, scope, target: x.target, src: x.src as InputSource,
            obs: (x.obs as number) ?? 0, inf: (x.inf as number) ?? 0,
            board: x.board as string, os: x.os as string, km: x.km as string,
        },
    };
    if (isCount(json.id) && json.id > 0) record.id = json.id;
    return record;
}
