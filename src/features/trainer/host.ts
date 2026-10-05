import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardInfo } from '@/types/vial.types';
import type { Preferences } from './core';
export interface HostConfig extends Preferences { highlightPressed: boolean; manualDefault: number }
export interface HostSnapshot {
    apiVersion: number; config: HostConfig; revision: number; layoutRevision: number;
    board: (KeyboardInfo & { trainerLabels: Record<string, string> }) | null;
    selectedDevice: string | null; status: string; devices: { id: string; name: string; serial: string }[];
    active: number; default: number | null; valid: boolean; pressed: number[];
    practiceHidden: number[]; practiceTarget: number | null;
    matrixAvailable: boolean | null; visible: boolean; arrange: boolean; session: string;
}
declare global { interface Window { __keybardNativeState?: boolean } }
export function useHost() {
    const [state, setState] = useState<HostSnapshot | null>(null);
    const [error, setError] = useState('');
    const token = useRef('');
    const current = useRef<HostSnapshot | null>(null);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    useEffect(() => {
        let alive = true, timer: ReturnType<typeof setTimeout>;
        const abort = new AbortController();
        let lastReceived = Date.now();
        const watchdog = setInterval(() => { if (current.current && Date.now() - lastReceived > 1200) { current.current = null; setState(null); setError('Host connection stale. The preview is paused.'); } }, 200);
        function receive(data: HostSnapshot) {
            if (!alive || data.apiVersion !== 1) return;
            lastReceived = Date.now();
            if (current.current?.session !== data.session) current.current = null;
            if (current.current && data.revision < current.current.revision) { data.revision = current.current.revision; data.config = current.current.config; }
            if (data.layoutRevision === current.current?.layoutRevision && !data.board) data.board = current.current.board;
            current.current = data; setState(data);
        }
        const native = !!window.__keybardNativeState;
        const onState = (event: Event) => receive((event as CustomEvent<HostSnapshot>).detail);
        const onHeartbeat = () => { lastReceived = Date.now(); if (!current.current) void poll(); };
        if (native) {
            window.addEventListener('keybard-host-state', onState);
            window.addEventListener('keybard-host-heartbeat', onHeartbeat);
        }
        async function poll() {
            try {
                const r = await fetch(`/api/host/state?layout=${current.current?.layoutRevision ?? -1}`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(1200)]), cache: 'no-store' });
                if (!r.ok) throw new Error('Host connection lost');
                receive(await r.json() as HostSnapshot);
            } catch {
                if (alive) { current.current = null; setState(null); setError('Host connection lost. The preview is paused.'); }
            }
            if (alive && !native) timer = setTimeout(poll, 80);
        }
        void (async () => {
            try {
                const r = await fetch('/api/host/bootstrap', { signal: abort.signal, cache: 'no-store' });
                if (!r.ok) return;
                const data = await r.json();
                if (data.apiVersion !== 1 || !alive) return;
                token.current = data.token; void poll();
            } catch { /* Browser-only Keybard has no host endpoint. */ }
        })();
        return () => { alive = false; clearTimeout(timer); clearInterval(watchdog); abort.abort(); window.removeEventListener('keybard-host-state', onState); window.removeEventListener('keybard-host-heartbeat', onHeartbeat); };
    }, []);
    const command = useCallback(async (value: Record<string, unknown>) => {
        try {
            const r = await fetch('/api/host/command', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Keybard-Token': token.current }, body: JSON.stringify(value) });
            const data = await r.json(); if (!r.ok) throw new Error(data.error); setError('');
        } catch (e) { setError(e instanceof Error ? e.message : 'Host command failed'); }
    }, []);
    const configure = useCallback(async (config: HostConfig) => {
        if (!current.current || busyRef.current) return false;
        busyRef.current = true; setBusy(true);
        try {
            const r = await fetch('/api/host/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Keybard-Token': token.current }, body: JSON.stringify({ config, revision: current.current.revision }) });
            const data = await r.json(); if (!r.ok) throw new Error(data.error);
            current.current = { ...current.current, config, revision: data.revision };
            setState(current.current); setError(''); return true;
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not save host settings'); return false; }
        finally { busyRef.current = false; setBusy(false); }
    }, []);
    return { state, error, command, configure, busy };
}
