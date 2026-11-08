import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import SpecialKeysPanel from '../../src/layout/SecondarySidebar/Panels/SpecialKeysPanel/SpecialKeysPanel';
import {
    EDITING_KEYS, MEDIA_KEYS, FEATURE_SWITCH_KEYS, LIGHTING_KEYS, BOARD_KEYS, AUTO_SHIFT_TIMING_KEYS,
} from '../../src/constants/special-key-groups';
import { isUnbuiltKeycode } from '../../src/constants/unbuilt-keycodes';

const keyboardState: { keyboard: unknown } = { keyboard: null };
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardState }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ keyVariant: 'default', layoutMode: 'sidebar' }) }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode: vi.fn() }) }));
vi.mock('@/components/Key', () => ({
    Key: ({ keycode, label }: { keycode: string; label: string }) => (
        <button data-testid="key" data-keycode={keycode}>{label}</button>
    ),
}));

const codesIn = (el: HTMLElement) => within(el).queryAllByTestId('key').map(k => k.getAttribute('data-keycode'));
const groupByTitle = (title: string) =>
    screen.getAllByTestId('special-group').find(g => g.textContent?.startsWith(title)) as HTMLElement;

beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    keyboardState.keyboard = { custom_keycodes: [
        { name: 'SV_TURBO_SCAN', shortName: 'Turbo\nScan', title: 'Turbo Scan' },
        { name: 'SV_OUTPUT_STATUS', shortName: 'Output\nStatus', title: 'Output Status' },
    ] };
});

describe('Special Keys regroup', () => {
    it('moves editing keys out of Media', () => {
        render(<SpecialKeysPanel isPicker />);
        const media = codesIn(groupByTitle('Media'));
        const editing = codesIn(groupByTitle('Editing'));
        for (const c of ['KC_CUT', 'KC_COPY', 'KC_UNDO', 'KC_FIND', 'KC_PSTE', 'KC_AGIN', 'KC_SLCT']) {
            expect(editing).toContain(c);
            expect(media).not.toContain(c);
        }
        expect(media).toContain('KC_MPLY');
    });

    it('moves Auto Shift and Combo on/off to Feature switches, with no Audio group', () => {
        render(<SpecialKeysPanel isPicker />);
        expect(codesIn(groupByTitle('Feature switches'))).toEqual(FEATURE_SWITCH_KEYS.map(k => k.keycode));
        expect(codesIn(groupByTitle('Feature switches'))).toEqual(
            expect.arrayContaining(['KC_ASON', 'KC_ASOFF', 'KC_ASTG', 'CMB_ON', 'CMB_OFF', 'CMB_TOG']));
        expect(screen.queryByText(/Audio and Haptic/)).toBeNull();
    });

    it('keeps working lighting keys visible, with a way to turn the LEDs off', () => {
        render(<SpecialKeysPanel isPicker />);
        const lighting = groupByTitle('Lighting');
        expect(codesIn(lighting)).toEqual(LIGHTING_KEYS.map(k => k.keycode));
        expect(codesIn(lighting)).toEqual(expect.arrayContaining(['RGB_TOG', 'RGB_VAI', 'RGB_VAD']));
        expect(within(lighting).getByText('LEDs On/Off')).toBeTruthy();
    });

    it('keeps More keys closed, and holds board keys and Auto Shift timing', () => {
        render(<SpecialKeysPanel isPicker />);
        const more = screen.getByTestId('special-more-keys') as HTMLDetailsElement;
        expect(more.open).toBe(false);
        expect(codesIn(more)).toEqual(expect.arrayContaining(['RESET', 'QK_REBOOT', 'QK_DEBUG_TOGGLE', 'SV_TURBO_SCAN', 'SV_OUTPUT_STATUS']));
        expect(codesIn(more)).not.toContain('QK_CLEAR_EEPROM');
        for (const c of AUTO_SHIFT_TIMING_KEYS.map(k => k.keycode)) expect(codesIn(more)).toContain(c);
    });

    it('remembers More keys being opened', () => {
        const { unmount } = render(<SpecialKeysPanel isPicker />);
        const more = screen.getByTestId('special-more-keys') as HTMLDetailsElement;
        more.open = true;
        fireEvent(more, new Event('toggle'));
        unmount();
        render(<SpecialKeysPanel isPicker />);
        expect((screen.getByTestId('special-more-keys') as HTMLDetailsElement).open).toBe(true);
    });

    it('shows no key for a feature the firmware does not build, anywhere in the picker', () => {
        render(<SpecialKeysPanel isPicker />);
        const shown = screen.getAllByTestId('key').map(k => k.getAttribute('data-keycode') as string);
        expect(shown.length).toBeGreaterThan(40);
        expect(shown.filter(isUnbuiltKeycode)).toEqual([]);
        for (const c of ['AU_ON', 'MU_ON', 'HPT_ON', 'BL_TOGG', 'RGB_MOD', 'RGB_M_B', 'CLICKY_TOGGLE']) expect(shown).not.toContain(c);
        expect(screen.queryByText(/does nothing|without these features|Haptic|Backlight/i)).toBeNull();
    });

    it('lists every key once across the data groups', () => {
        const all = [...EDITING_KEYS, ...MEDIA_KEYS, ...FEATURE_SWITCH_KEYS, ...LIGHTING_KEYS, ...BOARD_KEYS,
            ...AUTO_SHIFT_TIMING_KEYS].map(k => k.keycode);
        expect(new Set(all).size).toBe(all.length);
    });
});
