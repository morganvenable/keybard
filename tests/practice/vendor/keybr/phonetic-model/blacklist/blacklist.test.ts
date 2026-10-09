import { test } from "vitest";
import { Language } from "@/features/practice/vendor/keybr/keyboard/index.ts";
import { isFalse, isTrue } from "../../../rich-assert.ts";
import { getBlacklist } from "@/features/practice/vendor/keybr/phonetic-model/blacklist/blacklist.ts";

test("forbid blacklisted words", () => {
  const en = getBlacklist(Language.EN);
  const be = getBlacklist(Language.BE);

  isTrue(en.allow("LOVE"));
  isTrue(en.allow("love"));
  isFalse(en.allow("FUCK"));
  isFalse(en.allow("fuck"));

  isTrue(be.allow("LOVE"));
  isTrue(be.allow("love"));
  isTrue(be.allow("FUCK"));
  isTrue(be.allow("fuck"));
});
