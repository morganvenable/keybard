// The first key picked into a blank leader or alt-repeat slot turns it on, as for combos.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { KeyBindingProvider, useKeyBinding } from '../../src/contexts/KeyBindingContext';
import { KeyboardProvider, useKeyboard } from '../../src/contexts/KeyboardContext';
import { ChangesProvider } from '../../src/contexts/ChangesContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { AltRepeatKeyOptions, ComboOptions, LeaderOptions, type KeyboardInfo } from '../../src/types/keyboard.types';

vi.mock('../../src/services/file.service', () => ({ fileService: { loadFile: vi.fn() } }));
vi.mock('../../src/services/keyboard.service', () => ({
    keyboardService: { init: vi.fn(), load: vi.fn(), updateKey: vi.fn(), updateLeader: vi.fn(), updateAltRepeatKey: vi.fn(), updateCombo: vi.fn(), saveSvil: vi.fn() },
    KeyboardService: { isWebHIDSupported: vi.fn(() => true) },
}));
vi.mock('../../src/services/qmk.service', () => ({ qmkService: { get: vi.fn() } }));
vi.mock('../../src/services/usb.service', () => ({ usbInstance: { open: vi.fn(), close: vi.fn(), getDeviceName: vi.fn() } }));

const NO5 = ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'];
const board = (): KeyboardInfo => ({
    rows: 1, cols: 1, layers: 1, keymap: [['KC_NO']], settings: {},
    leaders: [
        { ldrid: 0, sequence: [...NO5], output: 'KC_NO', options: 0 },
        { ldrid: 1, sequence: ['KC_A', ...NO5.slice(1)], output: 'KC_B', options: 0 },
    ],
    alt_repeat_keys: [
        { arkid: 0, keycode: 'KC_NO', alt_keycode: 'KC_NO', allowed_mods: 0, options: AltRepeatKeyOptions.BIDIRECTIONAL },
        { arkid: 1, keycode: 'KC_C', alt_keycode: 'KC_D', allowed_mods: 0, options: 0 },
    ],
    combos: [{ cmbid: 0, keys: ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], output: 'KC_NO', options: 0 }],
} as KeyboardInfo);

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider><ChangesProvider><KeyboardProvider><KeyBindingProvider>{children}</KeyBindingProvider></KeyboardProvider></ChangesProvider></SettingsProvider>
);

function setup() {
    const { result } = renderHook(() => ({ kb: useKeyboard(), bind: useKeyBinding() }), { wrapper });
    act(() => { result.current.kb.setKeyboard(board()); });
    return result;
}

describe('new leaders, alt-repeat keys and combos start on', () => {
    it('a key picked into a blank leader turns it on', () => {
        const r = setup();
        act(() => { r.current.bind.selectLeaderKey(0, 'sequence', 0); });
        act(() => { r.current.bind.assignKeycode('KC_E'); });
        expect(r.current.kb.keyboard!.leaders![0].options & LeaderOptions.ENABLED).toBe(LeaderOptions.ENABLED);
    });
    it('a leader that already had keys keeps its off', () => {
        const r = setup();
        act(() => { r.current.bind.selectLeaderKey(1, 'output'); });
        act(() => { r.current.bind.assignKeycode('KC_E'); });
        expect(r.current.kb.keyboard!.leaders![1].options).toBe(0);
    });
    it('a key picked into a blank alt-repeat slot turns it on and keeps its other options', () => {
        const r = setup();
        act(() => { r.current.bind.selectAltRepeatKey(0, 'keycode'); });
        act(() => { r.current.bind.assignKeycode('KC_E'); });
        expect(r.current.kb.keyboard!.alt_repeat_keys![0].options).toBe(AltRepeatKeyOptions.ENABLED | AltRepeatKeyOptions.BIDIRECTIONAL);
    });
    it('an alt-repeat key that already had keys keeps its off', () => {
        const r = setup();
        act(() => { r.current.bind.selectAltRepeatKey(1, 'alt_keycode'); });
        act(() => { r.current.bind.assignKeycode('KC_E'); });
        expect(r.current.kb.keyboard!.alt_repeat_keys![1].options).toBe(0);
    });
    it('a key picked into a blank combo turns it on', () => {
        const r = setup();
        act(() => { r.current.bind.selectComboKey(0, 0); });
        act(() => { r.current.bind.assignKeycode('KC_E'); });
        expect(r.current.kb.keyboard!.combos![0].options & ComboOptions.ENABLED).toBe(ComboOptions.ENABLED);
    });
});
