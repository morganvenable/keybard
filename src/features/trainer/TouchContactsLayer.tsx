import { useEffect, useMemo, useRef, useState } from 'react';

import { placeDevice, type KeyRect } from '@/utils/pointing-geometry';
import { surfaceFrame } from './PointingOverlayLayer';

// Demo: the fingers on the native touchpad, live. With the native touchpad the
// computer owns both pads and does pinch, scroll and the rest itself; Keybard
// Host reads a passive copy of the touchpad's input reports and sends each
// contact here as a keybard-host-touch event. Each finger is a dot on its pad,
// and with two fingers down a line joins them, labeled with their distance on
// the one surface the computer sees (left pad, 10 mm gap, right pad).

export interface TouchContact { id: number; hand: 'left' | 'right'; u: number; v: number; palm: boolean }
export interface TouchDetail { contacts: TouchContact[]; spread: number | null }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The keybard-host-touch event's detail, validated; null if it isn't one. */
export function hostTouchEvent(detail: unknown): TouchDetail | null {
    if (!detail || typeof detail !== 'object') return null;
    const d = detail as Record<string, unknown>;
    if (!Array.isArray(d.contacts)) return null;
    const contacts: TouchContact[] = [];
    for (const c of d.contacts.slice(0, 5)) {
        if (!c || typeof c !== 'object') continue;
        const o = c as Record<string, unknown>;
        if (o.hand !== 'left' && o.hand !== 'right') continue;
        if (typeof o.u !== 'number' || typeof o.v !== 'number' || !Number.isFinite(o.u) || !Number.isFinite(o.v)) continue;
        contacts.push({ id: typeof o.id === 'number' ? o.id : contacts.length, hand: o.hand, u: clamp01(o.u), v: clamp01(o.v), palm: o.palm === true });
    }
    const spread = typeof d.spread === 'number' && Number.isFinite(d.spread) ? d.spread : null;
    return { contacts, spread };
}

/** Window px of a contact on its pad, given the pad's placement. */
export function contactPx(c: TouchContact, pad: { cx: number; cy: number; w: number; h: number }) {
    return { x: pad.cx - pad.w / 2 + c.u * pad.w, y: pad.cy - pad.h / 2 + c.v * pad.h };
}

const COLORS = ['#099e7c', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

export function TouchContactsLayer({ keys }: { keys: KeyRect[] }) {
    const [touch, setTouch] = useState<TouchDetail | null>(null);
    const [size, setSize] = useState(() => ({ w: typeof window !== 'undefined' ? window.innerWidth : 1000, h: typeof window !== 'undefined' ? window.innerHeight : 300 }));
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const on = (event: Event) => { const t = hostTouchEvent((event as CustomEvent).detail); if (t) setTouch(t); };
        const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('keybard-host-touch', on);
        window.addEventListener('resize', onResize);
        return () => { window.removeEventListener('keybard-host-touch', on); window.removeEventListener('resize', onResize); };
    }, []);

    // Both pads where Keybard's renderer puts them, in window px.
    const pads = useMemo(() => {
        if (!keys.length) return null;
        const frame = surfaceFrame(keys, size.w, size.h);
        const rel = keys.map(k => ({ x: k.x - frame.minX, y: k.y - frame.minY, w: k.w, h: k.h }));
        const out: Partial<Record<'left' | 'right', { cx: number; cy: number; w: number; h: number; r: number }>> = {};
        for (const side of ['left', 'right'] as const) {
            const pl = placeDevice(rel, side, 'pad');
            if (!pl || !pl.w || !pl.h) continue;
            out[side] = { cx: frame.x + pl.cx * frame.unitPx, cy: frame.y + pl.cy * frame.unitPx, w: pl.w * frame.unitPx, h: pl.h * frame.unitPx, r: (pl.corner ?? 0.2) * frame.unitPx };
        }
        return out;
    }, [keys, size.w, size.h]);

    const points = useMemo(() => (touch && pads ? touch.contacts.flatMap(c => {
        const pad = pads[c.hand];
        return pad ? [{ c, ...contactPx(c, pad) }] : [];
    }) : []), [touch, pads]);

    useEffect(() => {
        const cv = canvas.current;
        const ctx = cv?.getContext?.('2d');
        if (!cv || !ctx || !pads) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (cv.width !== Math.round(size.w * dpr)) { cv.width = Math.round(size.w * dpr); cv.height = Math.round(size.h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.w, size.h);
        for (const pad of Object.values(pads)) {
            if (!pad) continue;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(pad.cx - pad.w / 2, pad.cy - pad.h / 2, pad.w, pad.h, pad.r); else ctx.rect(pad.cx - pad.w / 2, pad.cy - pad.h / 2, pad.w, pad.h);
            ctx.fillStyle = 'rgba(20,22,26,0.55)'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        const fingers = points.filter(p => !p.c.palm);
        if (fingers.length >= 2) {
            const [a, b] = fingers;
            ctx.save();
            ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.restore();
            if (touch?.spread != null) {
                const text = `${Math.round(touch.spread)} mm`;
                ctx.save();
                ctx.font = '600 15px Inter, system-ui, sans-serif';
                const tw = ctx.measureText?.(text)?.width ?? 50;
                const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 22;
                ctx.fillStyle = 'rgba(255,255,255,0.94)';
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(mx - tw / 2 - 10, my - 13, tw + 20, 26, 13); else ctx.rect(mx - tw / 2 - 10, my - 13, tw + 20, 26);
                ctx.fill();
                ctx.fillStyle = '#111214'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(text, mx, my + 1);
                ctx.restore();
            }
        }
        for (const p of points) {
            const color = COLORS[p.c.id % COLORS.length];
            ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
            ctx.fillStyle = p.c.palm ? 'rgba(255,255,255,0.15)' : color; ctx.globalAlpha = p.c.palm ? 1 : 0.9; ctx.fill();
            ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
        }
    }, [points, pads, size.w, size.h, touch?.spread]);

    if (!pads || (!pads.left && !pads.right)) return null;
    return (
        <div className="pointer-events-none" data-touch-layer="" data-touch-count={points.length} data-touch-spread={touch?.spread ?? ''} style={{ position: 'fixed', inset: 0 }}>
            <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: size.w, height: size.h }} />
            {(['left', 'right'] as const).map(side => pads[side] && <span key={side} data-touch-pad={side} data-cx={Math.round(pads[side]!.cx)} data-cy={Math.round(pads[side]!.cy)} data-w={Math.round(pads[side]!.w)} data-h={Math.round(pads[side]!.h)} hidden />)}
            {points.map(p => <span key={p.c.id} data-touch-contact={p.c.id} data-hand={p.c.hand} data-x={Math.round(p.x)} data-y={Math.round(p.y)} data-palm={p.c.palm ? '1' : '0'} hidden />)}
        </div>
    );
}
