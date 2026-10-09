import { describe, expect, it } from 'vitest';
import {
    attributeStep, EPSILON_MS, LiveKeymap, MismatchCounter, type StepToAttribute, strayEdges, topLayer,
} from '@/features/practice/input/correlate';
import { MatrixHistory, matrixToDown } from '@/features/practice/input/usbSampler';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { keyService } from '@/services/key.service';
import { rebind, svalDefault } from '../fixtures/boards';
import { COLS, frame, ROWS } from './fakeBoard';

// The correlator (spec §9.3, §9.9) on synthetic matrix histories over the default keymap
// (src/default-layouts/sval-default.svil). Indices follow row * 6 + col.

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const keymap = new LiveKeymap(resolution, board.keymap!, board.rows, board.cols);
const cp = (s: string) => s.codePointAt(0)!;
const at = (ch: string) => resolution.primary(cp(ch))!.index;
const indexOf = (name: RegExp, layer = 0) => board.keymap![layer].findIndex((code) => name.test(keyService.stringify(code)));

const A = at('a'); // 26, left pinky C
const Q = 27; // left pinky N: q on layer 0, ! on layer 1
const MO1 = 32; // right thumb T5
const LT1 = 3; // left thumb T1: LT1(KC_ENTER)
const SHIFT = 2; // left thumb, KC_LSHIFT
const BSPC = indexOf(/^KC_(BSPC|BSPACE|BACKSPACE)$/);

/** A history from [time, keys down] samples, each stamped at its time, with a base-layer mask first. */
function history(samples: [number, number[]][], masks: [number, number][] = [[0, 1]]): MatrixHistory {
    const h = new MatrixHistory(ROWS * COLS);
    for (const [t, active] of masks) if (t <= samples[0][0]) h.addMasks(t, active, 1);
    for (const [t, down] of samples) {
        h.addSample(t, t, matrixToDown(frame(down), ROWS, COLS));
        for (const [mt, active] of masks) if (mt > samples[0][0] && mt === t) h.addMasks(mt, active, 1);
    }
    return h;
}

const step = (typed: string, tInput: number, tPrev: number | null = null, expected = typed): StepToAttribute => ({
    typed: cp(typed), expected: cp(expected), tInput, tPrev,
});

describe('correlate: rules (§9.3)', () => {
    it('a normal press is an observed hit on its key and path', () => {
        const h = history([[0, []], [10, [A]], [20, []]]);
        const a = attributeStep(step('a', 12), h, keymap, new Set());
        expect(a).toMatchObject({ rule: 1, confidence: 'observed', resolved: cp('a'), targetEdge: 10, delayed: false, errorClass: null });
        expect(a.path?.key).toBe('0:26:n');
        expect(a.skew).toBe(-2);
        expect(a.consumed.length).toBe(1);
    });

    it('a 30 ms tap that falls between two samples is inferred', () => {
        const h = history([[0, []], [50, []], [100, []]]);
        const a = attributeStep(step('a', 30), h, keymap, new Set());
        expect(a).toMatchObject({ rule: 4, confidence: 'inferred', path: null, pressed: null });
    });

    it('the tap side of LT1(KC_ENTER) types on release: observed, delayed, timed by the press', () => {
        const h = history([[0, []], [10, [LT1]], [90, [LT1]], [100, []]]);
        const a = attributeStep(step('\n', 101), h, keymap, new Set());
        expect(a.confidence).toBe('observed');
        expect(a.path?.emitsOnRelease).toBe(true);
        expect(a.delayed).toBe(true);
        expect(a.targetEdge).toBe(10);
        expect(a.pressed?.index).toBe(LT1);
    });

    it('permissive-hold roll: LT1 down, N down at +40, up at +120, ! typed at +121', () => {
        const h = history([[0, []], [10, [LT1]], [50, [LT1, Q]], [130, [LT1]], [140, []]]);
        const a = attributeStep(step('!', 131, 0), h, keymap, new Set());
        expect(a.rule).toBe(1);
        expect(a.pressed).toEqual({ index: Q, layer: 1, shift: 'f' });
        expect(a.path?.key).toBe('1:27:f');
        expect(a.path?.prereqs.map((p) => p.index)).toEqual([LT1]);
        expect(a.prereqEdges.map((e) => e.index)).toEqual([LT1]);
        expect(a.delayed).toBe(true);
        expect(a.targetEdge).toBe(50);
    });

    it('late output (a key typed 200 ms after its press) is still found in the history interval', () => {
        const h = history([[0, []], [10, [A]], [30, []], [250, []]]);
        const a = attributeStep(step('a', 210, 0), h, keymap, new Set());
        expect(a).toMatchObject({ rule: 1, confidence: 'observed', targetEdge: 10 });
    });

    it('a fast MO(1) roll under a stale base-layer mask types !, not q, and is not a mismatch', () => {
        // The mask was read before MO(1) went down; MO(1) and N are pressed together in one sample.
        const h = history([[0, []], [10, [MO1, Q]], [20, [MO1]], [30, []]], [[0, 1]]);
        const a = attributeStep(step('!', 12), h, keymap, new Set());
        expect(a.path?.key).toBe('1:27:f');
        expect(a.path?.prereqs.map((p) => p.index)).toEqual([MO1]);
        expect(a.mismatch).toBeNull();
        expect(a.delayed).toBe(false);
    });

    it('classes a wrong key against the observed press (§6.6 worked example for !)', () => {
        // q: same index, layer 0.
        const q = attributeStep(step('q', 12, null, '!'), history([[0, []], [10, [Q]]]), keymap, new Set());
        expect(q.errorClass).toBe('wrong-layer');
        // 1: layer 1, left pinky C.
        const one = attributeStep(step('1', 12, null, '!'), history([[0, []], [10, [MO1, A]]]), keymap, new Set());
        expect(one.pressed).toMatchObject({ index: A, layer: 1 });
        expect(one.errorClass).toBe('wrong-direction');
        // @: layer 1, left ring N.
        const atSign = attributeStep(step('@', 12, null, '!'), history([[0, []], [10, [MO1, 21]]]), keymap, new Set());
        expect(atSign.pressed?.index).toBe(21);
        expect(atSign.errorClass).toBe('wrong-finger');
    });

    it('a roll of two keys pressed in one sample attributes each to its own key', () => {
        const T = at('t'), H = at('h');
        const h = history([[0, []], [10, [T, H]], [30, []]]);
        const consumed = new Set<number>();
        const t = attributeStep(step('t', 8), h, keymap, consumed);
        t.consumed.forEach((id) => consumed.add(id));
        const hh = attributeStep(step('h', 11, 8), h, keymap, consumed);
        expect(t.pressed?.index).toBe(T);
        expect(hh.pressed?.index).toBe(H);
    });

    it('takes edges up to ε after the input, not later', () => {
        const late = history([[0, []], [12 + EPSILON_MS, [A]]]);
        expect(attributeStep(step('a', 12), late, keymap, new Set()).skew).toBe(EPSILON_MS);
        const tooLate = history([[0, []], [13 + EPSILON_MS, [A]]]);
        expect(attributeStep(step('a', 12), tooLate, keymap, new Set()).confidence).toBe('inferred');
        const early = history([[-60, []], [12 - 40, [A]], [0, []]]);
        expect(attributeStep(step('a', 12), early, keymap, new Set()).skew).toBe(-40);
    });

    it('never matches an edge an earlier step used, or one before the previous step', () => {
        const h = history([[0, []], [10, [A]], [20, []], [30, [A]], [40, []]]);
        const first = attributeStep(step('a', 12), h, keymap, new Set());
        const second = attributeStep(step('a', 32, 12), h, keymap, new Set(first.consumed));
        expect(second.targetEdge).toBe(30);
        const stale = attributeStep(step('a', 52, 32), h, keymap, new Set([...first.consumed, ...second.consumed]));
        expect(stale.confidence).toBe('inferred');
    });

    it('user Shift: A is 26 with Shift held, and Shift is its prerequisite edge', () => {
        const h = history([[0, []], [10, [SHIFT]], [30, [SHIFT, A]], [40, []]]);
        const a = attributeStep(step('A', 32, 0), h, keymap, new Set());
        expect(a.path?.key).toBe('0:26:u');
        expect(a.prereqEdges.map((e) => e.index)).toEqual([SHIFT]);
    });
});

describe('correlate: one-shot layers (§9.3)', () => {
    // OSL(1) on the right thumb position 33.
    const OSL1 = 33;
    const oslBoard = rebind(board, 0, OSL1, keyService.parse('OSL(1)'));
    const oslKeymap = new LiveKeymap(resolveKeymap({ keymap: oslBoard.keymap!, rows: oslBoard.rows, cols: oslBoard.cols }), oslBoard.keymap!, oslBoard.rows, oslBoard.cols);

    it('an OSL tap applies to the next press before any mask shows it: !, not q, and not a mismatch', () => {
        // Masks only at 0 (base): the OSL is tapped at 10–20 and N pressed at 30, before the next mask read.
        const h = history([[0, []], [10, [OSL1]], [20, []], [30, [Q]], [40, []]]);
        const a = attributeStep(step('!', 32, 0), h, oslKeymap, new Set());
        expect(a).toMatchObject({ rule: 1, confidence: 'observed', resolved: cp('!'), mismatch: null });
        expect(a.pressed).toMatchObject({ index: Q, layer: 1 });
        expect(a.path?.prereqs.map((p) => [p.index, p.kind])).toEqual([[OSL1, 'oneshot']]);
        expect(a.prereqEdges.map((e) => e.index)).toEqual([OSL1]);
        expect(a.consumed.length).toBe(2);
    });

    it('a wrong key after an OSL tap is classed on layer 1 and is not counted as an OS layout mismatch', () => {
        const h = history([[0, []], [10, [OSL1]], [20, []], [30, [A]], [40, []]]);
        const a = attributeStep(step('1', 32, 0, '!'), h, oslKeymap, new Set());
        expect(a.pressed).toMatchObject({ index: A, layer: 1 });
        expect(a.mismatch).toBeNull();
    });

    it('an OSL used by an earlier step no longer applies', () => {
        const h = history([[0, []], [10, [OSL1]], [20, []], [30, [Q]], [40, []], [60, [Q]], [70, []]]);
        const first = attributeStep(step('!', 32, 0), h, oslKeymap, new Set());
        const second = attributeStep(step('q', 62, 32), h, oslKeymap, new Set(first.consumed));
        expect(second).toMatchObject({ rule: 1, resolved: cp('q'), mismatch: false });
        expect(second.pressed?.layer).toBe(0);
    });
});

describe('correlate: strays and the OS layout check (§6.6, §3.1)', () => {
    it('Shift, MO and Backspace presses are never strays; an extra letter press is', () => {
        const h = history([[0, []], [10, [SHIFT]], [20, []], [30, [MO1]], [40, []], [50, [BSPC]], [60, []], [70, [A]], [80, []]]);
        const strays = strayEdges(h, keymap, new Set(), 100);
        expect(strays.map((e) => e.index)).toEqual([A]);
    });

    it('counts only eligible base-layer steps, and triggers at 5 of the last 20', () => {
        const counter = new MismatchCounter();
        // A press of a key that types y under the keymap, while the browser typed z: rule 3, eligible.
        const Y = at('y');
        const mismatch = attributeStep(step('z', 12, null, 'y'), history([[0, []], [10, [Y]]]), keymap, new Set());
        expect(mismatch.rule).toBe(3);
        expect(mismatch.mismatch).toBe(true);
        // A layered step is never eligible.
        const layered = attributeStep(step('!', 12), history([[0, []], [10, [MO1, Q]]]), keymap, new Set());
        expect(layered.mismatch).toBeNull();
        for (let i = 0; i < 4; i++) counter.add(mismatch.mismatch);
        counter.add(layered.mismatch);
        expect(counter.triggered).toBe(false);
        counter.add(mismatch.mismatch);
        expect(counter.count).toBe(5);
        expect(counter.triggered).toBe(true);
        for (let i = 0; i < 20; i++) counter.add(false);
        expect(counter.triggered).toBe(false);
    });
});

describe('LiveKeymap', () => {
    it('derives the effective layer from held layer keys, through a toggled layer from the mask', () => {
        const h = history([[0, []], [10, [MO1]]]);
        expect(topLayer(keymap.effectiveMask(h, h.latest!))).toBe(1);
        // A layer on in the mask with nothing held to explain it (a toggle) counts too.
        const toggled = new MatrixHistory(ROWS * COLS);
        toggled.addSample(0, 0, matrixToDown(frame([]), ROWS, COLS));
        toggled.addMasks(1, 0b101, 1);
        toggled.addSample(10, 10, matrixToDown(frame([]), ROWS, COLS));
        expect(keymap.unexplainedMask(toggled.latestMask!)).toBe(0b100);
        expect(topLayer(keymap.effectiveMask(toggled, toggled.latest!))).toBe(2);
    });

    it('a held TT(1) or LM(1, Shift) turns layer 1 on and is a prerequisite, never a typed key', () => {
        for (const code of [keyService.parse('TT(1)'), 0x5000 | (1 << 5) | 0x02]) {
            const kb = rebind(board, 0, 33, code);
            const km = new LiveKeymap(resolveKeymap({ keymap: kb.keymap!, rows: kb.rows, cols: kb.cols }), kb.keymap!, kb.rows, kb.cols);
            const down = matrixToDown(frame([33]), ROWS, COLS);
            expect(topLayer(km.heldMask(down, 1))).toBe(1);
            expect(km.keyAt(33, 1).prereqKey).toBe(true);
            expect(km.layerKeyHeld(down, 1)).toBe(true);
        }
    });

    it('as a tap, a held LT key turns no layer on', () => {
        const down = matrixToDown(frame([LT1]), ROWS, COLS);
        expect(topLayer(keymap.heldMask(down, 1))).toBe(1);
        expect(topLayer(keymap.heldMask(down, 1, true))).toBe(0);
        expect(keymap.tapHoldHeld(down, 1)).toBe(true);
        expect(keymap.tapHoldHeld(down, 1, LT1)).toBe(false);
    });

    it('a held layer key explains its layer in the mask', () => {
        const h = new MatrixHistory(ROWS * COLS);
        h.addSample(0, 0, matrixToDown(frame([MO1]), ROWS, COLS));
        h.addMasks(1, 0b11, 1);
        expect(keymap.unexplainedMask(h.latestMask!)).toBe(0);
    });
});

describe('correlate: combos and tap dances (M3)', () => {
    const TD0 = 0x5700;
    const tdBoard = rebind(svalDefault(), 0, A, TD0);
    tdBoard.tapdances = [{ idx: 0, tap: 'KC_A', hold: 'KC_NO', doubletap: 'KC_B', taphold: 'KC_NO', tapping_term: 200, enabled: true }];
    tdBoard.combos = [{ cmbid: 0, keys: ['KC_J', 'KC_K'], output: 'KC_EQUAL', options: 0x8000 }];
    const full = resolveKeymap({ keymap: tdBoard.keymap!, rows: tdBoard.rows, cols: tdBoard.cols, tapdances: tdBoard.tapdances, combos: tdBoard.combos });
    const live = new LiveKeymap(full, tdBoard.keymap!, tdBoard.rows, tdBoard.cols);
    const J = 38, K = 44;

    it('a tap-dance tap typed 200 ms after its press is an observed, delayed hit timed by the press', () => {
        const h = history([[0, []], [10, [A]], [30, []], [250, []]]);
        const a = attributeStep(step('a', 210, 0), h, live, new Set());
        expect(a).toMatchObject({ rule: 1, confidence: 'observed', targetEdge: 10, delayed: true });
        expect(a.path?.via).toBe('tapdance');
        expect(a.mismatch).toBeNull();
    });

    it('a tap-dance double tap uses both presses and is timed from the first', () => {
        const h = history([[0, []], [10, [A]], [30, []], [60, [A]], [80, []], [300, []]]);
        const b = attributeStep(step('b', 280, 0), h, live, new Set());
        expect(b.rule).toBe(1);
        expect(b.path?.key).toBe('0:26*2:n');
        expect(b.targetEdge).toBe(10);
        expect(b.consumed.length).toBe(2);
    });

    it('a combo is observed when its keys are down together; both presses are consumed', () => {
        const h = history([[0, []], [10, [J]], [20, [J, K]], [40, []]]);
        const eq = attributeStep(step('=', 22), h, live, new Set());
        expect(eq.rule).toBe(1);
        expect(eq.path?.key).toBe('0:38+44:n');
        expect(eq.consumed.length).toBe(2);
        expect(eq.targetEdge).toBe(20);
        expect(eq.mismatch).toBeNull();
    });

    it('one key of a combo alone is not the combo', () => {
        const h = history([[0, []], [10, [J]], [40, []]]);
        const eq = attributeStep(step('=', 12), h, live, new Set());
        expect(eq.path?.key).not.toBe('0:38+44:n');
        // Rule 3: the press of j is the key observed.
        expect(eq.rule).toBe(3);
        expect(eq.resolved).toBe(cp('j'));
    });
});
