// The matrix tester's reading loop, outside React (MatrixTester.tsx draws from it).
//
// It reads the board as fast as the link allows: the next request goes out as soon
// as the last reply lands, with no fixed interval. Requests share Keybard's one
// USB queue; while the tester is open Keybard's own polls (layer state, late
// pointing detection, Scan Lab status) wait (matrix-tester-lock), so only the
// tester's reads, its counts and the typing pause renewal use the link. An edit
// queued meanwhile still goes first; the tester never starves it. Opening
// starts the counts at zero (discardBacklog). With the flicker latch (Sval 0x3D) each
// read also returns every switch that went down since the last read, so a
// bounce of one scan between two reads still shows; without it, the debounced
// VIA matrix state is read instead. Readings land in plain typed arrays and a
// version number; the drawing loop takes them once per displayed frame.
//
// It reads only while Keybard is in front of you (mayRead: the window has focus
// and the tab is visible), which is also when the board's typing is paused.
// Away from it the board types into the other app, so nothing pressed then is
// a test. Going away clears what shows down (suspend) and drops any read still
// in flight. Coming back starts again from a fresh reading, as opening does:
// the latch's backlog (everything pressed while away) is read and dropped and
// only the raw rows are kept, so nothing that changed while away lights,
// counts or shows as seen. Until that fresh reading lands, `live` is false.

import type { FlickerCounts, FlickerRead } from "@/services/flicker-latch";
import { pressesFrom } from "@/services/flicker-latch";

export interface TesterSource {
    /** The flicker latch read, or null on firmware without it. */
    readLatch: (() => Promise<FlickerRead | null>) | null;
    /** One half's change counts (with the latch only). */
    readCounts: ((half: number) => Promise<FlickerCounts | null>) | null;
    /** VIA matrix state, rows of booleans (without the latch). */
    readMatrix: () => Promise<boolean[][]>;
    /** False while Keybard isn't in front of you: the window lost focus, or the tab is hidden. */
    mayRead: () => boolean;
}

/** How often the change counts are read, with the latch. */
export const COUNTS_EVERY_MS = 100;
/** How often a suspended engine checks whether you are back (wake() is sooner). */
export const AWAY_CHECK_MS = 100;
/**
 * The pause after a failed read before the next try. A read can fail at once
 * without waiting on the board (after the device closes), so without it the
 * loop would never yield and the tab would freeze.
 */
export const RETRY_MS = 50;

export class TesterEngine {
    readonly rows: number;
    readonly cols: number;
    /** Switches down at the last read, one byte per row, bit = column. */
    readonly current: Uint8Array;
    /** Switches that went down since the last displayed frame; the frame clears it. */
    readonly latched: Uint8Array;
    /** Switches seen down since the tester opened or Clear. */
    readonly seen: Uint8Array;
    /** Presses per switch since the tester opened or Reset counts (with the latch). */
    readonly presses: Uint16Array;
    /** Bumps whenever current, latched or seen changes. */
    version = 0;
    /** Bumps whenever a press count changes. */
    countsVersion = 0;
    /** Reads completed, and when the first one started, for the reads-per-second figure. */
    reads = 0;
    readStart = 0;
    lastRoundTripMs = 0;
    /**
     * True once a reading taken while you are looking has landed: false from
     * opening until the first one, and from going away until the fresh reading
     * after coming back. The exit hold counts only while live.
     */
    live = false;
    /**
     * The fresh reading taken on opening and on each return (the baseline
     * everything after it is compared with), and a number that bumps with each
     * one. A key down in it was down before this stretch of looking began.
     */
    readonly baseline: Uint8Array;
    syncs = 0;

    private running = false;
    private countsBase: Uint8Array;
    private lastCounts = 0;
    /** Bumps on every suspend; a reply to a request sent before it is dropped. */
    private epoch = 0;
    private suspended = false;
    private wakeUp: (() => void) | null = null;

    constructor(rows: number, cols: number, private readonly source: TesterSource) {
        this.rows = rows;
        this.cols = cols;
        this.current = new Uint8Array(rows);
        this.latched = new Uint8Array(rows);
        this.seen = new Uint8Array(rows);
        this.presses = new Uint16Array(rows * cols);
        this.countsBase = new Uint8Array(rows);
        this.baseline = new Uint8Array(rows);
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        void this.loop();
    }

    stop(): void {
        this.running = false;
        this.wake();
    }

    /**
     * Keybard went out of view: nothing is known to be down any more. Clears
     * what shows, drops any read in flight and waits for a fresh reading
     * before anything shows again. Calling it again while away does nothing.
     */
    suspend(): void {
        this.live = false;
        if (this.suspended) return;
        this.suspended = true;
        this.epoch++;
        this.current.fill(0);
        this.latched.fill(0);
        this.version++;
    }

    /** Keybard is back in view: stop waiting and read now. */
    wake(): void {
        const w = this.wakeUp;
        this.wakeUp = null;
        w?.();
    }

    clearSeen(): void {
        this.seen.fill(0);
        for (let r = 0; r < this.rows; r++) this.seen[r] = this.current[r];
        this.version++;
    }

    resetCounts(): void {
        this.presses.fill(0);
        this.countsVersion++;
    }

    /** A flicker latch reading: the raw rows, and every switch that went down since the last read. */
    applyLatch(read: FlickerRead): void {
        let changed = false;
        for (let r = 0; r < this.rows && r < read.raw.length; r++) {
            const block = r < this.rows / 2 ? 1 : 2;
            if (!(read.halves & block)) continue; // that half didn't answer: keep what it last showed
            const raw = read.raw[r], down = read.pressed[r];
            if (raw !== this.current[r] || down) changed = true;
            this.current[r] = raw;
            this.latched[r] |= down | raw;
            this.seen[r] |= down | raw;
        }
        if (changed) this.version++;
    }

    /** A VIA matrix reading (debounced; firmware without the latch). */
    applyMatrix(matrix: boolean[][]): void {
        let changed = false;
        for (let r = 0; r < this.rows && r < matrix.length; r++) {
            let bits = 0;
            matrix[r].forEach((down, c) => { if (down && c < 8) bits |= 1 << c; });
            if (bits !== this.current[r]) changed = true;
            this.current[r] = bits;
            this.latched[r] |= bits;
            this.seen[r] |= bits;
        }
        if (changed) this.version++;
    }

    /** One half's change counts, as presses (rows of that half only). */
    applyCounts(counts: FlickerCounts): void {
        const halfRows = this.rows / 2;
        let changed = false;
        for (let i = 0; i < counts.changes.length && i < halfRows * this.cols; i++) {
            const changes = counts.changes[i];
            if (!changes) continue;
            const r = counts.half * halfRows + Math.floor(i / this.cols), c = i % this.cols;
            const wasDown = ((this.countsBase[r] >> c) & 1) === 1;
            const n = pressesFrom(changes, wasDown);
            if (n) {
                this.presses[r * this.cols + c] = Math.min(0xffff, this.presses[r * this.cols + c] + n);
                changed = true;
            }
        }
        for (let r = counts.half * halfRows; r < (counts.half + 1) * halfRows; r++) this.countsBase[r] = this.current[r];
        if (changed) this.countsVersion++;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            const t = setTimeout(() => { this.wakeUp = null; resolve(); }, ms);
            this.wakeUp = () => { clearTimeout(t); resolve(); };
        });
    }

    /**
     * Opening the tester starts the counts from zero; coming back starts from
     * now. The board's latch keeps collecting while nobody reads it (its change
     * counts saturate), so one latch read and one counts read per half go first
     * and only the raw rows are kept: the keys held now show at once, but
     * nothing from before lights, counts or shows as seen. Without the latch
     * there is no backlog, and one VIA read is the fresh reading. Returns
     * false when Keybard went away again meanwhile, or a read failed: a failed
     * latch read leaves the backlog on the board, so it isn't a fresh start.
     */
    private async discardBacklog(resetPresses: boolean): Promise<boolean> {
        const epoch = this.epoch;
        const gone = () => !this.running || epoch !== this.epoch;
        if (resetPresses) {
            this.presses.fill(0);
            this.countsVersion++;
        }
        if (!this.source.readLatch) {
            try {
                const matrix = await this.source.readMatrix();
                if (gone()) return false;
                this.applyMatrix(matrix);
            } catch (error) {
                console.error("Matrix tester read failed:", error);
                return false;
            }
            this.baseline.set(this.current);
            this.syncs++;
            return true;
        }
        try {
            const read = await this.source.readLatch();
            if (gone()) return false;
            if (read) {
                for (let r = 0; r < this.rows && r < read.raw.length; r++) {
                    const block = r < this.rows / 2 ? 1 : 2;
                    if (!(read.halves & block)) continue;
                    this.current[r] = read.raw[r];
                    this.latched[r] |= read.raw[r];
                    this.seen[r] |= read.raw[r];
                }
                this.version++;
            }
            if (this.source.readCounts) {
                for (const half of [0, 1]) {
                    await this.source.readCounts(half);
                    if (gone()) return false;
                }
            }
        } catch (error) {
            console.error("Matrix tester: clearing the board's latch failed:", error);
            return false;
        }
        this.countsBase.set(this.current);
        this.lastCounts = performance.now();
        if (resetPresses) {
            this.presses.fill(0);
            this.countsVersion++;
        }
        this.baseline.set(this.current);
        this.syncs++;
        return true;
    }

    private async loop(): Promise<void> {
        // Opening: a fresh start whether or not you are looking yet.
        let resync: "open" | "back" | null = "open";
        this.presses.fill(0);
        this.countsVersion++;
        this.readStart = performance.now();
        this.reads = 0;
        while (this.running) {
            if (!this.source.mayRead()) {
                this.suspend();
                await this.sleep(AWAY_CHECK_MS);
                continue;
            }
            if (this.suspended) {
                this.suspended = false;
                if (resync !== "open") resync = "back";
            }
            if (resync) {
                const opening = resync === "open";
                if (!(await this.discardBacklog(opening))) {
                    // Away again, stopped, or a read failed: pause before trying again.
                    if (this.running && this.source.mayRead()) await this.sleep(RETRY_MS);
                    continue;
                }
                if (opening) {
                    this.readStart = performance.now();
                    this.reads = 0;
                }
                resync = null;
            }
            const epoch = this.epoch;
            const t = performance.now();
            try {
                if (this.source.readLatch) {
                    const read = await this.source.readLatch();
                    if (!this.running) return;
                    if (epoch !== this.epoch) continue; // went away mid-read: drop it
                    if (read) this.applyLatch(read);
                    if (this.source.readCounts && t - this.lastCounts >= COUNTS_EVERY_MS) {
                        this.lastCounts = t;
                        for (const half of [0, 1]) {
                            const counts = await this.source.readCounts(half);
                            if (!this.running) return;
                            if (epoch !== this.epoch) break;
                            if (counts) this.applyCounts(counts);
                        }
                        if (epoch !== this.epoch) continue;
                    }
                } else {
                    const matrix = await this.source.readMatrix();
                    if (!this.running) return;
                    if (epoch !== this.epoch) continue;
                    this.applyMatrix(matrix);
                }
                this.live = true;
                this.reads++;
                this.lastRoundTripMs = performance.now() - t;
            } catch (error) {
                console.error("Matrix tester read failed:", error);
                await this.sleep(RETRY_MS);
            }
        }
    }
}
