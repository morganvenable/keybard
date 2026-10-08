// Reordering layers: move each layer's contents, and every layer number stored in a
// keycode, so the board behaves the same afterwards with its layers renumbered.
//
// An order lists, for each new position, the layer that moves there:
// order[newLayer] = oldLayer.

import { KEYMAP } from '@/constants/keygen';
import { KEYCODE_NUMBERINGS, activeKeycodeVersion } from '@/constants/keycode-numbering';
import { keyService } from '@/services/key.service';
import type { KeyboardInfo } from '@/types/keyboard.types';

/** Where a keycode family keeps its layer number, inside the range QMK names for it. */
const LAYER_FIELDS: Array<{ range: string; shift: number; mask: number }> = [
    { range: 'QK_LAYER_TAP', shift: 8, mask: 0xF },             // LT(layer, kc)
    { range: 'QK_LAYER_MOD', shift: 5, mask: 0xF },             // LM(layer, mod)
    { range: 'QK_TO', shift: 0, mask: 0x1F },
    { range: 'QK_MOMENTARY', shift: 0, mask: 0x1F },
    { range: 'QK_DEF_LAYER', shift: 0, mask: 0x1F },
    { range: 'QK_TOGGLE_LAYER', shift: 0, mask: 0x1F },
    { range: 'QK_ONE_SHOT_LAYER', shift: 0, mask: 0x1F },
    { range: 'QK_LAYER_TAP_TOGGLE', shift: 0, mask: 0x1F },
    { range: 'QK_PERSISTENT_DEF_LAYER', shift: 0, mask: 0x1F },
];

/** The families that set the default layer (DF, PDF). */
const DEFAULT_LAYER_RANGES = new Set(['QK_DEF_LAYER', 'QK_PERSISTENT_DEF_LAYER']);

interface LayerField { range: string; first: number; last: number; shift: number; mask: number }

/** Layer-key ranges in the numbering the board uses. */
function layerFields(): LayerField[] {
    const spec = KEYCODE_NUMBERINGS[activeKeycodeVersion()];
    const spans = new Map(Object.entries(spec.ranges).map(([span, name]) => [name, span]));
    return LAYER_FIELDS.flatMap(field => {
        const span = spans.get(field.range);
        if (!span) return [];
        const [first, size] = span.split('/').map(Number);
        return [{ ...field, first, last: first + size }];
    });
}

/** The layer a keycode refers to and the family it belongs to, or null for other keycodes. */
export function layerReference(code: number, fields = layerFields()): { layer: number; range: string } | null {
    for (const field of fields) {
        if (code < field.first || code > field.last) continue;
        return { layer: ((code - field.first) >> field.shift) & field.mask, range: field.range };
    }
    return null;
}

export function moveLayerOrder(count: number, from: number, to: number): number[] {
    const order = Array.from({ length: count }, (_, layer) => layer);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    return order;
}

export function invertLayerOrder(order: number[]): number[] {
    const inverse: number[] = [];
    order.forEach((oldLayer, newLayer) => { inverse[oldLayer] = newLayer; });
    return inverse;
}

/** Moves each layer's bit to the layer's new number. Bits past the reordered layers stay. */
export function permuteLayerMask(mask: number, order: number[]): number {
    let result = (mask >>> 0) & ~((2 ** order.length - 1) >>> 0);
    order.forEach((oldLayer, newLayer) => {
        if (mask & (1 << oldLayer)) result |= 1 << newLayer;
    });
    return result >>> 0;
}

/** The last layer is the auto-mouse layer in Svalboard firmware, so it can't move. */
export function pinnedLayer(kb: Pick<KeyboardInfo, 'layers'>): number {
    return (kb.layers ?? 16) - 1;
}

export interface LayerReorderCounts {
    layerKeys: number;
    combos: number;
    tapdances: number;
    keyOverrides: number;
    altRepeatKeys: number;
    leaders: number;
    macros: number;
}

export interface LayerReorderPlan {
    keyboard: KeyboardInfo;
    order: number[];
    counts: LayerReorderCounts;
    errors: string[];
    warnings: string[];
}

export interface LayerReorderOptions {
    /** Layers that must keep their number: the default layer, while Keybard can't move it. */
    fixedLayers?: number[];
    layerName?: (layer: number) => string;
}

/** Plans a reorder without changing kb. Apply the plan's keyboard only when errors is empty. */
export function planLayerReorder(kb: KeyboardInfo, order: number[], options: LayerReorderOptions = {}): LayerReorderPlan {
    const count = kb.layers ?? kb.keymap?.length ?? 0;
    const name = options.layerName ?? ((layer: number) => `Layer ${layer}`);
    const errors: string[] = [];
    const warnings: string[] = [];
    const counts: LayerReorderCounts = { layerKeys: 0, combos: 0, tapdances: 0, keyOverrides: 0, altRepeatKeys: 0, leaders: 0, macros: 0 };

    if (order.length !== count || [...order].sort((a, b) => a - b).some((layer, index) => layer !== index)) {
        return { keyboard: kb, order, counts, errors: [`The new order must list each of the ${count} layers once.`], warnings };
    }
    const newOf = invertLayerOrder(order);
    const pinned = pinnedLayer(kb);
    if (order[pinned] !== pinned) errors.push(`${name(pinned)} is the auto-mouse layer and has to stay last.`);
    for (const layer of options.fixedLayers ?? []) {
        if (layer < count && newOf[layer] !== layer) errors.push(`${name(layer)} is the default layer and has to keep its number (${layer}). Keybard can't change the default layer yet.`);
    }

    const fields = layerFields();
    const overflow = new Set<string>();
    const remap = (code: number): number => {
        const field = fields.find(f => code >= f.first && code <= f.last);
        if (!field) return code;
        const layer = ((code - field.first) >> field.shift) & field.mask;
        if (layer >= count) return code;
        const moved = newOf[layer];
        if (moved > field.mask) {
            overflow.add(`${name(layer)} can't move to ${moved}: its ${field.range === 'QK_LAYER_TAP' ? 'layer-tap' : 'layer-mod'} keys can only reach layers 0–${field.mask}.`);
            return code;
        }
        return code - (layer << field.shift) + (moved << field.shift);
    };
    const remapName = (value: string): string => {
        if (!value || value === '-1') return value;
        const code = keyService.parse(value);
        if (!Number.isFinite(code)) return value;
        const moved = remap(code);
        return moved === code ? value : keyService.stringify(moved);
    };
    const tally = <T>(entries: T[] | undefined, key: keyof LayerReorderCounts, rewrite: (entry: T) => T): T[] | undefined =>
        entries?.map(entry => {
            const next = rewrite(entry);
            if (JSON.stringify(next) !== JSON.stringify(entry)) counts[key]++;
            return next;
        });

    const next: KeyboardInfo = structuredClone(kb);
    if (kb.keymap) {
        const keymap = kb.keymap.map(layer => layer.map(code => {
            const moved = remap(code);
            if (moved !== code) counts.layerKeys++;
            return moved;
        }));
        next.keymap = [...order.map(oldLayer => keymap[oldLayer]), ...keymap.slice(count)];
    }
    next.combos = tally(next.combos, 'combos', combo => ({ ...combo, keys: combo.keys.map(remapName), output: remapName(combo.output) }));
    next.tapdances = tally(next.tapdances, 'tapdances', td => ({ ...td, tap: remapName(td.tap), hold: remapName(td.hold), doubletap: remapName(td.doubletap), taphold: remapName(td.taphold) }));
    next.key_overrides = tally(next.key_overrides, 'keyOverrides', ko => ({ ...ko, trigger: remapName(ko.trigger), replacement: remapName(ko.replacement), layers: permuteLayerMask(ko.layers, order) & 0xFFFF }));
    next.alt_repeat_keys = tally(next.alt_repeat_keys, 'altRepeatKeys', ark => ({ ...ark, keycode: remapName(ark.keycode), alt_keycode: remapName(ark.alt_keycode) }));
    next.leaders = tally(next.leaders, 'leaders', leader => ({ ...leader, sequence: leader.sequence.map(remapName), output: remapName(leader.output) }));
    next.macros = tally(next.macros, 'macros', macro => ({
        ...macro,
        actions: macro.actions.map(([type, value]) => ['tap', 'down', 'up'].includes(type) && typeof value === 'string' ? [type, remapName(value)] : [type, value]),
    }));
    errors.push(...overflow);

    // Per-layer data.
    if (kb.layer_colors) {
        next.layer_colors = [...order.map(oldLayer => kb.layer_colors![oldLayer]), ...kb.layer_colors.slice(count)];
        while (next.layer_colors.length && next.layer_colors[next.layer_colors.length - 1] === undefined) next.layer_colors.pop();
    }
    if (kb.cosmetic) {
        for (const field of ['layer', 'layer_colors'] as const) {
            const values = kb.cosmetic[field];
            if (!values) continue;
            const permuted: Record<string, string> = {};
            for (const [key, value] of Object.entries(values)) {
                const layer = Number(key);
                if (!(Number.isInteger(layer) && layer >= 0 && layer < count)) permuted[key] = value;
            }
            order.forEach((oldLayer, newLayer) => {
                if (values[oldLayer] !== undefined) permuted[newLayer] = values[oldLayer];
            });
            next.cosmetic![field] = permuted;
        }
    }
    next.custom_values = permuteLayerColorValues(kb, next, order);

    // QMK's tri-layer keys turn on layers 1–3 by number.
    const triLayer = ['QK_TRI_LAYER_LOWER', 'QK_TRI_LAYER_UPPER'].map(key => KEYMAP[key]?.code).filter(code => code !== undefined);
    if ([1, 2, 3].some(layer => newOf[layer] !== layer) && kb.keymap?.some(layer => layer.some(code => triLayer.includes(code)))) {
        warnings.push('Tri-layer keys (TL_LOWR, TL_UPPR) always use layers 1, 2 and 3, and this changes which layers those are.');
    }

    return { keyboard: next, order, counts, errors, warnings };
}

/** Reorders kb's layers. Throws if the order can't be applied. */
export function permuteLayers(kb: KeyboardInfo, order: number[], options: LayerReorderOptions = {}): KeyboardInfo {
    const plan = planLayerReorder(kb, order, options);
    if (plan.errors.length) throw new Error(plan.errors.join(' '));
    return plan.keyboard;
}

const LAYER_COLOR_KEY = /^id_layer(\d+)_color$/;

/** Layer LED colours move with their layer. Their custom values follow layer_colors when it's present. */
function permuteLayerColorValues(kb: KeyboardInfo, next: KeyboardInfo, order: number[]): KeyboardInfo['custom_values'] {
    if (!kb.custom_values) return kb.custom_values;
    const byLayer = new Map(kb.custom_values.flatMap(entry => {
        const layer = Number(entry.key.match(LAYER_COLOR_KEY)?.[1] ?? -1);
        return layer >= 0 ? [[layer, entry] as const] : [];
    }));
    return withLayerColorValues({ ...next, custom_values: kb.custom_values.map(entry => {
        const layer = Number(entry.key.match(LAYER_COLOR_KEY)?.[1] ?? -1);
        if (layer < 0 || layer >= order.length) return entry;
        const from = byLayer.get(order[layer]);
        return from ? { ...entry, data: [...from.data] } : entry;
    }) }).custom_values;
}

/**
 * Brings the layer-colour custom values in line with layer_colors, which is what the
 * colour editors update. Compare two layouts only after passing both through this.
 */
export function withLayerColorValues(kb: KeyboardInfo): KeyboardInfo {
    if (!kb.custom_values || !kb.layer_colors) return kb;
    return {
        ...kb,
        custom_values: kb.custom_values.map(entry => {
            const layer = Number(entry.key.match(LAYER_COLOR_KEY)?.[1] ?? -1);
            const color = layer >= 0 ? kb.layer_colors![layer] : undefined;
            return color ? { ...entry, data: [color.hue, color.sat] } : entry;
        }),
    };
}

/**
 * Layers that set the default layer: the targets of DF and PDF keys anywhere in the layout.
 * Used when the board can't report its default layer.
 */
export function defaultLayerCandidates(kb: KeyboardInfo): number[] {
    const fields = layerFields().filter(field => DEFAULT_LAYER_RANGES.has(field.range));
    const found = new Set<number>([0]);
    const add = (code: number) => {
        const ref = layerReference(code, fields);
        if (ref) found.add(ref.layer);
    };
    const addName = (value: string) => { if (value && value !== '-1') add(keyService.parse(value)); };
    kb.keymap?.forEach(layer => layer.forEach(add));
    kb.combos?.forEach(combo => addName(combo.output));
    kb.tapdances?.forEach(td => [td.tap, td.hold, td.doubletap, td.taphold].forEach(addName));
    kb.key_overrides?.forEach(ko => addName(ko.replacement));
    kb.alt_repeat_keys?.forEach(ark => addName(ark.alt_keycode));
    kb.leaders?.forEach(leader => addName(leader.output));
    kb.macros?.forEach(macro => macro.actions.forEach(([type, value]) => { if (type !== 'text' && type !== 'delay' && typeof value === 'string') addName(value); }));
    return [...found].sort((a, b) => a - b);
}

/** Lines for the confirmation: which layers change number, and what else gets rewritten. */
export function describeLayerReorder(plan: LayerReorderPlan, name: (layer: number) => string): string[] {
    const lines = plan.order.flatMap((oldLayer, newLayer) => oldLayer === newLayer ? [] : [`${name(oldLayer)}: layer ${oldLayer} → ${newLayer}`]);
    const parts = ([
        ['layerKeys', 'layer key'], ['combos', 'combo'], ['tapdances', 'tap dance'], ['keyOverrides', 'key override'],
        ['altRepeatKeys', 'alt-repeat key'], ['leaders', 'leader sequence'], ['macros', 'macro'],
    ] as const).flatMap(([key, label]) => plan.counts[key] ? [`${plan.counts[key]} ${label}${plan.counts[key] === 1 ? '' : 's'}`] : []);
    lines.push(parts.length ? `Updates ${parts.join(', ')} so they still reach the same layers.` : 'No keys refer to the moved layers.');
    return lines;
}
