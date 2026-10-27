import { describe, expect, it } from 'vitest';
import { comboNamesToOffer } from '../../src/hooks/useComboNameOffer';
import { ComboOptions, type KeyboardInfo } from '../../src/types/keyboard.types';

const ON = ComboOptions.ENABLED;
const board = (names: Record<string, string> = {}, flags2 = 0x80): KeyboardInfo => ({
    rows: 1, cols: 1, svil_proto: 3, feature_flags2: flags2, combo_count: 3,
    combos: [
        { cmbid: 0, keys: ['KC_J', 'KC_K', 'KC_NO', 'KC_NO'], output: 'KC_ESC', options: ON },
        { cmbid: 1, keys: ['KC_D', 'KC_F', 'KC_NO', 'KC_NO'], output: 'KC_TAB', options: ON },
        { cmbid: 2, keys: ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], output: 'KC_NO', options: 0 },
    ],
    cosmetic: { combos: names },
} as KeyboardInfo);

describe('offering Keybard\'s combo names to a board that stores them', () => {
    it('offers every kept name when the board has none', () => {
        expect(comboNamesToOffer(board({ '0': 'Dictation', '1': 'Zoom' }), board(), new Set())).toEqual([[0, 'Dictation'], [1, 'Zoom']]);
    });
    it('offers each name once per session', () => {
        expect(comboNamesToOffer(board({ '0': 'Dictation', '1': 'Zoom' }), board(), new Set([0]))).toEqual([[1, 'Zoom']]);
    });
    it('offers nothing when the board already has combo names: the board\'s names win', () => {
        expect(comboNamesToOffer(board({ '0': 'Dictation' }), board({ '1': 'On board' }), new Set())).toEqual([]);
    });
    it('offers nothing to firmware that does not store combo names', () => {
        expect(comboNamesToOffer(board({ '0': 'Dictation' }), board({}, 0x01), new Set())).toEqual([]);
    });
});
