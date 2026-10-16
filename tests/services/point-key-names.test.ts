import { describe, expect, it } from 'vitest';
import { POINT_CONTROL_FLAG, POINT_DEFAULTS, POINT_KEYS, PICKER_POINT_KEYS, POINT_KEY_ALIASES, configuredPointKey, pointDevice, pointKey, upgradePointControls } from '@/constants/point-controls';
import { fileService } from '@/services/file.service';
import { keyService } from '@/services/key.service';
import { getKeyContents } from '@/utils/keys';
import type { KeyboardInfo } from '@/types/keyboard.types';
import type { PointingHardwareReport } from '@/utils/pointing-hardware';

const tools = () => upgradePointControls({version: 1, profiles: structuredClone(POINT_DEFAULTS)}, 5);
const keyboard = (keymap: number[]) => ({rows: 1, cols: keymap.length, layers: 1, keymap: [keymap], feature_flags2: POINT_CONTROL_FLAG, pointing_controls: tools(), svil_proto: 3, kbid: '01', custom_keycodes: [], macros: [], combos: [], tapdances: [], key_overrides: [], alt_repeat_keys: [], leaders: []} as KeyboardInfo);
const hardware = (left: string, right: string): PointingHardwareReport => ({halves: [
    {usb: true, side: 'left', builtFor: left, detected: left, sensorStarted: true, auto: true, productId: 0, inverseProductId: 0},
    {usb: false, side: 'right', builtFor: 'none', detected: right, sensorStarted: true, auto: true, productId: 0, inverseProductId: 0},
] as PointingHardwareReport['halves']});

describe('pointing tools key codes', () => {
    it('names every slot key by side, slot and mode with the firmware values', () => {
        for (const [side, s] of [['L', 0], ['R', 1]] as const) for (let slot = 1; slot <= 4; slot++) {
            expect(pointKey(`SV_POINT_${side}_TOOL${slot}_HOLD`)!.code).toBe(0x7e00 + s * 8 + (slot - 1) * 2);
            expect(pointKey(`SV_POINT_${side}_TOOL${slot}_TOGGLE`)!.code).toBe(0x7e00 + s * 8 + (slot - 1) * 2 + 1);
        }
        expect(pointKey('SV_POINT_STOP_ALL')!.code).toBe(0x7e10);
        expect(pointKey('SV_POINT_TRACE')!.code).toBe(0x7e11);
        expect(pointKey('SV_POINT_FINER')!.code).toBe(0x7e12);
        expect(pointKey('SV_POINT_COARSER')!.code).toBe(0x7e13);
    });
    it('claims the whole 0x7E00-0x7E3F block, and only it', () => {
        expect(POINT_KEYS.map(k => k.code)).toEqual(Array.from({length: 64}, (_, i) => 0x7e00 + i));
        expect(new Set(POINT_KEYS.map(k => k.name)).size).toBe(64);
        expect(pointKey(0x7e3f)!.name).toBe('SV_POINT_RESERVED_7E3F');
        expect(pointKey(0x7e40)).toBeUndefined();
    });
    it('names the block only when the board reports pointing tools', () => {
        const kb = keyboard([0x7e00]);
        keyService.generateAllKeycodes(kb);
        expect(keyService.stringify(0x7e20)).toBe('SV_POINT_RESERVED_7E20');
        expect(keyService.stringify(0x7e05)).toBe('SV_POINT_L_TOOL3_TOGGLE');
        keyService.generateAllKeycodes({...kb, feature_flags2: 0, pointing_controls: undefined});
        expect(keyService.stringify(0x7e05)).not.toBe('SV_POINT_L_TOOL3_TOGGLE');
        expect(keyService.stringify(0x7e20)).not.toBe('SV_POINT_RESERVED_7E20');
    });
    it('offers the slot keys, Stop all, Finer and Coarser in the picker, never Trace', () => {
        expect(PICKER_POINT_KEYS.map(k => k.name)).toEqual([
            ...POINT_KEYS.slice(0, 16).map(k => k.name), 'SV_POINT_STOP_ALL', 'SV_POINT_FINER', 'SV_POINT_COARSER']);
        expect(PICKER_POINT_KEYS.some(k => k.code === 0x7e11)).toBe(false);
    });
});

describe('old pointing tools key names', () => {
    it('map to the slot keys', () => {
        expect(Object.keys(POINT_KEY_ALIASES)).toHaveLength(17);
        expect(pointKey('SV_POINT_L_VOLUME_HOLD')!.name).toBe('SV_POINT_L_TOOL1_HOLD');
        expect(pointKey('SV_POINT_L_ARROWS_TOGGLE')!.name).toBe('SV_POINT_L_TOOL2_TOGGLE');
        expect(pointKey('SV_POINT_R_TABS_HOLD')!.name).toBe('SV_POINT_R_TOOL3_HOLD');
        expect(pointKey('SV_POINT_R_TASKS_TOGGLE')!.code).toBe(0x7e0f);
        expect(pointKey('SV_POINT_CANCEL')!.name).toBe('SV_POINT_STOP_ALL');
    });
    it('import from a .svil layout and export under the new names', () => {
        const kb = keyboard([0x7e00, 0x7e00, 0x7e00, 0x7e00]);
        keyService.generateAllKeycodes(kb);
        const svil = JSON.parse(fileService.kbinfoToSvil(kb));
        svil.layout[0][0] = ['SV_POINT_L_VOLUME_HOLD', 'SV_POINT_R_ARROWS_TOGGLE', 'SV_POINT_R_TASKS_HOLD', 'SV_POINT_CANCEL'];
        const imported = fileService.svilToKBINFO(svil);
        expect(imported.keymap![0].slice(0, 4)).toEqual([0x7e00, 0x7e0b, 0x7e0e, 0x7e10]);
        const again = JSON.parse(fileService.kbinfoToSvil({...kb, keymap: imported.keymap}));
        expect(again.layout[0][0]).toEqual(['SV_POINT_L_TOOL1_HOLD', 'SV_POINT_R_TOOL2_TOGGLE', 'SV_POINT_R_TOOL4_HOLD', 'SV_POINT_STOP_ALL']);
    });
});

describe('pointing tools key labels', () => {
    it('show the slot action, side and mode, and follow the slot action', () => {
        const kb = keyboard([0x7e08]);
        expect(getKeyContents(kb, 'SV_POINT_L_TOOL1_HOLD').title).toBe('Left pointer: Volume (hold)');
        expect(getKeyContents(kb, 'SV_POINT_R_TOOL2_TOGGLE').title).toBe('Right pointer: Arrows (toggle)');
        kb.pointing_controls!.profiles[1].action = 4;
        expect(getKeyContents(kb, 'SV_POINT_R_TOOL2_TOGGLE').title).toBe('Right pointer: Zoom (toggle)');
        expect(getKeyContents(kb, 'SV_POINT_R_TOOL2_TOGGLE').str).toBe('R Zm\nTG');
        expect(getKeyContents(kb, 'SV_POINT_L_TOOL1_HOLD').str).toBe('L Vol\nHold');
    });
    it('name the pointing device each half has, else "pointer"', () => {
        const kb = {...keyboard([0x7e00]), pointing_hardware: hardware('pmw3389', 'azoteq')};
        expect(getKeyContents(kb, 'SV_POINT_L_TOOL1_HOLD').title).toBe('Left ball: Volume (hold)');
        expect(getKeyContents(kb, 'SV_POINT_R_TOOL3_TOGGLE').title).toBe('Right pad: Tabs (toggle)');
        expect(pointDevice(1, {pointing_hardware: hardware('none', 'trackpoint')})).toBe('stick');
        expect(pointDevice(0, {pointing_hardware: hardware('none', 'trackpoint')})).toBe('pointer');
        expect(pointDevice(1, {})).toBe('pointer');
    });
    it('fall back to the slot number when the board has not reported its actions', () => {
        const key = pointKey('SV_POINT_L_TOOL3_TOGGLE')!;
        expect(configuredPointKey(key, {version: 3, profiles: tools().profiles, defaults: tools().defaults, universal: true})).toMatchObject({label: 'L T3\nTG', title: 'Left pointer: Tool 3 (toggle)'});
        expect(configuredPointKey(pointKey('SV_POINT_STOP_ALL')!, tools()).title).toBe('Stop all pointing tools and cancel task switching');
    });
});
