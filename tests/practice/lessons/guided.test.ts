import { describe, expect, it } from 'vitest';
import { OWNER_Q1_DEFAULT_UNLOCK_ORDER } from '@/constants/owner-decisions';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { svalKeyboard, TIER_WEIGHTS } from '@/features/practice/keymap/svalKeyboard';
import { PracticeGuidedLesson } from '@/features/practice/lessons/guided';
import { DEFAULT_SETTINGS, toKeybrSettings, type PracticeSettings } from '@/features/practice/state/settings';
import { buildResultRecord, PracticeResult, type PracticeStep } from '@/features/practice/store/results';
import { LessonKeys } from '@/features/practice/vendor/keybr/lesson/index.ts';
import { Letter } from '@/features/practice/vendor/keybr/phonetic-model/index.ts';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import { makeKeyStatsMap, speedToTime } from '@/features/practice/vendor/keybr/result/index.ts';
import type { KeystrokeEvent } from '@/features/practice/types';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';
import { englishModel, englishWords } from '../fixtures/content';

function lessonFor(board = svalDefault(), settings: Partial<PracticeSettings> = {}) {
    const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
    const keyboard = svalKeyboard(board, resolution);
    const s = { ...DEFAULT_SETTINGS, ...settings };
    return { lesson: new PracticeGuidedLesson(toKeybrSettings(s), keyboard, englishModel(), englishWords()), keyboard, resolution, settings: s };
}

const letters = (keys: LessonKeys) => keys.findIncludedKeys().map((k) => String.fromCodePoint(k.letter.codePoint)).join('');

/** A one-lesson result where every listed letter was typed at `ms` per character. */
function resultAt(lesson: PracticeGuidedLesson, chars: string, ms: number, ts: number) {
    const events: KeystrokeEvent[] = [];
    const steps: PracticeStep[] = [];
    let t = 0;
    // A leading trigger step, which keybr ignores, so every listed letter gets three samples.
    for (const ch of chars[0] + chars.repeat(3)) {
        const c = ch.codePointAt(0)!;
        const path = lesson.resolution.primary(c)!;
        events.push({
            t, expected: c, typed: c, kind: 'hit', raw: ms, ttt: t === 0 ? null : ms, path: path.key, prereq: [],
            phys: { index: path.index, layer: path.layer, confidence: 'inferred', skew: null, reach: null, target: null },
        });
        steps.push({ timeStamp: t, codePoint: c, timeToType: t === 0 ? 0 : ms, typo: false, path: path.key });
        t += ms;
    }
    return new PracticeResult(buildResultRecord({
        profileId: 'me', type: 'guided', textType: 'generated', ts, steps, events,
        target: 175, src: 'keymap', board: 'example', os: 'us', km: 'test',
    }));
}

describe('Guided unlock order on sval-default.svil (§6.3, M1a acceptance)', () => {
    it('defaults new profiles to OWNER_Q1', () => {
        expect(DEFAULT_SETTINGS.order).toBe(OWNER_Q1_DEFAULT_UNLOCK_ORDER);
    });

    it('Center first: starts with 6 center letters, the 7th unlock is j and the 8th e', () => {
        const { lesson } = lessonFor(undefined, { order: 'center-first' });
        const fresh = lesson.update(makeKeyStatsMap(lesson.letters, []));
        expect([...letters(fresh)].sort().join('')).toBe('adfkls');

        // Every included letter at target once: one more unlocks.
        const fast = speedToTime(175) * 0.8;
        const results = [resultAt(lesson, 'adfkls', fast, 1)];
        const seventh = lesson.update(makeKeyStatsMap(lesson.letters, lesson.filter(results)));
        expect(letters(seventh)).toHaveLength(7);
        expect(letters(seventh)).toContain('j');

        results.push(resultAt(lesson, 'adfklsj', fast, 2));
        const eighth = lesson.update(makeKeyStatsMap(lesson.letters, lesson.filter(results)));
        expect(letters(eighth)).toHaveLength(8);
        expect(letters(eighth)).toContain('e');
    });

    it('Center first orders letters by tier, then frequency', () => {
        const { lesson, keyboard } = lessonFor(undefined, { order: 'center-first' });
        const codePoints = keyboard.getCodePoints();
        const ordered = Letter.weightedFrequencyOrder(lesson.letters, ({ codePoint }) => codePoints.weight(codePoint))
            .map((l) => String.fromCodePoint(l.codePoint)).join('');
        expect(ordered.slice(0, 7)).toMatch(/^[adfkls]{6}j$/);
        expect(new Set(ordered.slice(7, 20))).toEqual(new Set('eoiurcmwpvxqz'));
        expect(ordered[7]).toBe('e');
        expect(new Set(ordered.slice(20))).toEqual(new Set('tnhygb'));
    });

    it('Frequency starts with the most frequent letters, mixing every direction', () => {
        // keybr's English model ranks e n i a r l first (the spec guessed "e t a o i n").
        const { lesson } = lessonFor(undefined, { order: 'frequency' });
        const fresh = lesson.update(makeKeyStatsMap(lesson.letters, []));
        expect(new Set(letters(fresh))).toEqual(new Set('eniarl'));
    });

    it('the QWERTY preset (alphabetSize 1) includes every letter', () => {
        const { lesson } = lessonFor(undefined, { alphabetSize: 1 });
        expect(letters(lesson.update(makeKeyStatsMap(lesson.letters, [])))).toHaveLength(26);
    });

    it('generates text from included letters, every word containing the focused letter', () => {
        const { lesson } = lessonFor(undefined, { order: 'center-first' });
        const keys = lesson.update(makeKeyStatsMap(lesson.letters, []));
        const focused = String.fromCodePoint(keys.findFocusedKey()!.letter.codePoint);
        const text = String(lesson.generate(keys, LCG(1)));
        expect(text.length).toBeGreaterThanOrEqual(100);
        for (const word of text.split(' ')) {
            expect(word).toMatch(/^[adfkls]+$/);
            expect(word).toContain(focused);
        }
    });
});

describe('Svalboard tiers (§6.3)', () => {
    it('weighs center 1, N/S 2, E/W 3, thumb 5, layered 10 + 10 per prerequisite', () => {
        const { keyboard } = lessonFor();
        const w = keyboard.getCodePoints();
        const cp = (s: string) => s.codePointAt(0)!;
        expect(w.weight(cp('a'))).toBe(TIER_WEIGHTS.C);
        expect(w.weight(cp('e'))).toBe(TIER_WEIGHTS.N);
        expect(w.weight(cp('c'))).toBe(TIER_WEIGHTS.S);
        expect(w.weight(cp('t'))).toBe(TIER_WEIGHTS.E);
        expect(w.weight(0x20)).toBe(TIER_WEIGHTS.thumb);
        expect(w.weight(cp('!'))).toBe(20);
        expect(w.weight(cp('A'))).toBe(20);
        expect(keyboard.getCombo(cp('!'))).toMatchObject({ layer: 1, shiftSource: 'f', id: 'm27' });
        expect(keyboard.getShape('m26')?.homing).toBe(true);
    });
});

describe('Lesson.filter by path key (§6.1)', () => {
    it('a remap restarts only the remapped letter; switching back restores it', () => {
        const before = lessonFor();
        const fast = speedToTime(175) * 0.8;
        const results = [resultAt(before.lesson, 'adfkls', fast, 1)];
        const statsBefore = makeKeyStatsMap(before.lesson.letters, before.lesson.filter(results));
        const letterOf = (lesson: PracticeGuidedLesson, ch: string) => lesson.letters.find((l) => l.codePoint === ch.codePointAt(0))!;
        expect(statsBefore.get(letterOf(before.lesson, 'a')).timeToType).not.toBeNull();

        // Swap a and e: index 26 now types e, index 15 types a.
        let swapped = rebind(svalDefault(), 0, 26, keyService.parse('KC_E'));
        swapped = rebind(swapped, 0, 15, keyService.parse('KC_A'));
        const after = lessonFor(swapped);
        const statsAfter = makeKeyStatsMap(after.lesson.letters, after.lesson.filter(results));
        expect(statsAfter.get(letterOf(after.lesson, 'a')).timeToType).toBeNull();
        expect(statsAfter.get(letterOf(after.lesson, 's')).timeToType).toBe(statsBefore.get(letterOf(before.lesson, 's')).timeToType);

        const back = lessonFor();
        const statsBack = makeKeyStatsMap(back.lesson.letters, back.lesson.filter(results));
        expect(statsBack.get(letterOf(back.lesson, 'a')).timeToType).toBe(statsBefore.get(letterOf(before.lesson, 'a')).timeToType);
    });

    it('a duplicate key restarts nothing', () => {
        const before = lessonFor();
        const results = [resultAt(before.lesson, 'adfkls', 300, 1)];
        const dup = lessonFor(rebind(svalDefault(), 0, 49, keyService.parse('KC_A')));
        const stats = makeKeyStatsMap(dup.lesson.letters, dup.lesson.filter(results));
        expect(stats.get(dup.lesson.letters.find((l) => l.codePoint === 0x61)!).timeToType).not.toBeNull();
    });
});
