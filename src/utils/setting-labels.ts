/**
 * Names people know a setting by, for settings a layout holds that the
 * connected firmware doesn't have: the label from the file's own menus
 * (with the section it sits in), or the QMK setting's title.
 */
import type { CustomUIMenuItem } from '../types/keyboard.types';
import { QMK_SETTINGS } from '../constants/qmk-settings';

/** The menu label of a value key, with its section: "Auto Mouse: Layer Timeout". */
export function menuLabel(key: string, menus: CustomUIMenuItem[] | undefined): string | undefined {
    const walk = (items: CustomUIMenuItem[], section: string | undefined): string | undefined => {
        for (const item of items) {
            const content = item.content;
            if (!Array.isArray(content) || !content.length) continue;
            if (typeof content[0] === 'string') {
                if (content[0] === key && item.label) return section && section !== item.label ? `${section}: ${item.label}` : item.label;
                continue;
            }
            const found = walk(content as CustomUIMenuItem[], item.label ?? section);
            if (found) return found;
        }
        return undefined;
    };
    return walk(menus ?? [], undefined);
}

/** A value key as words, when no menu names it: "id_left_dpi" is "Left dpi". */
export function keyAsWords(key: string): string {
    const words = key.replace(/^id_/, '').replace(/_/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : key;
}

/** A custom value's name, from the file's menus or its key. */
export function customValueLabel(key: string, menus: CustomUIMenuItem[] | undefined): string {
    return menuLabel(key, menus) ?? keyAsWords(key);
}

/** A QMK setting's name: its field's title, or the group's when one setting holds several fields. */
export function qmkSettingLabel(qsid: number): string {
    for (const tab of QMK_SETTINGS.tabs) {
        const fields = tab.fields.filter(field => field.qsid === qsid);
        if (fields.length === 1) return fields[0].title;
        if (fields.length > 1) return tab.name;
    }
    return `QMK setting ${qsid}`;
}
