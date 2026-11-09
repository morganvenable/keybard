import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '@/features/trainer/core';
import { HOST_ORIGIN, HOST_SLOW_POLL_MS, useHost } from '@/features/trainer/host';

const settings = vi.hoisted(() => ({ lang: 'de', altgr: true }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({
    useOptionalLayoutSettings: () => ({ internationalLayout: settings.lang, showShiftedLegends: true, showAltGrLegends: settings.altgr }),
}));
import { HostSettingsSync } from '@/features/trainer/HostSettingsSync';

let overlayUp = true;
let config = { ...DEFAULTS, layoutId: 'us', shiftedLegends: true, altgrLegends: false, highlightPressed: true, manualDefault: 1 };
const fetchMock = vi.fn();
const calls = (part: string) => fetchMock.mock.calls.filter(([u]) => String(u).includes(part)).length;
const setVisibility = (v: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
};
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('keybard-host-remote', '1');
    delete document.documentElement.dataset.keybardHost;
    settings.lang = 'de'; settings.altgr = true; overlayUp = true;
    config = { ...DEFAULTS, layoutId: 'us', shiftedLegends: true, altgrLegends: false, highlightPressed: true, manualDefault: 1 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (!overlayUp) throw new TypeError('Failed to fetch');
        const u = String(url);
        if (u.endsWith('/api/host/bootstrap')) return new Response(JSON.stringify({ token: 't', apiVersion: 1 }));
        if (u.endsWith('/api/host/config')) { config = JSON.parse(String(init?.body)).config; return new Response(JSON.stringify({ revision: 2 })); }
        if (u.includes('/api/host/state')) return new Response(JSON.stringify({ apiVersion: 1, config, revision: 1, layoutRevision: 1, session: 's', board: null, devices: [], selectedDevice: null }));
        return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    setVisibility('visible');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('background polling', () => {
    it('sends nothing while the tab is hidden, and resumes when it is visible', async () => {
        setVisibility('hidden');
        const { unmount } = renderHook(() => useHost({ background: true }));
        await flush(HOST_SLOW_POLL_MS * 20);
        expect(fetchMock).not.toHaveBeenCalled();
        setVisibility('visible');
        await flush(10);
        expect(calls('/api/host/')).toBeGreaterThan(0);
        fetchMock.mockClear();
        setVisibility('hidden');
        await flush(30_000);
        expect(fetchMock).not.toHaveBeenCalled();
        unmount();
    });

    it('with the dialog closed, makes at most one request every slow interval', async () => {
        const { unmount } = renderHook(() => useHost({ background: true }));
        await flush(10);
        fetchMock.mockClear();
        await flush(HOST_SLOW_POLL_MS * 10);
        expect(calls('/api/host/state')).toBeLessThanOrEqual(10);
        expect(calls('/api/host/state')).toBeGreaterThanOrEqual(9);
        unmount();
    });

    it('makes no requests at all when no Overlay was ever seen in this tab', async () => {
        localStorage.clear();
        const { unmount } = renderHook(() => useHost({ background: true }));
        await flush(HOST_SLOW_POLL_MS * 10);
        expect(fetchMock).not.toHaveBeenCalled();
        unmount();
    });

    it('picks up an Overlay that starts later within one slow interval', async () => {
        overlayUp = false;
        const { result, unmount } = renderHook(() => useHost({ background: true }));
        await flush(HOST_SLOW_POLL_MS * 2);
        expect(result.current.state).toBeNull();
        overlayUp = true;
        await flush(HOST_SLOW_POLL_MS + 50);
        expect(result.current.state?.config.layoutId).toBe('us');
        unmount();
    });
});

describe('settings sync is event driven', () => {
    it('writes once on connect, again only when a setting changes, never on polls', async () => {
        const { rerender, unmount } = render(<HostSettingsSync />);
        await flush(50);
        expect(calls('/api/host/config')).toBe(1);
        expect(config).toMatchObject({ layoutId: 'de', altgrLegends: true });
        await flush(HOST_SLOW_POLL_MS * 5);
        expect(calls('/api/host/config')).toBe(1);
        settings.lang = 'fr';
        rerender(<HostSettingsSync />);
        await flush(50);
        expect(calls('/api/host/config')).toBe(2);
        await flush(HOST_SLOW_POLL_MS * 3);
        expect(calls('/api/host/config')).toBe(2);
        unmount();
    });

    it('a Connect click from the dialog sends the settings once', async () => {
        localStorage.clear();
        settings.lang = 'de';
        const sync = render(<HostSettingsSync />);
        const dialog = renderHook(() => useHost());
        await flush(50);
        expect(fetchMock).not.toHaveBeenCalled();
        act(() => dialog.result.current.connect());
        await flush(50);
        expect(calls('/api/host/config')).toBe(1);
        sync.unmount(); dialog.unmount();
        expect(HOST_ORIGIN).toBeTruthy();
    });
});
