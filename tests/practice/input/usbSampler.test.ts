import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    FAILURES_TO_FALLBACK, GATE_RECHECK_MS, HISTORY_MS, MatrixHistory, matrixToDown, RETRY_MS, UsbSampler,
} from '@/features/practice/input/usbSampler';
import { COLS, FakeBoard, frame, ROWS, settle } from './fakeBoard';

// The Live · USB sampler (spec §9.3): one request in flight, layer masks every third read, edges between
// consecutive samples, a 2 s history, and the Keymap-only fallback after three failed reads.

function sampler(board: FakeBoard, canRead: () => boolean = () => true) {
    return new UsbSampler({
        pollMatrix: board.pollMatrix, getLayerMasks: board.getLayerMasks, rows: ROWS, cols: COLS,
        clock: board.clock, sleep: board.sleep, canRead,
    });
}

let current: UsbSampler | null = null;
afterEach(() => {
    current?.stop();
    current = null;
});

describe('MatrixHistory', () => {
    it('finds press and release edges between consecutive samples, timed by the later sample', () => {
        const h = new MatrixHistory(ROWS * COLS);
        expect(h.addSample(0, 10, matrixToDown(frame([26]), ROWS, COLS)).edges).toEqual([]); // baseline
        const { edges } = h.addSample(10, 20, matrixToDown(frame([27]), ROWS, COLS));
        expect(edges.map((e) => [e.index, e.press, e.t, e.dt])).toEqual([[26, false, 15, 10], [27, true, 15, 10]]);
        expect(h.edgesIn(0, 15).length).toBe(2);
        expect(h.edgesIn(15, 30).length).toBe(0);
        expect(h.pressBefore(27, 16)?.t).toBe(15);
    });

    it('keeps only the last 2 s (plus one baseline sample)', () => {
        const h = new MatrixHistory(ROWS * COLS);
        for (let t = 0; t <= 3000; t += 10) h.addSample(t, t, matrixToDown(frame(t % 20 ? [1] : []), ROWS, COLS));
        expect(h.samples[1].ts).toBeGreaterThanOrEqual(3000 - HISTORY_MS);
        expect(h.edges[0].t).toBeGreaterThanOrEqual(3000 - HISTORY_MS);
    });

    it('returns the mask read at or before a time, else the earliest', () => {
        const h = new MatrixHistory(ROWS * COLS);
        h.addMasks(100, 1, 1);
        h.addMasks(200, 3, 1);
        expect(h.maskAt(150)?.active).toBe(1);
        expect(h.maskAt(250)?.active).toBe(3);
        expect(h.maskAt(50)?.active).toBe(1);
    });
});

describe('UsbSampler', () => {
    it('keeps exactly one request in flight and reads the layer masks every third iteration', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        s.start();
        await settle();
        expect(board.pollMatrix).toHaveBeenCalledTimes(1);
        await settle();
        expect(board.pollMatrix).toHaveBeenCalledTimes(1);
        for (let i = 1; i <= 7; i++) {
            await board.reply([], i * 10);
            expect(board.pollMatrix).toHaveBeenCalledTimes(i + 1);
        }
        // Iterations 0, 3 and 6 read the masks.
        expect(board.getLayerMasks).toHaveBeenCalledTimes(3);
        expect(s.history.masks.length).toBe(3);
    });

    it('stamps each sample at the middle of its request and reports edges', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        const seen: [number, boolean, number][] = [];
        s.onSample = (_sample, edges) => edges.forEach((e) => seen.push([e.index, e.press, e.t]));
        s.start();
        board.now = 0;
        await board.reply([], 4);
        board.now = 4;
        await board.reply([26], 8);
        await board.reply([], 12);
        expect(s.history.samples.map((x) => x.ts)).toEqual([2, 6, 10]);
        expect(seen).toEqual([[26, true, 6], [26, false, 10]]);
    });

    it('stops on the next iteration: the reply in flight is dropped and nothing more is read', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        s.start();
        await board.reply([], 10);
        expect(board.pollMatrix).toHaveBeenCalledTimes(2);
        s.stop();
        await board.reply([26], 20);
        await settle();
        expect(board.pollMatrix).toHaveBeenCalledTimes(2);
        expect(s.history.samples.length).toBe(1);
        expect(s.running).toBe(false);
    });

    it('a restart waits for the stopped loop, so there is never a second request in flight', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        s.start();
        await settle();
        s.stop();
        s.start();
        await settle();
        expect(board.pollMatrix).toHaveBeenCalledTimes(1);
        await board.reply([], 10); // the old loop's reply, dropped
        await settle();
        expect(board.pollMatrix).toHaveBeenCalledTimes(2);
        await board.reply([], 20);
        expect(s.history.samples.length).toBe(1);
    });

    it('falls back after three failed reads, retries every 2 s and recovers', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        const health = vi.fn();
        s.onHealth = health;
        s.start();
        for (let i = 1; i < FAILURES_TO_FALLBACK; i++) await board.fail(i);
        expect(s.failed).toBe(false);
        await board.fail(FAILURES_TO_FALLBACK);
        expect(s.failed).toBe(true);
        expect(health).toHaveBeenLastCalledWith(true);
        expect(board.sleeps).toContain(RETRY_MS);
        // Nothing is read until the retry wait ends.
        const calls = board.pollMatrix.mock.calls.length;
        await settle();
        expect(board.pollMatrix.mock.calls.length).toBe(calls);
        await board.wake();
        await board.reply([], 2100);
        expect(s.failed).toBe(false);
        expect(health).toHaveBeenLastCalledWith(false);
    });

    it('starts a fresh history after an outage: no edges span it, and the masks are read at once', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        const edges: number[][] = [];
        s.onSample = (_sample, e) => edges.push(e.map((x) => x.index));
        s.start();
        await board.reply([], 10);
        await board.reply([26], 20); // a press before the board stops answering
        for (let i = 1; i <= FAILURES_TO_FALLBACK; i++) await board.fail(20 + i);
        expect(s.failed).toBe(true);
        const masks = board.getLayerMasks.mock.calls.length;
        await board.wake();
        await board.reply([27], 2100); // back: 26 released and 27 pressed meanwhile
        expect(s.failed).toBe(false);
        expect(edges.at(-1)).toEqual([]); // a baseline, not edges against the sample before the outage
        expect(s.history.samples.length).toBe(1);
        expect(s.history.edges.length).toBe(0);
        expect(board.getLayerMasks.mock.calls.length).toBe(masks + 1);
    });

    it('counts an empty reply (no board) as a failure', async () => {
        const board = new FakeBoard();
        board.pollMatrix.mockImplementation(async () => []);
        const s = (current = sampler(board));
        s.start();
        await vi.waitFor(() => expect(s.failed).toBe(true));
        s.stop();
        await board.wake();
    });

    it('reads nothing while reading is not allowed (Paranoid, a hidden tab)', async () => {
        const board = new FakeBoard();
        let allowed = false;
        const s = (current = sampler(board, () => allowed));
        s.start();
        await settle();
        expect(board.pollMatrix).not.toHaveBeenCalled();
        expect(board.sleeps).toContain(GATE_RECHECK_MS);
        allowed = true;
        await board.wake();
        expect(board.pollMatrix).toHaveBeenCalledTimes(1);
    });

    it('reports the sample rate and the round-trip percentiles', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        s.start();
        for (let i = 1; i <= 20; i++) {
            board.now = i * 10 - 4;
            // The request was sent 4 ms before the reply.
            await board.reply([], i * 10);
        }
        const stats = s.stats();
        expect(stats.samples).toBe(20);
        expect(stats.rate).toBe(20);
        expect(stats.failed).toBe(false);
        expect(stats.rttP50).not.toBeNull();
    });
});

describe('UsbSampler restarts', () => {
    it('a stop during the 2 s retry wait ends it, so a restart reads at once', async () => {
        const board = new FakeBoard();
        const s = (current = sampler(board));
        s.start();
        for (let i = 1; i <= FAILURES_TO_FALLBACK; i++) await board.fail(i);
        expect(board.sleeps).toContain(RETRY_MS);
        const calls = board.pollMatrix.mock.calls.length;
        s.stop();
        s.start();
        await vi.waitFor(() => expect(board.pollMatrix.mock.calls.length).toBe(calls + 1));
    });
});
