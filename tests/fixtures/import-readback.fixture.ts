/**
 * A synthetic Svalboard layout for import read-back tests, built from the bundled
 * default layout. Two versions differ in exactly three entries, the way a fresh
 * backup and an older export of the same board can:
 *
 *   entry                     newer                     older
 *   tap dance 0 tap / hold    LCTL(KC_C) / LCTL(KC_C)   KC_DQUO / KC_SPACE
 *   combo 0 keys (in order)   KC_F + KC_D               KC_D + KC_F
 *   custom value right DPI    3                         1
 *
 * Both carry pointing tool keys (QK_KB block), and
 * list their custom values with the channel / value id Keybard's export writes,
 * where layer colors and pointing values both claim channel 0, ids from 0: the
 * import must map each value by its key through the board's menus, not by those numbers.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Tests run from the repository root (vitest and Playwright both).
export const DEFAULT_LAYOUT = resolve(process.cwd(), 'src/default-layouts/sval-default.svil');

/** The board's VIA3 menus for the values these layouts hold (as the Svalboard definition lays them out). */
export const READBACK_MENUS = [
    {
        label: 'Pointing Device',
        content: [
            { label: 'Left Pointer', content: [
                { label: 'DPI', type: 'dropdown', options: ['200', '400', '600', '800', '1200', '1600', '2400', '3200', '4800', '6400', '12000'], content: ['id_left_dpi', 0, 0] },
                { label: 'Scroll Mode', type: 'toggle', content: ['id_left_scroll', 0, 1] },
            ] },
            { label: 'Right Pointer', content: [
                { label: 'DPI', type: 'dropdown', options: ['200', '400', '600', '800', '1200', '1600', '2400', '3200', '4800', '6400', '12000'], content: ['id_right_dpi', 0, 2] },
                { label: 'Scroll Mode', type: 'toggle', content: ['id_right_scroll', 0, 3] },
            ] },
        ],
    },
    {
        label: 'Layer Colors',
        content: Array.from({ length: 16 }, (_, layer) => ({ label: `Layer ${layer}`, type: 'color', content: [`id_layer${layer}_color`, 0, 32 + layer] })),
    },
];

export type Version = 'newer' | 'older';

export const VALUES = {
    newer: { td0: ['LCTL(KC_C)', 'LCTL(KC_C)'], combo0: ['KC_F', 'KC_D'], rightDpi: 3 },
    older: { td0: ['KC_DQUO', 'KC_SPACE'], combo0: ['KC_D', 'KC_F'], rightDpi: 1 },
} as const;

/** Raw bytes the board must hold for each version's three entries. */
export const RAW = {
    newer: { td0: [0x06, 0x01, 0x06, 0x01, 0, 0, 0, 0, 0xc8, 0x80], combo0: [0x09, 0, 0x07, 0, 0, 0, 0, 0, 0x46, 0, 0, 0x80], rightDpi: [3] },
    older: { td0: [0x34, 0x02, 0x2c, 0x00, 0, 0, 0, 0, 0xc8, 0x80], combo0: [0x07, 0, 0x09, 0, 0, 0, 0, 0, 0x46, 0, 0, 0x80], rightDpi: [1] },
};

/** Layer 14 keys bound to pointing tool keycodes (QK_KB 0x7E00 on). */
export const POINT_KEYS: Array<[row: number, col: number, name: string]> = [
    [1, 3, 'SV_POINT_TOOL1_HOLD'], [1, 0, 'SV_POINT_TOOL1_TOGGLE'], [2, 2, 'SV_POINT_TOOL2_HOLD'], [0, 3, 'SV_POINT_STOP_ALL'],
];

/** The layout file text for one version. */
export function readbackLayout(version: Version): string {
    const svil = JSON.parse(readFileSync(DEFAULT_LAYOUT, 'utf-8'));
    const v = VALUES[version];
    svil.svil_protocol = 3;
    svil.tap_dance[0] = { on: true, on_tap: v.td0[0], on_hold: v.td0[1], on_double_tap: 'KC_NO', on_tap_hold: 'KC_NO', tapping_term: 200 };
    svil.tap_dance[1] = { on: true, on_tap: 'KC_R', on_hold: 'KC_U', on_double_tap: 'KC_NO', on_tap_hold: 'KC_NO', tapping_term: 300 };
    svil.tap_dance[2] = { on: true, on_tap: 'KC_G', on_hold: 'KC_DOWN', on_double_tap: 'KC_NO', on_tap_hold: 'KC_NO', tapping_term: 200 };
    svil.combo[0] = { on: true, keys: [...v.combo0, 'KC_NO', 'KC_NO'], output: 'KC_PSCREEN', combo_term: 0 };
    svil.combo[1] = { on: true, keys: ['KC_J', 'KC_K', 'KC_NO', 'KC_NO'], output: 'KC_F2', combo_term: 0 };
    for (const [row, col, name] of POINT_KEYS) svil.layout[14][row][col] = name;
    const colors = svil.custom_values.filter((c: { key: string }) => /^id_layer\d+_color$/.test(c.key));
    svil.custom_values = [
        ...colors,
        { key: 'id_left_dpi', channel: 0, valueId: 0, data: [4] },
        { key: 'id_left_scroll', channel: 0, valueId: 1, data: [1] },
        { key: 'id_right_dpi', channel: 0, valueId: 2, data: [v.rightDpi] },
        { key: 'id_right_scroll', channel: 0, valueId: 3, data: [0] },
    ];
    svil.menus = READBACK_MENUS;
    return JSON.stringify(svil, null, 1);
}
