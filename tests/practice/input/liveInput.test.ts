import { afterEach, describe, expect, it, vi } from 'vitest';
import { attributeStep, LiveKeymap } from '@/features/practice/input/correlate';
import { LAYER_LOCK_MS, LiveInput, WRONG_KEY_HOLD_MS } from '@/features/practice/input/liveInput';
import { MatrixHistory, matrixToDown } from '@/features/practice/input/usbSampler';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { LessonRun } from '@/features/practice/state/lessonRun';
import { buildResultRecord } from '@/features/practice/store/results';
import { keyService } from '@/services/key.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import type { IInputEvent } from '@/features/practice/vendor/keybr/textinput-events/index.ts';
import { rebind, svalDefault } from '../fixtures/boards';
import { COLS, FakeBoard, frame, ROWS, settle } from './fakeBoard';

// Live · USB wired to a lesson (spec §5.2, §5.3, §6.5, §9.3): keystrokes attributed into the LessonRun
// once the sampler has seen past them, the lesson timed again from press edges, the board's change-only
// state (pressed, wrong keys, live layer), and Layer locked on.

const cp = (s: string) => s.codePointAt(0)!;
const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const at = (ch: string) => resolution.primary(cp(ch))!.index;
const A = at('a'), S = at('s'), Q = 27, MO1 = 32;

const input = (ch: string, timeStamp: number): IInputEvent => ({ type: 'input', timeStamp, inputType: 'appendChar', codePoint: cp(ch), timeToType: 0 });

function lesson(text: string) {
    return new LessonRun({ text, textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false }, resolution, cols: board.cols });
}

function liveInput(fake: FakeBoard, kb: KeyboardInfo = board) {
    const live = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep });
    const r = kb === board ? resolution : resolveKeymap({ keymap: kb.keymap!, rows: kb.rows, cols: kb.cols });
    live.setKeymap({ resolution: r, keymap: kb.keymap!, rows: kb.rows, cols: kb.cols });
    return live;
}

/** Types a character into the run and hands the keystroke to the reader, as the controller does. */
function type(run: LessonRun, live: LiveInput, ch: string, t: number) {
    const outcome = run.onInput(input(ch, t));
    if (outcome.keystroke) live.enqueue(outcome.keystroke);
    return outcome;
}

let current: LiveInput | null = null;
afterEach(() => {
    current?.dispose();
    current = null;
    vi.useRealTimers();
});

describe('LiveInput: attribution into the lesson', () => {
    it('attributes a keystroke once the sampler has seen ε past it, as an observed hit', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('asa');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10); // ts 5, baseline
        await fake.reply([A], 20); // ts 15: the a press
        type(run, live, 'a', 16);
        expect(run.events[0].phys.confidence).toBe('inferred');
        await fake.reply([], 30); // ts 25
        await fake.reply([], 60); // ts 45 < 16 + 40
        expect(run.events[0].phys.confidence).toBe('inferred');
        await fake.reply([], 80); // ts 70
        expect(run.events[0].phys).toMatchObject({ confidence: 'observed', index: A, layer: 0, skew: -1 });
        expect(run.observed).toBe(1);
    });

    it('settle() waits for the last keystroke, then the record says usb with observed hits and edge timing', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('a!!');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([A], 20); // ts 15
        type(run, live, 'a', 16);
        await fake.reply([], 100); // ts 60
        await fake.reply([MO1], 200); // ts 150: MO(1) down
        await fake.reply([MO1, Q], 220); // ts 210: ! press
        type(run, live, '!', 212);
        await fake.reply([MO1], 300); // ts 260
        await fake.reply([MO1, Q], 320); // ts 310: second !, MO(1) still held
        type(run, live, '!', 311);
        const settled = live.settle();
        await fake.reply([MO1], 400); // ts 360 ≥ 311 + 40
        await settled;
        expect(run.events.every((e) => e.phys.confidence === 'observed')).toBe(true);
        const steps = run.practiceSteps();
        expect(steps.map((s) => s.path)).toEqual(['0:26:n', '1:27:f', '1:27:f']);
        // The hold counts on the first ! only: 210 − 16 over 2 presses, then 311 − 212 over 1 (§6.5).
        expect(run.events[1]).toMatchObject({ raw: 196, ttt: 98, prereq: [MO1] });
        expect(run.events[1].phys.reach).toBe(150 - 16);
        expect(run.events[1].phys.target).toBe(210 - 150);
        expect(run.events[2]).toMatchObject({ raw: 99, ttt: 99, prereq: [] });
        const record = buildResultRecord({
            profileId: 'me', type: 'guided', textType: 'generated', ts: 1, steps, paused: [], events: run.events,
            target: 175, src: run.observed ? 'usb' : 'keymap', board: 'sval', os: 'us', km: 'x',
        });
        expect(record.x).toMatchObject({ src: 'usb', obs: 3, inf: 0 });
        expect(record.r[String(MO1)]).toEqual({ n: 1, t: 134 });
    });

    it('stopping reads attributes what is queued from the history there is', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('as');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([A], 20);
        type(run, live, 'a', 16);
        live.setWanted(false);
        expect(run.events[0].phys.confidence).toBe('observed');
        expect(live.running).toBe(false);
        expect(live.getBoard().pressed.size).toBe(0);
    });

    it('a keystroke typed while not reading stays inferred', () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('as');
        live.bindRun(run);
        type(run, live, 'a', 16);
        expect(run.events[0].phys.confidence).toBe('inferred');
        expect(run.observed).toBe(0);
    });
});

describe('LiveInput: the board', () => {
    it('notifies the board only when a key or the layer changes', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        live.bindRun(lesson('asdf'));
        const listener = vi.fn();
        live.subscribeBoard(listener);
        live.setWanted(true);
        await fake.reply([], 10);
        expect(listener).toHaveBeenCalledTimes(1); // the first layer
        for (let t = 20; t < 400; t += 10) await fake.reply([], t);
        expect(listener).toHaveBeenCalledTimes(1);
        await fake.reply([A], 410);
        expect(listener).toHaveBeenCalledTimes(2);
        expect(live.getBoard()).toMatchObject({ layer: 0 });
        expect([...live.getBoard().pressed]).toEqual([A]);
        await fake.reply([A, MO1], 420);
        expect(live.getBoard().layer).toBe(1);
    });

    it('marks a wrong key on its press, keeps it 600 ms after release, then clears it', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        live.bindRun(lesson('asdf'));
        live.setWanted(true);
        await fake.reply([], 10);
        const F = at('f');
        await fake.reply([F], 20); // a expected, f pressed
        expect([...live.getBoard().wrong]).toEqual([F]);
        await fake.reply([], 30); // released at ts 25
        expect([...live.getBoard().wrong]).toEqual([F]);
        await vi.waitFor(() => expect(live.getBoard().wrong.size).toBe(0), { timeout: WRONG_KEY_HOLD_MS + 500 });
    });

    it('the right key, a key just typed right, the next character, and layer and Shift keys are never wrong', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('asdf');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([A], 20); // the expected key
        type(run, live, 'a', 12); // typed before the sample showed its press
        await fake.reply([A, S], 30); // s is expected now
        await fake.reply([A, S, at('d')], 40); // d is next after s: a roll
        await fake.reply([MO1], 50); // a layer key
        await fake.reply([2], 60); // Shift
        expect(live.getBoard().wrong.size).toBe(0);
    });

    it('shows Layer locked on after an unexplained layer lasts 300 ms, and clears it', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        live.bindRun(lesson('asdf'));
        const changed = vi.fn();
        live.onChange = changed;
        fake.masks = { active: 0b11, default: 1 };
        live.setWanted(true);
        for (let t = 10; t <= LAYER_LOCK_MS + 100; t += 10) await fake.reply([], t);
        expect(live.layerLocked).toBe(1);
        expect(changed).toHaveBeenCalled();
        fake.masks = { active: 1, default: 1 };
        for (let t = LAYER_LOCK_MS + 110; t <= LAYER_LOCK_MS + 200; t += 10) await fake.reply([], t);
        expect(live.layerLocked).toBeNull();
    });

    it('a held MO(1) or a one-shot waiting for its key is not a locked layer', async () => {
        const osl = rebind(svalDefault(), 0, 33, keyService.parse('OSL(1)'));
        const fake = new FakeBoard();
        const live = (current = liveInput(fake, osl));
        live.bindRun(lesson('asdf'));
        fake.masks = { active: 0b11, default: 1 };
        live.setWanted(true);
        await fake.reply([], 10);
        // Held MO(1): its layer is explained.
        for (let t = 20; t <= 400; t += 10) await fake.reply([MO1], t);
        expect(live.layerLocked).toBeNull();
        // OSL tapped: layer 1 stays on until the next key, which is not a lock.
        await fake.reply([33], 410);
        for (let t = 420; t <= 800; t += 10) await fake.reply([], t);
        expect(live.layerLocked).toBeNull();
    });
});

describe('LessonRun.attribute (§8.2)', () => {
    function history(samples: [number, number[]][]) {
        const h = new MatrixHistory(ROWS * COLS);
        h.addMasks(0, 1, 1);
        for (const [t, down] of samples) h.addSample(t, t, matrixToDown(frame(down), ROWS, COLS));
        return h;
    }
    const keymap = new LiveKeymap(resolution, board.keymap!, board.rows, board.cols);

    it('an observed miss takes its class from the key pressed, not the character typed', () => {
        const run = lesson('a');
        // The OS typed p, but the key pressed was q's (same finger cluster as a): wrong direction.
        run.onInput(input('p', 12));
        expect(run.events[0].errorClass).not.toBe('wrong-direction');
        const a = attributeStep({ typed: cp('p'), expected: cp('a'), tInput: 12, tPrev: null }, history([[0, []], [10, [Q]]]), keymap, new Set());
        run.attribute(0, a);
        expect(run.events[0]).toMatchObject({ kind: 'miss', errorClass: 'wrong-direction' });
        expect(run.events[0].phys).toMatchObject({ index: Q, layer: 0, confidence: 'observed', shift: 'n' });
    });

    it('a delayed step is timed by its press edge, and the next step from it (§6.5)', () => {
        const run = lesson('a!a');
        const h = history([[0, []], [10, [A]], [20, []], [100, [3]], [140, [3, Q]], [220, [3]], [230, []], [300, [A]]]);
        const consumed = new Set<number>();
        const steps: [string, number][] = [['a', 12], ['!', 221], ['a', 302]];
        let tPrev: number | null = null;
        steps.forEach(([ch, t], seq) => {
            run.onInput(input(ch, t));
            const a = attributeStep({ typed: cp(ch), expected: cp(ch), tInput: t, tPrev }, h, keymap, consumed);
            a.consumed.forEach((id) => consumed.add(id));
            run.attribute(seq, a);
            tPrev = a.delayed && a.targetEdge != null ? a.targetEdge : t;
        });
        run.finalizeTiming();
        expect(run.events[1]).toMatchObject({ delayed: true, raw: 140 - 12, prereq: [3] });
        expect(run.events[1].phys.target).toBe(40);
        // The next a is timed from the ! press edge, not from its late output.
        expect(run.events[2].raw).toBe(302 - 140);
    });
});
