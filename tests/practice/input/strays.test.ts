import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveKeymap, strayPresses } from '@/features/practice/input/correlate';
import { LiveInput } from '@/features/practice/input/liveInput';
import { MatrixHistory, matrixToDown } from '@/features/practice/input/usbSampler';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { LessonRun } from '@/features/practice/state/lessonRun';
import { packEvents, unpackEvents } from '@/features/practice/store/pack';
import { buildResultRecord, keySampleKey } from '@/features/practice/store/results';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';
import { COLS, FakeBoard, frame, ROWS } from './fakeBoard';

// Stray presses (spec §6.6, §9.3, M4): character-producing presses that no step used, recorded against the
// key pressed so the heatmap's Errors metric shows keys hit by mistake.

const cp = (s: string) => s.codePointAt(0)!;
const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const keymap = new LiveKeymap(resolution, board.keymap!, board.rows, board.cols);
const at = (ch: string) => resolution.primary(cp(ch))!.index;
const A = at('a'), S = at('s'), X = at('x'), Q = 27, SHIFT = 2;

function history(samples: [number, number[]][]): MatrixHistory {
    const h = new MatrixHistory(ROWS * COLS);
    h.addMasks(0, 1, 1);
    for (const [t, down] of samples) h.addSample(t, t, matrixToDown(frame(down), ROWS, COLS));
    return h;
}

const input = (ch: string, timeStamp: number): IInputEvent => ({ type: 'input', timeStamp, inputType: 'appendChar', codePoint: cp(ch), timeToType: 0 });

function lesson(text: string) {
    return new LessonRun({ text, textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false }, resolution, cols: board.cols });
}

describe('strayPresses (§6.6)', () => {
    it('finds only unused character presses inside (from, upTo]', () => {
        const h = history([[0, []], [10, [A]], [20, []], [30, [X]], [40, []], [50, [SHIFT]], [60, []], [70, [S]], [80, []]]);
        const strays = strayPresses(h, keymap, new Set(), 100, 20);
        expect(strays.map((s) => [s.index, String.fromCodePoint(s.char), s.layer, s.shift])).toEqual([[X, 'x', 0, 'n'], [S, 's', 0, 'n']]);
        // Consumed edges never count, and nothing after upTo.
        const consumed = new Set(strays.filter((s) => s.index === X).map((s) => s.edge.id));
        expect(strayPresses(h, keymap, consumed, 75, 20).map((s) => s.index)).toEqual([S]);
        expect(strayPresses(h, keymap, new Set(), 50, 20).map((s) => s.index)).toEqual([X]);
    });

    it('applies a one-shot layer tapped before the press, and only to that press', () => {
        const OSL1 = 33;
        const osl = rebind(board, 0, OSL1, keyService.parse('OSL(1)'));
        const oslKeymap = new LiveKeymap(resolveKeymap({ keymap: osl.keymap!, rows: osl.rows, cols: osl.cols }), osl.keymap!, osl.rows, osl.cols);
        const h = history([[0, []], [10, [OSL1]], [20, []], [30, [Q]], [40, []], [50, [Q]], [60, []]]);
        const strays = strayPresses(h, oslKeymap, new Set(), 100, 0);
        expect(strays.map((s) => [String.fromCodePoint(s.char), s.layer])).toEqual([['!', 1], ['q', 0]]);
    });
});

describe('LessonRun stray events', () => {
    it('keeps strays apart from keystrokes and merges them in time order', () => {
        const run = lesson('asd');
        run.onInput(input('a', 100));
        run.addStray({ t: 150, expected: cp('s'), typed: cp('x'), index: X, layer: 0, shift: 'n' });
        run.onInput(input('s', 200));
        run.addStray({ t: 120, expected: cp('s'), typed: cp('q'), index: Q, layer: 0, shift: 'n' });
        expect(run.events.map((e) => e.kind)).toEqual(['hit', 'hit']);
        const merged = run.recordedEvents();
        expect(merged.map((e) => [e.kind, e.t])).toEqual([['hit', 0], ['stray', 20], ['stray', 50], ['hit', 100]]);
        expect(merged[2]).toMatchObject({ typed: cp('x'), expected: cp('s'), path: '', phys: { index: X, layer: 0, confidence: 'observed', shift: 'n' } });
    });

    it('ignores a stray before the first keystroke', () => {
        const run = lesson('asd');
        run.addStray({ t: 10, expected: cp('a'), typed: cp('x'), index: X, layer: 0, shift: 'n' });
        expect(run.recordedEvents()).toEqual([]);
    });

    it('stray events round-trip through the packed layout and count on the pressed key in the result', () => {
        const run = lesson('asdfjkl');
        let t = 100;
        for (const ch of 'asdfjkl') {
            run.onInput(input(ch, t));
            if (ch === 'd') run.addStray({ t: t + 40, expected: cp('f'), typed: cp('x'), index: X, layer: 0, shift: 'n' });
            t += 300;
        }
        const events = run.recordedEvents();
        const unpacked = unpackEvents(packEvents(events));
        const stray = unpacked.find((e) => e.kind === 'stray')!;
        expect(stray).toMatchObject({ expected: cp('f'), typed: cp('x'), phys: { index: X, layer: 0, confidence: 'observed', shift: 'n' } });
        // Strays don't move the hits' raw times.
        expect(unpacked.filter((e) => e.kind === 'hit').map((e) => e.raw)).toEqual(run.events.map((e, i) => (i === 0 ? 0 : 300)));
        const record = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1, steps: run.practiceSteps(), events,
            target: 175, src: 'usb', board: 'example', os: 'us', km: 'x',
        });
        expect(record.k[keySampleKey(X, 0)]).toMatchObject({ h: 0, m: 0, s: 1 });
    });
});

describe('LiveInput records strays (§6.6)', () => {
    let live: LiveInput | null = null;
    afterEach(() => { live?.dispose(); live = null; });

    it('an extra letter pressed between two steps is a stray against the key pressed; Shift is not', async () => {
        const fake = new FakeBoard();
        live = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep });
        live.setKeymap({ resolution, keymap: board.keymap!, rows: board.rows, cols: board.cols });
        const run = lesson('asa');
        live.bindRun(run);
        live.setWanted(true);
        const type = (ch: string, t: number) => {
            const outcome = run.onInput(input(ch, t));
            if (outcome.keystroke) live!.enqueue(outcome.keystroke);
        };
        await fake.reply([], 10);
        await fake.reply([A], 20);
        type('a', 16);
        await fake.reply([], 40);
        await fake.reply([X], 60); // a stray x, nothing typed for it
        await fake.reply([], 80);
        await fake.reply([SHIFT], 100); // Shift alone: never a stray
        await fake.reply([], 120);
        await fake.reply([S], 140);
        type('s', 136);
        await fake.reply([], 200);
        await fake.reply([], 240); // ts 220: past 136 + ε
        await vi.waitFor(() => expect(run.events.every((e) => e.phys.confidence === 'observed')).toBe(true));
        expect(run.strays.map((e) => [e.phys.index, String.fromCodePoint(e.typed!), String.fromCodePoint(e.expected)])).toEqual([[X, 'x', 's']]);
        // The press used for s is never a stray, and neither is the first step's.
        await fake.reply([A], 260); // ts 250
        type('a', 252);
        await fake.reply([], 300);
        await fake.reply([], 340);
        await vi.waitFor(() => expect(run.textInput.completed).toBe(true));
        await live.settle();
        expect(run.strays.length).toBe(1);
    });
});
