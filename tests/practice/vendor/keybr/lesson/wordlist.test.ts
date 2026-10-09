import { describe, it, test } from "vitest";
// Ported for Keybard: keybr's layout tables are not vendored, so the keyboard is
// the default Svalboard keymap through Practice's adapter (spec §9.2).
import { fakeSvalKeyboard } from "../../../fixtures/keyboard.ts";
import { FakePhoneticModel } from "@/features/practice/vendor/keybr/phonetic-model/index.ts";
import { makeKeyStatsMap } from "@/features/practice/vendor/keybr/result/index.ts";
import { Settings } from "@/features/practice/vendor/keybr/settings/index.ts";
import { deepEqual, equal, isNull } from "../../rich-assert.ts";
import { LessonKey } from "@/features/practice/vendor/keybr/lesson/key.ts";
import { lessonProps } from "@/features/practice/vendor/keybr/lesson/settings.ts";
import { WordListLesson } from "@/features/practice/vendor/keybr/lesson/wordlist.ts";

test("provide key set", () => {
  const settings = new Settings();
  const keyboard = fakeSvalKeyboard();
  const model = new FakePhoneticModel();
  const wordList = ["abc", "def", "ghi"];
  const lesson = new WordListLesson(settings, keyboard, model, wordList);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

  deepEqual(lessonKeys.findIncludedKeys(), [
    new LessonKey({
      letter: FakePhoneticModel.letter1,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter2,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter3,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter4,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter5,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter6,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter7,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter8,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter9,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
    new LessonKey({
      letter: FakePhoneticModel.letter10,
      samples: [],
      timeToType: null,
      bestTimeToType: null,
      confidence: null,
      bestConfidence: null,
      isIncluded: true,
      isFocused: false,
      isForced: false,
    }),
  ]);
  deepEqual(lessonKeys.findExcludedKeys(), []);
  isNull(lessonKeys.findFocusedKey());
});

test("filter words", () => {
  const settings = new Settings();
  const keyboard = fakeSvalKeyboard();
  const model = new FakePhoneticModel();
  const wordList = ["abc", "def", "こんにちは"];
  const lesson = new WordListLesson(settings, keyboard, model, wordList);

  deepEqual(lesson.wordList, ["abc", "def"]);
});

describe("generate randomized text using settings", () => {
  const keyboard = fakeSvalKeyboard();

  it("should transform to lower case", () => {
    const settings = new Settings()
      .set(lessonProps.capitals, 0)
      .set(lessonProps.punctuators, 0);
    const model = new FakePhoneticModel();
    const wordList = ["abc", "def", "ghi"];
    const lesson = new WordListLesson(settings, keyboard, model, wordList);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, model.rng),
      "abc def ghi abc def ghi abc def ghi abc def ghi abc def ghi abc def " +
        "ghi abc def ghi abc def ghi abc def ghi abc def ghi abc def ghi abc",
    );
  });

  it("should preserve case", () => {
    const settings = new Settings()
      .set(lessonProps.capitals, 1)
      .set(lessonProps.punctuators, 1);
    const model = new FakePhoneticModel();
    const wordList = ["abc", "def", "ghi"];
    const lesson = new WordListLesson(settings, keyboard, model, wordList);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, model.rng),
      "Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, " +
        "Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc, Def, Ghi! Abc,",
    );
  });
});
