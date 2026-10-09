// A Practice session (spec §5.3, §6, §8): one profile's history on one keymap,
// with the current settings. It owns the keybr lesson and progress, generates
// lesson text, and turns a finished LessonRun into a stored result.
//
// The session is rebuilt, never mutated, when the keymap fingerprint, the
// profile or a lesson-shaping setting changes. Rebuilding replays the profile's
// results through the new lesson (or restores a snapshot when it still fits,
// §6.8), so a remap restarts only the characters whose path changed (§6.1).
// A long replay can be deferred and run in chunks that yield (seed(), §9.7).
// Nothing here touches React; usePracticeSession wires it to the UI.
import type { PracticeContent } from '../content/loader';
import { keymapFingerprint } from '../keymap/fingerprint';
import { type KeymapResolution, type KeymapSource, resolveKeymap } from '../keymap/resolver';
import { type SvalKeyboard, svalKeyboard } from '../keymap/svalKeyboard';
import { PracticeGuidedLesson } from '../lessons/guided';
import type { PracticeStore, StoredResult } from '../store/db';
import { pruneEvents, saveEvents } from '../store/events';
import { RECORD_SCHEMA } from '../store/migrations';
import { activeProfile } from '../store/profiles';
import { buildResultRecord, isValidResult, PracticeResult, resultRecordFromJson } from '../store/results';
import type { InputSource, LessonType, ProfileRecord, ResultRecord } from '../types';
import { Lesson, type LessonKey, type LessonKeys, Target } from '../vendor/keybr/lesson/index.ts';
import { type RNGStream } from '../vendor/keybr/rand/index.ts';
import type { KeyStatsMap } from '../vendor/keybr/result/index.ts';
import type { StyledText } from '../vendor/keybr/textinput/index.ts';
import { LessonRun } from './lessonRun';
import { Progress, SEED_CHUNK, snapshotIsUsable } from './progress';
import { effectiveLessonType, type PracticeSettings, toKeybrSettings } from './settings';
import type { KeyboardInfo } from '@/types/keyboard.types';

/** The keymap a session practices (§5.4 sources) and how Keybard reads it. */
export interface PracticeKeymap {
    board: KeyboardInfo;
    /** Keybard's OS layout id (internationalLayout). */
    layoutId: string;
    /** Default layer (the board's, or 0). */
    defaultLayer: number;
}

/** Everything loaded once per profile and reused when the session is rebuilt. */
export interface ProfileData {
    profile: ProfileRecord;
    /** Valid results, oldest first. */
    records: StoredResult[];
    /** A stored record has a newer schema: Practice is read-only (§8.6). */
    newerSchema: boolean;
}

/** The lesson events the status slot announces (§5.3). */
export type LessonEvent =
    | { type: 'new-key'; key: LessonKey }
    | { type: 'top-speed'; speed: number }
    | { type: 'daily-goal'; minutes: number };

export interface Completion {
    record: ResultRecord;
    /** keybr's validity rule (§6.9): an invalid lesson is not saved or counted. */
    valid: boolean;
    /** Written to the store. False when invalid, read-only or the write failed. */
    saved: boolean;
    /** The write failed (storage error). */
    storageError: boolean;
    events: LessonEvent[];
}

export interface CompletionMeta {
    ts: number;
    src: InputSource;
    board: string;
    os: string;
}

/** Last lesson's speed (CPM), accuracy (0–1) and score, with deltas against the previous 10 (§5.2). */
export interface LastLessonMetrics {
    speed: number;
    accuracy: number;
    score: number;
    deltas: { speed: number; accuracy: number; score: number } | null;
}

/** Loads a profile's results, skipping malformed ones and noting newer schemas (§8.6). */
export async function loadProfileData(store: PracticeStore, settings: Pick<PracticeSettings, 'activeProfileId'>): Promise<ProfileData> {
    const profile = await activeProfile(store, { activeId: settings.activeProfileId });
    const stored = await store.listResults(profile.id);
    let newerSchema = false;
    const records: StoredResult[] = [];
    for (const raw of stored) {
        if (typeof raw?.schema === 'number' && raw.schema > RECORD_SCHEMA) {
            newerSchema = true;
            continue;
        }
        const record = resultRecordFromJson(raw);
        if (record && record.id != null) records.push(record as StoredResult);
    }
    records.sort((a, b) => a.ts - b.ts || a.id - b.id);
    return { profile, records, newerSchema };
}

/** Builds the keymap resolution and its fingerprint (§9.4). */
export async function resolvePracticeKeymap(keymap: PracticeKeymap): Promise<{ resolution: KeymapResolution; fingerprint: string }> {
    const source: KeymapSource = { keymap: keymap.board.keymap ?? [], rows: keymap.board.rows, cols: keymap.board.cols };
    const resolution = resolveKeymap(source, { defaultLayer: keymap.defaultLayer, layoutId: keymap.layoutId });
    return { resolution, fingerprint: await keymapFingerprint(resolution) };
}

function lessonFor(type: LessonType, settings: PracticeSettings, keyboard: SvalKeyboard, content: PracticeContent): Lesson {
    switch (effectiveLessonType(type)) {
        default:
            // TODO(practice): M3 adds Drill, Words and Custom lessons.
            return new PracticeGuidedLesson(toKeybrSettings(settings), keyboard, content.model, content.words);
    }
}

const DAY = 24 * 60 * 60 * 1000;

/** Minutes typed today (local day), from result records. */
export function minutesToday(records: readonly Pick<ResultRecord, 'ts' | 't'>[], now = Date.now()): number {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const from = start.getTime();
    const to = from + DAY;
    let ms = 0;
    for (const r of records) if (r.ts >= from && r.ts < to) ms += r.t;
    return ms / 60_000;
}

export class PracticeSession {
    readonly keyboard: SvalKeyboard;
    readonly lesson: Lesson;
    readonly progress: Progress;
    /** Valid results of the profile as PracticeResults, oldest first, parallel to `data.records`. */
    readonly results: PracticeResult[];
    #lessonKeys: LessonKeys;
    #seeded = false;

    constructor(
        readonly store: PracticeStore,
        /** IndexedDB opened; false means progress lives in memory only (§5.3 Storage off). */
        readonly persistent: boolean,
        readonly content: PracticeContent,
        readonly keymap: PracticeKeymap,
        readonly resolution: KeymapResolution,
        readonly fingerprint: string,
        readonly settings: PracticeSettings,
        readonly data: ProfileData,
        snapshot?: Parameters<typeof snapshotIsUsable>[0],
        /** Leave a replay longer than one chunk to seed(), so it can yield (§9.7). */
        { deferSeed = false }: { deferSeed?: boolean } = {},
    ) {
        this.keyboard = svalKeyboard(keymap.board, resolution);
        this.lesson = lessonFor(settings.type, settings, this.keyboard, content);
        this.progress = new Progress(toKeybrSettings(settings), this.lesson);
        this.results = data.records.map((r) => new PracticeResult(r));
        if (snapshotIsUsable(snapshot, { resultCount: this.results.length, keymapFingerprint: fingerprint })) {
            this.progress.restore(snapshot, this.results);
            this.#seeded = true;
        } else if (!deferSeed || this.results.length <= SEED_CHUNK) {
            this.progress.seed(this.results);
            this.#seeded = true;
        }
        this.#lessonKeys = this.lesson.update(this.progress.keyStatsMap);
    }

    /** The history is replayed (or restored): the session can run lessons. */
    get seeded(): boolean {
        return this.#seeded;
    }

    /**
     * Finishes a deferred replay in chunks of SEED_CHUNK results, awaiting
     * `yieldToBrowser` after each so typing and painting go on (§6.8, §9.7).
     * Resolves false, unfinished, as soon as `current()` is false (a newer build).
     */
    async seed(yieldToBrowser: () => Promise<void>, current: () => boolean = () => true): Promise<boolean> {
        if (this.#seeded) return true;
        const replay = this.progress.seedAsync(this.results);
        while (!(await replay.next()).done) {
            await yieldToBrowser();
            if (!current()) return false;
        }
        this.#seeded = true;
        this.#lessonKeys = this.lesson.update(this.progress.keyStatsMap);
        return true;
    }

    get profile(): ProfileRecord {
        return this.data.profile;
    }

    get records(): readonly StoredResult[] {
        return this.data.records;
    }

    /** Lessons can't be saved: a newer Keybard wrote this profile (§8.6). */
    get readOnly(): boolean {
        return this.data.newerSchema;
    }

    get lessonKeys(): LessonKeys {
        return this.#lessonKeys;
    }

    get keyStatsMap(): KeyStatsMap {
        return this.progress.keyStatsMap;
    }

    get target(): Target {
        return new Target(toKeybrSettings(this.settings));
    }

    /** Lesson letters (the alphabet) in unlock order, as keybr's lesson orders them. */
    get alphabet(): readonly number[] {
        return [...this.#lessonKeys].map((k) => k.letter.codePoint);
    }

    /** First run: no results in the profile and Start never completed (§5.3). */
    get firstRun(): boolean {
        return !this.data.profile.startDone && this.data.records.length === 0;
    }

    /** Fewer than 6 language letters can be typed on this keymap (§5.3 No letters). */
    get noLetters(): boolean {
        return this.lesson.letters.length < 6;
    }

    generate(rng: RNGStream = Lesson.rng): StyledText {
        return this.lesson.generate(this.#lessonKeys, rng);
    }

    newRun(rng?: RNGStream): LessonRun {
        return new LessonRun({
            text: this.generate(rng),
            textInput: { stopOnError: this.settings.stopOnError, forgiveErrors: this.settings.forgiveErrors, spaceSkipsWords: this.settings.spaceSkipsWords },
            resolution: this.resolution,
            cols: this.keymap.board.cols,
        });
    }

    lastLesson(): LastLessonMetrics | null {
        const n = this.results.length;
        if (n === 0) return null;
        const last = this.results[n - 1];
        const previous = this.results.slice(Math.max(0, n - 11), n - 1);
        const avg = (pick: (r: PracticeResult) => number) => previous.reduce((sum, r) => sum + pick(r), 0) / previous.length;
        return {
            speed: last.speed,
            accuracy: last.accuracy,
            score: last.score,
            deltas: previous.length
                ? { speed: last.speed - avg((r) => r.speed), accuracy: last.accuracy - avg((r) => r.accuracy), score: last.score - avg((r) => r.score) }
                : null,
        };
    }

    minutesToday(now = Date.now()): number {
        return minutesToday(this.data.records, now);
    }

    /** Marks Start as done for the profile (§5.4); in memory when storage fails. */
    async completeStart(): Promise<boolean> {
        this.data.profile = { ...this.data.profile, startDone: true, lastUsedAt: Date.now() };
        if (this.readOnly) return false;
        try {
            await this.store.putProfile(this.data.profile);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Ends a lesson: builds its record, saves it (with its events, pruning old
     * ones, and a fresh snapshot), appends it to progress and reports the
     * banners it earns. Invalid lessons (§6.9) change nothing.
     */
    async complete(run: LessonRun, meta: CompletionMeta): Promise<Completion> {
        const record = buildResultRecord({
            profileId: this.data.profile.id,
            type: effectiveLessonType(this.settings.type),
            textType: 'generated',
            ts: meta.ts,
            steps: run.practiceSteps(),
            paused: run.pausedIntervals(),
            events: run.events,
            target: this.settings.targetSpeed,
            src: meta.src,
            board: meta.board,
            os: meta.os,
            km: this.fingerprint,
        });
        if (!isValidResult(record)) return { record, valid: false, saved: false, storageError: false, events: [] };

        const result = new PracticeResult(record);
        const before = new Set(this.#lessonKeys.findIncludedKeys().map((k) => k.letter.codePoint));
        const topSpeed = this.results.reduce((max, r) => Math.max(max, r.speed), 0);
        const minutesBefore = this.minutesToday(meta.ts);

        let saved = false;
        let storageError = false;
        let stored: StoredResult = { ...record, id: -(this.data.records.length + 1) };
        if (!this.readOnly) {
            try {
                const id = await this.store.addResult(record);
                stored = { ...record, id };
                await saveEvents(this.store, record.profileId, id, run.events);
                await pruneEvents(this.store, record.profileId);
                saved = true;
            } catch {
                storageError = true;
            }
        }
        this.data.records.push(stored);
        this.results.push(result);
        this.progress.append(result);
        this.#lessonKeys = this.lesson.update(this.progress.keyStatsMap);
        if (saved) {
            try {
                await this.store.putSnapshot(this.progress.snapshot(record.profileId, this.fingerprint));
            } catch {
                // A missing snapshot only means a replay next time (§6.8).
            }
        }

        const events: LessonEvent[] = [];
        for (const key of this.#lessonKeys.findIncludedKeys()) {
            if (!before.has(key.letter.codePoint)) events.push({ type: 'new-key', key });
        }
        // keybr announces a top speed from the fourth result on (event-source-top-speed.ts).
        if (this.results.length > 3 && result.speed > topSpeed) events.push({ type: 'top-speed', speed: result.speed });
        const goal = this.settings.dailyGoal;
        const minutesAfter = this.minutesToday(meta.ts);
        if (goal > 0 && minutesBefore < goal && minutesAfter >= goal) events.push({ type: 'daily-goal', minutes: goal });
        return { record, valid: true, saved, storageError, events };
    }
}
