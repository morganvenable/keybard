// The Drill scope (spec §5.5, §6.2): which characters a drill practices.
//
// A character is in scope when its primary path falls in the chosen layer,
// group, directions and hands, and its target is a thumb key only when Thumbs
// is on (prerequisites on the thumbs are always allowed). Weakest keeps the 8
// lowest-confidence calibrated characters, filled up with uncalibrated ones in
// unlock order. Drill this key (P5) replaces the scope with a character and its
// cluster neighbors. Fewer than 3 characters is "Nothing to drill" (§5.3).
//
// Characters are lowercase language letters, digits and printable ASCII
// punctuation. Whitespace is never drilled on its own: Space separates every
// token anyway. Capitals come with the Capitals slider in Guided and Words.
import { placeOf } from '../keymap/geometry';
import type { KeymapResolution, Path } from '../keymap/resolver';
import { type DrillDirection, DRILL_DIRECTIONS, type DrillGroup, type DrillSettings } from '../state/settings';
import { Letter } from '../vendor/keybr/phonetic-model/index.ts';

/** keybr's result validity needs 3 distinct characters (§6.9). */
export const MIN_DRILL_SCOPE = 3;
/** Weakest keeps this many characters (§6.2). */
export const WEAKEST_SIZE = 8;
/** A character is calibrated from this many samples on (§5.2 strip). */
export const CALIBRATED_SAMPLES = 3;

export type CharClass = 'letter' | 'digit' | 'symbol';

/** Printable ASCII punctuation: the Symbols group (§6.2). */
export function isAsciiSymbol(codePoint: number): boolean {
    return (codePoint >= 0x21 && codePoint <= 0x2f) || (codePoint >= 0x3a && codePoint <= 0x40)
        || (codePoint >= 0x5b && codePoint <= 0x60) || (codePoint >= 0x7b && codePoint <= 0x7e);
}

export function isDigit(codePoint: number): boolean {
    return codePoint >= 0x30 && codePoint <= 0x39;
}

/** The drill class of a character, or null when it is never drilled (whitespace, capitals, others). */
export function charClass(codePoint: number, languageLetters: ReadonlySet<number>): CharClass | null {
    if (languageLetters.has(codePoint)) return 'letter';
    if (isDigit(codePoint)) return 'digit';
    if (isAsciiSymbol(codePoint)) return 'symbol';
    return null;
}

const GROUP_CLASSES: Record<DrillGroup, readonly CharClass[]> = {
    all: ['letter', 'digit', 'symbol'],
    weakest: ['letter', 'digit', 'symbol'],
    letters: ['letter'],
    numbers: ['digit'],
    symbols: ['symbol'],
};

const PROGRAMMING_F = new Map(Letter.programming.map((l) => [l.codePoint, l.f]));
const DIGIT_F = new Map(Letter.digits.map((l) => [l.codePoint, l.f]));

/** Relative frequency of a character within its class (letters from the language model). */
export function charFrequency(codePoint: number, letterFrequency: ReadonlyMap<number, number>): number {
    return letterFrequency.get(codePoint) ?? DIGIT_F.get(codePoint) ?? PROGRAMMING_F.get(codePoint) ?? 0.05;
}

/** What the scope needs to know about a character's progress. */
export interface CharProgress {
    /** Current confidence (target time / time to type); null before any timing. */
    confidence: number | null;
    samples: number;
}

export interface DrillScopeInput {
    resolution: KeymapResolution;
    cols: number;
    /** The language model's letters (code point → frequency). */
    letterFrequency: ReadonlyMap<number, number>;
    drill: DrillSettings;
    /** Unlock tier weight of a character (§6.3; the keyboard adapter's). */
    weight: (codePoint: number) => number;
    progress: (codePoint: number) => CharProgress;
}

const CLASS_RANK: Record<CharClass, number> = { letter: 0, digit: 1, symbol: 2 };

/**
 * Characters in unlock order (§6.3): tier weight, then letters before digits before
 * symbols (their frequencies aren't on one scale), then frequency, then code point.
 */
export function unlockOrder(
    chars: Iterable<number>, weight: (c: number) => number, frequency: (c: number) => number, letters: ReadonlySet<number> = new Set(),
): number[] {
    const rank = (c: number) => CLASS_RANK[charClass(c, letters) ?? 'symbol'];
    return [...chars].sort((a, b) => weight(a) - weight(b) || rank(a) - rank(b) || frequency(b) - frequency(a) || a - b);
}

/** Whether a primary path falls in the layer, directions, hands and thumbs of a scope. */
export function pathInScope(path: Path, drill: Pick<DrillSettings, 'layer' | 'dirs' | 'hands' | 'thumbs'>, cols: number): boolean {
    if (drill.layer != null && path.layer !== drill.layer) return false;
    const place = placeOf(path.index, cols);
    if (!place) return drill.hands === 'both' && DRILL_DIRECTIONS.every((d) => drill.dirs.includes(d));
    if (drill.hands !== 'both' && place.hand !== drill.hands) return false;
    if (place.isThumb) return drill.thumbs;
    return drill.dirs.includes(place.key as DrillDirection);
}

/** Every character the scope's filters admit, before Weakest picks from them, in unlock order. */
export function scopeCandidates(input: DrillScopeInput): number[] {
    const { resolution, cols, letterFrequency, drill } = input;
    const letters = new Set(letterFrequency.keys());
    const frequency = (c: number) => charFrequency(c, letterFrequency);
    if (drill.keys) {
        // A stored or imported set can't bring back characters Drill never drills (capitals).
        const keys = drill.keys.filter((c) => charClass(c, letters) != null && resolution.primary(c) != null);
        return unlockOrder(keys, input.weight, frequency, letters);
    }
    const classes = GROUP_CLASSES[drill.group];
    const chars: number[] = [];
    for (const [codePoint, paths] of resolution.paths) {
        const cls = charClass(codePoint, letters);
        if (!cls || !classes.includes(cls)) continue;
        if (pathInScope(paths[0], drill, cols)) chars.push(codePoint);
    }
    return unlockOrder(chars, input.weight, frequency, letters);
}

/**
 * Weakest (§6.2): the WEAKEST_SIZE lowest-confidence calibrated characters, filled up
 * with uncalibrated ones in unlock order (`candidates` is already in unlock order).
 */
export function weakest(candidates: readonly number[], progress: (c: number) => CharProgress, size = WEAKEST_SIZE): number[] {
    const calibrated = candidates.filter((c) => progress(c).samples >= CALIBRATED_SAMPLES);
    const picked = calibrated
        .map((c, i) => ({ c, i, confidence: progress(c).confidence ?? 0 }))
        .sort((a, b) => a.confidence - b.confidence || a.i - b.i)
        .slice(0, size)
        .map((x) => x.c);
    for (const c of candidates) {
        if (picked.length >= size) break;
        if (!picked.includes(c) && progress(c).samples < CALIBRATED_SAMPLES) picked.push(c);
    }
    // Shown in unlock order, like every other scope.
    return candidates.filter((c) => picked.includes(c));
}

/** The characters a drill practices now, in unlock order. */
export function drillScope(input: DrillScopeInput): number[] {
    const candidates = scopeCandidates(input);
    return input.drill.group === 'weakest' && !input.drill.keys ? weakest(candidates, input.progress) : candidates;
}

/**
 * The focused character (§5.7, M-21): Drill this key's character while it is below
 * target, else the lowest-confidence character (no timing counts as 0), first in
 * unlock order on a tie.
 */
export function drillFocus(scope: readonly number[], progress: (c: number) => CharProgress, chosen: number | null): number | null {
    if (chosen != null && scope.includes(chosen) && (progress(chosen).confidence ?? 0) < 1) return chosen;
    let best: number | null = null;
    let bestConfidence = Infinity;
    for (const c of scope) {
        const confidence = progress(c).confidence ?? 0;
        if (confidence < bestConfidence) {
            best = c;
            bestConfidence = confidence;
        }
    }
    return best;
}

/**
 * Drill this key (§5.7): the character and its cluster neighbors, the characters
 * whose primary path is on the same finger cluster and layer. When that leaves
 * fewer than 3, the cluster's characters on every layer join.
 */
export function clusterScope(resolution: KeymapResolution, codePoint: number, cols: number, letterFrequency: ReadonlyMap<number, number>): number[] {
    const path = resolution.primary(codePoint);
    if (!path) return [codePoint];
    const place = placeOf(path.index, cols);
    const letters = new Set(letterFrequency.keys());
    const sameCluster = (p: Path) => {
        const other = placeOf(p.index, cols);
        return place && other ? other.cluster === place.cluster : p.index === path.index;
    };
    const members = (sameLayer: boolean) => {
        const list = [codePoint];
        for (const [c, paths] of resolution.paths) {
            if (c === codePoint || !charClass(c, letters)) continue;
            const p = paths[0];
            if (sameCluster(p) && (!sameLayer || p.layer === path.layer)) list.push(c);
        }
        return list;
    };
    const onLayer = members(true);
    return onLayer.length >= MIN_DRILL_SCOPE ? onLayer : members(false);
}

/**
 * The character Drill this key (§5.7) drills for `codePoint`, or null when it has none.
 * A drilled character is itself; a capital is its lowercase letter when that is the
 * same key on the same layer (Drill never drills capitals on their own); anything
 * else, such as Space, has none and the popover offers no Drill this key.
 */
export function drillTarget(resolution: KeymapResolution, codePoint: number, letterFrequency: ReadonlyMap<number, number>): number | null {
    const path = resolution.primary(codePoint);
    if (!path) return null;
    const letters = new Set(letterFrequency.keys());
    if (charClass(codePoint, letters)) return codePoint;
    const lower = String.fromCodePoint(codePoint).toLowerCase();
    const lowerCodePoint = lower.codePointAt(0)!;
    if ([...lower].length !== 1 || lowerCodePoint === codePoint || !charClass(lowerCodePoint, letters)) return null;
    const lowerPath = resolution.primary(lowerCodePoint);
    return lowerPath && lowerPath.layer === path.layer && lowerPath.index === path.index ? lowerCodePoint : null;
}

/** The board has a 2S key on some finger cluster (6-key clusters, §5.5 Directions). */
export function hasDoubleSouth(placeKeys: Iterable<{ isThumb: boolean; key: string }>): boolean {
    for (const k of placeKeys) if (!k.isThumb && k.key === '2S') return true;
    return false;
}

const GROUP_LABELS: Record<DrillGroup, string> = { all: 'All', letters: 'Letters', numbers: 'Numbers', symbols: 'Symbols', weakest: 'Weakest' };

/** Group tile names (§5.5). */
export function drillGroupLabel(group: DrillGroup): string {
    return GROUP_LABELS[group];
}

/**
 * The type row's scope text for Drill (§5.2): `Layer 1 · Symbols · N S`. Only the parts
 * that narrow the scope are named; nothing narrowed reads `All keys`.
 */
export function drillScopeLabel(drill: DrillSettings, layerName: (layer: number) => string, directions: readonly DrillDirection[]): string {
    if (drill.keys?.length) {
        const key = drill.focus ?? drill.keys[0];
        return `${String.fromCodePoint(key)} and its cluster`;
    }
    const parts: string[] = [];
    if (drill.layer != null) parts.push(layerName(drill.layer));
    if (drill.group !== 'all') parts.push(GROUP_LABELS[drill.group]);
    const dirs = directions.filter((d) => drill.dirs.includes(d));
    if (dirs.length < directions.length) parts.push(dirs.length ? dirs.join(' ') : 'No directions');
    if (drill.hands !== 'both') parts.push(drill.hands === 'left' ? 'Left hand' : 'Right hand');
    if (!drill.thumbs) parts.push('No thumbs');
    return parts.length ? parts.join(' · ') : 'All keys';
}
