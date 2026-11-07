// Reads the trackball sensors' quality figures (POINTING_SENSOR, Sval 0x39) for the
// Trackball characterization panel. The board folds its sensor reads into 50 ms bins
// and keeps a few seconds; this keeps a minute of them per hand. It polls only while
// the panel holds it, and only reads: the board starts capturing on the first request
// and stops 1.5 s after the last.

import { PARANOID, userIsLooking } from "@/lib/paranoid";
import { seqDiff, type SensorBin, type SensorSamples } from "@/utils/pointing-sensor";

export const SENSOR_POLL_MS = 100;
/** Delay after SENSOR_MAX_MISSES empty or failed reads in a row. */
export const SENSOR_BACKOFF_MS = 1000;
export const SENSOR_MAX_MISSES = 3;
/** History kept per hand: 65 s of 50 ms bins. */
export const SENSOR_HISTORY_BINS = 1300;
/** Where reading starts when the panel opens: this many bins behind the head. */
export const SENSOR_START_BACK_BINS = 40;
const MAX_REPLIES_PER_POLL = 24;

export interface HandTrace {
    /** The board answered for this hand at least once since the panel opened. */
    seen: boolean;
    /** A PMW sensor runs on that hand. */
    present: boolean;
    is3389: boolean;
    /** The last reads failed or came back empty. */
    stale: boolean;
    bins: SensorBin[];
    head: number;
    /** SQUAL minimum and maximum count bins from this sequence on; null for all held. */
    resetSeq: number | null;
}

const emptyTrace = (): HandTrace => ({ seen: false, present: false, is3389: false, stale: false, bins: [], head: 0, resetSeq: null });

export interface SensorDeps {
    /** One SAMPLES read for a hand (0 left, 1 right) from the cursor; null on a failed or empty read. */
    read(hand: 0 | 1, cursor: number): Promise<SensorSamples | null>;
}

export class PointingSensorService {
    private traces: [HandTrace, HandTrace] = [emptyTrace(), emptyTrace()];
    private cursors: [number | null, number | null] = [null, null];
    private misses: [number, number] = [0, 0];
    private listeners = new Set<() => void>();
    private timer: ReturnType<typeof setTimeout> | undefined;
    private running = false;
    private generation = 0;
    private version = 0;

    constructor(private deps: SensorDeps) {}

    /** Starts polling; returns the stop function. */
    start(): () => void {
        this.generation++;
        this.running = true;
        this.traces = [emptyTrace(), emptyTrace()];
        this.cursors = [null, null];
        this.misses = [0, 0];
        this.emit();
        this.schedule(0);
        const generation = this.generation;
        return () => {
            if (generation !== this.generation) return;
            this.running = false;
            this.generation++;
            if (this.timer !== undefined) clearTimeout(this.timer);
            this.timer = undefined;
        };
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };

    /** Changes with every poll that brought news; for useSyncExternalStore. */
    snapshot = (): number => this.version;

    trace(hand: 0 | 1): HandTrace {
        return this.traces[hand];
    }

    /** Restarts the SQUAL minimum and maximum from the newest bin. */
    resetExtremes() {
        for (const t of this.traces) t.resetSeq = t.bins.length > 0 ? t.bins[t.bins.length - 1].seq : t.head;
        this.emit();
    }

    private emit() {
        this.version++;
        for (const l of this.listeners) l();
    }

    private schedule(delay: number) {
        if (this.timer !== undefined) clearTimeout(this.timer);
        this.timer = setTimeout(() => { this.timer = undefined; void this.tick(); }, delay);
    }

    private async tick() {
        if (!this.running) return;
        const generation = this.generation;
        const hidden = typeof document !== "undefined" && document.hidden;
        if (!hidden && !(PARANOID && !userIsLooking())) {
            for (const hand of [0, 1] as const) {
                await this.pollHand(hand, generation);
                if (generation !== this.generation) return;
            }
            this.emit();
        }
        if (generation !== this.generation) return;
        const allMissing = this.misses[0] >= SENSOR_MAX_MISSES && this.misses[1] >= SENSOR_MAX_MISSES;
        this.schedule(allMissing ? SENSOR_BACKOFF_MS : SENSOR_POLL_MS);
    }

    private async pollHand(hand: 0 | 1, generation: number) {
        const t = this.traces[hand];
        for (let i = 0; i < MAX_REPLIES_PER_POLL; i++) {
            let reply: SensorSamples | null = null;
            try {
                reply = await this.deps.read(hand, this.cursors[hand] ?? 0xffff);
            } catch {
                reply = null;
            }
            if (generation !== this.generation) return;
            if (!reply) {
                this.misses[hand]++;
                if (this.misses[hand] >= SENSOR_MAX_MISSES) t.stale = true;
                return;
            }
            this.misses[hand] = 0;
            t.stale = false;
            t.seen = true;
            t.present = reply.present;
            t.is3389 = reply.is3389;
            t.head = reply.head;
            const cursor = this.cursors[hand];
            if (cursor === null || seqDiff(reply.head, cursor) < -1) {
                // First read, or the board restarted its count: start near the head, with no old bins.
                t.bins = [];
                this.cursors[hand] = (reply.head - SENSOR_START_BACK_BINS) & 0xffff;
                if (cursor !== null) t.resetSeq = null;
                if (reply.more) continue;
                return;
            }
            const last = t.bins.length > 0 ? t.bins[t.bins.length - 1].seq : null;
            for (const b of reply.bins) {
                if (last !== null && seqDiff(b.seq, t.bins[t.bins.length - 1].seq) <= 0) continue;
                t.bins.push(b);
            }
            if (t.bins.length > SENSOR_HISTORY_BINS) t.bins.splice(0, t.bins.length - SENSOR_HISTORY_BINS);
            if (reply.bins.length > 0) this.cursors[hand] = (reply.bins[reply.bins.length - 1].seq + 1) & 0xffff;
            if (!reply.more || reply.bins.length === 0) return;
        }
    }
}
