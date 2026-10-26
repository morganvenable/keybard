import { describe, expect, it } from 'vitest';
import { ComboOptions, type ComboEntry } from '../../src/types/keyboard.types';
import { isBlankCombo, startNewCombo } from '../../src/utils/combo-edit';

const ON = ComboOptions.ENABLED;
const combo = (keys: string[], output = 'KC_NO', options = 0): ComboEntry =>
    ({ cmbid: 0, keys, output, options }) as ComboEntry;
const blank = () => combo(['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO']);

describe('new combos start on', () => {
    it('knows a blank slot', () => {
        expect(isBlankCombo(blank())).toBe(true);
        expect(isBlankCombo(undefined)).toBe(true);
        expect(isBlankCombo(combo(['KC_J', 'KC_NO', 'KC_NO', 'KC_NO']))).toBe(false);
        expect(isBlankCombo(combo(['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], 'KC_ESC'))).toBe(false);
    });

    it('turns a combo on when its first trigger key goes into a blank slot', () => {
        const after = combo(['KC_J', 'KC_NO', 'KC_NO', 'KC_NO']);
        expect(startNewCombo(blank(), after).options & ON).toBe(ON);
    });

    it('turns a combo on when its output is set first', () => {
        const after = combo(['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], 'KC_ESC');
        expect(startNewCombo(blank(), after).options & ON).toBe(ON);
    });

    it('keeps the combo term', () => {
        const before = combo(['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], 'KC_NO', 80);
        const after = combo(['KC_J', 'KC_NO', 'KC_NO', 'KC_NO'], 'KC_NO', 80);
        expect(startNewCombo(before, after).options).toBe(ON | 80);
    });

    it('leaves a combo that already had keys as it was, off or on', () => {
        const before = combo(['KC_J', 'KC_NO', 'KC_NO', 'KC_NO'], 'KC_ESC', 0);
        const after = combo(['KC_J', 'KC_K', 'KC_NO', 'KC_NO'], 'KC_ESC', 0);
        expect(startNewCombo(before, after).options).toBe(0);
    });

    it('does nothing when the slot stays blank (clearing an empty slot)', () => {
        expect(startNewCombo(blank(), blank()).options).toBe(0);
    });
});
