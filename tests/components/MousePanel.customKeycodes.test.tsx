import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CustomKeycode } from '../../src/types/keyboard.types';
import { keyService } from '../../src/services/key.service';
import MousePanel from '../../src/layout/SecondarySidebar/Panels/MousePanel';

// The Mouse Keys picker lists only QMK's emulated mouse keys. No SV_ key of any
// kind shows here: Svalboard pointing keys are in Pointing Devices.

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

describe('MousePanel holds no SV_ key', () => {
    it('lists no SV_ key of any kind, whatever the firmware offers', () => {
        const keyboard = { name: 'Test', rows: 1, cols: 1, layers: 1, keymap: [[0]], custom_keycodes: customKeycodes };
        keyService.generateAllKeycodes(keyboard as never);
        keyboardState.keyboard = keyboard;
        render(<MousePanel isPicker />);
        const keys = shown();
        expect(keys.filter(k => k?.startsWith('SV_'))).toEqual([]);
        expect(keys).toContain('KC_BTN1');
        expect(keys).toContain('KC_MS_U');
        expect(keys).toContain('KC_WH_U');
        expect(keys).toContain('KC_ACL0');
    });
});
