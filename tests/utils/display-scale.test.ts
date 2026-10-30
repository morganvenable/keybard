import { describe, expect, it } from 'vitest';
import { MS_PER_STORED_SECOND, fromDisplay, roundedNote, storesExactly, toDisplay } from '../../src/utils/display-scale';

describe('deep idle shown in ms, stored in whole seconds', () => {
    it('converts both ways, rounding to the nearest second', () => {
        expect(toDisplay(600, MS_PER_STORED_SECOND)).toBe(600000);
        expect(toDisplay(7200, MS_PER_STORED_SECOND)).toBe(7200000);
        expect(fromDisplay(600000, MS_PER_STORED_SECOND)).toBe(600);
        expect(fromDisplay(2500, MS_PER_STORED_SECOND)).toBe(3);
        expect(fromDisplay(2499, MS_PER_STORED_SECOND)).toBe(2);
        expect(fromDisplay(0, MS_PER_STORED_SECOND)).toBe(0);
    });
    it('says when a typed value was rounded', () => {
        expect(storesExactly(4000, MS_PER_STORED_SECOND)).toBe(true);
        expect(storesExactly(2500, MS_PER_STORED_SECOND)).toBe(false);
        expect(storesExactly(17, 1)).toBe(true);
        expect(roundedNote(3, MS_PER_STORED_SECOND)).toBe('Rounded to whole seconds: 3000 ms');
    });
});
