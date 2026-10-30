import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '../../src/components/ui/sidebar';
import AppSidebar from '../../src/layout/Sidebar';
import AboutSection from '../../src/layout/SecondarySidebar/Panels/settings/AboutSection';

// Keybard Paranoid: the Manual is a link the person clicks, opened in a new tab, so it shows there too.
vi.mock('@/lib/paranoid', () => ({ PARANOID: true, userIsLooking: () => true }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/features/trainer/OverlayDialog', () => ({ OverlayDialog: () => null, overlayRequested: () => false }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: null }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ getSetting: () => undefined }) }));
vi.mock('@/features/firmware/FirmwareUpdateProvider', () => ({ useFirmwareUpdates: () => ({ status: { dot: false } }) }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => ({
    activePanel: null, open: false, setActivePanel: vi.fn(), openDetails: vi.fn(), handleCloseDetails: vi.fn(),
    setItemToEdit: vi.fn(), panelToGoBack: null, alternativeHeader: false, setPanelToGoBack: vi.fn(), setAlternativeHeader: vi.fn(), setOpen: vi.fn(),
}) }));

const MANUAL = 'https://docs.svalboard.com/keybard/';

describe('Keybard Paranoid: the Manual', () => {
    it('is in the left menu, opening the docs site in a new tab', () => {
        render(<SidebarProvider><AppSidebar /></SidebarProvider>);
        const link = screen.getByRole('link', { name: 'Manual' });
        expect(link).toHaveAttribute('href', MANUAL);
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('is in Settings > About, opening the docs site in a new tab', () => {
        render(<AboutSection />);
        const link = screen.getByRole('link', { name: 'Manual' });
        expect(link).toHaveAttribute('href', MANUAL);
        expect(link).toHaveAttribute('target', '_blank');
    });
    // The build side (no allowance; static external references still fail): tests/build/paranoid.test.ts.
});
