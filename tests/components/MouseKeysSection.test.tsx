import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MouseKeysSection from '../../src/layout/SecondarySidebar/Panels/MouseKeysSection';
import { customKeycodeHome } from '../../src/constants/custom-keycode-homes';
import { SVALBOARD_VIAL_CUSTOM_KEYCODES } from '../../src/constants/svalboard-vial';

// The section must size every key row from one effectiveVariant, so the keys
// are stubbed to expose exactly the props that control sizing.
const layoutSettings = { keyVariant: 'default' as 'small' | 'medium' | 'default', layoutMode: 'sidebar' };

vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => layoutSettings }));
const keyboardState: { keyboard: unknown } = { keyboard: null };
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardState }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));
vi.mock('@/components/Key', () => ({
    Key: ({ keycode, variant, className, label, onClick }: { keycode: string; variant?: string; className?: string; label?: string; onClick?: () => void }) => (
        <div data-testid="key" data-keycode={keycode} data-variant={variant ?? ''} data-size={className ?? ''} data-label={label ?? ''} onClick={onClick} />
    ),
}));

const EXPECTED_KEYS = [
    'KC_BTN1', 'KC_BTN2', 'KC_BTN3', 'KC_BTN4', 'KC_BTN5',
    // Sniper and Boost, one row each: momentary 2x, 3x, 5x, then the toggles.
    'SV_SNIPER_2', 'SV_SNIPER_3', 'SV_SNIPER_5', 'SV_SNIPER_2_TG', 'SV_SNIPER_3_TG', 'SV_SNIPER_5_TG',
    'SV_BOOST_2', 'SV_BOOST_3', 'SV_BOOST_5', 'SV_BOOST_2_TG', 'SV_BOOST_3_TG', 'SV_BOOST_5_TG',
    // Scroll.
    'SV_SCROLL_TOGGLE', 'SV_LEFT_SCROLL_TOGGLE', 'SV_RIGHT_SCROLL_TOGGLE',
    'SV_VELOCITY_SCROLL', 'SV_VELOCITY_SCROLL_TOGGLE',
    // Pointer.
    'SV_RECALIBRATE_POINTER', 'SV_TOGGLE_AUTOMOUSE', 'SV_MH_CHANGE_TIMEOUTS',
    // DPI, last.
    'SV_LEFT_DPI_INC', 'SV_LEFT_DPI_DEC', 'SV_RIGHT_DPI_INC', 'SV_RIGHT_DPI_DEC',
];
// Hidden: Drag Scroll is not offered; Natural Scroll and Axis Lock are settings under the hand cards.
const HIDDEN_KEYS = ['SV_SCROLL_HOLD', 'SV_NATURAL_SCROLL_TOGGLE', 'SV_AXIS_SCROLL_LOCK'];

function renderedKeys() {
    return screen.getAllByTestId('key').map((el) => ({
        keycode: el.getAttribute('data-keycode'),
        variant: el.getAttribute('data-variant'),
        size: el.getAttribute('data-size'),
    }));
}

/** Every row (mouse buttons, sniper, boost, scroll) must share one variant and one size class. */
function expectUniformSizing(expectedVariant: string, expectedSize: string) {
    const keys = renderedKeys();
    expect(keys.map((k) => k.keycode)).toEqual(EXPECTED_KEYS);
    for (const k of keys) {
        expect(k.variant, `${k.keycode} variant`).toBe(expectedVariant);
        expect(k.size, `${k.keycode} size class`).toBe(expectedSize);
    }
}

describe('MouseKeysSection: mouse buttons, sniper, boost and scroll rows size identically', () => {
    beforeEach(() => {
        layoutSettings.keyVariant = 'default';
        keyboardState.keyboard = null;
    });

    it('draws the groups most used first, with DPI last', () => {
        const { container } = render(<MouseKeysSection />);
        const groups = [...container.querySelectorAll('[data-key-group]')].map((e) => e.getAttribute('data-key-group'));
        expect(groups).toEqual(['Mouse Buttons', 'Modifiers', 'Sniper Keys', 'Boost', 'Scroll', 'Pointer', 'DPI']);
        const keys = renderedKeys().map((k) => k.keycode);
        expect(keys.slice(-4)).toEqual(['SV_LEFT_DPI_INC', 'SV_LEFT_DPI_DEC', 'SV_RIGHT_DPI_INC', 'SV_RIGHT_DPI_DEC']);
    });

    it('restores the original Sniper and Boost rows: momentary 2x, 3x, 5x then the toggles, in one row each', () => {
        const { container } = render(<MouseKeysSection />);
        const row = (name: string) => [...container.querySelector(`[data-key-group="${name}"]`)!.querySelectorAll('[data-keycode]')]
            .map((e) => e.getAttribute('data-label'));
        expect(row('Sniper Keys')).toEqual(['Sniper 2x', 'Sniper 3x', 'Sniper 5x', 'Sniper 2xTG', 'Sniper 3xTG', 'Sniper 5xTG']);
        expect(row('Boost')).toEqual(['Boost 2x', 'Boost 3x', 'Boost 5x', 'Boost 2xTG', 'Boost 3xTG', 'Boost 5xTG']);
    });

    it.each([false, true])('has no More keys disclosure and no closed group (tray: %s)', (columns) => {
        const { container } = render(<MouseKeysSection compact={columns} columns={columns} />);
        expect(container.querySelector('details')).toBeNull();
        expect(container.querySelector('[data-testid$="more-keys"]')).toBeNull();
        expect(screen.queryByText(/more keys/i)).toBeNull();
    });

    it('lists exactly the keys the placement table homes in Pointing Devices', () => {
        render(<MouseKeysSection />);
        const listed = renderedKeys().map((k) => k.keycode!).filter((k) => k.startsWith('SV_'));
        for (const k of listed) expect(customKeycodeHome(k), k).toBe('pointing');
        const homed = (SVALBOARD_VIAL_CUSTOM_KEYCODES as unknown as { name: string }[]).map((k) => k.name).filter((n) => customKeycodeHome(n) === 'pointing');
        for (const k of homed) expect(listed, k).toContain(k);
        for (const k of HIDDEN_KEYS) expect(customKeycodeHome(k)).toBe('hidden');
    });

    it('lists no Drag Scroll, Natural Scroll or Axis Lock key', () => {
        render(<MouseKeysSection />);
        const keys = renderedKeys().map((k) => k.keycode);
        for (const k of HIDDEN_KEYS) expect(keys).not.toContain(k);
    });

    it('offers Velocity Scroll (SV_VELOCITY_SCROLL) after the scroll toggles, and assigns it', () => {
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys.indexOf('SV_VELOCITY_SCROLL')).toBe(keys.indexOf('SV_RIGHT_SCROLL_TOGGLE') + 1);
        const key = screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === 'SV_VELOCITY_SCROLL')!;
        expect(key.getAttribute('data-label')).toBe('Velocity Scroll');
        fireEvent.click(key);
        expect(assignKeycode).toHaveBeenCalledWith('SV_VELOCITY_SCROLL');
    });

    it('offers the Velocity Scroll toggle right after Velocity Scroll, and assigns it', () => {
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys.indexOf('SV_VELOCITY_SCROLL_TOGGLE')).toBe(keys.indexOf('SV_VELOCITY_SCROLL') + 1);
        const key = screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === 'SV_VELOCITY_SCROLL_TOGGLE')!;
        expect(key.getAttribute('data-label')).toBe('Velocity Scroll Toggle');
        fireEvent.click(key);
        expect(assignKeycode).toHaveBeenCalledWith('SV_VELOCITY_SCROLL_TOGGLE');
    });

    it('offers the hold key alone for firmware with Velocity Scroll but no toggle', () => {
        keyboardState.keyboard = { custom_keycodes: [
            { name: 'SV_SCROLL_HOLD', title: '', shortName: 'Scroll\nToggle\nHold' },
            { name: 'SV_VELOCITY_SCROLL', title: '', shortName: 'Vel\nScroll' },
        ] };
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys).toContain('SV_VELOCITY_SCROLL');
        expect(keys).not.toContain('SV_VELOCITY_SCROLL_TOGGLE');
    });

    it('leaves Velocity Scroll out for firmware that has no such key', () => {
        keyboardState.keyboard = { custom_keycodes: [{ name: 'SV_SCROLL_HOLD', title: '', shortName: 'Scroll\nToggle\nHold' }] };
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys).not.toContain('SV_SCROLL_HOLD');
        expect(keys).not.toContain('SV_VELOCITY_SCROLL');
        expect(keys).not.toContain('SV_VELOCITY_SCROLL_TOGGLE');
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


describe('MouseKeysSection: labels', () => {
    beforeEach(() => { keyboardState.keyboard = null; });

    it('labels the Mouse Key Timer so it is readable, and keeps its full name for hover', () => {
        render(<MouseKeysSection />);
        const key = screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === 'SV_MH_CHANGE_TIMEOUTS')!;
        // Key.tsx drops "Mouse" and "Timer" from a label; neither may be in the label or it reads just "KEY".
        expect(key.getAttribute('data-label')).toBe('Layer Time');
        expect(key.getAttribute('data-label')).not.toMatch(/(mouse|timer)/i);
    });
});
