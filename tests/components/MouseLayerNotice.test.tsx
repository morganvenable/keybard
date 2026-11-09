import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import MouseLayerNotice from '../../src/components/MouseLayerNotice';
import { KeyBindingProvider, useKeyBinding } from '../../src/contexts/KeyBindingContext';
import { KeyboardProvider, useKeyboard } from '../../src/contexts/KeyboardContext';
import { ChangesProvider } from '../../src/contexts/ChangesContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { useLayerClipboardActions } from '../../src/hooks/useLayerClipboardActions';
import { keyService } from '../../src/services/key.service';
import { SVALBOARD_VIAL_CUSTOM_KEYCODES } from '../../src/constants/svalboard-vial';
import { mouseLayerNoticeText } from '../../src/constants/pointing-key-info';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

vi.mock('../../src/services/keyboard.service', () => ({
    keyboardService: { init: vi.fn(), load: vi.fn(), updateKey: vi.fn(), saveSvil: vi.fn() },
    KeyboardService: { isWebHIDSupported: vi.fn(() => true) },
}));
vi.mock('../../src/services/usb.service', () => ({ usbInstance: { open: vi.fn(), close: vi.fn(), getDeviceName: vi.fn(), setLayerColor: vi.fn() } }));
vi.mock('@/contexts/LayoutLibraryContext', () => ({ useLayoutLibrary: () => ({ copyLayer: vi.fn() }) }));

// The firmware's order of custom keycodes, plus the Velocity Scroll keys after them.
const CUSTOM = [
    ...(SVALBOARD_VIAL_CUSTOM_KEYCODES as unknown as { name: string; title: string; shortName: string }[]),
    { name: 'SV_VELOCITY_SCROLL', title: '', shortName: 'Vel\nScroll' },
];
const LAYERS = 4; // the mouse layer is the last: 3
const MOUSE = LAYERS - 1;

const board = (): KeyboardInfo => ({
    rows: 1, cols: 2, layers: LAYERS, kbid: 'ml_test', settings: {},
    keymap: Array.from({ length: LAYERS }, () => [0, 0]),
    custom_keycodes: CUSTOM,
} as any);

const code = (name: string) => keyService.parse(name);

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider><ChangesProvider><KeyboardProvider><KeyBindingProvider>
        <MouseLayerNotice />
        {children}
    </KeyBindingProvider></KeyboardProvider></ChangesProvider></SettingsProvider>
);

function setup() {
    const r = renderHook(() => ({ kb: useKeyboard(), bind: useKeyBinding(), clip: useLayerClipboardActions() }), { wrapper });
    act(() => { r.result.current.kb.setKeyboard(board()); });
    return r;
}
const notice = () => screen.queryByTestId('mouse-layer-notice');
const flush = () => act(async () => { await Promise.resolve(); });

beforeAll(() => { keyService.generateAllKeycodes(board()); });

describe('mouse layer notice: a key the firmware ignores there', () => {
    it('click-assign: picking Left Scroll Toggle for a mouse layer key shows the notice', async () => {
        const { result } = setup();
        act(() => { result.current.bind.selectKeyboardKey(MOUSE, 0, 0); });
        act(() => { result.current.bind.assignKeycode('SV_LEFT_SCROLL_TOGGLE'); });
        await flush();
        expect(notice()?.textContent).toContain('Left Scroll Toggle is on the mouse layer');
        expect(notice()?.textContent).toContain('ignores this key');
        // The key is still placed: the notice never blocks.
        expect(result.current.kb.keyboard!.keymap![MOUSE][0]).toBe(code('SV_LEFT_SCROLL_TOGGLE'));
    });

    it('drag: dropping Right DPI + on the mouse layer shows the notice', async () => {
        const { result } = setup();
        // A drop on a key (useKeyDrag) assigns to that key's target.
        act(() => { result.current.bind.assignKeycodeTo({ type: 'keyboard', layer: MOUSE, row: 0, col: 1 }, 'SV_RIGHT_DPI_INC'); });
        await flush();
        expect(notice()?.textContent).toContain('Right DPI + is on the mouse layer');
    });

    it('drag: swapping a restricted key onto the mouse layer shows the notice', async () => {
        const { result } = setup();
        act(() => { result.current.bind.assignKeycodeTo({ type: 'keyboard', layer: 0, row: 0, col: 0 }, 'SV_TOGGLE_AUTOMOUSE'); });
        await flush();
        expect(notice()).toBeNull();
        act(() => { result.current.bind.swapKeys({ type: 'keyboard', layer: 0, row: 0, col: 0 }, { type: 'keyboard', layer: MOUSE, row: 0, col: 0 }); });
        await flush();
        expect(notice()?.textContent).toContain('AutoMouse Toggle is on the mouse layer');
    });

    it('Custom keycode: a numeric code from Any key shows the notice', async () => {
        const { result } = setup();
        act(() => { result.current.bind.selectKeyboardKey(MOUSE, 0, 0); });
        act(() => { result.current.bind.assignKeycode(code('SV_MH_CHANGE_TIMEOUTS')); });
        await flush();
        expect(notice()?.textContent).toContain('Layer Time is on the mouse layer');
    });

    it('paste layer: one notice names every restricted key pasted', async () => {
        const { result } = setup();
        act(() => { result.current.clip.apply({ keymap: [code('SV_LEFT_SCROLL_TOGGLE'), code('SV_RIGHT_SCROLL_TOGGLE')] }, MOUSE); });
        await flush();
        expect(screen.getAllByTestId('mouse-layer-notice')).toHaveLength(1);
        expect(notice()?.textContent).toContain('Left Scroll Toggle and Right Scroll Toggle are on the mouse layer');
    });

    it('shows nothing for a key the firmware allows there, or for another layer', async () => {
        const { result } = setup();
        act(() => { result.current.bind.assignKeycodeTo({ type: 'keyboard', layer: MOUSE, row: 0, col: 0 }, 'SV_SCROLL_TOGGLE'); });
        act(() => { result.current.bind.assignKeycodeTo({ type: 'keyboard', layer: MOUSE, row: 0, col: 1 }, 'SV_VELOCITY_SCROLL'); });
        act(() => { result.current.bind.assignKeycodeTo({ type: 'keyboard', layer: 0, row: 0, col: 0 }, 'SV_LEFT_SCROLL_TOGGLE'); });
        await flush();
        expect(notice()).toBeNull();
    });

    it('the notice can be dismissed', async () => {
        const { result } = setup();
        act(() => { result.current.bind.assignKeycodeTo({ type: 'keyboard', layer: MOUSE, row: 0, col: 0 }, 'SV_LEFT_DPI_DEC'); });
        await flush();
        act(() => { screen.getByRole('button', { name: 'Dismiss' }).click(); });
        expect(notice()).toBeNull();
    });
});

describe('mouseLayerNoticeText', () => {
    it('names only the restricted keys', () => {
        expect(mouseLayerNoticeText(['SV_SCROLL_TOGGLE', 'SV_SCROLL_HOLD', 'SV_SNIPER_2_TG', 'KC_A'])).toBeNull();
        expect(mouseLayerNoticeText(['SV_LEFT_DPI_INC'])).toMatch(/^Left DPI \+ is on the mouse layer\./);
    });
});

