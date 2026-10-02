import { describe, it, expect } from 'vitest';
import { getCenterContent, getHeaderIcons } from '../../src/utils/key-icons';

// Sniper/Boost toggle keys in the Pointing panel are labelled "<family> NxTG".
// The family word becomes the header icon and is stripped from the centre text,
// leaving a 4-character label that Key.tsx renders at the variant's native size
// (labels over 5 characters drop to 9.6px and wrap, which cropped "TOGGLE").
describe('key-icons: sniper and boost toggle labels', () => {
    it.each([
        ['Sniper 2xTG', 'SV_SNIPER_2_TG', '2xTG'],
        ['Sniper 5xTG', 'SV_SNIPER_5_TG', '5xTG'],
        ['Boost 2xTG', 'SV_BOOST_2_TG', '2xTG'],
        ['Boost 3xTG', 'SV_BOOST_3_TG', '3xTG'],
    ])('"%s" renders centre text "%s" with the family icon in the header', (label, keycode, centre) => {
        const { icons, isSniper, isBoost } = getHeaderIcons(keycode, label);
        expect(icons).toHaveLength(1);
        expect(isSniper).toBe(keycode.includes('SNIPER'));
        expect(isBoost).toBe(keycode.includes('BOOST'));
        const text = getCenterContent(label, keycode, false);
        expect(text).toBe(centre);
        expect(String(text).length).toBeLessThanOrEqual(5); // stays clear of the shrink/wrap rule
    });

    it('hold keys keep their short "Nx" centre text', () => {
        expect(getCenterContent('Sniper 2x', 'SV_SNIPER_2', false)).toBe('2x');
        expect(getCenterContent('Boost 5x', 'SV_BOOST_5', false)).toBe('5x');
    });
});
