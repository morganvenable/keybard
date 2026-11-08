import { describe, it, expect } from 'vitest';
import * as groups from '../../src/constants/special-key-groups';
import { isUnbuiltKeycode } from '../../src/constants/unbuilt-keycodes';
import { keyService } from '../../src/services/key.service';

const listed = Object.values(groups)
    .filter((v): v is groups.SpecialKeyDef[] => Array.isArray(v))
    .flat()
    .filter((k): k is groups.SpecialKeyDef => typeof k === 'object' && 'keycode' in k)
    .map(k => k.keycode);

describe('keys for features the firmware does not build', () => {
    it('are recognized by feature', () => {
        for (const c of ['AU_ON', 'CLICKY_UP', 'MU_TOG', 'HPT_ON', 'BL_STEP', 'RGB_MOD', 'RGB_SPD', 'RGB_M_K',
            'QK_MIDI_ON', 'MI_C', 'UC_NEXT', 'QK_UNICODE', 'QK_JOYSTICK_BUTTON_1', 'JS_0', 'QK_DIGITIZER_ON',
            'QK_PROGRAMMABLE_BUTTON_1', 'PB_1', 'DT_UP', 'QK_LOCK', 'SH_TOGG', 'DM_REC1', 'QK_LED_MATRIX_ON']) {
            expect(isUnbuiltKeycode(c), c).toBe(true);
        }
    });

    it('do not catch keys that work', () => {
        for (const c of ['RGB_TOG', 'RGB_VAI', 'RGB_HUD', 'RGB_SAI', 'RGB_M_P', 'KC_ASON', 'CMB_TOG', 'QK_GESC', 'SC_LSPO',
            'CL_SWAP', 'NK_TOGG', 'KO_TOGG', 'OS_TOGG', 'QK_LEADER', 'QK_LAYER_LOCK', 'KC_LANG1', 'STN_S1', 'KC_A']) {
            expect(isUnbuiltKeycode(c), c).toBe(false);
        }
    });

    it('are in no picker data list', () => {
        expect(listed.length).toBeGreaterThan(50);
        expect(listed.filter(isUnbuiltKeycode)).toEqual([]);
    });

    it('still show by name when a layout already holds one', () => {
        for (const c of ['AU_ON', 'HPT_ON', 'BL_TOGG', 'RGB_MOD', 'MU_ON']) {
            expect(keyService.define(c), c).toBeTruthy();
        }
    });
});
