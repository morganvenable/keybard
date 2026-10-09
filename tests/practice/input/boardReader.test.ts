import { afterEach, describe, expect, it, vi } from 'vitest';

// The board reads (spec §9.3, D10, OWNER_Q4): keyboardService on the connected board, never while the tab
// is hidden, and in Paranoid only while Keybard is in front (userIsLooking).

const paranoid = vi.hoisted(() => ({ PARANOID: true, looking: true }));
vi.mock('@/lib/paranoid', () => ({ get PARANOID() { return paranoid.PARANOID; }, userIsLooking: () => paranoid.looking }));

const service = vi.hoisted(() => ({ pollMatrix: vi.fn(async () => [[true]]), getLayerStateMasks: vi.fn(async () => ({ active: 1, default: 1 })) }));
vi.mock('@/services/keyboard.service', () => ({ keyboardService: service }));

const { boardReader } = await import('@/features/practice/input/boardReader');

afterEach(() => {
    paranoid.looking = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

describe('boardReader', () => {
    it('reads the connected board through keyboardService, and nothing without one', async () => {
        const board = { rows: 10, cols: 6 } as never;
        let current: unknown = board;
        const reader = boardReader(() => current as never);
        expect(await reader.pollMatrix()).toEqual([[true]]);
        expect(service.pollMatrix).toHaveBeenCalledWith(board);
        expect(await reader.getLayerMasks()).toEqual({ active: 1, default: 1 });
        current = null;
        expect(await reader.pollMatrix()).toEqual([]);
        await expect(reader.getLayerMasks()).rejects.toThrow();
    });

    it('never reads while the tab is hidden, and in Paranoid only while Keybard is in front', () => {
        const reader = boardReader(() => null);
        expect(reader.canRead()).toBe(true);
        paranoid.looking = false;
        expect(reader.canRead()).toBe(false);
        paranoid.looking = true;
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        expect(reader.canRead()).toBe(false);
    });
});
