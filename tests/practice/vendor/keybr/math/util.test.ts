import { test } from "vitest";
import { deepEqual } from "../../rich-assert.ts";
import { resample } from "@/features/practice/vendor/keybr/math/util.ts";

test("resample", () => {
  deepEqual(resample([1, 2], 4), [1, 1, 2, 2]);
  deepEqual(resample([1, 1, 2, 2], 2), [1, 2]);
});
