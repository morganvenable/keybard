import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HOST_ORIGIN, useHost } from '@/features/trainer/host';

const fetchMock = vi.fn();
beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.keybardHost;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/api/host/bootstrap')) return new Response(JSON.stringify({ token: 't', apiVersion: 1 }));
        return new Response('{}', { status: 503 });
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.keybardHost; });

it('does not probe loopback from a hosted page until the user connects, then remembers it', async () => {
    const { result, unmount } = renderHook(() => useHost());
    await new Promise(r => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.local).toBe(false);
    act(() => result.current.connect());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${HOST_ORIGIN}/api/host/bootstrap`, expect.anything()));
    await waitFor(() => expect(localStorage.getItem('keybard-host-remote')).toBe('1'));
    unmount();
    fetchMock.mockClear();
    const again = renderHook(() => useHost());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${HOST_ORIGIN}/api/host/bootstrap`, expect.anything()));
    again.unmount();
});

it('reports an unreachable host only when the user asked to connect', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useHost());
    act(() => result.current.connect());
    await waitFor(() => expect(result.current.error).toMatch(/Could not reach Keybard Host/));
    expect(localStorage.getItem('keybard-host-remote')).toBeNull();
});

it('uses relative URLs on the copy of Keybard served by the host', async () => {
    document.documentElement.dataset.keybardHost = 'true';
    const { result, unmount } = renderHook(() => useHost());
    expect(result.current.local).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/host/bootstrap', expect.anything()));
    unmount();
});

it("keeps the host's release and bundled Keybard from bootstrap; older hosts are 'unknown'", async () => {
    document.documentElement.dataset.keybardHost = 'true';
    fetchMock.mockImplementation(async (url: string) => String(url).endsWith('/api/host/bootstrap')
        ? new Response(JSON.stringify({ token: 't', apiVersion: 1, version: 'vLaunch2', keybardCommit: '5954334' }))
        : new Response('{}', { status: 503 }));
    const current = renderHook(() => useHost());
    await waitFor(() => expect(current.result.current.build).toEqual({ version: 'vLaunch2', keybardCommit: '5954334' }));
    current.unmount();
    fetchMock.mockImplementation(async (url: string) => String(url).endsWith('/api/host/bootstrap')
        ? new Response(JSON.stringify({ token: 't', apiVersion: 1 }))
        : new Response('{}', { status: 503 }));
    const older = renderHook(() => useHost());
    await waitFor(() => expect(older.result.current.build).toEqual({ version: 'unknown', keybardCommit: null }));
    older.unmount();
});
