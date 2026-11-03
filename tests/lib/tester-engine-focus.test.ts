import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FlickerCounts, FlickerRead } from "@/services/flicker-latch";
import { TesterEngine } from "@/lib/tester-engine";
import { EXIT_HOLD_MS, ExitHold } from "@/utils/tester-exit-key";

const ROWS = 10, COLS = 6;

/** A simulated board: switches held now, and the latch's backlog since the last read. */
function board(withLatch = true) {
    const raw = new Uint8Array(ROWS);
    const pressed = new Uint8Array(ROWS);
    const changes = new Uint8Array(ROWS * COLS);
    const state = { looking: true, latchReads: 0 };
    const down = (r: number, c: number) => {
        if (raw[r] & (1 << c)) return;
        raw[r] |= 1 << c;
        pressed[r] |= 1 << c;
        changes[r * COLS + c]++;
    };
    const up = (r: number, c: number) => {
        if (!(raw[r] & (1 << c))) return;
        raw[r] &= ~(1 << c);
        changes[r * COLS + c]++;
    };
    const readLatch = async (): Promise<FlickerRead> => {
        await new Promise((r) => setTimeout(r, 1));
        state.latchReads++;
        const read = { halves: 3, raw: raw.slice(), pressed: pressed.slice(), released: new Uint8Array(ROWS) };
        pressed.fill(0);
        return read;
    };
    const readCounts = async (half: number): Promise<FlickerCounts> => {
        await new Promise((r) => setTimeout(r, 1));
        const from = half * (ROWS / 2) * COLS, to = from + (ROWS / 2) * COLS;
        const out = changes.slice(from, to);
        changes.fill(0, from, to);
        return { half, changes: out };
    };
    const readMatrix = async () => {
        await new Promise((r) => setTimeout(r, 1));
        return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (raw[r] & (1 << c)) !== 0));
    };
    const engine = new TesterEngine(ROWS, COLS, {
        readLatch: withLatch ? readLatch : null,
        readCounts: withLatch ? readCounts : null,
        readMatrix,
        mayRead: () => state.looking,
    });
    return { engine, state, down, up };
}

const bit = (e: TesterEngine, a: Uint8Array, r: number, c: number) => ((a[r] >> c) & 1) === 1;
const settle = () => vi.advanceTimersByTimeAsync(250);

describe("TesterEngine across focus changes", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    for (const withLatch of [true, false]) {
        const name = withLatch ? "with the latch" : "VIA matrix state";

        it(`${name}: is live after its first reading, not before`, async () => {
            const { engine } = board(withLatch);
            expect(engine.live).toBe(false);
            engine.start();
            await settle();
            expect(engine.live).toBe(true);
            engine.stop();
        });

        it(`${name}: going away clears what shows down and is not live`, async () => {
            const { engine, state, down } = board(withLatch);
            engine.start();
            await settle();
            down(1, 1);
            await settle();
            expect(bit(engine, engine.current, 1, 1)).toBe(true);
            state.looking = false;
            engine.suspend();
            expect(engine.live).toBe(false);
            expect(bit(engine, engine.current, 1, 1)).toBe(false);
            expect(bit(engine, engine.latched, 1, 1)).toBe(false);
            engine.stop();
        });

        it(`${name}: keys pressed and released while away never latch, count or show as seen`, async () => {
            const { engine, state, down, up } = board(withLatch);
            engine.start();
            await settle();
            state.looking = false;
            engine.suspend();
            await settle();
            down(2, 3); up(2, 3);
            down(7, 1); up(7, 1);
            state.looking = true;
            engine.wake();
            await settle();
            expect(engine.live).toBe(true);
            for (const [r, c] of [[2, 3], [7, 1]]) {
                expect(bit(engine, engine.current, r, c)).toBe(false);
                expect(bit(engine, engine.latched, r, c)).toBe(false);
                expect(bit(engine, engine.seen, r, c)).toBe(false);
                expect(engine.presses[r * COLS + c]).toBe(0);
            }
            engine.stop();
        });

        it(`${name}: a key held while leaving and released while away is up on coming back`, async () => {
            const { engine, state, down, up } = board(withLatch);
            engine.start();
            await settle();
            down(1, 1);
            await settle();
            state.looking = false;
            engine.suspend();
            up(1, 1);
            state.looking = true;
            engine.wake();
            await settle();
            expect(bit(engine, engine.current, 1, 1)).toBe(false);
            expect(bit(engine, engine.latched, 1, 1)).toBe(false);
            engine.stop();
        });

        it(`${name}: a key held all the way through shows down and counts once`, async () => {
            const { engine, state, down } = board(withLatch);
            engine.start();
            await settle();
            down(1, 3);
            await settle();
            const before = engine.presses[1 * COLS + 3];
            state.looking = false;
            engine.suspend();
            await settle();
            state.looking = true;
            engine.wake();
            await settle();
            expect(bit(engine, engine.current, 1, 3)).toBe(true);
            expect(engine.presses[1 * COLS + 3]).toBe(before);
            engine.stop();
        });

        it(`${name}: presses keep counting as before once back`, async () => {
            const { engine, state, down, up } = board(withLatch);
            engine.start();
            await settle();
            down(2, 2); await settle(); up(2, 2); await settle();
            state.looking = false;
            engine.suspend();
            await settle();
            state.looking = true;
            engine.wake();
            await settle();
            down(2, 2);
            await settle();
            expect(bit(engine, engine.current, 2, 2)).toBe(true);
            expect(bit(engine, engine.seen, 2, 2)).toBe(true);
            up(2, 2);
            await settle();
            if (withLatch) expect(engine.presses[2 * COLS + 2]).toBe(2);
            engine.stop();
        });
    }

    it("drops a reply to a read sent before going away", async () => {
        const { engine, state, down } = board(true);
        engine.start();
        await settle();
        // The read in flight sees 4-4 down; the window loses focus before it lands.
        down(4, 4);
        engine.suspend();
        state.looking = false;
        await settle();
        expect(bit(engine, engine.current, 4, 4)).toBe(false);
        expect(bit(engine, engine.latched, 4, 4)).toBe(false);
        engine.stop();
    });

    for (const withLatch of [true, false]) {
        it(`${withLatch ? "with the latch" : "VIA matrix state"}: each fresh reading sets the baseline and bumps syncs`, async () => {
            const { engine, state, down } = board(withLatch);
            engine.start();
            await settle();
            expect(engine.syncs).toBe(1);
            expect(bit(engine, engine.baseline, 3, 4)).toBe(false);
            state.looking = false;
            engine.suspend();
            down(3, 4);
            await settle();
            state.looking = true;
            engine.wake();
            await settle();
            expect(engine.syncs).toBe(2);
            expect(bit(engine, engine.baseline, 3, 4)).toBe(true);
            engine.stop();
        });
    }

    it("does not read while away", async () => {
        const { engine, state } = board(true);
        engine.start();
        await settle();
        state.looking = false;
        engine.suspend();
        await settle();
        const reads = state.latchReads;
        await vi.advanceTimersByTimeAsync(1000);
        expect(state.latchReads).toBe(reads);
        engine.stop();
    });
});

describe("ExitHold", () => {
    it("counts a fresh press after the key was seen up", () => {
        const h = new ExitHold();
        expect(h.update(true, false, false, 0)).toBeNull();
        expect(h.update(true, true, true, 100)).toBe(EXIT_HOLD_MS);
        expect(h.update(true, true, true, 100 + EXIT_HOLD_MS - 1)).toBe(1);
        expect(h.update(true, true, true, 100 + EXIT_HOLD_MS)).toBe(0);
    });

    it("never counts before the first live reading", () => {
        const h = new ExitHold();
        expect(h.update(false, true, true, 0)).toBeNull();
        expect(h.update(false, true, true, 5000)).toBeNull();
    });

    it("needs the key up first when it is down at the first live reading", () => {
        const h = new ExitHold();
        expect(h.update(true, true, true, 0)).toBeNull();
        expect(h.update(true, true, true, 5000)).toBeNull();
        expect(h.update(true, false, false, 5100)).toBeNull();
        expect(h.update(true, true, true, 5200)).toBe(EXIT_HOLD_MS);
    });

    it("a hold carried across going away and coming back never closes", () => {
        const h = new ExitHold();
        h.update(true, false, false, 0);
        expect(h.update(true, true, true, 100)).toBe(EXIT_HOLD_MS);
        expect(h.update(false, true, true, 500)).toBeNull(); // away
        expect(h.update(true, true, true, 3000)).toBeNull(); // back, still held: no hold
        expect(h.update(true, true, true, 9000)).toBeNull();
        expect(h.update(true, false, false, 9100)).toBeNull(); // released
        expect(h.update(true, true, true, 9200)).toBe(EXIT_HOLD_MS); // a fresh press
    });

    it("the fallback pair: both must be up before a hold counts", () => {
        const h = new ExitHold();
        expect(h.update(true, false, true, 0)).toBeNull(); // one of the two held from the start
        expect(h.update(true, true, true, 100)).toBeNull(); // the other joins: not armed yet
        expect(h.update(true, false, false, 200)).toBeNull();
        expect(h.update(true, false, true, 300)).toBeNull();
        expect(h.update(true, true, true, 400)).toBe(EXIT_HOLD_MS);
    });

    it("arms from the fresh reading: a press that landed after it counts at once", () => {
        const h = new ExitHold();
        // Opening: Esc was up in the baseline, and is down by the first live frame.
        expect(h.update(true, true, true, 0, 1, false)).toBe(EXIT_HOLD_MS);
        expect(h.update(true, true, true, EXIT_HOLD_MS, 1, false)).toBe(0);
    });

    it("an Esc down in the fresh reading after coming back must go up first", () => {
        const h = new ExitHold();
        h.update(true, false, false, 0, 1, false);
        expect(h.update(true, true, true, 100, 1, false)).toBe(EXIT_HOLD_MS);
        expect(h.update(false, true, true, 500, 1, false)).toBeNull(); // away
        expect(h.update(true, true, true, 3000, 2, true)).toBeNull(); // back: down in the new baseline
        expect(h.update(true, true, true, 9000, 2, true)).toBeNull();
        expect(h.update(true, false, false, 9100, 2, true)).toBeNull();
        expect(h.update(true, true, true, 9200, 2, true)).toBe(EXIT_HOLD_MS);
    });

    it("releasing ends the hold; reset disarms", () => {
        const h = new ExitHold();
        h.update(true, false, false, 0);
        h.update(true, true, true, 100);
        expect(h.update(true, false, false, 600)).toBeNull();
        expect(h.update(true, true, true, 700)).toBe(EXIT_HOLD_MS);
        h.reset();
        expect(h.update(true, true, true, 800)).toBeNull();
    });
});
