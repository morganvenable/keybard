import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PointingSection from '../../src/layout/SecondarySidebar/Panels/settings/PointingSection';
import { requestPointingAdvanced } from '../../src/layout/SecondarySidebar/Panels/settings/anchor';

const DPI = ['200', '400', '600', '800', '1200', '1600', '2400', '3200', '4800', '6400', '12000', '16000'];
const leaf = (label: string, type: string, key: string, id: number, options?: unknown) => ({ label, type, options, content: [key, 0, id] });

const MENU = { label: 'Pointing Device', content: [
    { label: 'Left Pointer', content: [leaf('DPI', 'dropdown', 'id_left_dpi', 0, DPI), leaf('Scroll Mode', 'toggle', 'id_left_scroll', 1)] },
    { label: 'Right Pointer', content: [leaf('DPI', 'dropdown', 'id_right_dpi', 2, DPI), leaf('Scroll Mode', 'toggle', 'id_right_scroll', 3)] },
    { label: 'Auto Mouse', content: [
        leaf('Enable Auto Mouse', 'toggle', 'id_automouse_enable', 4),
        leaf('No Layer Timeout', 'toggle', 'id_automouse_no_timeout', 50),
        leaf('Layer Timeout (ms)', 'range', 'id_automouse_timeout_ms', 49, [100, 2000, 10]),
        leaf('Activation Threshold', 'range', 'id_automouse_threshold', 6, [0, 1000]),
        leaf('Activation Decay (x10ms)', 'range', 'id_automouse_decay', 10, [0, 255]),
        leaf('Left Pointer Activates', 'toggle', 'id_left_automouse', 11),
        leaf('Right Pointer Activates', 'toggle', 'id_right_automouse', 12),
    ] },
    { label: 'Scroll speed', content: [
        leaf('Left Scroll speed', 'range', 'id_left_scroll_speed', 61, [20, 1000, 1]),
        leaf('Right Scroll speed', 'range', 'id_right_scroll_speed', 62, [20, 1000, 1]),
    ] },
    { label: 'Scroll Settings', content: [leaf('Natural Scroll', 'toggle', 'id_natural_scroll', 7), leaf('Axis Lock', 'toggle', 'id_axis_lock', 8)] },
    { label: 'Touchpad', content: [
        leaf('Touchpad Mode', 'dropdown', 'id_pad_touchpad_mode', 59, ['Automatic', 'Built-in gestures']),
        leaf('Tap to Click', 'toggle', 'id_pad_tap', 51), leaf('Two-Finger Tap to Right Click', 'toggle', 'id_pad_two_finger', 52),
        leaf('Press and Hold to Drag', 'toggle', 'id_pad_hold', 53), leaf('Hold Time', 'range', 'id_pad_hold_ms', 54, [20, 1500, 10]),
    ] },
] };

const half = (side: 'left' | 'right', detected: string, osTouchpad = false) =>
    ({ usb: side === 'right', side, builtFor: detected, detected, sensorStarted: true, auto: true, osTouchpad, productId: 0, inverseProductId: 0 });

const state = vi.hoisted(() => ({
    halves: [] as unknown[], flags3: 0, flags4: 0, values: new Map<string, number>(), setValue: vi.fn(async () => true),
    stored: {} as Record<string, string>, connected: true, setActivePanel: vi.fn(),
}));

vi.mock('@/contexts/KeyboardContext', () => ({
    useKeyboard: () => ({
        keyboard: { menus: [MENU], pointing_hardware: { halves: state.halves }, feature_flags3: state.flags3, feature_flags4: state.flags4 },
        isConnected: state.connected, applyBoardState: vi.fn(),
    }),
}));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => ({ setActivePanel: state.setActivePanel }) }));
vi.mock('@/contexts/SettingsContext', () => ({
    useSettings: () => ({ getSetting: (n: string) => state.stored[n], updateSetting: (n: string, v: string) => { state.stored[n] = v; } }),
}));
vi.mock('@/hooks/useMenuValues', async (orig) => ({
    ...(await orig<typeof import('../../src/hooks/useMenuValues')>()),
    useMenuValues: () => ({ values: state.values, setValue: state.setValue, loading: false, error: null, writeError: null }),
}));
vi.mock('@/components/touchpad-tuning/tuning-open', () => ({ openTouchpadTuning: vi.fn() }));

const FLAGS3_PAD = 0x10 | 0x20 | 0x40;
const FLAGS4_PAD = 0x01 | 0x02 | 0x20; // palm, mode, Scroll speed

function setBoard(halves: unknown[], flags3 = 0, flags4 = 0) {
    state.halves = halves; state.flags3 = flags3; state.flags4 = flags4;
}
const hand = (side: string) => document.querySelector(`[data-hand="${side}"]`) as HTMLElement;

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => undefined;
});

beforeEach(() => {
    vi.clearAllMocks();
    state.stored = {}; state.connected = true;
    state.values = new Map([
        ['id_left_dpi', 3], ['id_right_dpi', 6], ['id_left_scroll', 0], ['id_right_scroll', 1],
        ['id_left_scroll_speed', 100], ['id_right_scroll_speed', 200], ['id_natural_scroll', 1], ['id_axis_lock', 0],
        ['id_automouse_enable', 1], ['id_automouse_no_timeout', 0], ['id_automouse_timeout_ms', 650], ['id_automouse_threshold', 0], ['id_automouse_decay', 50],
        ['id_left_automouse', 1], ['id_right_automouse', 0],
        ['id_pad_touchpad_mode', 1], ['id_pad_tap', 1], ['id_pad_two_finger', 1], ['id_pad_hold', 1], ['id_pad_hold_ms', 300],
    ]);
});

describe('Settings > Pointing', () => {
    it('shows one card per hand titled by its module, with the approved simple view', () => {
        setBoard([half('right', 'azoteq'), half('left', 'pmw3389')], FLAGS3_PAD, FLAGS4_PAD);
        render(<PointingSection />);
        const left = within(hand('left'));
        expect(left.getByRole('heading', { level: 5 }).textContent).toContain('Left hand');
        expect(left.getByRole('heading', { level: 5 }).textContent).toContain('Trackball, PMW3389');
        expect(left.getByText('Pointer speed')).toBeInTheDocument();
        expect(left.getByText('Scroll speed')).toBeInTheDocument();
        expect(left.getByText('Scroll Mode')).toBeInTheDocument();
        expect(left.queryByText('Gestures')).toBeNull();
        const right = within(hand('right'));
        expect(right.getByRole('heading', { level: 5 }).textContent).toContain('Touchpad, Azoteq');
        // Gestures first on the touchpad hand, then Pointer speed, Scroll speed, Scroll Mode.
        const labels = [...hand('right').querySelectorAll('[data-row]')].map((r) => r.getAttribute('data-row'));
        expect(labels).toEqual(['Gestures', 'Pointer speed', 'Scroll speed', 'Scroll Mode']);
    });

    it('shares Natural Scroll and Axis Lock between the hands', () => {
        setBoard([half('left', 'pmw3360'), half('right', 'pmw3360')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        const shared = within(document.querySelector('[data-shared]') as HTMLElement);
        expect(shared.getByText('Natural Scroll')).toBeInTheDocument();
        expect(shared.getByText('Axis Lock')).toBeInTheDocument();
        expect(screen.getAllByText('Natural Scroll')).toHaveLength(1);
    });

    it('shows Scroll speed as a multiplier read from the board, per hand', () => {
        setBoard([half('left', 'pmw3389'), half('right', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        expect(within(hand('left')).getByText('1.0×')).toBeInTheDocument();
        expect(within(hand('right')).getByText('2.0×')).toBeInTheDocument();
    });

    it('hides Scroll speed on firmware without the flag', () => {
        setBoard([half('left', 'pmw3389')], 0, 0);
        render(<PointingSection />);
        expect(screen.queryByText('Scroll speed')).toBeNull();
        expect(screen.getByText('Pointer speed')).toBeInTheDocument();
    });

    it('lists only DPI values that do something: a pad to 1200', () => {
        setBoard([half('left', 'pmw3389'), half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        render(<PointingSection />);
        fireEvent.click(within(hand('right')).getByRole('combobox', { name: 'Pointer speed' }));
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['200', '400', '600', '800', '1200']);
    });

    it('lists a PMW3389 up to 16000', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        fireEvent.click(within(hand('left')).getByRole('combobox', { name: 'Pointer speed' }));
        expect(screen.getAllByRole('option').map((o) => o.textContent).pop()).toBe('16000');
    });

    it('shows a pad saved above 1200 as 1200', () => {
        setBoard([half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        render(<PointingSection />);
        expect(within(hand('right')).getByRole('combobox', { name: 'Pointer speed' }).textContent).toContain('1200');
    });

    it('gives a TrackPoint no Pointer speed until the firmware has software speed', () => {
        setBoard([half('left', 'trackpoint')], 0, FLAGS4_PAD);
        const { unmount } = render(<PointingSection />);
        expect(within(hand('left')).queryByText('Pointer speed')).toBeNull();
        expect(within(hand('left')).getByText('Scroll Mode')).toBeInTheDocument();
        unmount();
        setBoard([half('left', 'trackpoint')], 0, FLAGS4_PAD | 0x40);
        render(<PointingSection />);
        expect(within(hand('left')).getByText('Pointer speed')).toBeInTheDocument();
        fireEvent.click(within(hand('left')).getByRole('combobox', { name: 'Pointer speed' }));
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['200', '400', '600', '800', '1200', '1600', '2400', '3200']);
    });

    it('writes a chosen Pointer speed as the stored index', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        fireEvent.click(within(hand('left')).getByRole('combobox', { name: 'Pointer speed' }));
        fireEvent.click(screen.getByRole('option', { name: '1600' }));
        expect(state.setValue).toHaveBeenCalledWith('id_left_dpi', 5);
    });

    it('writes a Scroll speed detent as a percent when the slider is let go', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        const slider = within(hand('left')).getByRole('slider', { name: 'Scroll speed' });
        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        expect(state.setValue).toHaveBeenCalledWith('id_left_scroll_speed', 120);
    });

    it('keeps one collapsed Advanced disclosure, closed on a first visit, and remembers it', () => {
        setBoard([half('left', 'pmw3389'), half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        const first = render(<PointingSection />);
        const advanced = screen.getByRole('button', { name: /^Advanced/ });
        expect(advanced).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Auto mouse layer')).toBeNull();
        fireEvent.click(advanced);
        expect(screen.getByRole('button', { name: /^Advanced/ })).toHaveAttribute('aria-expanded', 'true');
        expect(state.stored['settings-pointing-advanced-open']).toBe('open');
        first.unmount();
        render(<PointingSection />);
        expect(screen.getByRole('button', { name: /^Advanced/ })).toHaveAttribute('aria-expanded', 'true');
    });

    it('holds the approved groups in Advanced, and a group remembers collapsing', () => {
        setBoard([half('left', 'pmw3389'), half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        state.stored['settings-pointing-advanced-open'] = 'open';
        render(<PointingSection />);
        const groups = screen.getAllByRole('heading', { level: 6 }).map((h) => h.textContent);
        expect(groups).toEqual(['Auto mouse layer', 'Touchpad taps and drag', 'Touchpad scrolling', 'Live view']);
        fireEvent.click(screen.getByRole('button', { name: 'Touchpad taps and drag' }));
        expect(state.stored['settings-pointing-taps-open']).toBe('collapsed');
        expect(screen.getByRole('button', { name: 'Touchpad taps and drag' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('hides taps and drag while the computer drives every pad, and the touchpad groups without a pad', () => {
        setBoard([half('right', 'azoteq', true)], FLAGS3_PAD, FLAGS4_PAD);
        state.stored['settings-pointing-advanced-open'] = 'open';
        const { unmount } = render(<PointingSection />);
        expect(screen.queryByRole('button', { name: 'Touchpad taps and drag' })).toBeNull();
        // Palm rejection still applies to a pad the computer drives.
        expect(screen.getByRole('button', { name: 'Touchpad scrolling' })).toBeInTheDocument();
        unmount();
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        expect(screen.queryByRole('button', { name: 'Touchpad taps and drag' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Touchpad scrolling' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Live view' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open sensor view' })).toBeInTheDocument();
    });

    it('opens Advanced for a visit when a link asks for it, without remembering it', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        requestPointingAdvanced();
        render(<PointingSection />);
        expect(screen.getByRole('button', { name: /^Advanced/ })).toHaveAttribute('aria-expanded', 'true');
        expect(state.stored['settings-pointing-advanced-open']).toBeUndefined();
    });

    it('asks before built-in gestures', () => {
        setBoard([half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        state.values.set('id_pad_touchpad_mode', 0);
        render(<PointingSection />);
        const radios = within(hand('right')).getAllByRole('radio');
        expect(radios.map((r) => r.textContent)).toEqual(['Automatic', 'Built-in gestures']);
        fireEvent.click(radios[1]);
        expect(state.setValue).not.toHaveBeenCalled();
        expect(screen.getByText('Use built-in gestures?')).toBeInTheDocument();
    });
});
