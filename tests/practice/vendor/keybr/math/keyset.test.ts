import { test } from "vitest";
import { deepEqual } from "../../rich-assert.ts";
import { KeySet } from "@/features/practice/vendor/keybr/math/keyset.ts";

test("construct", () => {
  const keySet = new KeySet([1, 1, 1, 2]);

  deepEqual([...keySet], [1, 2]);

  keySet.add(3);

  deepEqual([...keySet], [1, 2, 3]);
});
