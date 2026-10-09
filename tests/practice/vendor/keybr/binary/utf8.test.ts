import { test } from "vitest";
import { equal, throws } from "../../rich-assert.ts";
import { DataError } from "@/features/practice/vendor/keybr/binary/errors.ts";
import { decode, encode, encodedByteCount } from "@/features/practice/vendor/keybr/binary/utf8.ts";

test("compute encoded byte count", () => {
  equal(encodedByteCount(""), 0);
  equal(encodedByteCount("hello"), 5);
  equal(encodedByteCount("привет"), 12);
  equal(encodedByteCount("\u0000\u000F\u00FF\u0FFF\uFFFF"), 10);
  equal(encodedByteCount("🍬🍭"), 8);
});

test("encode and decode selected examples", () => {
  const buffer = new DataView(new ArrayBuffer(1024));
  let byteCount: number;

  byteCount = encode("", buffer, 0);
  equal(byteCount, 0);
  equal(decode(buffer, 0, byteCount), "");

  byteCount = encode("hello", buffer, 0);
  equal(byteCount, 5);
  equal(decode(buffer, 0, byteCount), "hello");

  byteCount = encode("привет", buffer, 0);
  equal(byteCount, 12);
  equal(decode(buffer, 0, byteCount), "привет");

  byteCount = encode("\u0000\u000F\u00FF\u0FFF\uFFFF", buffer, 0);
  equal(byteCount, 10);
  equal(decode(buffer, 0, byteCount), "\u0000\u000F\u00FF\u0FFF\uFFFF");

  byteCount = encode("🍬🍭", buffer, 0);
  equal(byteCount, 8);
  equal(decode(buffer, 0, byteCount), "🍬🍭");

  buffer.setUint8(0, 0b11110000);
  buffer.setUint8(1, 0b10000000);
  buffer.setUint8(2, 0b10000000);
  buffer.setUint8(3, 0b10000000);
  equal(decode(buffer, 0, 4), "\u{000000}");

  buffer.setUint8(0, 0b11110100);
  buffer.setUint8(1, 0b10001111);
  buffer.setUint8(2, 0b10111111);
  buffer.setUint8(3, 0b10111111);
  equal(decode(buffer, 0, 4), "\u{10FFFF}");
});

test("encode and decode the full code point range", () => {
  let value = "";
  for (let i = 0; i <= 0x10ffff; i++) {
    value += String.fromCodePoint(i);
  }
  const buffer = new DataView(new ArrayBuffer(encodedByteCount(value)));
  equal(decode(buffer, 0, encode(value, buffer, 0)), value);
});

test("decode surrogate pairs", () => {
  const buffer = new DataView(new ArrayBuffer(1024));
  let byteCount: number;

  byteCount = encode("\uD83C", buffer, 0);
  equal(byteCount, 3);
  equal(decode(buffer, 0, byteCount), "\uD83C");

  byteCount = encode("\uDF6C", buffer, 0);
  equal(byteCount, 3);
  equal(decode(buffer, 0, byteCount), "\uDF6C");

  buffer.setUint8(0, 0xed);
  buffer.setUint8(1, 0xa0);
  buffer.setUint8(2, 0xbc);
  buffer.setUint8(3, 0xed);
  buffer.setUint8(4, 0xbd);
  buffer.setUint8(5, 0xac);
  equal(decode(buffer, 0, 6), "🍬");
  equal(decode(buffer, 0, 3), "\uD83C");
  equal(decode(buffer, 3, 3), "\uDF6C");
});

test("report truncated stream", () => {
  const buffer = new DataView(new ArrayBuffer(1024));

  buffer.setUint8(0, 0b11110100);
  buffer.setUint8(1, 0b10001111);
  buffer.setUint8(2, 0b10111111);
  buffer.setUint8(3, 0b10111111);
  throws(() => {
    decode(buffer, 0, 1);
  }, DataError);
  throws(() => {
    decode(buffer, 0, 2);
  }, DataError);
  throws(() => {
    decode(buffer, 0, 3);
  }, DataError);

  buffer.setUint8(0, 0b11101111);
  buffer.setUint8(1, 0b10111111);
  buffer.setUint8(2, 0b10111111);
  throws(() => {
    decode(buffer, 0, 1);
  }, DataError);
  throws(() => {
    decode(buffer, 0, 2);
  }, DataError);

  buffer.setUint8(0, 0b11011111);
  buffer.setUint8(1, 0b10111111);
  throws(() => {
    decode(buffer, 0, 1);
  }, DataError);
});
