import { describe, expect, it } from 'vitest';
import { AltRepeatKeyOptions, ComboOptions, LeaderOptions, type ComboEntry } from '../../src/types/keyboard.types';
import { isBlankCombo, startNewAltRepeat, startNewCombo, startNewLeader } from '../../src/utils/combo-edit';

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

describe('new leaders and alt-repeat keys start on', () => {
    const NO5 = ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'];
    const leader = (sequence: string[], output = 'KC_NO', options = 0) => ({ ldrid: 0, sequence, output, options });
    const alt = (keycode: string, alt_keycode = 'KC_NO', options = 0) => ({ arkid: 0, keycode, alt_keycode, allowed_mods: 0, options });

    it('turns a leader on when its first key goes into a blank slot', () => {
        expect(startNewLeader(leader([...NO5]), leader(['KC_A', ...NO5.slice(1)])).options).toBe(LeaderOptions.ENABLED);
        expect(startNewLeader(leader([...NO5]), leader([...NO5], 'KC_B')).options).toBe(LeaderOptions.ENABLED);
    });
    it('leaves a leader that had keys as it was, and a blank one that stays blank', () => {
        expect(startNewLeader(leader(['KC_A', ...NO5.slice(1)]), leader(['KC_A', 'KC_B', 'KC_NO', 'KC_NO', 'KC_NO'])).options).toBe(0);
        expect(startNewLeader(leader([...NO5]), leader([...NO5])).options).toBe(0);
    });
    it('turns an alt-repeat key on when its first key goes into a blank slot, keeping its other options', () => {
        expect(startNewAltRepeat(alt('KC_NO', 'KC_NO', AltRepeatKeyOptions.BIDIRECTIONAL), alt('KC_A', 'KC_NO', AltRepeatKeyOptions.BIDIRECTIONAL)).options)
            .toBe(AltRepeatKeyOptions.ENABLED | AltRepeatKeyOptions.BIDIRECTIONAL);
        expect(startNewAltRepeat(alt('KC_NO'), alt('KC_NO', 'KC_B')).options).toBe(AltRepeatKeyOptions.ENABLED);
    });
    it('leaves an alt-repeat key that had keys as it was', () => {
        expect(startNewAltRepeat(alt('KC_A', 'KC_B'), alt('KC_A', 'KC_C')).options).toBe(0);
    });
});
