import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POINT_CONTROL_FLAG } from '@/constants/point-controls';
import { render, screen, fireEvent } from '@testing-library/react';
import MouseKeysSection from '../../src/layout/SecondarySidebar/Panels/MouseKeysSection';

// The section must size every key row from one effectiveVariant, so the keys
// are stubbed to expose exactly the props that control sizing.
const preview = vi.hoisted(() => ({ keyboard: null as any, target: null as any, assign: vi.fn() }));
vi.mock('../../src/layout/SecondarySidebar/Panels/PointControlSettings', () => ({ default: () => null }));
const layoutSettings = { keyVariant: 'default' as 'small' | 'medium' | 'default', layoutMode: 'sidebar' };

vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => layoutSettings }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: preview.keyboard }) }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode: preview.assign, selectedTarget: preview.target }) }));
vi.mock('@/components/Key', () => ({
    Key: ({ keycode, variant, className, onClick }: { onClick?: () => void; keycode: string; variant?: string; className?: string }) => (
        <div onClick={onClick} data-testid="key" data-keycode={keycode} data-variant={variant ?? ''} data-size={className ?? ''} />
    ),
}));

const EXPECTED_KEYS = [
    'KC_BTN1', 'KC_BTN2', 'KC_BTN3', 'KC_BTN4', 'KC_BTN5',
    'SV_SNIPER_2', 'SV_SNIPER_3', 'SV_SNIPER_5', 'SV_SNIPER_2_TG', 'SV_SNIPER_3_TG', 'SV_SNIPER_5_TG',
    'SV_BOOST_2', 'SV_BOOST_3', 'SV_BOOST_5', 'SV_BOOST_2_TG', 'SV_BOOST_3_TG', 'SV_BOOST_5_TG',
];

function renderedKeys() {
    return screen.getAllByTestId('key').map((el) => ({
        keycode: el.getAttribute('data-keycode'),
        variant: el.getAttribute('data-variant'),
        size: el.getAttribute('data-size'),
    }));
}

/** Every row (mouse buttons, sniper, boost) must share one variant and one size class. */
function expectUniformSizing(expectedVariant: string, expectedSize: string) {
    const keys = renderedKeys();
    expect(keys.map((k) => k.keycode)).toEqual(EXPECTED_KEYS);
    for (const k of keys) {
        expect(k.variant, `${k.keycode} variant`).toBe(expectedVariant);
        expect(k.size, `${k.keycode} size class`).toBe(expectedSize);
    }
}

describe('MouseKeysSection: mouse buttons, sniper and boost rows size identically', () => {
    beforeEach(() => {
        layoutSettings.keyVariant = 'default';
        preview.keyboard = null; preview.target = null; preview.assign.mockClear();
    });

    it('renders the Boost row alongside Mouse Buttons and Sniper Keys', () => {
        render(<MouseKeysSection />);
        expect(screen.getByText('Mouse Buttons')).toBeInTheDocument();
        expect(screen.getByText('Sniper Keys')).toBeInTheDocument();
        expect(screen.getByText('Boost')).toBeInTheDocument();
    });

    it.each([
        ['small', 'h-[30px] w-[30px]'],
        ['medium', 'h-[45px] w-[45px]'],
        ['default', 'h-[60px] w-[60px]'],
    ] as const)('follows the user key-size setting "%s" for every row', (variant, size) => {
        layoutSettings.keyVariant = variant;
        render(<MouseKeysSection />);
        expectUniformSizing(variant, size);
    });

    it('uses the compact/medium override for every row in bottom-bar mode', () => {
        render(<MouseKeysSection compact variant="medium" />);
        expectUniformSizing('medium', 'h-[45px] w-[45px]');
    });

    it('compact without an override drops every row to small', () => {
        render(<MouseKeysSection compact />);
        expectUniformSizing('small', 'h-[30px] w-[30px]');
    });
});

describe('Pointing control key integration', () => {
    it.each([false, true])('sizes and assigns physical control keys (compact=%s)', compact => {
        preview.keyboard = { feature_flags2:POINT_CONTROL_FLAG };
        preview.target = { type: 'keyboard' };
        render(<MouseKeysSection compact={compact} />);
        const keys = screen.getAllByTestId('key');
        for (const key of keys) expect(key.dataset.size).toBe(compact ? 'h-[30px] w-[30px]' : 'h-[60px] w-[60px]');
        fireEvent.click(keys.find(key => key.dataset.keycode === 'SV_POINT_R_VOLUME_HOLD')!);
        expect(preview.assign).toHaveBeenCalledWith('SV_POINT_R_VOLUME_HOLD');
        fireEvent.click(screen.getByText('Left pointer'));
        expect(screen.getAllByTestId('key').some(key => key.dataset.keycode === 'SV_POINT_L_TASKS_TOGGLE')).toBe(true);
    });
});
