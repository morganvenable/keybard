import { test } from "vitest";
import { isTrue } from "../../rich-assert.ts";
import { toCodePoints } from "@/features/practice/vendor/keybr/unicode/codepoints.ts";
import { isControl, isLinebreak, isWhitespace } from "@/features/practice/vendor/keybr/unicode/whitespace.ts";

test("classify", () => {
  for (const codePoint of toCodePoints("\n\r\t")) {
    isTrue(isControl(codePoint));
  }
  for (const codePoint of toCodePoints("\n\r\u2028\u2029")) {
    isTrue(isLinebreak(codePoint));
  }
  for (const codePoint of toCodePoints(" \n\r\t\u2028\u2029")) {
    isTrue(isWhitespace(codePoint));
  }
});
