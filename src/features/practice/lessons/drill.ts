// Drill lessons (spec §5.5, §6.2, §7.3): an adaptive lesson over a slice of the
// keymap (a layer, a group, directions, hands, thumbs), over the weakest
// characters, or over one character and its cluster (Drill this key, §5.7).
//
// Every character in scope is included; the weakest is focused and every token
// contains it, so practice goes where it is needed (keybr's focus rule). Tokens
// follow the focused character's kind:
// - a symbol: a symbol template (content/symbols.ts) around short words of the
//   letter alphabet, nesting the other symbols in scope;
// - a digit: a number (keybr's Benford-shaped numbers for Group = Numbers with
//   Benford on, else digit tokens), sometimes inside a symbol template;
// - a letter: a word containing it, sometimes inside a symbol template.
// The letter alphabet for words is what Guided has unlocked for the profile (at
// least six letters) plus the letters in scope, so drills read like the user's
// Guided lessons.
import { symbolTokens } from '../content/symbols';
import type { KeymapResolution } from '../keymap/resolver';
import type { SvalKeyboard } from '../keymap/svalKeyboard';
import type { DrillSettings } from '../state/settings';
import { type WordList } from '../vendor/keybr/content/index.ts';
import { Lesson, LessonKey, LessonKeys, lessonProps, Target } from '../vendor/keybr/lesson/index.ts';
import { generateFragment } from '../vendor/keybr/lesson/text/fragment.ts';
import { uniqueWords } from '../vendor/keybr/lesson/text/words.ts';
import { Filter, Letter, type PhoneticModel } from '../vendor/keybr/phonetic-model/index.ts';
import { randomSample, type RNGStream } from '../vendor/keybr/rand/index.ts';
import type { KeyStats, KeyStatsMap, Result } from '../vendor/keybr/result/index.ts';
import type { Settings } from '../vendor/keybr/settings/index.ts';
import { filterByPaths, PracticeGuidedLesson } from './guided';
import { numberTokens } from './numbers';
import { type CharProgress, charClass, drillFocus, drillScope, scopeCandidates } from './scope';

/** Chance that a letter or number token is wrapped in a template of the symbols in scope. */
const WRAP_CHANCE = 0.4;
/** Words in symbol templates are short (§7.3). */
const SHORT_WORD = 5;
/** keybr's Guided rule: dictionary words when at least this many fit, else pseudo-words. */
const MIN_NATURAL_WORDS = 15;

/** A typed character's stats by code point, for any tracked character. */
export function statsByCodePoint(keyStatsMap: KeyStatsMap): (letter: Letter) => KeyStats {
    const byCodePoint = new Map<number, KeyStats>();
    for (const stats of keyStatsMap) byCodePoint.set(stats.letter.codePoint, stats);
    return (letter) => byCodePoint.get(letter.codePoint) ?? { letter, samples: [], timeToType: null, bestTimeToType: null };
}

export class PracticeDrillLesson extends Lesson {
    declare readonly keyboard: SvalKeyboard;
    readonly drill: DrillSettings;
    readonly #letters: readonly Letter[];
    readonly #guided: PracticeGuidedLesson;
    readonly #letterFrequency: ReadonlyMap<number, number>;
    /** Letters Guided has unlocked, refreshed by update(): the alphabet of the words. */
    #wordLetters: number[] = [];

    constructor(settings: Settings, keyboard: SvalKeyboard, model: PhoneticModel, wordList: WordList, drill: DrillSettings) {
        super(settings, keyboard, model);
        this.drill = drill;
        this.#guided = new PracticeGuidedLesson(settings, keyboard, model, wordList);
        this.#letterFrequency = new Map(this.model.letters.map((l) => [l.codePoint, l.f]));
        // Every character the filters admit: Weakest picks from them after each lesson.
        const candidates = scopeCandidates({
            resolution: this.resolution, cols: keyboard.board.cols, letterFrequency: this.#letterFrequency, drill,
            weight: (c) => this.codePoints.weight(c), progress: () => ({ confidence: null, samples: 0 }),
        });
        const known = new Map<number, Letter>([...Letter.programming, ...Letter.digits, ...this.model.letters].map((l) => [l.codePoint, l]));
        this.#letters = candidates.map((c) => known.get(c) ?? new Letter(c, 0.05));
    }

    get resolution(): KeymapResolution {
        return this.keyboard.resolution;
    }

    /** Characters the scope's filters admit (the drill's scope, or what Weakest chooses from). */
    override get letters(): readonly Letter[] {
        return this.#letters;
    }

    /** keybr's number shape (Benford) for Group = Numbers: the result's text type is `numbers` (§8.3). */
    get textType(): 'generated' | 'numbers' {
        return this.drill.group === 'numbers' && this.drill.benford && !this.drill.keys ? 'numbers' : 'generated';
    }

    override filter(results: readonly Result[]): readonly Result[] {
        return filterByPaths(results, this.resolution);
    }

    override update(keyStatsMap: KeyStatsMap): LessonKeys {
        const target = new Target(this.settings);
        const stats = statsByCodePoint(keyStatsMap);
        const letterOf = new Map(this.#letters.map((l) => [l.codePoint, l]));
        const progress = (c: number): CharProgress => {
            const s = stats(letterOf.get(c) ?? new Letter(c, 0));
            return { confidence: target.confidence(s.timeToType), samples: s.samples.length };
        };
        const scope = drillScope({
            resolution: this.resolution, cols: this.keyboard.board.cols, letterFrequency: this.#letterFrequency,
            drill: this.drill, weight: (c) => this.codePoints.weight(c), progress,
        });
        const focus = drillFocus(scope, progress, this.drill.focus);
        const keys = new LessonKeys(scope.map((c) => {
            const key = LessonKey.from(stats(letterOf.get(c)!), target);
            return c === focus ? key.asFocused() : key.asIncluded();
        }));
        // The word alphabet: Guided's unlocked letters (its own key stats by code point).
        const guidedStats = statsByCodePoint(keyStatsMap);
        const guided = this.#guided.update({
            letters: this.#guided.letters, results: keyStatsMap.results,
            get: guidedStats, [Symbol.iterator]: () => this.#guided.letters.map(guidedStats)[Symbol.iterator](),
        });
        this.#wordLetters = guided.findIncludedKeys().map((k) => k.letter.codePoint);
        return keys;
    }

    override generate(lessonKeys: LessonKeys, rng: RNGStream): string {
        const scope = lessonKeys.findIncludedKeys().map((k) => k.letter.codePoint);
        const focus = lessonKeys.findFocusedKey()?.letter.codePoint ?? null;
        const languageLetters = new Set(this.#letterFrequency.keys());
        const classOf = (c: number) => charClass(c, languageLetters);
        const scopeLetters = scope.filter((c) => classOf(c) === 'letter');
        const digits = scope.filter((c) => classOf(c) === 'digit');
        const symbols = scope.filter((c) => classOf(c) === 'symbol');
        const focusClass = focus != null ? classOf(focus) : null;

        const words = this.#words(scopeLetters, focusClass === 'letter' ? focus : null, rng);
        const plainWords = focusClass === 'letter' ? this.#words(scopeLetters, null, rng) : words;
        const numbers = numberTokens({ digits, focus: focusClass === 'digit' ? focus : null, benford: this.textType === 'numbers' }, rng);
        const otherNumbers = numberTokens({ digits, focus: null, benford: false }, rng);
        const spaceTypeable = this.resolution.primary(0x20) != null;
        const templateAlphabet = new Set([...symbols, ...digits]);
        const wrap = (inner: () => string) => symbolTokens({
            alphabet: templateAlphabet, spaceTypeable, focus: null, word: inner, number: () => otherNumbers?.() ?? null,
        }, rng);

        let next: () => string;
        if (focusClass === 'symbol' || (focusClass == null && symbols.length)) {
            next = symbolTokens({ alphabet: templateAlphabet, spaceTypeable, focus, word: plainWords, number: () => otherNumbers?.() ?? null }, rng);
        } else if (focusClass === 'digit' && numbers) {
            const wrapped = symbols.length ? wrap(numbers) : null;
            next = () => (wrapped && rng() < WRAP_CHANCE ? wrapped() : numbers());
        } else {
            const wrapped = symbols.length ? wrap(words) : null;
            next = () => (wrapped && rng() < WRAP_CHANCE ? wrapped() : words());
        }
        return generateFragment(this.settings, uniqueWords(next), { repeatWords: 1 });
    }

    /** Short words of the word alphabet (with the focused letter in each when given). */
    #words(scopeLetters: readonly number[], focus: number | null, rng: RNGStream): () => string {
        const alphabet = new Set([...this.#wordLetters, ...scopeLetters]);
        const letters = this.model.letters.filter((l) => alphabet.has(l.codePoint));
        if (letters.length === 0) {
            const any = this.model.letters.slice(0, 6).map((l) => String.fromCodePoint(l.codePoint));
            return () => (any.length ? randomSample(any, rng) : '');
        }
        const focused = focus != null ? letters.find((l) => l.codePoint === focus) ?? null : null;
        const filter = new Filter(letters, focused);
        const natural = this.#guided.dictionary.find(filter).filter((w) => w.length <= SHORT_WORD);
        const pseudo = () => {
            // Pseudo-words keep their focus; a few tries for a short one, else the first.
            let word = this.model.nextWord(filter, rng);
            for (let i = 0; i < 4 && word.length > SHORT_WORD; i++) word = this.model.nextWord(filter, rng);
            return word || String.fromCodePoint((focused ?? letters[0]).codePoint);
        };
        if (this.settings.get(lessonProps.guided.naturalWords) && natural.length >= MIN_NATURAL_WORDS) {
            return () => randomSample(natural, rng);
        }
        return pseudo;
    }
}
