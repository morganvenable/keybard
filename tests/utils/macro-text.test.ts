import { describe, expect, it } from 'vitest';
import { macroCharLabel, untypableMacroChars } from '@/utils/macro-text';

describe('untypableMacroChars', () => {
    it('accepts printable ASCII, tab and newline', () => {
        const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(0x20 + i)).join('');
        expect(untypableMacroChars(ascii + '\t\n')).toEqual([]);
    });
    it('lists each other character once, in order', () => {
        expect(untypableMacroChars('5µs “ok” µ é')).toEqual(['µ', '“', '”', 'é']);
        expect(untypableMacroChars('a😀b')).toEqual(['😀']);
        expect(untypableMacroChars('a\x01\x7f')).toEqual(['\x01', '\x7f']);
    });
    it('labels invisible characters by code point', () => {
        expect(macroCharLabel('µ')).toBe('µ');
        expect(macroCharLabel(' ')).toBe('U+00A0');
        expect(macroCharLabel('​')).toBe('U+200B');
        expect(macroCharLabel('\x7f')).toBe('U+007F');
    });
});
