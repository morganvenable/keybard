import { AltRepeatKeyOptions, ComboOptions, LeaderOptions, type AltRepeatKeyEntry, type ComboEntry, type LeaderEntry } from "@/types/keyboard.types";

const isEmptyKey = (kc: unknown) => kc === undefined || kc === null || kc === "" || kc === "KC_NO" || kc === 0;

/** An unused combo slot: no trigger keys and no output. */
export const isBlankCombo = (combo: ComboEntry | undefined): boolean =>
    !combo || ((combo.keys ?? []).every(isEmptyKey) && isEmptyKey(combo.output));

// New combos, leaders and alt-repeat keys start on: a slot the board has never
// used reads back zeroed, which is off.

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

/** An unused leader slot: no sequence keys and no output. */
export const isBlankLeader = (leader: LeaderEntry | undefined): boolean =>
    !leader || ((leader.sequence ?? []).every(isEmptyKey) && isEmptyKey(leader.output));

/** The same rule for leaders: the first key or output in a blank slot turns it on. Mutates and returns `after`. */
export function startNewLeader(before: LeaderEntry | undefined, after: LeaderEntry): LeaderEntry {
    if (isBlankLeader(before) && !isBlankLeader(after)) after.options = (after.options ?? 0) | LeaderOptions.ENABLED;
    return after;
}

/** An unused alt-repeat slot: no key and no alternate key. */
export const isBlankAltRepeat = (entry: AltRepeatKeyEntry | undefined): boolean =>
    !entry || (isEmptyKey(entry.keycode) && isEmptyKey(entry.alt_keycode));

/** The same rule for alt-repeat keys. Mutates and returns `after`. */
export function startNewAltRepeat(before: AltRepeatKeyEntry | undefined, after: AltRepeatKeyEntry): AltRepeatKeyEntry {
    if (isBlankAltRepeat(before) && !isBlankAltRepeat(after)) after.options = (after.options ?? 0) | AltRepeatKeyOptions.ENABLED;
    return after;
}
