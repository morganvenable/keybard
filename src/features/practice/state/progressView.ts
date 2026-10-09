// What the Progress page shows (spec §5.8): the profile's results in the chosen
// period, rolled up into the Summary, the Speed chart and the Characters table.
// Pure functions over a session, so the page and tests read the same numbers.
import { LearningRate, type LessonKey, type Lesson, Target } from '../vendor/keybr/lesson/index.ts';
import type { Letter } from '../vendor/keybr/phonetic-model/index.ts';
import { type KeyStats, makeKeyStatsMap, type KeyStatsMap, timeToSpeed } from '../vendor/keybr/result/index.ts';
import type { Path } from '../keymap/resolver';
import type { StoredResult } from '../store/db';
import { PracticeResult } from '../store/results';
import type { ProgressPeriod } from './settings';

const DAY = 24 * 60 * 60 * 1000;

/** First time stamp inside a period, or -Infinity for All. */
export function periodStart(period: ProgressPeriod, now = Date.now()): number {
    return period === 'all' ? -Infinity : now - Number(period) * DAY;
}

export function periodLabel(period: ProgressPeriod): string {
    return period === 'all' ? 'All time' : `Last ${period} days`;
}

/** One character's stats, as P5 and the Characters table show them. */
export interface CharacterStats {
    codePoint: number;
    label: string;
    path: Path | null;
    /** Filtered speed and best speed, CPM; null before 1 timed sample. */
    speed: number | null;
    best: number | null;
    /** Hits that weren't misses over all presses, 0–1; null without samples. */
    accuracy: number | null;
    /** Lessons with this character (keybr samples). */
    samples: number;
    /** Current confidence (target time / time to type); null before any timing. */
    confidence: number | null;
    bestConfidence: number | null;
    /** Calibrated: at least 3 samples (§5.2 strip). */
    calibrated: boolean;
    /** keybr's learning-rate forecast; null when r² < 0.5 or too little data. */
    remainingLessons: number | null;
    lastPracticed: number | null;
    keyStats: KeyStats;
}

export function characterStats(keyStats: KeyStats, target: Target, path: Path | null): CharacterStats {
    const { letter, samples, timeToType, bestTimeToType } = keyStats;
    let hits = 0, misses = 0, last: number | null = null;
    for (const s of samples) {
        hits += s.hitCount;
        misses += s.missCount;
        last = Math.max(last ?? 0, s.timeStamp);
    }
    const rate = samples.length ? LearningRate.from(samples, target) : null;
    return {
        codePoint: letter.codePoint,
        label: String.fromCodePoint(letter.codePoint),
        path,
        speed: timeToType ? timeToSpeed(timeToType) : null,
        best: bestTimeToType ? timeToSpeed(bestTimeToType) : null,
        accuracy: hits > 0 ? Math.max(0, hits - misses) / hits : null,
        samples: samples.length,
        confidence: timeToType ? target.confidence(timeToType) : null,
        bestConfidence: bestTimeToType ? target.confidence(bestTimeToType) : null,
        calibrated: samples.length >= 3,
        remainingLessons: rate && Number.isFinite(rate.remainingLessons) ? rate.remainingLessons : null,
        lastPracticed: last,
        keyStats,
    };
}

export interface SummaryView {
    lessons: number;
    /** Total typing time, ms. */
    time: number;
    /** CPM; 0 without lessons. */
    topSpeed: number;
    /** 0–1 average; null without lessons. */
    accuracy: number | null;
    keysAtTarget: number;
    alphabet: number;
}

export interface ChartPoint {
    /** Lesson index (1-based) or day start. */
    x: number;
    ts: number;
    /** CPM. */
    speed: number;
    /** 0–1. */
    accuracy: number;
    /** Lessons behind the point (1 per lesson; the day's count by Days). */
    count: number;
    type: string;
}

export interface PeriodView {
    records: readonly StoredResult[];
    results: readonly PracticeResult[];
    keyStatsMap: KeyStatsMap;
    summary: SummaryView;
    characters: CharacterStats[];
}

/** Results of a session inside a period, and everything the Progress page derives from them. */
export function periodView(
    lesson: Lesson,
    records: readonly StoredResult[],
    target: Target,
    pathOf: (codePoint: number) => Path | null,
    period: ProgressPeriod,
    now = Date.now(),
): PeriodView {
    const from = periodStart(period, now);
    const inPeriod = records.filter((r) => r.ts >= from);
    const results = inPeriod.map((r) => new PracticeResult(r));
    const keyStatsMap = makeKeyStatsMap(lesson.letters, lesson.filter(results));
    const characters = lesson.letters.map((letter: Letter) => characterStats(keyStatsMap.get(letter), target, pathOf(letter.codePoint)));
    const time = results.reduce((sum, r) => sum + r.time, 0);
    return {
        records: inPeriod,
        results,
        keyStatsMap,
        summary: {
            lessons: results.length,
            time,
            topSpeed: results.reduce((max, r) => Math.max(max, r.speed), 0),
            accuracy: results.length ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length : null,
            keysAtTarget: characters.filter((c) => (c.confidence ?? 0) >= 1).length,
            alphabet: characters.length,
        },
        characters,
    };
}

/** Speed chart points (§5.8): one per lesson, or one per local day (the day's average). */
export function chartPoints(records: readonly StoredResult[], results: readonly PracticeResult[], axis: 'lessons' | 'days'): ChartPoint[] {
    if (axis === 'lessons') {
        return results.map((r, i) => ({ x: i + 1, ts: r.timeStamp, speed: r.speed, accuracy: r.accuracy, count: 1, type: records[i]?.x.type ?? 'guided' }));
    }
    const days = new Map<number, { speed: number; accuracy: number; count: number; ts: number }>();
    for (const r of results) {
        const day = new Date(r.timeStamp);
        day.setHours(0, 0, 0, 0);
        const key = day.getTime();
        const d = days.get(key) ?? { speed: 0, accuracy: 0, count: 0, ts: key };
        d.speed += r.speed;
        d.accuracy += r.accuracy;
        d.count++;
        days.set(key, d);
    }
    return [...days.values()].sort((a, b) => a.ts - b.ts).map((d) => ({
        x: d.ts, ts: d.ts, speed: d.speed / d.count, accuracy: d.accuracy / d.count, count: d.count, type: '',
    }));
}

/** Lesson key strip order and states (§5.2): included first in unlock order, then locked. */
export interface StripKey {
    key: LessonKey;
    included: boolean;
    focused: boolean;
}

export function stripKeys(keys: Iterable<LessonKey>): StripKey[] {
    const list = [...keys];
    return [
        ...list.filter((k) => k.isIncluded).map((key) => ({ key, included: true, focused: key.isFocused })),
        ...list.filter((k) => !k.isIncluded).map((key) => ({ key, included: false, focused: false })),
    ];
}
