import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useHost } from '@/features/trainer/host';
import { DEFAULTS } from '@/features/trainer/core';

// host.ts reports a lost connection as `lost`, not as an `error` string (docs/practice/spec.md §5.16,
// "Connection lost or stale"): set by a failed poll or the 1.2 s watchdog after Host had answered,
// cleared by the next snapshot, never set before the first one.

const snapshot = { apiVersion: 1, revision: 1, layoutRevision: 1, session: 's', board: null, config: { ...DEFAULTS, manualDefault: 1, highlightPressed: false },
    active: 0, default: 1, valid: true, pressed: [], devices: [], practiceHidden: [], practiceTarget: null, visible: true, arrange: false, selectedDevice: null, status: '', matrixAvailable: true };
const fetchMock = vi.fn();
let stateOk = true;
beforeEach(() => {
    stateOk = true;
    document.documentElement.dataset.keybardHost = 'true';
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/api/host/bootstrap')) return new Response(JSON.stringify({ token: 't', apiVersion: 1 }));
        if (String(url).includes('/api/host/state')) return stateOk ? new Response(JSON.stringify(snapshot)) : new Response('{}', { status: 503 });
        return new Response('{}');
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.keybardHost; delete window.__keybardNativeState; });

it('is not lost before the first snapshot, even when polls fail', async () => {
    stateOk = false;
    const { result, unmount } = renderHook(() => useHost());
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/state')).length).toBeGreaterThan(2));
    expect(result.current.lost).toBe(false);
    expect(result.current.state).toBeNull();
    expect(result.current.error).toBe('');
    unmount();
});

it('sets lost when a poll fails after Host answered, and clears it on the next snapshot', async () => {
    const { result, unmount } = renderHook(() => useHost());
    await waitFor(() => expect(result.current.state).not.toBeNull());
    expect(result.current.lost).toBe(false);
    stateOk = false;
    await waitFor(() => expect(result.current.lost).toBe(true));
    expect(result.current.state).toBeNull();
    // A lost connection is not an error: the page shows its own notice.
    expect(result.current.error).toBe('');
    stateOk = true;
    await waitFor(() => expect(result.current.lost).toBe(false));
    expect(result.current.state).not.toBeNull();
    unmount();
});

it('sets lost when no data arrives for 1.2 s, and clears it when Host speaks again', async () => {
    window.__keybardNativeState = true;
    const { result, unmount } = renderHook(() => useHost());
    await waitFor(() => expect(result.current.state).not.toBeNull());
    await waitFor(() => expect(result.current.lost).toBe(true), { timeout: 2500 });
    expect(result.current.state).toBeNull();
    expect(result.current.error).toBe('');
    act(() => window.dispatchEvent(new CustomEvent('keybard-host-state', { detail: { ...snapshot, revision: 2 } })));
    expect(result.current.lost).toBe(false);
    expect(result.current.state?.revision).toBe(2);
    unmount();
});
