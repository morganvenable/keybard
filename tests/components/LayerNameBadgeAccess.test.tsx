import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import { LayerNameBadge } from '../../src/components/LayerNameBadge';

const { renameLayer, setKeyboard } = vi.hoisted(() => ({ renameLayer: vi.fn(), setKeyboard: vi.fn() }));
vi.mock('@/hooks/useLayerNames', () => ({ useLayerNames: () => ({ renameLayer, nameError: null }) }));
vi.mock('@/contexts/VialContext', () => ({ useVial: () => ({ keyboard: { layers: 1, keymap: [[0]], cosmetic: { layer: { 0: 'Alpha' } } }, setKeyboard, isConnected: false }) }));
vi.mock('@/contexts/ChangesContext', () => ({ useChanges: () => ({ queue: vi.fn() }) }));
vi.mock('@/contexts/LayoutLibraryContext', () => ({ useLayoutLibrary: () => ({ copyLayer: vi.fn() }) }));
vi.mock('@/services/sval.service', () => ({ svalService: { getLayerName: () => 'Alpha' } }));
vi.mock('@/components/PublishLayerDialog', () => ({ PublishLayerDialog: () => null }));
vi.mock('@/components/CustomColorDialog', () => ({ default: () => null }));

beforeAll(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
beforeEach(() => { vi.clearAllMocks(); renameLayer.mockResolvedValue(true); });
function setup() {
    render(<TooltipProvider><LayerNameBadge selectedLayer={0} /></TooltipProvider>);
    return userEvent.setup();
}

describe('Layer badge optional keyboard access', () => {
    it('renames with explicit Enter and restores focus to the GUI action', async () => {
        const user = setup();
        const rename = screen.getByRole('button', { name: 'Rename layer 0: Alpha' });
        act(() => rename.focus());
        await user.keyboard('{Enter}');
        const input = screen.getByRole('textbox', { name: 'Rename layer 0' });
        await user.clear(input);
        await user.type(input, 'Beta{Enter}');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Rename layer 0: Alpha' })).toHaveFocus());
        expect(renameLayer).toHaveBeenCalledExactlyOnceWith(0, 'Beta');
    });
    it('Escape cancels a name without saving and restores focus', async () => {
        const user = setup();
        await user.click(screen.getByRole('button', { name: 'Rename layer 0: Alpha' }));
        await user.type(screen.getByRole('textbox', { name: 'Rename layer 0' }), 'temporary{Escape}');
        await waitFor(() => expect(screen.getByRole('button', { name: 'Rename layer 0: Alpha' })).toHaveFocus());
        expect(renameLayer).not.toHaveBeenCalled();
    });
    it('opens named color choices, and Escape dismisses without changing the board', async () => {
        const user = setup();
        const color = screen.getByRole('button', { name: 'Change color for layer 0' });
        act(() => color.focus());
        await user.keyboard('{Enter}');
        expect(color).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', { name: 'Custom layer color' })).toBeInTheDocument();
        expect(document.activeElement).toHaveAttribute('data-color-choice');
        await user.keyboard('{Escape}');
        expect(color).toHaveFocus();
        expect(color).toHaveAttribute('aria-expanded', 'false');
        expect(setKeyboard).not.toHaveBeenCalled();
    });
});
