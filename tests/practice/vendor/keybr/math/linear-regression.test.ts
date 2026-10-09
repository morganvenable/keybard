import { test } from "vitest";
import { deepEqual, equal } from "../../rich-assert.ts";
import { linearRegression } from "@/features/practice/vendor/keybr/math/linear-regression.ts";
import { Vector } from "@/features/practice/vendor/keybr/math/vector.ts";

test("a", () => {
  const poly = linearRegression(
    new Vector([0, 1, 2, 3, 4]),
    new Vector([0, 0, 0, 0, 0]),
  );

  equal(poly.degree, 0);
  deepEqual(poly.coef, [0]);

  equal(poly.eval(0), 0);
  equal(poly.eval(3), 0);
  equal(poly.eval(6), 0);
});

test("b", () => {
  const poly = linearRegression(
    new Vector([0, 1, 2, 3, 4]),
    new Vector([1, 1, 1, 1, 1]),
  );

  equal(poly.degree, 0);
  deepEqual(poly.coef, [1]);

  equal(poly.eval(0), 1);
  equal(poly.eval(3), 1);
  equal(poly.eval(6), 1);
});

test("c", () => {
  const poly = linearRegression(
    new Vector([0, 1, 2, 3, 4]),
    new Vector([1, 2, 3, 4, 5]),
  );

  equal(poly.degree, 1);
  deepEqual(poly.coef, [1, 1]);

  equal(poly.eval(0), 1);
  equal(poly.eval(3), 4);
  equal(poly.eval(6), 7);
});
