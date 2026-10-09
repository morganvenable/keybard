// The M0 measurement session (spec §12 M0, §4.2): the Live · USB sampler and correlator run on their own
// against whatever the owner types into the lab's text box, with every keystroke's timing kept for the
// numbers in labStats.ts. It reads only while that box has focus and the tab is visible (D10), like
// Practice itself. Not React state: LabPage polls summary() a few times a second.
import type { KeymapResolution } from '../keymap/resolver';
import { type Attribution, attributeStep, EPSILON_MS, LiveKeymap, strayEdges } from './correlate';
import { type LabStep, type LabSummary, summarizeLab } from './labStats';
import { type LayerMasks, UsbSampler } from './usbSampler';

/** An edge is judged a stray once it is this old (every step that could use it has been attributed). */
const STRAY_AGE_MS = 500;

export interface LabDeps {
    pollMatrix: () => Promise<boolean[][]>;
    getLayerMasks: () => Promise<LayerMasks>;
    canRead?: () => boolean;
    clock?: () => number;
    sleep?: (ms: number) => Promise<void>;
}

export interface LabKeymap {
    resolution: KeymapResolution;
    keymap: readonly (readonly number[])[];
    rows: number;
    cols: number;
}

interface Pending {
    typed: number;
    tInput: number;
    tKeydown: number | null;
}

export class LabSession {
    readonly steps: LabStep[] = [];
    readonly sampler: UsbSampler;
    readonly #keymap: LiveKeymap;
    #pending: Pending[] = [];
    #consumed = new Set<number>();
    #judged = new Set<number>();
    #strays = 0;
    #tPrev: number | null = null;
    #lastKeydown: number | null = null;

    constructor(deps: LabDeps, { resolution, keymap, rows, cols }: LabKeymap) {
        this.#keymap = new LiveKeymap(resolution, keymap, rows, cols);
        this.sampler = new UsbSampler({ ...deps, rows, cols });
        this.sampler.onSample = () => this.#onSample();
    }

    get running(): boolean {
        return this.sampler.running;
    }

    start() {
        this.sampler.start();
    }

    /** Stops reading; what was typed is attributed from the history there is. */
    stop() {
        this.sampler.stop();
        this.#drain(Infinity);
    }

    reset() {
        this.steps.length = 0;
        this.#pending = [];
        this.#consumed = new Set();
        this.#judged = new Set();
        this.#strays = 0;
        this.#tPrev = null;
        this.#lastKeydown = null;
    }

    keydown(t: number, repeat: boolean) {
        if (!repeat) this.#lastKeydown = t;
    }

    /** A character the browser typed (an `input` event). */
    input(typed: number, tInput: number) {
        this.#pending.push({ typed, tInput, tKeydown: this.#lastKeydown });
        this.#lastKeydown = null;
        if (!this.running) this.#drain(Infinity);
    }

    summary(): LabSummary {
        return summarizeLab(this.steps, this.sampler.stats(), this.#strays);
    }

    /** Every step, for the raw-data copy. */
    raw() {
        return this.steps.map((s) => ({
            char: String.fromCodePoint(s.typed), tInput: round(s.tInput), tKeydown: s.tKeydown == null ? null : round(s.tKeydown),
            rule: s.attribution.rule, index: s.attribution.pressed?.index ?? null, layer: s.attribution.pressed?.layer ?? null,
            path: s.attribution.path?.key ?? null, edge: s.attribution.targetEdge == null ? null : round(s.attribution.targetEdge),
            edgeDt: s.edgeDt == null ? null : round(s.edgeDt), skew: s.attribution.skew == null ? null : round(s.attribution.skew),
            delayed: s.attribution.delayed, ltRoll: s.ltRoll, ltRelease: s.ltRelease == null ? null : round(s.ltRelease),
        }));
    }

    #onSample() {
        const latest = this.sampler.history.latest;
        if (!latest) return;
        this.#drain(latest.ts - EPSILON_MS);
        // Press edges old enough that no step can still use them: count the character-producing ones left over.
        const old = strayEdges(this.sampler.history, this.#keymap, this.#consumed, latest.ts - STRAY_AGE_MS)
            .filter((e) => !this.#judged.has(e.id));
        for (const edge of old) this.#judged.add(edge.id);
        this.#strays += old.length;
        for (const edge of this.sampler.history.edges) if (edge.t <= latest.ts - STRAY_AGE_MS) this.#judged.add(edge.id);
    }

    #drain(upTo: number) {
        while (this.#pending.length && this.#pending[0].tInput <= upTo) {
            const step = this.#pending.shift()!;
            const history = this.sampler.history;
            const attribution: Attribution = attributeStep(
                { typed: step.typed, expected: step.typed, tInput: step.tInput, tPrev: this.#tPrev }, history, this.#keymap, this.#consumed,
            );
            for (const id of attribution.consumed) this.#consumed.add(id);
            const target = attribution.consumed.length ? history.edges.find((e) => e.id === attribution.consumed[0]) : undefined;
            const ltRoll = !!attribution.path?.prereqs.some((p) => p.tapHold && p.kind === 'hold');
            const release = ltRoll && attribution.pressed && attribution.targetEdge != null
                ? history.edges.find((e) => !e.press && e.index === attribution.pressed!.index && e.t > attribution.targetEdge!)
                : undefined;
            this.steps.push({
                typed: step.typed, tInput: step.tInput, tKeydown: step.tKeydown, attribution,
                edgeDt: target?.dt ?? null, ltRoll, ltRelease: release?.t ?? null,
            });
            this.#tPrev = attribution.delayed && attribution.targetEdge != null ? attribution.targetEdge : step.tInput;
        }
    }
}

function round(v: number) {
    return Math.round(v * 10) / 10;
}
