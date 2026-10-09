import { test } from "vitest";
import { deepEqual } from "../../rich-assert.ts";
import { Sle } from "@/features/practice/vendor/keybr/math/sle.ts";

test("solve", () => {
  const sle = new Sle(3);

  sle.A[0][0] = 1;
  sle.A[1][1] = 2;
  sle.A[2][2] = 3;
  sle.y[0] = 1;
  sle.y[1] = 2;
  sle.y[2] = 3;

  deepEqual(sle.solve(), [1, 1, 1]);
});
