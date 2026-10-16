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
    it('small keys cap a 4-character "2xTG" label at 8.5px so it stays inside 24px', () => {
        const el = centreOf('small', 'Sniper 2xTG', 'SV_SNIPER_2_TG', '2xTG');
        expect(el.style.fontSize).toBe('8.5px');
    });

    it('medium keys keep the native size for "2xTG"', () => {
        expect(centreOf('medium', 'Sniper 2xTG', 'SV_SNIPER_2_TG', '2xTG').style.fontSize).toBe('');
    });

    it('default keys keep the native size for "2xTG"', () => {
        expect(centreOf('default', 'Boost 2xTG', 'SV_BOOST_2_TG', '2xTG').style.fontSize).toBe('');
    });

    it('short hold labels like "2x" are untouched at small size', () => {
        expect(centreOf('small', 'Sniper 2x', 'SV_SNIPER_2', '2x').style.fontSize).toBe('');
    });

    it('the old "2x Toggle" label still falls into the wrap rule, which is why it was replaced', () => {
        const el = centreOf('small', 'Boost 2x Toggle', 'SV_BOOST_2_TG', '2x Toggle');
        expect(el.style.fontSize).toBe('0.6rem');
        expect(el.style.whiteSpace).toBe('pre-line');
    });
});

describe('Key: pointing tool caps spell their words out and fit small keys', () => {
    const cap = (variant: Variant, keycode: string, label: string) => {
        const { container } = render(
            <Key x={0} y={0} w={1} h={1} row={0} col={0} keycode={keycode} label={label} keyContents={{ type: 'user', str: label }}
                 forceLabel isRelative variant={variant} disableTooltip />
        );
        return [...container.querySelectorAll<HTMLElement>('div')].find(el => el.textContent === label && el.children.length === 0)!;
    };
    it('scales a small key cap below the shrink size so "VOLUME / TOGGLE" stays inside the key', () => {
        const size = parseFloat(cap('small', 'SV_POINT_TOOL1_TOGGLE', 'VOLUME\nTOGGLE').style.fontSize);
        expect(size).toBeGreaterThan(4);
        expect(size).toBeLessThan(9.6);
    });
    it('gives HOLD and TOGGLE caps the same size on small keys', () => {
        expect(cap('small', 'SV_POINT_TOOL3_HOLD', 'TABS\nHOLD').style.fontSize).toBe(cap('small', 'SV_POINT_TOOL3_TOGGLE', 'TABS\nTOGGLE').style.fontSize);
    });
    it('leaves medium keys at the shrink size', () => {
        expect(cap('medium', 'SV_POINT_TOOL1_HOLD', 'VOLUME\nHOLD').style.fontSize).toBe('0.6rem');
    });
});
