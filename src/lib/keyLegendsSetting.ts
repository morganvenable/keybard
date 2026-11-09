import { LAYOUTS } from "@/components/Keyboards/layouts";
import { AUTO_LAYOUT } from "@/lib/autoLegends";

/**
 * Settings > Key legends: "auto" (Automatic, the default: follow the computer's layout) or the id of a
 * LAYOUTS entry the user chose.
 */
export const INTERNATIONAL_SETTING = "international-keyboards";
export const DEFAULT_KEY_LEGENDS = AUTO_LAYOUT;

/** Values stored before the setting named the layouts Keybard draws; names without a layout here fall back to US. */
const LEGACY_VALUES: Record<string, string> = {
    "french-azerty": "french",
    "french-mac": "fr_mac",
    "german-qwertz": "german",
    "swiss-qwertz": "swiss",
    "latin-american": "es_latam",
};

/** The stored Key legends choice: "auto", a layout id, or US for a name Keybard doesn't know. Nothing stored is Automatic. */
export function resolveKeyLegendsLayout(stored: unknown): string {
    if (stored === undefined || stored === null || stored === AUTO_LAYOUT) return AUTO_LAYOUT;
    if (typeof stored !== "string") return "us";
    if (LAYOUTS[stored]) return stored;
    return LEGACY_VALUES[stored] ?? "us";
}

/** Layouts that only borrow another layout's rows. They are not offered, but a stored one still works. */
export const PLACEHOLDER_LAYOUTS = new Set(["zh_pinyin", "zh_zhuyin", "fr_ca", "fr_mac", "japanese", "korean", "pt", "es_latam", "turkish", "ukrainian"]);

/** The layouts offered for Key legends: those with their own key map. */
export const LISTED_LAYOUTS = Object.values(LAYOUTS).filter((l) => !PLACEHOLDER_LAYOUTS.has(l.value));

/** Settings' Key legends choices: Automatic, then every listed layout. */
export const KEY_LEGENDS_ITEMS = [{ label: "Automatic", value: AUTO_LAYOUT }, ...LISTED_LAYOUTS.map((l) => ({ label: l.label, value: l.value }))];

/** The choices for a select showing `choice`: a stored placeholder layout stays shown so the select names it. */
export function keyLegendsItems(choice: string): { label: string; value: string }[] {
    if (KEY_LEGENDS_ITEMS.some((i) => i.value === choice) || !LAYOUTS[choice]) return KEY_LEGENDS_ITEMS;
    return [...KEY_LEGENDS_ITEMS, { label: LAYOUTS[choice].label, value: choice }];
}

/**
 * The layout selects beside the key pickers: the same choices as Settings. Automatic names the layout it shows
 * ("Automatic: German"); compact selects show short codes ("AUTO", "GERMAN").
 */
export function keyLegendsOptions(choice: string, shownLayout: string, compact = false): { label: string; value: string }[] {
    return keyLegendsItems(choice).map((item) => {
        if (compact) return { label: item.value.toUpperCase(), value: item.value };
        if (item.value === AUTO_LAYOUT) return { label: `Automatic: ${LAYOUTS[shownLayout]?.label ?? LAYOUTS.us.label}`, value: item.value };
        return item;
    });
}
