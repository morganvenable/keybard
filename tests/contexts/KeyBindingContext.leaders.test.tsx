import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { KeyBindingProvider, useKeyBinding } from '../../src/contexts/KeyBindingContext';
import { KeyboardProvider } from '../../src/contexts/KeyboardContext';
import { ChangesProvider } from '../../src/contexts/ChangesContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import type { KeyboardInfo, LeaderEntry } from '../../src/types/keyboard.types';
import { LeaderOptions } from '../../src/types/keyboard.types';

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
        updateLeader: vi.fn(),
        saveSvil: vi.fn(),
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

// Create test leader entries
const createLeaderEntries = (): LeaderEntry[] => [
    {
        ldrid: 0,
        sequence: ['KC_A', 'KC_B', 'KC_NO', 'KC_NO', 'KC_NO'],
        output: 'KC_C',
        options: LeaderOptions.ENABLED,
    },
    {
        ldrid: 1,
        sequence: ['KC_D', 'KC_E', 'KC_F', 'KC_NO', 'KC_NO'],
        output: 'KC_G',
        options: LeaderOptions.ENABLED,
    },
    {
        ldrid: 2,
        sequence: ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'],
        output: 'KC_NO',
        options: 0, // Disabled
    },
];

// Create test keyboard with leader entries
const createKeyboardWithLeaders = (): KeyboardInfo => ({
    rows: 4,
    cols: 12,
    layers: 2,
    via_proto: 12,

    kbid: 'test_leaders_kb',
    keymap: [
        Array(4 * 12).fill('KC_NO'),
        Array(4 * 12).fill('KC_NO'),
    ],
    leaders: createLeaderEntries(),
    settings: {},
});

describe('KeyBindingContext - Leader Key Selection', () => {
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

    it('selectLeaderKey sets the correct binding target for sequence slot', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 0);
        });

        expect(result.current.selectedTarget).toEqual({
            type: 'leaders',
            leaderId: 0,
            leaderSlot: 'sequence',
            leaderSeqIndex: 0,
        });
        expect(result.current.isBinding).toBe(true);
    });

    it('selectLeaderKey sets the correct binding target for output slot', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        act(() => {
            result.current.selectLeaderKey(1, 'output');
        });

        expect(result.current.selectedTarget).toEqual({
            type: 'leaders',
            leaderId: 1,
            leaderSlot: 'output',
            leaderSeqIndex: undefined,
        });
        expect(result.current.isBinding).toBe(true);
    });

    it('selectLeaderKey tracks sequence index for sequence slot', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select sequence index 2
        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 2);
        });

        expect(result.current.selectedTarget?.leaderSeqIndex).toBe(2);

        // Select different sequence index
        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 4);
        });

        expect(result.current.selectedTarget?.leaderSeqIndex).toBe(4);
    });

    it('clearSelection clears leader selection', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 0);
        });

        expect(result.current.selectedTarget).not.toBeNull();

        act(() => {
            result.current.clearSelection();
        });

        expect(result.current.selectedTarget).toBeNull();
        expect(result.current.isBinding).toBe(false);
    });
});

describe('KeyBindingContext - Leader Key Assignment', () => {
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

    it('selectLeaderKey followed by assignKeycode does not throw', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select the sequence slot of leader entry 0
        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 0);
        });

        // Verify state is set correctly before assignment
        expect(result.current.selectedTarget?.type).toBe('leaders');
        expect(result.current.selectedTarget?.leaderId).toBe(0);
        expect(result.current.selectedTarget?.leaderSlot).toBe('sequence');
        expect(result.current.selectedTarget?.leaderSeqIndex).toBe(0);

        // Assign should not throw even with no keyboard loaded
        expect(() => {
            act(() => {
                result.current.assignKeycode('KC_X');
            });
        }).not.toThrow();

        // Selection remains when no keyboard is loaded (early return in assignKeycode)
        expect(result.current.selectedTarget).not.toBeNull();
    });

    it('selectLeaderKey for output slot followed by assignKeycode does not throw', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select the output slot of leader entry 1
        act(() => {
            result.current.selectLeaderKey(1, 'output');
        });

        expect(result.current.selectedTarget?.type).toBe('leaders');
        expect(result.current.selectedTarget?.leaderId).toBe(1);
        expect(result.current.selectedTarget?.leaderSlot).toBe('output');

        // Assign should not throw
        expect(() => {
            act(() => {
                result.current.assignKeycode('KC_Y');
            });
        }).not.toThrow();
    });

    it('different leader entries can be selected independently', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select entry 0
        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 0);
        });
        expect(result.current.selectedTarget?.leaderId).toBe(0);

        // Clear and select entry 1
        act(() => {
            result.current.clearSelection();
            result.current.selectLeaderKey(1, 'output');
        });
        expect(result.current.selectedTarget?.leaderId).toBe(1);
        expect(result.current.selectedTarget?.leaderSlot).toBe('output');

        // Clear and select entry 2
        act(() => {
            result.current.clearSelection();
            result.current.selectLeaderKey(2, 'sequence', 3);
        });
        expect(result.current.selectedTarget?.leaderId).toBe(2);
        expect(result.current.selectedTarget?.leaderSeqIndex).toBe(3);
    });

    it('can switch between sequence and output slots', async () => {
        const { result } = renderHook(() => useKeyBinding(), { wrapper });

        // Select sequence slot
        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 1);
        });
        expect(result.current.selectedTarget?.leaderSlot).toBe('sequence');
        expect(result.current.selectedTarget?.leaderSeqIndex).toBe(1);

        // Switch to output slot
        act(() => {
            result.current.selectLeaderKey(0, 'output');
        });
        expect(result.current.selectedTarget?.leaderSlot).toBe('output');
        expect(result.current.selectedTarget?.leaderSeqIndex).toBeUndefined();

        // Switch back to sequence slot with different index
        act(() => {
            result.current.selectLeaderKey(0, 'sequence', 4);
        });
        expect(result.current.selectedTarget?.leaderSlot).toBe('sequence');
        expect(result.current.selectedTarget?.leaderSeqIndex).toBe(4);
    });
});

describe('LeaderOptions flags', () => {
    it('ENABLED flag is bit 15', () => {
        expect(LeaderOptions.ENABLED).toBe(1 << 15);
        expect(LeaderOptions.ENABLED).toBe(32768);
    });

    it('can check if entry is enabled', () => {
        const enabledEntry: LeaderEntry = {
            ldrid: 0,
            sequence: ['KC_A', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'],
            output: 'KC_B',
            options: LeaderOptions.ENABLED,
        };

        const disabledEntry: LeaderEntry = {
            ldrid: 1,
            sequence: ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'],
            output: 'KC_NO',
            options: 0,
        };

        expect(enabledEntry.options & LeaderOptions.ENABLED).not.toBe(0);
        expect(disabledEntry.options & LeaderOptions.ENABLED).toBe(0);
    });
});
