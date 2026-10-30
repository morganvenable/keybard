import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InternationalKeys, { INTERNATIONAL_KEYCODES } from '../../src/layout/SecondarySidebar/Panels/SpecialKeysPanel/InternationalKeys';
import { keyService } from '../../src/services/key.service';

const layoutSettings = { keyVariant: 'default' as 'small' | 'medium' | 'default', layoutMode: 'sidebar' };
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => layoutSettings }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: null }) }));
vi.mock('@/contexts/LayerContext', () => ({ useLayer: () => ({ selectedLayer: 0 }) }));
const assignKeycode = vi.fn();
vi.mock('@/contexts/KeyBindingContext', () => ({ useKeyBinding: () => ({ assignKeycode }) }));
vi.mock('@/components/Key', () => ({
    Key: ({ keycode, variant, className, label, title, onClick }: { keycode: string; variant?: string; className?: string; label?: string; title?: string; onClick?: () => void }) => (
        <div data-testid="key" data-keycode={keycode} data-variant={variant ?? ''} data-size={className ?? ''} data-label={label ?? ''} title={title} onClick={onClick} />
    ),
}));

// QMK's values, from svalboard/qmk `svalboard` quantum/keycodes.h (x4.3): KC_INTERNATIONAL_1..9 are
// 0x0087..0x008F and KC_LANGUAGE_1..9 are 0x0090..0x0098, with the short names KC_INT1.. and KC_LNG1...
const QMK: [string, string, number][] = [
    ...Array.from({ length: 9 }, (_, i) => [`KC_INTERNATIONAL_${i + 1}`, `KC_INT${i + 1}`, 0x0087 + i] as [string, string, number]),
    ...Array.from({ length: 9 }, (_, i) => [`KC_LANGUAGE_${i + 1}`, `KC_LNG${i + 1}`, 0x0090 + i] as [string, string, number]),
];

describe('International keys: QMK International 1-9 and Language 1-9', () => {
    beforeEach(() => {
        assignKeycode.mockClear();
        layoutSettings.keyVariant = 'default';
    });

    it('every QMK name and short name is in the keycode table with QMK\'s value, and reads back', () => {
        for (const [long, short, code] of QMK) {
            expect(keyService.parse(long), long).toBe(code);
            expect(keyService.parse(short), short).toBe(code);
            const name = keyService.stringify(code);
            expect(keyService.parse(name), `${long} reads back`).toBe(code);
            expect(keyService.define(code)?.code, `${long} defined`).toBe(code);
        }
    });

    it('offers all eighteen in the picker, in QMK order, and assigns each one', () => {
        render(<InternationalKeys />);
        expect(screen.getByText('International')).toBeInTheDocument();
        const keys = screen.getAllByTestId('key');
        expect(keys.map((k) => keyService.parse(k.getAttribute('data-keycode')!))).toEqual(QMK.map(([, , code]) => code));
        for (const key of keys) fireEvent.click(key);
        expect(assignKeycode.mock.calls.map(([kc]) => keyService.parse(kc))).toEqual(QMK.map(([, , code]) => code));
    });

    it('labels the JIS conversion keys with their legends and names them for people who search by name', () => {
        render(<InternationalKeys />);
        const key = (kc: string) => screen.getAllByTestId('key').find((el) => el.getAttribute('data-keycode') === kc)!;
        expect(key('KC_HENK').getAttribute('data-label')).toBe('変換');
        expect(key('KC_HENK').getAttribute('title')).toMatch(/^Henkan 変換/);
        expect(key('KC_MHEN').getAttribute('data-label')).toBe('無変換');
        expect(key('KC_MHEN').getAttribute('title')).toMatch(/^Muhenkan 無変換/);
        expect(key('KC_KANA').getAttribute('title')).toMatch(/^Kana かな/);
        expect(key('KC_LANG1').getAttribute('title')).toMatch(/Han\/Yeong 한영/);
        expect(key('KC_LANG2').getAttribute('title')).toMatch(/Mac Eisu 英数/);
        // No key shows its raw keycode name as its legend.
        for (const el of screen.getAllByTestId('key')) expect(el.getAttribute('data-label')).not.toMatch(/^KC_/);
    });

    it('sizes every key from one variant (sidebar, bottom bar)', () => {
        const { unmount } = render(<InternationalKeys />);
        for (const el of screen.getAllByTestId('key')) expect(el.getAttribute('data-size')).toBe('h-[60px] w-[60px]');
        unmount();
        render(<InternationalKeys variant="medium" />);
        for (const el of screen.getAllByTestId('key')) {
            expect(el.getAttribute('data-variant')).toBe('medium');
            expect(el.getAttribute('data-size')).toBe('h-[45px] w-[45px]');
        }
    });

    it('lists exactly the keycodes it renders', () => {
        expect(INTERNATIONAL_KEYCODES).toHaveLength(18);
    });
});
