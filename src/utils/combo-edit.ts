import { ComboOptions, type ComboEntry } from "@/types/keyboard.types";

const isEmptyKey = (kc: unknown) => kc === undefined || kc === null || kc === "" || kc === "KC_NO" || kc === 0;

/** An unused combo slot: no trigger keys and no output. */
export const isBlankCombo = (combo: ComboEntry | undefined): boolean =>
    !combo || ((combo.keys ?? []).every(isEmptyKey) && isEmptyKey(combo.output));

/**
 * A new combo starts on. When an edit puts the first key or output into a
 * blank slot, the edited entry is turned on (its combo term is kept). Combos
 * that already had keys or an output keep their on/off as it is. Mutates and
 * returns `after`.
 */
export function startNewCombo(before: ComboEntry | undefined, after: ComboEntry): ComboEntry {
    if (isBlankCombo(before) && !isBlankCombo(after)) after.options = (after.options ?? 0) | ComboOptions.ENABLED;
    return after;
}
