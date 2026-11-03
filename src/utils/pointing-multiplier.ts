// The sniper and boost factors shown in the pills: only what the board reports.
// POINTING_MOTION (0x2D) carries the factors in force on firmware that has them
// (payload [53] = 'F', [54] the sniper divisor, [55] the boost multiplier; see
// pointing-motion.ts). Without them the pill shows its name alone: Keybard
// never guesses a factor from the keymap.

export interface PointingFactors { sniperDivisor: number; boostFactor: number }

/** "×0.33" for a divisor of 3, "×0.5" for 2, "×0.2" for 5. */
export function sniperLabel(divisor: number): string {
    return `×${Math.round(100 / divisor) / 100}`;
}
export function boostLabel(factor: number): string {
    return `×${factor}`;
}

/** The number each pill shows: the reported factors, or nothing when the board doesn't report them. */
export function pillLabels(f: PointingFactors | null | undefined): { sniper: string; boost: string } {
    return f ? { sniper: sniperLabel(f.sniperDivisor), boost: boostLabel(f.boostFactor) } : { sniper: "", boost: "" };
}

/** The labels in effect for the modes that are on, sniper first (empty strings when not reported). */
export function multiplierLabels(modes: { sniper: boolean; boost: boolean }, f: PointingFactors | null | undefined): string[] {
    const labels = pillLabels(f);
    const out: string[] = [];
    if (modes.sniper) out.push(labels.sniper);
    if (modes.boost) out.push(labels.boost);
    return out;
}

/** Same factors (both absent counts as the same). */
export function sameFactors(a: PointingFactors | null | undefined, b: PointingFactors | null | undefined): boolean {
    if (!a || !b) return !a && !b;
    return a.sniperDivisor === b.sniperDivisor && a.boostFactor === b.boostFactor;
}
