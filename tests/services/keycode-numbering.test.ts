import { afterEach, describe, expect, it } from 'vitest';
import { keyService } from '../../src/services/key.service';
import { CODEMAP } from '../../src/constants/keygen';
import {
    KEYCODE_NUMBERINGS, LATEST_KEYCODE_VERSION, activeKeycodeVersion, applyKeycodeNumbering,
} from '../../src/constants/keycode-numbering';
import { fileService } from '../../src/services/file.service';
import { prepareImport } from '../../src/services/import-preflight';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

// Keybard must number keycodes exactly as the board's QMK keycode version does.
// The numbering files are generated from QMK's data by scripts/qmk-keycodes.py.

afterEach(() => { applyKeycodeNumbering(LATEST_KEYCODE_VERSION); });

describe.each(Object.keys(KEYCODE_NUMBERINGS))('QMK keycode numbering %s', (version) => {
    const spec = KEYCODE_NUMBERINGS[version];

    it('gives every QMK keycode name and alias QMK\'s number', () => {
        expect(applyKeycodeNumbering(version)).toBe(true);
        const wrong = Object.entries(spec.keycodes).flatMap(([hex, names]) =>
            names.filter(name => keyService.parse(name) !== parseInt(hex, 16))
                .map(name => `${name}: ${keyService.parse(name)} != ${hex}`));
        expect(wrong).toEqual([]);
    });

    it('names every QMK keycode with a name that means that keycode', () => {
        applyKeycodeNumbering(version);
        const wrong = Object.keys(spec.keycodes).map(hex => parseInt(hex, 16))
            .filter(code => keyService.parse(keyService.stringify(code)) !== code);
        expect(wrong).toEqual([]);
    });

    it('composes ranges on the bases Keybard encodes', () => {
        // Keybard composes mod-taps, layer keys, tap dances... itself. A QMK
        // version that moves a range needs Keybard changes before it is added.
        expect(spec.ranges).toEqual(KEYCODE_NUMBERINGS['0.0.9'].ranges);
    });
});

describe('keycode numbering', () => {
    it('round-trips every keycode through its name', () => {
        const wrong: number[] = [];
        for (let code = 0; code <= 0xFFFF; code++) {
            if (keyService.parse(keyService.stringify(code)) !== code) wrong.push(code);
        }
        expect(wrong).toEqual([]);
    });

    it('numbers the keycodes QMK moved the way the board does', () => {
        expect(keyService.parse('QK_STENO_BOLT')).toBe(0x751C);
        expect(keyService.parse('QK_STENO_GEMINI')).toBe(0x751D);
        expect(keyService.parse('STN_TKL')).toBe(0x750C);
        expect(keyService.parse('QK_OUTPUT_AUTO')).toBe(0x7780);
        expect(keyService.parse('QK_OUTPUT_BLUETOOTH')).toBe(0x7786);
        expect(keyService.stringify(0x74F0)).toBe('QK_STENO_X7');
        expect(0x7C20 in CODEMAP).toBe(false);
    });

    it('keeps the catalog names and composed keycodes it already had', () => {
        expect(keyService.parse('KC_A')).toBe(0x0004);
        expect(keyService.stringify(0x002A)).toBe('KC_BSPACE');
        expect(keyService.parse('LCTL(KC_A)')).toBe(0x0104);
        expect(keyService.parse('LSFT_T(KC_A)')).toBe(0x2204);
        expect(keyService.parse('LT1(KC_A)')).toBe(0x4104);
        expect(keyService.parse('MO(1)')).toBe(0x5221);
        expect(keyService.parse('TD(1)')).toBe(0x5701);
    });

    it('changes nothing for a numbering it does not have', () => {
        expect(applyKeycodeNumbering('9.9.9')).toBe(false);
        expect(activeKeycodeVersion()).toBe(LATEST_KEYCODE_VERSION);
        expect(keyService.parse('QK_STENO_BOLT')).toBe(0x751C);
    });
});

describe('layout files and keycode numbering', () => {
    const board = { rows: 1, cols: 2, layers: 1, keymap: [[0, 0]], keycode_version: '0.0.9' } as unknown as KeyboardInfo;
    const svil = (extra: object) => JSON.stringify({ version: 1, uid: 1, svil_protocol: 3, layout: [[['KC_A', '0x7c20']]], ...extra });

    it('records the numbering in .svil exports', () => {
        const exported = JSON.parse(fileService.kbinfoToSvil({ ...board, keymap: [[4, 0x5221]] } as KeyboardInfo));
        expect(exported.keycode_version).toBe('0.0.9');
        expect(exported.layout).toEqual([[['KC_A', 'MO(1)']]]);
    });

    it('warns about keycodes stored as numbers in another or unrecorded numbering', () => {
        const unrecorded = fileService.parseContent(svil({}));
        expect(unrecorded.raw_keycode_count).toBe(1);
        expect(prepareImport(unrecorded, board).warnings.join(' ')).toMatch(/1 keycode is stored as a number.*unrecorded keycode numbering.*0\.0\.9/);
        const other = fileService.parseContent(svil({ keycode_version: '0.0.8' }));
        expect(prepareImport(other, board).warnings.join(' ')).toMatch(/QMK keycode numbering 0\.0\.8/);
        const same = fileService.parseContent(svil({ keycode_version: '0.0.9' }));
        expect(prepareImport(same, board).warnings.join(' ')).not.toMatch(/stored as a number/);
    });
});
