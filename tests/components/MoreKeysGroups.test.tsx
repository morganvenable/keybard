import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import SpecialKeysPanel from '../../src/layout/SecondarySidebar/Panels/SpecialKeysPanel/SpecialKeysPanel';
import MousePanel from '../../src/layout/SecondarySidebar/Panels/MousePanel';
import LayersPanel from '../../src/layout/SecondarySidebar/Panels/LayersPanel';
import {
    MODIFIER_TRICK_KEYS, MAGIC_KEYS, MORE_SWITCH_KEYS, SYSTEM_EXTRA_KEYS,
    LOCKING_KEYS, MOUSE_EXTRA_BUTTON_KEYS, MEDIA_KEYS,
} from '../../src/constants/special-key-groups';
import { keyService } from '../../src/services/key.service';

const keyboardState: { keyboard: unknown } = { keyboard: null };
const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => keyboardState }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ keyVariant: 'default', layoutMode: 'sidebar' }) }));
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode, selectedTarget: null }) }));
vi.mock('@/hooks/useLayerNames', () => ({ useLayerNames: () => ({ renameLayer: vi.fn(), nameError: null }) }));
vi.mock('@/components/Key', () => ({
    Key: ({ keycode, label, onClick }: { keycode: string; label: string; onClick?: () => void }) => (
        <button data-testid="key" data-keycode={keycode} onClick={onClick}>{label}</button>
    ),
}));
vi.mock('@/layout/SecondarySidebar/components/SidebarItemRow', () => ({
    default: ({ keycode, onAssignKeycode }: { keycode: string; onAssignKeycode: (k: string) => void }) => (
        <div data-testid="row" data-keycode={keycode} onClick={() => onAssignKeycode(keycode)} />
    ),
}));
vi.mock('@/layout/SecondarySidebar/Panels/MouseMovementSection', () => ({ default: () => null }));

const keys = (el: HTMLElement) => within(el).queryAllByTestId('key').map(k => k.getAttribute('data-keycode'));
const allWorking = () => [...MODIFIER_TRICK_KEYS, ...MAGIC_KEYS, ...MORE_SWITCH_KEYS,
    ...SYSTEM_EXTRA_KEYS, ...LOCKING_KEYS, ...MOUSE_EXTRA_BUTTON_KEYS];

beforeEach(() => {
    assignKeycode.mockClear();
    try { localStorage.clear(); } catch { /* ignore */ }
    keyboardState.keyboard = { name: 'T', rows: 1, cols: 1, layers: 4, keymap: [[0]], custom_keycodes: [] };
});

describe('More keys data', () => {
    it('every working key resolves to a code the keymap knows', () => {
        for (const { keycode } of allWorking()) {
            expect(keyService.define(keycode), keycode).toBeTruthy();
            expect(keyService.parse(keycode), keycode).toBeGreaterThan(0);
        }
    });

    it('lists no key twice, and the locking keys leave Media', () => {
        const all = allWorking().map(k => k.keycode);
        expect(new Set(all).size).toBe(all.length);
        const media = MEDIA_KEYS.map(k => k.keycode);
        for (const l of LOCKING_KEYS) expect(media).not.toContain(l.keycode);
    });

    it('leaves out the EEPROM keys', () => {
        expect(allWorking().some(k => /EEPROM|EE_|CLR/.test(k.keycode))).toBe(false);
    });
});

describe('Special Keys More keys', () => {
    it('holds the modifier tricks, magic and switches, closed by default', () => {
        render(<SpecialKeysPanel isPicker />);
        const more = screen.getByTestId('special-more-keys') as HTMLDetailsElement;
        expect(more.open).toBe(false);
        for (const g of [MODIFIER_TRICK_KEYS, MAGIC_KEYS, MORE_SWITCH_KEYS, SYSTEM_EXTRA_KEYS]) {
            for (const k of g) expect(keys(more)).toContain(k.keycode);
        }
        const outside = screen.getAllByTestId('key').filter(k => !more.contains(k)).map(k => k.getAttribute('data-keycode'));
        for (const c of ['QK_GESC', 'NK_TOGG', 'KO_TOGG', 'OS_TOGG']) expect(outside).not.toContain(c);
    });

    it('ends with the Any key tile', () => {
        render(<SpecialKeysPanel isPicker />);
        const more = screen.getByTestId('special-more-keys');
        expect(within(more).getByTestId('any-key-tile')).toBeTruthy();
    });

    it('shows a labeled search slot that is not a control', () => {
        render(<SpecialKeysPanel isPicker />);
        const slot = screen.getByTestId('special-more-keys').querySelector('[data-testid="more-keys-search-slot"]')!;
        expect(slot.textContent).toBe('Key search comes later');
        expect(slot.querySelector('input,button')).toBeNull();
    });
});

describe('Mouse Keys More keys', () => {
    it('holds Mouse 6 to 8, closed, and assigns them', () => {
        render(<MousePanel isPicker />);
        const more = screen.getByTestId('mouse-more-keys') as HTMLDetailsElement;
        expect(more.open).toBe(false);
        const rows = within(more).getAllByTestId('row');
        expect(rows.map(r => r.getAttribute('data-keycode'))).toEqual(['KC_BTN6', 'KC_BTN7', 'KC_BTN8']);
        fireEvent.click(rows[2]);
        expect(assignKeycode).toHaveBeenCalledWith('KC_BTN8');
        const outside = screen.getAllByTestId('row').filter(r => !more.contains(r)).map(r => r.getAttribute('data-keycode'));
        expect(outside).not.toContain('KC_BTN6');
    });
});

describe('Layer Keys More keys', () => {
    it('offers Layer-Mod keys that assign LM(layer, mods)', () => {
        render(<LayersPanel isPicker />);
        const more = screen.getByTestId('layers-more-keys') as HTMLDetailsElement;
        expect(more.open).toBe(false);
        const group = within(more).getByTestId('layer-mod-group');
        fireEvent.click(within(group).getByText('Shift'));
        const lm = within(group).getAllByTestId('key').find(k => k.textContent === 'LM 2')!;
        expect(lm.getAttribute('data-keycode')).toBe('LM(2, MOD_LCTL|MOD_LSFT)');
        fireEvent.click(lm);
        expect(assignKeycode).toHaveBeenCalledWith('LM(2, MOD_LCTL|MOD_LSFT)');
    });

    it('round-trips LM through the keymap', () => {
        const code = keyService.parse('LM(2, MOD_LCTL|MOD_LSFT)');
        expect(code).toBe(0x5000 + (2 << 5) + 0x03);
        expect(keyService.stringify(code)).toBe('LM(2, MOD_LCTL|MOD_LSFT)');
        expect(keyService.parse('LM(1, MOD_RALT)')).toBe(0x5000 + (1 << 5) + 0x14);
        expect(keyService.stringify(0x5000 + (1 << 5) + 0x14)).toBe('LM(1, MOD_RALT)');
    });
});

describe('remembering open state', () => {
    it('remembers each category separately in this browser', () => {
        const { unmount } = render(<MousePanel isPicker />);
        const more = screen.getByTestId('mouse-more-keys') as HTMLDetailsElement;
        more.open = true;
        fireEvent(more, new Event('toggle'));
        unmount();
        render(<MousePanel isPicker />);
        expect((screen.getByTestId('mouse-more-keys') as HTMLDetailsElement).open).toBe(true);
    });

    it('still renders when storage throws', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        render(<MousePanel isPicker />);
        expect((screen.getByTestId('mouse-more-keys') as HTMLDetailsElement).open).toBe(false);
        spy.mockRestore();
    });
});
