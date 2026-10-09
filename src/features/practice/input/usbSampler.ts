// Live · USB sampler (spec §3.2, §9.3): reads the board's switch matrix as fast as
// the USB queue allows, with exactly one request in flight, and its layer masks
// every third read. Samples and edges go into a 2 s ring buffer held here, never
// in React state: the UI reads only derived, change-only values (input/liveInput.ts).
//
// The reads are injected. Practice passes keyboardService.pollMatrix and
// getLayerStateMasks directly, never KeyboardContext's pollMatrix wrapper, which
// sets a heartbeat state on every poll and would re-render every useKeyboard()
// consumer (each Key.tsx, through useKeyDrag) about 100 times a second.
//
// Each sample is stamped ts = (t0 + t1) / 2 on the performance.now() clock, which
// is the clock of DOM event.timeStamp in Chromium (UNVERIFIED until M0, §9.3). An
// edge is a position that changed between two consecutive samples; its time is
// the later sample's ts, its uncertainty the interval between the two.
//
// Three failed reads in a row mark the sampler failed (Practice falls back to
// Keymap only) and it retries every 2 s for as long as it is wanted.

/** How much history the ring buffer keeps (§9.3). */
export const HISTORY_MS = 2000;
/** Layer masks are read on every third iteration (§9.3). */
export const MASK_EVERY = 3;
/** Consecutive failed reads before falling back to Keymap only (§9.3). */
export const FAILURES_TO_FALLBACK = 3;
/** Retry interval while failed (§9.3). */
export const RETRY_MS = 2000;
/** While reading is not allowed (Paranoid: the window isn't in front), check again this often. */
export const GATE_RECHECK_MS = 100;
/** Round trips kept for the percentiles. */
const RTT_WINDOW = 512;

export interface MatrixSample {
    /** Sample number since the sampler was created. */
    seq: number;
    /** Sample time: the middle of the request, on the performance.now() clock. */
    ts: number;
    /** Request sent. */
    t0: number;
    /** Reply received. */
    t1: number;
    /** 1 for each matrix index held down (index = row * cols + col). */
    down: Uint8Array;
}

export interface MatrixEdge {
    /** Unique per history, increasing. */
    id: number;
    /** Edge time: the later sample's ts. */
    t: number;
    /** Uncertainty: the interval since the previous sample. */
    dt: number;
    index: number;
    /** Press (0 → 1) or release (1 → 0). */
    press: boolean;
    /** The sample in which the change was seen. */
    sample: MatrixSample;
}

export interface MaskSample {
    ts: number;
    /** Active layer mask. */
    active: number;
    /** Default layer mask, or null when the board doesn't report it. */
    default: number | null;
    /** The matrix sample read just before these masks: which keys explain the active layers. */
    sample: MatrixSample | null;
}

/** The pressed matrix positions of a pollMatrix() reply, as a flat array. */
export function matrixToDown(matrix: readonly (readonly boolean[])[], rows: number, cols: number): Uint8Array {
    const down = new Uint8Array(rows * cols);
    for (let row = 0; row < rows && row < matrix.length; row++) {
        const bits = matrix[row];
        for (let col = 0; col < cols && col < bits.length; col++) if (bits[col]) down[row * cols + col] = 1;
    }
    return down;
}

/** The matrix and layer history of the last HISTORY_MS, with its edges. Pure: no I/O, no timers. */
export class MatrixHistory {
    readonly samples: MatrixSample[] = [];
    readonly edges: MatrixEdge[] = [];
    readonly masks: MaskSample[] = [];
    #seq = 0;
    #edgeId = 0;

    constructor(readonly size: number, readonly windowMs = HISTORY_MS) {}

    get latest(): MatrixSample | null {
        return this.samples.length ? this.samples[this.samples.length - 1] : null;
    }

    get latestMask(): MaskSample | null {
        return this.masks.length ? this.masks[this.masks.length - 1] : null;
    }

    /** Records a matrix read and returns the edges it shows against the previous one. */
    addSample(t0: number, t1: number, down: Uint8Array): { sample: MatrixSample; edges: MatrixEdge[] } {
        const previous = this.latest;
        const sample: MatrixSample = { seq: this.#seq++, ts: (t0 + t1) / 2, t0, t1, down };
        const edges: MatrixEdge[] = [];
        // The first sample is a baseline: a key already down when reading starts has no press edge.
        if (previous) {
            const dt = sample.ts - previous.ts;
            for (let index = 0; index < this.size; index++) {
                if (down[index] === previous.down[index]) continue;
                edges.push({ id: this.#edgeId++, t: sample.ts, dt, index, press: down[index] === 1, sample });
            }
        }
        this.samples.push(sample);
        this.edges.push(...edges);
        this.#prune(sample.ts);
        return { sample, edges };
    }

    addMasks(ts: number, active: number, defaultMask: number | null): MaskSample {
        const mask: MaskSample = { ts, active: active >>> 0, default: defaultMask == null ? null : defaultMask >>> 0, sample: this.latest };
        this.masks.push(mask);
        return mask;
    }

    /** The latest mask read at or before `t`, else the earliest one kept. */
    maskAt(t: number): MaskSample | null {
        for (let i = this.masks.length - 1; i >= 0; i--) if (this.masks[i].ts <= t) return this.masks[i];
        return this.masks[0] ?? null;
    }

    /** Edges with lo < t ≤ hi, oldest first. */
    edgesIn(lo: number, hi: number): MatrixEdge[] {
        return this.edges.filter((e) => e.t > lo && e.t <= hi);
    }

    /** The latest press edge of `index` before `t`. */
    pressBefore(index: number, t: number): MatrixEdge | null {
        for (let i = this.edges.length - 1; i >= 0; i--) {
            const e = this.edges[i];
            if (e.index === index && e.press && e.t < t) return e;
        }
        return null;
    }

    clear() {
        this.samples.length = 0;
        this.edges.length = 0;
        this.masks.length = 0;
    }

    #prune(now: number) {
        const cutoff = now - this.windowMs;
        // Keep one sample older than the window, as the baseline of the oldest edge kept.
        let drop = 0;
        while (drop < this.samples.length - 1 && this.samples[drop + 1].ts < cutoff) drop++;
        if (drop) this.samples.splice(0, drop);
        let edges = 0;
        while (edges < this.edges.length && this.edges[edges].t < cutoff) edges++;
        if (edges) this.edges.splice(0, edges);
        let masks = 0;
        while (masks < this.masks.length - 1 && this.masks[masks + 1].ts < cutoff) masks++;
        if (masks) this.masks.splice(0, masks);
    }
}

export interface LayerMasks {
    active: number;
    default: number | null;
}

export interface UsbSamplerDeps {
    /** keyboardService.pollMatrix(board): one VIA switch-matrix read. */
    pollMatrix: () => Promise<boolean[][]>;
    /** keyboardService.getLayerStateMasks(board). */
    getLayerMasks: () => Promise<LayerMasks>;
    rows: number;
    cols: number;
    /** performance.now(). */
    clock?: () => number;
    /** Checked before every read; false holds reading (Paranoid while the window isn't in front, a hidden tab). */
    canRead?: () => boolean;
    /** Resolves after `ms`. */
    sleep?: (ms: number) => Promise<void>;
}

export interface SamplerStats {
    /** Samples in the last second. */
    rate: number;
    /** Request round trip, ms. */
    rttP50: number | null;
    rttP95: number | null;
    samples: number;
    failures: number;
    failed: boolean;
}

function percentile(sorted: readonly number[], p: number): number | null {
    if (!sorted.length) return null;
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export class UsbSampler {
    readonly history: MatrixHistory;
    /** A matrix sample was recorded, with the edges it shows. */
    onSample: ((sample: MatrixSample, edges: readonly MatrixEdge[]) => void) | null = null;
    onMasks: ((mask: MaskSample) => void) | null = null;
    /** Failed or recovered (§9.3 Errors). */
    onHealth: ((failed: boolean) => void) | null = null;

    readonly #deps: Required<UsbSamplerDeps>;
    /** Generation: a loop runs while its generation is current. */
    #gen = 0;
    #running = false;
    #failures = 0;
    #failed = false;
    #samples = 0;
    #rtts: number[] = [];
    #loopDone: Promise<void> = Promise.resolve();

    constructor(deps: UsbSamplerDeps) {
        this.#deps = {
            ...deps,
            clock: deps.clock ?? (() => performance.now()),
            canRead: deps.canRead ?? (() => true),
            sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
        };
        this.history = new MatrixHistory(deps.rows * deps.cols);
    }

    get running(): boolean {
        return this.#running;
    }

    /** Three reads in a row failed; reading retries every RETRY_MS. */
    get failed(): boolean {
        return this.#failed;
    }

    start() {
        if (this.#running) return;
        this.#running = true;
        const gen = ++this.#gen;
        // A loop stopped a moment ago may still wait for its reply: start after it, so
        // there is never more than one request in flight.
        const previous = this.#loopDone;
        this.#loopDone = previous.then(() => this.#loop(gen)).catch((error) => {
            // A listener threw: stop rather than spin, and say why.
            console.warn("Practice sampler stopped:", error);
            if (gen === this.#gen) this.#running = false;
        });
    }

    /** Resolves when no loop is running (tests, and the lab's restart). */
    idle(): Promise<void> {
        return this.#loopDone;
    }

    /** Stops after the request in flight, if any; its reply is dropped. */
    stop() {
        if (!this.#running) return;
        this.#running = false;
        this.#gen++;
    }

    stats(): SamplerStats {
        const latest = this.history.latest;
        const rate = latest ? this.history.samples.filter((s) => s.ts > latest.ts - 1000).length : 0;
        const sorted = [...this.#rtts].sort((a, b) => a - b);
        return {
            rate, rttP50: percentile(sorted, 0.5), rttP95: percentile(sorted, 0.95),
            samples: this.#samples, failures: this.#failures, failed: this.#failed,
        };
    }

    #setFailed(failed: boolean) {
        if (failed === this.#failed) return;
        this.#failed = failed;
        this.onHealth?.(failed);
    }

    #fail(gen: number): boolean {
        if (gen !== this.#gen) return false;
        this.#failures++;
        if (this.#failures >= FAILURES_TO_FALLBACK) this.#setFailed(true);
        return this.#failed;
    }

    async #loop(gen: number) {
        const { clock, pollMatrix, getLayerMasks, canRead, sleep, rows, cols } = this.#deps;
        let iteration = 0;
        // A fresh run starts a fresh baseline: edges never span a stop.
        this.history.clear();
        while (gen === this.#gen) {
            if (!canRead()) {
                await sleep(GATE_RECHECK_MS);
                continue;
            }
            const t0 = clock();
            let matrix: boolean[][];
            try {
                matrix = await pollMatrix();
            } catch {
                if (this.#fail(gen)) await sleep(RETRY_MS);
                continue;
            }
            const t1 = clock();
            if (gen !== this.#gen) break;
            if (!matrix.length) {
                // KeyboardService reads nothing without a board: count it as a failure.
                if (this.#fail(gen)) await sleep(RETRY_MS);
                continue;
            }
            this.#failures = 0;
            this.#setFailed(false);
            this.#samples++;
            this.#rtts.push(t1 - t0);
            if (this.#rtts.length > RTT_WINDOW) this.#rtts.shift();
            const { sample, edges } = this.history.addSample(t0, t1, matrixToDown(matrix, rows, cols));
            this.onSample?.(sample, edges);
            if (iteration++ % MASK_EVERY === 0) {
                try {
                    const masks = await getLayerMasks();
                    if (gen !== this.#gen) break;
                    const mask = this.history.addMasks(clock(), masks.active, masks.default);
                    this.onMasks?.(mask);
                } catch {
                    if (this.#fail(gen)) await sleep(RETRY_MS);
                    continue;
                }
            }
            // No artificial delay (§9.3): a real WebHID read always yields to the event loop.
            // A read that came back within the same millisecond (a mock, a stalled queue)
            // yields a task anyway, so the loop can never starve the page.
            if (clock() - t0 < 1) await sleep(0);
        }
    }
}
