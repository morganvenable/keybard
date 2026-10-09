import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LabPage from '@/features/practice/ui/LabPage';
import { svalDefault } from '../fixtures/boards';
import { FakeBoard } from '../input/fakeBoard';
import { keyboardState, Providers, resetHarness } from './harness';

// The M0 lab view (spec §4.2, §12 M0): a well without a board; with one, the text box reads the board
// only while it has focus, and Copy results puts the numbers table on the clipboard.

const reader = vi.hoisted(() => ({ fake: null as unknown as FakeBoard }));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/contexts/KeyboardContext', async () => { const h = await import('./harness'); return { useKeyboard: () => h.keyboardState }; });
vi.mock('@/contexts/LayoutSettingsContext', async () => { const h = await import('./harness'); return { useLayoutSettings: () => h.layoutState }; });
vi.mock('@/features/practice/input/boardReader', () => ({
    boardReader: () => ({
        pollMatrix: () => reader.fake.pollMatrix(),
        getLayerMasks: () => reader.fake.getLayerMasks(),
        canRead: () => true,
    }),
}));

beforeEach(() => {
    resetHarness();
    reader.fake = new FakeBoard();
    window.history.replaceState(null, '', '/?practiceLab=1#practice/lab');
});

afterEach(() => {
    cleanup();
    resetHarness();
});

describe('Lab page', () => {
    it('asks for the board when none is connected', () => {
        render(<Providers><LabPage /></Providers>);
        expect(screen.getByRole('region', { name: 'Connect the board to measure' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Connect board/ }));
        expect(keyboardState.connect).toHaveBeenCalled();
    });

    it('reads only while the text box has focus, and copies the results table', async () => {
        const board = svalDefault();
        keyboardState.keyboard = board;
        keyboardState.originalKeyboard = board;
        keyboardState.isConnected = true;
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        render(<Providers><LabPage /></Providers>);
        const box = screen.getByLabelText('Lab text');
        expect(reader.fake.pollMatrix).not.toHaveBeenCalled();
        act(() => { box.focus(); });
        await vi.waitFor(() => expect(reader.fake.pollMatrix).toHaveBeenCalled());
        await act(() => reader.fake.reply([], 10));
        act(() => { box.blur(); });
        await act(() => reader.fake.reply([], 20));
        const calls = reader.fake.pollMatrix.mock.calls.length;
        await new Promise((r) => setTimeout(r, 30));
        expect(reader.fake.pollMatrix.mock.calls.length).toBe(calls);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy results' })); });
        expect(writeText).toHaveBeenCalledWith(expect.stringContaining('| Samples per second |'));
        expect(await screen.findByText('Results copied')).toBeInTheDocument();
    });
});
