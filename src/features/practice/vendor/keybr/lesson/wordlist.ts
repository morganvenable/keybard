// Modified for Keybard: unused parameters are prefixed with `_` for Keybard's
// `noUnusedParameters`/`noUnusedLocals` compiler settings.
import { type WordList } from "../content/index.ts";
import { type Keyboard } from "../keyboard/index.ts";
import { Letter, type PhoneticModel } from "../phonetic-model/index.ts";
import { type RNGStream } from "../rand/index.ts";
import { type KeyStatsMap } from "../result/index.ts";
import { type Settings } from "../settings/index.ts";
import { filterWordList } from "./dictionary.ts";
import { LessonKeys } from "./key.ts";
import { Lesson } from "./lesson.ts";
import { lessonProps } from "./settings.ts";
import { Target } from "./target.ts";
import { generateFragment } from "./text/fragment.ts";
import { mangledWords, randomWords, uniqueWords } from "./text/words.ts";

export class WordListLesson extends Lesson {
  readonly wordList: WordList;

  constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
    wordList: WordList,
  ) {
    super(settings, keyboard, model);
    const wordListSize = settings.get(lessonProps.wordList.wordListSize);
    const longWordsOnly = settings.get(lessonProps.wordList.longWordsOnly);
    this.wordList = filterWordList(wordList, this.codePoints)
      .filter((word) => !longWordsOnly || word.length > 3)
      .slice(0, wordListSize);
  }

  override get letters() {
    return this.model.letters;
  }

  override update(keyStatsMap: KeyStatsMap) {
    return LessonKeys.includeAll(keyStatsMap, new Target(this.settings));
  }

  override generate(_lessonKeys: LessonKeys, rng: RNGStream) {
    const wordGenerator = randomWords(this.wordList, rng);
    const words = mangledWords(
      uniqueWords(wordGenerator),
      this.model.language,
      Letter.restrict(Letter.punctuators, this.codePoints),
      {
        withCapitals: this.settings.get(lessonProps.capitals),
        withPunctuators: this.settings.get(lessonProps.punctuators),
      },
      rng,
    );
    return generateFragment(this.settings, words, {
      repeatWords: this.settings.get(lessonProps.repeatWords),
    });
  }
}
