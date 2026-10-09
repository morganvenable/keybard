// Modified for Keybard: only Layout.EN_US is vendored, so the legacy layout id
// fixes name the other layouts by their id strings. Vendored as a reference for
// Practice's own result reader (spec §8.3, §9.2).
import { Layout } from "../keyboard/index.ts";
import { isPlainObject, isString } from "../lang/index.ts";
import { Result, TextType } from "../result/index.ts";
import { Histogram } from "../textinput/index.ts";

export type ResultJson = {
  readonly l: string;
  readonly m: string;
  readonly ts: number;
  readonly n: number;
  readonly t: number;
  readonly e: number;
  readonly h: HistogramtJson;
};

export type HistogramtJson = {
  readonly [codePoint: number]: {
    readonly h: number;
    readonly m: number;
    readonly t: number;
  };
};

export function resultToJson(result: Result): ResultJson {
  return {
    l: result.layout.id,
    m: result.textType.id,
    ts: result.timeStamp,
    n: result.length,
    t: result.time,
    e: result.errors,
    h: histogramToJson(result.histogram),
  };
}

export function histogramToJson(histogram: Histogram): HistogramtJson {
  const json: {
    [codePoint: number]: {
      h: number;
      m: number;
      t: number;
    };
  } = {};
  for (const { codePoint, hitCount, missCount, timeToType } of histogram) {
    json[codePoint] = {
      h: hitCount,
      m: missCount,
      t: timeToType,
    };
  }
  return json;
}

export function resultFromJson(json: ResultJson): Result | null {
  if (!isPlainObject(json)) {
    return null;
  }
  const {
    l: layoutId,
    m: textTypeId,
    ts: timeStamp,
    n: length,
    t: time,
    e: errors,
    h: histogramJson,
  } = json;
  if (
    !(
      isString(layoutId) &&
      isString(textTypeId) &&
      Number.isSafeInteger(timeStamp) &&
      Number.isSafeInteger(length) &&
      Number.isSafeInteger(time) &&
      Number.isSafeInteger(errors)
    )
  ) {
    return null;
  }
  const histogram = histogramFromJson(histogramJson);
  if (histogram == null) {
    return null;
  }
  try {
    return new Result(
      Layout.ALL.get(fixLegacyLayoutId(layoutId)),
      TextType.ALL.get(fixTextTypeId(textTypeId)),
      timeStamp,
      length,
      time,
      errors,
      histogram,
    );
  } catch {
    return null;
  }
}

export function histogramFromJson(json: HistogramtJson): Histogram | null {
  if (!isPlainObject(json)) {
    return null;
  }
  const samples = [];
  for (const [key, sample] of Object.entries(json)) {
    const codePoint = Number(key);
    if (
      !(Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 65535)
    ) {
      return null;
    }
    if (!isPlainObject(sample)) {
      return null;
    }
    const {
      h: hitCount,
      m: missCount,
      t: timeToType,
    } = sample as {
      readonly h: number;
      readonly m: number;
      readonly t: number;
    };
    if (
      !(
        Number.isSafeInteger(hitCount) &&
        Number.isSafeInteger(missCount) &&
        Number.isFinite(timeToType)
      )
    ) {
      return null;
    }
    samples.push({
      codePoint,
      hitCount,
      missCount,
      timeToType: Math.round(timeToType),
    });
  }
  return new Histogram(samples);
}

function fixLegacyLayoutId(id: string): string {
  // Fix layout identifiers that were changed in cfafe818d5edd3d72a738183730dae049b967ebc
  switch (id) {
    case "be":
      return "be-by";
    case "cz":
      return "cs-cz";
    case "de":
      return "de-de";
    case "fr":
      return "fr-fr";
    case "it":
      return "it-it";
    case "pl":
      return "pl-pl";
    case "ru":
      return "ru-ru";
    case "se":
      return "sv-se";
    case "ua":
      return "uk-ua";
    case "uk":
      return "en-uk";
    case "us":
      return Layout.EN_US.id;
    case "us-canary-matrix":
      return "en-canary-matrix";
    case "us-colemak":
      return "en-colemak";
    case "us-colemak-dh":
      return "en-colemak-dh";
    case "us-colemak-dh-matrix":
      return "en-colemak-dh-matrix";
    case "us-dvorak":
      return "en-dvorak";
    case "us-workman":
      return "en-workman";
    default:
      return id;
  }
}

function fixTextTypeId(id: string): string {
  switch (id) {
    case "guided":
      return TextType.GENERATED.id;
    case "custom":
      return TextType.NATURAL.id;
    default:
      return id;
  }
}
