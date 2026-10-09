// Svalboard `Keyboard` adapter (spec §9.5): the only thing keybr's Lesson sees.
//
// - KeyId = "m" + matrix index; shapes come from the board's geometry.
// - Zones: finger from the matrix row, hand from the side, `thumb` on thumb rows.
// - Combos come from the resolver's primary paths, extended with layer, shift
//   source and prerequisites (SvalKeyCombo).
// - getCodePoints() weighs characters by Svalboard tier (§6.3), so keybr's
//   `keyboardOrder` unlocks center keys first, then N/S, E/W, 2S, thumbs, and
//   finally anything behind a layer hold or Shift.
// The UI never draws keybr shapes; Practice renders Key.tsx (§9.6).
import type { KeyboardInfo } from '@/types/keyboard.types';
import {
    type CharacterDict,
    Geometry,
    type GeometryDict,
    Keyboard,
    KeyCombo,
    KeyModifier,
    Language,
    Layout,
    type WeightedCodePointSet,
    type ZoneFilter,
    type ZoneId,
} from '../vendor/keybr/keyboard/index.ts';
import { boardGeometry, placeOf, type PlacedKey } from './geometry';
import { type KeymapResolution, type Path, type Prereq, type Shift } from './resolver';

/** The keybr layout every Practice lesson and result runs with (§9.2). */
export const PRACTICE_LAYOUT = Layout.custom(Language.EN);

export function keyIdOf(index: number): string {
    return `m${index}`;
}

export function indexOfKeyId(id: string): number | null {
    const m = /^m(\d+)$/.exec(id);
    return m ? Number(m[1]) : null;
}

/** keybr's KeyCombo plus the Svalboard path it stands for. */
export class SvalKeyCombo extends KeyCombo {
    readonly layer: number;
    readonly shiftSource: Shift;
    readonly prereqs: readonly Prereq[];

    constructor(readonly path: Path) {
        super(path.char, keyIdOf(path.index), path.shift === 'u' ? KeyModifier.Shift : KeyModifier.None);
        this.layer = path.layer;
        this.shiftSource = path.shift;
        this.prereqs = path.prereqs;
    }
}

/** Unlock tier weights (§6.3). Lower unlocks first; letters sort by frequency within a tier. */
export const TIER_WEIGHTS = { C: 1, N: 2, S: 2, E: 3, W: 3, '2S': 4, thumb: 5, prereqBase: 10, perPrereq: 10, unknown: 1000 } as const;

/** The unlock tier weight of a primary path. */
export function tierWeight(path: Path, defaultLayer: number, cols: number): number {
    if (path.prereqs.length > 0) return TIER_WEIGHTS.prereqBase + TIER_WEIGHTS.perPrereq * path.prereqs.length;
    if (path.layer !== defaultLayer) return TIER_WEIGHTS.prereqBase;
    const place = placeOf(path.index, cols);
    if (!place) return TIER_WEIGHTS.unknown;
    return place.isThumb ? TIER_WEIGHTS.thumb : TIER_WEIGHTS[place.key as 'C' | 'N' | 'S' | 'E' | 'W' | '2S'];
}

function zonesOf(key: PlacedKey): ZoneId[] {
    const finger: ZoneId = key.finger === 'index' ? (key.hand === 'left' ? 'leftIndex' : 'rightIndex') : key.finger;
    const zones: ZoneId[] = [finger, key.hand];
    if (!key.isThumb) {
        if (key.key === 'C') zones.push('home');
        else if (key.key === 'N') zones.push('top');
        else if (key.key === 'S' || key.key === '2S') zones.push('bottom');
    }
    return zones;
}

export class SvalKeyboard extends Keyboard {
    declare readonly combos: ReadonlyMap<number, SvalKeyCombo>;
    readonly #weights: ReadonlyMap<number, number>;

    constructor(
        readonly board: Pick<KeyboardInfo, 'keylayout' | 'rows' | 'cols'>,
        readonly resolution: KeymapResolution,
    ) {
        const keys = boardGeometry(board);
        const geometryDict: GeometryDict = Object.fromEntries(keys.map((key) => [keyIdOf(key.index), {
            x: key.x, y: key.y, w: key.w, h: key.h, zones: zonesOf(key), homing: !key.isThumb && key.key === 'C',
        }]));
        // Legends for the base layer only; every other layer lives in the combos.
        const legends: Record<string, [number | null, number | null]> = {};
        for (const [char, paths] of resolution.paths) {
            const path = paths[0];
            if (path.layer !== resolution.defaultLayer || path.prereqs.some((p) => p.kind !== 'shift')) continue;
            const id = keyIdOf(path.index);
            const slot = (legends[id] ??= [null, null]);
            if (path.shift === 'u') slot[1] ??= char;
            else slot[0] ??= char;
        }
        const characterDict: CharacterDict = Object.fromEntries(Object.entries(legends));
        super(PRACTICE_LAYOUT, Geometry.MATRIX, characterDict, geometryDict);

        const combos = new Map<number, SvalKeyCombo>();
        const weights = new Map<number, number>();
        for (const [char, paths] of resolution.paths) {
            combos.set(char, new SvalKeyCombo(paths[0]));
            weights.set(char, tierWeight(paths[0], resolution.defaultLayer, board.cols));
        }
        (this as unknown as { combos: ReadonlyMap<number, SvalKeyCombo> }).combos = combos;
        this.#weights = weights;
    }

    override getCombo(codePoint: number): SvalKeyCombo | null {
        return this.combos.get(codePoint) ?? null;
    }

    /** Characters with a primary path, weighted by Svalboard tier (§6.3). */
    override getCodePoints({ zones, shift = true }: Partial<ZoneFilter> = {}): WeightedCodePointSet {
        const list: number[] = [];
        for (const combo of this.combos.values()) {
            const shape = this.getShape(combo.id);
            if ((!combo.shift || shift) && (zones == null || shape?.inAnyZone(zones))) list.push(combo.codePoint);
        }
        const codePoints = new Set(list.sort((a, b) => a - b));
        const weights = this.#weights;
        return {
            [Symbol.iterator]: () => codePoints[Symbol.iterator](),
            get size() { return codePoints.size; },
            has: (codePoint: number) => codePoints.has(codePoint),
            weight: (codePoint: number) => weights.get(codePoint) ?? TIER_WEIGHTS.unknown,
        };
    }
}

/** Builds the keybr keyboard for a board and its resolved keymap. */
export function svalKeyboard(board: Pick<KeyboardInfo, 'keylayout' | 'rows' | 'cols'>, resolution: KeymapResolution): SvalKeyboard {
    return new SvalKeyboard(board, resolution);
}
