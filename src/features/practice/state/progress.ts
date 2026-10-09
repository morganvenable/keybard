// Progress: replay of a profile's results into key stats, summary, streaks and the
// daily goal (adapted from keybr's page-practice state/progress.ts; spec §6.8).
//
// Replay stays the source of truth. After each lesson a per-profile snapshot of
// the key stats is written; on load it is used only when the result count, the
// engine version and the keymap fingerprint all match. Otherwise Practice replays
// in chunks of 100 results that yield to the event loop.
import type { SnapshotRecord } from '../types';
import { type Lesson, MutableDailyGoal } from '../vendor/keybr/lesson/index.ts';
import {
    type KeySample,
    type KeyStatsMap,
    MutableKeyStatsMap,
    MutableStreakList,
    MutableSummaryStats,
    type Result,
} from '../vendor/keybr/result/index.ts';
import { type Settings } from '../vendor/keybr/settings/index.ts';
import { RECORD_SCHEMA } from '../store/migrations';

/** Vendored keybr commit + Practice adapter version; a change invalidates snapshots only (§8.6). */
export const ENGINE_VERSION = 'keybr@05a37bc+practice.1';

export const SEED_CHUNK = 100;

export class Progress {
    readonly #lesson: Lesson;
    readonly #results: Result[] = [];
    readonly #keyStatsMap: MutableKeyStatsMap;
    readonly #summaryStats = new MutableSummaryStats();
    readonly #streakList = new MutableStreakList();
    readonly #dailyGoal: MutableDailyGoal;
    #count = 0;

    constructor(settings: Settings, lesson: Lesson) {
        this.#lesson = lesson;
        this.#keyStatsMap = new MutableKeyStatsMap(lesson.letters);
        this.#dailyGoal = new MutableDailyGoal(settings);
    }

    /** Appends all results not yet seen (the list is append-only). */
    seed(results: readonly Result[]) {
        for (const result of results.slice(this.#count)) this.append(result);
    }

    /** As seed(), in chunks that yield to the browser between them. */
    async *seedAsync(results: readonly Result[], onProgress?: (current: number, total: number) => void) {
        while (this.#count < results.length) {
            for (const result of results.slice(this.#count, this.#count + SEED_CHUNK)) this.append(result);
            onProgress?.(this.#count, results.length);
            yield null;
        }
    }

    /** Appends one result. Results are filtered by the lesson first (current paths, §6.1). */
    append(result: Result) {
        const [filtered] = this.#lesson.filter([result]);
        this.#results.push(filtered);
        this.#keyStatsMap.append(filtered);
        this.#summaryStats.append(filtered);
        this.#streakList.append(filtered);
        this.#dailyGoal.append(filtered);
        this.#count++;
    }

    /**
     * Seeds from a snapshot: key stats from the saved samples, then summary,
     * streaks and the daily goal from the results (cheap; no per-letter work).
     */
    restore(snapshot: SnapshotRecord, results: readonly Result[]) {
        const samples = new Map<number, KeySample[]>(snapshot.keyStats.map((k) => [k.codePoint, k.samples]));
        this.#keyStatsMap.restore(samples, snapshot.resultCount);
        for (const result of results) {
            const [filtered] = this.#lesson.filter([result]);
            this.#results.push(filtered);
            this.#summaryStats.append(filtered);
            this.#streakList.append(filtered);
            this.#dailyGoal.append(filtered);
        }
        this.#count = results.length;
    }

    snapshot(profileId: string, keymapFingerprint: string, now = Date.now()): SnapshotRecord {
        return {
            schema: RECORD_SCHEMA,
            profileId,
            engineVersion: ENGINE_VERSION,
            resultCount: this.#count,
            keymapFingerprint,
            keyStats: [...this.#keyStatsMap].map((k) => ({
                codePoint: k.letter.codePoint,
                samples: k.samples.map((s) => ({ ...s })),
                timeToType: k.timeToType,
                bestTimeToType: k.bestTimeToType,
            })),
            updatedAt: now,
        };
    }

    get lesson() { return this.#lesson; }
    get resultCount() { return this.#count; }
    get results(): readonly Result[] { return this.#results; }
    get keyStatsMap(): KeyStatsMap { return this.#keyStatsMap.copy(); }
    get summaryStats() { return this.#summaryStats; }
    get streakList() { return this.#streakList; }
    get dailyGoal() { return this.#dailyGoal; }
}

/** A snapshot can replace replay only when all three match (§6.8). */
export function snapshotIsUsable(
    snapshot: SnapshotRecord | undefined | null,
    current: { resultCount: number; keymapFingerprint: string; engineVersion?: string },
): snapshot is SnapshotRecord {
    return !!snapshot
        && snapshot.schema === RECORD_SCHEMA
        && snapshot.resultCount === current.resultCount
        && snapshot.engineVersion === (current.engineVersion ?? ENGINE_VERSION)
        && snapshot.keymapFingerprint === current.keymapFingerprint;
}
