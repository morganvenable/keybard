import { describe, it, test } from "vitest";
// Ported for Keybard: keybr's layout tables are not vendored, so the keyboard is
// the default Svalboard keymap through Practice's adapter (spec §9.2).
import { fakeSvalKeyboard } from "../../../fixtures/keyboard.ts";
import { FakePhoneticModel, Letter } from "@/features/practice/vendor/keybr/phonetic-model/index.ts";
import { LCG } from "@/features/practice/vendor/keybr/rand/index.ts";
import { makeKeyStatsMap } from "@/features/practice/vendor/keybr/result/index.ts";
import { Settings } from "@/features/practice/vendor/keybr/settings/index.ts";
import { deepEqual, equal, isNull } from "../../rich-assert.ts";
import { LessonKey } from "@/features/practice/vendor/keybr/lesson/key.ts";
import { NumbersLesson } from "@/features/practice/vendor/keybr/lesson/numbers.ts";
import { lessonProps } from "@/features/practice/vendor/keybr/lesson/settings.ts";

test("provide key set", () => {
  const settings = new Settings();
  const keyboard = fakeSvalKeyboard();
  const model = new FakePhoneticModel();
  const lesson = new NumbersLesson(settings, keyboard, model);
  const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

  deepEqual(lessonKeys.findIncludedKeys(), [
    new LessonKey({
      letter: Letter.digits[0],
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
      letter: Letter.digits[1],
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
      letter: Letter.digits[2],
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
      letter: Letter.digits[3],
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
      letter: Letter.digits[4],
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
      letter: Letter.digits[5],
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
      letter: Letter.digits[6],
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
      letter: Letter.digits[7],
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
      letter: Letter.digits[8],
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
      letter: Letter.digits[9],
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

describe("generate text using settings", () => {
  const keyboard = fakeSvalKeyboard();

  it("should generate using the Benford's law", () => {
    const settings = new Settings().set(lessonProps.numbers.benford, true);
    const model = new FakePhoneticModel();
    const lesson = new NumbersLesson(settings, keyboard, model);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, LCG(123)),
      "487617 286 59728 489 4829 103825 356 5049 28027 6869 3985 1820",
    );
  });

  it("should generate not using the Benford's law", () => {
    const settings = new Settings().set(lessonProps.numbers.benford, false);
    const model = new FakePhoneticModel();
    const lesson = new NumbersLesson(settings, keyboard, model);
    const lessonKeys = lesson.update(makeKeyStatsMap(lesson.letters, []));

    equal(
      lesson.generate(lessonKeys, LCG(123)),
      "787617 486 79728 789 6829 303825 656 7049 48027 8693 98532 820",
    );
  });
});
