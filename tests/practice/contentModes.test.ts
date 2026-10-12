import { describe, expect, it } from 'vitest';
import { loadBooks } from '@/features/practice/content/books';
import { resolveKeymap } from '@/features/practice/keymap/resolver';
import { svalKeyboard } from '@/features/practice/keymap/svalKeyboard';
import { lessonFor } from '@/features/practice/state/session';
import { DEFAULT_SETTINGS, LESSON_SHAPING, practiceSettings } from '@/features/practice/state/settings';
import { Syntax } from '@/features/practice/vendor/keybr/code/index.ts';
import { PracticeBooksLesson, PracticeCodeLesson } from '@/features/practice/lessons/content';
import { LCG } from '@/features/practice/vendor/keybr/rand/index.ts';
import { flattenStyledText } from '@/features/practice/vendor/keybr/textinput/index.ts';
import { svalDefault } from './fixtures/boards';
import { englishModel, englishWords } from './fixtures/content';

const board = svalDefault();
const resolution = resolveKeymap({ keymap: board.keymap!, rows: board.rows, cols: board.cols });
const keyboard = svalKeyboard(board, resolution);
const content = { model: englishModel(), words: englishWords() };

describe('Keybr content modes', () => {
    it('loads all three complete books and begins at the selected paragraph', async () => {
        const books = await loadBooks();
        expect(Object.keys(books)).toEqual(['alice', 'wild', 'jekyll']);
        expect(books.alice.length).toBeGreaterThan(700);
        const lesson = lessonFor({ ...DEFAULT_SETTINGS, type: 'books', paragraph: 2 }, keyboard, { ...content, books }) as PracticeBooksLesson;
        expect(lesson.paragraphIndex).toBe(2);
        expect(lesson.wordList.length).toBeGreaterThan(20000);
        expect(flattenStyledText(lesson.generate())).toMatch(/^there was nothing/);
        const second = flattenStyledText(lesson.generate());
        expect(second).not.toMatch(/^there was nothing/);
    });
    it('uses the upstream generator for every available programming syntax', () => {
        for (const syntax of Syntax.ALL) {
            const lesson = lessonFor({ ...DEFAULT_SETTINGS, type: 'code', syntax: syntax.id }, keyboard, content) as PracticeCodeLesson;
            const text = flattenStyledText(lesson.generate(undefined as never, LCG(123)));
            expect(text.length).toBeGreaterThan(100);
            expect(text.length).toBeLessThanOrEqual(200);
        }
    });
    it('persists content selections and marks them as lesson-shaping', () => {
        const saved = practiceSettings({ type: 'books', book: 'wild', paragraph: 4, syntax: 'python', codeFlags: ['numbers'], bookLowercase: false });
        expect(practiceSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
        for (const setting of ['book', 'paragraph', 'syntax', 'codeFlags', 'bookLowercase', 'bookLettersOnly']) expect(LESSON_SHAPING).toContain(setting);
    });
});

it('clamps an out-of-range saved book paragraph to the same last passage shown by the chooser', async () => {
    const books = await loadBooks();
    const lesson = lessonFor({ ...DEFAULT_SETTINGS, type: 'books', paragraph: 10000 }, keyboard, { ...content, books }) as PracticeBooksLesson;
    expect(lesson.paragraphIndex).toBe(books.alice.length - 1);
});
