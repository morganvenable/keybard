// Modified for Keybard: the BOOKS and CODE lesson types are removed with their
// lessons (spec §9.2, N5).
import { Enum, type EnumItem } from "../lang/index.ts";
import { TextType } from "../result/index.ts";

export class LessonType implements EnumItem {
  static readonly GUIDED = new LessonType("guided", TextType.GENERATED);
  static readonly WORDLIST = new LessonType("wordlist", TextType.NATURAL);
  static readonly CUSTOM = new LessonType("custom", TextType.NATURAL);
  static readonly NUMBERS = new LessonType("numbers", TextType.NUMBERS);
  static readonly ALL = new Enum<LessonType>(
    LessonType.GUIDED,
    LessonType.WORDLIST,
    LessonType.CUSTOM,
    LessonType.NUMBERS,
  );

  private constructor(
    readonly id: string,
    readonly textType: TextType,
  ) {
    Object.freeze(this);
  }

  toString() {
    return this.id;
  }

  toJSON() {
    return this.id;
  }
}
