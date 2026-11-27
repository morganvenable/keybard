import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useHost } from '../src/features/trainer/host';
import { DEFAULTS } from '../src/features/trainer/core';
const board = { rows: 10, cols: 6, keymap: [Array(60).fill(4)], trainerLabels: {} };
const state = { apiVersion: 1, revision: 1, layoutRevision: 1, session: 'one', board, config: { ...DEFAULTS, manualDefault: 1, highlightPressed: false }, active: 0, default: 1, valid: true, pressed: [], devices: [], practiceHidden: [], practiceTarget: null, visible: true };
afterEach(() => { delete window.__keybardNativeState; vi.unstubAllGlobals(); });
it('applies native layer events immediately and keeps the cached layout', async () => {
    window.__keybardNativeState = true;
    const fetch = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('bootstrap') ? { apiVersion: 1, token: 'test' } : state)));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useHost());
    await waitFor(() => expect(result.current.state?.board).toEqual(board));
    act(() => window.dispatchEvent(new CustomEvent('keybard-host-state', { detail: { ...state, board: null, active: 8 } })));
    expect(result.current.state?.active).toBe(8);
    expect(result.current.state?.board).toEqual(board);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(fetch.mock.calls.filter(([url]) => url.includes('/state'))).toHaveLength(1);
});
it('asks for the board again when a state event arrives after the watchdog paused the preview', async () => {
    // The vanishing overlay: the watchdog dropped the state (no update for 1.2 s, e.g. after a
    // sleep), then a layer change arrived without the board, since the layout had not changed.
    window.__keybardNativeState = true;
    const fetch = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('bootstrap') ? { apiVersion: 1, token: 'test' } : state)));
    vi.stubGlobal('fetch', fetch);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useHost({ overlay: true }));
    await waitFor(() => expect(result.current.state?.board).toEqual(board));
    const start = Date.now();
    const now = vi.spyOn(Date, 'now').mockImplementation(() => start + 5000);
    await waitFor(() => expect(result.current.state).toBeNull());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no update for'));
    now.mockRestore();
    act(() => window.dispatchEvent(new CustomEvent('keybard-host-state', { detail: { ...state, board: null, active: 8 } })));
    await waitFor(() => expect(result.current.state?.board).toEqual(board));
    const states = fetch.mock.calls.map(([url]) => url as string).filter(url => url.includes('/state'));
    expect(states).toHaveLength(2);
    expect(states[1]).toContain('layout=-1');
    warn.mockRestore();
});
it('does not ask again while no board is connected', async () => {
    window.__keybardNativeState = true;
    const empty = { ...state, board: null, valid: false };
    const fetch = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('bootstrap') ? { apiVersion: 1, token: 'test' } : empty)));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useHost({ overlay: true }));
    await waitFor(() => expect(result.current.state?.session).toBe('one'));
    act(() => window.dispatchEvent(new CustomEvent('keybard-host-state', { detail: { ...empty, active: 2 } })));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(fetch.mock.calls.filter(([url]) => (url as string).includes('/state'))).toHaveLength(1);
});
