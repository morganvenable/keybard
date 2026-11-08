import { describe, it, expect } from 'vitest';
import { resolveAnyKey } from '../../src/lib/anyKey';

describe('resolveAnyKey', () => {
    it('is empty for blank input', () => {
        expect(resolveAnyKey('  ').status).toBe('empty');
    });

    it('resolves names, expressions, hex and decimal', () => {
        expect(resolveAnyKey('KC_A')).toMatchObject({ status: 'known', code: 0x0004, name: 'KC_A' });
        expect(resolveAnyKey('LCTL(KC_A)')).toMatchObject({ status: 'known', code: 0x0104 });
        expect(resolveAnyKey('MO(3)')).toMatchObject({ status: 'known', code: 0x5223 });
        expect(resolveAnyKey('0x0004')).toMatchObject({ status: 'known', code: 4 });
        expect(resolveAnyKey('4')).toMatchObject({ status: 'known', code: 4 });
    });

    it('accepts lowercase names', () => {
        expect(resolveAnyKey('lctl(kc_a)')).toMatchObject({ status: 'known', code: 0x0104 });
    });

    it('rejects NaN and anything over 16 bits', () => {
        expect(resolveAnyKey('banana').status).toBe('invalid');
        expect(resolveAnyKey('0x10000').status).toBe('invalid');
        expect(resolveAnyKey('65536').status).toBe('invalid');
        expect(resolveAnyKey('0xFFFF').status).not.toBe('invalid');
    });

    it('warns on a number Keybard has no name for', () => {
        const r = resolveAnyKey('0x9999');
        expect(r).toMatchObject({ status: 'unknown', code: 0x9999 });
        expect(r.status === 'unknown' && r.message).toContain('0x9999');
    });
});
