import { test } from "vitest";
import { Settings } from "@/features/practice/vendor/keybr/settings/index.ts";
import { equal, throws } from "../../rich-assert.ts";
import { lessonProps } from "@/features/practice/vendor/keybr/lesson/settings.ts";
import { Target } from "@/features/practice/vendor/keybr/lesson/target.ts";

test("time to confidence", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, /* 50WPM */ 250);
  const target = new Target(settings);
  throws(() => target.confidence(NaN));
  throws(() => target.confidence(0));
  equal(target.confidence(1000 / (500 / 60)), 2.0);
  equal(target.confidence(1000 / (250 / 60)), 1.0);
  equal(target.confidence(1000 / (125 / 60)), 0.5);
});
