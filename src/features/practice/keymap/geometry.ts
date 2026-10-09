// Svalboard key places: matrix index → hand, finger, cluster and direction, plus
// the drawn position. Practice re-implements the small part of Overlay's
// geometry() it needs, because the two features never import each other (§9.1).
// Matrix: 10 rows × 6 cols, index = row * cols + col (research/svalboard-geometry.json).
import { SVALBOARD_LAYOUT } from '@/constants/svalboard-layout';
import type { KeyboardInfo } from '@/types/keyboard.types';

export type Hand = 'left' | 'right';
export type Finger = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
/** Finger-cluster keys by screen compass; E is always +x (not mirrored per hand). */
export type Direction = 'C' | 'N' | 'S' | 'E' | 'W' | '2S';
export type ThumbKey = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
export type Cluster =
    | 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_pinky'
    | 'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_pinky';

export interface KeyPlace {
    index: number;
    row: number;
    col: number;
    hand: Hand;
    finger: Finger;
    cluster: Cluster;
    /** Direction on a finger cluster, or T1–T6 on a thumb cluster. */
    key: Direction | ThumbKey;
    isThumb: boolean;
}

export interface PlacedKey extends KeyPlace {
    x: number;
    y: number;
    w: number;
    h: number;
}

export const SVAL_ROWS = 10;
export const SVAL_COLS = 6;

const FINGERS: Finger[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const DIRECTION_BY_COL: Direction[] = ['S', 'E', 'C', 'N', 'W', '2S'];
const THUMB_BY_COL: Record<Hand, ThumbKey[]> = {
    left: ['T6', 'T3', 'T5', 'T1', 'T4', 'T2'],
    right: ['T4', 'T1', 'T5', 'T3', 'T6', 'T2'],
};

/** Where a matrix position sits on a Svalboard; null outside the 10 × 6 matrix. */
export function keyPlace(row: number, col: number): KeyPlace | null {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= SVAL_ROWS || col < 0 || col >= SVAL_COLS) return null;
    const hand: Hand = row < 5 ? 'left' : 'right';
    const finger = FINGERS[row % 5];
    const isThumb = finger === 'thumb';
    return {
        index: row * SVAL_COLS + col, row, col, hand, finger,
        cluster: `${hand}_${finger}` as Cluster,
        key: isThumb ? THUMB_BY_COL[hand][col] : DIRECTION_BY_COL[col],
        isThumb,
    };
}

/** keyPlace() by matrix index, for a board with `cols` columns. */
export function placeOf(index: number, cols = SVAL_COLS): KeyPlace | null {
    if (cols !== SVAL_COLS || !Number.isInteger(index) || index < 0) return null;
    return keyPlace(Math.floor(index / cols), index % cols);
}

/**
 * Every drawn key of a board with its place, from `board.keylayout` or the
 * built-in Svalboard layout (the same choice Matrix Tester and Overlay make).
 */
export function boardGeometry(board: Pick<KeyboardInfo, 'keylayout' | 'rows' | 'cols'>): PlacedKey[] {
    const layout: Record<string, any> = board.keylayout && Object.keys(board.keylayout).length ? board.keylayout : SVALBOARD_LAYOUT;
    return Object.entries(layout).flatMap(([id, raw]) => {
        const index = Number(id);
        const row = raw.row ?? Math.floor(index / board.cols), col = raw.col ?? index % board.cols;
        const x = Number(raw.x), y = Number(raw.y), w = Number(raw.w ?? 1), h = Number(raw.h ?? 1);
        if (![row, col, x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return [];
        if (row >= board.rows || col >= board.cols) return [];
        const place = keyPlace(row, col);
        return place ? [{ ...place, x, y, w, h }] : [];
    });
}
