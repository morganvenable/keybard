# keybr.com engine + svalbr: porting map for a Keybard trainer

Research only. Nothing was built, installed or run inside the snapshots.

Citation prefixes (paths are relative to each snapshot root):

- **[up]** `scratchpad/src/keybr-upstream`: aradzie/keybr.com @ `05a37bc` (2026-09-28)
- **[sv]** `scratchpad/src/svalbr`: r-tae/keybr.com @ `1d8a634` (2025-11-07). This is one squashed commit by River, so svalbr has no shared git history with upstream. Every comparison below is a file-tree diff, not a `git diff`.
- **[kb]** `scratchpad/src/keybard-main`: svalboard/keybard main @ `61db58a`

LOC counts are non-test `.ts`/`.tsx` lines, measured with `find | wc -l`. Test LOC is listed separately. Both repos are AGPL-3.0 ([up] `LICENSE`, [sv] `LICENSE`).

---

## 0. Executable summary

- The **adaptive core is small, pure TypeScript and has no DOM or React**. It is about 5k LOC across `keybr-lesson`, `keybr-result`, `keybr-math`, `keybr-phonetic-model`, `keybr-textinput`, `keybr-settings`, `keybr-rand`, `keybr-unicode` and `keybr-lang`, and it comes with about 6k LOC of tests. Vendor it as-is.
- **Statistics are keyed by Unicode code point, not by physical key.** The text state machine consumes `InputEvent.data` characters ([up] `packages/keybr-textinput-events/lib/inputhandler.ts:119-192`). So a Svalboard that types through the OS (HID → OS layout → characters) already works with the engine unchanged. Physical identity (`KeyId` = `KeyboardEvent.code`) is used only for:
  - the on-screen keyboard (depressed keys, the next-key pointer, the heatmap);
  - layout emulation;
  - choosing *which letters exist* (`Keyboard.getCodePoints()`).
- **The UI layer will not port cleanly.** `keybr-widget`, `keybr-themes`, `keybr-*-ui`, `keybr-chart` and `page-practice` together are about 14k LOC. They use LESS CSS modules, their own CSS-variable theme system, `react-intl` on every string, and a webpack asset pipeline. Keybard uses Tailwind v4 tokens plus Radix and Lucide, with no i18n ([kb] `package.json`). Rewrite these as Keybard components and use keybr's as the design reference.
- **svalbr is a thin proof of concept (about 150 meaningful lines plus vendored Vial JS).** It contributes:
  1. a 52-key geometry indexed `row*6+col`, which matches Keybard's `SVALBOARD_LAYOUT` almost exactly;
  2. a layer-0-only keymap → `CharacterDict` conversion;
  3. a letters-only `KeyboardEvent.code` → matrix index table.

  The USB/Vial code is stale and Keybard already supersedes it.

---

## 1. Package dependency graph for a practice/training mode

### 1.1 Graph (internal deps from each `package.json`)

```
page-practice ─┬─ lesson-loader ─┬─ content-words ─ content ─ (intl, keyboard, lang, unicode, widget)
               │                 ├─ content-books
               │                 ├─ phonetic-model-loader ─ (request, pages-shared, debug)
               │                 └─ lesson
               ├─ lesson ──────── code, content, keyboard, lang, math, phonetic-model, rand,
               │                  result, settings, textinput, unicode
               ├─ result ──────── keyboard, lang, math, phonetic-model, settings, textinput
               ├─ textinput ───── keyboard, lang, settings, themes(!), unicode
               ├─ textinput-events ─ keyboard, settings, unicode, widget
               ├─ textinput-ui ─── intl, keyboard, lang, settings, textinput, textinput-events,
               │                   textinput-sounds, unicode, widget
               ├─ keyboard-ui ──── intl, keyboard, keyboard-io, lang, unicode, widget
               ├─ lesson-ui ────── color, intl, lang, lesson, phonetic-model, result, settings, themes, widget
               ├─ chart ───────── intl, keyboard, keyboard-ui, lesson, lesson-ui, math, phonetic-model,
               │                   result, settings, textinput, themes, widget
               └─ pages-shared, debug, intl, widget …
phonetic-model ─ binary, keyboard, rand, unicode, widget(!)
keyboard ─────── intl, lang, settings, unicode
math, rand, unicode, lang, binary, intl: leaves (no internal deps)
```

Sources: each `packages/*/package.json` "dependencies", e.g. [up] `packages/keybr-lesson/package.json` and [up] `packages/page-practice/package.json`.

The two `(!)` edges are the only places where the pure core reaches into UI packages:

- `keybr-textinput` imports `@keybr/themes`, for font definitions only ([up] `packages/keybr-textinput/lib/font.ts:8`).
- `keybr-phonetic-model` depends on `@keybr/widget`. The use is a React `Alphabet.tsx` component ([up] `packages/keybr-phonetic-model/lib/Alphabet.tsx`). Both are cheap to cut.

**External runtime deps.** Across the whole monorepo the browser side uses only `react@^19.3`, `react-dom`, `react-intl@^12`, `react-router@^8`, `clsx`, `@mdi/js` and `zod`. The `@fastr/*` packages, `knex` and `objection` are server-side ([up] `package.json` dependencies). Keybard already ships `react@^19.1` and `clsx` ([kb] `package.json`). The core packages import nothing external except `node:test`/`rich-assert` in tests.

### 1.2 Per-package table

| Package | Purpose | LOC (src / test) | External / env coupling | Styling | Verdict |
|---|---|---|---|---|---|
| `keybr-math` | Exponential smoothing filter, polynomial regression, r², histograms, vectors | 733 / 473 | none | none | **Vendor as-is** |
| `keybr-rand` | Seeded LCG, weighted sampling | 238 / 186 | none | none | **Vendor as-is** |
| `keybr-unicode` | Code point utils, diacritic combining | 908 / 230 | none | none | **Vendor as-is** |
| `keybr-lang` | `Enum`/`XEnum`, type guards | 462 / 342 | none | none | **Vendor as-is** |
| `keybr-binary` | Reader/Writer for binary result export | 541 / 498 | none | none | Vendor only if the binary export format is kept |
| `keybr-settings` | Typed `Settings` with props (`booleanProp`, `numberProp`, `itemProp`…), React context | 380 / 245 | `localStorage` in `preferences.ts:15-32`; React context | none | **Vendor as-is**. Keep the props model and replace the storage adapter (see §3.6). |
| `keybr-phonetic-model` | Markov transition table loader, `Letter`, `Filter`, word generation, censor blacklists | 1128 / 380 (+60 KB blacklist JSON) | `fs-load.ts` uses `node:fs` (node-only; skip it). `Alphabet.tsx` uses React and widget. | none | **Vendor**, dropping `fs-load.ts`, `Alphabet.tsx`, `example*.ts` |
| `keybr-phonetic-model-loader` | Fetches `model-<lang>.data` through webpack asset URLs | 203 / 0 | `@keybr/request`, `pages-shared`, webpack `.data` asset imports ([up] `lib/assets.ts:1-35`, `lib/loader.ts:10-20`) | none | **Rewrite** as about 20 lines using Vite `?url` (or inlined for Paranoid) |
| `keybr-content` | `WordList`, `Book`, `Content` types | 372 / 25 | intl, widget (UI bits) | none | **Adapt**: types only |
| `keybr-content-words` | Per-language word lists, dynamic `import()` JSON | 309 / 59 | webpack chunk names ([up] `lib/load.ts:4-30`) | none | **Adapt**: English only at first; Vite handles `import(json)` |
| `keybr-content-books` | Public-domain book texts (1.1 MB data) | 117 / 37 | none | none | **Skip for v1** (books mode) |
| `keybr-content-quotes` | Quotes | 7 / 9 | none | none | Skip |
| `keybr-code` | PEG-grammar code-snippet generator for 10+ languages | 12,262 / 426 (generated grammars) | none | none | **Skip for v1**. Large and not Svalboard-specific. Optional later. |
| `keybr-textinput` | Typing state machine (`TextInput`), `Step`, `Histogram`, stats | 819 / 909 | imports `@keybr/themes` for `Font` only | none | **Vendor**. Stub or replace `font.ts`. |
| `keybr-textinput-events` | DOM → `IKeyboardEvent`/`IInputEvent`, `TimeToType`, layout emulation, depressed keys | 653 / 746 | DOM `KeyboardEvent`/`InputEvent`, hidden `<textarea>`; `process.env.NODE_ENV` | none | **Adapt**: keep `inputhandler.ts` + `timetotype.ts`; replace emulation with a Svalboard key resolver (§2) |
| `keybr-textinput-ui` | Text area, animated cursor, lines | 1372 / 335 | react-intl, widget | 4 `.module.less` | **Rewrite** in Tailwind (logic in `TextLines`/`chars.tsx` is a reference) |
| `keybr-textinput-sounds` | Click sounds | 427 / 0 | `@keybr/request`, audio assets | none | Skip v1 |
| `keybr-keyboard` | `Keyboard`, `KeyShape`, `KeyCombo`, `Layout` (104 layouts), `Geometry` (13), `Language` | 11,870 total, of which **5,798 are layout tables** and 2,428 geometry tables; core about 3.6k / 603 | React context only | none | **Adapt**: keep `keyboard.ts`, `keyshape.ts`, `keycombo.ts`, `keycharacters.ts`, `types.ts`, `language.ts`. Drop the 104 layout tables and their loader; build a `Keyboard` from the Svalboard keymap. |
| `keybr-keyboard-io` | Layout import/export (KLE-like parsers) | 1005 / 242 | none | none | Skip |
| `keybr-keyboard-ui` | SVG virtual keyboard + heatmap/pointer/transition/zone layers | 1878 / 554 | react-intl, widget | 7 `.module.less` | **Rewrite** on Keybard's Svalboard key renderer; port the heatmap/pointer *logic* |
| `keybr-lesson` | Lesson types, `Target`, `LessonKey(s)`, `LearningRate`, `DailyGoal`, `Dictionary`, text fragments | 1234 / 1702 | none (pure) | none | **Vendor as-is** |
| `keybr-lesson-loader` | Loads model + word list, builds a `Lesson` | 128 / 31 | `pages-shared` | none | **Rewrite** (about 50 lines) |
| `keybr-lesson-ui` | Key set strip, key details, daily goal, calendar, gauges | 1478 / 542 | react-intl, widget, themes, color | 10 `.module.less` | **Rewrite** (reference for information design) |
| `keybr-result` | `Result`, `KeyStatsMap`, `SummaryStats`, `StreakList`, `DailyStats`, accuracy, groups | 1216 / 1105 | React context (`context.ts`), react-intl in `speedunit.ts`; test fake `fake.tsx` | none | **Vendor**, minus the React-context/intl helpers |
| `keybr-result-io` | Legacy JSON + binary encode/decode of results | 344 / 285 | none | none | **Vendor** `legacyjson.ts` (the IndexedDB value format) |
| `keybr-result-loader` | IndexedDB "history" store, remote sync, public users | 1083 / 896 | IndexedDB; `remotesync.ts` → server `/_/sync/...` | none | **Adapt**: keep `local.ts` + `indexeddb/`; drop remote/public |
| `keybr-result-userdata` | Server user data | 126 / 260 | `@keybr/config` (server) | none | Skip (server) |
| `keybr-settings-loader` | Settings localStorage + server sync | 191 / 198 | `request.PUT("/_/sync/settings")` ([up] `lib/internal/storage.ts:5-40`) | none | **Rewrite** (Keybard `appStorage`) |
| `keybr-chart` | Speed/accuracy/key-speed/learning-progress charts, drawn on canvas via widget `Shapes` | 1960 / 503 | widget canvas, themes `useComputedStyles` ([up] `lib/use-chart-styles.ts:1-8`), react-intl | 2 `.module.less` | **Adapt/rewrite**: port the data transforms (`dist/`, `keyusage.ts`, `graph.ts`); redraw in SVG with Keybard tokens |
| `keybr-widget` | Whole component kit (buttons, popups, canvas, tours…) | 4789 / 954 | react, clsx | 41 `.module.less` | **Skip**; use Keybard's Radix/shadcn components |
| `keybr-themes`, `keybr-color` | Theme engine (CSS custom properties, custom themes, fonts) | 1148 + 1928 | react | LESS + CSS vars | **Skip**; map their semantic variables to Keybard tokens |
| `keybr-intl` | react-intl wrapper + 2.9 MB of message catalogs | 776 / 366 | react-intl | none | **Skip**; Keybard is English-only |
| `page-practice` | The practice page: Controller, Presenter, Progress, LessonState, settings screens, tour | 3561 / 419 | react-intl ×26 files, widget | 8 `.module.less` | **Adapt the logic** (`state/*.ts`), **rewrite the views** |
| `server`, `keybr-multiplayer-*`, `keybr-highscores`, `keybr-oauth`, `keybr-database`, `page-account`, `page-highscores`… | Server, accounts, multiplayer | — | node/DB | — | **Skip** |

**Styling across keybr.** Webpack plus `less-loader` CSS modules (`*.module.less`). Theming is done by CSS custom properties, e.g. `--textinput--hit`, `--textinput--miss`, `--LessonKey--included`, `--LessonKey--excluded`, `--LessonKey--uncalibrated`, `--Chart-speed`, `--Chart-accuracy`, `--KeyboardKey-pointer`, `--thumb-zone-color` (grep across `keybr-keyboard-ui`, `keybr-lesson-ui`, `keybr-textinput-ui` and `keybr-chart`). Those variable names are a ready-made inventory of the **semantic color roles** a Keybard trainer needs.

---

## 2. How keybr identifies keys, and what changes for a Svalboard

### 2.1 Three separate identities

1. **`KeyId` = `KeyboardEvent.code`** (string, e.g. `"KeyA"`, `"ShiftLeft"`) ([up] `packages/keybr-keyboard/lib/types.ts:9`). It keys:
   - `CharacterDict` (`KeyId → [a, shift, alt, shift+alt]` characters, `types.ts:40-42`);
   - `GeometryDict` (`KeyId → {x, y, w, h, zones, homing, labels, shape}`, `types.ts:44-55`);
   - `Keyboard.shapes` and `Keyboard.characters` (`keyboard.ts:19-23`);
   - `IKeyboardEvent.code` ([up] `packages/keybr-textinput-events/lib/types.ts:10-16`);
   - depressed keys ([up] `packages/keybr-textinput-events/lib/use-depressed-keys.ts:1-24`).
2. **`CodePoint`** (the character typed). This is what the learning engine is keyed on:
   - `Step.codePoint` ([up] `packages/keybr-textinput/lib/textinput.ts:19-24`);
   - `Histogram` is `Map<CodePoint, Sample>` ([up] `packages/keybr-textinput/lib/histogram.ts:11-38`);
   - `MutableKeyStats.append` reads `histogram.get(letter.codePoint)` ([up] `packages/keybr-result/lib/keystats.ts:131-155`);
   - `LessonKeys` is a `Map<CodePoint, LessonKey>` ([up] `packages/keybr-lesson/lib/key.ts:104-109`).
3. **`KeyCombo`** links them: `Keyboard.combos: Map<CodePoint, KeyCombo{id: KeyId, modifier, prefix?}>`. It is built from the 4 shift/alt levels in `CharacterDict` plus dead keys ([up] `packages/keybr-keyboard/lib/keyboard.ts:36-70`). When several keys type the same character, the lower-`complexity` combo wins (`keyboard.ts` `setCombo`).

### 2.2 Where the `KeyboardEvent.code` / OS-layout assumption is baked in

| Location | What it assumes |
|---|---|
| [up] `keybr-textinput-events/lib/inputhandler.ts:92-117` | Physical keys come from DOM `keydown`/`keyup` on a focused hidden `<textarea>`; ignores `event.repeat`; requires `isTrusted` in production |
| [up] `keybr-textinput-events/lib/inputhandler.ts:119-192` | **Characters come from DOM `InputEvent` (`insertText`, `deleteContentBackward`, `deleteWordBackward`, composition)**, never from keydown. This is layout-agnostic and works for a Svalboard as-is. |
| [up] `keybr-textinput-events/lib/timetotype.ts:90-123` | Time-to-type is divided by the number of Shift/Alt/AltGraph/Dead keys held: `duration / (size + 1)`. Svalboard **layer holds (`MO(n)`) and mod-taps are invisible** to this, because the OS never sees a layer key. Only real HID Shift/Alt count. |
| [up] `keybr-textinput-events/lib/emulation.ts:17-90` | "Forward" emulation maps `code` → character through keybr's own layout table. "Reverse" fixes `code` from the character. Both assume a 1:1 ANSI/ISO key ↔ `code` mapping. |
| [up] `keybr-keyboard/lib/keyboard.ts:106-128` | `getCodePoints()` (the set of teachable letters) is derived from `combos`. Weight 1 = `row==="home"`, 2 = `"top"`, otherwise 1000. This drives `keyboardOrder` letter ordering. |
| [up] `keybr-lesson/lib/lesson.ts:28-29` | `this.model = PhoneticModel.restrict(model, keyboard.getCodePoints())`: **letters the keyboard can't type are never taught**. |
| [up] `keybr-keyboard-ui/lib/PointersLayer.tsx:26-75` | The next-key finger pointer uses `keyboard.getCombo(suffix[0])` and then **hard-codes `"ShiftLeft"`/`"ShiftRight"`/`"AltLeft"`/`"AltRight"`** shapes for modifier pointers |
| [up] `keybr-keyboard-ui/lib/HeatmapLayer.tsx:23-47`, `TransitionsLayer.tsx:47` | Heatmap: code point → combo → shape |
| [up] `keybr-keyboard-ui/lib/KeyLayer.tsx:164-169` | Depressed highlight: `depressedKeys.includes(shape.id)` |
| [up] `keybr-keyboard/lib/keyshape.ts:11-25` | Zones: fingers `pinky/ring/middle/leftIndex/rightIndex/thumb`; hands `left/right`; rows `digit/top/home/bottom` |
| [up] `keybr-result/lib/result.ts:13-54`, [up] `keybr-result-io/lib/binary.ts:10,32,53` | Each `Result` stores a `Layout` (binary stores the `Layout.xid` byte and resolves it with `Layout.ALL.xget`) |
| [up] `keybr-lesson/lib/lesson.ts:32-36`, [up] `keybr-result/lib/group.ts:38-40` | History is partitioned by **layout family** (`qwerty`, `dvorak`…), so stats from another family don't seed a lesson |

### 2.3 What must change when input is (matrix position, layer, keycode)

1. **Character stream: no change required.** If the user types on the Svalboard with the browser focused, the OS turns HID keycodes into `InputEvent.data` and `TextInput`, `Histogram`, `KeyStats` and `Lesson` all work unchanged.
   - The one assumption is that the OS layout matches what Keybard thinks the keycodes mean. Keybard already models this as `internationalLayout` ([kb] `src/features/trainer/TrainerPage.tsx:22`, `useSurfaceKeys.ts:4-30` `getLabelForKeycode(keycode, layoutId)`).
2. **Teachable set and visual mapping: build a `Keyboard` from the Keybard keymap**, not from keybr layout tables.
   - Characters: for each matrix index, resolve the binding per layer (Keybard already has `resolveBinding` ([kb] `src/features/trainer/core.ts:40-49`) and `surfaceKeys` ([kb] `src/features/trainer/useSurfaceKeys.ts:7-44`), which handle mod-tap, layer-hold and modmask (`LSFT(...)`) bases).
   - Produce `CodePoint`s for unshifted and shifted output.
   - **Extend `KeyCombo` with a `layer` (and the layer-key's matrix index)**, because keybr only models None/Shift/Alt/ShiftAlt (`keyboard.ts:42-55`). Svalboard punctuation and digits typically live on `MO(n)` layers. `KeyCombo.complexity` should count the layer hold, so a character reachable on layer 0 beats a layer-2 duplicate.
3. **Physical press identity: replace `KeyId = event.code` with `KeyId = "m<index>"`** (matrix `row*cols+col`).
   - Today that identity is only knowable from Keybard Host's `pressed: number[]` ([kb] `src/features/trainer/host.ts:16-24`) or from Keybard's VIA switch-matrix polling ([kb] `src/services/keyboard.service.ts:470-475`, `usb.service.ts:172` `VIA_SWITCH_MATRIX_STATE = 0x03`).
   - Without either, depressed keys can only be *inferred* from the character typed via the combo, which is roughly what svalbr's `QMK_KEYCODES` table does (§4).
4. **Timing.** `TimeToType` ignores layer holds. For an honest per-key measure on layered characters, either:
   - accept OS-level timing (simplest; layer cost then shows up as slower letters, which is arguably the point); or
   - divide by the combo's press count derived from the Svalboard `KeyCombo` (UNVERIFIED design choice; flag for spec).
5. **Result partition.** Replace `Layout` in `Result` with a Svalboard keymap identity: for example a stable hash of the letter→(matrix, layer) map, or a user-named profile. Otherwise remapping keys silently mixes histories.
   - Keybr's `ResultGroups.byLayoutFamily` gives the pattern: the hash is the "family".
   - The binary `Layout.xid` byte cannot hold arbitrary keymaps, so use the JSON format (§3.6).
6. **Finger and zone info.** `ZoneId` lacks Svalboard concepts such as cluster direction (N/S/E/W/C) and the 6-key thumb cluster. Keep keybr's finger and hand zones for compatibility and add Svalboard metadata on the side (§4.2).

---

## 3. The adaptive algorithm in detail

### 3.1 Units and target

- Speed is in **characters per minute (CPM)**: `timeToSpeed(ms) = 60000/ms` and `speedToTime(cpm) = 60000/cpm` ([up] `packages/keybr-result/lib/result.ts:101-123`).
- `targetSpeed` defaults to **175 CPM (35 WPM), range 75–750** ([up] `packages/keybr-lesson/lib/settings.ts:49`, `lessonProps.targetSpeed`).
- **Confidence** = `speedToTime(targetSpeed) / timeToType`, so 1.0 means exactly at target ([up] `packages/keybr-lesson/lib/target.ts:1-24`).

### 3.2 Per-key statistics (what "timeToType" means)

- Per lesson, `TextInput` records a `Step{timeStamp, codePoint, timeToType, typo}` per expected character ([up] `packages/keybr-textinput/lib/textinput.ts:19-24`, typo handling `:160-200`). `forgiveErrors` and `stopOnError` both default to true ([up] `packages/keybr-textinput/lib/settings.ts:40-42`).
- `Histogram.from(steps)`: per code point it counts `hitCount`, `missCount` (typo steps), and the mean `timeToType` over non-typo steps ([up] `packages/keybr-textinput/lib/histogram.ts:52-90`). `validate()` requires at least 3 distinct characters (`:40-50`).
- `Result` = layout, textType, timeStamp, length, time, errors, histogram ([up] `packages/keybr-result/lib/result.ts:46-68`). It derives:
  - `speed = length/(time/1000)*60`
  - `accuracy = (length-errors)/length`
  - `score = speed*complexity/(errors+1)*(length/50)`
- A result is kept only if `length≥10`, `time≥1000ms`, `complexity≥1` and `histogram.validate()` (`result.ts:13-20,70-85`). Results that fail are rescued by `recoverResults` dropping invalid samples ([up] `packages/keybr-result/lib/recover.ts`).
- `MutableKeyStats.append`: for every result that contains the letter, push a `KeySample`, then smooth it with an **exponential filter, α = 0.1** ([up] `packages/keybr-math/lib/filter.ts:11-28`; [up] `packages/keybr-result/lib/keystats.ts:106-155`).
  - `timeToType` = latest filtered value.
  - `bestTimeToType` = min over filtered values.
  - `index` increments for every result, even ones that lack the letter (`:153`).

### 3.3 Guided mode: unlocking and focus ([up] `packages/keybr-lesson/lib/guided.ts:84-151`)

**Letter order.** By default letters are sorted by language frequency (`Letter.frequencyOrder`, [up] `packages/keybr-phonetic-model/lib/letter.ts:127-129`). With `keyboardOrder`, they sort by keyboard weight first (home row, then top row, then the rest), then by frequency (`letter.ts:131-138`, `guided.ts:174-184`, weights from `keyboard.ts:106-128`).

**Unlock loop.** The loop walks the ordered letters and includes each one if any rule below applies.

- `minSize = 6`: the first 6 letters are always included.
- `maxSize = 6 + round((N-6) * alphabetSize)`. `alphabetSize` is a 0..1 setting, default 0. Letters up to this count are *forced* (included and marked `isForced`).
- Any letter with `bestConfidence ≥ 1` is included. A key once mastered stays unlocked.
- Otherwise the next letter is included only if **every currently included key has confidence ≥ 1**. The comparison uses `bestConfidence` by default, or the current `confidence` when `recoverKeys` is on (default off).

The effect: exactly one new letter unlocks when all current letters have *ever* reached target speed.

**Focus.** Among included keys with confidence < 1 (best or current, per `recoverKeys`), the **lowest** one is focused (`guided.ts:138-148`).

**Text generation** (`guided.ts:153-204`):

- `Filter(includedKeys, focusedKey)`: generated words may use only included letters, and when a focused key exists **each word must contain it** ([up] `packages/keybr-phonetic-model/lib/filter.ts:8-34`; prefix seeding at [up] `packages/keybr-phonetic-model/lib/phoneticmodel.ts:201-209`).
- `naturalWords` (default **true**): take up to 1000 dictionary words that pass the filter ([up] `packages/keybr-lesson/lib/dictionary.ts`). If there are fewer than 15, top up with phonetic pseudo-words.
- Phonetic pseudo-words come from an order-N Markov chain over letters with weighted random sampling. Space probability is boosted by `1.3^len` to keep words short; a word is retried up to 5 times ([up] `packages/keybr-phonetic-model/lib/phoneticmodel.ts:55-140`; `TransitionTable.order` at `transitiontable.ts:40,106-119`).
- `mangledWords` applies the `capitals` and `punctuators` probabilities (0..1, default 0) ([up] `packages/keybr-lesson/lib/settings.ts:46-47`). `uniqueWords` avoids immediate repeats.
- `generateFragment`: emit words until the total is ≥ `100 + round(lesson.length*100)` characters, each repeated `repeatWords` times ([up] `packages/keybr-lesson/lib/text/fragment.ts:5-23`).

### 3.4 Learning-rate forecast ([up] `packages/keybr-lesson/lib/learningrate.ts`)

- Take a key's last 30 samples, then narrow them to the current "session" with `findSession` ([up] `packages/keybr-lesson/lib/learningsession.ts:3-16`). The session cuts at the latest gap of more than 1 hour, or at the latest slowdown once at least 5 samples follow it.
- Fit a polynomial (degree 1 for ≤10 points, 2 for ≤20, else 3) of speed against lesson index.
- If r² ≥ 0.5, report:
  - `learningRate` = derivative at the last index (CPM per lesson);
  - `remainingLessons` = the first i ≤ 50 at which the fit reaches target.

  This feeds the "N more lessons to unlock" UI ([up] `packages/page-practice/lib/practice/LearningRateDescription.tsx`).

### 3.5 Other lesson types

Every non-guided type uses `LessonKeys.includeAll` (no unlocking or focus); only text generation differs:

| Type | Letters | Generation | Source |
|---|---|---|---|
| `wordlist` | model letters | random words from the language list (`wordListSize` 10–1000, `longWordsOnly`) | [up] `packages/keybr-lesson/lib/wordlist.ts:32-44`; settings `settings.ts:27-30` |
| `books` | model letters | sequential paragraphs from a bundled book | [up] `packages/keybr-lesson/lib/books.ts:48-58` |
| `custom` | model letters | user text (≤10,000 chars), optional lowercase / letters-only / randomize | [up] `packages/keybr-lesson/lib/customtext.ts:22-32`; `settings.ts:36-41` |
| `code` | `Letter.programming` | `keybr-code` grammars (`syntax.generate`) | [up] `packages/keybr-lesson/lib/code.ts:16-28` |
| `numbers` | `Letter.digits` | Benford-distributed numbers | [up] `packages/keybr-lesson/lib/numbers.ts:20-32` |

All six are registered in `LessonType` with `TextType` GENERATED/NATURAL/CODE/NUMBERS ([up] `packages/keybr-lesson/lib/lessontype.ts`).

**Daily goal.** `dailyGoal` is minutes per day, default 30, range 0–120 ([up] `packages/keybr-lesson/lib/settings.ts:50`, `dailygoal.ts:12-27`).

**Events.** `LetterEvents` emits `new-letter` when the included set grows ([up] `packages/page-practice/lib/practice/state/event-source-letter.ts:9-35`). Top-speed, top-score and daily-goal events sit alongside it.

### 3.6 Storage formats

**Results.** IndexedDB database `"history"`, version 1, a single auto-increment object store ([up] `packages/keybr-result-loader/lib/internal/local.ts:10-54`). Values use `resultToJson` (legacy compact JSON) ([up] `packages/keybr-result-io/lib/legacyjson.ts:24-52`):

```json
{ "l": "en-us", "m": "generated", "ts": 1700000000000, "n": 120, "t": 41000, "e": 3,
  "h": { "101": { "h": 14, "m": 1, "t": 312 }, "116": { "h": 9, "m": 0, "t": 280 } } }
```

Keys of `h` are decimal code points; `h` = hits, `m` = misses, `t` = mean ms. `resultFromJson` validates every field (`:54-90`).

There is also a binary export with header `0x4B455942` ("KEYB") version 2 and the layout stored as an xid byte ([up] `packages/keybr-result-io/lib/header.ts:1-15`, `binary.ts:10-53`).

**Settings.** One JSON object under `localStorage["settings"]` for anonymous users, or a server PUT to `/_/sync/settings` for signed-in users ([up] `packages/keybr-settings-loader/lib/internal/storage.ts:5-40`). Keys are dotted prop names (`lesson.targetSpeed`, `keyboard.layout`…).

**Keybard.** The existing trainer stores preferences under `keybard.trainer.v1` ([kb] `src/features/trainer/core.ts:20`). Keybard also has an `appStorage` wrapper ([kb] `src/features/trainer/host.ts:4,14`).

### 3.7 How progress is seeded

- `Progress` holds `MutableKeyStatsMap` over `lesson.letters`, plus `SummaryStats`, `StreakList` and `DailyGoal` ([up] `packages/page-practice/lib/practice/state/progress.ts:19-50`).
- On load, every stored result (already filtered by layout family through `Lesson.filter`) is replayed with `seed`, or with `seedAsync` in chunks of 100 that yield to the event loop (`:52-96`). **Seeding is a full replay of history every page load.** There is no cached per-key state.
- `LessonState` copies `Progress`, calls `lesson.update(keyStatsMap)` to get `LessonKeys`, then generates text ([up] `packages/page-practice/lib/practice/state/lesson-state.ts:50-65`). On completion it calls `Result.fromStats(layout, textType, Date.now(), makeStats(steps))` (`:91-98`).
- A fresh user starts with all stats `null`, so confidence is `null` and treated as 0. The first 6 frequency-ordered letters unlock (`e t a o i n` style for EN). UNVERIFIED: the exact EN order depends on the `model-en.data` frequencies.

---

## 4. svalbr: what River changed

### 4.1 Inventory (tree diff vs upstream)

- **Added `packages/sval/`**: 14,775 lines, almost all vendored Vial/"kbinfo" JS:
  - `keygen.js` (13,454): `CODEMAP` int→`KC_*` and `KEYMAP`/`KEYALIASES` tables;
  - `keys.js` (357): `KEY.parse/stringify/define`;
  - `usbhid.js` (203): WebHID;
  - `util.js` (323);
  - `vial/vial.js` (270): VIA + **Vial `0xFE` prefix commands**, xz-compressed definition fetch;
  - `vial/kb.js` (82): layer count + `CMD_VIA_KEYMAP_GET_BUFFER` in 28-byte chunks.

  It depends on `xzwasm` ([sv] `packages/sval/package.json`).
- **`packages/sval/lib/index.ts:13-45` `getKeymap()`** does the following:
  1. Opens WebHID with filter `usagePage 0xff60, usage 0x61`.
  2. Runs Vial `getKeyboardInfo` and `getKeyMap`.
  3. Takes **layer 0 only** (`kbinfo.keymap[0]`).
  4. For each flat index `i` (= `row*6+col`), takes `KEY.define(code).str`, the display label. Then:
     - a single char `A`–`Z` produces `CharacterDict["Key"+i] = [lower, upper]` and records `QMK_KEYCODES["Key"+letter] = "Key"+i`;
     - any other single char produces `[chr]` with no shifted value;
     - **anything longer becomes `[{ligature: str}]`**, i.e. modifier and layer keys (`"Shift"`, `"MO(2)"`-style labels) are shown as labels and never produce characters.
- **[sv] `packages/keybr-keyboard/lib/geometry/datahand.ts`**: a 52-entry `GeometryDict` (§4.2). Registered as `Geometry.DATAHAND` with name `"datahand/svalboard"`, new form `"datahand"` and no zone mods ([sv] `packages/keybr-keyboard/lib/geometry.ts:111-116,140`). It was added to `Layout.EN_US.geometries` ([sv] `layout.ts:20`) and the loader ([sv] `load.ts:6,171`).
- **[sv] `packages/keybr-keyboard/lib/context.tsx:30-51`**: `KeyboardProvider` ignores settings and defaults to `loadKeyboard(EN_US, DATAHAND)`. It renders a raw `<button>Load keymap</button>` that replaces the keyboard with `new Keyboard(Layout.EN_US, Geometry.DATAHAND, keymap, DATAHAND)`.
- **[sv] `packages/page-practice/lib/practice/Controller.tsx:69-71,115-127`**: `translateToSvalCode(event.code) = QMK_KEYCODES[code]` for depressed-key highlighting. This assumes the **OS layout is US QWERTY** and that the key types an A–Z letter; for any other key the result is `undefined`.
- **Removed `packages/server`.** The site is static: `dev-server.js` serves `root/public` ([sv] `dev-server.js:1-30`), deployed by GitHub Pages ([sv] `.github/workflows/static.yml`).
  - `webpack.config.js:109-114` still declares a `server` target pointing at `packages/server-cli/lib/main.ts` (UNVERIFIED whether it still builds).
  - svalbr also lacks upstream's newer `keybr-keyboard-io` and has `keybr-sound` and `page-word-count` instead. That is age drift, not Svalboard work.
- Other diffs (`TypingSettings.tsx`, `result.ts`, `storage.ts`, intl JSON…) are **upstream drift**: svalbr is older than upstream. They are not Svalboard changes.

### 4.2 Geometry: index scheme and zones

`datahand.ts` keys are `Key0`…`Key58`, indexed `row*6+col`. Col 5 is present only in the thumb rows 0 and 5. Positions match Keybard's `SVALBOARD_LAYOUT` ([kb] `src/constants/svalboard-layout.ts:19-96`) to within about 0.4u (e.g. thumb `Key3` is x=7.9 in svalbr and 8.2 in Keybard; right-side keys are shifted by about 0.3u).

| Matrix row | Cluster | svalbr zones |
|---|---|---|
| 0 | Left thumb (6 keys) | **none** |
| 1 | L index | `leftIndex,left` |
| 2 | L middle | `middle,left` |
| 3 | L ring | `ring,left` |
| 4 | L pinky | `pinky,left` |
| 5 | Right thumb (6 keys) | **none** |
| 6–9 | R index / middle / ring / pinky | `rightIndex/middle/ring/pinky,right` |

Within a finger cluster, the coordinates and Keybard's comments ([kb] `svalboard-layout.ts:30-35` etc.) give this column mapping:

| Col | Direction | Evidence |
|---|---|---|
| 0 | South (toward palm, y+1) | |
| 1 | East (+x) | |
| 2 | Center | |
| 3 | North (y−1) | |
| 4 | West (−x) | |

The directions are on-screen and **not mirrored per hand**: col 1 is +x for both left index (x 10.5 vs center 9.5) and right index (14.8 vs 13.8). Whether firmware or Keybard calls these "in/out" (toward or away from the thumb) needs confirming against the firmware (UNVERIFIED).

**Gaps in River's geometry:**

- No `homing` flags and no row zones (`home`/`top`), so `getCodePoints().weight()` returns 1000 for every key and `keyboardOrder` degenerates to plain frequency order.
- Thumb keys have no `thumb`/hand zone.
- There is no cluster-direction metadata.
- There is no Svalboard key `shape`. keybr-keyboard-ui draws 1u squares.

### 4.3 Reusable vs stale

**Reusable:**

- The `row*6+col` → coordinate table as a cross-check only. Keybard's own `SVALBOARD_LAYOUT` and `geometry(board)` ([kb] `src/features/trainer/core.ts:50-59`) are the canonical source and already handle `board.keylayout`.
- The *idea* of building a `CharacterDict` from the live keymap, and of keying shapes by matrix index.
- `QMK_KEYCODES` as a concept: inverting the keymap to answer "which matrix key types this letter". Keybard should compute it per layer from `resolveBinding`, not just for A–Z on layer 0.

**Stale or redundant:**

- All of `packages/sval/lib/*.js`. Keybard already has `keyService.stringify/parse/define` ([kb] `src/services/key.service.ts:106-200`), its own USB stack (`usb.service.ts`), the Sval protocol (`sval.service.ts`) and keymap reading.
- svalbr's Vial path: Vial `0xFE` commands, the xz definition blob, `xzwasm`. It targets the old Vial firmware (`svalboard/vial-qmk`), not the current `svalboard/qmk` Sval `0xDF` protocol.
- `KEY.define(...).str` label-based character derivation. It treats `LSFT(KC_QUOTE)` as a ligature, not `"`, so it misses shifted symbols. Keybard's `surfaceKeys` already resolves modmask and shift ([kb] `useSurfaceKeys.ts:15-30`).
- The always-EN_US `Layout` identity (results are mixed with ANSI QWERTY history under family `qwerty`).
- The raw "Load keymap" button inside the context provider.

---

## 5. Risks

**Bundle size and asset handling.**

- Core vendored packages are about 5k LOC, small once minified (UNVERIFIED; no build was run, by rule).
- Phonetic model `model-en.data` is 47,054 B (25,454 B gzip). Others range from 30 KB to 745 KB (`vi` 745 KB, `ja` 572 KB, `th` 326 KB; total 3.4 MB) ([up] `packages/keybr-phonetic-model/assets/`).
- `words-en.json` is 128,321 B (39,091 B gzip); all word lists total 4.6 MB.
- Books: 1.1 MB. Blacklists: 60 KB (statically imported, so all languages are bundled: [up] `packages/keybr-phonetic-model/lib/blacklist/blacklist.ts:2-4`. Make them lazy or EN-only).
- `keybr-code` grammars: 12k LOC.
- **Recommendation:** EN only for v1, lazy-loaded with `import()` so the editor bundle doesn't grow.

**Keybard Paranoid (single file, no network).** keybr fetches models over HTTP ([up] `packages/keybr-phonetic-model-loader/lib/loader.ts:10-20`). Paranoid must inline the EN model (about 63 KB as base64) and word list. `build/paranoid.ts` rejects external references (per CLAUDE.md), so loaders need a Paranoid branch.

**Build-tool coupling.**

- webpack `.data` asset imports, `webpackChunkName` comments, `.module.less`, and `process.env.NODE_ENV` (7 core files) all need Vite equivalents or a `define`.
- Upstream uses `node:test` + `rich-assert`; Keybard uses vitest, so the vendored tests need porting (worth it: about 6k LOC of tests on the core).

**i18n.**

- react-intl appears in 26 page-practice files, 10 lesson-ui files, 9 chart files and 3 textinput-ui files. The 2.9 MB of catalogs is irrelevant to an English-only Keybard. Stripping intl is the main cost of reusing any keybr UI.
- Language support in the *engine* (phonetic models per language) can stay.

**Theming.** keybr's theme system conflicts with Keybard's token system (`src/index.css`; `tests/theme/no-hardcoded-chrome-colors.test.ts` fails on hard-coded chrome colors, per CLAUDE.md). Canvas charts read colors with `getComputedStyle` ([up] `packages/keybr-chart/lib/use-chart-styles.ts`), so any ported chart must read Keybard tokens and re-render on theme change.

**Server-only pieces (skip):**

- remote result sync ([up] `packages/keybr-result-loader/lib/internal/remotesync.ts`) and public profiles;
- settings sync (`/_/sync/settings`);
- accounts, OAuth, highscores, multiplayer, `keybr-result-userdata` (`@keybr/config`);
- `page-practice` reads `pages-shared` page data. Replace it with Keybard context.

**Semantics risks specific to Svalboard:**

- Layer holds aren't seen by `TimeToType`, so layered characters look slower.
- Combos (QMK combos), tap-dance and mod-tap produce characters whose physical source is ambiguous from the character stream alone.
- Keymap edits invalidate the char→key map: partition results by a keymap hash or migrate them.
- The OS layout must match Keybard's `internationalLayout` assumption.
- Matrix-level truth needs either Keybard Host (origin-gated to keybard.svalboard.com / next.keybard.svalboard.com; [kb] `src/features/trainer/host.ts:7-11`) or WebHID matrix polling ([kb] `src/services/keyboard.service.ts:470`). The polling rate and latency are UNVERIFIED and are probably too coarse for per-press timing, but fine for highlighting.

**Full-replay seeding.** `Progress.seed` replays all history on each load (§3.7). That is fine for thousands of results, but consider caching.

**IndexedDB name collision.** keybr uses the generic database name `"history"` ([up] `packages/keybr-result-loader/lib/internal/local.ts:11`). Keybard should namespace it, e.g. `keybard.trainer.history`.

**License.** AGPL-3.0 on both sources. The owner has accepted that Keybard may go AGPL. Keep the upstream copyright headers on vendored files.

---

## 6. Suggested port shape (for the spec authors)

1. `src/features/trainer/engine/` contains vendored `math`, `rand`, `unicode`, `lang`, `settings` (props only), `phonetic-model` (minus node/React), `textinput` (minus fonts), `lesson`, `result`, `result-io/legacyjson`, plus vitest ports of their tests.
2. `svalKeyboard.ts` builds a keybr `Keyboard` from a Keybard `KeyboardInfo`:
   - `KeyId = "m"+index`;
   - geometry from `geometry(board)`;
   - characters per layer via `resolveBinding` + `surfaceKeys` logic;
   - `KeyCombo` extended with `layer` / `layerKey`;
   - zones: finger from row, plus `thumb` for rows 0 and 5;
   - `homing` = col 2 (center);
   - weights: center=1, N/S=2, E/W=3, thumb=4.

   The weights are a design proposal (UNVERIFIED), to make `keyboardOrder` meaningful.
3. Input: keep `InputHandler` + `TimeToType`. Physical presses come from Host or matrix polling when available; otherwise they are inferred from combos.
4. Storage: IndexedDB `keybard-trainer-history` with legacy-JSON values, with `l` = keymap hash, plus settings in `appStorage`.
5. UI: new Keybard-native components, using keybr's semantic roles (hit, miss, cursor, included, excluded, focused, uncalibrated, speed, accuracy, threshold) mapped to Keybard tokens.
