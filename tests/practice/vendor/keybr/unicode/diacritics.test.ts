import { test } from "vitest";
import { equal, isFalse, isTrue } from "../../rich-assert.ts";
import { combineDiacritic, isDiacritic, stripDiacritic } from "@/features/practice/vendor/keybr/unicode/diacritics.ts";

test("classify", () => {
  isFalse(isDiacritic(/* "a" */ 0x0061));
  isFalse(isDiacritic(/* ACUTE ACCENT */ 0x00b4));
  isTrue(isDiacritic(/* COMBINING ACUTE ACCENT */ 0x0301));
});

test("combine diacritic", () => {
  equal(
    combineDiacritic(/* "A" */ 0x0041, /* ACUTE ACCENT */ 0x00b4),
    /* "A" */ 0x0041,
  );
  equal(
    combineDiacritic(/* "a" */ 0x0061, /* ACUTE ACCENT */ 0x00b4),
    /* "a" */ 0x0061,
  );
  equal(
    combineDiacritic(/* "B" */ 0x0042, /* COMBINING ACUTE ACCENT */ 0x0301),
    /* "B" */ 0x0042,
  );
  equal(
    combineDiacritic(/* "b" */ 0x0062, /* COMBINING ACUTE ACCENT */ 0x0301),
    /* "b" */ 0x0062,
  );
  equal(
    combineDiacritic(/* "A" */ 0x0041, /* COMBINING ACUTE ACCENT */ 0x0301),
    /* "Á" */ 0x00c1,
  );
  equal(
    combineDiacritic(/* "a" */ 0x0061, /* COMBINING ACUTE ACCENT */ 0x0301),
    /* "á" */ 0x00e1,
  );
});

test("strip diacritic", () => {
  equal(stripDiacritic(/* "A" */ 0x0041), /* "A" */ 0x0041);
  equal(stripDiacritic(/* "a" */ 0x0061), /* "a" */ 0x0061);
  equal(stripDiacritic(/* "Á" */ 0x00c1), /* "A" */ 0x0041);
  equal(stripDiacritic(/* "á" */ 0x00e1), /* "a" */ 0x0061);
});
