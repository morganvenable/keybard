import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { KeyBindingProvider, useKeyBinding } from '../../src/contexts/KeyBindingContext';
import { KeyboardProvider } from '../../src/contexts/KeyboardContext';
import { ChangesProvider } from '../../src/contexts/ChangesContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import type { KeyboardInfo, AltRepeatKeyEntry } from '../../src/types/keyboard.types';
import { AltRepeatKeyOptions } from '../../src/types/keyboard.types';

// Mock the services
vi.mock('../../src/services/file.service', () => ({
    fileService: {
        loadFile: vi.fn(),
    },
}));

vi.mock('../../src/services/keyboard.service', () => ({
    keyboardService: {
        init: vi.fn(),
        load: vi.fn(),
        updateKey: vi.fn(),
        updateAltRepeatKey: vi.fn(),
    },
    KeyboardService: {
        isWebHIDSupported: vi.fn(() => true),
    },
}));

vi.mock('../../src/services/qmk.service', () => ({
    qmkService: {
        get: vi.fn(),
    },
}));

vi.mock('../../src/services/usb.service', () => ({
    usbInstance: {
        open: vi.fn(),
        close: vi.fn(),
        getDeviceName: vi.fn(),
    },
}));

import { fileService } from '../../src/services/file.service';

// Create test alt-repeat entries
const createAltRepeatEntries = (): AltRepeatKeyEntry[] => [
    {
        arkid: 0,
        keycode: 'KC_A',
        alt_keycode: 'KC_B',
        allowed_mods: 0,
        options: AltRepeatKeyOptions.ENABLED,
    },
    {
        arkid: 1,
        keycode: 'KC_C',
        alt_keycode: 'KC_D',
        allowed_mods: 0,
        options: AltRepeatKeyOptions.ENABLED | AltRepeatKeyOptions.BIDIRECTIONAL,
    },
    {
        arkid: 2,
        keycode: 'KC_NO',
        alt_keycode: 'KC_NO',
        allowed_mods: 0,
        options: 0, // Disabled
    },
];

// Create test keyboard with alt-repeat keys
const createKeyboardWithAltRepeat = (): KeyboardInfo => ({
    rows: 4,
    cols: 12,
    layers: 2,
    via_proto: 12,

    kbid: 'test_altrepeat_kb',
    keymap: [
        Array(4 * 12).fill('KC_NO'),
        Array(4 * 12).fill('KC_NO'),
    ],
    alt_repeat_keys: createAltRepeatEntries(),
    settings: {},
});

describe('KeyBindingContext - Alt-Repeat Key Selection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>
            <ChangesProvider>
                <KeyboardProvider>
                    <KeyBindingProvider>{children}</KeyBindingProvider>
                </KeyboardProvider>
            </ChangesProvider>
        </SettingsProvider>
    );

    it('selectAltRepeatKey sets the correct binding target for keycode slot', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        act(() => {
            result.current.selectAltRepeatKey(0, 'keycode');
        });

        expect(result.current.selectedTarget).toEqual({
            type: 'altrepeat',
            altRepeatId: 0,
            altRepeatSlot: 'keycode',
        });
        expect(result.current.isBinding).toBe(true);
    });

    it('selectAltRepeatKey sets the correct binding target for alt_keycode slot', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        act(() => {
            result.current.selectAltRepeatKey(1, 'alt_keycode');
        });

        expect(result.current.selectedTarget).toEqual({
            type: 'altrepeat',
            altRepeatId: 1,
            altRepeatSlot: 'alt_keycode',
        });
        expect(result.current.isBinding).toBe(true);
    });

    it('clearSelection clears alt-repeat selection', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        act(() => {
            result.current.selectAltRepeatKey(0, 'keycode');
        });

        expect(result.current.selectedTarget).not.toBeNull();

        act(() => {
            result.current.clearSelection();
        });

        expect(result.current.selectedTarget).toBeNull();
        expect(result.current.isBinding).toBe(false);
    });
});

describe('KeyBindingContext - Alt-Repeat Key Assignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>
            <ChangesProvider>
                <KeyboardProvider>
                    <KeyBindingProvider>{children}</KeyBindingProvider>
                </KeyboardProvider>
            </ChangesProvider>
        </SettingsProvider>
    );

    it('selectAltRepeatKey followed by assignKeycode does not throw', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select the keycode slot of alt-repeat entry 0
        act(() => {
            result.current.selectAltRepeatKey(0, 'keycode');
        });

        // Verify state is set correctly before assignment
        expect(result.current.selectedTarget?.type).toBe('altrepeat');
        expect(result.current.selectedTarget?.altRepeatId).toBe(0);
        expect(result.current.selectedTarget?.altRepeatSlot).toBe('keycode');

        // Assign should not throw even with no keyboard loaded
        // Note: Without a keyboard loaded, assignKeycode returns early without clearing selection
        expect(() => {
            act(() => {
                result.current.assignKeycode('KC_E');
            });
        }).not.toThrow();

        // Selection remains when no keyboard is loaded (early return in assignKeycode)
        expect(result.current.selectedTarget).not.toBeNull();
    });

    it('different alt-repeat entries can be selected independently', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select entry 0
        act(() => {
            result.current.selectAltRepeatKey(0, 'keycode');
        });
        expect(result.current.selectedTarget?.altRepeatId).toBe(0);

        // Clear and select entry 1
        act(() => {
            result.current.clearSelection();
            result.current.selectAltRepeatKey(1, 'alt_keycode');
        });
        expect(result.current.selectedTarget?.altRepeatId).toBe(1);
        expect(result.current.selectedTarget?.altRepeatSlot).toBe('alt_keycode');

        // Clear and select entry 2
        act(() => {
            result.current.clearSelection();
            result.current.selectAltRepeatKey(2, 'keycode');
        });
        expect(result.current.selectedTarget?.altRepeatId).toBe(2);
    });
});

describe('AltRepeatKeyOptions flags', () => {
    it('DEFAULT_TO_ALT flag is bit 0', () => {
        expect(AltRepeatKeyOptions.DEFAULT_TO_ALT).toBe(1);
    });

    it('BIDIRECTIONAL flag is bit 1', () => {
        expect(AltRepeatKeyOptions.BIDIRECTIONAL).toBe(2);
    });

    it('IGNORE_MOD_HANDEDNESS flag is bit 2', () => {
        expect(AltRepeatKeyOptions.IGNORE_MOD_HANDEDNESS).toBe(4);
    });

    it('ENABLED flag is bit 3', () => {
        expect(AltRepeatKeyOptions.ENABLED).toBe(8);
    });

    it('can combine multiple flags', () => {
        const combined = AltRepeatKeyOptions.ENABLED | AltRepeatKeyOptions.BIDIRECTIONAL;
        expect(combined).toBe(10); // 8 + 2

        // Check individual flags
        expect(combined & AltRepeatKeyOptions.ENABLED).not.toBe(0);
        expect(combined & AltRepeatKeyOptions.BIDIRECTIONAL).not.toBe(0);
        expect(combined & AltRepeatKeyOptions.DEFAULT_TO_ALT).toBe(0);
    });
});
