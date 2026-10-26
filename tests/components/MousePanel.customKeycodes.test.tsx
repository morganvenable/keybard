import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CustomKeycode } from '../../src/types/keyboard.types';
import { keyService } from '../../src/services/key.service';
import MousePanel from '../../src/layout/SecondarySidebar/Panels/MousePanel';

// The Mouse Keys picker lists every SV_ custom keycode the board reports. A board
// with more than 32 lists them all, and picking one assigns it by name.

const keyboardState: { keyboard: unknown } = { keyboard: null };
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardState }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ layoutMode: 'sidebar' }) }));
const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));
vi.mock('@/layout/SecondarySidebar/components/SidebarItemRow', () => ({
    default: ({ keycode, label, onAssignKeycode }: { keycode: string; label: string; onAssignKeycode: (k: string) => void }) => (
        <div data-testid="row" data-keycode={keycode} data-label={label} onClick={() => onAssignKeycode(keycode)} />
    ),
}));
vi.mock('@/layout/SecondarySidebar/Panels/MouseMovementSection', () => ({ default: () => null }));

const customKeycodes: CustomKeycode[] = Array.from({ length: 40 }, (_, i) => ({
    name: `SV_PICK_${i}`, shortName: `Pick ${i}`, title: `Pick key ${i}`,
}));

describe('MousePanel with 40 custom keycodes', () => {
    it('lists all 40, including the 33rd and later, and assigns them by name', () => {
        const keyboard = { name: 'Test', rows: 1, cols: 1, layers: 1, keymap: [[0]], custom_keycodes: customKeycodes };
        keyService.generateAllKeycodes(keyboard as never);
        keyboardState.keyboard = keyboard;
        render(<MousePanel isPicker />);

        const rows = screen.getAllByTestId('row').filter(el => el.getAttribute('data-keycode')?.startsWith('SV_PICK_'));
        expect(rows.map(el => el.getAttribute('data-keycode'))).toEqual(customKeycodes.map(ck => ck.name));
        const thirtyThird = rows[32];
        expect(thirtyThird.getAttribute('data-label')).toBe('Pick 32');
        fireEvent.click(thirtyThird);
        expect(assignKeycode).toHaveBeenCalledWith('SV_PICK_32');
        expect(keyService.parse('SV_PICK_32')).toBe(0x7e60);
        expect(keyService.parse('SV_PICK_39')).toBe(0x7e67);
    });
});
