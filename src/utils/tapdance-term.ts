/** The term a new tap dance starts with, in milliseconds. */
export const DEFAULT_TAPDANCE_TERM_MS = 200;
/** The shortest term a tap dance works with, in milliseconds. */
export const MIN_TAPDANCE_TERM_MS = 20;
/** The longest term the firmware stores (bits 0-14). */
export const MAX_TAPDANCE_TERM_MS = 32767;

/** A term the board can't use: missing, or below the minimum. A term of 0 breaks the tap dance. */
export function isUnusableTapdanceTerm(term: unknown): boolean {
    return typeof term !== "number" || !Number.isFinite(term) || term < MIN_TAPDANCE_TERM_MS;
}

/** A term within the limits the editor allows. */
export function clampTapdanceTerm(ms: number): number {
    return Math.max(MIN_TAPDANCE_TERM_MS, Math.min(MAX_TAPDANCE_TERM_MS, Math.round(ms)));
}

const TAP_DANCE_SLOTS = ["tap", "hold", "doubletap", "taphold"] as const;
type TermEntry = { tap?: string; hold?: string; doubletap?: string; taphold?: string; tapping_term?: number };

/** A tap dance with a key in it (an unused slot has KC_NO in all four). */
export function tapdanceInUse(td: TermEntry | undefined | null): boolean {
    return !!td && TAP_DANCE_SLOTS.some((k) => !!td[k] && td[k] !== "KC_NO");
}

/**
 * A key going into an unused slot that holds an unusable term (older firmware stored 0):
 * that edit gives the slot the default term too, in the draft, so the person sees the term
 * that is written with their key. A slot in use keeps its term as it is.
 */
export function startTapdance<T extends TermEntry>(before: T | undefined, after: T): T {
    if (!before || tapdanceInUse(before) || !tapdanceInUse(after) || !isUnusableTapdanceTerm(after.tapping_term)) return after;
    return { ...after, tapping_term: DEFAULT_TAPDANCE_TERM_MS };
}

/** A term the board can use: the term itself, or the default in place of an unusable one. */
export function usableTapdanceTerm(term: unknown): number {
    return isUnusableTapdanceTerm(term) ? DEFAULT_TAPDANCE_TERM_MS : Math.round(term as number);
}
