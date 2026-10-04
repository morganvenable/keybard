import { describe, it, expect, vi } from 'vitest';
import { prepareImport } from '../../src/services/import-preflight';
import { fileService } from '../../src/services/file.service';
import { usbInstance } from '../../src/services/usb.service';
import type { KeyboardInfo } from '../../src/types/vial.types';

const board = (overrides: Partial<KeyboardInfo> = {}): KeyboardInfo => ({
    rows: 1, cols: 2, layers: 2, keymap: [[4, 5], [6, 7]], svil_proto: 3,
    macros: [{ mid: 0, actions: [] }], macro_count: 1, macros_size: 64,
    combos: [], combo_count: 0, tapdances: [], tapdance_count: 0,
    key_overrides: [], key_override_count: 0, cosmetic: { layer: { '0': 'Base', '1': 'Old' } },
    ...overrides,
});

describe('import preflight', () => {
    it('is read-only and preserves unimported layers while clearing explicitly blank labels', () => {
        const send = vi.spyOn(usbInstance, 'sendSvil');
        const current = board();
        const original = structuredClone(current);
        const review = prepareImport(board({ layers: 1, keymap: [[8, 9]], cosmetic: { layer: {} } }), current);
        expect(review.errors).toEqual([]);
        expect(review.keyboard.keymap).toEqual([[8, 9], [6, 7]]);
        expect(review.keyboard.cosmetic?.layer).toEqual({ '0': '', '1': 'Old' });
        expect(current).toEqual(original);
        expect(send).not.toHaveBeenCalled();
        send.mockRestore();
    });
    it('blocks matrix, layer, and table capacity mismatches', () => {
        const review = prepareImport(board({ cols: 3, layers: 3, macro_count: 2, macros: [{ mid: 0, actions: [] }, { mid: 1, actions: [] }] }), board());
        expect(review.errors.join(' ')).toMatch(/Matrix mismatch/);
        expect(review.errors.join(' ')).toMatch(/3 layers/);
        expect(review.errors.join(' ')).toMatch(/macros.*2 entries/);
    });
    it('blocks oversized and unrepresentable macros before any writes', () => {
        const review = prepareImport(board({ macros: [{ mid: 0, actions: [['text', 'é'.repeat(100)]] }] }), board());
        expect(review.errors.join(' ')).toMatch(/non-ASCII/);
        expect(review.errors.join(' ')).toMatch(/macro buffer/);
    });
    it('reports unsupported settings and preserves the connected hardware definition', () => {
        const current = board({ settings: { 1: 4 }, name: 'Actual board' });
        const review = prepareImport(board({ settings: { 1: 5, 99: 9 }, custom_values: [{ key: 'unknown', channel: 1, valueId: 1, data: [1] }], name: 'File board' }), current);
        expect(review.keyboard.settings).toEqual({ 1: 5 });
        expect(review.keyboard.name).toBe('Actual board');
        expect(review.warnings.join(' ')).toMatch(/99.*skipped/);
        expect(review.warnings.join(' ')).toMatch(/unknown.*skipped/);
    });
    it('recognizes Vial version 1 without silently treating it as Sval', () => {
        const legacy = fileService.parseContent(JSON.stringify({ uid: 123, version: 1, vial_protocol: 6, layout: [[['KC_A', 'KC_B']]], macro: [], tap_dance: [[4,5,6,7,250]] }));
        expect(legacy.rows).toBe(1);
        expect(legacy.cols).toBe(2);
        expect(legacy.tapdances?.[0].tapping_term).toBe(250);
        expect(prepareImport(legacy, board()).errors.join(' ')).toMatch(/keycode migration/);
    });
    it('rejects malformed matrices and raw kbi snapshots with useful errors', () => {
        expect(() => fileService.parseContent(JSON.stringify({ uid: 1, layout: [[['KC_A']], [['KC_A', 'KC_B']]] }))).toThrow(/rectangular/);
        expect(() => fileService.parseContent(JSON.stringify({ rows: 1, cols: 1, keymap: [[4]] }))).toThrow(/kbi/);
    });
});
