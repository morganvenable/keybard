// Words lessons (spec §5.5, §7.1): keybr's WordListLesson, random words from the
// most frequent English words that can be typed on the keymap (Word list size,
// Long words only), with the Capitals and Punctuation sliders. Every letter is
// included and nothing is focused, as in keybr; history is selected by path key
// (§6.1) like every Practice lesson.
import type { KeymapResolution } from '../keymap/resolver';
import type { SvalKeyboard } from '../keymap/svalKeyboard';
import { type WordList } from '../vendor/keybr/content/index.ts';
import { LessonKey, LessonKeys, Target, WordListLesson } from '../vendor/keybr/lesson/index.ts';
import { type PhoneticModel } from '../vendor/keybr/phonetic-model/index.ts';
import type { KeyStatsMap, Result } from '../vendor/keybr/result/index.ts';
import type { Settings } from '../vendor/keybr/settings/index.ts';
import { statsByCodePoint } from './drill';
import { filterByPaths } from './guided';

export class PracticeWordsLesson extends WordListLesson {
    declare readonly keyboard: SvalKeyboard;

    constructor(settings: Settings, keyboard: SvalKeyboard, model: PhoneticModel, wordList: WordList) {
        super(settings, keyboard, model, wordList);
    }

    get resolution(): KeymapResolution {
        return this.keyboard.resolution;
    }

    override filter(results: readonly Result[]): readonly Result[] {
        return filterByPaths(results, this.resolution);
    }

    /** Every letter of the lesson, included (keybr's includeAll over the lesson's letters only). */
    override update(keyStatsMap: KeyStatsMap): LessonKeys {
        return includeLetters(this.letters, keyStatsMap, new Target(this.settings));
    }
}

/** LessonKeys with every one of `letters` included (Practice tracks more characters than a lesson's letters). */
export function includeLetters(letters: WordListLesson['letters'], keyStatsMap: KeyStatsMap, target: Target): LessonKeys {
    const stats = statsByCodePoint(keyStatsMap);
    return new LessonKeys(letters.map((letter) => LessonKey.from(stats(letter), target).asIncluded()));
}
