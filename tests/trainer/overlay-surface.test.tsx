import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OverlaySurface } from '@/features/trainer/OverlaySurface';
import HostOverlay from '@/features/trainer/HostOverlay';
import { DEFAULTS } from '@/features/trainer/core';
import { surfaceKeys } from '@/features/trainer/useSurfaceKeys';
import { PREVIEW_BACKGROUNDS } from '@/features/trainer/preview-backgrounds';

// The page-drawn selection ring (docs/practice/spec.md §5.14 "Two-tone selection ring"): only the page
// preview passes `selected`; HostOverlay never does, so the desktop overlay is unchanged.

const board = { rows: 10, cols: 6, keymap: [Array(60).fill(4)], trainerLabels: {},
    keylayout: { 0: { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1 }, 1: { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1 }, 6: { row: 1, col: 0, x: 0, y: 1, w: 1, h: 1 } } };
const keys = surfaceKeys(board, 1, 1, 'Both');

const hostState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/features/trainer/host', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/trainer/host')>()),
    useHost: () => ({ state: hostState.current }),
}));

const surface = (props: Partial<Parameters<typeof OverlaySurface>[0]> = {}) => render(<OverlaySurface keys={keys} appearance={DEFAULTS.appearance}
    changed={new Set()} held={new Set()} hidden={new Set()} effect="Off" duration={150} {...props} />);

describe('selection ring', () => {
    it('draws nothing without a selection', () => {
        const { container } = surface();
        expect(container.querySelector('[data-selection-ring]')).toBeNull();
    });

    it('draws a 2 px kb-select ring with a 1 px halo in the background color, above every key', () => {
        const { container } = surface({ selected: keys[1].id, selectionHalo: PREVIEW_BACKGROUNDS.Light.halo });
        const ring = container.querySelector('[data-selection-ring]')!;
        expect(ring).not.toBeNull();
        const [halo, inner] = [...ring.querySelectorAll('rect')];
        expect(halo.getAttribute('stroke')).toBe('#111214');
        expect(halo.getAttribute('stroke-width')).toBe('1');
        expect(inner.getAttribute('class')).toContain('stroke-kb-select');
        expect(inner.getAttribute('stroke-width')).toBe('2');
        // Painted after the keys, so neighbors can't cover it, and it doesn't take clicks.
        expect(container.querySelector('svg')!.lastElementChild).toBe(ring);
        expect(ring.getAttribute('pointer-events')).toBe('none');
        // The user's colors are untouched.
        expect(container.querySelector('g rect')!.getAttribute('stroke')).toBe(DEFAULTS.appearance.outline);
    });

    it('uses a white halo on the Dark background and a dark one on Light and Busy', () => {
        expect(PREVIEW_BACKGROUNDS.Dark.halo).toBe('#ffffff');
        expect(PREVIEW_BACKGROUNDS.Light.halo).toBe('#111214');
        expect(PREVIEW_BACKGROUNDS.Busy.halo).toBe('#111214');
    });

    it('is never drawn by HostOverlay', () => {
        hostState.current = { valid: true, visible: true, board, active: 1, default: 1, pressed: [0], practiceHidden: [], practiceTarget: 1, modifiers: null,
            config: { ...DEFAULTS, manualDefault: 1, highlightPressed: true } };
        const { container } = render(<HostOverlay />);
        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelector('[data-selection-ring]')).toBeNull();
        expect(container.querySelector('.stroke-kb-select')).toBeNull();
    });
});
