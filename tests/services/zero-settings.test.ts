import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareImport } from '../../src/services/import-preflight';
import {
    LEADER_PER_KEY_QSID, LEADER_TIMEOUT_QSID, QMK_SETTINGS, ZERO_REPLACED_SETTINGS,
    effectiveSetting, parseSettingInput, settingRange,
} from '../../src/constants/qmk-settings';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

const board = (overrides: Partial<KeyboardInfo> = {}): KeyboardInfo => ({
    rows: 1, cols: 2, layers: 1, keymap: [[4, 5]], svil_proto: 3,
    macros: [], macro_count: 0, macros_size: 64, combos: [], combo_count: 0,
    tapdances: [], tapdance_count: 0, key_overrides: [], key_override_count: 0,
    ...overrides,
});

// Combo term, Auto Shift timeout, tapping term, mouse key interval, leader timeout.
const ZERO_INVALID = [2, 4, 7, 10, 28];

describe('settings that cannot work at 0', () => {
    it('match the firmware defaults (sval_qmk_settings.c, QMK)', () => {
        expect(ZERO_REPLACED_SETTINGS).toEqual({ 2: 50, 4: 175, 7: 200, 10: 20, 28: 300 });
    });

    it('have a minimum above 0 in every settings field', () => {
        for (const qsid of ZERO_INVALID) expect(settingRange(qsid).min, `QSID ${qsid}`).toBeGreaterThan(0);
        expect(settingRange(7).min).toBe(50);
        expect(settingRange(28)).toEqual({ min: 50, max: 5000 });
    });

    it('keep 0 where it means something: one-shot timeout, Flow Tap, quick tap term, tap code delay', () => {
        for (const qsid of [6, 27, 25, 18]) {
            expect(settingRange(qsid).min, `QSID ${qsid}`).toBe(0);
            expect(effectiveSetting(qsid, 0)).toBe(0);
        }
    });

    it('show a stored 0 as the default the firmware uses instead', () => {
        expect(effectiveSetting(LEADER_TIMEOUT_QSID, 0)).toBe(300);
        expect(effectiveSetting(LEADER_TIMEOUT_QSID, 750)).toBe(750);
        expect(effectiveSetting(2, 0)).toBe(50);
        expect(effectiveSetting(LEADER_TIMEOUT_QSID, undefined)).toBeUndefined();
    });

    it('never turn an empty or unreadable entry into 0', () => {
        expect(parseSettingInput(LEADER_TIMEOUT_QSID, '', 300)).toBe(300);
        expect(parseSettingInput(LEADER_TIMEOUT_QSID, '  ', 450)).toBe(450);
        expect(parseSettingInput(LEADER_TIMEOUT_QSID, 'abc', 300)).toBe(300);
        expect(parseSettingInput(LEADER_TIMEOUT_QSID, '0', 300)).toBe(50);
        expect(parseSettingInput(LEADER_TIMEOUT_QSID, '99999', 300)).toBe(5000);
        expect(parseSettingInput(LEADER_TIMEOUT_QSID, '400', 300)).toBe(400);
        expect(parseSettingInput(2, '', 50)).toBe(50);
        expect(parseSettingInput(2, '0', 50)).toBe(10);
    });

    it('lists the leader settings in the Leader Key section', () => {
        const leader = QMK_SETTINGS.tabs.find(tab => tab.name === 'Leader Key')!;
        expect(leader.fields.map(field => field.qsid)).toEqual([LEADER_TIMEOUT_QSID, LEADER_PER_KEY_QSID]);
    });
});

describe('import of a layout with 0 in those settings', () => {
    const current = board({ settings: { 2: 50, 4: 175, 6: 5000, 7: 200, 10: 20, 27: 0, 28: 300, 29: 1 } });

    it('imports the default in place of each 0 and lists it in the replaced-settings note', () => {
        const review = prepareImport(board({ settings: { 2: 0, 4: 0, 6: 0, 7: 0, 10: 0, 27: 0, 28: 0, 29: 0 } }), current);
        expect(review.errors).toEqual([]);
        expect(review.keyboard.settings).toEqual({ 2: 50, 4: 175, 6: 0, 7: 200, 10: 20, 27: 0, 28: 300, 29: 0 });
        expect(review.replaced.map(r => r.from)).toEqual([
            'Time out period for combos: 0', 'Timeout: 0', 'Tapping Term: 0',
            'Time between cursor movements in milliseconds: 0', 'Leader timeout (ms): 0',
        ]);
        expect(review.replaced.find(r => r.from.startsWith('Leader'))).toEqual({ from: 'Leader timeout (ms): 0', to: '300', release: 'x4.3.2' });
    });

    it('keeps a leader timeout the user set', () => {
        const review = prepareImport(board({ settings: { 28: 1200, 29: 0 } }), current);
        expect(review.keyboard.settings?.[28]).toBe(1200);
        expect(review.replaced).toEqual([]);
    });

    it('repairs a board that reports 0 even when the file has no leader settings', () => {
        const review = prepareImport(board({ settings: {} }), board({ settings: { 28: 0, 29: 0 } }));
        expect(review.keyboard.settings?.[28]).toBe(300);
    });

    it('leaves out settings the board does not have', () => {
        const review = prepareImport(board({ settings: { 28: 0 } }), board({ settings: { 7: 200 } }));
        expect(review.keyboard.settings).toEqual({ 7: 200 });
        expect(review.replaced).toEqual([]);
    });
});

describe('default layouts', () => {
    const files = ['src/default-layouts/sval-default.svil', 'src/default-layouts/sval-alt-alphas.svil', 'src/default-layouts/sval-num-sym-layers.svil', 'public/old-sval-default.svil'];
    it.each(files)('%s has no 0 in a setting that cannot work at 0, and leader timing on', (file) => {
        const settings = JSON.parse(readFileSync(resolve(__dirname, '../..', file), 'utf8')).settings as Record<string, number>;
        for (const qsid of ZERO_INVALID) expect(settings[qsid], `QSID ${qsid}`).toBeGreaterThan(0);
        expect(settings[28]).toBe(300);
        expect(settings[29]).toBe(1);
    });
});
