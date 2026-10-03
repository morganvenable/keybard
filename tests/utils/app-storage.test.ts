import { beforeEach, describe, expect, it } from 'vitest';
import { scopedStorage } from '../../src/utils/app-storage';

describe('preview storage isolation', () => {
    beforeEach(() => localStorage.clear());

    it('does not read, overwrite, or delete production state', () => {
        const production = scopedStorage('', () => localStorage);
        const preview = scopedStorage('sval-preview', () => localStorage);
        production.setItem('keyboard-settings', 'production settings');
        expect(preview.getItem('keyboard-settings')).toBeNull();
        preview.setItem('keyboard-settings', 'preview settings');
        expect(production.getItem('keyboard-settings')).toBe('production settings');
        expect(preview.getItem('keyboard-settings')).toBe('preview settings');
        preview.removeItem('keyboard-settings');
        expect(production.getItem('keyboard-settings')).toBe('production settings');
        expect(preview.getItem('keyboard-settings')).toBeNull();
    });

    it('keeps production key names unchanged', () => {
        scopedStorage('', () => localStorage).setItem('existing-key', 'value');
        expect(localStorage.getItem('existing-key')).toBe('value');
    });
});
