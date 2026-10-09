// Time to type, normalized by physical presses (spec §6.5, DECISION D6). This
// replaces keybr's timetotype.ts, which divides by the OS-visible Shift, Alt,
// AltGraph and Dead keydowns: layer holds are invisible to the OS, and firmware
// Shift (KC_EXLM is LSFT(KC_1)) looks like a press.
//
//   t_step(c)     = DOM input time (live delayed-output steps: the target's press edge)
//   raw           = t_step(c) − t_step(previous step)
//   presses       = 1 + newPrereqs(c)
//   timeToType(c) = raw / presses, or null when raw > 2,000 ms (a pause)
//
// newPrereqs counts only prerequisite presses made for this character: live, the
// prerequisite press edges in (t_step(previous), t_step(c)]; keymap only, the
// prerequisites of c's path that the previous step's path did not have. A hold
// kept down through several characters therefore counts once, on the first.
import type { Path, Prereq } from '../keymap/resolver';
import { MAX_STEP_MS } from '../store/pack';

export interface PressEdge {
    /** Edge time on the DOM clock, ms. */
    t: number;
    /** Matrix index pressed. */
    index: number;
}

export interface StepInput {
    /** DOM `input` event time stamp, ms. */
    tInput: number;
    /** Path the step was typed with: observed live, else the primary path. */
    path: Path | null;
    /** Live only: the target's press edge, when the correlator matched one. */
    targetEdge?: number | null;
    /** Live only: the emission was matched to a release or a delayed press (§9.3). */
    delayed?: boolean;
    /** Live only: prerequisite press edges for this path, observed since the previous step. */
    prereqEdges?: readonly PressEdge[];
}

export interface StepTiming {
    tStep: number;
    raw: number;
    presses: number;
    /** Matrix indices of the new prerequisites, in press order. */
    newPrereqs: number[];
    /** Normalized time to type; null for the first step and for pauses. */
    ttt: number | null;
    /** Live: previous step → first new prerequisite edge (layer reach). */
    reach: number | null;
    /** Live: last new prerequisite edge (or the previous step) → target edge. */
    target: number | null;
}

/** Keymap only: prerequisites of `path` that `previous` did not already hold. */
export function newPrereqsKeymapOnly(path: Path | null, previous: Path | null): Prereq[] {
    if (!path) return [];
    const held = new Set((previous?.prereqs ?? []).filter((p) => p.kind !== 'oneshot').map((p) => p.index));
    // A one-shot layer is released by the key it applies to, so it is pressed again every time.
    return path.prereqs.filter((p) => p.kind === 'oneshot' || !held.has(p.index));
}

/** Live: prerequisite press edges of `path` in (tPrev, tStep], earliest first, one per key. */
export function newPrereqsLive(path: Path | null, edges: readonly PressEdge[], tPrev: number, tStep: number): PressEdge[] {
    if (!path) return [];
    const wanted = new Set(path.prereqs.map((p) => p.index));
    const seen = new Set<number>();
    return [...edges]
        .filter((e) => wanted.has(e.index) && e.t > tPrev && e.t <= tStep)
        .sort((a, b) => a.t - b.t)
        .filter((e) => (seen.has(e.index) ? false : (seen.add(e.index), true)));
}

/** Stateful per lesson: feed every completed step in order. */
export class PracticeTimeToType {
    #previous: { tStep: number; path: Path | null } | null = null;

    reset() {
        this.#previous = null;
    }

    measure(step: StepInput): StepTiming {
        const live = step.prereqEdges !== undefined || step.targetEdge != null;
        const tStep = live && step.targetEdge != null && (step.delayed || step.path?.delayed) ? step.targetEdge : step.tInput;
        const previous = this.#previous;
        this.#previous = { tStep, path: step.path };
        if (!previous) {
            return { tStep, raw: 0, presses: 1 + (step.path?.prereqs.length ?? 0), newPrereqs: (step.path?.prereqs ?? []).map((p) => p.index), ttt: null, reach: null, target: null };
        }
        const raw = tStep - previous.tStep;
        let newPrereqs: number[];
        let reach: number | null = null;
        let target: number | null = null;
        if (live) {
            const edges = newPrereqsLive(step.path, step.prereqEdges ?? [], previous.tStep, tStep);
            newPrereqs = edges.map((e) => e.index);
            if (edges.length) reach = edges[0].t - previous.tStep;
            if (step.targetEdge != null) target = step.targetEdge - (edges.length ? edges[edges.length - 1].t : previous.tStep);
        } else {
            newPrereqs = newPrereqsKeymapOnly(step.path, previous.path).map((p) => p.index);
        }
        const presses = 1 + newPrereqs.length;
        return { tStep, raw, presses, newPrereqs, ttt: raw > MAX_STEP_MS ? null : raw / presses, reach, target };
    }
}
