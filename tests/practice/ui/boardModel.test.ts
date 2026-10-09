import { describe, expect, it } from 'vitest';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { boardSize, boardView, displayedLayerFor, type BoardInput } from '@/features/practice/ui/boardModel';
import { fitBoard } from '@/features/practice/ui/boardFit';
import { svalDefault } from '../fixtures/boards';

// Board hints (docs/practice/spec.md §5.2 "Board", §6.7): rings, step badges, target legends and the
// cluster backdrop land on the expected keys of the default keymap.

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const cp = (s: string) => s.codePointAt(0)!;
const letters = (s: string) => new Set([...s].map(cp));

function view(overrides: Partial<BoardInput> = {}) {
    return boardView({
        keyboard: board, resolution, layoutId: 'us', defaultLayer: 0, displayedLayer: 0,
        included: letters('asdfjkl'), locked: letters('eriou'), next: cp('j'), hints: 'next-cluster', legends: true,
        ...overrides,
    });
}
const key = (v: ReturnType<typeof view>, index: number) => v.keys.find((k) => k.index === index)!;

describe('Practice board (§5.2)', () => {
    it('rings the next key, lights included letters, dashes locked ones, dims the rest', () => {
        const v = view();
        expect(key(v, 38)).toMatchObject({ ring: true, state: 'included', char: cp('j'), step: null });
        expect(key(v, 26)).toMatchObject({ ring: false, state: 'included', layerColor: 'green' });
        expect(key(v, 15)).toMatchObject({ state: 'locked', char: cp('e') });
        // Space is not a lesson character.
        expect(key(v, 33)).toMatchObject({ state: 'other', ring: false });
        expect(v.keys.filter((k) => k.ring)).toHaveLength(1);
    });

    it('draws the cluster backdrop behind the next key\'s cluster in its layer color', () => {
        const v = view();
        expect(v.cluster).toMatchObject({ color: '#099e7c' });
        const members = v.keys.filter((k) => k.inCluster).map((k) => k.index).sort((a, b) => a - b);
        expect(members).toEqual([36, 37, 38, 39, 40, 41].filter((i) => v.keys.some((k) => k.index === i)));
        expect(view({ hints: 'next' }).cluster).toBeNull();
    });

    it('a layered character: target legend on its layer face with badge 2, MO(1) ringed with 1, LT1 dashed with 1', () => {
        const v = view({ next: cp('!'), included: letters('!'), locked: new Set() });
        expect(key(v, 27)).toMatchObject({ ring: true, label: '!', layerColor: 'orange', step: 2 });
        expect(key(v, 32)).toMatchObject({ ring: true, alternative: false, step: 1, layerColor: 'orange' });
        expect(key(v, 3)).toMatchObject({ ring: false, alternative: true, step: 1 });
        // The prerequisite keeps its own legend (MO(1)).
        expect(key(v, 32).keycode).toMatch(/^MO\(1\)$/);
    });

    it('shows the next character\'s layer once typing started (Keymap only)', () => {
        expect(displayedLayerFor(resolution, cp('!'), false, 0)).toBe(0);
        expect(displayedLayerFor(resolution, cp('!'), true, 0)).toBe(1);
        const v = view({ next: cp('!'), displayedLayer: 1 });
        expect(key(v, 27)).toMatchObject({ ring: true, label: expect.stringMatching(/^!$/) });
        expect(v.displayedLayer).toBe(1);
    });

    it('hints off: no ring, no badge, no backdrop', () => {
        const v = view({ hints: 'off' });
        expect(v.keys.some((k) => k.ring || k.step != null)).toBe(false);
        expect(v.cluster).toBeNull();
    });

    it('legends hidden render empty labels and keycodes, as Matrix Tester does', () => {
        const v = view({ legends: false });
        expect(v.keys.every((k) => k.label === '' && k.keycode === '')).toBe(true);
    });

    it('no lesson: every key light gray, no ring', () => {
        const v = view({ noLesson: true });
        expect(v.keys.every((k) => k.state === 'other' && !k.ring)).toBe(true);
    });
});

describe('Board size (§5.1)', () => {
    it('picks the largest variant that fits, scales the small board down to 0.6, then hides it', () => {
        const units = boardSize(board).width;
        expect(fitBoard(units * 60 + 32, units).variant).toBe('default');
        expect(fitBoard(units * 45 + 32, units).variant).toBe('medium');
        expect(fitBoard(units * 30 + 32, units)).toMatchObject({ variant: 'small', scale: 1, hidden: false });
        const scaled = fitBoard(units * 30 * 0.8 + 32, units);
        expect(scaled.scale).toBeCloseTo(0.8);
        expect(fitBoard(200, units).hidden).toBe(true);
        expect(fitBoard(0, units)).toMatchObject({ variant: 'medium', hidden: false });
    });
});
