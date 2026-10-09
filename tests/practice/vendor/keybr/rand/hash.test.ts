import { test } from "vitest";
import { equal } from "../../rich-assert.ts";
import { hashCode } from "@/features/practice/vendor/keybr/rand/hash.ts";

test("hash code of string", () => {
  equal(hashCode(""), 0x00000001);
  equal(hashCode("hello"), 0x079df171);
  equal(hashCode("what a terrible failure"), 0x06092247);
});
