import { describe, expect, it } from 'vitest';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { LessonRun } from '@/features/practice/state/lessonRun';
import { buildResultRecord } from '@/features/practice/store/results';
import { Attr, Feedback, type TextInputSettings } from '@/features/practice/vendor/keybr/textinput/index.ts';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { svalDefault } from '../fixtures/boards';

// LessonRun records the outcome keybr's TextInput reached (spec §6.6, §8.2), for every Stop on error
// and Forgive errors combination: refused keystrokes, wrong characters kept in the text, and the
// skipped- and replaced-character recoveries.

const cp = (s: string) => s.codePointAt(0)!;
let clock = 0;
const key = (char: string): IInputEvent => ({ type: 'input', timeStamp: (clock += 200), inputType: 'appendChar', codePoint: cp(char), timeToType: 0 });
const backspace = (): IInputEvent => ({ type: 'input', timeStamp: (clock += 200), inputType: 'clearChar', codePoint: 0, timeToType: 0 });

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });

function run(text: string, settings: Partial<TextInputSettings>) {
    clock = 0;
    return new LessonRun({
        text,
        textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false, ...settings },
        resolution,
        cols: board.cols,
    });
}

function type(r: LessonRun, keys: string) {
    return [...keys].map((k) => r.onInput(k === '⌫' ? backspace() : key(k)));
}

const summary = (r: LessonRun) => r.events.map((e) => `${e.kind}:${String.fromCodePoint(e.expected)}${e.typed == null ? '' : `/${String.fromCodePoint(e.typed)}`}`);

describe('LessonRun outcomes (§6.6)', () => {
    it('Stop on error off: a wrong character stays in the text as garbage and is a miss', () => {
        const r = run('asdf', { stopOnError: false, forgiveErrors: false });
        type(r, 'ax');
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s/x']);
        expect(r.events[1].errorClass).toBeDefined();
        expect(r.textInput.chars.some((c) => (c.attrs & Attr.Garbage) !== 0)).toBe(true);
        expect(r.typoPending).toBe(true);
        type(r, '⌫s');
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s/x', 'backspace:s', 'hit:s/s']);
        expect(r.textInput.pos).toBe(2);
        expect(r.typoPending).toBe(false);
    });

    it('Forgive errors off: the right character is refused while garbage waits, and is a miss with no class', () => {
        const r = run('asdf', { stopOnError: false, forgiveErrors: false });
        const [, , refused] = type(r, 'axs');
        expect(refused.feedback).toBe(Feedback.Failed);
        expect(r.textInput.pos).toBe(1);
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s/x', 'miss:s/s']);
        expect(r.events[2]).toMatchObject({ ttt: null, errorClass: undefined });
        // Two backspaces delete both waiting characters; then s goes in.
        type(r, '⌫⌫s');
        expect(r.textInput.pos).toBe(2);
        expect(r.events.at(-1)).toMatchObject({ kind: 'hit', expected: cp('s') });
    });

    it('Forgive errors, skipped character: the waiting keystrokes become hits and the skipped one a miss with nothing typed', () => {
        const r = run('asdfg', { stopOnError: true, forgiveErrors: true });
        const outcomes = type(r, 'adfg');
        expect(outcomes.at(-1)!.feedback).toBe(Feedback.Recovered);
        expect(r.textInput.completed).toBe(true);
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s', 'hit:d/d', 'hit:f/f', 'hit:g/g']);
        expect(r.events[1]).toMatchObject({ typed: null, path: resolution.primary(cp('s'))!.key });
        expect(r.events[1].errorClass).toBeUndefined();
        for (const e of r.events.filter((x) => x.kind === 'hit')) {
            expect(e.path).toBe(resolution.primary(e.expected)!.key);
            expect(e.errorClass).toBeUndefined();
        }
        // Events and steps agree: one miss on s, a hit on every other key.
        expect(r.textInput.steps.map((s) => s.typo)).toEqual([false, true, false, false, false]);
        const record = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1, steps: r.practiceSteps(), paused: [], events: r.events,
            target: 175, src: 'keymap', board: 'example', os: 'us', km: 'x',
        });
        const s = resolution.primary(cp('s'))!;
        expect(record.k[`${s.index}@${s.layer}`]).toMatchObject({ h: 0, m: 1 });
        const d = resolution.primary(cp('d'))!;
        expect(record.k[`${d.index}@${d.layer}`]).toMatchObject({ h: 1, m: 0 });
    });

    it('Forgive errors, replaced character: the wrong keystroke stays the miss, the rest become hits', () => {
        const r = run('asdfg', { stopOnError: true, forgiveErrors: true });
        type(r, 'axdfg');
        expect(r.textInput.completed).toBe(true);
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s/x', 'hit:d/d', 'hit:f/f', 'hit:g/g']);
        expect(r.events[1].errorClass).toBeDefined();
        expect(r.events.slice(2).every((e) => e.ttt != null && e.ttt > 0)).toBe(true);
    });

    it('a backspace forgets the last waiting keystroke, so no recovery rewrites it', () => {
        const r = run('asdfg', { stopOnError: true, forgiveErrors: true });
        type(r, 'ad⌫s');
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s/d', 'backspace:s', 'hit:s/s']);
        type(r, 'dfg');
        expect(r.events.slice(-3).map((e) => e.kind)).toEqual(['hit', 'hit', 'hit']);
    });

    it('Space skips the word: one miss on the character it left', () => {
        const r = run('asd fg', { spaceSkipsWords: true });
        type(r, 'a ');
        expect(summary(r)).toEqual(['hit:a/a', 'miss:s/ ']);
        expect(r.textInput.pos).toBe(4);
        expect(r.typoPending).toBe(false);
    });
});
