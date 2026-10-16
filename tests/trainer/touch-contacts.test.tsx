// Demo: the native touchpad's fingers in the Keybard Host overlay.
// The events replayed here are what Keybard Host sends while a pinch across both
// pads is replayed from recorded touchpad reports
// (companion/overlay-host/tests/fixtures/ptp-pinch-events.json, checked against
// the reports by companion/overlay-host/tests/test_touch.py).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { hostTouchEvent } from '@/features/trainer/TouchContactsLayer';

const hostState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/features/trainer/host', async (original) => ({
    ...(await original<typeof import('@/features/trainer/host')>()),
    useHost: () => ({ state: hostState.current }),
}));
import HostOverlay from '@/features/trainer/HostOverlay';

const STATE = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/host-touch-demo-state.json'), 'utf8'));
const EVENTS: { t: number; detail: unknown }[] = JSON.parse(readFileSync(resolve(__dirname, '../../companion/overlay-host/tests/fixtures/ptp-pinch-events.json'), 'utf8'));

const send = (detail: unknown) => act(() => { window.dispatchEvent(new CustomEvent('keybard-host-touch', { detail })); });
const contacts = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('[data-touch-contact]')].map(e => ({
    hand: e.dataset.hand, x: Number(e.dataset.x), y: Number(e.dataset.y),
}));
const pad = (root: ParentNode, side: string) => {
    const e = root.querySelector<HTMLElement>(`[data-touch-pad="${side}"]`)!;
    const [cx, cy, w, h] = ['cx', 'cy', 'w', 'h'].map(k => Number(e.dataset[k]));
    return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
};
const inside = (p: { x: number; y: number }, r: ReturnType<typeof pad>) => p.x >= r.left - 1 && p.x <= r.right + 1 && p.y >= r.top - 1 && p.y <= r.bottom + 1;

describe('touchpad contacts in the overlay (pinch across both pads, replayed)', () => {
    afterEach(() => { hostState.current = null; });

    it('draws both pads, one dot per finger on its own pad, and the spread as the fingers open and close', () => {
        Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 420, configurable: true });
        hostState.current = STATE;
        const { container } = render(<HostOverlay />);
        const layer = container.querySelector<HTMLElement>('[data-touch-layer]');
        expect(layer).not.toBeNull();
        const left = pad(container, 'left'), right = pad(container, 'right');
        expect(left.right).toBeLessThan(right.left);   // the left pad sits left of the right one

        const spreads: number[] = [];
        let first: ReturnType<typeof contacts> | null = null, widest: ReturnType<typeof contacts> | null = null;
        for (const e of EVENTS) {
            send(e.detail);
            const now = contacts(container);
            if (now.length !== 2) continue;
            expect(now.map(c => c.hand)).toEqual(['left', 'right']);
            expect(inside(now[0], left)).toBe(true);
            expect(inside(now[1], right)).toBe(true);
            const spread = Number(layer!.dataset.touchSpread);
            if (!spreads.length || spread > Math.max(...spreads)) widest = now;
            spreads.push(spread);
            first ??= now;
        }
        expect(spreads.length).toBe(150);
        expect(Math.max(...spreads)).toBeCloseTo(77.7, 1);
        // the fingers move apart on screen as they open
        expect(widest![0].x).toBeLessThan(first![0].x);
        expect(widest![1].x).toBeGreaterThan(first![1].x);
        // and lift at the end
        expect(contacts(container)).toEqual([]);
        expect(layer!.dataset.touchCount).toBe('0');
    });

    it('is not there unless the Host draws contacts', () => {
        hostState.current = { ...STATE, touchContacts: false };
        const { container } = render(<HostOverlay />);
        expect(container.querySelector('[data-touch-layer]')).toBeNull();
    });

    it('takes only well-formed contacts', () => {
        expect(hostTouchEvent(null)).toBeNull();
        expect(hostTouchEvent({ contacts: 'x' })).toBeNull();
        const d = hostTouchEvent({ contacts: [{ id: 1, hand: 'left', u: 2, v: -1 }, { id: 2, hand: 'up', u: 0, v: 0 }, { id: 3, hand: 'right', u: NaN, v: 0 }], spread: 'far' })!;
        expect(d.contacts).toEqual([{ id: 1, hand: 'left', u: 1, v: 0, palm: false }]);
        expect(d.spread).toBeNull();
    });
});
