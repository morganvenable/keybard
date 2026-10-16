// Svalboard QMK's custom keys (SV_*) live at QK_USER, 0x7E40 + their position in the
// firmware's customKeycodes. The pointing tools own QK_KB, 0x7E00-0x7E3F. The two
// blocks never overlap, and Keybard must never name a QK_KB code as an SV_ key.
import { describe, expect, it } from 'vitest';
import { POINT_CONTROL_FLAG, POINT_DEFAULTS, POINT_BLOCK_FIRST, POINT_BLOCK_LAST, upgradePointControls } from '@/constants/point-controls';
import { fileService } from '@/services/file.service';
import { keyService } from '@/services/key.service';
import type { KeyboardInfo } from '@/types/keyboard.types';

// keyboards/svalboard/keymaps/sval/sval.json customKeycodes, in order (keymap_support.h enum from QK_USER_0).
const FIRMWARE_CUSTOM = [
    'SV_LEFT_DPI_INC', 'SV_LEFT_DPI_DEC', 'SV_RIGHT_DPI_INC', 'SV_RIGHT_DPI_DEC',
    'SV_LEFT_SCROLL_TOGGLE', 'SV_RIGHT_SCROLL_TOGGLE', 'SV_RECALIBRATE_POINTER', 'SV_MH_CHANGE_TIMEOUTS',
    'SV_CAPS_WORD', 'SV_AXIS_SCROLL_LOCK', 'SV_TOGGLE_23_67', 'SV_TOGGLE_45_67',
    'SV_SNIPER_2', 'SV_SNIPER_3', 'SV_SNIPER_5', 'SV_SCROLL_HOLD', 'SV_SCROLL_TOGGLE', 'SV_OUTPUT_STATUS',
    'SV_TOGGLE_AUTOMOUSE', 'SV_TURBO_SCAN', 'SV_NATURAL_SCROLL_TOGGLE',
    'SV_SNIPER_2_TG', 'SV_SNIPER_3_TG', 'SV_SNIPER_5_TG',
    'SV_BOOST_2', 'SV_BOOST_3', 'SV_BOOST_5', 'SV_BOOST_2_TG', 'SV_BOOST_3_TG', 'SV_BOOST_5_TG',
];
const custom_keycodes = FIRMWARE_CUSTOM.map(name => ({ name, shortName: name, title: name }));

const board = (keymap: number[], tools: boolean) => ({
    rows: 1, cols: keymap.length, layers: 1, keymap: [keymap], svil_proto: 3, kbid: '01', custom_keycodes,
    feature_flags2: tools ? POINT_CONTROL_FLAG : 0,
    pointing_controls: tools ? upgradePointControls({ version: 1, profiles: structuredClone(POINT_DEFAULTS) }, 5) : undefined,
    macros: [], combos: [], tapdances: [], key_overrides: [], alt_repeat_keys: [], leaders: [],
} as KeyboardInfo);

// Layer 14 of a daily-driver backup (tools firmware): tool keys, DPI keys and Output Status side by side.
const LAYER14 = [0x7e10, 0x7e01, 0x7e51, 0x7e00, 0x7e43, 0x7e03, 0x7e02, 0x7e42, 0x7e41, 0x7e05, 0x7e04, 0x7e40, 0x7e07, 0x7e06];

describe.each([true, false])('SV_ custom keys with the pointing tools flag %s', (tools) => {
    it('parse and print at QK_USER, 0x7E40 + position', () => {
        keyService.generateAllKeycodes(board([0], tools));
        FIRMWARE_CUSTOM.forEach((name, i) => {
            expect(keyService.parse(name), name).toBe(0x7e40 + i);
            expect(keyService.stringify(0x7e40 + i)).toBe(name);
        });
        expect(keyService.parse('SV_SCROLL_HOLD')).toBe(0x7e4f);
        expect(keyService.parse('SV_SCROLL_TOGGLE')).toBe(0x7e50);
    });
    it('never name a QK_KB code (the pointing tools block) as an SV_ custom key', () => {
        keyService.generateAllKeycodes(board([0], tools));
        for (let code = POINT_BLOCK_FIRST; code <= POINT_BLOCK_LAST; code++) {
            const name = keyService.stringify(code);
            expect(FIRMWARE_CUSTOM, `0x${code.toString(16)} -> ${name}`).not.toContain(name);
        }
    });
    it('keep every raw code through a .svil export and import', () => {
        const kb = board(LAYER14, tools);
        keyService.generateAllKeycodes(kb);
        const svil = fileService.kbinfoToSvil(kb);
        expect(fileService.parseContent(svil).keymap![0]).toEqual(LAYER14);
    });
});

describe('pointing tools keys beside SV_ keys', () => {
    it('name tool keys and SV_ keys apart on a board with the tools flag', () => {
        const kb = board(LAYER14, true);
        keyService.generateAllKeycodes(kb);
        const names = JSON.parse(fileService.kbinfoToSvil(kb)).layout[0][0];
        expect(names).toEqual([
            'SV_POINT_STOP_ALL', 'SV_POINT_TOOL1_TOGGLE', 'SV_OUTPUT_STATUS', 'SV_POINT_TOOL1_HOLD',
            'SV_RIGHT_DPI_DEC', 'SV_POINT_TOOL2_TOGGLE', 'SV_POINT_TOOL2_HOLD', 'SV_RIGHT_DPI_INC',
            'SV_LEFT_DPI_DEC', 'SV_POINT_TOOL3_TOGGLE', 'SV_POINT_TOOL3_HOLD', 'SV_LEFT_DPI_INC',
            'SV_POINT_TOOL4_TOGGLE', 'SV_POINT_TOOL4_HOLD',
        ]);
    });
});
