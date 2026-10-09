// Live attribution (spec §6.5–§6.7, §9.3): matches each typed character to the
// matrix history the sampler recorded, so every keystroke knows the physical key
// and path that typed it.
//
// The DOM is the only source of characters; the matrix only annotates them.
// For a step typed at t_input, the correlator looks at the history over
// (t_step(previous), t_input + ε]. A fixed window around t_input would miss
// delayed output: with permissive hold a key reached under an undecided LT types
// on its release, often more than 60 ms after its press, and a tap-dance tap
// types after the tapping term.
//
// Rules, in order (§9.3 "Choose"):
//   1. a press edge whose key, under the effective layer at that edge, has a path
//      producing the character → observed, that path. Edges that can be before the
//      input are tried latest first, then those after it (a late sample) earliest
//      first, so a quick repeat keeps each press for its own step;
//   2. a release edge of a tap-side (LT/MT) key producing it → observed, delayed,
//      timed by its press edge;
//   3. the latest character-producing press edge → observed physical key (a miss
//      gets its §6.6 class from it);
//   4. nothing → inferred from the primary path.
//
// The effective layer at an edge comes from the matrix itself (§9.3): the default
// layer and the toggled or one-shot layers from the last mask, plus the layer of
// every MO and LT key down in the same sample. Masks are read only every third
// sample, so a mask alone would lag a fast MO(1) → target roll.
import { keyService } from '@/services/key.service';
import { classifyPress, type PressedKey } from './classify';
import { type KeymapResolution, layerAction, type Path, resolveBinding, type Shift, shiftRole, isTapHold } from '../keymap/resolver';
import type { ErrorClass } from '../types';
import { MAX_STEP_MS } from '../store/pack';
import type { MaskSample, MatrixEdge, MatrixHistory, MatrixSample } from './usbSampler';

/** Slack after the input event: an edge seen up to this long after it can still be its cause (§9.3; M0 tunes it). */
export const EPSILON_MS = 40;

export interface KeyAt {
    code: number;
    /** Layer the binding comes from (QMK transparency). */
    layer: number;
    /** A layer key (MO, LT, OSL) or a Shift key: a prerequisite, never a typed character on its own. */
    prereqKey: boolean;
    /** LT or mod-tap: its tap side types on release (rule 2). */
    tapHold: boolean;
}

/** The keymap as the correlator reads it: bindings, layer keys and the paths at each key. */
export class LiveKeymap {
    readonly size: number;
    readonly #names = new Map<number, string>();
    readonly #pathsAt = new Map<string, Path[]>();

    constructor(
        readonly resolution: KeymapResolution,
        readonly keymap: readonly (readonly number[])[],
        readonly rows: number,
        readonly cols: number,
        readonly stringify: (code: number) => string = (code) => keyService.stringify(code),
    ) {
        this.size = rows * cols;
        for (const paths of resolution.paths.values()) {
            for (const path of paths) {
                const key = `${path.layer}:${path.index}`;
                let list = this.#pathsAt.get(key);
                if (!list) this.#pathsAt.set(key, (list = []));
                list.push(path);
            }
        }
    }

    name(code: number): string {
        let name = this.#names.get(code);
        if (name === undefined) this.#names.set(code, (name = this.stringify(code)));
        return name;
    }

    keyAt(index: number, mask: number): KeyAt {
        const { code, layer } = resolveBinding(this.keymap, index, mask);
        const name = this.name(code);
        return { code, layer, prereqKey: layerAction(name) != null || shiftRole(name) != null, tapHold: isTapHold(name) };
    }

    /** Every path (of any character) whose target is this key on this layer. */
    pathsAt(layer: number, index: number): readonly Path[] {
        return this.#pathsAt.get(`${layer}:${index}`) ?? [];
    }

    /**
     * `base` plus the layers turned on by layer keys held in `down`: MO, the hold
     * side of LT (taken as held even before the firmware decides, §9.3) and OSL
     * while held, followed through the layers they turn on.
     */
    heldMask(down: Uint8Array, base: number): number {
        let mask = base >>> 0;
        for (let pass = 0; pass < 4; pass++) {
            let next = mask;
            for (let index = 0; index < this.size; index++) {
                if (!down[index]) continue;
                const action = layerAction(this.name(resolveBinding(this.keymap, index, next).code));
                if (action && action.toLayer < 32) next = (next | (1 << action.toLayer)) >>> 0;
            }
            if (next === mask) break;
            mask = next;
        }
        return mask;
    }

    /** A Shift key (or a Shift mod-tap) is held in `down` under `mask`. */
    shiftHeld(down: Uint8Array, mask: number): boolean {
        for (let index = 0; index < this.size; index++) {
            if (down[index] && shiftRole(this.name(resolveBinding(this.keymap, index, mask).code))) return true;
        }
        return false;
    }

    /** A layer key or Shift key is held in `down` under `mask`. */
    prereqHeld(down: Uint8Array, mask: number): boolean {
        for (let index = 0; index < this.size; index++) if (down[index] && this.keyAt(index, mask).prereqKey) return true;
        return false;
    }

    /** The default layer mask: the board's, else the keymap's default layer. */
    defaultMask(mask: MaskSample | null): number {
        return mask?.default != null && mask.default !== 0 ? mask.default : (1 << this.resolution.defaultLayer) >>> 0;
    }

    /**
     * Layers on in a mask read that no key held at that moment explains: toggles
     * (TG, TO, DF), one-shots waiting for their key, a stuck layer. Only the mask
     * can show these (§9.3 step 1).
     */
    unexplainedMask(mask: MaskSample): number {
        const base = this.defaultMask(mask);
        const held = mask.sample ? this.heldMask(mask.sample.down, base) : base;
        return (mask.active & ~held & ~base) >>> 0;
    }

    /** The effective layer mask at a matrix sample (§9.3 "Effective layer at an edge"). */
    effectiveMask(history: MatrixHistory, sample: MatrixSample): number {
        const mask = history.maskAt(sample.ts);
        const base = (this.defaultMask(mask) | (mask ? this.unexplainedMask(mask) : 0)) >>> 0;
        return this.heldMask(sample.down, base);
    }

    /**
     * The character a key types under `mask` with Shift held or not: the plain or
     * firmware-shifted output, or the user-shifted one when Shift is down.
     */
    charAt(index: number, layer: number, shiftDown: boolean): { char: number; shift: Shift } | null {
        const paths = this.pathsAt(layer, index);
        const pick = (shift: Shift) => paths.find((p) => p.shift === shift);
        const found = (shiftDown ? pick('u') : null) ?? pick('n') ?? pick('f');
        return found ? { char: found.char, shift: found.shift } : null;
    }
}

/** Top layer of a mask, or -1 for an empty mask. */
export function topLayer(mask: number): number {
    return mask === 0 ? -1 : 31 - Math.clz32(mask >>> 0);
}

export interface StepToAttribute {
    /** Code point the browser typed. */
    typed: number;
    /** Code point the lesson expected. */
    expected: number;
    /** DOM input event time stamp. */
    tInput: number;
    /** The previous step's time (its edge time when it was delayed), or null for the first. */
    tPrev: number | null;
}

export interface Attribution {
    /** §9.3 rule that matched (4: nothing did). */
    rule: 1 | 2 | 3 | 4;
    confidence: 'observed' | 'inferred';
    /** The path used (rules 1 and 2), else null. */
    path: Path | null;
    /** The key physically pressed (rules 1–3), with the effective layer and shift. */
    pressed: PressedKey | null;
    /** The character the pressed key types under the keymap (rules 1–3). */
    resolved: number | null;
    /** The target's press edge time (live timing, §6.5). */
    targetEdge: number | null;
    /** Output came on a release or after a delayed press (§6.5). */
    delayed: boolean;
    /** Prerequisite press edges for the path in the interval, earliest first (§6.5). */
    prereqEdges: MatrixEdge[];
    /** Matched edge time − input time, ms. */
    skew: number | null;
    /** Edge ids this step used (target and prerequisites). */
    consumed: number[];
    /** §6.6 class of a miss against the observed key; null for a hit or an inferred step. */
    errorClass: ErrorClass | null;
    /**
     * OS layout check (§3.1, §9.3): null when the step isn't eligible; else true
     * when the pressed key types something other than what the browser typed.
     */
    mismatch: boolean | null;
}

const INFERRED: Omit<Attribution, 'errorClass'> = {
    rule: 4, confidence: 'inferred', path: null, pressed: null, resolved: null, targetEdge: null,
    delayed: false, prereqEdges: [], skew: null, consumed: [], mismatch: null,
};

/** The step's search interval (§9.3): (t_step(previous), t_input + ε], never longer than a pause. */
export function stepInterval(step: Pick<StepToAttribute, 'tInput' | 'tPrev'>, epsilon = EPSILON_MS): [number, number] {
    const lo = Math.max(step.tPrev ?? -Infinity, step.tInput - MAX_STEP_MS);
    return [lo, step.tInput + epsilon];
}

/** Prerequisite press edges of `path` among `edges`, earliest first, one per key. */
function prereqEdgesFor(path: Path, edges: readonly MatrixEdge[], upTo: number): MatrixEdge[] {
    const wanted = new Set(path.prereqs.map((p) => p.index));
    const seen = new Set<number>();
    return edges
        .filter((e) => e.press && wanted.has(e.index) && e.t <= upTo)
        .sort((a, b) => a.t - b.t)
        .filter((e) => (seen.has(e.index) ? false : (seen.add(e.index), true)));
}

/**
 * Candidate edges in the order the rules try them: edges that may come before the input (its true time
 * lies in (t − dt, t]), latest first; then edges after it, earliest first. A press seen just after the
 * input (the sample came late) still matches, but never ahead of the press that came before it, so a
 * quick repeat ("ll") keeps each press for its own step.
 */
function candidateOrder(edges: readonly MatrixEdge[], tInput: number): MatrixEdge[] {
    const before = edges.filter((e) => e.t - e.dt <= tInput).sort((a, b) => b.t - a.t);
    const after = edges.filter((e) => e.t - e.dt > tInput).sort((a, b) => a.t - b.t);
    return [...before, ...after];
}

/** The best of several paths to one key: the one whose prerequisites are held, then the cheapest. */
function bestPath(candidates: readonly Path[], down: Uint8Array): Path {
    let best = candidates[0];
    let bestMissing = Infinity;
    for (const path of candidates) {
        const missing = path.prereqs.filter((p) => !down[p.index]).length;
        if (missing < bestMissing) {
            best = path;
            bestMissing = missing;
        }
    }
    return best;
}

/**
 * Attributes one step (§9.3). `consumed` holds edge ids earlier steps used; the
 * caller adds this step's `consumed` to it.
 */
export function attributeStep(
    step: StepToAttribute,
    history: MatrixHistory,
    keymap: LiveKeymap,
    consumed: ReadonlySet<number>,
    epsilon = EPSILON_MS,
): Attribution {
    const [lo, hi] = stepInterval(step, epsilon);
    const edges = history.edgesIn(lo, hi).filter((e) => !consumed.has(e.id));
    const presses = candidateOrder(edges.filter((e) => e.press), step.tInput);
    const expectedPath = keymap.resolution.primary(step.expected);
    const classify = (pressed: PressedKey): ErrorClass | null => {
        if (step.typed === step.expected) return null;
        return expectedPath ? classifyPress(expectedPath, pressed, keymap.cols) : 'unknown';
    };
    const eligible = (sample: MatrixSample, mask: number, delayed: boolean) => {
        // Only base-layer presses with nothing held and no delayed output count (§9.3).
        const base = keymap.defaultMask(history.maskAt(sample.ts));
        return mask === base && !delayed && !keymap.prereqHeld(sample.down, mask);
    };

    // Rule 1: a press whose key, under the effective layer at that edge, types the character.
    for (const edge of presses) {
        const mask = keymap.effectiveMask(history, edge.sample);
        const key = keymap.keyAt(edge.index, mask);
        const candidates = keymap.pathsAt(key.layer, edge.index).filter((p) => p.char === step.typed);
        if (!candidates.length) continue;
        const path = bestPath(candidates, edge.sample.down);
        const prereqEdges = prereqEdgesFor(path, edges, edge.t);
        const pressed: PressedKey = { index: edge.index, layer: key.layer, shift: path.shift };
        return {
            rule: 1, confidence: 'observed', path, pressed, resolved: path.char,
            targetEdge: edge.t, delayed: path.delayed, prereqEdges,
            skew: edge.t - step.tInput,
            consumed: [edge.id, ...prereqEdges.map((e) => e.id)],
            errorClass: classify(pressed),
            mismatch: eligible(edge.sample, mask, path.delayed || key.tapHold) ? false : null,
        };
    }

    // Rule 2: the tap side of an LT or mod-tap key types on its release.
    for (const edge of candidateOrder(edges.filter((e) => !e.press), step.tInput)) {
        const mask = keymap.effectiveMask(history, edge.sample);
        const key = keymap.keyAt(edge.index, mask);
        const path = keymap.pathsAt(key.layer, edge.index).find((p) => p.char === step.typed && p.emitsOnRelease);
        if (!path) continue;
        const press = history.pressBefore(edge.index, edge.t);
        const pressed: PressedKey = { index: edge.index, layer: key.layer, shift: path.shift };
        return {
            rule: 2, confidence: 'observed', path, pressed, resolved: path.char,
            targetEdge: press?.t ?? edge.t, delayed: true, prereqEdges: [],
            skew: edge.t - step.tInput,
            consumed: press && !consumed.has(press.id) ? [edge.id, press.id] : [edge.id],
            errorClass: classify(pressed),
            mismatch: null,
        };
    }

    // Rule 3: the latest press of a key that types a character.
    for (const edge of presses) {
        const mask = keymap.effectiveMask(history, edge.sample);
        const key = keymap.keyAt(edge.index, mask);
        if (key.prereqKey || key.tapHold) continue;
        const char = keymap.charAt(edge.index, key.layer, keymap.shiftHeld(edge.sample.down, mask));
        if (!char) continue;
        const pressed: PressedKey = { index: edge.index, layer: key.layer, shift: char.shift };
        return {
            rule: 3, confidence: 'observed', path: null, pressed, resolved: char.char,
            targetEdge: edge.t, delayed: false, prereqEdges: [],
            skew: edge.t - step.tInput,
            consumed: [edge.id],
            errorClass: classify(pressed),
            mismatch: eligible(edge.sample, mask, false) ? char.char !== step.typed : null,
        };
    }

    // Rule 4: a tap that fell between samples, or no history: inferred from the keymap.
    return { ...INFERRED, errorClass: null };
}

/**
 * Character-producing press edges no step used, up to `upTo` (§6.6 Strays):
 * modifiers, layer keys, tap-hold keys and keys that type nothing (Backspace,
 * navigation) are never strays.
 * TODO(practice): M4 records these as `stray` keystrokes and in the heatmap's Errors metric.
 */
export function strayEdges(history: MatrixHistory, keymap: LiveKeymap, consumed: ReadonlySet<number>, upTo: number): MatrixEdge[] {
    return history.edges.filter((edge) => {
        if (!edge.press || consumed.has(edge.id) || edge.t > upTo) return false;
        const mask = keymap.effectiveMask(history, edge.sample);
        const key = keymap.keyAt(edge.index, mask);
        if (key.prereqKey || key.tapHold) return false;
        return keymap.charAt(edge.index, key.layer, keymap.shiftHeld(edge.sample.down, mask)) != null;
    });
}

/** OS layout mismatch counter (§3.1): at least 5 of the last 20 eligible steps. */
export class MismatchCounter {
    readonly #window: boolean[] = [];

    constructor(readonly size = 20, readonly threshold = 5) {}

    /** Counts a step's `mismatch` (null: not eligible, ignored). */
    add(mismatch: boolean | null) {
        if (mismatch == null) return;
        this.#window.push(mismatch);
        if (this.#window.length > this.size) this.#window.shift();
    }

    get count(): number {
        return this.#window.filter(Boolean).length;
    }

    /** The notice should show. TODO(practice): M4 shows it (§5.3 OS layout mismatch). */
    get triggered(): boolean {
        return this.count >= this.threshold;
    }

    reset() {
        this.#window.length = 0;
    }
}
