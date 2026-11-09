import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Key } from '../../src/components/Key';

vi.mock('@/contexts/LayoutSettingsContext', () => ({
    useLayoutSettings: () => ({ internationalLayout: 'us', keyVariant: 'default', layoutMode: 'sidebar' }),
}));
vi.mock('@/hooks/useKeyDrag', () => ({
    useKeyDrag: ({ unitSize }: { unitSize?: number }) => ({
        isDragSource: false,
        isDragHover: false,
        currentUnitSize: unitSize ?? 60,
        handleMouseEnter: () => {},
        handleMouseLeave: () => {},
        handleMouseDown: () => {},
        handleMouseUp: () => {},
    }),
}));

type Variant = 'small' | 'medium' | 'default';

/** Renders a picker-style key (forceLabel, relative) and returns the centre-text element. */
function centreOf(variant: Variant, label: string, keycode: string, centreText: string) {
    render(
        <Key x={0} y={0} w={1} h={1} row={0} col={0} keycode={keycode} label={label}
             forceLabel isRelative variant={variant} disableTooltip />
    );
    return screen.getByText(centreText);
}

describe('Key: sniper/boost toggle labels fit at every key size', () => {
    // A picker tile's label is fitted to the tile (src/lib/tileLabel.ts, checked in a browser by
    // tests/e2e/picker_tile_labels_e2e.py). jsdom has no layout, so these check the size the
    // fitting starts from: the label's own size when it fits as it is.
    const size = (el: HTMLElement) => (el.closest('[data-tile-text]') as HTMLElement).style.fontSize;

    it('small keys start a 4-character "2xTG" label at 8.5px so it stays inside 24px', () => {
        expect(size(centreOf('small', 'Sniper 2xTG', 'SV_SNIPER_2_TG', '2xTG'))).toBe('8.5px');
    });

    it('medium keys keep the native size for "2xTG"', () => {
        expect(size(centreOf('medium', 'Sniper 2xTG', 'SV_SNIPER_2_TG', '2xTG'))).toBe('12px');
    });

    it('default keys keep the native size for "2xTG"', () => {
        expect(size(centreOf('default', 'Boost 2xTG', 'SV_BOOST_2_TG', '2xTG'))).toBe('15px');
    });

    it('short hold labels like "2x" keep the native size at small size', () => {
        expect(size(centreOf('small', 'Sniper 2x', 'SV_SNIPER_2', '2x'))).toBe('10px');
    });

    it('a long label such as "2x Toggle" starts at the long-label size', () => {
        expect(size(centreOf('small', 'Boost 2x Toggle', 'SV_BOOST_2_TG', '2x Toggle'))).toBe('9.6px');
    });

    it('a picker tile carries its full name as tooltip and accessible name', () => {
        render(
            <Key x={0} y={0} w={1} h={1} row={0} col={0} keycode="KC_WBAK" label={"Browser\nBack"} fullName="Browser Back"
                 isRelative variant="small" disableTooltip />
        );
        const tile = screen.getByTitle('Browser Back');
        expect(tile.getAttribute('aria-label')).toBe('Browser Back');
    });
});

describe('Key: a picker tile with a description', () => {
    it('adds it to the hover tooltip and gives it as the accessible description', () => {
        const { container } = render(
            <Key x={0} y={0} w={1} h={1} row={0} col={0} keycode="SV_SCROLL_TOGGLE" label="Scroll Toggle"
                 forceLabel isRelative variant="medium" disableTooltip description="Switches between pointing and scrolling." />
        );
        const tile = container.querySelector('[data-keycap]')!;
        expect(tile.getAttribute('title')).toBe('Scroll Toggle\nSwitches between pointing and scrolling.');
        expect(tile.getAttribute('aria-description')).toBe('Switches between pointing and scrolling.');
        expect(tile.getAttribute('aria-label')).toBe('Scroll Toggle');
    });
});
