# M1a notes: engine and resolver (no UI)

Branch `feat/practice-engine`. Spec: `docs/practice/spec.md` revision 3, §12 M1a. Built overnight on 2026-10-08 without hardware; nothing here talks to a board.

## Status against the M1a scope

| Scope item (§12) | Status |
|---|---|
| License change (§11) | Done as its own commit, `License Keybard as AGPL-3.0-or-later (OWNER_Q2)`: `package.json`/lockfile `license`, root `LICENSE`, OWNER_Q2 comment. Drop or amend that one commit to change the decision. The About "Source code" link and the Paranoid notice are UI work, deferred (see Follow-ups). |
| Vendored engine with every §9.2 patch listed in `vendor/keybr/README.md` | Done. |
| Ported keybr tests with rebuilt fixtures | Done: 6.7k LOC in `tests/practice/vendor/keybr/`. |
| Resolver: whitespace table, plain, layer holds, user and firmware Shift, LT/MT tap side, costs | Done, with tests. |
| Svalboard `Keyboard` adapter; Guided lessons in English, Center-first and Frequency | Done. |
| `store/` with §8.2 packing, snapshots and the memory twin | Done. |
| Measured size of the trimmed engine, recorded in the spec (§9.8) | Done. |

Acceptance:

- A new profile on `sval-default.svil` starts with the 6 center letters (a d f k l s); the 7th unlock is `j`, the 8th `e` (`tests/practice/lessons/guided.test.ts`).
- Every listed engine, resolver, timing and store test passes (§9.9 resolver and timing lists are covered one for one; store tests cover migrations, packing round trip and boundaries, retention, snapshot invalidation on a fingerprint change, and export/import Merge and Replace).
- No `@keybr/code` or book import remains: `tests/practice/vendor/patches.test.ts` scans every Practice source.

Checks run before each commit: `npx tsc --noEmit -p .` and `npm test` (176 files, 1,285 tests at the last commit). Before the push: `npm run build` and `npm run build:paranoid` (both pass; Practice is not imported by the app yet, so neither bundle changes).

## What was built

`src/features/practice/`:

- `vendor/keybr/`: the engine at keybr `05a37bc`, with `LICENSE` and `README.md` (packages, upstream commit, every patch). `es2022.d.ts` adds the ES2022 library types the engine needs.
- `content/assets/model-en.data`, `words-en.json`; `content/loader.ts` (Vite `?url` model, lazy word list, base64 helper for Paranoid).
- `keymap/resolver.ts`, `whitespace.ts`, `geometry.ts`, `fingerprint.ts`, `svalKeyboard.ts`.
- `input/timeToType.ts`.
- `types.ts`; `store/db.ts`, `memory.ts`, `migrations.ts`, `pack.ts`, `results.ts`, `events.ts`, `profiles.ts`, `export.ts`, `base64.ts`.
- `lessons/guided.ts`; `state/settings.ts`, `state/progress.ts`.

`tests/practice/`: `vendor/` (ported tests, `rich-assert.ts` stand-in, `patches.test.ts`), `keymap/`, `input/`, `store/`, `lessons/`, `state/`, `content/`, `fixtures/`.

No existing file changed except `package.json`/`package-lock.json` (license) and `src/constants/owner-decisions.ts` (OWNER_Q2 comment), plus the spec (§6.3, §9.8 measurements). No UI file was touched.

## Owner decisions read

- OWNER_Q1 → `DEFAULT_SETTINGS.order` and the Learn preset (`state/settings.ts`).
- OWNER_Q2 → applied in its own commit.
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
8. **Event packing.** `path` is rebuilt from the physical key (§8.2), so for a miss the unpacked `path` names the pressed key, not the expected one. The expected key can be recovered from `expected` and the keymap of that result (`x.km`). `raw` and `ttt` are rebuilt relative to the previous **hit** (a step), not the previous event, and `ttt` uses the keymap-only rule. Events store at most 2 prerequisites (a path can have 3: two holds plus Shift).
9. **Result records.** Per (character | path) samples follow keybr's Histogram (hits = positions, misses = positions with a wrong key first, mean time of clean hits, keybr's 40–12,000 ms sample window). In `k`, a miss counts against the expected key (from the miss event's path) and a stray against the pressed key.
10. **Snapshots** need keybr's per-letter state; `MutableKeyStats.restore()` is a small vendored patch that replays saved samples through the same filter (listed in the vendor README). A restored progress continues exactly as a replayed one (tested).
11. **Frequency order** with keybr's English model starts **e n i a r l**, not "roughly e t a o i n" (§6.3 updated).
12. **Practice settings** carry `activeProfileId` and `readKeyPresses` (M2) in `keybard.practice.v1`; the daily goal default is 15 minutes (§2 P1) instead of keybr's 30.

## Stubbed or deferred

- `TODO(practice)` in `content/loader.ts`: the Paranoid `virtual:practice-content` module and its `vite-env.d.ts` declaration are M1b (§7.5). The loader already has `englishModelFromBase64()`.
- Session wiring (TextInput + PracticeTimeToType + events + `buildResultRecord` + store), `usePracticeSession`, `useProgress`: M1b.
- `IndexedDbPracticeStore` has no automated test: Keybard has no IndexedDB fake. Adding the `fake-indexeddb` dev dependency would allow one; it was not added to keep package changes to the license. The store logic shares the memory twin's tests.
- Drill, Words, Custom and Numbers wrappers (they need the same path-key `filter` override as `PracticeGuidedLesson`), the symbols generator, combos, tap dance and key overrides in the resolver: M3.
- `usbSampler`, `correlate`, the mode machine, stray detection and error classification at runtime: M2/M4 (the data shapes and packing for them are in place).

## Needs Mule testing

Nothing in M1a talks to hardware. Items to confirm on the Mule when M2 lands: that `getLabelForKeycode` output matches what the OS types for every resolved path on the default keymap, that `LT1` and `LGUI_T` tap sides emit on release as assumed, and the M0 timing questions (§9.3).

## Follow-ups

- **Before merging to `svalboard/keybard` (AGPL §13):** add the About-panel credit line with a "Source code" link, and the license notice and source URL in the Paranoid file (spec §11). Both touch UI or `build/paranoid.ts`, so they wait for the UI track.
- M1b: Paranoid content module, bundle-size check using the §9.8 measurements, session wiring.
- Consider a `withPathFilter` mixin when M3 adds the other lesson types.
