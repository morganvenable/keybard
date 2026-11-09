import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MouseKeysSection from '../../src/layout/SecondarySidebar/Panels/MouseKeysSection';

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
    'SV_SNIPER_2', 'SV_SNIPER_3', 'SV_SNIPER_5', 'SV_SNIPER_2_TG', 'SV_SNIPER_3_TG', 'SV_SNIPER_5_TG',
    'SV_BOOST_2', 'SV_BOOST_3', 'SV_BOOST_5', 'SV_BOOST_2_TG', 'SV_BOOST_3_TG', 'SV_BOOST_5_TG',
    'SV_LEFT_SCROLL_TOGGLE', 'SV_RIGHT_SCROLL_TOGGLE', 'SV_SCROLL_TOGGLE',
    'SV_VELOCITY_SCROLL', 'SV_VELOCITY_SCROLL_TOGGLE', 'SV_NATURAL_SCROLL_TOGGLE', 'SV_AXIS_SCROLL_LOCK',
    'SV_LEFT_DPI_INC', 'SV_LEFT_DPI_DEC', 'SV_RIGHT_DPI_INC', 'SV_RIGHT_DPI_DEC',
    'SV_RECALIBRATE_POINTER', 'SV_TOGGLE_AUTOMOUSE', 'SV_MH_CHANGE_TIMEOUTS',
    'SV_SCROLL_HOLD',
];

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

    it('renders the Boost and Scroll rows alongside Mouse Buttons and Sniper Keys', () => {
        render(<MouseKeysSection />);
        expect(screen.getByText('Mouse Buttons')).toBeInTheDocument();
        expect(screen.getByText('Sniper Keys')).toBeInTheDocument();
        expect(screen.getByText('Boost')).toBeInTheDocument();
        expect(screen.getByText('Scroll')).toBeInTheDocument();
        expect(screen.getByText('Pointer Speed')).toBeInTheDocument();
        expect(screen.getByText('Pointer')).toBeInTheDocument();
    });

    it('groups the former Mouse Keys pointer keys under Scroll, Pointer Speed and Pointer', () => {
        render(<MouseKeysSection />);
        const keys = renderedKeys().map((k) => k.keycode);
        expect(keys.indexOf('SV_NATURAL_SCROLL_TOGGLE')).toBeLessThan(keys.indexOf('SV_LEFT_DPI_INC'));
        expect(keys.indexOf('SV_RIGHT_DPI_DEC')).toBeLessThan(keys.indexOf('SV_RECALIBRATE_POINTER'));
    });

    it('offers Drag Scroll (SV_SCROLL_HOLD) in the closed More keys group, labeled "Drag Scroll"', () => {
        const { container } = render(<MouseKeysSection />);
        const more = container.querySelector('[data-testid="pointing-more-keys"]')!;
        expect(more).not.toBeNull();
        expect(more.querySelector('[data-keycode="SV_SCROLL_HOLD"]')).not.toBeNull();
        expect(more.hasAttribute('open')).toBe(false);
        const scrollRow = screen.getByText('Scroll').parentElement!;
        expect(scrollRow.querySelector('[data-keycode="SV_SCROLL_HOLD"]')).toBeNull();
        const key = screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === 'SV_SCROLL_HOLD');
        expect(key).toBeDefined();
        expect(key!.getAttribute('data-label')).toBe('Drag Scroll');
    });

    it('offers Velocity Scroll (SV_VELOCITY_SCROLL) after the scroll toggles, and assigns it', () => {
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys.indexOf('SV_VELOCITY_SCROLL')).toBe(keys.indexOf('SV_SCROLL_TOGGLE') + 1);
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
            { name: 'SV_SCROLL_HOLD', title: '', shortName: 'Scroll\\nToggle\\nHold' },
            { name: 'SV_VELOCITY_SCROLL', title: '', shortName: 'Vel\\nScroll' },
        ] };
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys).toContain('SV_VELOCITY_SCROLL');
        expect(keys).not.toContain('SV_VELOCITY_SCROLL_TOGGLE');
    });

    it('leaves Velocity Scroll out for firmware that has no such key', () => {
        keyboardState.keyboard = { custom_keycodes: [{ name: 'SV_SCROLL_HOLD', title: '', shortName: 'Scroll\\nToggle\\nHold' }] };
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys).toContain('SV_SCROLL_HOLD');
        expect(keys).not.toContain('SV_VELOCITY_SCROLL');
        expect(keys).not.toContain('SV_VELOCITY_SCROLL_TOGGLE');
    });

    it('assigns SV_SCROLL_HOLD when Drag Scroll is clicked', () => {
        render(<MouseKeysSection />);
        const key = screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === 'SV_SCROLL_HOLD')!;
        fireEvent.click(key);
        expect(assignKeycode).toHaveBeenCalledWith('SV_SCROLL_HOLD');
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
