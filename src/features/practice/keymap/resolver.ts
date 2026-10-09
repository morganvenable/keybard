// Keymap resolution: character → physical paths (spec §9.4).
//
// A path is the key that types a character (matrix index, the layer it is bound
// on, and where Shift comes from) plus the prerequisite presses that reach it:
// layer holds (MO, LT hold side), one-shot layers (OSL) and user Shift. Every
// character can have several paths; the cheapest is its primary path. Stats are
// keyed by path key "<layer>:<index>:<shift>", which names the target key only,
// so moving a layer key never restarts the characters behind it (§6.1).
//
// Layer and modifier keys are recognized from their QMK keycode names
// (keyService.stringify), which stay the same across keycode numberings; firmware
// Shift is read from the keycode bits (§9.4 step 3).
import { getLabelForKeycode } from '@/components/Keyboards/layouts';
import { keyService } from '@/services/key.service';
import { placeOf } from './geometry';
import { whitespaceFor } from './whitespace';

/** Where Shift comes from: none, the keycode's own modifier bits (firmware), or a Shift key (user). */
export type Shift = 'n' | 'f' | 'u';

export type PrereqKind = 'hold' | 'oneshot' | 'shift';

export interface Prereq {
    kind: PrereqKind;
    /** Matrix index of the prerequisite key. */
    index: number;
    /** Layer the prerequisite key is bound on. */
    layer: number;
    /** Layer a hold or one-shot turns on. */
    toLayer?: number;
    code: number;
    /** A tap-hold key (LT, or a Shift mod-tap) held for its hold side: output can be delayed (§6.7). */
    tapHold: boolean;
}

export interface Path {
    /** Unicode code point typed. */
    char: number;
    /** Layer the target key is bound on (the effective layer when it is pressed). */
    layer: number;
    /** Matrix index of the target key. */
    index: number;
    shift: Shift;
    /** "<layer>:<index>:<shift>" (§6.1). */
    key: string;
    /** Layer prerequisites in press order, then user Shift. */
    prereqs: readonly Prereq[];
    cost: number;
    /** Keycode bound at the target position. */
    code: number;
    /** Tap side of an LT/MT key: the character is typed on release. */
    emitsOnRelease: boolean;
    /** Output can come after the target's press edge: tap side, or under a tap-hold prerequisite (§6.5). */
    delayed: boolean;
}

export interface KeymapSource {
    keymap: readonly (readonly number[])[];
    rows: number;
    cols: number;
}

export interface ResolveOptions {
    /** Default layer (live mask, or 0). */
    defaultLayer?: number;
    /** Keybard's OS layout id (`internationalLayout`), e.g. "us". */
    layoutId?: string;
    /** Most layer prerequisites on one path (§9.4: 2). */
    maxHolds?: number;
    /** Overrides for tests. */
    stringify?: (code: number) => string;
    label?: (keycode: string, layoutId: string) => string | null;
}

/** Cost of each part of a path (§9.4 step 4). */
export const PATH_COSTS = {
    press: 1,
    hold: 0.5,
    layerTapHold: 0.8,
    oneshot: 0.75,
    shift: 0.5,
    /** A Shift mod-tap held for Shift: priced like an LT hold (delayed output, misfire risk). */
    shiftTapHold: 0.8,
    direction: { C: 0, N: 0.1, S: 0.1, E: 0.2, W: 0.2, '2S': 0.3, thumb: 0.15 },
} as const;

export const KC_TRNS = 1;
const SHIFT_ORDER: Record<Shift, number> = { n: 0, f: 1, u: 2 };

export function pathKey(layer: number, index: number, shift: Shift): string {
    return `${layer}:${index}:${shift}`;
}

export function parsePathKey(key: string): { layer: number; index: number; shift: Shift } | null {
    const m = /^(\d+):(\d+):([nfu])$/.exec(key);
    return m ? { layer: Number(m[1]), index: Number(m[2]), shift: m[3] as Shift } : null;
}

/** QMK transparency: the highest active layer whose binding is not KC_TRNS. */
export function resolveBinding(keymap: KeymapSource['keymap'], index: number, mask: number): { code: number; layer: number } {
    for (let layer = 31; layer >= 0; layer--) {
        if (((mask >>> layer) & 1) === 0 || !keymap[layer]) continue;
        const code = keymap[layer][index];
        if (code !== undefined && code !== KC_TRNS) return { code, layer };
    }
    let lowest = 0;
    while (lowest < 31 && ((mask >>> lowest) & 1) === 0) lowest++;
    return { code: keymap[lowest]?.[index] ?? 0, layer: lowest };
}

type LayerAction = { kind: 'hold' | 'oneshot'; toLayer: number; tapHold: boolean };

/** MO(n), LT(n, kc) hold side and OSL(n). TG/TO/DF/TT are modes, not chords: excluded (§9.4). */
export function layerAction(name: string): LayerAction | null {
    let m = /^MO\((\d+)\)$/.exec(name);
    if (m) return { kind: 'hold', toLayer: Number(m[1]), tapHold: false };
    m = /^LT(\d+)\(.*\)$/.exec(name) ?? /^LT\((\d+),.*\)$/.exec(name);
    if (m) return { kind: 'hold', toLayer: Number(m[1]), tapHold: true };
    m = /^OSL\((\d+)\)$/.exec(name);
    if (m) return { kind: 'oneshot', toLayer: Number(m[1]), tapHold: false };
    return null;
}

function isLayerTap(name: string) {
    return /^LT\d+\(.*\)$/.test(name) || /^LT\(\d+,.*\)$/.test(name);
}

function isModTap(name: string) {
    return /^\w+_T\(.*\)$/.test(name) || /^MT\(.*\)$/.test(name);
}

/** Shift keys, and mod-taps whose hold side is Shift alone. */
export function shiftRole(name: string): { tapHold: boolean } | null {
    if (/^KC_(L|R)S(HIFT|FT)$/.test(name)) return { tapHold: false };
    if (/^(L|R)?SFT_T\(.*\)$/.test(name)) return { tapHold: true };
    return null;
}

/** QMK basic-keycode modifier bits: Shift alone, left (0x02) or right (0x12). */
function isShiftOnlyMods(code: number) {
    const mods = (code >> 8) & 0x1f;
    return mods === 0x02 || mods === 0x12;
}

interface Output {
    char: number;
    shift: Shift;
    emitsOnRelease: boolean;
}

function singleChar(label: string | null): number | null {
    if (!label) return null;
    const chars = [...label];
    return chars.length === 1 ? chars[0].codePointAt(0)! : null;
}

interface LayerState {
    mask: number;
    held: number[];
    prereqs: Prereq[];
    cost: number;
}

/** The result of resolving one keymap. */
export class KeymapResolution {
    /** Paths per character, cheapest (primary) first. */
    readonly paths: ReadonlyMap<number, readonly Path[]>;
    /** Path key → character (the reverse map, §9.4 step 6). */
    readonly byKey: ReadonlyMap<string, number>;
    /** Every layer reachable from the default layer, with its cheapest prerequisites. */
    readonly layers: ReadonlyMap<number, { prereqs: readonly Prereq[]; cost: number }>;
    /** Matrix indices of keys that serve as prerequisites (layer keys and Shift keys). */
    readonly prereqKeys: ReadonlySet<number>;

    constructor(
        readonly defaultLayer: number,
        readonly layoutId: string,
        paths: Map<number, Path[]>,
        layers: Map<number, { prereqs: Prereq[]; cost: number }>,
    ) {
        const byKey = new Map<string, number>();
        const prereqKeys = new Set<number>();
        for (const list of paths.values()) {
            list.sort(comparePaths);
            for (const path of list) {
                if (!byKey.has(path.key)) byKey.set(path.key, path.char);
                for (const p of path.prereqs) prereqKeys.add(p.index);
            }
        }
        this.paths = new Map([...paths.entries()].sort((a, b) => a[0] - b[0]));
        this.byKey = byKey;
        this.layers = layers;
        this.prereqKeys = prereqKeys;
    }

    /** Characters with at least one path, ascending. */
    get codePoints(): number[] {
        return [...this.paths.keys()];
    }

    pathsOf(char: number): readonly Path[] {
        return this.paths.get(char) ?? [];
    }

    primary(char: number): Path | null {
        return this.paths.get(char)?.[0] ?? null;
    }

    /** Whether a stored path key is a current path of the character (§6.1). */
    isCurrentPath(char: number, key: string): boolean {
        return this.pathsOf(char).some((p) => p.key === key);
    }

    /** The character a key types on a layer with a given shift, or null. */
    charAt(index: number, layer: number, shift: Shift = 'n'): number | null {
        return this.byKey.get(pathKey(layer, index, shift)) ?? null;
    }

    /** Characters of a text that have no path, in order of first appearance. */
    untypeable(text: string): number[] {
        const missing: number[] = [];
        for (const ch of text) {
            const c = ch.codePointAt(0)!;
            const normalized = c === 0x0d ? 0x0a : c;
            if (!this.paths.has(normalized) && !missing.includes(normalized)) missing.push(normalized);
        }
        return missing;
    }
}

function comparePaths(a: Path, b: Path) {
    return a.cost - b.cost
        || a.prereqs.length - b.prereqs.length
        || a.layer - b.layer
        || SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]
        || a.index - b.index
        || a.prereqs.map((p) => p.index).join(',').localeCompare(b.prereqs.map((p) => p.index).join(','));
}

function directionCost(index: number, cols: number): number {
    const place = placeOf(index, cols);
    if (!place) return 0;
    return place.isThumb ? PATH_COSTS.direction.thumb : PATH_COSTS.direction[place.key as keyof typeof PATH_COSTS.direction] ?? 0;
}

function prereqCost(p: Prereq, cols: number): number {
    const extra = p.kind === 'oneshot' ? PATH_COSTS.oneshot
        : p.kind === 'shift' ? (p.tapHold ? PATH_COSTS.shiftTapHold : PATH_COSTS.shift)
        : (p.tapHold ? PATH_COSTS.layerTapHold : PATH_COSTS.hold);
    return PATH_COSTS.press + extra + directionCost(p.index, cols);
}

/**
 * Resolves every character a keymap can type, with its paths (§9.4).
 * Run it after the active board's custom keycodes are registered
 * (keyService.generateAllKeycodes); custom keycodes resolve to no character.
 */
export function resolveKeymap(source: KeymapSource, options: ResolveOptions = {}): KeymapResolution {
    const defaultLayer = options.defaultLayer ?? 0;
    const layoutId = options.layoutId ?? 'us';
    const maxHolds = options.maxHolds ?? 2;
    const stringify = options.stringify ?? ((code: number) => keyService.stringify(code));
    const rawLabel = options.label ?? getLabelForKeycode;
    const { keymap, cols } = source;
    const size = source.rows * source.cols;

    const names = new Map<number, string>();
    const nameOf = (code: number) => {
        let name = names.get(code);
        if (name === undefined) names.set(code, (name = stringify(code)));
        return name;
    };
    const labels = new Map<string, string | null>();
    const labelOf = (keycode: string) => {
        let label = labels.get(keycode);
        if (label === undefined) labels.set(keycode, (label = rawLabel(keycode, layoutId)));
        return label;
    };

    const charOf = (keycode: string) => {
        const ws = whitespaceFor(keycode);
        return ws ?? singleChar(labelOf(keycode));
    };

    const outputs = (code: number): Output[] => {
        const name = nameOf(code);
        const ws = whitespaceFor(name);
        if (ws != null) return [{ char: ws, shift: 'n', emitsOnRelease: false }];
        if (isLayerTap(name) || isModTap(name)) {
            // Tap side of a tap-hold key: base keycode, typed on release (§9.4 step 3).
            return plainAndShifted(nameOf(code & 0xff), true);
        }
        if (code >= 0x0100 && code <= 0x1fff) {
            if (!isShiftOnlyMods(code)) return [];
            const char = charOf(`LSFT(${nameOf(code & 0xff)})`);
            return char != null ? [{ char, shift: 'f', emitsOnRelease: false }] : [];
        }
        if (code > 0 && code < 0x0100) return plainAndShifted(name, false);
        return [];
    };

    function plainAndShifted(name: string, emitsOnRelease: boolean): Output[] {
        const result: Output[] = [];
        const plain = charOf(name);
        if (plain != null) result.push({ char: plain, shift: 'n', emitsOnRelease });
        if (whitespaceFor(name) == null) {
            const shifted = singleChar(labelOf(`LSFT(${name})`));
            if (shifted != null && shifted !== plain) result.push({ char: shifted, shift: 'u', emitsOnRelease });
        }
        return result;
    }

    // 1. Layer reachability: BFS over layer holds and one-shots from the default layer.
    const states: LayerState[] = [{ mask: (1 << defaultLayer) >>> 0, held: [], prereqs: [], cost: 0 }];
    const seen = new Set<string>([String(states[0].mask)]);
    for (let i = 0; i < states.length; i++) {
        const state = states[i];
        if (state.held.length >= maxHolds) continue;
        for (let index = 0; index < size; index++) {
            if (state.prereqs.some((p) => p.index === index)) continue;
            const { code, layer } = resolveBinding(keymap, index, state.mask);
            const action = layerAction(nameOf(code));
            if (!action || action.toLayer > 31 || !keymap[action.toLayer]) continue;
            if ((state.mask >>> action.toLayer) & 1) continue;
            const prereq: Prereq = { kind: action.kind, index, layer, toLayer: action.toLayer, code, tapHold: action.tapHold };
            const next: LayerState = {
                mask: (state.mask | (1 << action.toLayer)) >>> 0,
                held: [...state.held, action.toLayer],
                prereqs: [...state.prereqs, prereq],
                cost: state.cost + prereqCost(prereq, cols),
            };
            const id = `${next.mask}|${next.prereqs.map((p) => p.index).join(',')}`;
            if (seen.has(id)) continue;
            seen.add(id);
            states.push(next);
        }
    }

    const layers = new Map<number, { prereqs: Prereq[]; cost: number }>();
    for (const state of states) {
        const top = state.held.length ? state.held[state.held.length - 1] : defaultLayer;
        const known = layers.get(top);
        if (!known || state.cost < known.cost) layers.set(top, { prereqs: state.prereqs, cost: state.cost });
    }

    // 2–4. Effective keycode per (layer state, index) → characters → costed paths.
    const paths = new Map<number, Path[]>();
    const add = (path: Path) => {
        let list = paths.get(path.char);
        if (!list) paths.set(path.char, (list = []));
        // A path that only adds presses to one already found is never the way to
        // type it (for example a transparent layer held on top of MO(1)).
        const mine = new Set(path.prereqs.map((p) => p.index));
        if (list.some((other) => other.key === path.key && other.prereqs.length < path.prereqs.length
            && other.prereqs.every((p) => mine.has(p.index)))) return;
        list.push(path);
    };
    for (const state of states) {
        const top = state.held.length ? state.held[state.held.length - 1] : null;
        const shiftKeys: Prereq[] = [];
        for (let index = 0; index < size; index++) {
            if (state.prereqs.some((p) => p.index === index)) continue;
            const { code, layer } = resolveBinding(keymap, index, state.mask);
            const role = shiftRole(nameOf(code));
            if (role) shiftKeys.push({ kind: 'shift', index, layer, code, tapHold: role.tapHold });
        }
        for (let index = 0; index < size; index++) {
            if (state.prereqs.some((p) => p.index === index)) continue;
            const { code, layer } = resolveBinding(keymap, index, state.mask);
            // In a held state only keys bound on the newly held layer are new paths;
            // anything that falls through is reachable without the hold.
            if (top != null && layer !== top) continue;
            const base = state.cost + PATH_COSTS.press + directionCost(index, cols);
            for (const out of outputs(code)) {
                const shiftOptions: (Prereq | null)[] = out.shift === 'u' ? shiftKeys.filter((s) => s.index !== index) : [null];
                for (const shiftKey of shiftOptions) {
                    const prereqs = shiftKey ? [...state.prereqs, shiftKey] : state.prereqs;
                    const cost = base + (shiftKey ? prereqCost(shiftKey, cols) : 0);
                    add({
                        char: out.char, layer, index, shift: out.shift,
                        key: pathKey(layer, index, out.shift),
                        prereqs, cost: Math.round(cost * 1000) / 1000, code,
                        emitsOnRelease: out.emitsOnRelease,
                        delayed: out.emitsOnRelease || prereqs.some((p) => p.tapHold),
                    });
                }
            }
        }
    }
    return new KeymapResolution(defaultLayer, layoutId, paths, layers);
}
