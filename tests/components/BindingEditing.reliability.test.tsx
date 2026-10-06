import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangesProvider, useChanges } from '@/contexts/ChangesContext';
import MacroEditor from '@/layout/SecondarySidebar/components/BindingEditor/MacroEditor';
import ComboEditor from '@/layout/SecondarySidebar/components/BindingEditor/ComboEditor';
import OverrideEditor from '@/layout/SecondarySidebar/components/BindingEditor/OverrideEditor';

const state = vi.hoisted(() => ({
    board: {} as any, setKeyboard: vi.fn(),
    binding: { selectedTarget: null as any, selectMacroKey: vi.fn(), selectComboKey: vi.fn(), selectOverrideKey: vi.fn(), clearSelection: vi.fn() },
    panels: { itemToEdit: 0, initialEditorSlot: null, setPanelToGoBack: vi.fn(), setAlternativeHeader: vi.fn() },
    service: { updateMacros: vi.fn(async () => {}), saveSvil: vi.fn(async () => {}), updateCombo: vi.fn(async () => {}), updateKeyoverride: vi.fn(async () => {}) },
}));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: state.board, setKeyboard: state.setKeyboard, getKeyboardSnapshot: () => state.board }) }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => state.binding }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => state.panels }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ layoutMode: 'sidebar' }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ getSetting: () => false, updateSetting: vi.fn() }) }));
vi.mock('@/services/keyboard.service', () => ({ keyboardService: state.service }));
vi.mock('@/layout/SecondarySidebar/components/BindingEditor/MacroEditorKey', () => ({ default: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>Delete action</button> }));
vi.mock('@/layout/SecondarySidebar/components/BindingEditor/MacroEditorText', () => ({ default: () => <div /> }));
vi.mock('@/layout/SecondarySidebar/components/BindingEditor/EditorKey', () => ({ default: () => <div /> }));
vi.mock('@/layout/SecondarySidebar/components/BindingEditor/OverrideModifierSelector', () => ({ default: () => <div /> }));
let changes: ReturnType<typeof useChanges>;
function Capture() { changes = useChanges(); return null; }

describe('editing side effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.binding.selectedTarget = null;
        state.board = {
            layers: 3,
            macros: [{ mid: 0, actions: [['tap', 'KC_A'], ['tap', 'KC_B']] }],
            combos: [{ keys: ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], output: 'KC_NO', enabled: false }],
            key_overrides: [{ trigger: 'KC_NO', replacement: 'KC_NO', options: 0, layers: 0, trigger_mods: 0, negative_mod_mask: 0, suppressed_mods: 0 }],
        };
    });
    it.each([['combo', ComboEditor], ['override', OverrideEditor]] as const)('opening an empty %s does not modify or queue anything', async (_kind, Editor) => {
        render(<ChangesProvider><Capture /><Editor /></ChangesProvider>);
        expect(state.setKeyboard).not.toHaveBeenCalled();
        expect(changes.getPendingCount()).toBe(0);
        expect(state.service.updateCombo).not.toHaveBeenCalled();
        expect(state.service.updateKeyoverride).not.toHaveBeenCalled();
    });
    it.each(['Delete', 'Backspace', 'trash'])('%s deletes a macro action through the same Manual queue', async action => {
        state.binding.selectedTarget = { type: 'macro', macroId: 0, macroIndex: 0 };
        const view = render(<ChangesProvider><Capture /><MacroEditor /></ChangesProvider>);
        if (action === 'trash') fireEvent.click(view.getAllByText('Delete action')[0]);
        else fireEvent.keyDown(window, { key: action });
        expect(state.setKeyboard).toHaveBeenCalledWith(expect.objectContaining({ macros: [{ mid: 0, actions: [['tap', 'KC_B']] }] }));
        expect(changes.getPendingCount()).toBe(1);
        expect(state.service.updateMacros).not.toHaveBeenCalled();
        await act(async () => { expect(await changes.commit()).toBe(true); });
        expect(state.service.updateMacros).toHaveBeenCalledOnce();
    });
});
