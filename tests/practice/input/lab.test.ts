import { afterEach, describe, expect, it } from 'vitest';
import { LabSession } from '@/features/practice/input/lab';
import { distribution, histogram, labMarkdown } from '@/features/practice/input/labStats';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { svalDefault } from '../fixtures/boards';
import { FakeBoard, settle } from './fakeBoard';

// The M0 lab session (spec §12 M0): samples, skew, taps caught, LT roll timing, edge − keydown and presses
// that typed nothing, from a scripted board.

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const cp = (s: string) => s.codePointAt(0)!;
const at = (ch: string) => resolution.primary(cp(ch))!.index;
const LT1 = 3, Q = 27;

let lab: LabSession | null = null;
afterEach(() => {
    lab?.stop();
    lab = null;
});

function session(fake: FakeBoard) {
    return new LabSession(
        { pollMatrix: fake.pollMatrix, getLayerMasks: fake.getLayerMasks, clock: fake.clock, sleep: fake.sleep },
        { resolution, keymap: board.keymap!, rows: board.rows, cols: board.cols },
    );
}

describe('LabSession', () => {
    it('measures skew, taps caught, edge − keydown, an LT roll and a press that typed nothing', async () => {
        const fake = new FakeBoard();
        const s = (lab = session(fake));
        s.start();
        await fake.reply([], 10); // ts 5
        // a: keydown at 14, press seen at ts 15, input at 16.
        s.keydown(14, false);
        await fake.reply([at('a')], 20);
        s.input(cp('a'), 16);
        await fake.reply([], 30);
        // A 30 ms tap between samples: missed.
        s.input(cp('s'), 100);
        await fake.reply([], 200); // ts 115
        // LT roll: LT1 down, N down, N up, ! typed on the release.
        await fake.reply([LT1], 300); // ts 250
        await fake.reply([LT1, Q], 340); // ts 320
        await fake.reply([LT1], 400); // ts 370: N released
        s.input(cp('!'), 372);
        await fake.reply([], 420);
        // A press of f that typed nothing.
        await fake.reply([at('f')], 500); // ts 460
        await fake.reply([], 520);
        for (let t = 600; t <= 1200; t += 100) await fake.reply([], t);
        const summary = s.summary();
        expect(summary.typed).toBe(3);
        expect(summary.observed).toBe(2);
        expect(summary.caught).toBeCloseTo(2 / 3);
        expect(summary.skew.n).toBe(2);
        expect(summary.edgeMinusKeydown.p50).toBe(1);
        expect(summary.ltRolls).toBe(1);
        expect(summary.ltReleaseToInput.p50).toBe(2);
        expect(summary.ltPressToInput.p50).toBe(52);
        expect(summary.strays).toBe(1);
        expect(summary.rate).toBeGreaterThan(0);
        expect(s.raw()[2]).toMatchObject({ char: '!', rule: 1, ltRoll: true, path: '1:27:f' });
    });

    it('a keystroke typed while not reading is attributed at once, as missed', async () => {
        const fake = new FakeBoard();
        const s = (lab = session(fake));
        s.input(cp('a'), 10);
        await settle();
        expect(s.summary()).toMatchObject({ typed: 1, observed: 0 });
        s.reset();
        expect(s.summary().typed).toBe(0);
    });
});

describe('lab numbers', () => {
    it('distributions, histograms and the Markdown table', () => {
        expect(distribution([])).toMatchObject({ n: 0, p50: null });
        expect(distribution([5, 1, 3, 2, 4])).toMatchObject({ n: 5, min: 1, p50: 3, max: 5 });
        expect(histogram([-12, -3, 4, 9, 15])).toEqual([[-20, 1], [-10, 1], [0, 2], [10, 1]]);
        const md = labMarkdown({
            typed: 10, observed: 9, caught: 0.9, rate: 120, rttP50: 4, rttP95: 9, failures: 0,
            skew: distribution([1, 2, 3]), skewHistogram: [[0, 3]], ltRolls: 0, ltReleaseToInput: distribution([]),
            ltPressToInput: distribution([]), edgeMinusKeydown: distribution([2]), edgesBeforeKeydown: 0, strays: 1,
        }, { board: 'Mule', keybard: 'abc1234', date: '2026-10-09' });
        expect(md).toContain('| Samples per second | 120 |');
        expect(md).toContain('| Taps caught (observed) | 90.0 % (9 / 10) |');
        expect(md).toContain('Mule · Keybard abc1234 · 2026-10-09');
    });
});
