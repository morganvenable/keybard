import { describe, expect, it } from 'vitest';
import { newPrereqsKeymapOnly, PracticeTimeToType } from '@/features/practice/input/timeToType';
import { resolveKeymap, type Path } from '@/features/practice/keymap/resolver';
import { makeStats } from '@/features/practice/vendor/keybr/textinput/index.ts';
import { svalDefault } from '../fixtures/boards';

const board = svalDefault();
const r = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const path = (ch: string, which = 0): Path => r.pathsOf(ch.codePointAt(0)!)[which];

describe('time to type, keymap only (§6.5)', () => {
    it('firmware Shift is not a press; a new layer hold is', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path('a') });
        const bang = timer.measure({ tInput: 400, path: path('!') }); // MO(1) + KC_EXLM
        expect(bang.presses).toBe(2);
        expect(bang.newPrereqs).toEqual([32]);
        expect(bang.ttt).toBe(200);
        // `"` is KC_DQUO on the base layer: firmware Shift only.
        const quote = timer.measure({ tInput: 700, path: path('"') });
        expect(quote.presses).toBe(1);
        expect(quote.ttt).toBe(300);
    });

    it('a run of layer-1 digits under one MO(1) divides only the first digit by 2', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path(' ') });
        const steps = ['1', '2', '3'].map((d, i) => timer.measure({ tInput: 300 * (i + 1), path: path(d) }));
        expect(steps.map((s) => s.presses)).toEqual([2, 1, 1]);
        expect(steps.map((s) => s.ttt)).toEqual([150, 300, 300]);
    });

    it('THE with Shift held through the word counts Shift once', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path(' ') });
        const steps = ['T', 'H', 'E'].map((c, i) => timer.measure({ tInput: 200 * (i + 1), path: path(c) }));
        expect(steps.map((s) => s.presses)).toEqual([2, 1, 1]);
    });

    it('drops steps over 2,000 ms (a pause)', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path('a') });
        expect(timer.measure({ tInput: 2500, path: path('s') }).ttt).toBeNull();
        expect(timer.measure({ tInput: 2700, path: path('d') }).ttt).toBe(200);
    });

    it('the first step has no time', () => {
        expect(new PracticeTimeToType().measure({ tInput: 50, path: path('a') }).ttt).toBeNull();
    });

    it('a one-shot layer is a new press every time', () => {
        const osl = { ...path('!'), prereqs: [{ ...path('!').prereqs[0], kind: 'oneshot' as const }] };
        expect(newPrereqsKeymapOnly(osl, osl)).toHaveLength(1);
        expect(newPrereqsKeymapOnly(path('!'), path('@'))).toHaveLength(0);
    });
});

describe('time to type, live (§6.5)', () => {
    it('counts prerequisite press edges in (t_prev, t_step]; a hold kept down counts once', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path(' '), prereqEdges: [], targetEdge: 0 });
        const one = timer.measure({ tInput: 300, path: path('1'), prereqEdges: [{ t: 120, index: 32 }], targetEdge: 290 });
        expect(one.presses).toBe(2);
        expect(one.reach).toBe(120);
        expect(one.target).toBe(170);
        // MO(1) still held, its edge is before t_prev: not new.
        const two = timer.measure({ tInput: 500, path: path('2'), prereqEdges: [{ t: 120, index: 32 }], targetEdge: 480 });
        expect(two.presses).toBe(1);
        expect(two.reach).toBeNull();
        expect(two.target).toBe(180);
    });

    it('delayed-output steps use the target press edge, at both ends of raw', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path('a'), prereqEdges: [], targetEdge: 0 });
        // `!` through LT1: L-pinky N pressed at +40, typed on its release at +121.
        const viaLt = path('!', 1);
        expect(viaLt.delayed).toBe(true);
        const bang = timer.measure({ tInput: 121, path: viaLt, prereqEdges: [{ t: 10, index: 3 }], targetEdge: 40 });
        expect(bang.tStep).toBe(40);
        expect(bang.raw).toBe(40);
        expect(bang.ttt).toBe(20);
        const next = timer.measure({ tInput: 240, path: path('a'), prereqEdges: [], targetEdge: 235 });
        expect(next.raw).toBe(200);
    });

    it('a prerequisite seen in the same late sample as its target still counts (sample stamped after the input)', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path('a'), prereqEdges: [], targetEdge: 0 });
        // Shift and a in one 10 ms sample stamped at 105; the browser's A came at 102.
        const upper = path('A');
        expect(upper.prereqs.map((p) => p.index)).toEqual([2]);
        const step = timer.measure({ tInput: 102, path: upper, prereqEdges: [{ t: 105, index: 2 }], targetEdge: 105 });
        expect(step.tStep).toBe(102);
        expect(step.presses).toBe(2);
        expect(step.ttt).toBe(51);
        expect(step.reach).toBe(105);
        expect(step.target).toBe(0);
    });

    it('firmware Shift is never a prerequisite edge', () => {
        const timer = new PracticeTimeToType();
        timer.measure({ tInput: 0, path: path('a'), prereqEdges: [] });
        expect(timer.measure({ tInput: 200, path: path('"'), prereqEdges: [{ t: 100, index: 2 }] }).presses).toBe(1);
    });
});

describe('makeStats with gaps and pauses (patched, §6.5)', () => {
    const step = (timeStamp: number, codePoint = 0x61, timeToType = 100) => ({ timeStamp, codePoint, timeToType, typo: false });

    it('is keybr\'s result with no options', () => {
        const stats = makeStats([step(0), step(100), step(200, 0x62), step(300, 0x63)]);
        expect(stats.time).toBe(300);
    });

    it('drops a gap over maxGap from the lesson time and from the histogram timing', () => {
        const stats = makeStats([step(0), step(100), step(10_100, 0x62, 10_000), step(10_200, 0x63)], { maxGap: 2000 });
        expect(stats.time).toBe(200);
        expect(stats.histogram.get(0x62)).toMatchObject({ hitCount: 1, timeToType: 0 });
        expect(stats.histogram.get(0x63)).toMatchObject({ timeToType: 100 });
    });

    it('removes paused intervals from the lesson time', () => {
        const stats = makeStats([step(0), step(1000), step(1500, 0x62), step(1600, 0x63)], { maxGap: 2000, paused: [[200, 700]] });
        expect(stats.time).toBe(1100);
    });

    it('does not remove a pause twice when it is also a dropped gap', () => {
        const stats = makeStats([step(0), step(100), step(600_100, 0x62), step(600_200, 0x63)], { maxGap: 2000, paused: [[200, 600_000]] });
        expect(stats.time).toBe(200);
    });
});
