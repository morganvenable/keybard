import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AdvancedAutoMouse, HandCard, ModelNotices, NoModuleLine, PointingModelProvider, SharedScrollRows, TouchpadSettings, useHandCards,
} from '../../src/layout/SecondarySidebar/Panels/pointing/PointingModel';
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
    halves: [] as unknown[], menus: [] as unknown[], flags3: 0, flags4: 0, values: new Map<string, number>(), setValue: vi.fn(async () => true),
    stored: {} as Record<string, string>, connected: true, setActivePanel: vi.fn(),
}));

vi.mock('@/contexts/KeyboardContext', () => ({
    useKeyboard: () => ({
        keyboard: { menus: state.menus, pointing_hardware: { halves: state.halves }, feature_flags3: state.flags3, feature_flags4: state.flags4 },
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
vi.mock('@/components/trackball-sensor/trackball-open', () => ({ openTrackballSensor: vi.fn() }));

import { openTouchpadTuning } from '@/components/touchpad-tuning/tuning-open';
import { openTrackballSensor } from '@/components/trackball-sensor/trackball-open';

/** The panel's settings, in its order (the keys between the shared rows and Advanced are MouseKeysSection's). */
function Cards() {
    const hands = useHandCards();
    return (
        <>
            <NoModuleLine />
            <div data-hands>{hands.map((h) => <HandCard key={h.side} hand={h} />)}</div>
            <SharedScrollRows />
            <ModelNotices />
            <AdvancedAutoMouse />
        </>
    );
}
const PointingSection = () => <PointingModelProvider><Cards /></PointingModelProvider>;

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
    state.stored = {}; state.connected = true; state.menus = [MENU];
    state.values = new Map([
        ['id_left_dpi', 3], ['id_right_dpi', 6], ['id_left_scroll', 0], ['id_right_scroll', 1],
        ['id_left_scroll_speed', 100], ['id_right_scroll_speed', 200], ['id_natural_scroll', 1], ['id_axis_lock', 0],
        ['id_automouse_enable', 1], ['id_automouse_no_timeout', 0], ['id_automouse_timeout_ms', 650], ['id_automouse_threshold', 0], ['id_automouse_decay', 50],
        ['id_left_automouse', 1], ['id_right_automouse', 0],
        ['id_pad_touchpad_mode', 1], ['id_pad_tap', 1], ['id_pad_two_finger', 1], ['id_pad_hold', 1], ['id_pad_hold_ms', 300],
    ]);
});

describe('Pointing Devices cards', () => {
    it('shows one card per hand titled by its module, with the approved simple view', () => {
        setBoard([half('right', 'azoteq'), half('left', 'pmw3389')], FLAGS3_PAD, FLAGS4_PAD);
        render(<PointingSection />);
        const left = within(hand('left'));
        expect(left.getByRole('heading', { level: 5 }).textContent).toContain('Left hand');
        expect(left.getByRole('heading', { level: 5 }).textContent).toContain('Trackball, PMW3389');
        expect(left.queryByText('Gestures')).toBeNull();
        const right = within(hand('right'));
        expect(right.getByRole('heading', { level: 5 }).textContent).toContain('Touchpad, Azoteq');
        // Gestures first on the touchpad hand, then Pointer speed, Scroll speed, Scroll Mode.
        const labels = [...hand('right').querySelectorAll('[data-row]')].map((r) => r.getAttribute('data-row'));
        expect(labels).toEqual(['Gestures', 'Pointer speed', 'Scroll speed', 'Scroll Mode']);
        expect([...hand('left').querySelectorAll('[data-row]')].map((r) => r.getAttribute('data-row'))).toEqual(['Pointer speed', 'Scroll speed', 'Scroll Mode']);
    });

    it("puts each hand's tuner button last on its card: Trackball sensors, Tune touchpad", () => {
        setBoard([half('right', 'azoteq'), half('left', 'pmw3389')], FLAGS3_PAD, FLAGS4_PAD);
        render(<PointingSection />);
        const ball = hand('left').querySelector('[data-tuner]') as HTMLElement;
        const pad = hand('right').querySelector('[data-tuner]') as HTMLElement;
        expect(ball.textContent).toBe('Trackball sensors');
        expect(pad.textContent).toBe('Tune touchpad');
        expect(hand('left').lastElementChild).toBe(ball);
        expect(hand('right').lastElementChild).toBe(pad);
        fireEvent.click(ball);
        expect(openTrackballSensor).toHaveBeenCalledTimes(1);
        fireEvent.click(pad);
        expect(openTouchpadTuning).toHaveBeenCalledTimes(1);
        // A modal over this panel: nothing navigates, so closing it returns here.
        expect(state.setActivePanel).not.toHaveBeenCalled();
    });

    it('two trackballs: two ball cards, no Gestures row and no touchpad tuner', () => {
        setBoard([half('right', 'pmw3389'), half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        expect(document.querySelectorAll('[data-hand]')).toHaveLength(2);
        expect(screen.queryByText('Gestures')).toBeNull();
        expect([...document.querySelectorAll('[data-tuner]')].map((b) => b.textContent)).toEqual(['Trackball sensors', 'Trackball sensors']);
        expect(screen.queryByText('Tune touchpad')).toBeNull();
    });

    it('trackball plus TrackPoint: the TrackPoint has the speed list and no tuner', () => {
        setBoard([half('right', 'trackpoint'), half('left', 'pmw3389')], 0, FLAGS4_PAD | 0x40);
        render(<PointingSection />);
        expect(within(hand('right')).getByRole('heading', { level: 5 }).textContent).toContain('TrackPoint');
        expect(within(hand('right')).getByText('Pointer speed')).toBeInTheDocument();
        expect(hand('right').querySelector('[data-tuner]')).toBeNull();
        expect(hand('left').querySelector('[data-tuner]')).not.toBeNull();
    });

    it('no pointing module: one line, no Natural Scroll or Axis Lock, no cards', () => {
        setBoard([half('right', 'none'), half('left', 'none')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        expect(screen.getByText('No pointing module detected')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-hand]')).toHaveLength(0);
        expect(screen.queryByText('Natural Scroll')).toBeNull();
        expect(screen.queryByText('Axis Lock')).toBeNull();
    });

    it('shows no module line when a module is there', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        expect(screen.queryByText('No pointing module detected')).toBeNull();
    });

    it('shares Natural Scroll and Axis Lock between the hands, visible without opening Advanced', () => {
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

    describe('Pointer speed lists only what does something (list length per module)', () => {
        const options = (side: string) => {
            fireEvent.click(within(hand(side)).getByRole('combobox', { name: 'Pointer speed' }));
            return screen.getAllByRole('option').map((o) => o.textContent);
        };
        it.each([
            ['azoteq', FLAGS4_PAD, 5, '1200'],
            ['pmw3360', FLAGS4_PAD, 11, '12000'],
            ['pmw3389', FLAGS4_PAD, 12, '16000'],
            ['trackpoint', FLAGS4_PAD | 0x40, 8, '3200'],
        ] as const)('%s lists %i values, ending at %s', (module, flags4, length, last) => {
            setBoard([half('left', module)], module === 'azoteq' ? FLAGS3_PAD : 0, flags4);
            render(<PointingSection />);
            const list = options('left');
            expect(list).toHaveLength(length);
            expect(list[list.length - 1]).toBe(last);
        });

        it('a TrackPoint list starts at 200 and has 800, the current speed, in it', () => {
            setBoard([half('left', 'trackpoint')], 0, FLAGS4_PAD | 0x40);
            render(<PointingSection />);
            const list = options('left');
            expect(list[0]).toBe('200');
            expect(list).toContain('800');
        });
    });

    it('shows a pad saved above 1200 as 1200', () => {
        setBoard([half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        render(<PointingSection />);
        expect(within(hand('right')).getByRole('combobox', { name: 'Pointer speed' }).textContent).toContain('1200');
    });

    it('gives a TrackPoint no Pointer speed until the firmware has software speed', () => {
        setBoard([half('left', 'trackpoint')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        expect(within(hand('left')).queryByText('Pointer speed')).toBeNull();
        expect(within(hand('left')).getByText('Scroll Mode')).toBeInTheDocument();
    });

    it('writes a chosen Pointer speed as the stored index', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        render(<PointingSection />);
        fireEvent.click(within(hand('left')).getByRole('combobox', { name: 'Pointer speed' }));
        fireEvent.click(screen.getByRole('option', { name: '1600' }));
        expect(state.setValue).toHaveBeenCalledWith('id_left_dpi', 5);
    });

    it('Scroll speed round trip: a detent is written as a percent, and the stored percent reads back as that detent', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        const { unmount } = render(<PointingSection />);
        const slider = within(hand('left')).getByRole('slider', { name: 'Scroll speed' });
        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        expect(state.setValue).toHaveBeenCalledWith('id_left_scroll_speed', 120);
        unmount();
        state.values.set('id_left_scroll_speed', 120);
        render(<PointingSection />);
        expect(within(hand('left')).getByText('1.2×')).toBeInTheDocument();
    });

    it('keeps one collapsed Advanced disclosure holding Auto Mouse only, closed on a first visit, and remembers it', () => {
        setBoard([half('left', 'pmw3389'), half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        const first = render(<PointingSection />);
        const advanced = screen.getByRole('button', { name: /^Advanced/ });
        expect(advanced).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Enable Auto Mouse')).toBeNull();
        fireEvent.click(advanced);
        expect(screen.getByRole('button', { name: /^Advanced/ })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Enable Auto Mouse')).toBeInTheDocument();
        expect(screen.queryAllByRole('heading', { level: 6 })).toHaveLength(0);
        expect(screen.queryByText('Tap to Click')).toBeNull();
        expect(state.stored['settings-pointing-advanced-open']).toBe('open');
        first.unmount();
        render(<PointingSection />);
        expect(screen.getByRole('button', { name: /^Advanced/ })).toHaveAttribute('aria-expanded', 'true');
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

describe('Tune touchpad modal settings', () => {
    const Modal = () => <PointingModelProvider><TouchpadSettings /></PointingModelProvider>;

    it('holds taps, hold, dead zone, scroll start and palm rejection for a pad in built-in gestures', () => {
        setBoard([half('left', 'pmw3389'), half('right', 'azoteq')], FLAGS3_PAD, FLAGS4_PAD);
        render(<Modal />);
        for (const text of ['Tap to Click', 'Press and Hold to Drag', 'Tap Time', 'Hold Time', 'Dead Zone', 'Scroll Start', 'Palm Rejection']) {
            expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
        }
    });

    it('hides taps while the computer drives the pad, but keeps palm rejection', () => {
        setBoard([half('right', 'azoteq', true)], FLAGS3_PAD, FLAGS4_PAD);
        render(<Modal />);
        expect(screen.queryByText('Tap to Click')).toBeNull();
        expect(screen.getAllByText('Palm Rejection').length).toBeGreaterThan(0);
    });

    it('shows nothing on a board without a touchpad', () => {
        setBoard([half('left', 'pmw3389')], 0, FLAGS4_PAD);
        const { container } = render(<Modal />);
        expect(container.querySelector('[data-touchpad-settings]')).toBeNull();
    });
});
