import { test } from "vitest";
import { deepEqual, equal, throws } from "../../rich-assert.ts";
import { Vector } from "@/features/practice/vendor/keybr/math/vector.ts";

test("validate arguments", () => {
  throws(() => new Vector([NaN]));
  throws(() => new Vector().add(NaN));

  const vector = new Vector([0]);
  throws(() => vector.at(NaN));
  throws(() => vector.at(-1));
  throws(() => vector.at(1));
  throws(() => vector.at(1.1));
});

test("mutate vector", () => {
  const vector = new Vector();

  equal(vector.length, 0);
  deepEqual([...vector], []);

  vector.add(0);
  equal(vector.length, 1);
  deepEqual([...vector], [0]);

  vector.add(1);
  equal(vector.length, 2);
  deepEqual([...vector], [0, 1]);
});
