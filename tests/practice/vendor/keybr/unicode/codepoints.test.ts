import { describe, it } from "vitest";
import { deepEqual, equal } from "../../rich-assert.ts";
import { codePointLength, toCodePoints } from "@/features/practice/vendor/keybr/unicode/codepoints.ts";

describe("to code points", () => {
  it("should convert an empty string", () => {
    const s = "";
    equal(s.length, 0);
    equal(codePointLength(s), 0);
    equal(String.fromCodePoint(...toCodePoints(s)), s);
    deepEqual([...toCodePoints(s)], []);
  });

  it("should convert plain text", () => {
    const s = "abc";
    equal(s.length, 3);
    equal(codePointLength(s), 3);
    equal(String.fromCodePoint(...toCodePoints(s)), s);
    deepEqual([...toCodePoints(s)], [0x0061, 0x0062, 0x0063]);
  });

  it("should convert emoji", () => {
    const s = "🍬🍭";
    equal(s.length, 4);
    equal(codePointLength(s), 2);
    equal(String.fromCodePoint(...toCodePoints(s)), s);
    deepEqual([...toCodePoints(s)], [0x01_f36c, 0x01_f36d]);
  });
});
