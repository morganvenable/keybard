// The leader and combo timeout fields: a stored 0 (older firmware's settings
// reset) shows as the default the firmware now uses, and nothing Keybard writes
// is ever 0 by accident: an empty or unreadable entry keeps the shown value.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LeadersPanel from '@/layout/SecondarySidebar/Panels/LeadersPanel';
import CombosPanel from '@/layout/SecondarySidebar/Panels/CombosPanel';

const state = vi.hoisted(() => ({ keyboard: null as any, pushes: [] as Array<[number, number]>, setKeyboard: null as any }));
vi.mock('@/contexts/KeyboardContext', () => ({
    useKeyboard: () => ({ keyboard: state.keyboard, isConnected: true, setKeyboard: state.setKeyboard }),
}));
vi.mock('@/contexts/ChangesContext', () => ({ useChanges: () => ({ queue: async (_: string, fn: () => Promise<void>) => fn() }) }));
vi.mock('@/services/qmk.service', () => ({
    qmkService: { push: vi.fn(async (kb: any, qsid: number) => { state.pushes.push([qsid, kb.settings[qsid]]); }) },
}));
vi.mock('@/services/keyboard.service', () => ({ keyboardService: { saveSvil: vi.fn(async () => undefined) } }));
vi.mock('@/hooks/useBindingChanges', () => ({ useBindingChanges: () => vi.fn() }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode: vi.fn(), isBinding: false }) }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ layoutMode: 'sidebar', keyVariant: 'default' }) }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => ({ setItemToEdit: vi.fn(), setBindingTypeToEdit: vi.fn(), setAlternativeHeader: vi.fn(), setInitialEditorSlot: vi.fn() }) }));
vi.mock('@/contexts/ComboPreviewContext', () => ({
    useComboPreview: () => ({ enabled: true, palette: 'default', focusSet: null, isPinned: () => false, enter: vi.fn(), leave: vi.fn(), focusIn: vi.fn(), blurOut: vi.fn(), togglePin: vi.fn() }),
}));
vi.mock('@/components/Key', () => ({ Key: () => <span /> }));

const board = (settings: Record<number, number>) => ({ keymap: [[4, 5]], leaders: [], combos: [], settings });

afterEach(() => { cleanup(); state.pushes = []; });

function field(min: string) {
    return screen.getAllByRole('spinbutton').find(input => input.getAttribute('min') === min) as HTMLInputElement;
}

describe('Leader Timeout field', () => {
    it('shows 300 for a stored 0 and writes 300 when the field is saved', async () => {
        state.keyboard = board({ 28: 0, 29: 0 });
        state.setKeyboard = vi.fn();
        render(<LeadersPanel />);
        const input = field('50');
        expect(input.value).toBe('300');
        fireEvent.blur(input);
        await waitFor(() => expect(state.pushes).toEqual([[28, 300]]));
    });

    it('keeps the current value when the field is emptied', async () => {
        state.keyboard = board({ 28: 450, 29: 1 });
        state.setKeyboard = vi.fn();
        render(<LeadersPanel />);
        const input = field('50');
        expect(input.value).toBe('450');
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(input.value).toBe('450');
        expect(state.pushes).toEqual([]);
    });

    it('raises a typed 0 to the 50 ms minimum', async () => {
        state.keyboard = board({ 28: 300, 29: 1 });
        state.setKeyboard = vi.fn();
        render(<LeadersPanel />);
        const input = field('50');
        fireEvent.change(input, { target: { value: '0' } });
        fireEvent.blur(input);
        await waitFor(() => expect(state.pushes).toEqual([[28, 50]]));
    });
});

describe('Combo timeout field', () => {
    it('shows 50 for a stored 0, and an emptied field keeps it instead of writing 0', async () => {
        state.keyboard = board({ 2: 0 });
        state.setKeyboard = vi.fn();
        render(<CombosPanel />);
        const input = field('10');
        expect(input.value).toBe('50');
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        await waitFor(() => expect(state.pushes).toEqual([[2, 50]]));
        expect(state.pushes.some(([, value]) => value === 0)).toBe(false);
    });

    it('writes nothing when an emptied field returns to the stored value', async () => {
        state.keyboard = board({ 2: 80 });
        state.setKeyboard = vi.fn();
        render(<CombosPanel />);
        const input = field('10');
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(input.value).toBe('80');
        expect(state.pushes).toEqual([]);
    });
});
