import type { KeyboardInfo } from '../types/keyboard.types';
import { customValueService } from './custom-value.service';
import { MacroService } from './macro.service';
import { LabelService } from './label.service';
import { keyService } from './key.service';
import { activeKeycodeVersion } from '@/constants/keycode-numbering';
import { usbInstance } from './usb.service';

export interface ImportReview {
    keyboard: KeyboardInfo;
    errors: string[];
    warnings: string[];
    summary: string[];
}

/** Pure preflight: never queues commands or touches the device. */
export function prepareImport(file: KeyboardInfo, current?: KeyboardInfo): ImportReview {
    const errors: string[] = [], warnings: string[] = [];
    const summary = [`${file.layers ?? 0} layers`, `${file.macros?.length ?? 0} macros`, `${file.combos?.length ?? 0} combos`, `${file.tapdances?.length ?? 0} tap dances`, `${file.key_overrides?.length ?? 0} overrides`];
    if (!current) return { keyboard: structuredClone(file), errors, warnings, summary };
    const next = structuredClone(current);
    if (file.rows !== current.rows || file.cols !== current.cols) errors.push(`Matrix mismatch: file ${file.rows} × ${file.cols}; keyboard ${current.rows} × ${current.cols}. Automatic remapping is not supported.`);
    if ((file.layers ?? 0) > (current.layers ?? 0)) errors.push(`The file has ${file.layers} layers; this keyboard supports ${current.layers}.`);
    if (file.kbid && current.kbid && file.kbid.toLowerCase() !== current.kbid.toLowerCase()) warnings.push('This file identifies a different keyboard. Matching dimensions do not guarantee matching physical key positions.');
    const boardNumbering = current.keycode_version ?? activeKeycodeVersion();
    if (file.raw_keycode_count && file.keycode_version !== boardNumbering) {
        warnings.push(`${file.raw_keycode_count} keycode${file.raw_keycode_count === 1 ? ' is' : 's are'} stored as a number rather than a name, written in ${file.keycode_version ? `QMK keycode numbering ${file.keycode_version}` : 'an unrecorded keycode numbering'}; this keyboard uses ${boardNumbering}. Check ${file.raw_keycode_count === 1 ? 'it' : 'them'} after importing.`);
    }
    const vial = file.vial_import;
    if (vial?.foreign_custom_keycodes) errors.push(`This Vial layout uses ${vial.foreign_custom_keycodes} custom key${vial.foreign_custom_keycodes === 1 ? '' : 's'} (USER00…) from another keyboard's firmware, which this keyboard cannot interpret.`);
    if (vial?.unassigned_custom_keycodes) warnings.push(`${vial.unassigned_custom_keycodes} key${vial.unassigned_custom_keycodes === 1 ? ' uses a custom keycode' : 's use custom keycodes'} that Svalboard's Vial firmware left unassigned; ${vial.unassigned_custom_keycodes === 1 ? 'it' : 'they'} did nothing there and will be set to KC_NO.`);
    if (vial?.svalboard) warnings.push('Vial layout files do not include pointing and hardware settings (DPI, scrolling, automouse, layer colors). Set them again after importing.');
    next.keymap = current.keymap?.map((layer, index) => file.keymap?.[index] ? [...file.keymap[index]] : [...layer]);
    for (const [field, count] of [['macros','macro_count'], ['combos','combo_count'], ['tapdances','tapdance_count'], ['key_overrides','key_override_count']] as const) {
        const incoming = file[field];
        if (!incoming) continue;
        if (incoming.length > (current[count] ?? 0)) errors.push(`${field}: file has ${incoming.length} entries; keyboard supports ${current[count] ?? 0}.`);
        (next as any)[field] = Array.from({ length: Math.max(current[field]?.length ?? 0, incoming.length) }, (_, index) => incoming[index] ?? current[field]?.[index]);
    }
    if (file.macros?.some(macro => macro.actions.some(action => action[0] === 'text' && /[^\x20-\x7e]/.test(String(action[1]))))) {
        errors.push('Macro text contains non-ASCII or control characters. The backup preserves them, but this firmware cannot reliably type them. Edit those macros before importing.');
    }
    for (const macro of file.macros ?? []) {
        for (const action of macro.actions ?? []) {
            if (!['text', 'delay', 'tap', 'down', 'up'].includes(action[0])) errors.push(`Unsupported macro action: ${action[0]}.`);
            if (action[0] === 'delay' && (!Number.isInteger(action[1]) || Number(action[1]) < 0 || Number(action[1]) > 65024)) errors.push('Macro delays must be whole milliseconds between 0 and 65024.');
        }
    }
    const validKey = (key: string | number) => {
        const value = keyService.parse(key);
        return Number.isInteger(value) && value >= 0 && value <= 65535;
    };
    for (const [index, macro] of (file.macros ?? []).entries()) {
        for (const action of macro.actions ?? []) {
            if (['tap', 'down', 'up'].includes(action[0]) && !validKey(action[1])) errors.push(`Macro ${index} contains an unrecognized keycode.`);
        }
    }
    if (file.combos?.some(combo => [...combo.keys, combo.output].some(key => !validKey(key)))) errors.push('A combo contains an unrecognized keycode.');
    if (file.tapdances?.some(td => [td.tap, td.hold, td.doubletap, td.taphold].some(key => !validKey(key)))) errors.push('A tap dance contains an unrecognized keycode.');
    if (file.tapdances?.some(td => !Number.isInteger(td.tapping_term) || td.tapping_term < 0 || td.tapping_term > 32767)) errors.push('Tap dance timing must be whole milliseconds between 0 and 32767.');
    if (file.key_overrides?.some(override => [override.trigger, override.replacement].some(key => !validKey(key)))) errors.push('An override contains an unrecognized keycode.');
    if (Object.values(file.settings ?? {}).some(value => !Number.isInteger(value) || value < 0)) errors.push('QMK settings must contain non-negative integer values.');
    if (file.macros?.length) {
        try { new MacroService(usbInstance).dump(current.macros_size ?? 0, next.macros ?? []); }
        catch { errors.push('The imported macros do not fit the keyboard’s macro buffer or contain invalid actions.'); }
    }
    for (const field of ['alt_repeat_keys', 'leaders', 'one_shot', 'layer_colors', 'fragmentState'] as const) {
        if (file[field] && JSON.stringify(file[field]) !== JSON.stringify(current[field])) warnings.push(`${field.replace(/_/g, ' ')} will be kept from the keyboard; restoring this feature is not supported yet.`);
    }
    next.settings = { ...current.settings };
    for (const [id, value] of Object.entries(file.settings ?? {})) {
        if (Object.prototype.hasOwnProperty.call(current.settings ?? {}, id)) next.settings[Number(id)] = value;
        else warnings.push(`QMK setting ${id} is not supported by this keyboard and will be skipped.`);
    }
    const menuItems = new Map(customValueService.extractAllItemsWithRefs(current.menus ?? []).map(({ item, ref }) => [ref.key, item]));
    const supportedValues = (file.custom_values ?? []).filter(entry => {
        if (menuItems.has(entry.key)) {
            const width = customValueService.getByteWidth(menuItems.get(entry.key)!);
            if (entry.data.length !== width && !(entry.data.length === 1 && width > 1)) errors.push(`Setting ${entry.key} has ${entry.data.length} bytes; the keyboard expects ${width}.`);
            if (entry.data.length === 1 && entry.data[0] >= 2 ** (8 * width)) errors.push(`Setting ${entry.key} exceeds the keyboard’s ${width}-byte value capacity.`);
            if (!Array.isArray(entry.data) || !entry.data.length || entry.data.some(value => !Number.isInteger(value) || value < 0 || (entry.data.length > 1 && value > 255))) errors.push(`Setting ${entry.key} contains invalid value bytes.`);
            return true;
        }
        warnings.push(`Setting ${entry.key} is not supported by this keyboard and will be skipped.`);
        return false;
    });
    next.custom_values = [...(current.custom_values ?? []).filter(entry => !supportedValues.some(value => value.key === entry.key)), ...supportedValues];
    next.cosmetic = { ...current.cosmetic };
    const labels = new LabelService(usbInstance);
    for (const [field, kind, count] of [['layer','layer',file.layers], ['macros','macro',file.macros?.length], ['tapdances','tapdance',file.tapdances?.length]] as const) {
        if (!file.cosmetic?.[field]) continue;
        if ((current.svil_proto ?? 0) < 2) {
            warnings.push(`${kind} names cannot be restored to this firmware and will be kept from the keyboard.`);
            continue;
        }
        const map = { ...current.cosmetic?.[field] };
        for (let i = 0; i < (count ?? 0); i++) {
            const name = file.cosmetic[field]?.[i] ?? '';
            try { labels.validateName(current, kind, name); } catch (error) { errors.push(`${kind} ${i}: ${(error as Error).message}`); }
            map[i] = name;
        }
        next.cosmetic[field] = map;
    }
    summary.push('Entries beyond the file’s layers and tables will be kept from the keyboard.');
    return { keyboard: next, errors, warnings, summary };
}
