import { describe, expect, it } from 'vitest';
import { fileService } from '../../src/services/file.service';
import { prepareImport } from '../../src/services/import-preflight';
import { keyService } from '../../src/services/key.service';
import { ComboOptions, type KeyboardInfo } from '../../src/types/keyboard.types';

// Moving from Svalboard's Vial firmware goes through its .vil files, which store
// keycodes by name. Custom keys are the exception: Vial names them by position.

const SVALBOARD_VIAL_UID = '5199957870438586395';

function vil(uid: string, overrides: Record<string, unknown> = {}): string {
    const blank = () => [Array(2).fill('KC_NO')];
    const body = JSON.stringify({
        version: 1, vial_protocol: 6, via_protocol: 9, layout_options: -1,
        uid: '__UID__',
        layout: [[['KC_A', 'USER03']], [['QK_STENO_BOLT', 'USER25']]],
        tap_dance: [['KC_A', 'USER00', 'KC_NO', 'KC_NO', 180], ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 200]],
        combo: [['KC_A', 'KC_B', 'KC_NO', 'KC_NO', 'USER08'], ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO']],
        key_override: [{ trigger: 'KC_BSPC', replacement: 'KC_DEL', layers: 65535, trigger_mods: 2, negative_mod_mask: 0, suppressed_mods: 2, options: 135 }],
        macro: [[['text', 'hi'], ['tap', 'USER17', 'KC_ENTER'], ['delay', 50]], []],
        encoder_layout: blank(),
        settings: { '2': 50, '7': 190, '21': 3 },
        ...overrides,
    });
    return body.replace('"__UID__"', uid);
}

const board = {
    rows: 1, cols: 2, layers: 2, keymap: [[0, 0], [0, 0]], svil_proto: 3, keycode_version: '0.0.9',
    kbid: '4829f621f27d181b', macro_count: 256, combo_count: 256, tapdance_count: 256, key_override_count: 256,
    macros_size: 4096, macros: [], combos: [], tapdances: [], key_overrides: [],
    settings: { 2: 30, 7: 200, 21: 0 },
} as unknown as KeyboardInfo;

describe('importing a Svalboard Vial layout', () => {
    it('names custom keys by what they were in Vial', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID));
        expect(keyService.stringify(kb.keymap![0][1])).toBe('SV_RIGHT_DPI_DEC');
        expect(kb.keymap![0][1]).toBe(0x7E43); // QK_USER_3 on Svalboard QMK
        expect(kb.tapdances![0]).toMatchObject({ tap: 'KC_A', hold: 'SV_LEFT_DPI_INC', tapping_term: 180, enabled: true });
        expect(kb.combos![0]).toMatchObject({ keys: ['KC_A', 'KC_B', 'KC_NO', 'KC_NO'], output: 'SV_CAPS_WORD' });
        expect(kb.macros![0].actions).toEqual([['text', 'hi'], ['tap', 'SV_OUTPUT_STATUS'], ['tap', 'KC_ENTER'], ['delay', 50]]);
    });

    it('turns on every tap dance, and only the combos that are used', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID));
        expect(kb.tapdances!.map(td => td.enabled)).toEqual([true, true]);
        expect(kb.combos!.map(combo => combo.options)).toEqual([ComboOptions.ENABLED, 0]);
        expect(kb.key_overrides![0]).toMatchObject({ trigger: 'KC_BSPC', replacement: 'KC_DEL', options: 135 });
    });

    it('numbers renamed keycodes the way the board does', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID));
        expect(kb.keymap![1][0]).toBe(0x751C); // QK_STENO_MODE_BOLT in QMK 0.0.9
    });

    it('clears custom keys Vial left unassigned, and says so', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID));
        expect(kb.keymap![1][1]).toBe(0);
        const review = prepareImport(kb, board);
        expect(review.errors).toEqual([]);
        expect(review.warnings.join(' ')).toMatch(/1 key uses a custom keycode that Svalboard's Vial firmware left unassigned/);
        expect(review.warnings.join(' ')).toMatch(/do not include pointing and hardware settings/);
    });

    it('applies the layout, behaviors and QMK settings', () => {
        const review = prepareImport(fileService.parseContent(vil(SVALBOARD_VIAL_UID)), board);
        expect(review.keyboard.keymap![0]).toEqual([0x0004, 0x7E43]);
        expect(review.keyboard.settings).toEqual({ 2: 50, 7: 190, 21: 3 });
        expect(review.keyboard.combos![0].output).toBe('SV_CAPS_WORD');
    });

    it('recognizes Svalboard files whose UID a tool rounded', () => {
        const kb = fileService.parseContent(vil('5199957870438586000'));
        expect(kb.vial_import?.svalboard).toBe(true);
        expect(kb.kbid).toBe('4829f621f27d181b');
        expect(prepareImport(kb, board).warnings.join(' ')).not.toMatch(/different keyboard/);
    });

    it("refuses another keyboard's custom keys rather than guessing", () => {
        const kb = fileService.parseContent(vil('1234567890123456789', { layout: [[['KC_A', 'USER03']], [['KC_B', 'KC_C']]] }));
        expect(kb.vial_import?.svalboard).toBe(false);
        expect(prepareImport(kb, board).errors.join(' ')).toMatch(/custom keys? \(USER00…\) from another keyboard/);
    });
});

// A Svalboard Vial layout with every table Vial saves, built to check what reaches Svalboard QMK.
const fullBoard = {
    ...board, alt_repeat_key_count: 256, alt_repeat_keys: [],
    // A fresh Svalboard QMK board: Permissive Hold and Chordal Hold on, which Vial had off.
    settings: Object.fromEntries(Array.from({ length: 29 }, (_, i) => [i + 1, i + 1 === 22 || i + 1 === 26 ? 1 : 0])),
} as unknown as KeyboardInfo;

const VIAL_SETTINGS: Record<string, number> = {
    '1': 0, '2': 50, '3': 1, '4': 175, '5': 5, '6': 5000, '7': 200, '9': 30, '10': 20, '11': 8, '12': 15, '13': 40,
    '14': 10, '15': 80, '16': 8, '17': 40, '18': 0, '19': 80, '20': 5, '21': 128, '22': 0, '23': 1, '24': 1, '25': 120, '26': 0, '27': 0,
};

describe('a Vial layout keeps its behavior on Svalboard QMK', () => {
    it('translates Svalboard keys in overrides and Alt Repeat entries too', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID, {
            key_override: [{ trigger: 'USER12', replacement: 'USER16', layers: 65535, trigger_mods: 0, negative_mod_mask: 0, suppressed_mods: 0, options: 135 }],
            alt_repeat_key: [{ keycode: 'USER13', alt_keycode: 'USER14', allowed_mods: 0, options: 8 }],
        }));
        expect(kb.key_overrides![0]).toMatchObject({ trigger: 'SV_SNIPER_2', replacement: 'SV_SCROLL_TOGGLE' });
        expect(keyService.parse('SV_SNIPER_2')).toBe(0x7E4C); // QK_USER_12 on Svalboard QMK
        expect(keyService.parse('SV_SCROLL_TOGGLE')).toBe(0x7E50); // QK_USER_16
        expect(kb.alt_repeat_keys![0]).toMatchObject({ keycode: 'SV_SNIPER_3', alt_keycode: 'SV_SNIPER_5' });
    });

    it('carries Alt Repeat entries over with their option bits', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID, {
            alt_repeat_key: [
                // Enabled (bit 3), bidirectional (bit 1), ignore mod handedness (bit 2), Shift allowed.
                { keycode: 'KC_A', alt_keycode: 'KC_O', allowed_mods: 2, options: 0b1110 },
                // Saved but turned off in Vial.
                { keycode: 'KC_B', alt_keycode: 'KC_N', allowed_mods: 0, options: 0b0001 },
                { keycode: 'KC_NO', alt_keycode: 'KC_NO', allowed_mods: 0, options: 0 },
            ],
        }));
        expect(kb.alt_repeat_key_count).toBe(3);
        expect(kb.alt_repeat_keys).toEqual([
            { arkid: 0, enabled: true, keycode: 'KC_A', alt_keycode: 'KC_O', allowed_mods: 2, options: 0b1110 },
            { arkid: 1, enabled: false, keycode: 'KC_B', alt_keycode: 'KC_N', allowed_mods: 0, options: 0b0001 },
            { arkid: 2, enabled: false, keycode: 'KC_NO', alt_keycode: 'KC_NO', allowed_mods: 0, options: 0 },
        ]);
        const review = prepareImport(kb, fullBoard);
        expect(review.errors).toEqual([]);
        expect(review.keyboard.alt_repeat_keys![0]).toMatchObject({ keycode: 'KC_A', alt_keycode: 'KC_O', allowed_mods: 2, options: 0b1110 });
    });

    it('carries every Vial QMK setting to the same setting ID', () => {
        const review = prepareImport(fileService.parseContent(vil(SVALBOARD_VIAL_UID, { settings: VIAL_SETTINGS })), fullBoard);
        expect(review.errors).toEqual([]);
        expect(review.unavailable).toEqual([]);
        for (const [id, value] of Object.entries(VIAL_SETTINGS)) expect(review.keyboard.settings![Number(id)]).toBe(value);
        // Vial had Permissive Hold and Chordal Hold off; the board's new defaults give way.
        expect(review.keyboard.settings![22]).toBe(0);
        expect(review.keyboard.settings![26]).toBe(0);
    });

    it('keeps combo and override enabled and option bits', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID, {
            combo: [['KC_J', 'KC_K', 'KC_NO', 'KC_NO', 'KC_ESC'], ['KC_NO', 'KC_J', 'KC_NO', 'KC_NO', 'KC_TAB']],
            key_override: [
                { trigger: 'KC_BSPC', replacement: 'KC_DEL', layers: 3, trigger_mods: 2, negative_mod_mask: 1, suppressed_mods: 2, options: 0b10111001 },
                { trigger: 'KC_A', replacement: 'KC_B', layers: 65535, trigger_mods: 0, negative_mod_mask: 0, suppressed_mods: 0, options: 0b00000111 },
            ],
        }));
        // Vial ran a combo only when its first key was set, always on the global combo term (0).
        expect(kb.combos!.map(combo => combo.options)).toEqual([ComboOptions.ENABLED, 0]);
        // Bit 7 is enabled and bits 0-5 are QMK's options in both firmwares.
        expect(kb.key_overrides!.map(ko => ko.options)).toEqual([0b10111001, 0b00000111]);
        expect(kb.key_overrides![0]).toMatchObject({ layers: 3, trigger_mods: 2, negative_mod_mask: 1, suppressed_mods: 2 });
    });
});

describe('a Vial tap dance with a 0 ms term', () => {
    const TD = (n: number) => keyService.parse(`TD(${n})`);
    const dances = {
        layout: [[['TD(0)', 'TD(1)']], [['TD(2)', 'TD(3)']]],
        tap_dance: [
            ['KC_A', 'KC_LCTL', 'KC_B', 'KC_NO', 0],     // always Ctrl held
            ['KC_ESC', 'KC_NO', 'KC_NO', 'KC_NO', 0],    // no Hold: always Esc held
            ['KC_NO', 'KC_NO', 'KC_C', 'KC_D', 0],       // no Tap or Hold: did nothing
            ['KC_E', 'KC_LSFT', 'KC_NO', 'KC_NO', 180],  // an ordinary dance
            ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 0],     // an unused slot
        ],
        combo: [['KC_J', 'KC_K', 'KC_NO', 'KC_NO', 'TD(0)']],
        macro: [[['tap', 'TD(1)', 'TD(3)']]],
    };

    it('becomes the key Vial always sent, wherever the dance was used', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID, dances));
        expect(kb.keymap![0]).toEqual([keyService.parse('KC_LCTL'), keyService.parse('KC_ESC')]);
        expect(kb.keymap![1]).toEqual([TD(2), TD(3)]);
        expect(kb.combos![0].output).toBe('KC_LCTL');
        expect(kb.macros![0].actions).toEqual([['tap', 'KC_ESC'], ['tap', 'TD(3)']]);
        expect(kb.vial_import?.hold_only_tapdances).toEqual([
            { index: 0, term: 0, keycode: 'KC_LCTL' },
            { index: 1, term: 0, keycode: 'KC_ESC' },
        ]);
        expect(kb.vial_import?.inert_tapdances).toEqual([{ index: 2, term: 0 }]);
        // The dances stay in the table, with a term the board can use.
        expect(kb.tapdances![0]).toMatchObject({ tap: 'KC_A', hold: 'KC_LCTL', doubletap: 'KC_B', tapping_term: 200, enabled: true });
        expect(kb.tapdances![3].tapping_term).toBe(180);
    });

    it('says what changed, and flags a dance that did nothing', () => {
        const review = prepareImport(fileService.parseContent(vil(SVALBOARD_VIAL_UID, dances)), fullBoard);
        expect(review.errors).toEqual([]);
        const text = review.warnings.join('\n');
        expect(text).toMatch(/Tap dance 0 had a 0 ms term in Vial, so it always acted as KC_LCTL held down\..*keys that used TD\(0\) are set to KC_LCTL/);
        expect(text).toMatch(/Tap dance 1 had a 0 ms term .* KC_ESC/);
        expect(text).toMatch(/Tap dance 2 had a 0 ms term in Vial and no Tap or Hold key, so it did nothing there/);
        expect(text).not.toMatch(/Tap dance [34] /);
        expect(review.keyboard.keymap![0]).toEqual([keyService.parse('KC_LCTL'), keyService.parse('KC_ESC')]);
    });

    it('treats any term too short to tap the same way', () => {
        const kb = fileService.parseContent(vil(SVALBOARD_VIAL_UID, { ...dances, tap_dance: [['KC_A', 'KC_LALT', 'KC_NO', 'KC_NO', 10]] }));
        expect(kb.keymap![0][0]).toBe(keyService.parse('KC_LALT'));
        expect(kb.vial_import?.hold_only_tapdances).toEqual([{ index: 0, term: 10, keycode: 'KC_LALT' }]);
    });
});
