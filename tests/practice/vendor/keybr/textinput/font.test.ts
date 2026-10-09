import { test } from "vitest";
import { Language } from "@/features/practice/vendor/keybr/keyboard/index.ts";
import { isNotNull, isTrue } from "../../rich-assert.ts";
import { Font } from "@/features/practice/vendor/keybr/textinput/font.ts";

test("select fonts for each language", () => {
  for (const language of Language.ALL) {
    const fonts = Font.select(language);
    isTrue(fonts.size > 0);
    for (const font of Font.ALL) {
      isNotNull(Font.find(fonts, font));
    }
  }
});
