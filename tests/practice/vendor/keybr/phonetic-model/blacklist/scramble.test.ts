import { test } from "vitest";
import { equal } from "../../../rich-assert.ts";
import { scrambleWord, unscrambleWord } from "@/features/practice/vendor/keybr/phonetic-model/blacklist/scramble.ts";

test("scramble word", () => {
  equal(scrambleWord("a"), "a");
  equal(scrambleWord("ab"), "ba");
  equal(scrambleWord("abc"), "bac");
  equal(scrambleWord("abcdef"), "bafedc");
});

test("unscramble word", () => {
  equal(unscrambleWord("a"), "a");
  equal(unscrambleWord("ba"), "ab");
  equal(unscrambleWord("bac"), "abc");
  equal(unscrambleWord("bafedc"), "abcdef");
});
