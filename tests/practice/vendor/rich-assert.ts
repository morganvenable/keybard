// Vitest stand-in for `rich-assert`, the assertion library keybr's tests use with
// node:test. It keeps the ported tests (tests/practice/vendor/keybr/**) close to
// upstream: only their imports change. Each function maps to a Vitest matcher with
// the same strictness as node:assert's strict mode.
import { expect } from "vitest";

type Expected =
  | RegExp
  | (new (...args: any[]) => unknown)
  | Error
  | { readonly message?: string | RegExp; readonly name?: string };

export function equal<T>(actual: T, expected: T, message?: string): void {
  expect(actual, message).toBe(expected);
}

export function notEqual<T>(actual: T, expected: T, message?: string): void {
  expect(actual, message).not.toBe(expected);
}

export function deepEqual<T>(actual: T, expected: T, message?: string): void {
  expect(actual, message).toStrictEqual(expected);
}

export function isTrue(value: unknown, message?: string): void {
  expect(value, message).toBe(true);
}

export function isFalse(value: unknown, message?: string): void {
  expect(value, message).toBe(false);
}

export function isNull(value: unknown, message?: string): void {
  expect(value, message).toBeNull();
}

export function isNotNull(value: unknown, message?: string): void {
  expect(value, message).not.toBeNull();
}

export function isNaN(value: unknown, message?: string): void {
  expect(value, message).toBeNaN();
}

export function isNotNaN(value: unknown, message?: string): void {
  expect(value, message).not.toBeNaN();
}

export function isNotEmpty(
  value: { readonly length: number } | { readonly size: number },
  message?: string,
): void {
  const size = "length" in value ? value.length : value.size;
  expect(size, message).toBeGreaterThan(0);
}

export function match(value: string, pattern: RegExp, message?: string): void {
  expect(value, message).toMatch(pattern);
}

export function includes<T>(
  haystack: string | Iterable<T>,
  needle: T | string,
  message?: string,
): void {
  expect(
    typeof haystack === "string" ? haystack : [...haystack],
    message,
  ).toContain(needle);
}

export function fail(message?: string): never {
  throw new Error(message ?? "Failed");
}

function check(error: unknown, expected: Expected | undefined): void {
  if (expected == null) {
    return;
  }
  if (expected instanceof RegExp) {
    expect(String((error as Error)?.message ?? error)).toMatch(expected);
  } else if (typeof expected === "function") {
    expect(error).toBeInstanceOf(expected);
  } else {
    const { message, name } = expected as { message?: string | RegExp; name?: string };
    if (expected instanceof Error) {
      expect(error).toBeInstanceOf(expected.constructor);
    }
    if (message instanceof RegExp) {
      expect((error as Error).message).toMatch(message);
    } else if (message != null) {
      expect((error as Error).message).toBe(message);
    }
    if (name != null) {
      expect((error as Error).name).toBe(name);
    }
  }
}

export function throws(fn: () => unknown, expected?: Expected, message?: string): void {
  let thrown = false;
  let error: unknown;
  try {
    fn();
  } catch (e) {
    thrown = true;
    error = e;
  }
  expect(thrown, message ?? "Missing expected exception").toBe(true);
  check(error, expected);
}

export function doesNotThrow(fn: () => unknown, message?: string): void {
  expect(fn, message).not.toThrow();
}

export async function rejects(
  promise: Promise<unknown> | (() => Promise<unknown>),
  expected?: Expected,
  message?: string,
): Promise<void> {
  let thrown = false;
  let error: unknown;
  try {
    await (typeof promise === "function" ? promise() : promise);
  } catch (e) {
    thrown = true;
    error = e;
  }
  expect(thrown, message ?? "Missing expected rejection").toBe(true);
  check(error, expected);
}
