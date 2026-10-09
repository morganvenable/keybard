# M1b: Practice core UI (Keymap only): implementation notes

Milestone M1b from [spec.md](../spec.md) §12 (§0, §3.3, §4, §5.0–§5.13, §6, §7, §8, §9.1, §9.6–§9.8, Appendix A M-01..M-27). Branch `feat/practice-trainer`, on top of MC, MW, MO and M1a. Built overnight on 2026-10-09 without hardware; nothing here reads the board (Live · USB is M2).

## What was built

| Area | Files |
|---|---|
| One lesson being typed: keybr's `TextInput` with press-normalized timing (§6.5), inferred keystroke events, the six miss classes (§6.6), paused intervals, Caps Lock dropping | `src/features/practice/state/lessonRun.ts`, `input/classify.ts` |
| Session: one profile on one keymap with the current settings; generates lessons, completes them into stored results (events, pruning, snapshot), reports New key / New top speed / Daily goal | `state/session.ts` |
| Controller: loads store (IndexedDB, else memory + Storage off), content and profile; rebuilds the session on a keymap fingerprint, profile or lesson-shaping change (sliders 300 ms); pause rules (blur, Esc, hidden tab, leaving the page, 10 s idle; a lesson paused over 10 minutes is replaced); the status slot by the §5.2 priority; Start presets; profiles | `state/controller.ts` |
| Progress numbers for the period: Summary, chart points (lessons or days), per-character stats, strip order | `state/progressView.ts` |
| Settings: lesson type, hints, legends, board, speed unit, show spaces, layer underlines, announce next key, period, chart axis; presets set type and hints | `state/settings.ts` |
| Engine half of the provider, in the lazy chunk: owns the controller, feeds it the keymap Practice follows (§5.4: `originalKeyboard` when connected, else the draft), the OS layout, page activity and tab visibility | `state/PracticeEngineHost.tsx`, `PracticeProvider.tsx` |
| P0 frame and header; pages and panels as `React.lazy` chunks | `PracticeWorkspace.tsx`, `PracticeHeader.tsx`, `PracticePanel.tsx` |
| P1 Lessons: key strip (P5 from each cap), metrics row, type row + status slot, typing surface, board, floating tools, wells, loading skeleton; P2 Start | `ui/LessonsPage.tsx`, `KeyStrip.tsx`, `MetricsRow.tsx`, `StatCell.tsx` (N-3, N-8, N-11), `TypeRow.tsx` (N-1, N-4), `TypingSurface.tsx` (N-5), `PracticeKeyboard.tsx` + `boardModel.ts` + `boardFit.ts` (N-6), `StartView.tsx`, `Wells.tsx`, `CharCap.tsx` (N-14) |
| P3 Lesson panel (every M1b section), G2 Progress panel (Profile with New profile…, Period, About) | `ui/LessonPanel.tsx`, `ui/progress/ProgressPanel.tsx`, `ui/panelRows.tsx` |
| P4 input status pill and popover (Keymap only) | `ui/InputStatus.tsx` |
| P5 key details (M1b subset) with the Inferred chip (N-13) | `ui/KeyPopover.tsx` |
| G1 Progress: Summary, Speed chart (N-10, SVG), Characters table | `ui/progress/ProgressPage.tsx`, `SpeedChart.tsx`, `CharTable.tsx` |
| Paranoid content: `virtual:practice-content` (base64 model + word list, null elsewhere) and its declaration; the loader's Paranoid branch | `build/paranoid.ts`, `src/vite-env.d.ts`, `content/loader.ts` |
| Bundle budgets: a build plugin records Practice's share of each output; a Vitest check enforces §9.8; `npm run check:bundle`; a step in the test workflow | `build/bundle-stats.ts`, `vite.config.ts`, `tests/build/bundle-size.test.ts`, `package.json`, `.github/workflows/test.yml` |
| keybr's input handler: `setInput(input, { focus: false })` | `vendor/keybr/textinput-events/inputhandler.ts`, `vendor/keybr/README.md` |
| Practice nav item in every build | `src/layout/workspaces.ts` |

### Tests

| File | Covers |
|---|---|
| `tests/practice/state/session.test.ts` | Miss classes (§6.6 worked example); LessonRun timing (firmware Shift not a press, a held layer counted once), misses, backspace, Caps Lock, pause intervals, keybr's stray Space; session first run, completing and saving with events and snapshot, invalid lessons, the remap acceptance (only the moved letter restarts), minutes today, newer schema; Progress view; settings validation; controller Start, pause/focus rules, idle pause, 10-minute replacement, shaping vs display settings and the slider debounce, keymap change notice, status priority, completion announcement and banner clearing, profiles, content error and retry |
| `tests/practice/ui/LessonsPage.test.tsx` | Loading, First run → Start, content error, No letters, Ready/Paused with Resume, Esc and Enter; typing through synthetic `input` events; the missed-character style; Tab/blur pauses and drops keystrokes; regenerate vs keep; Caps Lock notice; the status slot keeps the text card in place; completion banner; board aria-hidden with no focusable keys and click-to-focus; next-key ring; type row (Guided only, scope opens the panel, Enter to the surface); return focus to the surface; 900–1099 px closes the panel on focus; ≥ 1100 px keeps it; bottom-bar scrolls the card into view; P4 rows and Connect board; no disabled buttons without WebHID |
| `tests/practice/ui/panels.test.tsx` | Lesson panel sections and rows, Input row follows the pill, regenerate on a toggle and after the slider debounce with Saving…, display settings keep the lesson, OS layout opens Settings, About popover links, bottom-bar grid, error footer; Progress panel sections, period, New profile…; P5 path chips with the alternative, No samples, stats grid with the Inferred chip |
| `tests/practice/ui/ProgressPage.test.tsx` | Empty, loading, storage off, Summary/Speed/Characters for the period with the header echo, chart strokes and labels, sorting, P5 from a row, Lessons · Days |
| `tests/practice/ui/engineHost.test.tsx` | The M1b keymap source acceptance through PracticeEngineHost: file draft edits, connected board with Live Updating off (Unsent changes until Apply) and on, OS layout change, pause on leaving Lessons and on a hidden tab, Board connected after a connect remounts Practice |
| `tests/practice/ui/boardModel.test.ts` | Rings, step badges and target legends for `j` and `!` (MO(1) ring, LT1 dashed), cluster backdrop, displayed layer, hints off, legends hidden, no-lesson look; the §5.1 board size rule |
| `tests/build/practice-content.test.ts` | The virtual module: null outside Paranoid, both assets inlined in Paranoid |
| `tests/build/bundle-size.test.ts` | §9.8 budgets from the last build (skipped until a build has run) |
| `tests/practice/content/loader.test.ts` (extended) | Content from the inlined module |
| `tests/practice/state/progress.test.ts` (updated on purpose) | The Start presets now carry the lesson type and hints (the M1a TODO) |
| `tests/theme/allowlist.ts` (one entry) | `bg-kb-red/15` on the current character after a miss is an error mark (red-reserved) |

## Acceptance criteria (§12 M1b)

| Criterion | Status |
|---|---|
| Keymap source rules: connected + Live Updating on, remapping one letter restarts only it; off, only after Apply with the Unsent changes notice meanwhile; a loaded file's draft edit restarts only that letter | Done (`engineHost.test.tsx`, `session.test.ts`). **Needs Mule testing** with a real board and Apply. |
| Practice nav opens Lessons with the Lesson panel; ≥ 1100 px and bottom-bar: typing continues with the panel open after a click on the text card; 900–1099 px side layout: focusing the surface closes the panel; Esc in the panel closes it and the lesson resumes on Enter; a lesson-shaping setting regenerates at once | Done (`LessonsPage.test.tsx`, MW's nav tests; Esc is MW's `useWorkspacePanelEscape`, return focus is the textarea). Checked in headless Chrome at 1600 (pushed), 1000 (over the page; a click closes it) and 860 (docked). |
| The lesson type control regenerates the lesson and returns focus to the surface | Until M3 the control offers only Guided (as the scope says), so there is nothing to switch to; the handler (update type → regenerate → focus on pointer) is wired, and Enter on the control moves focus to the surface (tested). |
| The text card does not move when any banner or notice appears | Done: the slot is a fixed `h-12` (two fixed rows below 900 px) always present; the test checks the card node and slot stay the same when a notice appears. |
| Every listed UI test and the theme test pass | Done (see Tests). |
| `build:paranoid` passes | Done; the word list is inlined once (Paranoid branch is dead code elsewhere). |
| Bundle budgets are met | Done, measured: Practice code in the entry chunk 1.6 KB gzip (≤ 3 KB; the whole entry chunk grew 396,152 → 397,202 B gzip, +1.0 KB, against the base `d288126`); practice lazy chunks 66 KB gzip (≤ 130); English content 60 KB gzip (≤ 75); Paranoid file growth 392 KB uncompressed (≤ 550), with the word list inlined once. Recorded in spec §9.8. |
| Works in Firefox with no board (QWERTY example) | Not checked: no Firefox on this machine. Nothing in M1b depends on WebHID (P4 says "needs Chrome or Edge" without it). **Manual check needed.** |

## Deviations from the spec, and why

1. **Floating tools sit in the page flow** at its bottom-left, not floating over it. The Practice page scrolls, and in bottom-bar layout a sticky group sat on the metrics above the docked panel (seen in headless Chrome at 860 and 390 px).
2. **New key banner uses a small (30 px) cap**, not medium: a 45 px cap plus the banner's padding is taller than the fixed `h-12` slot.
3. **Saving… shows only while a slider change waits** for its 300 ms debounce. Settings are written to `appStorage` synchronously, so there is no other saving state; a refused write shows **Settings couldn't be saved**.
4. **Drill my keymap** stores type `drill`, which runs as Guided until M3 (`effectiveLessonType`); the preset also sets every letter included and Re-check slow keys on, the closest Guided equivalent of Drill → Weakest. M3 drops those two fields (TODO in `state/settings.ts`).
5. **Stop on error, Forgive errors (and Space skips words) regenerate the lesson**: keybr's TextInput takes them at construction. The spec lists them in the Typing section without saying which kind they are.
6. **Keymap source select lists only the current source.** Keybard edits one target at a time (loading a file closes USB), so Connected board, Loaded file and QWERTY example never coexist; Host board is M5.
7. **OS layout ›** opens Settings (its General tab holds the layout row) but does not scroll to the row.
8. **P4 Pressed keys on a connected board reads "Not shown · keymap only for now"** until M2 reads the board. Other values follow §5.6. The ink pill toggles Read key presses (stored for M2).
9. **Today minutes come from the profile's results** (local day), not keybr's `MutableDailyGoal`, so changing the daily goal doesn't rebuild the session.
10. **Focus alone never resumes** a paused lesson; a click on the text card or the board, Resume, Enter or Esc does. This follows §4.1 "Focus on close" (closing the panel focuses the still paused surface). The spec says a board click "only focuses"; it also resumes here, like the text card.
11. **A stray Space before a word records no keystroke event**, as keybr's TextInput ignores it.
12. **Characters table and P5 cover the lesson alphabet** (keybr's letters) in M1b; symbols and digits join with M3's Drill. P5 ships its header, stats grid, No samples and Inferred states; sparkline, Pressed instead, Layer reach and Drill this key/group are M3/M4.
13. **Bundle check measures Practice's own share** (Practice modules in the entry chunk; chunks holding Practice code; content), so unrelated growth in Keybard never trips it. The spec asked for "dist stats"; module code is measured before minification, so the entry and Paranoid numbers are conservative (Paranoid scales code by each chunk's minified share).
14. **Only the current page is mounted** (Lessons or Progress); all lesson state lives in the controller, so switching pages loses nothing.
15. **The Board connected notice uses a module-level flag** that survives the EditorLayout remount a connect causes; it shows when a lesson had started before the remount.
16. **Board legends keep the editor's labels** (upper-case `A`); strip caps, P5 and the Characters table show the character itself (`a`).
17. **A same-fingerprint keymap change (a layer color, a layer name) keeps the lesson** and redraws with the new colors; only a path change restarts it.
18. **Board disconnect** switches the keymap to the kept draft; with unsent edits that changes the fingerprint and restarts the lesson with Keymap changed (the spec expects the lesson to continue). Without unsent edits it continues.
19. Spec line numbers are for `61db58a`; the code wins where it moved (vLaunch2.2). Nothing in M1b depended on the removed Hide overlay button.

## OWNER_Q usage

- Q1: `DEFAULT_SETTINGS.order` and the Learn preset (M1a); unchanged.
- Q5: `pruneEvents()` default, now called after every saved lesson (`state/session.ts`).
- Q6: `activeProfile()` scope via `loadProfileData` (`state/session.ts`).
- Q7: the lab page stays a placeholder (M0).
- Q2, Q3, Q4, Q8–Q10: not read by M1b code.

## Stubbed or deferred

- `TODO(practice)` M2: Live · USB (sampler, correlator, observed paths per TextInput position in `lessonRun.ts`, P4 Live rows, OS layout mismatch and Layer locked notices, pressed and wrong-key board states).
- `TODO(practice)` M3: Drill, Words, Custom (type control segments, panel sections, scope button text, Nothing to drill, P6), Drill this key.
- `TODO(practice)` M4: Progress Keyboard heatmap, Fingers, Thumbs, Layers, History; G2 Data rows; P5 sparkline, Pressed instead, Layer reach, aggregate variant.
- M0: the lab view.

## Needs Mule testing

- Connected board, Live Updating off: remap a letter, see **Practicing the board's keymap · unsent edits excluded**, then Apply: only that letter shows uncalibrated.
- Live Updating on: remap a letter mid-lesson: Keymap changed, only that letter restarts.
- Connect board from P4 mid-lesson: Keybard's dirty-draft confirm (if any), the remount, Practice reopens on Lessons with **Board connected · lesson restarted**, same profile.
- Unplug mid-lesson: the lesson continues (see deviation 17 with unsent edits).

## Checks run

- `npx tsc --noEmit -p .` and `npm test` before every commit (final: 203 files, 1,615 tests).
- `npm run build` and `npm run build:paranoid` (via `npm run check:bundle`) before the push: both pass, and the budget check passes.
- `dist-paranoid/keybard-paranoid.html` opened from disk in headless Chrome: the QWERTY example, Practice, Start and a generated lesson work with no network (the content is inlined).
- Headless Chrome against `npm run dev` with the QWERTY example: first run, Start, typing, lesson completion with the New key banner, the pushed panel with a paused lesson and typing resumed with it open, Progress with its panel, dark theme, 1000 px panel over the page (a click on the card closes it), 860 px bottom-bar, 390 px phone; no horizontal scroll at 1000, 860 or 390. Screenshots in `m1b-screens/`.

## Follow-ups

- The first `npm run check:bundle` in CI adds two builds (about five minutes) to the Node 24 test job.
- Firefox check (no Firefox here).
- Nav rail at short viewports (MW follow-up): at 1440 × 700 the expanded rail scrolls, as it already did; Practice is one more item in it. No change made.
- Keystroke cost: the key strip no longer re-renders per keystroke and board keys compare by what they draw; the §9.7 frame budget itself is unmeasured (no baseline machine).
