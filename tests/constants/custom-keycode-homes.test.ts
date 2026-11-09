import { describe, it, expect } from 'vitest';
import { customKeycodeHome, customKeycodesAt } from '../../src/constants/custom-keycode-homes';
import { SVALBOARD_VIAL_CUSTOM_KEYCODES } from '../../src/constants/svalboard-vial';

const fake = (name: string) => ({ name, shortName: 'x', title: 'x' });

describe('custom keycode placement', () => {
    it('puts every Svalboard pointing key in Pointing Devices, none in Mouse Keys', () => {
        for (const n of ['SV_LEFT_DPI_INC', 'SV_LEFT_DPI_DEC', 'SV_RIGHT_DPI_INC', 'SV_RIGHT_DPI_DEC',
            'SV_LEFT_SCROLL_TOGGLE', 'SV_RIGHT_SCROLL_TOGGLE', 'SV_SCROLL_TOGGLE', 'SV_NATURAL_SCROLL_TOGGLE',
            'SV_AXIS_SCROLL_LOCK', 'SV_RECALIBRATE_POINTER', 'SV_TOGGLE_AUTOMOUSE', 'SV_MH_CHANGE_TIMEOUTS']) {
            expect(customKeycodeHome(n)).toBe('pointing');
        }
    });

    it('treats Sniper, Boost and scroll keys as shown in Pointing Devices', () => {
        for (const n of ['SV_SNIPER_2_TG', 'SV_BOOST_5', 'SV_SCROLL_HOLD', 'SV_VELOCITY_SCROLL_TOGGLE']) {
            expect(customKeycodeHome(n)).toBe('pointing');
        }
    });

    it('sends a Sniper or Boost key the Pointing panel does not list to Svalboard', () => {
        expect(customKeycodeHome('SV_SNIPER_7')).toBe('svalboard');
        expect(customKeycodeHome('SV_BOOST_10_TG')).toBe('svalboard');
    });

    it('puts non-pointer keys in Svalboard', () => {
        for (const n of ['SV_CAPS_WORD', 'SV_TOGGLE_23_67', 'SV_TOGGLE_45_67']) {
            expect(customKeycodeHome(n)).toBe('svalboard');
        }
    });

    it('puts Turbo Scan and Output Status in Board and firmware', () => {
        for (const n of ['SV_TURBO_SCAN', 'SV_OUTPUT_STATUS']) expect(customKeycodeHome(n)).toBe('board');
    });

    it('sends an unknown future key to Svalboard, never Mouse', () => {
        expect(customKeycodeHome('SV_SOMETHING_NEW')).toBe('svalboard');
        expect(customKeycodesAt([fake('SV_SOMETHING_NEW')], 'svalboard').map(k => k.name)).toEqual(['SV_SOMETHING_NEW']);
        expect(customKeycodesAt([fake('SV_SOMETHING_NEW')], 'mouse')).toEqual([]);
    });

    it('ignores keys that are not SV_ keys', () => {
        expect(customKeycodesAt([fake('OTHER_KEY')], 'svalboard')).toEqual([]);
    });

    it('places every built-in key in exactly one group, and none in Mouse Keys', () => {
        const all = SVALBOARD_VIAL_CUSTOM_KEYCODES as unknown as { name: string; shortName: string; title: string }[];
        expect(customKeycodesAt(all, 'mouse')).toEqual([]);
        const total = (['mouse', 'pointing', 'board', 'svalboard'] as const)
            .map(h => all.filter(k => customKeycodeHome(k.name) === h).length)
            .reduce((a, b) => a + b, 0);
        expect(total).toBe(all.length);
        expect(customKeycodesAt(all, 'svalboard').map(k => k.name)).toEqual(
            expect.arrayContaining(['SV_CAPS_WORD', 'SV_TOGGLE_23_67', 'SV_TOGGLE_45_67']));
        expect(customKeycodesAt(all, 'board').map(k => k.name)).toEqual(['SV_OUTPUT_STATUS', 'SV_TURBO_SCAN']);
    });
});
