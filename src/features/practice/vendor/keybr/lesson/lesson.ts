// Modified for Keybard: `filter` no longer partitions history by keyboard layout
// family (keybr's KeyboardOptions are not vendored). The base class keeps every
// result; Practice's lessons override `filter` to select samples by path key
// (spec §6.1, lessons/).
import { type Keyboard, type WeightedCodePointSet } from "../keyboard/index.ts";
import { type Letter, PhoneticModel } from "../phonetic-model/index.ts";
import { LCG, type RNGStream } from "../rand/index.ts";
import { type KeyStatsMap, type Result } from "../result/index.ts";
import { type Settings } from "../settings/index.ts";
import { type StyledText } from "../textinput/index.ts";
import { type LessonKeys } from "./key.ts";

export abstract class Lesson {
  static rng: RNGStream = LCG(Date.now());

  readonly settings: Settings;
  readonly keyboard: Keyboard;
  readonly codePoints: WeightedCodePointSet;
  readonly model: PhoneticModel;

  protected constructor(
    settings: Settings,
    keyboard: Keyboard,
    model: PhoneticModel,
  ) {
    this.settings = settings;
    this.keyboard = keyboard;
    this.codePoints = keyboard.getCodePoints();
    this.model = PhoneticModel.restrict(model, this.codePoints);
  }

  filter(results: readonly Result[]): readonly Result[] {
    return results;
  }

  abstract get letters(): readonly Letter[];

  abstract update(keyStatsMap: KeyStatsMap): LessonKeys;

  abstract generate(lessonKeys: LessonKeys, rng: RNGStream): StyledText;
}
