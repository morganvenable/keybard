import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PointingPanel from '../../src/layout/SecondarySidebar/Panels/PointingPanel';

// Guard for the key-sizing consistency rule: the Pointing panel must not render
// <Key> itself. Every assignable key comes from MouseKeysSection, which owns the
// single size computation for the panel.
const layoutSettings = { keyVariant: 'default', layoutMode: 'sidebar' as 'sidebar' | 'bottombar' };
const keyRenders = vi.fn();
const mouseKeysSectionRenders = vi.fn();

// The settings cards read the board's menu; their own tests are PointingCards.test.tsx.
vi.mock('../../src/layout/SecondarySidebar/Panels/pointing/PointingModel', () => ({
    PointingModelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useHandCards: () => [{ side: 'left', module: 'pmw3389', moduleName: 'Trackball, PMW3389' }],
    HandCard: ({ hand }: { hand: { side: string } }) => <div data-testid="hand-card" data-side={hand.side} />,
    SharedScrollRows: () => <div data-testid="shared-rows" />,
    NoModuleLine: () => null,
    ModelNotices: () => null,
    AdvancedAutoMouse: () => <div data-testid="advanced" />,
}));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => layoutSettings }));
vi.mock('@/contexts/KeyboardContext', () => ({
    useKeyboard: () => ({ keyboard: { menus: [{ label: 'Pointing Device', content: [] }] }, isConnected: true, connect: vi.fn() }),
}));
vi.mock('@/components/Key', () => ({
    Key: (props: { keycode: string }) => { keyRenders(props); return <div data-testid="stray-key" />; },
}));
vi.mock('../../src/layout/SecondarySidebar/Panels/MouseKeysSection', () => ({
    default: (props: Record<string, unknown>) => { mouseKeysSectionRenders(props); return <div data-testid="mouse-keys-section" />; },
}));
vi.mock('../../src/layout/SecondarySidebar/Panels/DynamicMenuPanel', () => ({
    default: () => <div data-testid="dynamic-menu" />,
}));
vi.mock('@/layout/SecondarySidebar/components/DescriptionBlock', () => ({
    default: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

describe('PointingPanel: all keys come from the shared MouseKeysSection', () => {
    it('sidebar mode renders no ad-hoc <Key> and embeds the section with default sizing', () => {
        layoutSettings.layoutMode = 'sidebar';
        render(<PointingPanel />);
        expect(screen.getByTestId('mouse-keys-section')).toBeInTheDocument();
        expect(screen.queryByTestId('stray-key')).not.toBeInTheDocument();
        expect(keyRenders).not.toHaveBeenCalled();
        expect(mouseKeysSectionRenders).toHaveBeenLastCalledWith({});
    });

    it('bottom-bar mode renders no ad-hoc <Key> and passes the compact/medium override', () => {
        layoutSettings.layoutMode = 'bottombar';
        render(<PointingPanel />);
        expect(screen.queryByTestId('stray-key')).not.toBeInTheDocument();
        expect(mouseKeysSectionRenders).toHaveBeenLastCalledWith({ compact: true, variant: 'medium', columns: true });
    });

    it('draws the cards, then the shared rows, then the keys, then Advanced, in the sidebar', () => {
        layoutSettings.layoutMode = 'sidebar';
        render(<PointingPanel />);
        const order = ['hand-card', 'shared-rows', 'mouse-keys-section', 'advanced'].map((id) => screen.getByTestId(id));
        for (let i = 0; i < order.length - 1; i++) {
            expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING, `${i}`).toBeTruthy();
        }
    });

    it('lays the tray out as columns: hands, shared rows, keys, Advanced', () => {
        layoutSettings.layoutMode = 'bottombar';
        const { container } = render(<PointingPanel />);
        const columns = [...container.querySelectorAll('[data-tray-column]')].map((e) => e.getAttribute('data-tray-column'));
        expect(columns).toEqual(['hand-left', 'shared', 'advanced']);
        expect(screen.getByTestId('mouse-keys-section')).toBeInTheDocument();
    });

    it('picker mode renders the same section, not its own keys', () => {
        layoutSettings.layoutMode = 'sidebar';
        render(<PointingPanel isPicker />);
        expect(screen.getByTestId('mouse-keys-section')).toBeInTheDocument();
        expect(screen.queryByTestId('stray-key')).not.toBeInTheDocument();
    });

    it.each(['sidebar', 'bottombar'] as const)('%s mode no longer shows the pointing hardware summary (it lives in the layout slots)', (mode) => {
        layoutSettings.layoutMode = mode;
        render(<PointingPanel />);
        expect(screen.queryByTestId('pointing-hardware-summary')).not.toBeInTheDocument();
        expect(screen.queryByText(/trackball|TrackPoint|Checking/i)).not.toBeInTheDocument();
    });
});
