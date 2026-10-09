// Number tokens for Drill → Numbers (spec §7.3): keybr's number generator
// (NumbersLesson.nextWord: 3–6 digits, no digit twice in a row, the first digit
// Benford-weighted) restricted to the digits in scope, or plain digit tokens with
// Benford off. Every token contains the focused digit, so the drill adapts.
import { Letter } from '../vendor/keybr/phonetic-model/index.ts';
import { randomSample, type RNG, weightedRandomSample } from '../vendor/keybr/rand/index.ts';

const ZERO = 0x30;

export interface NumberTokenOptions {
    /** Digits in scope (code points). */
    digits: readonly number[];
    /** The focused digit, or null. */
    focus: number | null;
    /** keybr's number shape: the first digit follows Benford's law. Off: uniform digit tokens. */
    benford: boolean;
}

/** A number-token generator; null when there are no digits. */
export function numberTokens({ digits, focus, benford }: NumberTokenOptions, rng: RNG): (() => string) | null {
    const all = Letter.digits.filter((d) => digits.includes(d.codePoint));
    if (all.length === 0) return null;
    const nonZero = all.filter((d) => d.codePoint !== ZERO);
    const leading = nonZero.length ? nonZero : all;
    return () => {
        // keybr: 3–6 digits; drill tokens without Benford: 2–5.
        const length = benford ? Math.floor(3 + rng() * 4) : Math.floor(2 + rng() * 4);
        const word: number[] = [];
        let last: number | null = null;
        for (let i = 0; i < length; i++) {
            const pool = i === 0 ? leading : all;
            const options = pool.length > 1 ? pool.filter((d) => d.codePoint !== last) : pool;
            const weighted = i === 0 && benford && options.some((d) => d.f > 0);
            const digit = weighted ? weightedRandomSample(options, ({ f }) => f, rng) : randomSample(options, rng);
            word.push(digit.codePoint);
            last = digit.codePoint;
        }
        if (focus != null && digits.includes(focus) && !word.includes(focus)) {
            // Put the focused digit in, never as a leading zero.
            const slots = word.map((_, i) => i).filter((i) => !(i === 0 && focus === ZERO && length > 1));
            const at = randomSample(slots, rng);
            word[at] = focus;
        }
        return String.fromCodePoint(...word);
    };
}
