import { describe, expect, it } from 'vitest';
import { OWNER_Q9_COLORBLIND_HEAT_SETTING } from '@/constants/owner-decisions';
import { floorTo, formatPercentDown, formatSpeedDown, spokenSpeed } from '@/features/practice/ui/format';
import { COLOR_BLIND_HEAT_SETTING, heatLegend, heatValueText } from '@/features/practice/ui/progress/heat';

// The heatmap and the Characters table print one character's numbers with the same rounding (§12 M4,
// "heatmap values match the character table"): rounded down, so nothing just under target prints the target.

const values = (v: { cpm?: number | null; accuracy?: number | null }) => ({ cpm: null, accuracy: null, errors: null, usage: null, ...v });

describe('Progress figures round down, in the heatmap and the Characters table alike', () => {
    it('accuracy: 41 of 42 prints 97% in both, never 98%', () => {
        const accuracy = 41 / 42;
        expect(formatPercentDown(accuracy)).toBe('97');
        expect(heatValueText('accuracy', values({ accuracy }), 'wpm')).toBe(`${formatPercentDown(accuracy)}%`);
    });

    it('speed: 174.9 cpm is 34.9 wpm in the table and 34 on the key; 174 cpm in both in CPM', () => {
        expect(formatSpeedDown(174.9, 'wpm')).toBe('34.9');
        expect(heatValueText('speed', values({ cpm: 174.9 }), 'wpm')).toBe('34');
        expect(formatSpeedDown(174.9, 'cpm')).toBe('174');
        expect(heatValueText('speed', values({ cpm: 174.9 }), 'cpm')).toBe('174');
        expect(spokenSpeed(174.9, 'wpm', true)).toBe('34.9 words per minute');
        expect(spokenSpeed(174.9, 'wpm')).toBe('35.0 words per minute');
    });

    it('allows for float error: 0.29 is 29%, 0.7 is 70%', () => {
        expect(formatPercentDown(0.29)).toBe('29');
        expect(heatValueText('accuracy', values({ accuracy: 0.29 }), 'wpm')).toBe('29%');
        expect(formatPercentDown(0.7)).toBe('70');
        expect(floorTo(0.1 + 0.2, 1)).toBe(0.3);
        expect(formatSpeedDown(150, 'wpm')).toBe('30.0');
    });

    it('no value prints a dash', () => {
        expect(formatSpeedDown(null, 'wpm')).toBe('—');
        expect(formatPercentDown(undefined)).toBe('—');
        expect(heatValueText('speed', values({}), 'wpm')).toBe('—');
        expect(heatValueText('accuracy', values({}), 'wpm')).toBe('—');
    });
});

describe('heat faces: legends and the Q9 switch', () => {
    it('a key that types no character reads as plain text: a layer key as MO 1, others by their center label', () => {
        expect(heatLegend('MO(1)', 'MO(1)', { type: 'layer', layertext: 'MO', top: 'MO(1)', str: '1' }, 'us')).toBe('MO 1');
        expect(heatLegend('KC_LSFT', 'Shift', undefined, 'us')).toBe('Shift');
    });

    it('the color-blind palette follows OWNER_Q9 (answered no: one palette)', () => {
        expect(COLOR_BLIND_HEAT_SETTING).toBe(OWNER_Q9_COLORBLIND_HEAT_SETTING);
    });
});
