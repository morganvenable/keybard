import { test } from "vitest";
import { equal } from "../../rich-assert.ts";
import { r2 } from "@/features/practice/vendor/keybr/math/model.ts";
import { Vector } from "@/features/practice/vendor/keybr/math/vector.ts";

test("r2", () => {
  const vx = new Vector([1, 2, 3, 4, 5]);
  const vy = new Vector([1, 2, 3, 4, 5]);
  equal(r2(vx, vy, { eval: (x) => x }), 1);
  equal(r2(vx, vy, { eval: (x) => x * 0.9 }), 0.9450000000000001);
  equal(r2(vx, vy, { eval: (x) => (x - 3) * 1.1 + 3 }), 0.99);
  equal(r2(vx, vy, { eval: (x) => 0 }), -4.5);
});
