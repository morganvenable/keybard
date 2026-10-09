import { describe, expect, it } from 'vitest';
import { keymapFingerprint } from '@/features/practice/keymap/fingerprint';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { svalKeyboard } from '@/features/practice/keymap/svalKeyboard';
import { PracticeGuidedLesson } from '@/features/practice/lessons/guided';
import { ENGINE_VERSION, Progress, snapshotIsUsable } from '@/features/practice/state/progress';
import {
    DEFAULT_SETTINGS,
    loadSettings,
    practiceSettings,
    saveSettings,
    SETTINGS_KEY,
    START_PRESETS,
    toKeybrSettings,
} from '@/features/practice/state/settings';
import { PracticeResult, sampleKey } from '@/features/practice/store/results';
import type { ResultRecord } from '@/features/practice/types';
import { lessonProps } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { textInputProps } from '@/features/practice/vendor/keybr/textinput/index.ts';
import { OWNER_Q1_DEFAULT_UNLOCK_ORDER } from '@/constants/owner-decisions';
import { appStorage } from '@/utils/app-storage';
import { svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

function setup() {
    const board = svalDefault();
    const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
    const settings = toKeybrSettings(DEFAULT_SETTINGS);
    const lesson = new PracticeGuidedLesson(settings, svalKeyboard(board, resolution), englishModel(), englishWords());
    return { settings, lesson, resolution };
}

function result(i: number): PracticeResult {
    const t = (base: number) => base + ((i * 37) % 50);
    const record: ResultRecord = {
        schema: 1, profileId: 'me', l: 'custom', m: 'generated', ts: 1_700_000_000_000 + i * 60_000, n: 120, t: 30_000, e: i % 3,
        h: {
            [sampleKey(0x61, '0:26:n')]: { h: 20, m: i % 2, t: t(300) },
            [sampleKey(0x73, '0:20:n')]: { h: 20, m: 0, t: t(280) },
            [sampleKey(0x64, '0:14:n')]: { h: 20, m: 0, t: t(260) },
            [sampleKey(0x66, '0:8:n')]: { h: 20, m: 0, t: t(240) },
        },
        k: {}, r: {},
        x: { type: 'guided', scope: { layer: null, group: null, dirs: null, hands: null, thumbs: true }, target: 175, src: 'keymap', obs: 0, inf: 80, board: 'example', os: 'us', km: 'x' },
    };
    return new PracticeResult(record);
}

describe('progress replay and snapshots (§6.8)', () => {
    it('seeds in chunks of 100 that yield', async () => {
        const { settings, lesson } = setup();
        const progress = new Progress(settings, lesson);
        const results = Array.from({ length: 250 }, (_, i) => result(i));
        const seen: number[] = [];
        for await (const _ of progress.seedAsync(results, (current) => seen.push(current))) { /* yield */ }
        expect(seen).toEqual([100, 200, 250]);
        expect(progress.resultCount).toBe(250);
    });

    it('a snapshot restores the same key stats as a full replay', async () => {
        const { settings, lesson, resolution } = setup();
        const results = Array.from({ length: 40 }, (_, i) => result(i));
        const replayed = new Progress(settings, lesson);
        replayed.seed(results);
        const km = await keymapFingerprint(resolution);
        const snapshot = JSON.parse(JSON.stringify(replayed.snapshot('me', km, 1)));

        expect(snapshotIsUsable(snapshot, { resultCount: 40, keymapFingerprint: km })).toBe(true);
        const restored = new Progress(settings, lesson);
        restored.restore(snapshot, results);
        expect([...restored.keyStatsMap].map((k) => [k.letter.codePoint, k.timeToType, k.bestTimeToType, k.samples.length]))
            .toEqual([...replayed.keyStatsMap].map((k) => [k.letter.codePoint, k.timeToType, k.bestTimeToType, k.samples.length]));
        expect(restored.summaryStats.speed).toEqual(replayed.summaryStats.speed);

        // A new lesson after a restore continues exactly as after a replay.
        const next = result(40);
        restored.append(next);
        replayed.append(next);
        expect([...restored.keyStatsMap].map((k) => k.timeToType)).toEqual([...replayed.keyStatsMap].map((k) => k.timeToType));
    });

    it('uses a snapshot only when result count, engine version and keymap fingerprint all match', () => {
        const snapshot = { schema: 1 as const, profileId: 'me', engineVersion: ENGINE_VERSION, resultCount: 3, keymapFingerprint: 'abc', keyStats: [], updatedAt: 0 };
        expect(snapshotIsUsable(snapshot, { resultCount: 3, keymapFingerprint: 'abc' })).toBe(true);
        expect(snapshotIsUsable(snapshot, { resultCount: 4, keymapFingerprint: 'abc' })).toBe(false);
        expect(snapshotIsUsable(snapshot, { resultCount: 3, keymapFingerprint: 'abd' })).toBe(false);
        expect(snapshotIsUsable({ ...snapshot, engineVersion: 'old' }, { resultCount: 3, keymapFingerprint: 'abc' })).toBe(false);
        expect(snapshotIsUsable(undefined, { resultCount: 0, keymapFingerprint: 'abc' })).toBe(false);
    });

    it('invalidates the snapshot on a remap (fingerprint change)', async () => {
        const { resolution } = setup();
        const board = svalDefault();
        board.keymap![0][26] = 0x08; // KC_E
        const remapped = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
        expect(await keymapFingerprint(remapped)).not.toBe(await keymapFingerprint(resolution));
    });
});

describe('Practice settings (§8.1)', () => {
    it('falls back per field', () => {
        expect(practiceSettings(null)).toEqual(DEFAULT_SETTINGS);
        expect(practiceSettings('x')).toEqual(DEFAULT_SETTINGS);
        const s = practiceSettings({ order: 'frequency', targetSpeed: 9999, alphabetSize: -1, dailyGoal: 'x', recoverKeys: true, customText: { content: 'a'.repeat(20_000), randomize: true } });
        expect(s.order).toBe('frequency');
        expect(s.targetSpeed).toBe(750);
        expect(s.alphabetSize).toBe(0);
        expect(s.dailyGoal).toBe(DEFAULT_SETTINGS.dailyGoal);
        expect(s.recoverKeys).toBe(true);
        expect(s.customText.content).toHaveLength(10_000);
        expect(s.customText).toMatchObject({ randomize: true, lowercase: true });
        expect(practiceSettings({ order: 'qwerty' }).order).toBe(OWNER_Q1_DEFAULT_UNLOCK_ORDER);
    });

    it('stores in appStorage under keybard.practice.v1', () => {
        saveSettings({ ...DEFAULT_SETTINGS, targetSpeed: 200 });
        expect(JSON.parse(appStorage.getItem(SETTINGS_KEY)!).targetSpeed).toBe(200);
        expect(loadSettings().targetSpeed).toBe(200);
        appStorage.setItem(SETTINGS_KEY, '{not json');
        expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
        appStorage.removeItem(SETTINGS_KEY);
    });

    it('maps to keybr settings', () => {
        const k = toKeybrSettings({ ...DEFAULT_SETTINGS, order: 'center-first', targetSpeed: 125, alphabetSize: 1, stopOnError: false });
        expect(k.get(lessonProps.guided.keyboardOrder)).toBe(true);
        expect(k.get(lessonProps.targetSpeed)).toBe(125);
        expect(k.get(lessonProps.guided.alphabetSize)).toBe(1);
        expect(k.get(textInputProps.stopOnError)).toBe(false);
        expect(toKeybrSettings({ ...DEFAULT_SETTINGS, order: 'frequency' }).get(lessonProps.guided.keyboardOrder)).toBe(false);
    });

    it('Start presets (§5.4): Learn 25 WPM with the OWNER_Q1 order, QWERTY all letters at 35 WPM, Drill 45 WPM', () => {
        expect(START_PRESETS.learn).toEqual({ order: OWNER_Q1_DEFAULT_UNLOCK_ORDER, targetSpeed: 125, alphabetSize: 0, dailyGoal: 15 });
        expect(START_PRESETS.qwerty).toEqual({ targetSpeed: 175, alphabetSize: 1, dailyGoal: 15 });
        expect(START_PRESETS.drill).toEqual({ targetSpeed: 225, dailyGoal: 10 });
    });
});
