import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CustomKeycode } from '../../src/types/keyboard.types';
import { keyService } from '../../src/services/key.service';
import MousePanel from '../../src/layout/SecondarySidebar/Panels/MousePanel';

// The Mouse Keys picker lists the SV_ custom keycodes placed in Mouse Keys. Keys
// with no placement go to Special Keys, so they never show here.

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

const ck = (name: string, shortName: string): CustomKeycode => ({ name, shortName, title: shortName });
const customKeycodes: CustomKeycode[] = [
    ck('SV_LEFT_DPI_INC', 'Left DPI +'),
    ck('SV_RECALIBRATE_POINTER', 'Fix Drift'),
    ck('SV_SNIPER_2', 'Sniper 2x'),
    ck('SV_BOOST_3_TG', 'Boost 3xTG'),
    ck('SV_SCROLL_HOLD', 'Scroll Toggle Hold'),
    ck('SV_VELOCITY_SCROLL', 'Velocity Scroll'),
    ck('SV_CAPS_WORD', 'Caps Word'),
    ck('SV_TOGGLE_23_67', 'MO 23'),
    ck('SV_TURBO_SCAN', 'Turbo Scan'),
    ck('SV_OUTPUT_STATUS', 'Output Status'),
    ck('SV_FUTURE_KEY', 'Future'),
];

const shown = () => screen.getAllByTestId('row').map(el => el.getAttribute('data-keycode'));

describe('MousePanel placement of custom keycodes', () => {
    it('lists only pointer keys placed in Mouse Keys and assigns them by name', () => {
        const keyboard = { name: 'Test', rows: 1, cols: 1, layers: 1, keymap: [[0]], custom_keycodes: customKeycodes };
        keyService.generateAllKeycodes(keyboard as never);
        keyboardState.keyboard = keyboard;
        render(<MousePanel isPicker />);

        const sv = shown().filter(k => k?.startsWith('SV_'));
        expect(sv).toEqual(['SV_LEFT_DPI_INC', 'SV_RECALIBRATE_POINTER']);
        fireEvent.click(screen.getAllByTestId('row').find(el => el.getAttribute('data-keycode') === 'SV_RECALIBRATE_POINTER')!);
        expect(assignKeycode).toHaveBeenCalledWith('SV_RECALIBRATE_POINTER');
    });

    it('leaves out Sniper, Boost and scroll keys, non-pointer keys and unknown keys', () => {
        const keyboard = { name: 'Test', rows: 1, cols: 1, layers: 1, keymap: [[0]], custom_keycodes: customKeycodes };
        keyService.generateAllKeycodes(keyboard as never);
        keyboardState.keyboard = keyboard;
        render(<MousePanel isPicker />);
        const keys = shown();
        for (const gone of ['SV_SNIPER_2', 'SV_BOOST_3_TG', 'SV_SCROLL_HOLD', 'SV_VELOCITY_SCROLL', 'SV_CAPS_WORD',
            'SV_TOGGLE_23_67', 'SV_TURBO_SCAN', 'SV_OUTPUT_STATUS', 'SV_FUTURE_KEY']) {
            expect(keys).not.toContain(gone);
        }
    });
});
