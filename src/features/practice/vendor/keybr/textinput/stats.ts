// Modified for Keybard: makeStats takes optional `maxGap` and `paused` (spec §6.5).
// A step that follows a gap longer than `maxGap` is a pause: its time is dropped
// from the histogram and the gap from the lesson time. Paused intervals are also
// removed from the lesson time. With no options the result is keybr's.
import { Histogram } from "./histogram.ts";
import { type Step } from "./textinput.ts";

export type Stats = {
  readonly time: number;
  readonly speed: number;
  readonly length: number;
  readonly errors: number;
  readonly accuracy: number;
  readonly histogram: Histogram;
};

export type StatsOptions = {
  /** Longest interval between two steps (ms) that still counts as typing. */
  readonly maxGap?: number;
  /** Intervals when the lesson was paused, as [start, end] time stamps. */
  readonly paused?: readonly (readonly [start: number, end: number])[];
};

export function makeStats(
  steps: readonly Step[],
  { maxGap = Infinity, paused = [] }: StatsOptions = {},
): Stats {
  if (steps.length >= 2) {
    const { timeStamp: startedAt } = steps.at(0)!;
    const { timeStamp: endedAt } = steps.at(-1)!;
    const { length } = steps;
    const timed: Step[] = [];
    let removed = 0;
    for (let i = 1; i < length; i++) {
      const prev = steps[i - 1].timeStamp;
      const step = steps[i];
      const interval = step.timeStamp - prev;
      if (interval > maxGap) {
        removed += interval;
        timed.push({ ...step, timeToType: 0 });
      } else {
        removed += overlap(prev, step.timeStamp, paused);
        timed.push(step);
      }
    }
    const time = Math.round(endedAt - startedAt - removed);
    const speed = computeSpeed(length, time);
    const errors = countErrors(steps);
    const accuracy = (length - errors) / length;
    return {
      time,
      speed,
      length,
      errors,
      accuracy,
      histogram: Histogram.from(timed), // The trigger step is ignored.
    };
  } else {
    return {
      time: 0,
      speed: 0,
      length: 0,
      errors: 0,
      accuracy: 0,
      histogram: Histogram.empty,
    };
  }
}

function overlap(
  start: number,
  end: number,
  intervals: readonly (readonly [number, number])[],
): number {
  let total = 0;
  for (const [a, b] of intervals) {
    total += Math.max(0, Math.min(end, b) - Math.max(start, a));
  }
  return total;
}

export function countErrors(steps: readonly Step[]): number {
  let errors = 0;
  for (const item of steps) {
    if (item.typo) {
      errors += 1;
    }
  }
  return errors;
}

export function computeSpeed(length: number, time: number): number {
  return time > 0 ? (length / (time / 1000)) * 60 : 0;
}
