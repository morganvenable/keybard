# Overnight report: Keybard Practice (2026-10-08 to 10-09)

For Morgan. Branch `feat/practice-trainer` on `morganvenable/keybard`, based on `svalboard/keybard` `c2a70b8` (vLaunch2.2). `upstream/main` hasn't moved since, so the branch is 0 commits behind. Nothing here touched a real board. Each milestone's full notes are in this folder ([MC](MC.md), [MW](MW.md), [MO](MO.md), [M1a](M1a.md), [M1b](M1b.md), [M2](M2.md), [M3](M3.md), [M4](M4.md)).

## Where it stands

- **Pushed and green** at `493bffc` (the commit before this report). On the final tree:
  - `npx tsc --noEmit -p .` passes.
  - `npm test` passes: 230 files, 1,881 tests.
  - `npm run check:bundle` passes. That covers `npm run build`, `npm run build:paranoid` and the §9.8 budgets.
- **Bundle sizes:**
  - Practice code in the entry chunk: 1.4 KB gzip, against a 3 KB budget.
  - Practice lazy chunks: 107 KB gzip, against 130 KB.
  - English content: 60 KB gzip, against 75 KB.
  - Paranoid file growth: 504 KB, against 550 KB. The file is 2.48 MB in all.
- **Test site:** <https://morganvenable.github.io/keybard-test/> was deployed from `feat/practice-trainer` at `493bffc`. [Run 37936662447](https://github.com/morganvenable/keybard-test/actions/runs/37936662447) succeeded at 13:31 UTC on 10-09, and the served bundle includes the Practice code. Deep links:
  - [#practice](https://morganvenable.github.io/keybard-test/#practice)
  - [#practice/progress](https://morganvenable.github.io/keybard-test/#practice/progress)
  - [#overlay](https://morganvenable.github.io/keybard-test/#overlay)
  - The M0 lab: [?practiceLab=1#practice/lab](https://morganvenable.github.io/keybard-test/?practiceLab=1#practice/lab). The test site uses `npm run build`, so OWNER_Q7 allows the lab there. `next` allows it too; production doesn't.
- **Every milestone got an independent review.** Every finding was checked against the code. All were real, all are fixed, and each fix has a test.

## Milestones

| Milestone | Status | Key commits | Main deviations from the spec |
|---|---|---|---|
| **MC** Color roles | **Done.** Two parts need the Mule: Matrix Tester live presses, and the pending/Apply flow on a board. | `659fcea` tokens, `f4b6d99` key caps, `3f16a8d` call sites, `098d609` red-reserved guard, review fixes `1182dfc` `0b8f34f` `9e689a0` | The red guard also scans `.ts` and template spans. Added `kb-use-*-fg` tokens. A selected combo slot gets a border with no ring, as in M-37. "Before" screenshots weren't retaken. |
| **MW** Workspace plumbing | **Done** | `033e447` nav, routes and providers; `d139967` SegmentedControl; `b19f6c6`/`5240e37` hashchange and Back; `49630b5` Ctrl+V only in the editor; `17fb5d6` | A `hashchange` listener; an empty hash returns to the editor. Esc is handled on the panel root. `practicePage` lives in PanelsContext. |
| **MO** Overlay restyle | **Done.** The Windows Host checklist needs the Mule. | `a76d7d8` lost flag, `a471ba2` Color field and Notice, `f6dfbfe` ring, `7b41205` restyle and OverlayProvider, `888f47d` manual, `1ccfb92`/`d476928` review fixes | **No Show/Hide overlay button.** vLaunch2.2 removed it, and the code wins over the spec. Added an `unreachable` flag. Saving… shows only while Host is connected. Highlight held keys and Desktop default layer go through a queue rather than being disabled. More colors… keeps the exact hex. |
| **M1a** Engine, resolver and store (`feat/practice-engine`) | **Done.** OWNER_Q2 needs sign-off. | `c9be8d2` **license (OWNER_Q2)**, `9b9c1d2` vendored keybr, `6dacc3c` resolver, `d7717c9` store, `4977dc2` Guided, review fixes `d912d87`…`7a712f0` | ES2022 types come from a vendor `.d.ts`. Event packing stores the pressed key's shift. `h`/`n`/`t`/`e` come from keybr's TextInput steps. Frequency order starts `e n i a r l`. |
| **Merge** engine into trainer | **Done** | `1c311fb`, follow-up `d288126` (a fix to an Overlay test's Host mock, not to app code) | No conflicts. |
| **M1b** Practice core UI, keymap only | **Done.** Firefox is unchecked, and the board-source flows need the Mule. | `dff89e0` session and controller, `85f85a6` pages and panels, `f24f9c9` UI tests and budgets, review fixes `5d9b535`…`77a64d6` | Floating tools sit in the page flow. A focus alone never resumes a lesson. Caps Lock outranks Storage off (**Q11**, new). A failed write shows "Progress isn't being saved". A long history replay is chunked and keeps the old lesson paused meanwhile. |
| **M2 + M0** Live · USB and the lab | **M2 done in code, M0 partial.** The lab is built; its numbers need the Mule. ε = 40 ms and the 100 Hz target are still UNVERIFIED in the spec. | `09a24ab` sampler, correlator and attribution; `5ee91f5` live mode, P4 and board; `c500336` lab; `8108616` paranoid.md; review fixes `0717bcd` `51bc98c` `3873921` `c4c492b` `8984796` | Candidate order around the input is latest-first only before it. Layer locked on drops keystrokes (**Q12**, new), never fires for auto-mouse, TT, LM, tap dance or tri-layer, and isn't triggered by a pending one-shot. A board that stops answering is retried every 2 s. Two new Pressed keys values. |
| **M3** Drills and content | **Done.** Live combos, tap dances and overrides need the Mule. | `2b0e8da` combos, tap dances and overrides; `af7e723` Drill, Words, Custom and symbols; `8d1ae9b` UI, P6 and Drill this key; review fixes `02c5502` `0638884` | A new Drill starts on Weakest. Whitespace and capitals are never drill characters. Progress tracks every character, which moves the engine version to `practice.2` and replays once. Event layout 2 adds an extension word per combo. Words defaults to 200. |
| **M4** Progress depth and data | **Done.** Strays, the OS mismatch notice and reach need the Mule. | `238c0af` strays and OS notice, `610cfc8` aggregates, `068a7d3` heatmap, Fingers, Thumbs, Layers, History and P5, `bc8b1d9` export/import/reset, review fixes `b1617e7` `f965cb8` `c7c8841` | Printed speed and accuracy round down everywhere, so a key just short of target never shows the target. Errors and Usage use their own denominators. Reset keeps the profile. Heat legends are plain text (`MO 1`). The color-blind palette isn't built (Q9 is no). |
| **M5** Live · Host | **Not started**, as planned (OWNER_Q3 = no). | — | — |

The tree has only two `TODO(practice)` comments left, both for the Q9 color-blind palette: `ui/progress/heat.ts` and `ProgressPanel.tsx`.

## Owner-decision stubs in effect (`src/constants/owner-decisions.ts`)

| Q | Value now | Notes |
|---|---|---|
| Q1 unlock order | `center-first` | A new Learn profile starts with a d f k l s, then j, then e. |
| **Q2 license** | `AGPL-3.0-or-later` | **Decide before any merge to svalboard/keybard.** Commit `c9be8d2` holds `package.json`, the lockfile, `LICENSE` and the Q2 comment. `423fd6f` adds About's Source code link and the Paranoid notice, and reads the constant. **Keep:** nothing to do. **Switch to -only:** change the constant and `package.json` `license`; `tests/build/license.test.ts` keeps them in step. **Drop:** revert `423fd6f` and `c9be8d2`. Practice can't ship without a license compatible with the vendored AGPL keybr code. |
| Q3 Host as Practice input | `false` | M5 isn't built. |
| Q4 Paranoid reads keys | `true` | Only while the lesson text has focus and the window is in front. |
| Q5 event retention | 1000 lessons | |
| Q6 profile scope | `user` | `per-board` is built and tested too. |
| Q7 lab view | on everywhere except `svalboard` mode | |
| Q8 new components | `true` | Informational. |
| Q9 color-blind heat | `false` | Turning it on shows a stub row only. |
| Q10 new color roles | `true` | Reverting means reverting the MC commits. |
| **Q11** (new, M1b) Caps Lock outranks Storage off and Newer schema | `true` | Not in spec rev 3. Needs sign-off. |
| **Q12** (new, M2) Layer locked on drops keystrokes | `true` | Not in spec rev 3. Needs sign-off. |

## Needs Mule testing (the Mule only, never the daily-driver half)

### M0 lab view (about 10 minutes)

1. In Chrome, open <https://morganvenable.github.io/keybard-test/?practiceLab=1#practice/lab> and connect the Mule.
2. Click the lab's text box. Samples/s should start counting. Click outside the box: the count should stop right away.
3. Type the prompt, about 500 characters. Type `!` and the other layer 1 symbols with the LT1 thumb held, and do a few deliberate LT rolls.
4. Check:
   - Samples/s is at least 100.
   - Skew p95 is within ±40 ms. If it isn't, raise `EPSILON_MS`.
   - "Taps caught" is high.
   - LT release → input is about 0 ms.
   - Edges before their keydown means the read is raw, not debounced.
   - "Presses with no character" is about 0.
   - The typed text matches what you typed, so the firmware didn't drop anything under load.
5. Press **Copy results** and paste the table into the PR. Record ε and the sample rate in spec §9.3 and §12 M0.

### Live · USB (about 15 minutes)

1. Go to Practice → Lessons with the Mule connected. The pill reads **Live · USB**. P4 shows Pressed keys **Shown**, and its tooltip gives the sample rate.
2. Hold keys: they show dark. Press a wrong letter: it gets a red border and `×`, which clears about 600 ms after release.
3. Hold MO(1): the board switches to layer 1. Type `!` through LT1: it isn't marked wrong.
4. Finish a lesson. Progress → History shows it with Input USB, and the Inferred chips are absent.
5. Click away mid-lesson: the held-key display freezes at once.
6. Unplug mid-lesson: the pill falls back to Keymap only and typing goes on. Click Connect: Practice reopens on Lessons with **Board connected · lesson restarted**.
7. TG a layer: **Layer 1 is locked on** appears within about 300 ms. Auto-mouse from a trackball nudge must not trigger it.
8. Set Keybard's OS layout to German and type `y` and `z`: **Typed characters don't match German layout** appears. Choose US and it goes away.
9. Paranoid file: key reads happen only while the lesson text has focus.

The other per-milestone Mule lists are in the notes:
- MC: Matrix Tester, pending and Apply.
- MO: the 10-step Host checklist on Windows.
- M1b: Live Updating on and off.
- M3: combos, tap dances and a Shift key override.
- M4: strays, layer reach, Pressed instead, and export/import against real IndexedDB.

## Known issues

- **Firefox hasn't been checked.** There's no Firefox on this machine.
- **Flaky tests.** Under load, a full `npm test` has failed one test about once per several runs: once in M2 (which test is unknown) and once in `BackupContext.test.tsx`, which this work doesn't touch. Each passed on rerun. The overlay-controller flake was a test-mock bug and is fixed.
- **Paranoid budget.** 46 KB of the 550 KB budget is left. Measure before adding anything.
- **CI time.** `check:bundle` adds two builds, about 5 minutes, to the Node 24 test job.
- **Pre-existing build warning.** The main chunk is over 500 kB.
- **Manual screenshots.** Outside the Overlay chapter they still show the old red selection. Refresh them in the release that ships MC.
- **Unchecked visuals.** The live board states (pressed, wrong key) are covered only by jsdom tests.
- **One-time replay.** The first load after M3 replays history once (engine version `practice.2`). Only development profiles are affected.

## Suggested PRs to svalboard/keybard (stacked, all fast-forward from `c2a70b8`)

1. **Color roles (MC):** `c2a70b8..9e689a0`. This includes `18711f4`, the spec, mockups and owner-decision stubs, which the MC notes cite. Standalone, and touches only the editor's look.
   ```bash
   git branch pr/color-roles 9e689a0
   ```
2. **Workspaces and the Overlay restyle (MW + MO):** `9e689a0..d476928`, based on PR 1.
   ```bash
   git branch pr/overlay d476928
   ```
3. **Practice (M1a merge, M1b, M2/M0, M3, M4):** `d476928..feat/practice-trainer`, based on PR 2. Merge it only after the Q2 license decision and the M0 numbers. Q11 and Q12 need sign-off too. If PR 3 is too big to review, the engine-only commits are already on `feat/practice-engine` (`c2a70b8..7a712f0`) and can go up first.

Push each `pr/*` branch to origin and open the PRs from the fork. If PR 2 merges without PR 3, production builds hide the Practice nav item (`PRACTICE_NAV_VISIBLE` is dev-only there), and `#practice` shows a "Not available yet" placeholder. PR 3 turns the item on in every build.
