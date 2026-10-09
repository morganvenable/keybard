// Miss classification (spec §6.6). Live, the pressed key is observed (M2); in
// Keymap-only mode the typed character is reverse-resolved to its primary path
// and compared with the expected path.
//
//   wrong-layer      same matrix index, different layer
//   wrong-shift      same key and layer, case or shift mismatch
//   wrong-direction  same finger cluster (row), different col
//   wrong-finger     different row, same hand
//   wrong-hand       other hand
//   unknown          the typed character has no path
import type { ErrorClass } from '../types';
import { placeOf } from '../keymap/geometry';
import type { KeymapResolution, Path } from '../keymap/resolver';

/** The physical key a press landed on: index, layer and shift source. */
export interface PressedKey {
    index: number;
    layer: number;
    shift: Path['shift'];
}

/** Classifies a press of `pressed` when `expected` was wanted. */
export function classifyPress(expected: Pick<Path, 'index' | 'layer' | 'shift'>, pressed: PressedKey | null, cols: number): ErrorClass {
    if (!pressed) return 'unknown';
    if (pressed.index === expected.index) {
        if (pressed.layer !== expected.layer) return 'wrong-layer';
        return 'wrong-shift';
    }
    const want = placeOf(expected.index, cols);
    const got = placeOf(pressed.index, cols);
    if (!want || !got) return 'unknown';
    if (want.row === got.row) return 'wrong-direction';
    if (want.hand === got.hand) return 'wrong-finger';
    return 'wrong-hand';
}

/** Keymap only: classifies typing `typed` for `expected` by their primary paths. */
export function classifyMiss(resolution: KeymapResolution, expected: number, typed: number, cols: number): ErrorClass {
    const want = resolution.primary(expected);
    const got = resolution.primary(typed);
    if (!want || !got) return 'unknown';
    return classifyPress(want, got, cols);
}
