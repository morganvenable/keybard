import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LeaderEditor from '../../src/layout/SecondarySidebar/components/BindingEditor/LeaderEditor';
import { KeyboardProvider, useKeyboard } from '../../src/contexts/KeyboardContext';
import { KeyBindingProvider } from '../../src/contexts/KeyBindingContext';
import { ChangesProvider } from '../../src/contexts/ChangesContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { LayerProvider } from '../../src/contexts/LayerContext';
import { PanelsProvider, usePanels } from '../../src/contexts/PanelsContext';
import { SidebarProvider } from '../../src/components/ui/sidebar';
import { DragProvider } from '../../src/contexts/DragContext';
import { LayoutSettingsProvider } from '../../src/contexts/LayoutSettingsContext';
import type { KeyboardInfo, LeaderEntry } from '../../src/types/keyboard.types';
import { LeaderOptions } from '../../src/types/keyboard.types';
import React from 'react';

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

vi.mock('../../src/services/keyboard.service', () => ({
    keyboardService: {
        init: vi.fn(),
        load: vi.fn(),
        updateKey: vi.fn(),
        updateLeader: vi.fn().mockResolvedValue(undefined),
        saveSvil: vi.fn().mockResolvedValue(undefined),
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

// Helper component to set up context
const TestSetup = ({
    keyboard,
    itemToEdit,
    children
}: {
    keyboard: KeyboardInfo | null,
    itemToEdit: number,
    children: React.ReactNode
}) => {
    const { setKeyboard } = useKeyboard();
    const { setItemToEdit, setBindingTypeToEdit, setAlternativeHeader } = usePanels();

    React.useEffect(() => {
        if (keyboard) {
            setKeyboard(keyboard);
        }
        setItemToEdit(itemToEdit);
        setBindingTypeToEdit('leaders');
        setAlternativeHeader(true);
    }, [keyboard, itemToEdit, setKeyboard, setItemToEdit, setBindingTypeToEdit, setAlternativeHeader]);

    return <>{children}</>;
};

// Wrapper component
const TestWrapper = ({
    keyboard,
    itemToEdit = 0,
    children
}: {
    keyboard: KeyboardInfo | null,
    itemToEdit?: number,
    children: React.ReactNode
}) => {
    return (
        <SettingsProvider>
            <LayoutSettingsProvider>
                <ChangesProvider>
                    <KeyboardProvider>
                        <LayerProvider>
                            <SidebarProvider>
                                <PanelsProvider>
                                    <KeyBindingProvider>
                                        <DragProvider>
                                            <TestSetup keyboard={keyboard} itemToEdit={itemToEdit}>
                                                {children}
                                            </TestSetup>
                                        </DragProvider>
                                    </KeyBindingProvider>
                                </PanelsProvider>
                            </SidebarProvider>
                        </LayerProvider>
                    </KeyboardProvider>
                </ChangesProvider>
            </LayoutSettingsProvider>
        </SettingsProvider>
    );
};

describe('LeaderEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows "Leader entry not found" when leader entry does not exist', async () => {
        const keyboard = createKeyboardWithLeaders();

        render(
            <TestWrapper keyboard={keyboard} itemToEdit={99}>
                <LeaderEditor />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Leader entry not found')).toBeInTheDocument();
        });
    });

    // ON/OFF toggle was moved from LeaderEditor to BindingEditorContainer/LeadersPanel
    // Those toggles are now tested in LeadersPanel.test.tsx

    it('displays sequence label', async () => {
        const keyboard = createKeyboardWithLeaders();

        render(
            <TestWrapper keyboard={keyboard} itemToEdit={0}>
                <LeaderEditor />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/Sequence \(up to 5 keys\)/)).toBeInTheDocument();
        });
    });

    it('displays output label', async () => {
        const keyboard = createKeyboardWithLeaders();

        render(
            <TestWrapper keyboard={keyboard} itemToEdit={0}>
                <LeaderEditor />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText('Output')).toBeInTheDocument();
        });
    });

    it('displays help text', async () => {
        const keyboard = createKeyboardWithLeaders();

        render(
            <TestWrapper keyboard={keyboard} itemToEdit={0}>
                <LeaderEditor />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/Press the Leader key, then type this sequence/)).toBeInTheDocument();
        });
    });
});

describe('LeaderEditor - Sequence Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows sequence key numbers', async () => {
        const keyboard = createKeyboardWithLeaders();

        render(
            <TestWrapper keyboard={keyboard} itemToEdit={0}>
                <LeaderEditor />
            </TestWrapper>
        );

        await waitFor(() => {
            // Entry 0 has 2 keys (A, B), should show slots 1, 2, 3 (filled + next empty)
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('2')).toBeInTheDocument();
        });
    });
});
