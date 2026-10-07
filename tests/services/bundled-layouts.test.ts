import { describe, it, expect } from 'vitest';
import { isStaleBundledLayoutName } from '../../src/lib/bundled-layouts';

const bundled = ['sval-default', 'sval-alt-alphas'];

describe('isStaleBundledLayoutName', () => {
    it('flags copies named after a hashed asset file', () => {
        expect(isStaleBundledLayoutName('sval-default-D8aVmiae', bundled)).toBe(true);
        expect(isStaleBundledLayoutName('sval-alt-alphas-BstVxib6', bundled)).toBe(true);
    });

    it('flags copies named after a data: URL', () => {
        expect(isStaleBundledLayoutName('data:application/octet-stream;base64,eyJ', bundled)).toBe(true);
    });

    it('keeps current bundled names and user layouts', () => {
        expect(isStaleBundledLayoutName('sval-default', bundled)).toBe(false);
        expect(isStaleBundledLayoutName('sval-default-mine', bundled)).toBe(false);
        expect(isStaleBundledLayoutName('sval-default-my-colemak', bundled)).toBe(false);
        expect(isStaleBundledLayoutName('my-layout-AbC123xy', bundled)).toBe(false);
    });
});
