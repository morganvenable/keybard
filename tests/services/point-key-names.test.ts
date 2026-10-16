import { describe, expect, it } from 'vitest';
import { POINT_CONTROL_FLAG, POINT_DEFAULTS, POINT_KEYS, PICKER_POINT_KEYS, POINT_KEY_ALIASES, configuredPointKey, pointKey, upgradePointControls } from '@/constants/point-controls';
import { fileService } from '@/services/file.service';
import { keyService } from '@/services/key.service';
import { prepareImport } from '@/services/import-preflight';
import { getKeyContents } from '@/utils/keys';
import type { KeyboardInfo } from '@/types/keyboard.types';

const tools = () => upgradePointControls({version: 1, profiles: structuredClone(POINT_DEFAULTS)}, 5);
const keyboard = (keymap: number[]) => ({rows: 1, cols: keymap.length, layers: 1, keymap: [keymap], feature_flags2: POINT_CONTROL_FLAG, pointing_controls: tools(), svil_proto: 3, kbid: '01', custom_keycodes: [], macros: [], combos: [], tapdances: [], key_overrides: [], alt_repeat_keys: [], leaders: []} as KeyboardInfo);

describe('pointing tools key codes', () => {
    it('gives the 4 tools one hold and one toggle key each, with the firmware values', () => {
        for (let slot = 1; slot <= 4; slot++) {
            expect(pointKey(`SV_POINT_TOOL${slot}_HOLD`)!.code).toBe(0x7e00 + (slot - 1) * 2);
            expect(pointKey(`SV_POINT_TOOL${slot}_TOGGLE`)!.code).toBe(0x7e00 + (slot - 1) * 2 + 1);
        }
        expect(pointKey('SV_POINT_TOOL1_HOLD')!.code).toBe(0x7e00);
        expect(pointKey('SV_POINT_TOOL4_TOGGLE')!.code).toBe(0x7e07);
        expect(pointKey('SV_POINT_STOP_ALL')!.code).toBe(0x7e10);
        expect(pointKey('SV_POINT_TRACE')!.code).toBe(0x7e11);
    });
    it('keeps the old right-pointer, Finer and Coarser codes retired, never reused', () => {
        for (const code of [0x7e08, 0x7e0f, 0x7e12, 0x7e13]) {
            expect(pointKey(code)!.name).toBe(`SV_POINT_RETIRED_${code.toString(16).toUpperCase()}`);
            expect(pointKey(code)!.hidden).toBe(true);
        }
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
        expect(keyService.stringify(0x7e05)).toBe('SV_POINT_TOOL3_TOGGLE');
        keyService.generateAllKeycodes({...kb, feature_flags2: 0, pointing_controls: undefined});
        expect(keyService.stringify(0x7e05)).not.toBe('SV_POINT_TOOL3_TOGGLE');
        expect(keyService.stringify(0x7e20)).not.toBe('SV_POINT_RESERVED_7E20');
    });
    it('offers the 4 tools as hold and toggle plus Stop tools in the picker, nothing else', () => {
        expect(PICKER_POINT_KEYS.map(k => k.name)).toEqual([
            ...[1, 2, 3, 4].flatMap(n => [`SV_POINT_TOOL${n}_HOLD`, `SV_POINT_TOOL${n}_TOGGLE`]), 'SV_POINT_STOP_ALL']);
    });
});

describe('old pointing tools key names', () => {
    it('map left and right keys to the one shared tool key', () => {
        expect(Object.keys(POINT_KEY_ALIASES)).toHaveLength(33);
        for (const side of ['L', 'R']) ['VOLUME', 'ARROWS', 'TABS', 'TASKS'].forEach((old, i) => {
            for (const mode of ['HOLD', 'TOGGLE']) {
                expect(pointKey(`SV_POINT_${side}_${old}_${mode}`)!.name).toBe(`SV_POINT_TOOL${i + 1}_${mode}`);
                expect(pointKey(`SV_POINT_${side}_TOOL${i + 1}_${mode}`)!.name).toBe(`SV_POINT_TOOL${i + 1}_${mode}`);
            }
        });
        expect(pointKey('SV_POINT_CANCEL')!.name).toBe('SV_POINT_STOP_ALL');
        expect(pointKey('SV_POINT_FINER')).toBeUndefined();
        expect(keyService.parse('SV_POINT_FINER')).toBe(0);
        expect(keyService.parse('SV_POINT_COARSER')).toBe(0);
    });
    it('import from a .svil layout, export under the new names, and warn about Finer / Coarser', () => {
        const kb = keyboard(Array(8).fill(0x7e00));
        keyService.generateAllKeycodes(kb);
        const svil = JSON.parse(fileService.kbinfoToSvil(kb));
        svil.layout[0][0] = ['SV_POINT_L_VOLUME_HOLD', 'SV_POINT_R_ARROWS_TOGGLE', 'SV_POINT_R_TASKS_HOLD', 'SV_POINT_CANCEL',
            'SV_POINT_R_TOOL1_HOLD', 'SV_POINT_L_TOOL3_TOGGLE', 'SV_POINT_FINER', 'SV_POINT_COARSER'];
        const imported = fileService.parseContent(JSON.stringify(svil));
        expect(imported.keymap![0]).toEqual([0x7e00, 0x7e03, 0x7e06, 0x7e10, 0x7e00, 0x7e05, 0, 0]);
        expect(imported.retired_point_key_count).toBe(2);
        const review = prepareImport(imported, kb);
        expect(review.warnings.join(' ')).toContain('2 Finer / Coarser keys are no longer available and will be set to KC_NO');
        const again = JSON.parse(fileService.kbinfoToSvil({...kb, keymap: imported.keymap}));
        expect(again.layout[0][0]).toEqual(['SV_POINT_TOOL1_HOLD', 'SV_POINT_TOOL2_TOGGLE', 'SV_POINT_TOOL4_HOLD', 'SV_POINT_STOP_ALL',
            'SV_POINT_TOOL1_HOLD', 'SV_POINT_TOOL3_TOGGLE', 'KC_NO', 'KC_NO']);
    });
    it('warn when a layout holds a retired numeric code', () => {
        const kb = keyboard([0x7e00, 0x7e00]);
        const review = prepareImport({...kb, keymap: [[0x7e0a, 0x7e12]]}, kb);
        expect(review.warnings.join(' ')).toContain('2 keys use a retired pointing tools code that does nothing');
    });
});

describe('pointing tools key labels', () => {
    it('spell out the slot action and HOLD or TOGGLE, with no side', () => {
        const kb = keyboard([0x7e00]);
        expect(getKeyContents(kb, 'SV_POINT_TOOL1_HOLD')).toMatchObject({str: 'VOLUME\nHOLD', title: 'Volume tool (hold)'});
        expect(getKeyContents(kb, 'SV_POINT_TOOL2_TOGGLE')).toMatchObject({str: 'ARROWS\nTOGGLE', title: 'Arrows tool (toggle)'});
        expect(getKeyContents(kb, 'SV_POINT_TOOL3_HOLD').str).toBe('TABS\nHOLD');
        expect(getKeyContents(kb, 'SV_POINT_TOOL4_TOGGLE').str).toBe('TASKS\nTOGGLE');
        const caps = ['ZOOM', 'UNDO', 'UNDO', 'SCROLL'];
        [4, 5, 6, 7].forEach((action, i) => {
            kb.pointing_controls!.profiles[1].action = action;
            expect(getKeyContents(kb, 'SV_POINT_TOOL2_HOLD').str).toBe(`${caps[i]}\nHOLD`);
        });
        expect(getKeyContents(kb, 'SV_POINT_TOOL2_HOLD').title).toBe('Proportional scroll tool (hold)');
        expect(getKeyContents(kb, 'SV_POINT_STOP_ALL').str).toBe('STOP\nTOOLS');
        for (const key of PICKER_POINT_KEYS) expect(getKeyContents(kb, key.name).str).not.toMatch(/\b(TG|TSK|VOL|ZM)\b/);
    });
    it('fall back to the tool number when the board has not reported its actions', () => {
        const key = pointKey('SV_POINT_TOOL3_TOGGLE')!;
        expect(configuredPointKey(key, {version: 3, profiles: tools().profiles, defaults: tools().defaults, universal: true})).toMatchObject({label: 'TOOL 3\nTOGGLE', title: 'Tool 3 (toggle)'});
        expect(configuredPointKey(pointKey('SV_POINT_STOP_ALL')!, tools()).title).toBe('Stop tools: stop every pointing tool and cancel task switching');
    });
});
