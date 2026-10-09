// Ported for Keybard: node:test mock timers become Vitest fake timers.
import { afterEach, test, vi } from "vitest";
import { equal, isFalse, isTrue } from "../../rich-assert.ts";
import { Tasks } from "@/features/practice/vendor/keybr/lang/tasks.ts";

afterEach(() => {
  vi.useRealTimers();
});

test("", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });

  const tasks = new Tasks();

  let count = 0;
  const t = tasks.delayed(100, () => {
    count += 1;
  });

  equal(tasks.pending, 1);
  isFalse(t.fired);
  isFalse(t.cancelled);
  equal(count, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
  isTrue(t.fired);
  isFalse(t.cancelled);
  equal(count, 1);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
  isTrue(t.fired);
  isFalse(t.cancelled);
  equal(count, 1);
});

test("", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });

  const tasks = new Tasks();

  let count = 0;
  const t = tasks.delayed(100, () => {
    count += 1;
  });

  equal(tasks.pending, 1);
  isFalse(t.fired);
  isFalse(t.cancelled);
  equal(count, 0);

  t.cancel();
  t.cancel();
  t.cancel();
  equal(tasks.pending, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
  isFalse(t.fired);
  isTrue(t.cancelled);
  equal(count, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
  isFalse(t.fired);
  isTrue(t.cancelled);
  equal(count, 0);
});

test("", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });

  const tasks = new Tasks();

  let count = 0;
  const t = tasks.repeated(100, () => {
    count += 1;
  });

  equal(tasks.pending, 1);
  isFalse(t.fired);
  isFalse(t.cancelled);
  equal(count, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 1);
  isTrue(t.fired);
  isFalse(t.cancelled);
  equal(count, 1);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 1);
  isTrue(t.fired);
  isFalse(t.cancelled);
  equal(count, 2);
});

test("", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });

  const tasks = new Tasks();

  let count = 0;
  const t = tasks.repeated(100, () => {
    count += 1;
  });

  equal(tasks.pending, 1);
  isFalse(t.fired);
  isFalse(t.cancelled);
  equal(count, 0);

  t.cancel();
  t.cancel();
  t.cancel();
  equal(tasks.pending, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
  isFalse(t.fired);
  isTrue(t.cancelled);
  equal(count, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
  isFalse(t.fired);
  isTrue(t.cancelled);
  equal(count, 0);
});

test("", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"] });

  const tasks = new Tasks();

  tasks.delayed(100, () => {
    throw new Error();
  });
  tasks.repeated(100, () => {
    throw new Error();
  });

  equal(tasks.pending, 2);

  tasks.cancelAll();
  equal(tasks.pending, 0);

  tasks.cancelAll();
  equal(tasks.pending, 0);

  vi.runOnlyPendingTimers();
  equal(tasks.pending, 0);
});
