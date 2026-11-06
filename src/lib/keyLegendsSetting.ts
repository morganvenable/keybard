import { LAYOUTS } from "@/components/Keyboards/layouts";

/** Settings > Key legends: the keyboard layout the computer uses, stored by the id of a LAYOUTS entry. */
export const INTERNATIONAL_SETTING = "international-keyboards";

/** Values stored before the setting named the layouts Keybard draws; names without a layout here fall back to US. */
const LEGACY_VALUES: Record<string, string> = {
    "french-azerty": "french",
    "french-mac": "fr_mac",
    "german-qwertz": "german",
    "swiss-qwertz": "swiss",
    "latin-american": "es_latam",
};

export function resolveKeyLegendsLayout(stored: unknown): string {
    if (typeof stored !== "string") return "us";
    if (LAYOUTS[stored]) return stored;
    return LEGACY_VALUES[stored] ?? "us";
}

export const KEY_LEGENDS_ITEMS = Object.values(LAYOUTS).map((l) => ({ label: l.label, value: l.value }));
