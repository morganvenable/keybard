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
