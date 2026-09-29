import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeadersPanel from '../../src/layout/SecondarySidebar/Panels/LeadersPanel';
import { VialProvider, useVial } from '../../src/contexts/VialContext';
import { KeyBindingProvider } from '../../src/contexts/KeyBindingContext';
import { ChangesProvider } from '../../src/contexts/ChangesContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { LayerProvider } from '../../src/contexts/LayerContext';
import { PanelsProvider } from '../../src/contexts/PanelsContext';
import { SidebarProvider } from '../../src/components/ui/sidebar';
import { DragProvider } from '../../src/contexts/DragContext';
import { LayoutSettingsProvider } from '../../src/contexts/LayoutSettingsContext';
import type { KeyboardInfo, LeaderEntry } from '../../src/types/vial.types';
import { LeaderOptions } from '../../src/types/vial.types';

// Mock window.matchMedia for SidebarProvider
beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});

// Mock services
vi.mock('../../src/services/file.service', () => ({
    fileService: {
        loadFile: vi.fn(),
    },
}));

vi.mock('../../src/services/vial.service', () => ({
    vialService: {
        init: vi.fn(),
        load: vi.fn(),
        updateKey: vi.fn(),
        updateLeader: vi.fn().mockResolvedValue(undefined),
        saveSvil: vi.fn().mockResolvedValue(undefined),
    },
    VialService: {
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
    vial_proto: 6,
    kbid: 'test_leaders_kb',
    keymap: [
        Array(4 * 12).fill('KC_NO'),
        Array(4 * 12).fill('KC_NO'),
    ],
    leaders: createLeaderEntries(),
    settings: {},
});

// Create keyboard without leaders
const createKeyboardWithoutLeaders = (): KeyboardInfo => ({
    rows: 4,
    cols: 12,
    layers: 2,
    via_proto: 12,
    vial_proto: 6,
    kbid: 'test_no_leaders_kb',
    keymap: [
        Array(4 * 12).fill('KC_NO'),
        Array(4 * 12).fill('KC_NO'),
    ],
    leaders: [],
    settings: {},
});

// Wrapper component that sets keyboard state
const TestWrapper = ({ keyboard, children }: { keyboard: KeyboardInfo | null, children: React.ReactNode }) => {
    return (
        <SettingsProvider>
            <LayoutSettingsProvider>
                <ChangesProvider>
                    <VialProvider>
                        <LayerProvider>
                            <SidebarProvider>
                                <PanelsProvider>
                                    <KeyBindingProvider>
                                        <DragProvider>
                                            <KeyboardSetter keyboard={keyboard}>
                                                {children}
                                            </KeyboardSetter>
                                        </DragProvider>
                                    </KeyBindingProvider>
                                </PanelsProvider>
                            </SidebarProvider>
                        </LayerProvider>
                    </VialProvider>
                </ChangesProvider>
            </LayoutSettingsProvider>
        </SettingsProvider>
    );
};

// Helper component to set keyboard in context
const KeyboardSetter = ({ keyboard, children }: { keyboard: KeyboardInfo | null, children: React.ReactNode }) => {
    const { setKeyboard } = useVial();

    // Set keyboard on mount
    React.useEffect(() => {
        if (keyboard) {
            setKeyboard(keyboard);
        }
    }, [keyboard, setKeyboard]);

    return <>{children}</>;
};

import React from 'react';

describe('LeadersPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when no keyboard is loaded', () => {
        render(
            <TestWrapper keyboard={null}>
                <LeadersPanel />
            </TestWrapper>
        );

        // The component returns null when no keyboard, so no leader content appears
        expect(screen.queryByText(/Leader sequences trigger/)).not.toBeInTheDocument();
        expect(screen.queryByText('No leader sequences configured.')).not.toBeInTheDocument();
    });

    it('shows empty state when keyboard has no leader sequences', async () => {
        render(
            <TestWrapper keyboard={createKeyboardWithoutLeaders()}>
                <LeadersPanel />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('No leader sequences configured.')).toBeInTheDocument();
        });
    });

    it('renders leader entries when keyboard has leaders', async () => {
        render(
            <TestWrapper keyboard={createKeyboardWithLeaders()}>
                <LeadersPanel />
            </TestWrapper>
        );

        await waitFor(() => {
            // Should show the description text
            expect(screen.getByText(/Leader sequences trigger an output/)).toBeInTheDocument();
        });
    });

    it('shows ON/OFF toggle buttons for defined entries', async () => {
        render(
            <TestWrapper keyboard={createKeyboardWithLeaders()}>
                <LeadersPanel />
            </TestWrapper>
        );

        await waitFor(() => {
            // Should have ON and OFF buttons for enabled entries
            const onButtons = screen.getAllByRole('button', { name: /^ON$/i });
            const offButtons = screen.getAllByRole('button', { name: /^OFF$/i });

            // Entry 0 and 1 are defined, entry 2 is empty so no toggle
            expect(onButtons.length).toBeGreaterThanOrEqual(2);
            expect(offButtons.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('displays help text', async () => {
        render(
            <TestWrapper keyboard={createKeyboardWithLeaders()}>
                <LeadersPanel />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/Click on a key slot to assign a keycode/)).toBeInTheDocument();
        });
    });
});

describe('LeadersPanel - Toggle Behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enabled entry shows ON button as active', async () => {
        render(
            <TestWrapper keyboard={createKeyboardWithLeaders()}>
                <LeadersPanel />
            </TestWrapper>
        );

        await waitFor(() => {
            // The first entry is enabled, so its ON button should have the active styling
            const onButtons = screen.getAllByRole('button', { name: /^ON$/i });
            expect(onButtons.length).toBeGreaterThan(0);
            // The first ON button should have bg-black (active state)
            expect(onButtons[0]).toHaveClass('bg-black');
        });
    });
});
