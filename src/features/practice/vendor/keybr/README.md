# Vendored keybr.com engine

This directory holds the learning engine of [keybr.com](https://www.keybr.com/) by Aliaksandr Radzivanovich ([aradzie](https://github.com/aradzie)) and contributors, which Keybard Practice is built on. It is licensed under the GNU Affero General Public License v3 (see `LICENSE`, copied from upstream; keybr's `package.json` says `GPL-3`, and the `LICENSE` file is treated as governing).

- **Upstream:** https://github.com/aradzie/keybr.com
- **Commit:** `05a37bc5265f65ff538c59c613db29442f345d51` (2026-09-28)
- **Spec:** `docs/practice/spec.md` §9.2 (what is vendored and why) and §11 (licensing)

Practice also credits **svalbr** by River ([r-tae](https://github.com/r-tae), https://r-tae.github.io/keybr.com/), the proof of concept that keybr can teach a Svalboard. No svalbr code is copied; Practice re-implements its ideas on Keybard's keymap (`../../keymap/`).

## Layout

Each directory is one keybr package's `lib/` (`keybr-math/lib` → `math/`), with only the non-test sources. `@keybr/<package>` imports are rewritten to relative `../<package>/index.ts` paths; nothing else changes in an unmodified file. keybr's tests for these packages are ported to Vitest in `tests/practice/vendor/keybr/` (their `node:test` and `rich-assert` imports point at Vitest and a small `rich-assert` stand-in, `tests/practice/vendor/rich-assert.ts`).

Every changed file starts with `// Modified for Keybard: <reason>`. Files were copied verbatim otherwise.

| Package | Treatment |
|---|---|
| `math`, `rand`, `unicode`, `lang` | Vendored as is |
| `binary` | `io.ts`, `errors.ts`, and `utf8.ts` (which `io.ts` needs); `crc32` and `secret` dropped |
| `settings` | Props model and `Settings`; React context and fake dropped; storage adapter replaced |
| `phonetic-model` | Without `fs-load.ts`, `Alphabet.tsx`, `context.ts` and the examples; English blacklist only |
| `keyboard` | `keyboard`, `keyshape`, `keycombo`, `keycharacters`, `types`, `language`, `layout` (trimmed), `geometry`, `mod`, `keymodifier`, `ngram`, plus `filter` (used by `textinput`) and `fakes` (test helpers); layout and geometry tables, `load`, `settings`, `stats`, `context` and the React hook dropped |
| `textinput` | `font.ts` stubbed; `settings.ts` and `stats.ts` patched |
| `textinput-events` | `inputhandler`, `events`, `modifiers`, `types`, `testing`; `timetotype`, `emulation`, `TextEvents.tsx`, `use-depressed-keys` dropped |
| `lesson` | Without `code.ts` and `books.ts`; settings, lesson types and `Lesson.filter` patched |
| `result` | Without the React context and `speedunit` (react-intl); `fake.tsx` → `fake.ts` |
| `result-io` | `legacyjson.ts` (and its `errors.ts`) only, as a reference for Practice's own reader |
| `content` | Word-list types only |

Not vendored: `keybr-phonetic-model-loader`, `keybr-lesson-loader`, `keybr-result-loader` (rewritten as `../../content/loader.ts` and `../../store/`), and every UI, theme, intl, chart, code, book, sound and server package. The English model and word list are Practice assets in `../../content/assets/` (`model-en.data` from `keybr-phonetic-model/assets`, `words-en.json` from `keybr-content-words/lib/data`).

## Patches

Added file:

- `es2022.d.ts`: a `/// <reference lib="es2022" />`. The engine uses `Array.prototype.at`, `Error` `cause` options and `Intl.Segmenter`; Keybard's tsconfig targets ES2020.

Changed files:

- `binary/index.ts`: exports only `errors` and `io` (no `crc32`, `secret`).
- `content/index.ts`: exports only the word-list types (no books, quotes or previews).
- `keyboard/index.ts`: no `context`, `load`, `settings`, `stats` or `use-formatted-names` exports.
- `keyboard/geometry.ts`: `ZoneMod` keeps its API with empty zone tables (`geometry/mod.ts` is not vendored); `ZoneModDict` is defined here.
- `keyboard/mod.ts`: only `nullMod` and `remapZones`; `angleMod`/`angleWideMod` need the dropped tables.
- `keyboard/layout.ts`: the ~100 layouts are removed; `Layout.custom()` and `Layout.EN_US` remain, and `Layout.ALL` holds `EN_US` only. Practice runs everything with `Layout.custom(Language.EN)`.
- `lang/enum.ts`, `result/localdate.ts`: `process.env.NODE_ENV` checks use Vite's `import.meta.env.PROD`.
- `lesson/settings.ts`: the `books` and `code` props are removed, so nothing imports `@keybr/code` or the book covers.
- `lesson/lessontype.ts`: the `BOOKS` and `CODE` lesson types are removed.
- `lesson/index.ts`: no `books` or `code` exports.
- `lesson/lesson.ts`: `filter()` keeps every result instead of partitioning by `KeyboardOptions` layout family; Practice's lessons override it to select samples by path key (spec §6.1, `../../lessons/guided.ts`).
- `lesson/customtext.ts`, `lesson/numbers.ts`, `lesson/wordlist.ts`, `lesson/learningrate.ts`, `math/model.ts`, `math/polynomial.ts`, `phonetic-model/fake.ts`, `phonetic-model/phoneticmodel.ts`, `unicode/textstats.ts`: unused parameters and loop variables are prefixed with `_` for Keybard's `noUnusedParameters`/`noUnusedLocals`. No behavior change.
- `phonetic-model/index.ts`: no `Alphabet` (React) or `context` exports.
- `phonetic-model/blacklist/blacklist.ts`: English blacklist only (keybr imports every language's statically).
- `result-io/legacyjson.ts`: the legacy layout id fixes name the dropped layouts by their id strings.
- `result/fake.ts` (was `fake.tsx`): the React `FakeResultContext` is removed; `ResultFaker` and `generateKeySamples` remain.
- `result/index.ts`: no `context`, `settings` (`uiProps`) or `speedunit` exports.
- `result/keystats.ts`: `MutableKeyStatsMap.restore()` and `MutableKeyStats.restore()` rebuild the per-letter state from saved samples, so a stats snapshot can stand in for a full replay (spec §6.8).
- `settings/index.ts`: no React context or fake exports.
- `settings/preferences.ts`: Keybard's namespaced `appStorage` instead of `localStorage`.
- `textinput/font.ts`: stubbed with one default font (keybr's fonts come from `@keybr/themes`).
- `textinput/settings.ts`: no `KeyboardOptions` import; the display language is `Language.EN`.
- `textinput/stats.ts`: `makeStats(steps, { maxGap, paused })` drops a step's timing and its interval from the lesson time when it follows a gap over `maxGap`, and removes paused intervals from the lesson time (spec §6.5). With no options the result is keybr's.
- `textinput-events/index.ts`: exports `inputhandler`; no `emulation`, `TextEvents` or `use-depressed-keys`.
- `textinput-events/inputhandler.ts`: keybr's `TimeToType` is replaced by an injectable timer whose default reports the raw interval since the previous input (Practice divides by physical presses, `../../input/timeToType.ts`, spec §6.5); Tab is no longer prevented, so it leaves the practice text (§5.11); `Focusable` from `@keybr/widget` is dropped; `process.env.NODE_ENV` → `import.meta.env.PROD`. `setInput(input, { focus: false })` attaches without taking focus, so opening Practice with the Lesson panel leaves focus in the panel (spec §4.1).

Ported tests that changed for these patches (each says so in a comment): `binary/io.test.ts` (test-local `crc32`), `lang/tasks.test.ts` (Vitest fake timers), `phonetic-model/integration.test.ts` (English model from Practice's assets), `result/group.test.ts` (a custom German layout stands in for `Layout.DE_DE`), `textinput-events/inputhandler.test.ts` (raw interval, Tab not prevented), and the `lesson` tests that used `loadKeyboard(Layout.EN_US)`, which now use the default Svalboard keymap through Practice's adapter (`tests/practice/fixtures/keyboard.ts`). Tests of dropped modules (`code`, `emulation`, `TextEvents`, layout and geometry tables, keyboard settings, `crc32`, `secret`, binary result I/O) are not ported.
