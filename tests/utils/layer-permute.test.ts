import { describe, expect, it } from 'vitest';
import { KEYMAP } from '../../src/constants/keygen';
import { KEYCODE_NUMBERINGS, LATEST_KEYCODE_VERSION } from '../../src/constants/keycode-numbering';
import { keyService } from '../../src/services/key.service';
import { importService } from '../../src/services/import.service';
import { vi } from 'vitest';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import {
    allowedLayerMoves, defaultLayerCandidates, describeLayerReorder, invertLayerOrder, layerGapTarget, moveLayerOrder, permuteLayerMask, permuteLayers,
    planLayerReorder, withLayerColorValues,
} from '../../src/utils/layer-permute';

const base = (range: string) => {
    const span = Object.entries(KEYCODE_NUMBERINGS[LATEST_KEYCODE_VERSION].ranges).find(([, name]) => name === range)![0];
    return Number(span.split('/')[0]);
};
const code = (name: string) => KEYMAP[name].code;
const KC_A = code('KC_A');
const KC_TRNS = code('KC_TRNS');
const LT = (layer: number, kc: number) => code(`LT${layer}(kc)`) + kc;
const LM = (layer: number, mods: number) => base('QK_LAYER_MOD') | (layer << 5) | mods;
const PDF = (layer: number) => base('QK_PERSISTENT_DEF_LAYER') + layer;

function board(layers = 4): KeyboardInfo {
    return {
        name: 'Test', layers, rows: 1, cols: 4,
        keymap: Array.from({ length: layers }, (_, layer) => [KC_A + layer, KC_TRNS, KC_TRNS, KC_TRNS]),
        layer_colors: Array.from({ length: layers }, (_, layer) => ({ hue: layer * 10, sat: 200, val: 255 })),
        cosmetic: {
            layer: Object.fromEntries(Array.from({ length: layers }, (_, layer) => [String(layer), `L${layer}`])),
            layer_colors: { '1': 'red', '2': 'blue' },
            macros: { '0': 'kept' },
        },
        custom_values: [
            ...Array.from({ length: layers }, (_, layer) => ({ key: `id_layer${layer}_color`, channel: 0, valueId: 32 + layer, data: [layer * 10, 200] })),
            { key: 'id_left_dpi', channel: 0, valueId: 1, data: [4] },
        ],
        combos: [], tapdances: [], key_overrides: [], alt_repeat_keys: [], leaders: [], macros: [],
    } as unknown as KeyboardInfo;
}

describe('layer orders', () => {
    it('moves one layer and inverts', () => {
        const order = moveLayerOrder(5, 1, 3);
        expect(order).toEqual([0, 2, 3, 1, 4]);
        expect(invertLayerOrder(order)).toEqual([0, 3, 1, 2, 4]);
    });

    it('permutes mask bits and keeps bits past the reordered layers', () => {
        expect(permuteLayerMask(0b0010, [0, 2, 1, 3])).toBe(0b0100);
        expect(permuteLayerMask(0b1_0000_0011, [1, 0, 2, 3])).toBe(0b1_0000_0011);
        expect(permuteLayerMask(0x80000001, moveLayerOrder(16, 0, 2))).toBe(0x80000004);
    });
});

describe('planLayerReorder', () => {
    it('moves layer contents, names, colours and colour values', () => {
        const kb = board();
        const next = permuteLayers(kb, [0, 2, 1, 3]);
        expect(next.keymap!.map(layer => layer[0])).toEqual([KC_A, KC_A + 2, KC_A + 1, KC_A + 3]);
        expect(next.cosmetic!.layer).toEqual({ '0': 'L0', '1': 'L2', '2': 'L1', '3': 'L3' });
        expect(next.cosmetic!.layer_colors).toEqual({ '1': 'blue', '2': 'red' });
        expect(next.cosmetic!.macros).toEqual({ '0': 'kept' });
        expect(next.layer_colors!.map(c => c.hue)).toEqual([0, 20, 10, 30]);
        expect(next.custom_values!.map(v => [v.key, v.data[0]])).toEqual([
            ['id_layer0_color', 0], ['id_layer1_color', 20], ['id_layer2_color', 10], ['id_layer3_color', 30], ['id_left_dpi', 4],
        ]);
        expect(kb.keymap![1][0]).toBe(KC_A + 1);
    });

    it('remaps every layer-key family, keeping the LT key and the LM modifiers', () => {
        const kb = board();
        const families = ['TO', 'MO', 'DF', 'TG', 'OSL', 'TT'].map(f => code(`${f}(1)`));
        kb.keymap![0] = [...families.slice(0, 3), LT(1, KC_A)];
        kb.keymap![3] = [...families.slice(3), LM(1, 0x12)];
        kb.keymap![2] = [PDF(1), code('MO(0)'), code('MO(3)'), KC_A];
        const plan = planLayerReorder(kb, [0, 2, 1, 3]);
        expect(plan.errors).toEqual([]);
        const next = plan.keyboard;
        expect(next.keymap![0]).toEqual([...['TO', 'MO', 'DF'].map(f => code(`${f}(2)`)), LT(2, KC_A)]);
        expect(next.keymap![3]).toEqual([...['TG', 'OSL', 'TT'].map(f => code(`${f}(2)`)), LM(2, 0x12)]);
        // Old layer 2 is now layer 1; layers 0 and 3 are unchanged.
        expect(next.keymap![1]).toEqual([PDF(2), code('MO(0)'), code('MO(3)'), KC_A]);
        expect(plan.counts.layerKeys).toBe(9);
    });

    it('remaps keycodes stored as names everywhere, and permutes override layer masks', () => {
        const kb = board();
        kb.combos = [{ cmbid: 0, keys: ['KC_A', 'MO(1)', '', ''], output: 'TG(2)', options: 0 }, { cmbid: 1, keys: ['KC_A', 'KC_B'], output: 'KC_C', options: 0 }];
        kb.tapdances = [{ idx: 0, tap: 'KC_A', hold: 'MO(1)', doubletap: 'TO(2)', taphold: 'LT1(KC_A)', tapping_term: 200 }];
        kb.key_overrides = [{ koid: 0, trigger: 'KC_A', replacement: 'OSL(1)', layers: 0b0010, trigger_mods: 0, negative_mod_mask: 0, suppressed_mods: 0, options: 0 }];
        kb.alt_repeat_keys = [{ arkid: 0, keycode: 'MO(2)', alt_keycode: 'TT(1)', allowed_mods: 0, options: 0 }];
        kb.leaders = [{ ldrid: 0, sequence: ['KC_A', 'TG(1)'], output: 'DF(2)', options: 0 }];
        kb.macros = [{ mid: 0, actions: [['tap', 'MO(1)'], ['text', 'MO(1)'], ['delay', 10], ['down', 'KC_A']] }];
        const plan = planLayerReorder(kb, [0, 2, 1, 3]);
        const next = plan.keyboard;
        expect(next.combos![0]).toMatchObject({ keys: ['KC_A', 'MO(2)', '', ''], output: 'TG(1)' });
        expect(next.combos![1]).toEqual(kb.combos[1]);
        expect(next.tapdances![0]).toMatchObject({ tap: 'KC_A', hold: 'MO(2)', doubletap: 'TO(1)', taphold: 'LT2(KC_A)' });
        expect(next.key_overrides![0]).toMatchObject({ replacement: 'OSL(2)', layers: 0b0100 });
        expect(next.alt_repeat_keys![0]).toMatchObject({ keycode: 'MO(1)', alt_keycode: 'TT(2)' });
        expect(next.leaders![0]).toMatchObject({ sequence: ['KC_A', 'TG(2)'], output: 'DF(1)' });
        expect(next.macros![0].actions).toEqual([['tap', 'MO(2)'], ['text', 'MO(1)'], ['delay', 10], ['down', 'KC_A']]);
        expect(plan.counts).toMatchObject({ combos: 1, tapdances: 1, keyOverrides: 1, altRepeatKeys: 1, leaders: 1, macros: 1 });
    });

    it('leaves keycodes that name no layer as they were written', () => {
        const kb = board();
        kb.combos = [{ cmbid: 0, keys: ['KC_A', '0x7e40'], output: 'LCTL(KC_B)', options: 0 }];
        expect(permuteLayers(kb, [0, 2, 1, 3]).combos).toEqual(kb.combos);
    });

    it('round-trips through the inverse order', () => {
        const kb = board(16);
        kb.keymap![0] = [code('MO(5)'), LT(9, KC_A), LM(3, 1), PDF(0)];
        kb.tapdances = [{ idx: 0, tap: 'TO(7)', hold: 'MO(2)', doubletap: 'KC_NO', taphold: 'LT4(KC_B)', tapping_term: 200 }];
        kb.key_overrides = [{ koid: 0, trigger: 'KC_A', replacement: 'KC_B', layers: 0b1010_0110, trigger_mods: 0, negative_mod_mask: 0, suppressed_mods: 0, options: 0 }];
        const order = moveLayerOrder(16, 2, 11);
        const back = permuteLayers(permuteLayers(kb, order), invertLayerOrder(order));
        expect(back).toEqual(kb);
    });

    it.each([4, 16, 32])('keeps the last layer of a %i-layer board in place', layers => {
        const kb = board(layers);
        expect(planLayerReorder(kb, moveLayerOrder(layers, layers - 1, 0)).errors[0]).toMatch(/auto-mouse layer/);
        expect(planLayerReorder(kb, moveLayerOrder(layers, 0, layers - 2)).errors).toEqual([]);
    });

    it('keeps fixed layers on their number', () => {
        const kb = board();
        expect(planLayerReorder(kb, [1, 0, 2, 3], { fixedLayers: [0] }).errors[0]).toMatch(/default layer/);
        expect(planLayerReorder(kb, [0, 2, 1, 3], { fixedLayers: [0] }).errors).toEqual([]);
    });

    it('refuses an order that leaves out a layer', () => {
        expect(planLayerReorder(board(), [0, 1, 1, 3]).errors[0]).toMatch(/each of the 4 layers/);
    });

    it('refuses to move a layer-tap target past layer 15', () => {
        const kb = board(32);
        kb.keymap![0][1] = LT(3, KC_A);
        expect(planLayerReorder(kb, moveLayerOrder(32, 3, 20)).errors.join(' ')).toMatch(/layer-tap keys can only reach layers 0–15/);
    });

    it('warns when tri-layer keys are in use and layers 1–3 move', () => {
        const kb = board();
        kb.keymap![0][1] = code('QK_TRI_LAYER_LOWER');
        expect(planLayerReorder(kb, [0, 2, 1, 3]).warnings[0]).toMatch(/Tri-layer/);
        expect(planLayerReorder(kb, [0, 1, 2, 3]).warnings).toEqual([]);
    });
});

describe('helpers', () => {
    it('lists layer 0 and every DF/PDF target as possible default layers', () => {
        const kb = board();
        kb.keymap![1][1] = code('DF(2)');
        kb.leaders = [{ ldrid: 0, sequence: ['KC_A'], output: keyService.stringify(PDF(3)), options: 0 }];
        expect(defaultLayerCandidates(kb)).toEqual([0, 2, 3]);
    });

    it('brings colour values in line with layer_colors', () => {
        const kb = board();
        kb.layer_colors![1] = { hue: 99, sat: 98, val: 255 };
        expect(withLayerColorValues(kb).custom_values!.find(v => v.key === 'id_layer1_color')!.data).toEqual([99, 98]);
    });
});

describe('describeLayerReorder', () => {
    it('lists renumbered layers and what gets rewritten', () => {
        const kb = board();
        kb.keymap![0][1] = code('MO(1)');
        kb.combos = [{ cmbid: 0, keys: ['KC_A', 'KC_B'], output: 'MO(2)', options: 0 }];
        const plan = planLayerReorder(kb, [0, 2, 1, 3]);
        expect(describeLayerReorder(plan, layer => `L${layer}`)).toEqual([
            'L2: layer 2 → 1', 'L1: layer 1 → 2', 'Updates 1 layer key, 1 combo so they still reach the same layers.',
        ]);
    });
});

describe('writing a reorder to the board', () => {
    it('queues only what a two-layer swap changes', async () => {
        const kb = board(16);
        kb.cols = 60;
        kb.rows = 1;
        kb.keymap = Array.from({ length: 16 }, (_, layer) => Array.from({ length: 60 }, (_, key) => (key < 40 && layer < 6 ? KC_A + ((layer + key) % 20) : KC_TRNS)));
        kb.keymap[0][59] = code('MO(3)');
        kb.combos = [{ cmbid: 0, keys: ['KC_A', 'KC_B'], output: 'TG(4)', options: 0 }, { cmbid: 1, keys: ['KC_A', 'KC_C'], output: 'KC_D', options: 0 }];
        kb.menus = [{ label: 'Colors', content: Array.from({ length: 16 }, (_, layer) => ({ label: `L${layer}`, type: 'color', content: [`id_layer${layer}_color`, 0, 32 + layer] })) }] as any;
        const next = permuteLayers(kb, moveLayerOrder(16, 3, 4));
        const writes: string[] = [];
        const keyboardService = Object.fromEntries(['updateKey', 'updateCombo', 'saveSvil'].map(name => [name, vi.fn()]));
        await importService.syncWithKeyboard(withLayerColorValues(next), withLayerColorValues(kb), async (_desc, _cb, metadata) => { writes.push(metadata!.writeKey!); }, { keyboardService, labelService: { saveName: vi.fn() } });
        const keyWrites = writes.filter(key => key.startsWith('key:'));
        // Layers 3 and 4 differ in 40 keys each, plus the MO key on layer 0.
        expect(keyWrites).toHaveLength(81);
        expect(keyWrites.every(key => /^key:(3|4):/.test(key) || key === 'key:0:0:59')).toBe(true);
        expect(writes).toContain('combo:0');
        expect(writes).not.toContain('combo:1');
        expect(writes.filter(key => key.startsWith('custom:'))).toEqual(['custom:id_layer3_color', 'custom:id_layer4_color']);
        expect(writes.length).toBeLessThan(100);
    });
});

describe('dragging between tabs', () => {
    it('puts the layer right after its lower neighbour, in either display direction', () => {
        // Tabs 0 1 2 3 4 5, dragging 4.
        const shown = [0, 1, 2, 3, 5];
        expect(layerGapTarget(4, shown, 0)).toBe(0);    // before 0
        expect(layerGapTarget(4, shown, 2)).toBe(2);    // between 1 and 2
        expect(layerGapTarget(4, shown, 4)).toBeNull(); // between 3 and 5: where it already is
        expect(layerGapTarget(4, shown, 5)).toBe(5);    // after 5
        // Dragging 1 to between 3 and 5 lands right after 3.
        expect(layerGapTarget(1, [0, 2, 3, 5], 3)).toBe(3);
        // Reversed row: 5 3 2 1 0. The gap between 2 and 1 is still "after 1".
        expect(layerGapTarget(4, [5, 3, 2, 1, 0], 3)).toBe(2);
        expect(layerGapTarget(4, [5, 3, 2, 1, 0], 0)).toBe(5);
    });

    it('skips hidden layers: the layer lands next to the tab it was dropped by', () => {
        // Layers 3–13 are blank and hidden; dragging 2 to between 14 and 15.
        expect(layerGapTarget(2, [0, 1, 14, 15], 3)).toBe(14);
        // Dragging 14 to between 1 and 2 when 2 is the next shown tab.
        expect(layerGapTarget(14, [0, 1, 2, 15], 2)).toBe(2);
    });

    it('offers only moves that keep the last layer, the fixed layers and LT reach', () => {
        const kb = board(6);
        expect([...allowedLayerMoves(kb, 2)].sort()).toEqual([0, 1, 3, 4]);
        expect(allowedLayerMoves(kb, 5).size).toBe(0);
        expect([...allowedLayerMoves(kb, 2, [0])].sort()).toEqual([1, 3, 4]);
        // Moving 1 to 3 shifts 2 and 3 down; fixing 3 rules out every move past it.
        expect([...allowedLayerMoves(kb, 1, [3])].sort()).toEqual([0, 2]);
        const wide = board(32);
        wide.combos = [{ cmbid: 0, keys: ['KC_A', 'KC_B'], output: 'LT3(KC_A)', options: 0 }];
        const moves = allowedLayerMoves(wide, 3);
        expect(moves.has(15)).toBe(true);
        expect(moves.has(16)).toBe(false);
    });
});
