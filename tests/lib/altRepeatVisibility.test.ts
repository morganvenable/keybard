import { describe, expect, it } from 'vitest';

import { SETTINGS, SETTINGS_CATEGORIES } from '../../src/contexts/SettingsContext';
import { hasAltRepeatEntries } from '../../src/lib/altRepeatVisibility';

const entry = (keycode: string, alt_keycode: string) => ({ keycode, alt_keycode, allowed_mods: 0, options: 0 });

describe('Alt-Repeat placement', () => {
    it('has no Settings switch any more', () => {
        expect(SETTINGS.find(s => s.name === 'show-alt-repeat')).toBeUndefined();
        for (const category of SETTINGS_CATEGORIES) expect(category.settings).not.toContain('show-alt-repeat');
    });

    it('counts a board with a key in any entry as having entries', () => {
        expect(hasAltRepeatEntries({ alt_repeat_keys: [entry('KC_NO', 'KC_NO'), entry('KC_A', 'KC_NO')] })).toBe(true);
        expect(hasAltRepeatEntries({ alt_repeat_keys: [entry('KC_NO', 'KC_B')] })).toBe(true);
    });

    it('counts empty slots, no slots and no board as having none', () => {
        expect(hasAltRepeatEntries({ alt_repeat_keys: [entry('KC_NO', 'KC_NO'), entry('', '')] })).toBe(false);
        expect(hasAltRepeatEntries({ alt_repeat_keys: [] })).toBe(false);
        expect(hasAltRepeatEntries({})).toBe(false);
        expect(hasAltRepeatEntries(null)).toBe(false);
    });
});
