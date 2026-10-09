// Custom text lessons (spec §5.10, §7.4): keybr's CustomTextLesson on the user's
// text (up to 10,000 characters; Lowercase, Letters only and Randomize).
//
// Characters with no path on the keymap are listed in P6 and stripped here,
// before keybr sees the text. Space, newline and tab have paths through the
// resolver's whitespace table (§9.4), so ordinary text keeps its spaces; keybr
// collapses any run of whitespace to one space between words.
import type { KeymapResolution } from '../keymap/resolver';
import type { SvalKeyboard } from '../keymap/svalKeyboard';
import { CustomTextLesson, type LessonKeys, lessonProps, Target } from '../vendor/keybr/lesson/index.ts';
import { type PhoneticModel } from '../vendor/keybr/phonetic-model/index.ts';
import type { KeyStatsMap, Result } from '../vendor/keybr/result/index.ts';
import type { Settings } from '../vendor/keybr/settings/index.ts';
import { filterByPaths } from './guided';
import { includeLetters } from './words';

const SPACE = 0x20;
const isWhitespace = (ch: string) => /\s/u.test(ch);

/**
 * Characters of a text the keymap can't type, in order of first appearance (P6).
 * Whitespace other than Space is never listed: keybr turns it into spaces.
 */
export function untypeableChars(text: string, resolution: KeymapResolution): number[] {
    return resolution.untypeable(text).filter((c) => c === SPACE || !isWhitespace(String.fromCodePoint(c)));
}

/** The text without the characters the keymap can't type; whitespace is kept for keybr to collapse. */
export function stripUntypeable(text: string, resolution: KeymapResolution): string {
    let out = '';
    for (const ch of text) {
        if (isWhitespace(ch) || resolution.paths.has(ch.codePointAt(0)!)) out += ch;
    }
    return out;
}

export class PracticeCustomLesson extends CustomTextLesson {
    declare readonly keyboard: SvalKeyboard;

    constructor(settings: Settings, keyboard: SvalKeyboard, model: PhoneticModel) {
        const content = settings.get(lessonProps.customText.content);
        super(settings.set(lessonProps.customText.content, stripUntypeable(content, keyboard.resolution)), keyboard, model);
    }

    get resolution(): KeymapResolution {
        return this.keyboard.resolution;
    }

    /** No word of the text can be typed (keybr would fill the lesson with "?"). */
    get empty(): boolean {
        return this.wordList.every((word) => word === '');
    }

    override filter(results: readonly Result[]): readonly Result[] {
        return filterByPaths(results, this.resolution);
    }

    override update(keyStatsMap: KeyStatsMap): LessonKeys {
        return includeLetters(this.letters, keyStatsMap, new Target(this.settings));
    }
}
