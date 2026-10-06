import { describe, expect, it } from 'vitest';
import { surfaceKeys } from '@/features/trainer/useSurfaceKeys';
import { keyService } from '@/services/key.service';
function label(key: string, language = 'us', deviceLabel = 'Wrong companion label') {
    const code = keyService.parse(key)!;
    const board = { rows: 10, cols: 6, keymap: [[code]],
        keylayout: { 0: { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1 } }, trainerLabels: { [code]: deviceLabel } };
    return surfaceKeys(board, 0, 1, 'Both', language)[0].label;
}
describe('Trainer uses Keybard key legends', () => {
    it.each([
        ['LSFT(KC_1)', '!'], ['LSFT(KC_SCOLON)', ':'], ['LSFT(KC_2)', '@'],
        ['LSFT(KC_3)', '#'], ['LSFT(KC_SLASH)', '?'], ['KC_EXLM', '!'], ['KC_COLN', ':'],
    ])('%s renders as %s even with a companion fallback label', (key, expected) => {
        expect(label(key)).toBe(expected);
    });
    it('uses the selected keyboard language', () => {
        expect(label('LSFT(KC_3)', 'uk')).toBe('£');
    });
    it('preserves additional modifiers', () => {
        const result = label('LCS(KC_1)');
        expect(result).toContain('!');
        expect(result).toContain('C_S');
    });
    it('does not mistake a real keypad key for the number row', () => {
        expect(label('LSFT(KC_P1)')).not.toBe('!');
    });
    it('keeps device-only behavior labels when definitions are absent', () => {
        expect(label('TD(4)', 'us', 'Tap: Enter\nHold: Layer 3')).toBe('Tap: Enter\nHold: Layer 3');
    });
});
