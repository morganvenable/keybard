# M1a notes: engine and resolver (no UI)

Branch `feat/practice-engine`. Spec: `docs/practice/spec.md` revision 3, §12 M1a. Built overnight on 2026-10-08 without hardware; nothing here talks to a board.

## Status against the M1a scope

| Scope item (§12) | Status |
|---|---|
| License change (§11) | Done, all four steps. `License Keybard as AGPL-3.0-or-later (OWNER_Q2)`: `package.json`/lockfile `license`, root `LICENSE`. `Offer Keybard's source in About and in the Paranoid file (AGPL)`: About's license line, **Source code** link and keybr.com/svalbr credit; the license notice and source URL as a comment at the top of the Paranoid file. **The identifier (-or-later vs -only) still needs Morgan's sign-off before merging** (see Review, R3). |
| Vendored engine with every §9.2 patch listed in `vendor/keybr/README.md` | Done. |
| Ported keybr tests with rebuilt fixtures | Done: 6.7k LOC in `tests/practice/vendor/keybr/`. |
| Resolver: whitespace table, plain, layer holds, user and firmware Shift, LT/MT tap side, costs | Done, with tests. |
| Svalboard `Keyboard` adapter; Guided lessons in English, Center-first and Frequency | Done. |
| `store/` with §8.2 packing, snapshots and the memory twin | Done. The IndexedDB store and the memory twin pass one shared contract suite. |
| Measured size of the trimmed engine, recorded in the spec (§9.8) | Done. |

Acceptance:

- A new profile on `sval-default.svil` starts with the 6 center letters (a d f k l s); the 7th unlock is `j`, the 8th `e` (`tests/practice/lessons/guided.test.ts`).
- Every listed engine, resolver, timing and store test passes (§9.9 resolver and timing lists are covered one for one; store tests cover migrations, packing round trip and boundaries, retention, snapshot invalidation on a fingerprint change, export/import Merge and Replace, and result records under keybr's forgiveErrors recovery).
- The store contract (`tests/practice/store/storeContract.ts`) runs on both `MemoryPracticeStore` and `IndexedDbPracticeStore` (over `fake-indexeddb`).
- No `@keybr/code` or book import remains: `tests/practice/vendor/patches.test.ts` scans every Practice source.

Checks run before each commit: `npx tsc --noEmit -p .` and `npm test` (180 files, 1,326 tests after the review fixes). Before each push: `npm run build` and `npm run build:paranoid` (both pass; Practice is not imported by the app yet, so the bundles change only by the About lines and the Paranoid notice).

## What was built

`src/features/practice/`:

- `vendor/keybr/`: the engine at keybr `05a37bc`, with `LICENSE` and `README.md` (packages, upstream commit, every patch). `es2022.d.ts` adds the ES2022 library types the engine needs.
- `content/assets/model-en.data`, `words-en.json`; `content/loader.ts` (Vite `?url` model, lazy word list, base64 helper for Paranoid).
- `keymap/resolver.ts`, `whitespace.ts`, `geometry.ts`, `fingerprint.ts`, `svalKeyboard.ts`.
- `input/timeToType.ts`.
- `types.ts`; `store/db.ts`, `memory.ts`, `migrations.ts`, `pack.ts`, `results.ts`, `events.ts`, `profiles.ts`, `export.ts`, `base64.ts`.
- `lessons/guided.ts`; `state/settings.ts`, `state/progress.ts`.

`tests/practice/`: `vendor/` (ported tests, `rich-assert.ts` stand-in, `patches.test.ts`), `keymap/`, `input/`, `store/`, `lessons/`, `state/`, `content/`, `fixtures/`.

Existing files changed: `package.json`/`package-lock.json` (license; `fake-indexeddb` dev dependency), `src/constants/owner-decisions.ts` (OWNER_Q2 comment), `src/layout/SecondarySidebar/Panels/AboutPanel.tsx` (license, Source code, credits), `build/paranoid.ts` and `docs/paranoid.md` (license notice), plus the spec (§6.3, §8.2 shift bits, §9.8 measurements). New: `src/constants/license.ts`.

## Owner decisions read

- OWNER_Q1 → `DEFAULT_SETTINGS.order` and the Learn preset (`state/settings.ts`).
- OWNER_Q2 → `package.json` `license` (own commit); About and the Paranoid notice read it (`constants/license.ts`, `build/paranoid.ts`), and `tests/build/license.test.ts` checks they agree.
- OWNER_Q5 → `pruneEvents()` default (`store/events.ts`).
- OWNER_Q6 → `activeProfile()` scope (`store/profiles.ts`); both 'user' and 'per-board' are implemented and tested.

## Deviations from the spec, and why

1. **Existing code changed since the spec (code wins).** The file loader now converts a `.svil`'s decimal `uid` to hex (`file.service.ts` `parseContent`), so files and connected boards already agree; `boardIdentity()` treats a file's `kbid` as hex by default and takes `kbidRadix: 10` for a raw decimal uid. The spec's §8.1 note about decimal file kbids is out of date.
2. **`keybr-binary` keeps `utf8.ts`.** §9.2 drops it, but `io.ts` (needed by `TransitionTable`) imports it. 129 LOC, verbatim.
3. **`keyboard/filter.ts` and `fakes.ts` are vendored** although §9.2 doesn't list them: `textinput.ts` imports `filterText`, and `fakes.ts` holds test helpers other packages' tests use.
4. **`layout.ts` keeps `Layout.EN_US`** next to `Layout.custom`, so keybr's own tests and `legacyjson.ts` still work. Practice never uses it.
5. **ES2022 library types** come from `vendor/keybr/es2022.d.ts` (`/// <reference lib="es2022" />`) instead of a tsconfig change, to keep M1a to new files. A reference lib applies to the whole program, so all of `src/` may now use ES2022 APIs (`Array.prototype.at`, `Error` cause, `Intl.Segmenter`); every browser Practice supports has them. If the owner prefers it explicit, move it to `tsconfig.json` `lib`.
6. **The input handler stays vendored.** §9.1 lists `input/inputHandler.ts`; the patched keybr handler (`vendor/keybr/textinput-events/inputhandler.ts`) is used as is, with an injectable timer. Its default timer reports the raw interval; Practice's `PracticeTimeToType` does the §6.5 division when M1b wires the session.
7. **Resolver details the spec leaves open:**
   - Layer and modifier keys are recognized from `keyService.stringify` names (`MO(n)`, `LTn(kc)`, `OSL(n)`, `*_T(kc)`, `KC_LSHIFT`…), not `getKeyContents` types; names are stable across QMK keycode numberings. Firmware Shift uses the keycode bits as specified.
   - A Shift mod-tap (`LSFT_T`) held for Shift is priced like an LT hold (+0.8), since it can delay output and misfire.
   - The direction tie-break applies to every press of a path (target and prerequisites), not only the target.
   - In a held layer state, only keys bound on the newly held layer become paths; a path that only adds presses to another one with the same path key is dropped (for example LT14 + MO(1) for `!`).
   - Every Shift key reachable in a layer state yields its own user-Shift path (same path key); the cheapest is primary.
8. **Event packing.** `layer`, `index` and the shift bits (w1 27–28) all describe the key **pressed**: a hit's path shift, or the new optional `phys.shift` on misses and strays (3 = unknown). A hit's `path` is rebuilt from them; a miss unpacks with `path` "" (its expected path is a different key and is not stored) and its pressed key, shift included, in `phys`. The expected path re-resolves from `expected` under the result's keymap (`x.km`). Spec §8.2 is updated. `raw` and `ttt` are rebuilt relative to the previous **hit** (a step), not the previous event, and `ttt` uses the keymap-only rule. Events store at most 2 prerequisites (a path can have 3: two holds plus Shift).
9. **Result records.** `buildResultRecord` takes the lesson's final keybr TextInput steps, each with the path it is charged to (`PracticeStep`; for a position forgiveErrors closed without a correct key, the expected primary path). `n`, `t`, `e` come from `makeStats` (2 s gap rule, paused intervals), and `h` from the same steps split per path, exactly as keybr's `Histogram.from`: the trigger step is ignored, a typo step is a miss, a step after a pause is untimed, keybr's 40–12,000 ms window applies per path. So `sum(h.m) == e` unless the trigger step itself was a typo. The keystroke events feed only `k`, `r` and `obs`/`inf`: in `k`, a miss counts against the expected key (from the miss event's path) and a stray against the pressed key. M1b must keep a path per TextInput position (`clearWord` pops steps, so take `TextInput.steps` at the end, not the `onStep` stream).
10. **Snapshots** need keybr's per-letter state; `MutableKeyStats.restore()` is a small vendored patch that replays saved samples through the same filter (listed in the vendor README). A restored progress continues exactly as a replayed one (tested).
11. **Frequency order** with keybr's English model starts **e n i a r l**, not "roughly e t a o i n" (§6.3 updated).
12. **Practice settings** carry `activeProfileId` and `readKeyPresses` (M2) in `keybard.practice.v1`; the daily goal default is 15 minutes (§2 P1) instead of keybr's 30.

## Stubbed or deferred

- `TODO(practice)` in `content/loader.ts`: the Paranoid `virtual:practice-content` module and its `vite-env.d.ts` declaration are M1b (§7.5). The loader already has `englishModelFromBase64()`.
- Session wiring (TextInput + PracticeTimeToType + events + `buildResultRecord` + store), `usePracticeSession`, `useProgress`: M1b.
- Drill, Words, Custom and Numbers wrappers (they need the same path-key `filter` override as `PracticeGuidedLesson`), the symbols generator, combos, tap dance and key overrides in the resolver: M3.
- `usbSampler`, `correlate`, the mode machine, stray detection and error classification at runtime: M2/M4 (the data shapes and packing for them are in place).

## Needs Mule testing

Nothing in M1a talks to hardware. Items to confirm on the Mule when M2 lands: that `getLabelForKeycode` output matches what the OS types for every resolved path on the default keymap, that `LT1` and `LGUI_T` tap sides emit on release as assumed, and the M0 timing questions (§9.3).

## Follow-ups

- **Owner sign-off before merging to `svalboard/keybard`:** OWNER_Q2, `AGPL-3.0-or-later` vs `AGPL-3.0-only`. It is a stubbed recommendation; relicensing is hard to undo once shipped. Changing it is one constant plus `package.json` `license` (the license test fails until both agree).
- Start presets still lack lesson type and hints (`TODO(practice)` in `state/settings.ts`): they join when settings carry them (M1b, Drill in M3).
- M1b: Paranoid content module, bundle-size check using the §9.8 measurements, session wiring.
- Consider a `withPathFilter` mixin when M3 adds the other lesson types.

## Review

An independent review of M1a (at `78fea58`) raised eight findings. Each was checked against the code; all eight were real and are fixed.

| Id | Finding | Disposition |
|---|---|---|
| M1a-R1 (major) | `h` paired each miss with the next hit, so positions keybr's forgiveErrors closes without a correct key (replaced, skipped, Space-skipped) were lost or charged to the wrong character, and `h` drifted from `e`. | **Fixed** in `Build result histograms from keybr's TextInput steps`. `h`, `n`, `t`, `e` now come from TextInput steps (`PracticeStep` = keybr `Step` + path) via `makeStats` rules; events feed only `k`, `r`, `obs`/`inf`. New `tests/practice/store/results.test.ts` drives a real `TextInput` through the replaced, skipped and Space-skip cases, checks `sum(h.m) == e`, and compares `h` with keybr's histogram character by character. |
| M1a-R2 (minor) | Packing took a miss's shift from the expected path but layer and index from the pressed key, so an unpacked miss named a third key. | **Fixed** in `Store the pressed key's shift for missed keystrokes`: the shift bits now always describe the pressed key (`phys.shift` for misses and strays, 3 = unknown); misses unpack with `path` "". Spec §8.2 and deviation 8 updated; round-trip test for expected `A` vs pressed `q`. |
| M1a-R3 (minor) | Two of §11's four license steps (About Source code link, Paranoid notice) were deferred although each milestone merges to main; OWNER_Q2 is a stubbed recommendation. | **Fixed** in `Offer Keybard's source in About and in the Paranoid file (AGPL)`: About shows the license, a **Source code** link and the keybr.com/svalbr credit (shared `PanelContent`, so both layout modes); `lockDown()` writes the notice and source URL into the Paranoid file. **OWNER_Q2 is flagged for Morgan's explicit sign-off** in Follow-ups and in `owner-decisions.ts`. Note: the Paranoid notice names keybr.com although the bundle won't contain keybr code until M1b wires Practice in; harmless, and right from M1b on. |
| M1a-R4 (minor) | `IndexedDbPracticeStore` untested; no `versionchange`/`blocked` handling, so the first schema bump could hang Practice. | **Fixed** in `Make Practice imports atomic and test the IndexedDB store`: `onversionchange` closes and reopens on next use, a blocked open rejects with `PracticeDbBlockedError` (a late success is closed), `openPracticeStore` falls back to memory after a timeout. `fake-indexeddb` (Apache-2.0) added as a dev dependency; the store tests became a contract run on both stores, plus versionchange, blocked and timeout tests. |
| M1a-R5 (minor) | Replace deleted the profile before validating, in separate transactions, and import never pruned events. | **Fixed** in the same commit: everything is validated and decoded first; the import is one transaction (`PracticeStore.importResults`), so a failed write changes nothing (tested by a row that can't be cloned, on both stores); Replace with no valid result throws `ImportError` (`reason: 'empty'`); `pruneEvents` runs afterwards (`keepEvents` option for tests). |
| M1a-R6 (minor) | `boardIdentity()` accepted an all-zero serial, unlike `boardKeyFor`. | **Fixed** in `Treat an all-zero board serial as no serial in Practice`: `sval:0…` falls back to the UID; tested. `boardKeyFor` itself isn't reused because it takes React-context types (`IdentityInfo`, `KeyboardInfo`); `BoardSource` documents that callers pass a serial only when `serialSource` isn't None. |
| M1a-R7 (minor) | Start presets lacked daily goals and the Drill preset. | **Fixed** in `Complete the Start presets' daily goals and add Drill my keymap`: Learn and QWERTY set 15 min, Drill sets 45 WPM and 10 min. Lesson type and hints: `TODO(practice)`, M1b/M3. |
| M1a-R8 (minor) | `h` counted the trigger step, which keybr's `makeStats` ignores. | **Fixed** with R1: the trigger step is skipped. The guided acceptance helper now types a leading trigger character so each letter keeps three timed samples. |
