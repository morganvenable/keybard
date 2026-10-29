// The matrix tester's reading loop, outside React (MatrixTester.tsx draws from it).
//
// It reads the board as fast as the link allows: the next request goes out as soon
// as the last reply lands, with no fixed interval. Requests share Keybard's one
// USB queue, so anything else queued meanwhile (the layer poll, an edit) goes
// first; the tester never starves it. With the flicker latch (Sval 0x3D) each
// read also returns every switch that went down since the last read, so a
// bounce of one scan between two reads still shows; without it, the debounced
// VIA matrix state is read instead. Readings land in plain typed arrays and a
// version number; the drawing loop takes them once per displayed frame.

import type { FlickerCounts, FlickerRead } from "@/services/flicker-latch";
import { pressesFrom } from "@/services/flicker-latch";

export interface TesterSource {
    /** The flicker latch read, or null on firmware without it. */
    readLatch: (() => Promise<FlickerRead | null>) | null;
    /** One half's change counts (with the latch only). */
    readCounts: ((half: number) => Promise<FlickerCounts | null>) | null;
    /** VIA matrix state, rows of booleans (without the latch). */
    readMatrix: () => Promise<boolean[][]>;
    /** False while reading must wait: the tab is hidden, or Paranoid and you aren't looking. */
    mayRead: () => boolean;
}

/** How often the change counts are read, with the latch. */
export const COUNTS_EVERY_MS = 100;

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

    private running = false;
    private countsBase: Uint8Array;
    private lastCounts = 0;

    constructor(rows: number, cols: number, private readonly source: TesterSource) {
        this.rows = rows;
        this.cols = cols;
        this.current = new Uint8Array(rows);
        this.latched = new Uint8Array(rows);
        this.seen = new Uint8Array(rows);
        this.presses = new Uint16Array(rows * cols);
        this.countsBase = new Uint8Array(rows);
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        void this.loop();
    }

    stop(): void {
        this.running = false;
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

    private async loop(): Promise<void> {
        this.readStart = performance.now();
        this.reads = 0;
        while (this.running) {
            if (!this.source.mayRead()) {
                await new Promise((r) => setTimeout(r, 100));
                continue;
            }
            const t = performance.now();
            try {
                if (this.source.readLatch) {
                    const read = await this.source.readLatch();
                    if (!this.running) return;
                    if (read) this.applyLatch(read);
                    if (this.source.readCounts && t - this.lastCounts >= COUNTS_EVERY_MS) {
                        this.lastCounts = t;
                        for (const half of [0, 1]) {
                            const counts = await this.source.readCounts(half);
                            if (!this.running) return;
                            if (counts) this.applyCounts(counts);
                        }
                    }
                } else {
                    const matrix = await this.source.readMatrix();
                    if (!this.running) return;
                    this.applyMatrix(matrix);
                }
                this.reads++;
                this.lastRoundTripMs = performance.now() - t;
            } catch (error) {
                console.error("Matrix tester read failed:", error);
                await new Promise((r) => setTimeout(r, 50));
            }
        }
    }
}
