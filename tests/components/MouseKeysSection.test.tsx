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
    Key: ({ keycode, variant, className, label, description, onClick }: { keycode: string; variant?: string; className?: string; label?: string; description?: string; onClick?: () => void }) => (
        <div data-testid="key" data-keycode={keycode} data-variant={variant ?? ''} data-size={className ?? ''} data-label={label ?? ''} data-description={description ?? ''} onClick={onClick} />
    ),
}));

const EXPECTED_KEYS = [
    'KC_BTN1', 'KC_BTN2', 'KC_BTN3', 'KC_BTN4', 'KC_BTN5',
    // Sniper and Boost, one row each: momentary 2x, 3x, 5x, then the toggles.
    'SV_SNIPER_2', 'SV_SNIPER_3', 'SV_SNIPER_5', 'SV_SNIPER_2_TG', 'SV_SNIPER_3_TG', 'SV_SNIPER_5_TG',
    'SV_BOOST_2', 'SV_BOOST_3', 'SV_BOOST_5', 'SV_BOOST_2_TG', 'SV_BOOST_3_TG', 'SV_BOOST_5_TG',
    // Scroll: held or for this session (Scroll Hold right after Scroll Toggle), then the saved per-hand toggles.
    'SV_SCROLL_TOGGLE', 'SV_SCROLL_HOLD', 'SV_VELOCITY_SCROLL', 'SV_VELOCITY_SCROLL_TOGGLE',
    'SV_LEFT_SCROLL_TOGGLE', 'SV_RIGHT_SCROLL_TOGGLE',
    // AutoMouse, after Scroll: AutoMouse Toggle, Layer Time.
    'SV_TOGGLE_AUTOMOUSE', 'SV_MH_CHANGE_TIMEOUTS',
    // TrackPoint.
    'SV_RECALIBRATE_POINTER',
    // DPI, last.
    'SV_LEFT_DPI_INC', 'SV_LEFT_DPI_DEC', 'SV_RIGHT_DPI_INC', 'SV_RIGHT_DPI_DEC',
];
// Hidden: Natural Scroll and Axis Lock are settings under the hand cards.
const HIDDEN_KEYS = ['SV_NATURAL_SCROLL_TOGGLE', 'SV_AXIS_SCROLL_LOCK'];

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
        expect(groups).toEqual(['Mouse Buttons', 'Modifiers', 'Sniper Keys', 'Boost', 'Scroll', 'AutoMouse', 'TrackPoint', 'DPI']);
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

    it('lists exactly the keys the placement table homes in Pointing Devices, the AutoMouse keys included', () => {
        render(<MouseKeysSection />);
        const listed = renderedKeys().map((k) => k.keycode!).filter((k) => k.startsWith('SV_'));
        for (const k of listed) expect(customKeycodeHome(k), k).toBe('pointing');
        const homed = (SVALBOARD_VIAL_CUSTOM_KEYCODES as unknown as { name: string }[]).map((k) => k.name).filter((n) => customKeycodeHome(n) === 'pointing');
        for (const k of homed) expect(listed, k).toContain(k);
        for (const k of HIDDEN_KEYS) expect(customKeycodeHome(k)).toBe('hidden');
    });

    it('lists no Natural Scroll or Axis Lock key', () => {
        render(<MouseKeysSection />);
        const keys = renderedKeys().map((k) => k.keycode);
        for (const k of HIDDEN_KEYS) expect(keys).not.toContain(k);
    });

    it('separates the saved per-hand scroll toggles under their own heading and note', () => {
        const { container } = render(<MouseKeysSection />);
        const scroll = container.querySelector('[data-key-group="Scroll"]')!;
        const saved = scroll.querySelector('[data-key-subgroup="saved"]')!;
        const codes = (el: Element) => [...el.querySelectorAll('[data-keycode]')].map((e) => e.getAttribute('data-keycode'));
        expect(codes(saved)).toEqual(['SV_LEFT_SCROLL_TOGGLE', 'SV_RIGHT_SCROLL_TOGGLE']);
        expect(codes(scroll).filter((k) => !codes(saved).includes(k))).toEqual(['SV_SCROLL_TOGGLE', 'SV_SCROLL_HOLD', 'SV_VELOCITY_SCROLL', 'SV_VELOCITY_SCROLL_TOGGLE']);
        expect(saved.textContent).toContain('Saved on the keyboard');
        const note = saved.querySelector('[data-saved-note]')!.textContent!;
        expect(note).toContain('Each press changes a setting saved');
        expect(note).toContain('off the mouse layer');
        expect(note).toContain('flash');
    });

    it('draws AutoMouse after Scroll, open, with the same heading as the other groups and the settings passed in above its keys', () => {
        const { container } = render(<MouseKeysSection autoMouseSettings={<div data-testid="am-settings" />} />);
        const am = container.querySelector('[data-key-group="AutoMouse"]')!;
        const heading = (el: Element) => el.firstElementChild!;
        expect(heading(am).textContent).toBe('AutoMouse');
        expect(heading(am).className).toBe(heading(container.querySelector('[data-key-group="Sniper Keys"]')!).className);
        expect(am.querySelector('button[aria-expanded]')).toBeNull();
        expect(am.textContent).not.toContain('Settings and keys');
        const codes = [...am.querySelectorAll('[data-keycode]')];
        expect(codes.map((e) => e.getAttribute('data-keycode'))).toEqual(['SV_TOGGLE_AUTOMOUSE', 'SV_MH_CHANGE_TIMEOUTS']);
        expect(screen.getByTestId('am-settings').compareDocumentPosition(codes[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it.each([false, true])('gives AutoMouse the same heading as the other groups (tray: %s)', (columns) => {
        const { container } = render(<MouseKeysSection compact={columns} columns={columns} variant={columns ? 'medium' : undefined} />);
        const cls = (name: string) => container.querySelector(`[data-key-group="${name}"]`)!.firstElementChild!.className;
        for (const g of ['Sniper Keys', 'Boost', 'Scroll', 'TrackPoint', 'DPI']) expect(cls('AutoMouse'), g).toBe(cls(g));
    });

    it('offers Scroll Hold right after Scroll Toggle, out of the saved set, with its tooltip', () => {
        const { container } = render(<MouseKeysSection />);
        const keys = renderedKeys().map((k) => k.keycode);
        expect(keys.indexOf('SV_SCROLL_HOLD')).toBe(keys.indexOf('SV_SCROLL_TOGGLE') + 1);
        expect(container.querySelector('[data-key-subgroup="saved"] [data-keycode="SV_SCROLL_HOLD"]')).toBeNull();
        const key = screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === 'SV_SCROLL_HOLD')!;
        expect(key.getAttribute('data-label')).toBe('Scroll Hold');
        const d = key.getAttribute('data-description')!;
        expect(d.startsWith('Hold to switch Scroll Mode on both hands; release to switch back. Momentary.')).toBe(true);
        expect(d).not.toMatch(/[()]/);
    });

    it('gives Fix Drift its own TrackPoint group, after Scroll', () => {
        const { container } = render(<MouseKeysSection />);
        const tp = container.querySelector('[data-key-group="TrackPoint"]')!;
        expect([...tp.querySelectorAll('[data-keycode]')].map((e) => e.getAttribute('data-keycode'))).toEqual(['SV_RECALIBRATE_POINTER']);
        expect(container.querySelector('[data-key-group="Pointer"]')).toBeNull();
    });

    it.each([false, true])('gives every pointing key a description (tray: %s)', (columns) => {
        render(<MouseKeysSection compact={columns} columns={columns} />);
        const keys = screen.getAllByTestId('key').filter((el) => el.getAttribute('data-keycode')!.startsWith('SV_'));
        expect(keys.length).toBeGreaterThan(20);
        for (const el of keys) {
            const d = el.getAttribute('data-description')!;
            expect(d, el.getAttribute('data-keycode')!).toMatch(/Momentary|Toggle|One step per press/);
            expect(d, el.getAttribute('data-keycode')!).toMatch(/saved|Not saved/i);
        }
        const desc = (k: string) => keys.find((el) => el.getAttribute('data-keycode') === k)!.getAttribute('data-description')!;
        expect(desc('SV_LEFT_SCROLL_TOGGLE')).toContain('Left hand');
        expect(desc('SV_LEFT_SCROLL_TOGGLE')).toContain('Keep it off the mouse layer');
        expect(desc('SV_SCROLL_TOGGLE')).toContain('Not saved');
        expect(desc('SV_SNIPER_2_TG')).toContain('Toggle');
        expect(desc('SV_BOOST_3')).toContain('Momentary');
        expect(desc('SV_RIGHT_DPI_INC')).toContain('Right hand');
    });

    it('offers Velocity Scroll (SV_VELOCITY_SCROLL) right after Scroll Hold, and assigns it', () => {
        render(<MouseKeysSection />);
        const keys = screen.getAllByTestId('key').map((el) => el.getAttribute('data-keycode'));
        expect(keys.indexOf('SV_VELOCITY_SCROLL')).toBe(keys.indexOf('SV_SCROLL_HOLD') + 1);
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
        expect(keys).toContain('SV_SCROLL_HOLD');
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
