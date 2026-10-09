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

    it('a Shift and its target caught in one late sample count as two presses (§6.5)', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('aA');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([A], 20); // ts 15
        type(run, live, 'a', 16);
        await fake.reply([], 100); // ts 60
        type(run, live, 'A', 102);
        await fake.reply([2, A], 110); // ts 105: Shift and a in one sample, after the input
        const settled = live.settle();
        await fake.reply([], 200);
        await settled;
        run.practiceSteps();
        expect(run.events[1].phys).toMatchObject({ confidence: 'observed', index: A, reach: 105 - 16, target: 0 });
        expect(run.events[1]).toMatchObject({ raw: 102 - 16, ttt: (102 - 16) / 2, prereq: [2] });
    });

    it('keystrokes typed while the board is not answering stay inferred, never matched to presses from before', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        const run = lesson('aaa');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([at('x')], 20); // a stray x at ts 15, never typed
        await fake.reply([], 30);
        for (let i = 1; i <= 3; i++) await fake.fail(30 + i);
        expect(live.failed).toBe(true);
        type(run, live, 'a', 200);
        expect(run.events[0].phys.confidence).toBe('inferred');
        // Back: a fresh history, and the next step looks only after the keystroke typed meanwhile.
        await fake.wake();
        await fake.reply([], 2100);
        expect(live.failed).toBe(false);
        await fake.reply([A], 2120); // ts 2110
        type(run, live, 'a', 2112);
        await fake.reply([], 2200);
        expect(run.events[0].phys.confidence).toBe('inferred');
        expect(run.events[1].phys).toMatchObject({ confidence: 'observed', index: A });
        expect(live.mismatch.count).toBe(0);
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

    it('the keys of a combo for the expected character are not wrong (M3)', async () => {
        const kb = { ...svalDefault(), combos: [{ cmbid: 0, keys: ['KC_J', 'KC_K'], output: 'KC_EQUAL', options: 0x8000 }] };
        const fake = new FakeBoard();
        const live = (current = new LiveInput({ pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep }));
        const r = resolveKeymap({ keymap: kb.keymap!, rows: kb.rows, cols: kb.cols, combos: kb.combos });
        live.setKeymap({ resolution: r, keymap: kb.keymap!, rows: kb.rows, cols: kb.cols });
        live.bindRun(new LessonRun({ text: '=as', textInput: { stopOnError: true, forgiveErrors: true, spaceSkipsWords: false }, resolution: r, cols: kb.cols }));
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([at('j')], 20);
        await fake.reply([at('j'), at('k')], 30);
        expect(live.getBoard().wrong.size).toBe(0);
        await fake.reply([], 40);
        await fake.reply([at('f')], 50);
        expect([...live.getBoard().wrong]).toEqual([at('f')]);
    });

    it('a press right after an OSL tap, before the next mask read, is on layer 1 and not wrong', async () => {
        const osl = rebind(svalDefault(), 0, 33, keyService.parse('OSL(1)'));
        const fake = new FakeBoard();
        const live = (current = liveInput(fake, osl));
        const run = lesson('!a');
        live.bindRun(run);
        live.setWanted(true);
        await fake.reply([], 10); // iteration 0: masks read (base)
        await fake.reply([33], 20); // OSL down
        await fake.reply([], 30); // OSL up: layer 1 waits for its key
        expect(live.getBoard().layer).toBe(1);
        await fake.reply([Q], 40); // N, before the next mask read
        expect(live.getBoard().wrong.size).toBe(0);
        type(run, live, '!', 36);
        const settled = live.settle();
        await fake.reply([], 100);
        await settled;
        expect(run.events[0].phys).toMatchObject({ confidence: 'observed', index: Q, layer: 1 });
        expect(live.mismatch.count).toBe(0);
    });

    it('a roll out of an LT key is not wrong when its tap side types the next character', async () => {
        const lt = rebind(svalDefault(), 0, 33, keyService.parse('LT1(KC_S)'));
        const fake = new FakeBoard();
        const live = (current = liveInput(fake, lt));
        live.bindRun(lesson('sa'));
        live.setWanted(true);
        await fake.reply([], 10);
        await fake.reply([33], 20); // LT1(KC_S) down: s expected, its hold isn't decided
        await fake.reply([33, A], 30); // a down before LT1 is up: 1 on layer 1, a as a tap
        expect(live.getBoard().wrong.size).toBe(0);
        // A key that is wrong either way still gets the mark.
        await fake.reply([33, A, at('f')], 40);
        expect([...live.getBoard().wrong]).toEqual([at('f')]);
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

    it('a held TT, LM or tap dance, or a tri-layer under two MO keys, is never a locked layer', async () => {
        const holds: [number, number, number[]][] = [
            [keyService.parse('TT(1)'), 0b11, [33]],
            [0x5000 | (1 << 5) | 0x02, 0b11, [33]], // LM(1, Shift)
            [keyService.parse('TD(0)'), 0b101, [33]], // a tap dance holding to layer 2
            [keyService.parse('MO(2)'), 0b1111, [MO1, 33]], // MO(1) and MO(2) raising layer 3
        ];
        for (const [code, active, down] of holds) {
            const kb = rebind(svalDefault(), 0, 33, code);
            const fake = new FakeBoard();
            const live = liveInput(fake, kb);
            live.bindRun(lesson('asdf'));
            fake.masks = { active, default: 1 };
            live.setWanted(true);
            for (let t = 10; t <= 500; t += 10) await fake.reply(down, t);
            expect(live.layerLocked).toBeNull();
            live.dispose();
        }
    });

    it('the Svalboard auto-mouse layer (the last) is never a locked layer', async () => {
        const fake = new FakeBoard();
        const live = (current = liveInput(fake));
        live.bindRun(lesson('asdf'));
        const auto = board.keymap!.length - 1;
        fake.masks = { active: (1 | (1 << auto)) >>> 0, default: 1 };
        live.setWanted(true);
        for (let t = 10; t <= LAYER_LOCK_MS + 100; t += 10) await fake.reply([], t);
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

describe('LessonRun.attribute with Forgive errors', () => {
    it('a waiting keystroke the board already attributed stays observed, with its path, when a recovery makes it a hit', () => {
        const keymap = new LiveKeymap(resolution, board.keymap!, board.rows, board.cols);
        const h = new MatrixHistory(ROWS * COLS);
        h.addMasks(0, 1, 1);
        for (const [t, down] of [[0, []], [10, [A]], [20, []], [30, [at('d')]], [40, []]] as [number, number[]][]) {
            h.addSample(t, t, matrixToDown(frame(down), ROWS, COLS));
        }
        const run = lesson('asdfg');
        run.onInput(input('a', 12));
        run.attribute(0, attributeStep({ typed: cp('a'), expected: cp('a'), tInput: 12, tPrev: null }, h, keymap, new Set()));
        // s is skipped: d waits as a miss and is attributed; f and g then recover it (keybr's skipped character).
        run.onInput(input('d', 32));
        const seen = attributeStep({ typed: cp('d'), expected: cp('s'), tInput: 32, tPrev: 12 }, h, keymap, new Set());
        run.attribute(1, seen);
        expect(run.events.find((e) => e.seq === 1)).toMatchObject({ kind: 'miss' });
        run.onInput(input('f', 52));
        run.onInput(input('g', 72));
        const d = run.events.find((e) => e.seq === 1)!;
        expect(d).toMatchObject({ kind: 'hit', expected: cp('d'), path: seen.path!.key, errorClass: undefined });
        expect(d.phys).toMatchObject({ confidence: 'observed', index: at('d') });
    });
});
