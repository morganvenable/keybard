import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SvalboardKeys from '../../src/layout/SecondarySidebar/Panels/SpecialKeysPanel/SvalboardKeys';

const keyboardState: { keyboard: unknown } = { keyboard: null };
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardState }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ keyVariant: 'default' }) }));
const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));
vi.mock('@/components/Key', () => ({
    Key: ({ keycode, label, onClick }: { keycode: string; label: string; onClick: () => void }) => (
        <button data-testid="key" data-keycode={keycode} onClick={onClick}>{label}</button>
    ),
}));

const ck = (name: string, shortName: string) => ({ name, shortName, title: shortName });

describe('Special Keys, Svalboard group', () => {
    it('shows Caps Word, layer pairs and unknown keys, not pointer or board keys', () => {
        keyboardState.keyboard = { custom_keycodes: [
            ck('SV_CAPS_WORD', 'Caps\nWord'), ck('SV_TOGGLE_23_67', 'MO 23'), ck('SV_TURBO_SCAN', 'Turbo\nScan'),
            ck('SV_OUTPUT_STATUS', 'Output\nStatus'), ck('SV_FUTURE_KEY', 'Future'),
            ck('SV_SNIPER_2', 'Sniper'), ck('SV_LEFT_DPI_INC', 'DPI'),
        ] };
        render(<SvalboardKeys />);
        expect(screen.getByText('Svalboard')).toBeTruthy();
        const codes = screen.getAllByTestId('key').map(el => el.getAttribute('data-keycode'));
        expect(codes).toEqual(['SV_CAPS_WORD', 'SV_TOGGLE_23_67', 'SV_FUTURE_KEY']);
        fireEvent.click(screen.getAllByTestId('key')[0]);
        expect(assignKeycode).toHaveBeenCalledWith('SV_CAPS_WORD');
    });

    it('renders nothing when the board has no such keys', () => {
        keyboardState.keyboard = { custom_keycodes: [ck('SV_SNIPER_2', 'Sniper')] };
        const { container } = render(<SvalboardKeys />);
        expect(container.innerHTML).toBe('');
    });
});
