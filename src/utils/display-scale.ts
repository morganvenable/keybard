/**
 * Settings shown in a different unit from the one the firmware stores. Deep
 * idle is stored in whole seconds (id_scan_deep_after_s, 0-7200), while every
 * other idle timing is in ms, so Keybard shows and takes it in ms: 1000 per
 * stored unit. A typed value that isn't a whole second is rounded to one.
 */

/** Stored seconds per shown ms, for the settings Keybard shows in ms. */
export const MS_PER_STORED_SECOND = 1000;

/** The shown value of a stored one. */
export function toDisplay(stored: number, scale: number): number {
    return stored * scale;
}

/** The stored value of a shown one: the nearest whole stored unit. */
export function fromDisplay(shown: number, scale: number): number {
    return Math.round(shown / scale);
}

/** True when a shown value is stored exactly, with no rounding. */
export function storesExactly(shown: number, scale: number): boolean {
    return scale <= 1 || shown % scale === 0;
}

/** The note shown after a typed value was rounded to whole seconds. */
export function roundedNote(stored: number, scale: number): string {
    return `Rounded to whole seconds: ${toDisplay(stored, scale)} ms`;
}
