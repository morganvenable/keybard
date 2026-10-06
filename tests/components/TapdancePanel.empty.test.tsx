import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TapdancePanel from '@/layout/SecondarySidebar/Panels/TapdancePanel';

const panels = vi.hoisted(() => ({
    setItemToEdit: vi.fn(), setBindingTypeToEdit: vi.fn(),
    setAlternativeHeader: vi.fn(), setPanelToGoBack: vi.fn(), setInitialEditorSlot: vi.fn(),
}));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => panels }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: {
    tapdances: [{ tap: 'KC_NO', hold: 'KC_NO', doubletap: 'KC_NO', taphold: 'KC_NO' }],
} }) }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode: vi.fn() }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ layoutMode: 'bottombar' }) }));
vi.mock('@/utils/keys', () => ({ getKeyContents: () => ({ top: 'KC_NO', str: '' }) }));

describe('empty bottom tap dance panel', () => {
    it('allows starting the first tap dance without switching to sidebar placement', () => {
        render(<TapdancePanel />);
        fireEvent.click(screen.getByRole('button', { name: 'Add new tap dance' }));
        expect(panels.setItemToEdit).toHaveBeenCalledWith(0);
        expect(panels.setBindingTypeToEdit).toHaveBeenCalledWith('tapdances');
    });
});
