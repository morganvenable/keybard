// Symbol drill tokens (spec §7.3): short words of the letter alphabet wrapped in
// code- and prose-shaped templates, so symbols are practiced where they occur.
//
// - A template is eligible only when every symbol in it is in the drill alphabet
//   (and Space can be typed, for the templates that have spaces), so a token never
//   asks for a character the keymap can't type.
// - When a symbol is focused, every token contains it (keybr's Filter focus rule).
//   A focused symbol no template covers gets a plain prefix or suffix template.
// - Templates nest one level (`(#w)`, `#w!`, `#w * #w`), so a symbol with a single
//   template still mixes with the other symbols in scope.
import { randomSample, type RNG } from '../vendor/keybr/rand/index.ts';

/** Where a template takes a word. */
export const WORD = '○';
/** Where a template takes a number (digits of the drill alphabet). */
export const NUMBER = 'Ⓝ';

/** The §7.3 template set. */
export const SYMBOL_TEMPLATES: readonly string[] = [
    // paired brackets
    `(${WORD})`, `[${WORD}]`, `{${WORD}}`, `<${WORD}>`,
    // paired quotes
    `"${WORD}"`, `'${WORD}'`, `\`${WORD}\``,
    // suffix
    `${WORD},`, `${WORD}.`, `${WORD};`, `${WORD}:`, `${WORD}!`, `${WORD}?`,
    // infix
    ...['=', '+', '-', '*', '/', '%', '&', '|', '^'].map((op) => `${WORD} ${op} ${WORD}`),
    // prefix
    `#${WORD}`, `@${WORD}`, `$${WORD}`, `~/${WORD}`,
    // joiners
    `${WORD}_${WORD}`, `${WORD}-${WORD}`, `${WORD}/${WORD}`, `${WORD}\\${WORD}`,
    // multi-character operators
    `${WORD}->${WORD}`, `${WORD}=>${WORD}`, `${WORD}::${WORD}`, `${WORD} != ${WORD}`, `${WORD} <= ${WORD}`,
    // with digits, when digits are in the alphabet
    `${NUMBER}%`, `$${NUMBER}`, `#${NUMBER}`,
];

const SPACE = 0x20;
/** Chance that a slot holds another template instead of a word (one level deep). */
const NEST_CHANCE = 0.35;

/** The characters a template asks for besides its words and numbers (Space included). */
export function templateChars(template: string): number[] {
    const chars = new Set<number>();
    for (const ch of template) if (ch !== WORD && ch !== NUMBER) chars.add(ch.codePointAt(0)!);
    return [...chars];
}

export interface SymbolTokenSource {
    /** Symbols and digits the drill practices. */
    alphabet: ReadonlySet<number>;
    /** Space has a path (templates with spaces need it). */
    spaceTypeable: boolean;
    /** The focused symbol, or null. */
    focus: number | null;
    /** A short word of the letter alphabet. */
    word: () => string;
    /** A number from the alphabet's digits; null when it has none. */
    number: () => string | null;
}

/** Templates every one of whose characters can be typed in this drill. */
export function eligibleTemplates(source: Pick<SymbolTokenSource, 'alphabet' | 'spaceTypeable'>, hasNumber: boolean): string[] {
    return SYMBOL_TEMPLATES.filter((template) => {
        if (template.includes(NUMBER) && !hasNumber) return false;
        return templateChars(template).every((c) => (c === SPACE ? source.spaceTypeable : source.alphabet.has(c)));
    });
}

/** Builds a symbol-token generator for a drill alphabet (§7.3). */
export function symbolTokens(source: SymbolTokenSource, rng: RNG): () => string {
    const hasNumber = source.number() != null;
    const eligible = eligibleTemplates(source, hasNumber);
    const focus = source.focus != null ? String.fromCodePoint(source.focus) : null;
    let outer = focus ? eligible.filter((t) => t.includes(focus)) : eligible;
    if (outer.length === 0) {
        // A focused symbol no template covers (or no eligible template at all): plain prefix and suffix.
        const symbol = focus ?? [...source.alphabet].map((c) => String.fromCodePoint(c)).find((c) => !/\d/.test(c));
        outer = symbol ? [`${symbol}${WORD}`, `${WORD}${symbol}`] : [WORD];
    }
    // Inner templates mix in the other symbols; numbers stay plain inside.
    const inner = eligible.filter((t) => !t.includes(NUMBER));

    const fill = (template: string, depth: number): string => {
        // Never the same template twice in one token (no `w;;`).
        const nested = depth === 0 ? inner.filter((t) => t !== template) : [];
        let out = '';
        for (const ch of template) {
            if (ch === WORD) {
                out += nested.length && rng() < NEST_CHANCE ? fill(randomSample(nested, rng), depth + 1) : source.word();
            } else if (ch === NUMBER) {
                out += source.number() ?? '';
            } else {
                out += ch;
            }
        }
        return out;
    };
    return () => fill(randomSample(outer, rng), 0);
}
