// Modified for Keybard: the ~100 keyboard layouts are not vendored (spec §9.2,
// §9.8). Practice runs every lesson and result with Layout.custom(Language.EN);
// EN_US is kept as the one named layout for keybr's own tests and legacyjson.
import { Enum, XEnum, type XEnumItem } from "../lang/index.ts";
import { Geometry } from "./geometry.ts";
import { Language } from "./language.ts";
import { type Mod, nullMod } from "./mod.ts";

export class Layout implements XEnumItem {
  static custom(language: Language) {
    return new Layout(
      /* id= */ "custom",
      /* xid= */ 0xff,
      /* name= */ "Custom",
      /* family= */ "custom",
      /* language= */ language,
      /* emulate= */ true,
      /* geometries= */ Geometry.ALL,
    );
  }

  static readonly EN_US = new Layout(
    /* id= */ "en-us",
    /* xid= */ 0x10,
    /* name= */ "{US}",
    /* family= */ "qwerty",
    /* language= */ Language.EN,
    /* emulate= */ false,
    /* geometries= */ new Enum(
      Geometry.ANSI_101,
      Geometry.ANSI_101_FULL,
      Geometry.ISO_102,
      Geometry.ISO_102_FULL,
      Geometry.MATRIX,
    ),
  );
  static readonly ALL = new XEnum<Layout>(Layout.EN_US);

  static findLayout(localeId: string): Layout | null {
    const { language = null, region = null } = (() => {
      try {
        return new Intl.Locale(localeId);
      } catch {
        return {} as Intl.Locale;
      }
    })();
    if (language != null && region != null) {
      const id = `${language}-${region}`.toLowerCase();
      for (const layout of Layout.ALL) {
        if (layout.id === id) {
          return layout;
        }
      }
    }
    if (language != null) {
      const id = `${language}-`.toLowerCase();
      for (const layout of Layout.ALL) {
        if (layout.id.startsWith(id)) {
          return layout;
        }
      }
    }
    return null;
  }

  static selectableLayouts(language: Language): Layout[] {
    const list = Layout.ALL.filter(
      (layout) => layout.language.script === language.script,
    );
    return [
      ...list.filter((layout) => layout.language.id === language.id),
      ...list.filter((layout) => layout.language.id !== language.id),
    ];
  }

  static selectLayout(language: Language): Layout {
    const [layout] = Layout.selectableLayouts(language);
    if (layout == null) {
      throw new Error(); // Unreachable.
    }
    return layout;
  }

  private constructor(
    readonly id: string,
    readonly xid: number,
    readonly name: string,
    readonly family: string,
    readonly language: Language,
    readonly emulate: boolean,
    readonly geometries: Enum<Geometry>,
    readonly mod: Mod = nullMod,
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
