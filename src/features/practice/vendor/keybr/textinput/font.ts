// Modified for Keybard: stubbed. keybr's fonts come from @keybr/themes, which is
// not vendored (spec §9.2); Practice draws text with Keybard's own fonts. One
// placeholder font keeps the `Font` API that TextDisplaySettings refers to.
import { type Language } from "../keyboard/index.ts";
import { Enum, type EnumItem } from "../lang/index.ts";

export class Font implements EnumItem {
  static readonly ALL = new Enum<Font>(new Font("default", "Default", []));

  static get default() {
    return Font.ALL.at(0);
  }

  static select(_language: Language) {
    return Font.ALL;
  }

  static find(fonts: Enum<Font>, font: Font) {
    return fonts.has(font) ? font : fonts.at(0);
  }

  private constructor(
    readonly id: string,
    readonly name: string,
    readonly scripts: readonly string[],
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
