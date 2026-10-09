// Guided lessons (spec §6.2–§6.3, §7.1): keybr's GuidedLesson on the Svalboard
// keyboard adapter. The unlock loop, focus and text generation are keybr's; only
// the letter order (Center first or Frequency, from settings) and the history
// filter change.
import type { KeymapResolution } from '../keymap/resolver';
import type { SvalKeyboard } from '../keymap/svalKeyboard';
import { selectByPaths, PracticeResult } from '../store/results';
import { type WordList } from '../vendor/keybr/content/index.ts';
import { GuidedLesson } from '../vendor/keybr/lesson/index.ts';
import { type PhoneticModel } from '../vendor/keybr/phonetic-model/index.ts';
import { type Result } from '../vendor/keybr/result/index.ts';
import { type Settings } from '../vendor/keybr/settings/index.ts';

/**
 * Selects history by path key instead of keybr's layout family (§6.1): a
 * character's stats come only from samples on its current paths, so remapping a
 * key restarts that character alone, and switching back brings its stats back.
 */
export function filterByPaths(results: readonly Result[], resolution: KeymapResolution): Result[] {
    return results.map((result) => (result instanceof PracticeResult ? selectByPaths(result.record, resolution) : result));
}

export class PracticeGuidedLesson extends GuidedLesson {
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
}
