import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import { useLayerNames } from '../../src/hooks/useLayerNames';

const state = vi.hoisted(() => ({
    keyboard: null as KeyboardInfo | null, isConnected: true,
    setKeyboard: vi.fn(), queue: vi.fn(), sendSvil: vi.fn(),
}));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => state }));
vi.mock('@/contexts/ChangesContext', () => ({ useChanges: () => ({ queue: state.queue }) }));
vi.mock('@/services/usb.service', async original => ({
    ...await original<typeof import('../../src/services/usb.service')>(),
    usbInstance: { svilProtocolVersion: 3, sendSvil: state.sendSvil },
}));

beforeEach(() => {
    vi.clearAllMocks();
    state.keyboard = { rows: 1, cols: 1, layers: 16, svil_proto: 3 };
    state.isConnected = true;
    state.setKeyboard.mockImplementation(updater => { state.keyboard = updater(state.keyboard); });
    state.queue.mockImplementation(async (_description, cb) => { await cb(); });
    state.sendSvil.mockResolvedValue(new Uint8Array([0x1c, 0]));
});

describe('layer name editor persistence', () => {
    it('writes through the changes queue and preserves other edited names', async () => {
        const { result } = renderHook(() => useLayerNames());
        await act(async () => { await result.current.renameLayer(0, 'Work'); });
        await act(async () => { await result.current.renameLayer(4, 'Symbols'); });
        expect(state.keyboard?.cosmetic?.layer).toEqual({ '0': 'Work', '4': 'Symbols' });
        expect(state.sendSvil).toHaveBeenCalledTimes(2);
        expect(state.queue.mock.calls[1][0]).toBe('Layer 4 name');
    });

    it('defers device writes when live updating is off', async () => {
        state.queue.mockResolvedValue(undefined);
        const { result } = renderHook(() => useLayerNames());
        await act(async () => { await result.current.renameLayer(2, 'Tools'); });
        expect(state.sendSvil).not.toHaveBeenCalled();
        expect(state.keyboard?.cosmetic?.layer?.['2']).toBe('Tools');
        await state.queue.mock.calls[0][1]();
        expect(state.sendSvil).toHaveBeenCalledTimes(1);
    });

    it('shows refused writes without pretending the edit succeeded', async () => {
        state.sendSvil.mockResolvedValue(new Uint8Array([0x1c, 1]));
        const { result } = renderHook(() => useLayerNames());
        await act(async () => { expect(await result.current.renameLayer(2, 'Tools')).toBe(false); });
        expect(result.current.nameError).toContain('refused');
        expect(state.keyboard?.cosmetic?.layer?.['2']).toBe('Tools'); // Failed write retains the editable draft for retry.
    });

    it('allows offline layout edits without issuing USB commands', async () => {
        state.isConnected = false;
        const { result } = renderHook(() => useLayerNames());
        await act(async () => { await result.current.renameLayer(2, 'Offline'); });
        expect(state.keyboard?.cosmetic?.layer?.['2']).toBe('Offline');
        expect(state.queue).not.toHaveBeenCalled();
        expect(state.sendSvil).not.toHaveBeenCalled();
    });
});
