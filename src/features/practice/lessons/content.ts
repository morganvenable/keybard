import { Syntax } from '../vendor/keybr/code/index.ts';
import { Lesson, type LessonKeys, Target, lessonProps } from '../vendor/keybr/lesson/index.ts';
import { NumbersLesson } from '../vendor/keybr/lesson/numbers.ts';
import { Letter } from '../vendor/keybr/phonetic-model/index.ts';
import type { KeyStatsMap, Result } from '../vendor/keybr/result/index.ts';
import type { RNGStream } from '../vendor/keybr/rand/index.ts';
import type { SvalKeyboard } from '../keymap/svalKeyboard';
import type { PracticeSettings } from '../state/settings';
import { toKeybrSettings } from '../state/settings';
import type { PracticeContent } from '../content/loader';
import { BooksLesson } from '../vendor/keybr/lesson/books.ts';
import { BOOKS } from '../content/books';
import { filterByPaths } from './guided';
import { includeLetters } from './words';

export function syntaxFor(id: string) { return [...Syntax.ALL].find(s => s.id === id) ?? Syntax.JAVASCRIPT_EXP; }

/** Keybr's code grammar and feature flags, with path-aware Svalboard history. */
export class PracticeCodeLesson extends Lesson {
    constructor(readonly practice: PracticeSettings, readonly board: SvalKeyboard, content: PracticeContent) {
        super(toKeybrSettings(practice), board, content.model);
    }
    get letters() { return Letter.programming.filter(l => this.board.resolution.paths.has(l.codePoint)); }
    filter(results: readonly Result[]) { return filterByPaths(results, this.board.resolution); }
    update(stats: KeyStatsMap) { return includeLetters(this.letters, stats, new Target(this.settings)); }
    generate(_keys: LessonKeys, rng: RNGStream) { return syntaxFor(this.practice.syntax).generate(new Set(this.practice.codeFlags), rng); }
}

export class PracticeNumbersLesson extends NumbersLesson {
    declare readonly keyboard: SvalKeyboard;
    get letters() { return Letter.digits.filter(l => this.keyboard.resolution.paths.has(l.codePoint)); }
    filter(results: readonly Result[]) { return filterByPaths(results, this.keyboard.resolution); }
    update(stats: KeyStatsMap) { return includeLetters(this.letters, stats, new Target(this.settings)); }
}

/** Upstream book engine with full text and paragraph selection. */
export class PracticeBooksLesson extends BooksLesson {
    declare readonly keyboard: SvalKeyboard;
    constructor(practice: PracticeSettings, board: SvalKeyboard, content: PracticeContent) {
        const paragraphs = content.books?.[practice.book] ?? [];
        super(toKeybrSettings(practice)
            .set(lessonProps.books.paragraphIndex, Math.min(practice.paragraph, Math.max(0, paragraphs.length - 1)))
            .set(lessonProps.books.lowercase, practice.bookLowercase)
            .set(lessonProps.books.lettersOnly, practice.bookLettersOnly), board, content.model,
            { book: BOOKS.find(b => b.id === practice.book) ?? BOOKS[0], content: [['', paragraphs]] });
    }
    get empty() { return !this.wordList.some(word => word.trim()); }
    filter(results: readonly Result[]) { return filterByPaths(results, this.keyboard.resolution); }
    update(stats: KeyStatsMap) { return includeLetters(this.letters, stats, new Target(this.settings)); }
}
