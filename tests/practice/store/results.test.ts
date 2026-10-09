import { describe, expect, it } from 'vitest';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { buildResultRecord, sampleKey, type PracticeStep } from '@/features/practice/store/results';
import { makeStats, TextInput, textInputSettings } from '@/features/practice/vendor/keybr/textinput/index.ts';
import { svalDefault } from '../fixtures/boards';

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const pathOf = (c: number) => resolution.primary(c)?.key ?? '';

/** Types `typed` into a TextInput over `text` at 200 ms per keystroke; returns its steps with paths. */
function lesson(text: string, typed: string, settings = textInputSettings) {
    const input = new TextInput(text, settings);
    let t = 0;
    for (const ch of typed) {
        input.appendChar(t, ch.codePointAt(0)!, t === 0 ? 0 : 200);
        t += 200;
    }
    // Keymap only: a typed position's path is the primary path of its character,
    // and a forgiven position's is the expected character's.
    const steps: PracticeStep[] = input.steps.map((s) => ({ ...s, path: pathOf(s.codePoint) }));
    const record = buildResultRecord({
        profileId: 'me', type: 'guided', textType: 'generated', ts: 1, steps, events: [],
        target: 175, src: 'keymap', board: 'example', os: 'us', km: '',
    });
    return { steps, record };
}

const at = (record: ReturnType<typeof lesson>['record'], ch: string) => record.h[sampleKey(ch.codePointAt(0)!, pathOf(ch.codePointAt(0)!))];
const totalMisses = (record: ReturnType<typeof lesson>['record']) => Object.values(record.h).reduce((sum, s) => sum + s.m, 0);

describe('result records follow keybr\'s steps under forgiveErrors (§6.6)', () => {
    it('charges a skipped character, and nothing else, with the miss', () => {
        // The user skips 'a': b, c, d are garbage until keybr recovers.
        const { steps, record } = lesson('xabcdef', 'xbcdef');
        expect(steps.map((s) => [String.fromCodePoint(s.codePoint), s.typo])).toEqual([
            ['x', false], ['a', true], ['b', false], ['c', false], ['d', false], ['e', false], ['f', false],
        ]);
        expect(at(record, 'a')).toEqual({ h: 1, m: 1, t: 0 });
        for (const ch of 'bcdef') expect(at(record, ch)).toEqual({ h: 1, m: 0, t: 200 });
        expect(record.e).toBe(makeStats(steps).errors);
        expect(totalMisses(record)).toBe(record.e);
    });

    it('charges a replaced character, and never the typed one', () => {
        // The user types 'q' for 'a', then carries on.
        const { record } = lesson('xabcde', 'xqbcde');
        expect(at(record, 'a')).toEqual({ h: 1, m: 1, t: 0 });
        expect(at(record, 'q')).toBeUndefined();
        for (const ch of 'bcde') expect(at(record, ch)).toEqual({ h: 1, m: 0, t: 200 });
        expect(totalMisses(record)).toBe(record.e);
    });

    it('charges every character Space skipped', () => {
        const { steps, record } = lesson('xab cd', 'x cd', { ...textInputSettings, spaceSkipsWords: true });
        expect(steps).toHaveLength(6);
        expect(at(record, 'a')).toEqual({ h: 1, m: 1, t: 0 });
        expect(at(record, 'b')).toEqual({ h: 1, m: 1, t: 0 });
        expect(at(record, ' ')).toEqual({ h: 1, m: 0, t: 0 });
        expect(record.e).toBe(2);
        expect(totalMisses(record)).toBe(record.e);
    });

    it('matches keybr\'s histogram, character by character', () => {
        const { steps, record } = lesson('xabcdefgh', 'xqbcdeffgh');
        const keybr = makeStats(steps, { maxGap: 2000 }).histogram;
        for (const sample of keybr) {
            expect(record.h[sampleKey(sample.codePoint, pathOf(sample.codePoint))]).toEqual({
                h: sample.hitCount, m: sample.missCount, t: sample.timeToType,
            });
        }
        expect(Object.keys(record.h)).toHaveLength(keybr.complexity);
    });
});
