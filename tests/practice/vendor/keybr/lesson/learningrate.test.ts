import { test } from "vitest";
import { generateKeySamples } from "@/features/practice/vendor/keybr/result/index.ts";
import { Settings } from "@/features/practice/vendor/keybr/settings/index.ts";
import { equal, isNaN, isNotNull, isNull } from "../../rich-assert.ts";
import { LearningRate } from "@/features/practice/vendor/keybr/lesson/learningrate.ts";
import { lessonProps } from "@/features/practice/vendor/keybr/lesson/settings.ts";
import { Target } from "@/features/practice/vendor/keybr/lesson/target.ts";

test("too few samples", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, /* 35WPM */ 175);
  const target = new Target(settings);
  isNull(LearningRate.from([], target));
  isNull(LearningRate.from(generateKeySamples(0), target));
  isNull(LearningRate.from(generateKeySamples(1), target));
  isNull(LearningRate.from(generateKeySamples(2), target));
  isNull(LearningRate.from(generateKeySamples(3), target));
  isNull(LearningRate.from(generateKeySamples(4), target));
  isNotNull(LearningRate.from(generateKeySamples(5), target));
});

test("decreasing time", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, /* 35WPM */ 175);
  const target = new Target(settings);
  const learningRate = LearningRate.from(
    generateKeySamples(5, {
      timeToTypeStart: 400,
      timeToTypeStep: +10,
    }),
    target,
  ) as LearningRate;
  equal(learningRate.certainty, 0.9990293383742471);
  equal(learningRate.learningRate, 4.164934164934164);
  equal(learningRate.remainingLessons, 3);
});

test("increasing time", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, /* 35WPM */ 175);
  const target = new Target(settings);
  const learningRate = LearningRate.from(
    generateKeySamples(5, {
      timeToTypeStart: 400,
      timeToTypeStep: -10,
    }),
    target,
  ) as LearningRate;
  equal(learningRate.certainty, 0.9992055903829036);
  equal(learningRate.learningRate, -3.4079306966431178);
  isNaN(learningRate.remainingLessons);
});

test("learning rate of the example data", () => {
  const settings = new Settings().set(lessonProps.targetSpeed, /* 35WPM */ 175);
  const target = new Target(settings);
  const learningRate = LearningRate.example(target);
  equal(learningRate.certainty, 0.9999559701751027);
  equal(learningRate.learningRate, 4.1890206530121485);
  equal(learningRate.remainingLessons, 3);
});
