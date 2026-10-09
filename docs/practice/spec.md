# Keybard Practice and Overlay: typing trainer specification

Status: **draft for owner review, revision 3 (owner decisions applied, then the revision-3 review; see §0.1 and Appendix B). Nothing is implemented.**
Date: 2026-10-08

## How to read this document

This spec covers a keybr-style adaptive typing trainer that lives inside Keybard. Code citations use these prefixes. Paths are relative to each snapshot root.

| Prefix | Snapshot |
|---|---|
| `[kb]` | `svalboard/keybard` main @ `61db58a` (`scratchpad/src/keybard-main`) |
| `[up]` | `aradzie/keybr.com` @ `05a37bc` (2026-09-28) (`scratchpad/src/keybr-upstream`) |
| `[sv]` | `r-tae/keybr.com` ("svalbr") @ `1d8a634` (`scratchpad/src/svalbr`) |
| `[qmk]` | `svalboard/qmk` @ `7d71434`. Most citations come from the research report `research/keybard-integration.md`. The tap-hold citations in §6.7 and §9.3 were re-read in the local reference clone `GitHub/svalboard-qmk` (HEAD `7d71434`, read only). |

- **UNVERIFIED** marks a claim that has not been checked against code or hardware.
- **DECISION** marks a choice this spec makes. Each one can be overruled at review.
- **OWNER** marks a choice only the owner can make. All of them are collected in §13.

---

## 0. Decisions at a glance

| # | Decision |
|---|---|
| D1 | **Practice** and **Overlay** are two separate nav items in the "layout" group, after **Layouts**. **Practice** is the new keybr-lineage typing trainer, with two pages behind the pills **Lessons · Progress**. **Overlay** is today's Trainer page, renamed and restyled (D11). They share nothing in the UI. Practice owns the stats store. The **Trainer** nav item is retired; `#trainer` links open Overlay (§4.2). |
| D2 | keybr's engine is **vendored with patches** (about 11.6k LOC before trimming, plus about 7.1k LOC of tests; §9.2 lists every package and patch). It is not vendorable as-is: `keybr-lesson`, `keybr-textinput` and `keybr-result` need adaptation. keybr's UI is **not** ported; every screen is rebuilt from Keybard components (`Key.tsx`, pills, detail panel, OnOffToggle, tokens), plus the new components listed in §5.0.3. |
| D3 | The unit of learning stays keybr's **character (code point)**. Each character is bound to a **physical path** (key + layer + shift source) taken from the user's keymap. When a remap changes a character's path, only that character's stats restart. |
| D4 | Characters and timing always come from **DOM keyboard and input events**. Physical key and layer come from an **in-tab WebHID matrix and layer sampler** ("Live · USB"). Without live data, they are **inferred from the keymap** ("Keymap only"). Keybard Host as a live source for Practice is an optional later milestone (M5). |
| D5 | Unlock order follows the Svalboard keymap: **center keys first, then N/S, then E/W, then double-south, then thumbs, then layered characters**. Within a tier, letters follow language frequency. This is keybr's `keyboardOrder` with Svalboard weights. |
| D6 | Timing is normalized by **physical presses made for this character**, not by OS-visible modifiers. Firmware-synthesized Shift (for example `KC_EXLM`) is not a press. A layer hold is, but only on the character where it was pressed: a hold kept down through several characters counts once (§6.5). |
| D7 | Storage is IndexedDB `keybard-practice` (namespaced). Settings go in `appStorage`. Everything stays local, with JSON export and import. One local profile by default; stats are keyed by physical path, so several keymaps can share it (§8.1, Q6). |
| D8 | **No firmware change and no Host change** are needed for any milestone except optional M5. Host keeps opening `/#trainer`, which now lands on Overlay. |
| D9 | v1 content is English only: the phonetic model, the word list, and symbol and number generators. Everything is bundled lazily, and inlined for Paranoid. |
| D10 | The board is read only while the practice text has focus and the tab is visible. This applies in every build, not only Paranoid. |
| D11 | **Overlay is restyled in v1** in Keybard's visual language (§5.14–§5.16): tokens instead of `trainer.css` hex, category tiles instead of underline tabs, `ui/select`, `ui/slider`, OnOffToggle, a Color field instead of native color inputs, notice and empty wells instead of the three-paragraph install block, and the left detail panel instead of the 336 px right inspector. Every existing capability and behavior is kept (§5.14 table). The overlay **surface** keeps the user's appearance colors; those are user data, not chrome. |
| D12 | **Practice and Overlay open the left detail panel from their nav item**, like every other Keybard nav item. The panel pushes the page at ≥ 1100 px, as in the editor. Its content follows the page: Lessons → **Lesson** settings; Progress → **Progress** (profile, scope, data); Overlay → **Overlay** (Window · Appearance · Feedback · Recall). The gear trigger is gone. The lesson type (**Guided · Drill · Words · Custom**) is an on-page control above the text (§4.1, §5.13). |
| D13 | **New color roles, app-wide** (§5.0.1, §5.17): **selected** = blue ring plus a light blue face (`kb-select`), replacing the red fill; **pending or unsaved change** = amber dashed border (`kb-pending`), replacing the red border; **red** = errors, destructive actions and wrong keys only. Matrix Tester's held key takes the selected role in its strong form (blue face and a 3 px blue ring), because its other keys are plain white and black. In Practice, a key pressed now takes the darkest face, `kb-pressed` (the ink face in light theme, near-black in dark), not the select role (§5.0.1 justifies this). These roles ship first, as their own milestone (MC). |
| D14 | **Color heatmap** (§5.0.2): heatmap faces show heat only, never the layer color. Speed, Accuracy and Errors color only keys that still need work, **red (far) → orange → yellow (close)**; keys at target are plain with a check. Usage is a single-hue blue ramp. Every key prints its value in the footer strip. The gray ink ramp is dropped. |
| D15 | **Practice and Overlay keep their state in providers that are always mounted but start nothing until their workspace is first opened** (§4.1 Mounting). Keybard never contacts Keybard Host before Overlay is first opened. |

### 0.1 Owner decisions in revision 3

These decisions are binding. They replace the corresponding parts of revision 2 everywhere in this document, not only here.

| # | Owner decision | Resolves | Applied in |
|---|---|---|---|
| OD1 | Split: **Practice** and **Overlay** are separate nav items with separate pages. Practice has the pages Lessons and Progress. No convergence features: Practice confidence never drives overlay legends, Recall stays in Overlay, and Host gets no everyday stats. | rev-2 Q2 (landing pill) and Q8 (where Overlay lives) | D1, §1.3 N1, §1.4, §4, §9.1, §12 |
| OD2 | Restyle Overlay in v1, keeping every capability and behavior. | rev-2 Q8, N1 | D11, §5.14–§5.16, milestone MO |
| OD3 | The left detail panel opens from the nav item. Its content follows the page. The gear is gone. Lesson type moves onto the page. | rev-2 §5.5 frame decision (overlay, separate instance, gear) | D12, §4.1, §5.13, §5.5 |
| OD4 | New app-wide color roles: selected blue, pending amber dashed, red for errors, destructive actions and wrong keys only. | rev-2 Q9 (pressed color) | D13, §5.0.1, §5.17, milestone MC |
| OD5 | Color heatmap: red → orange → yellow on keys that need work; plain plus a check at target; blue ramp for Usage; no layer color on heat faces. | rev-2 Q10 (heatmap palette) | D14, §5.0.2, §5.8, N-9 |
| OD6 | **Brand colors are not changed.** `kb-primary` and the other brand colors keep their current values; the brand-green action pill (`bg-kb-primary text-white`) is used as it is today. New role and heat tokens are additions beside the brand palette, never replacements. Spelling is American throughout (color, practice). | rev-3 review r3-visual-15 (former Q11) | §5.0, §5.12, §12 MC, §13.2 |

Revision-2 questions Q2, Q8, Q9 and Q10 are closed by these decisions and are removed from §13.2. The remaining questions are renumbered Q1–Q8, and Q9–Q10 are new (§13.2). The former Q11 (darker brand-green pill) is closed by OD6.

---

## 1. Summary, goals, non-goals

### 1.1 Summary

**Keybard Practice** is an adaptive typing trainer for the Svalboard, with its own **Practice** item in Keybard's nav. It takes keybr.com's learning engine: a phonetic word generator, per-key confidence, unlock-one-key-at-a-time and focus-the-weakest-key. It then grounds that engine in the user's **actual keymap**. Lessons unlock keys in the order a Svalboard hand learns them. The on-screen board is Keybard's own keyboard, drawn with the same key caps, layer colors and legends as the editor.

When the board is connected over WebHID, Practice also knows **which physical key, finger, direction and layer** produced each character. That lets it report finger and direction stats, layer-reach cost, and "wrong direction" versus "wrong layer" errors. keybr cannot show any of these, because it only ever sees characters.

This revision also covers two changes around Practice that the owner decided on: today's Trainer page becomes **Overlay**, restyled in Keybard's visual language with every capability kept (D11), and Keybard gets app-wide color roles for selected, pending and error states (D13), which ship first.

### 1.2 Goals

- **G1. Learn from scratch:** a new Svalboard owner can go from zero to target speed on letters using lessons generated from their own keymap.
- **G2. Switch from QWERTY:** a QWERTY typist calibrates every letter in one sitting, then works on the keys that are actually slow, which are typically the lateral E/W keys.
- **G3. Drill:** an experienced user can drill a layer, a key group (for example every North key), symbols, numbers, or custom text.
- **G4. Physical truth:** with a connected board, every keystroke is attributed to a matrix position and layer. Stats roll up per key, finger, direction, cluster and layer.
- **G5. Graceful degradation:** Practice is fully usable with no board connected (file, QWERTY example), in Firefox or Safari, on origins Host does not allow, and in Keybard Paranoid. §3.3 defines exactly what each mode can do.
- **G6. Native look:** every screen reads as Keybard. It uses the editor's key caps and Keybard's tokens, pills and panels, works in dark mode, and passes `tests/theme/no-hardcoded-chrome-colors.test.ts`.
- **G7. Local and private:** no network calls and no accounts. The board is never written to, and keys are read only while Practice has focus.
- **G8. Overlay, same capabilities, Keybard's look:** the restyled Overlay page does everything today's Trainer page does (§5.14 table), with no off-system styling and no explanatory prose.
- **G9. One meaning per color:** across the app, blue ring and tint = selected, amber dashed = pending, red = error, destructive or wrong (§5.0.1, §5.17).

### 1.3 Non-goals (v1)

- **N1.** Any convergence between Practice and Overlay (OD1). Practice confidence does not fade or hide overlay legends. Recall does not move into Practice. Keybard Host does not collect "everyday" typing stats. The two features share no UI, no settings, no state and no stored data. Optional M5 keeps to this: it runs its own Host client and never writes Host settings (§12 M5).
- **N2.** Desktop-wide practice, meaning typing in other apps with the Host overlay showing the next key.
- **N3.** Accounts, sync, high scores, multiplayer, public profiles. These are keybr server features ([up] `packages/keybr-result-loader/lib/internal/remotesync.ts`, `packages/server`).
- **N4.** UI translation. Keybard is English-only ([kb] `package.json` has no i18n dependency).
- **N5.** keybr's Books mode (1.1 MB of text) and Code mode (about 12k LOC of PEG grammars, [up] `packages/keybr-code`). Code mode could be considered after M4.
- **N6.** Any firmware change, Host change, or writing to the board.
- **N7.** Fixing svalbr in place, or keeping it in sync. svalbr remains River's project.
- **N8.** Macros as practice targets. Their output is multi-character, so they can't be timed per key.
- **N9.** Detecting a half that is not working (unlinked inter-half cable) or one-handed practice in Guided. Lessons keep generating letters from both halves. Drill → Hands covers deliberate one-handed practice. Whether firmware reports split-link status is UNVERIFIED. Listed as a risk in §13.1.
- **N10.** Changing what the desktop overlay draws. The Overlay restyle (D11) changes page chrome only; `OverlaySurface` and `HostOverlay` render exactly as today.

### 1.4 Relationship to the existing Trainer (now Overlay)

Today's Trainer is a keymap-reference overlay plus self-graded flash-card recall. It records nothing from typing ([kb] `src/features/trainer/TrainerPage.tsx:132`). Revision 3 keeps all of it, under a new name and in Keybard's visual language:

1. **Renamed Overlay.** The nav item **Trainer** ([kb] `src/layout/Sidebar.tsx:87`) becomes **Overlay**, with a new icon (§4.1). `#trainer` stays as an alias of `#overlay`, because Keybard Host opens `https://keybard.svalboard.com/#trainer` ([kb] `companion/overlay-host/keybard_host/__main__.py:463`) and `README.md:224` documents `/#trainer`.
2. **Restyled.** The page and its controls are rebuilt from Keybard idioms (§5.14–§5.16). `trainer.css` is deleted except for the rules that lay out the overlay surface itself (§9.1).
3. **Inspector moves to the detail panel.** The 336 px right column with underline tabs ([kb] `TrainerPage.tsx:123`; `trainer.css:1` `.trainer-workspace` grid) becomes the left detail panel, titled **Overlay**, with category tiles **Window · Appearance · Feedback · Recall** (§5.15). The tab "Overlay" becomes **Window**, so the panel has no tile with its own name; the tab "Practice" becomes **Recall**, so the app never has two things called Practice.
4. **Header bar removed.** `<header className="trainer-header">` ([kb] `TrainerPage.tsx:108`) is replaced by a 22 px page title, as on every Keybard panel.
5. **State lifted into a provider.** The page and the panel are separate React trees (the panel renders inside `SecondarySidebar`), so the state now held in `TrainerPage` (`useHost()`, preferences, source, layers, recall, familiar bindings, selection; [kb] `TrainerPage.tsx:19-62`) moves into an `OverlayProvider` that wraps both. The provider is always mounted and starts its Host client only when Overlay is first opened (§4.1 Mounting, §9.1).
6. **Explanatory prose removed.** The `trainer-note` paragraphs and the three-paragraph `HostInstall` ([kb] `HostInstall.tsx:21-32`) become titles, row values and tooltips (§5.14). The install steps move to the user manual's Trainer chapter (renamed **Overlay**).

The overlay surface ([kb] `OverlaySurface.tsx`, apart from an optional `selected` prop used only by the page preview), the Host-served overlay window ([kb] `HostOverlay.tsx`), the preference schema and storage key `keybard.trainer.v1` ([kb] `core.ts:18-39`) do not change. The Host client ([kb] `src/features/trainer/host.ts`) changes in one place: it reports a lost connection as a `lost` flag instead of an `error` string, so the page can tell "lost" from "never connected" and the flag clears when Host answers again (§5.16 **Connection lost**). Today a poll failure or a stale watchdog sets `state` to null and leaves only an error string ([kb] `host.ts:46,68`), and `receive()` never clears it ([kb] `host.ts:47-54`).

### 1.5 Relationship to svalbr and keybr, and credit

- **keybr.com** by Aliaksandr Radzivanovich (GitHub `aradzie`; [up] `package.json:8`) and contributors, AGPL-3.0, is the source of the engine. This spec vendors its pure packages (§9.2).
- **svalbr** by River (GitHub `r-tae`, https://r-tae.github.io/keybr.com/) is the proof of concept that keybr can teach a Svalboard. It contributed three ideas:
  - a `row*6+col` Svalboard geometry ([sv] `packages/keybr-keyboard/lib/geometry/datahand.ts`);
  - building keybr's character table from the live keymap ([sv] `packages/sval/lib/index.ts:13-45`);
  - mapping typed letters back to matrix keys for highlighting ([sv] `packages/page-practice/lib/practice/Controller.tsx:69-71,115-127`).

  Practice re-implements all three on Keybard's own keymap, geometry and USB stack. No svalbr source is copied, because its `packages/sval/**` is a vendored Vial stack that Keybard supersedes ([kb] `src/services/key.service.ts:106-200`, `src/services/usb.service.ts`).
- **Credit placement:**
  - a one-line credit with links in Keybard's About panel;
  - an **About** row at the bottom of the Lesson and Progress panels (§5.5, §5.9);
  - `README.md` and `LICENSE` in the vendored directory (§11).

---

## 2. Users and core loops

### P1. New Svalboard owner learning from scratch

- **Context:** has either never touch-typed or has never typed on a Svalboard. The motions are new: press center, push N, pull S, flick E/W, pull 2S, and thumb.
- **Loop:**
  1. Open **Practice** from the nav. On first run the Start view (P2, §5.4) appears on the Lessons page.
  2. Choose **Learn from the center keys**, with a 25 WPM target.
  3. Guided lesson 1 uses 6 center-key letters. With the default keymap these come from {a, s, d, f, j, k, l} ([kb] `src/default-layouts/sval-default.svil`, layer 0, col 2 of rows 1–4 and 6–8: F D S A / J K L).
  4. Lessons are about 100+ characters and roll straight into the next lesson.
  5. When every included key has once reached the target, one more letter unlocks. The newly unlocked key pulses on the board.
  6. Daily goal: 15 minutes.
- **Success:** all 26 letters unlocked, and the **Keys at target** stat reads 26/26.

### P2. QWERTY switcher

- **Context:** a fluent QWERTY typist. Svalboard's default keymap puts QWERTY's home row on the center keys and its top and bottom rows on N and S. The new motions are the lateral E/W keys (T, G, B on the left; Y, H, N on the right), the thumbs, and layered symbols.
- **Loop:**
  1. Choose **Coming from QWERTY**. This sets keybr's `alphabetSize = 1`, so every letter is included ([up] `packages/keybr-lesson/lib/guided.ts`; the setting is at [up] `packages/keybr-lesson/lib/settings.ts:16-21`).
  2. Target is 35 WPM.
  3. Lessons focus the weakest key ([up] `guided.ts:94-105`).
  4. Within a few lessons, the uncalibrated keys (fewer than 3 samples) get measured.
- **Then:** Drill → Layer 1 (numbers and symbols) and Drill → East/West.
- **Success:** every letter key at target, then symbols at target.

### P3. Experienced user drilling

Four entry points:

- **Weak keys:** Drill → **Weakest**. Uses the 8 lowest-confidence characters across all layers. With fewer than 8 calibrated characters, the rest are filled with uncalibrated characters in unlock order (§6.2). Recover-keys is on, so focus follows current confidence rather than best ([up] `guided.ts:95-97`).
- **New layer after a remap:** only the characters whose path changed restart (D3). Practice shows them as uncalibrated. Drill → **Layer N** then lessons only that layer's characters, adaptively.
- **Symbols / numbers:** Drill → **Symbols** or **Numbers**. Generators are in §7.3. Numbers is a Drill group only; there is no separate Numbers lesson type (§5.5).
- **Custom text:** paste up to 10,000 characters, such as code or prose ([up] `packages/keybr-lesson/lib/settings.ts:40-47`, `maxLength: 10_000`).

**Success:** per-group stats on Progress improve, with layer-reach time falling (live only).

---

## 3. Better than keybr on a Svalboard

### 3.1 What only Practice can do

| Capability | How |
|---|---|
| **Physical-key stats** | Every hit and miss carries `(matrix index, layer)`. Live mode observes it (§9.3). Keymap-only mode infers it from the keymap (§9.4). |
| **Finger, cluster and direction stats** | Row → cluster and finger; col → C/N/S/E/W/2S on finger rows and T1–T6 on thumb rows (`research/svalboard-geometry.json` `clusterByRow`, `fingerKeyByCol`, `thumbKeyByCol`; [kb] `src/constants/svalboard-layout.ts:17-96`). Progress rolls them up as a fingers × directions grid (§5.8). |
| **Layer-aware lessons** | Drill scope can be a layer. Text underlines characters in their layer's color. The board shows the layer the next character lives on. |
| **Multi-step characters** | Each character's path lists its prerequisites: layer hold (MO, LT hold), OSL, and user Shift. Live mode measures **layer-reach time** (previous character → layer key press) separately from the target press. |
| **Honest timing** | keybr divides time-to-type by 1 + the number of Shift/Alt/AltGraph/Dead keydowns seen since the previous character ([up] `packages/keybr-textinput-events/lib/timetotype.ts:52-84`). On a Svalboard that is wrong twice over: layer holds are invisible to the OS, and firmware-synthesized Shift (`KC_EXLM` is `LSFT(KC_1)`, layer 1 left pinky N in the default keymap) looks like a press. Practice divides by the **path presses made for this character** instead (§6.5). |
| **Error classification** | A miss is classed by the §6.6 rules as **wrong layer**, **wrong direction** (same finger cluster, other key), **wrong finger** (other cluster, same hand), **wrong hand**, **wrong shift**, or **unknown** (the typed character has no path). Live mode observes the pressed key. Keymap-only mode infers it by reverse-resolving the typed character. |
| **Thumb keys** | Space, Shift and layer-hold thumbs get their own stats. Space is always attributable from the keymap, through the resolver's whitespace table (§9.4). Shift and layer holds are attributable live only. |
| **OS layout mismatch detection** | Live only. If the key physically pressed resolves (through Keybard's `internationalLayout`) to a different character than the one the browser typed, in at least 5 of the last 20 eligible hits, Practice shows a one-line notice with a layout select ([kb] `src/contexts/LayoutSettingsContext.tsx:18,44`; `src/components/Keyboards/layouts.ts:449`). Only base-layer hits whose target is not a tap-hold or tap-dance key are eligible, so layer timing and tap-hold buffering can't trigger a false notice (§9.3). |

### 3.2 Input modes and detection

Practice computes one **input mode** continuously and shows it in the header status pill (§5.6).

| Mode | Conditions (all must hold) | Physical data |
|---|---|---|
| **Live · USB** | `navigator.hid` exists; `useKeyboard().isConnected` ([kb] `src/contexts/KeyboardContext.tsx:402-406`); the practice keymap source is **Connected board** (§5.4); the user has not turned off **Read key presses**; the practice text has focus and `document.visibilityState === 'visible'` (D10, matching `userIsLooking()` in [kb] `src/lib/paranoid.ts:6-9`) | Matrix every sample (target ≥ 100 Hz, UNVERIFIED until M0); layer masks every 3rd sample. The sampler calls `keyboardService.pollMatrix` directly, never the context's `pollMatrix` wrapper, which calls `setLastHeartbeat` on every poll ([kb] `KeyboardContext.tsx:402-406`) and would re-render every `useKeyboard()` consumer, including each `Key.tsx` through `useKeyDrag` ([kb] `src/hooks/useKeyDrag.ts:44`), about 100 times a second (§9.3). |
| **Live · Host** (M5, optional) | Not Live · USB; `useHost().state` is non-null with `matrixAvailable` ([kb] `src/features/trainer/host.ts:16-24`); the origin is allowed by Host (only keybard.svalboard.com, next.keybard.svalboard.com, or Host-served; [kb] `companion/overlay-host/keybard_host/server.py:26-31`); the practice keymap source is **Host board** (the keymap in `useHost().state.board`, [kb] `host.ts:19`), or the loaded keymap's fingerprint matches it. Host `pressed` indices describe the board plugged into the Host ([kb] `companion/overlay-host/keybard_host/__main__.py:388`), so attributing them against any other keymap would be wrong. | `pressed[]` and `active`/`default` snapshots at about 80 ms granularity ([kb] `host.ts:46,62-71`) |
| **Keymap only** | Everything else: file or QWERTY example; Firefox or Safari without Host; github.io test site without USB; Paranoid without USB; focus lost from the board tab | None. Inferred from the primary path. |

**DECISION:** when both USB and Host are available, Practice uses USB and ignores Host for input. The two streams are never merged.

**Paused is a lesson state, not an input mode.** While the lesson is paused (§5.3), the status pill shows **Paused** whatever the mode is, and the sampler is stopped. When the lesson resumes, the pill shows the mode again. The Input row in the Lesson panel (§5.5) follows the pill. Opening the panel moves focus into it, so the row normally reads **Paused** while the user is working in the panel; at ≥ 1100 px, once the user clicks back into the text, it shows the mode again with the panel still open (§4.1).

### 3.3 Feature availability by mode

| Feature | Live · USB | Live · Host (M5) | Keymap only |
|---|---|---|---|
| Adaptive lessons, character speed and accuracy | Yes | Yes | Yes |
| Next-key and cluster hint on the board | Yes | Yes | Yes |
| Board follows the live layer | Yes | Yes (about 80 ms lag) | No. Shows the next character's layer. |
| Pressed-key highlight | Yes | Best-effort, and only while the user has **Highlight held keys** on in Overlay (Host reports presses only then; taps under about 80 ms can be missed) | No |
| Physical attribution of hits | Observed | Observed when caught, otherwise inferred | Inferred |
| Wrong-key error class | Observed | Inferred | Inferred |
| Layer-reach time | Yes | No (too coarse) | No |
| User Shift vs firmware Shift | Yes | No | From the keymap only |
| OS layout mismatch detection | Yes | No | No |
| Combo and tap-dance attribution (M3) | Observed | Inferred | Inferred |

**Inferred vs observed:**

- Every stored keystroke carries a `confidence: 'observed' | 'inferred'` flag (§8.2).
- Progress views of physical stats show an **Inferred** label next to the section title when more than half the samples in view are inferred. This label is the title-level signal; there is no explanatory paragraph. The label is a focusable `button` (`aria-describedby` points at its tooltip), so the reason "Over half of these samples come from the keymap, not the board" is reachable by keyboard as well as by mouse.
- Character-level stats never depend on mode.

---

## 4. Information architecture

### 4.1 Placement, nav and the detail panel

**Nav items.** The "layout" group ([kb] `src/layout/Sidebar.tsx:85-88`) becomes:

| Item | `url` | Icon (lucide) | Why this icon |
|---|---|---|---|
| Layouts | `layouts` | `LayoutLayersIcon` (unchanged) | — |
| **Practice** | `practice` | `Gauge` | Speed against a target is what Practice measures and shows first (the WPM cell, the speed chart). `Keyboard` is taken by Standard Keys ([kb] `Sidebar.tsx:50`), and the graduation cap is already Quick Start's icon ([kb] `Sidebar.tsx:91`); today Trainer and Quick Start share it, which this split ends. |
| **Overlay** | `overlay` | `PictureInPicture2` | A small window floating over other content is exactly what the desktop overlay is. `Monitor` and `AppWindow` read as "display settings" or "app". |

Both icons are standard lucide names. Their presence in the installed `lucide-react@^0.544.0` ([kb] `package.json:69`) is UNVERIFIED, because the snapshot has no `node_modules`; MW checks both at build time. The **Trainer** item and its `GraduationCapIcon` are removed from the group; Quick Start keeps that icon.

**Workspaces.** Keybard today has one special case: **Trainer** takes over the whole workspace and closes the detail panel ([kb] `PanelsContext.tsx:49-57`; `Sidebar.tsx:188-197`; `EditorLayout.tsx:1087-1089,1126-1127,1214-1220`). Revision 3 replaces it with a **workspace** model.

Matrix Tester is **not** a workspace and not a nav item. It is an editor mode keyed on `activePanel === "matrixtester"`, entered and left from the LayerSelector toolbar button ([kb] `LayerSelector.tsx:575-601`, which calls `setOpen(false); setActivePanel("matrixtester")`). It replaces only the keyboard canvas inside the editor content, below LayerSelector and inside the editor's `contentStyle` ([kb] `EditorLayout.tsx:1230,1263-1264`). No nav item has the url `matrixtester` ([kb] `Sidebar.tsx:84-95`), so the `matrixtester` arm in `handleItemSelect` ([kb] `Sidebar.tsx:188`) can't be reached from the nav. Revision 3 keeps the mode as it is: entering it keeps `workspace = "editor"` and closes the detail panel, and the auto-open exclusion for `matrixtester` ([kb] `PanelsContext.tsx:50`) stays. The new Sidebar click logic drops the dead `matrixtester` arm.

| Concern | Today ([kb]) | Revision 3 |
|---|---|---|
| Which page fills the workspace | `activePanel === "trainer"` shows `TrainerPage`; anything else shows the editor (`EditorLayout.tsx:1087,1214-1218`) | New `PanelsContext` state `workspace: "editor" \| "practice" \| "overlay"`, independent of `activePanel`. Closing the detail panel never changes the workspace. |
| Detail panel on entry | Closed and kept closed while `activePanel === "trainer"` (`PanelsContext.tsx:54-56`; `Sidebar.tsx:193`) | Opened, like every other nav item. `practice` and `overlay` are ordinary panel ids, so the auto-open effect (`PanelsContext.tsx:50-52`) applies to them; only `matrixtester` stays excluded. |
| Panel content | None; the editor's `SecondarySidebar` is hidden inside the editor wrapper (`EditorLayout.tsx:1218-1220`) | `SecondarySidebar` moves out of that wrapper and renders in every workspace. `PanelContent` gains `practice` → `PracticePanel` and `overlay` → `OverlayPanel` ([kb] `PanelContent.tsx:74-84`). `getPanelTitle` returns **Lesson** or **Progress** for `practice` (from the Practice page) and **Overlay** for `overlay` ([kb] `PanelContent.tsx:38-61`). |
| Push vs overlay | Not applicable | Same rule as the editor: the panel pushes the workspace at ≥ 1100 px (`contentOffset`, `EditorLayout.tsx:1129-1138,1196-1205`) and overlays it below. The Practice and Overlay workspaces use the same `contentStyle` (margin-left transition 320 ms) as the editor content. |
| Bottom-bar layout | Not applicable | Same as the editor: with `layoutMode === "bottombar"` (auto below 900 px, or chosen in EditorControls; [kb] `LayoutSettingsContext.tsx:121-124`, `EditorControls.tsx:81,99`), the panel docks at the bottom and the workspace gets `padding-bottom` = panel height ([kb] `EditorLayout.tsx:1196-1205`), so the page is shortened above the panel, not covered by it. `practice` and `overlay` join the `getDetailPanelHeight` list, so the docked panel is `min(60dvh, 36rem)` tall ([kb] `SecondarySidebar.tsx:27-29`). |
| Nav click on the item | Toggles the full workspace on and off; panel closed (`Sidebar.tsx:188-197`) | See the click table below. |
| Nav indicator | `activePanel` only (`Sidebar.tsx:235-273`) | The main-group indicator follows `activePanel` when it is a main-group item; otherwise it marks the workspace item (`practice` or `overlay`). So Practice stays marked while its panel is closed or while Settings is open over it. |
| Keep mounted | `trainerVisited` keeps `TrainerPage` mounted and hidden, passing `active` (`EditorLayout.tsx:1088,1214-1216`) | Kept per workspace: `practiceVisited`, `overlayVisited`. Each workspace gets `active = workspace === <id>`. `clearSelection()` still runs on leaving the editor (`EditorLayout.tsx:1089`). |
| Mobile trigger | `trainer-mobile-nav` with a `SidebarTrigger` when `isMobile` (`EditorLayout.tsx:1215`) | Removed. `isMobile` is never true, because `MOBILE_BREAKPOINT` is 0 ([kb] `src/hooks/use-mobile.ts:5`). |
| Matrix Tester | Editor mode inside the editor content; the panel closes on entry (`LayerSelector.tsx:575-601`, `EditorLayout.tsx:1263-1264`) | Unchanged. Still an editor mode (`workspace = "editor"`). The unreachable `matrixtester` arm of `handleItemSelect` is removed. |

**Nav click behavior** (`handleItemSelect`, [kb] `Sidebar.tsx:183-211`):

| Click | Result |
|---|---|
| **Practice** or **Overlay**, from another workspace | `workspace` = the item; `activePanel` = the item; panel opens; `panelToGoBack`, `alternativeHeader` and `itemToEdit` are cleared (as the editor branch does, `Sidebar.tsx:203-207`). |
| **Practice** or **Overlay**, already the workspace, its panel open | Panel closes (`handleCloseDetails`). The workspace stays. |
| **Practice** or **Overlay**, already the workspace, panel closed or showing another panel | Its own panel opens (or replaces the other panel's content). |
| An editor item (Standard Keys … Overrides, dynamic menus, Layouts) | `workspace` = `editor`, then today's toggle logic (`Sidebar.tsx:200-208`). If Matrix Tester was on before Practice or Overlay was opened, it is off on return: opening Practice or Overlay set `activePanel` to that workspace, and the editor item sets it to the item. |
| **Quick Start**, **About**, **Settings** (footer) | Workspace-neutral: the panel opens over whatever workspace is showing. Today they switch the Trainer back to the editor; Practice and Overlay keep their page. This lets the Lesson panel's **OS layout ›** row open Settings without leaving Practice (§5.5). |
| **Manual** (external link) | Unchanged |

**Close, focus and Esc.**

- **Close:** the panel's ghost round **X** ([kb] `SecondarySidebar.tsx:158-167`), a second click on the nav item, or **Esc** while focus is inside a Practice or Overlay panel. The Esc handler lives in `PracticePanel` and `OverlayPanel`, not in `SecondarySidebar`, so editor panels keep today's behavior. No editor panel closes on Esc today; the Escape handlers in [kb] `src/layout/SecondarySidebar/` only cancel inline edits (`BindingEditorContainer.tsx:156`, `SidebarItemRow.tsx:120`, `BindingName.tsx:36`, `QMKSettingsPanel.tsx:50`).
  - The panel handler is a React `onKeyDown` on the panel root, so it also receives Esc from descendants, including portaled `ui/select` content, the Color field popover and inline inputs. It **returns early** when `event.defaultPrevented` is set, when the event target is inside an open select, popover or dialog (`[data-state="open"]`, `[role="listbox"]`, `[role="dialog"]`), or when the target is an input in edit mode. Each layer closes itself first: one Esc on an open **Preset** select closes only the select; a second Esc closes the panel.
- **Focus on open:** `SecondarySidebar` moves focus into the panel when it expands and restores the previous focus when it collapses, but its effect depends on `state` alone ([kb] `SecondarySidebar.tsx:80-87`). When the panel is already open (an editor panel, or Settings over Practice) and the user clicks **Practice** or **Overlay**, only `setActivePanel` runs ([kb] `Sidebar.tsx:200-208`), so `state` doesn't change and focus would stay on the nav button. Revision 3 adds a focus key: the effect runs on `[state, focusKey]`, where `focusKey` is `activePanel` when it is `practice` or `overlay`, and `""` otherwise. Editor panels keep today's behavior exactly; switching to Practice or Overlay with the panel open moves focus into the panel and re-captures the return target. Switching between **Lessons** and **Progress** keeps `activePanel === "practice"`, so focus stays where it was (§5.13).
- **Focus on close (Practice only):** `PanelsContext` gains `returnFocusOverride`. While the Lessons page is showing, Practice sets it to the typing surface, so closing the Lesson panel puts focus back on the (still paused) lesson; **Enter** then resumes (§5.11). Without the override, focus would return to the nav button that opened the panel.
- **Typing and the panel (Practice):** opening the panel takes focus, so the lesson pauses through the ordinary blur rule (§5.3); the panel itself is not a pause trigger. Two cases:
  - **Page beside or above the panel** (side layout ≥ 1100 px, where the panel pushes the page; or bottom-bar layout, where the page is shortened above the docked panel by `padding-bottom`): the page is fully visible, so clicking the text card or **Resume** refocuses the surface and typing continues with the panel open. In bottom-bar layout the page scrolls, and focusing the surface scrolls the text card into view (`scrollIntoView({ block: "nearest" })`).
  - **Panel over the page** (side layout 900–1099 px): the panel covers the left of the page, so focusing the typing surface **closes** the panel.
- **Deep links and reconnects** behave like a nav click: page and panel open, focus in the panel.

**Mounting** (D15). The workspace pages mount on first visit and stay mounted and hidden afterwards ([kb] `EditorLayout.tsx:1087-1089,1214-1216` pattern). Practice and Progress are `React.lazy` chunks, so the editor's initial bundle does not grow by the engine.

The providers are different, because they must wrap `SecondarySidebar`, which is always mounted beside the editor content. Inserting a provider element above it on first visit would make React unmount and remount that subtree, resetting `SecondarySidebar` (its `pickerMode` and focus refs) and, depending on where the wrapper goes, the editor content and its keyboard views. So:

1. `OverlayProvider` and `PracticeProvider` are mounted **once**, inside `PanelsProvider`, around all of `EditorLayoutInner`'s output. They always render the same element, so the tree under them never changes shape.
2. Each provider is a cheap shell until its workspace is first visited. It holds an `activated` flag, which becomes true on the first visit (a nav click, a deep link or a reconnect restoring the hash) and stays true.
3. The stateful core is a sibling component, `OverlayEngine` or `PracticeEngine`, rendered by the provider only once `activated` is true. It renders nothing; it runs the hooks and publishes their values into the provider's context through a small store (`useSyncExternalStore`). For Overlay that is `useHost()`, preference persistence, the Recall publish effect and Host config mirroring ([kb] `TrainerPage.tsx:20,46-62,87-92`). For Practice it is the engine session and the sampler.
4. **Requirement: Keybard never contacts Keybard Host before Overlay is first opened.** Today `useHost` starts at once when the page is Host-served or a remote Host was remembered ([kb] `host.ts:39`) and then polls every 80 ms ([kb] `host.ts:62-71`), but it only runs once `TrainerPage` mounts on the first visit ([kb] `EditorLayout.tsx:1214-1216`). The engine split keeps that: before activation no `fetch` to `/api/host/*` happens, and the config adoption and `layoutId` mirroring effects don't run. A test asserts it (§9.9).
5. Until activation, the panel content (`OverlayPanel`, `PracticePanel`) is never rendered, because its panel id can't be active before the first visit.

**Reachability.** Practice and Overlay are only reachable when some keyboard is loaded: `MainScreen` shows `ConnectKeyboard` when `keyboard` is null ([kb] `src/components/MainScreen.tsx:9`). So "no board" inside Practice always means a loaded file or the QWERTY example, not an empty app.

### 4.2 Deep links

Extend the initial-hash check ([kb] `PanelsContext.tsx:35`), which today accepts only `#trainer`:

| Hash | Opens |
|---|---|
| `#practice` | Practice · Lessons, with the Lesson panel |
| `#practice/progress` | Practice · Progress, with the Progress panel |
| `#overlay` | Overlay, with the Overlay panel |
| `#trainer` | Alias of `#overlay`. The hash is rewritten to `#overlay` with `history.replaceState`. Kept for Keybard Host ([kb] `__main__.py:463`), `README.md:224` and existing bookmarks. |
| `#practice/lab` with `?practiceLab=1` | The M0 measurement view (§12). It ships to next.keybard.svalboard.com and the test site, never linked from the UI; without the query parameter the hash opens Practice. **Q7** covers whether it may reach production. |

- Switching workspace or Practice page updates the hash with `history.replaceState`, so the back button does not pile up entries. Returning to the editor clears the hash, so a reload doesn't reopen Practice or Overlay.
- The hash is also how Practice and Overlay survive a reconnect. `PanelsProvider` lives inside `EditorLayout` ([kb] `EditorLayout.tsx:61`) and reads the initial hash in its `useState` initializer ([kb] `PanelsContext.tsx:35`). A connect unmounts `EditorLayout` (§5.3 "Board connected or switched"), and on remount the hash reopens the same workspace and page. The initializer must accept every hash in this table and set `workspace`, `activePanel` and the open panel state together.
- `tests/components/MainScreen.navigation.test.tsx:10` sets `#trainer`; it must keep passing, now landing on Overlay.

### 4.3 Screen inventory

| ID | Name (title on screen) | Kind | Purpose |
|---|---|---|---|
| P0 | **Practice** frame | Workspace frame | Title, pills **Lessons · Progress**, status pill (Lessons only) |
| P1 | **Lessons** | Practice page | Lesson type control; type lessons; see the next key and live presses |
| P2 | **Start practicing** (inside Lessons, once per profile) | View | Pick a goal preset and target. Starts the first lesson. |
| P3 | **Lesson** | Detail panel content (Lessons page) | Rows for the current lesson type, targets, typing, board, input, keymap, about |
| P4 | **Input** | Popover from the status pill | Show the input mode; connect the board; turn key reading off |
| P5 | **Key** detail | Popover from a key-strip cap (Lessons) or a heatmap key, grid cell or table row (Progress). Board keys on Lessons don't open it. | A character's path, stats, confusions; **Drill this key** |
| P6 | **Custom text** | Dialog | Enter and validate custom lesson text |
| G1 | **Progress** | Practice page | Summary, speed chart, heatmap, fingers × directions, layers and thumbs, characters, history |
| G2 | **Progress** | Detail panel content (Progress page) | Profile, scope, data (export, import, reset), about; confirm dialogs |
| O1 | **Overlay** | Overlay workspace page | Host connection, preview of the overlay, layout source and layers |
| O2 | **Overlay** | Detail panel content | Category tiles **Window · Appearance · Feedback · Recall** |
| O3 | Color field | Popover from a color row in O2 | Pick an overlay color (user data) |
| E1 | Editor color roles | Changes to existing editor screens | Selected, hover, pending, drop target, Matrix Tester pressed (§5.17) |

### 4.4 Navigation

```
Nav "Practice" ──► P0 Practice frame + detail panel
                    ├─ (Lessons)  ─► P1 ──first run──► P2 Start ──Start──► P1 typing
                    │                 ├─ panel ─────► P3 Lesson ──Edit text──► P6
                    │                 ├─ type control (Guided · Drill · Words · Custom) on the page
                    │                 ├─ status pill ► P4 Input popover
                    │                 └─ strip cap ──► P5 Key popover ──Drill this key──► P1 (Drill)
                    └─ (Progress) ─► G1 ; panel ─► G2 Progress ; keycap/cell ─► P5
Nav "Overlay"  ──► O1 Overlay + detail panel O2 (Window · Appearance · Feedback · Recall) ; color row ─► O3
Nav editor items ─► editor workspace (E1 color roles apply there)
```

Leaving the Lessons page for Progress or another workspace, blurring the typing surface, or hiding the tab pauses the lesson. A paused lesson is kept for 10 minutes. After that it is discarded and a new one is generated.

---

## 5. Screen-by-screen UX

### 5.0 Visual language mapping

The rule is: **build every Practice, Progress and Overlay surface from existing Keybard idioms. Introduce no new idiom unless §5.0.3 names it.** §5.0.3 lists every new component with its classes and an owner approve/decline marker. Class strings are copied from `research/visual-language.md` §3, which cites [kb] sources.

**Color roles.** Each hue has one meaning on every Keybard screen, the editor included (D13, §5.0.1):

- **Layer color** (`cosmetic.layer_colors`) means "this key or character is on layer N". It is used for key faces in the lesson alphabet and on the board, the dots on layer pills, and the layer underline. It is user data. It never appears on heatmap faces (§5.0.2).
- **Ink** (`kb-ink`, `kb-active`) means "you, now": the next-key ring, the caret, focus rings, active pills and tiles. The pressed-now face on the Practice board is its own token, `kb-pressed`: the ink face in light theme, near-black in dark (§5.0.1).
- **Select** (`kb-select`, new) means "this is the one you picked": a selected key in the editor, a key whose P5 popover is open, the preview key chosen for Familiar bindings in Overlay, a selected list row, a drop target, and a held key in Matrix Tester (strong form).
- **Pending** (`kb-pending`, new) means "changed, not yet sent or saved": unsent key edits in the editor, the Apply button while edits wait, and the Overlay panel footer while Host settings are being written. As text (the Layout row's `· unsaved changes`) it uses the notice text color, `text-amber-800 dark:text-amber-300` (§5.0.1).
- **Red** (`kb-red`, `text-red-700 dark:text-red-400`) means **error, destructive or wrong**: the wrong-key border and badge, the error underline and tint in the text, error lines, and destructive buttons. A correct press, a selection and a pending edit are never red.
- **Brand green** as a control color is reserved for the single forward action on a screen (**Start**, **Connect board**, **Download for Windows**). On a key face it is just layer 0's color. It keeps its current brand color (OD6).
- **Heat** colors (§5.0.2) appear only on Progress heat faces and their scale lines.

kb-blue (`#379cd7`) is also a layer color (layer 2 in `sval-default.svil`). Selection is therefore carried by **shape and lightness**, not hue alone: a 2 px ring with an offset around a light tint face, against saturated layer faces.

| Element | keybr equivalent (role) | Keybard idiom used | Tokens / classes |
|---|---|---|---|
| Page titles "Practice", "Overlay" | page header | Panel title (no header bar, no rule) | `text-[22px] font-semibold leading-none text-kb-ink` ([kb] `SecondarySidebar.tsx:154`) |
| Lessons · Progress | top nav | **Layer pills** | active `bg-gray-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-md scale-105`; inactive `text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700` ([kb] `LayerSelector.tsx:295-300`). Pills are used only for page navigation and for layers. Choices and filters use the SegmentedControl (N-1). |
| Lesson type (Guided · Drill · Words · Custom) | lesson type select | **SegmentedControl**, medium size, on the page above the text (§5.2) | N-1. On the bare page its track (`bg-gray-100 dark:bg-neutral-800` with a border, [kb] `OnOffToggle.tsx:18`) has a visible edge, unlike category tiles. |
| Overlay panel sections, Start goals, Drill group | category select | **Category tiles** | active `bg-kb-active text-kb-active-fg`; inactive `bg-muted/60 text-muted-foreground hover:bg-muted` ([kb] `SettingsPanel.tsx:185-198`). Only inside the detail panel or on a `bg-kb-surface` card. |
| Binary settings | toggles | **OnOffToggle** in setting rows (not Switch) | [kb] `src/components/ui/OnOffToggle.tsx:11-55`; rows per [kb] `SettingsPanel.tsx:224-237`. OnOffToggle prints the literal labels ON and OFF, so every choice with other labels (WPM·CPM, Show·Hide, Both·Left·Right, Off·Flash·Fade) uses the SegmentedControl. |
| Numeric settings | sliders | `ui/slider` | track `bg-muted`, range `bg-primary` ([kb] `src/components/ui/slider.tsx`) |
| Lists of options | selects | `ui/select` | [kb] `src/components/ui/select.tsx` |
| Settings container | settings sidebar | **Detail panel** (`SecondarySidebar`, shared with the editor): left-anchored beside the nav rail, `fixed top-2 bottom-2 rounded-2xl z-[60]`, width `min(32rem, …)`, 22 px title, ghost round close | [kb] `SecondarySidebar.tsx:26,129-146`. Opened from the nav item (§4.1). |
| Start, Resume, Use text | primary buttons | **Pills**. Brand green for the single forward action. Ink pill for commit actions. | `bg-kb-primary text-white px-5 py-1.5 rounded-full` ([kb] `ConnectKeyboard.tsx:176`); ink `bg-kb-active …` ([kb] `LayerSelector.tsx:399`) |
| Restart / hints / show board | floating controls | **Floating tool buttons** bottom-left, as Matrix Tester | `w-12 h-12 rounded-2xl bg-kb-surface shadow-lg …` ([kb] `MatrixTester.tsx:14`) |
| Status ("Live · USB", "Host connected") | — | Inline status pill (as "Live Updating") | `text-sm font-medium pl-2 pr-5 py-1.5 rounded-full text-kb-ink` ([kb] `LayerSelector.tsx:461`) |
| On-screen board | `keybr-keyboard-ui` SVG | **`Key.tsx` key caps**, the editor's renderer, medium/small variants | Layer color faces from `cosmetic.layer_colors` ([kb] `Keyboard.tsx:340-343`, `utils/colors.ts:24-39`) |
| Letter set strip | `LessonKey` chips | **Mini key caps** (`Key.tsx` small, 30 px) | included = layer color face; locked = dashed outline (next row) |
| Locked letter (strip **and** board) | `--LessonKey--excluded` | Empty-well dashed border on a transparent cap | `bg-transparent border border-dashed border-kb-gray-border text-muted-foreground`. One look in both places and both themes. Distinct from the pending role: gray, 1 px, transparent face; pending is amber, 2 px, on the key's own face. |
| Next key | `--KeyboardKey-pointer` | **Target ring in ink**, layer color kept on the face | `ring-[3px] ring-kb-ink ring-offset-2 ring-offset-kb-gray` |
| Pressed key (Practice board) | depressed key | **Pressed face** (`kb-pressed`) | `bg-kb-pressed text-kb-pressed-fg` while the key is down (§5.0.1 explains why not select, and why not the light ink face in dark theme) |
| Wrong key pressed | — | **Wrong-key border and badge** (red role) for 600 ms | `border-2 border-kb-red` plus a 14 px `×` badge in the top-right corner, `bg-kb-red text-white` with a 10 px lucide `X`. The badge is the non-hue cue: the red border alone measures 1.39:1 on a green face. The only red on the board. |
| Key with an open P5 popover | — | **Select role** | `z-10 ring-2 ring-kb-select ring-offset-1 ring-offset-background` (§5.0.1) |
| Text: pending / typed / error | `--textinput--hit/--miss` | Tokens | pending `text-muted-foreground`; typed `text-kb-ink`; error `text-kb-red underline decoration-wavy decoration-2 decoration-kb-red` (§5.2) |
| Caret | cursor | 2 px bar `bg-kb-ink` | `motion-safe:transition-transform duration-75` |
| Speed / accuracy lines | `--Chart-speed`, `--Chart-accuracy` | Brand literals (data, same in both themes), told apart by stroke as well as hue | speed `kb-blue #379cd7` solid; accuracy `kb-purple #8672b5` dashed `6 4`; target `kb-ink/40` dotted `2 3`; each line labelled at its right end in `text-kb-ink`, led by a 16 px sample of its own stroke (labels in the line color measure 3.04:1 and 4.13:1 on white, under 4.5:1 for `text-xs`) |
| Heatmap | `HeatmapLayer` | Key caps with **heat faces**, check on keys at target, value in the **footer strip** (`bottomStr`) | §5.0.2 |
| Notices and banners | toasts | **Notice card** or **floating card**, one line, inside the reserved **status slot** (N-4) on Lessons, or at the top of the Overlay page | notice `rounded-md border border-amber-300 dark:border-amber-800 bg-kb-surface p-3 text-sm text-amber-800 dark:text-amber-300` ([kb] `EditingTargetStatus.tsx:24`); error notice `… border-red-200 dark:border-red-900 … text-red-700 dark:text-red-400` ([kb] `EditingTargetStatus.tsx:33`); banner = floating card ([kb] `EditorLayout.tsx:1494`) |
| Empty states | — | **Empty/connect well** | `p-10 max-w-xl mx-auto rounded-md border-dashed border-1 border-gray-300 dark:border-neutral-600` ([kb] `ConnectKeyboard.tsx:154`) |
| Popovers (Input, Key, Color field) | popups | **Popover**: LayerNameBadge's classes on a **portaled** Radix Popover, as `PendingChangesPopover` already does ([kb] `src/components/PendingChangesPopover.tsx:1,11-34`, `Popover` from the installed `radix-ui` package). LayerNameBadge's own popover is an absolutely positioned `div` ([kb] `LayerNameBadge.tsx:326`); copied inside the detail panel's `overflow-auto` scroll owner ([kb] `SecondarySidebar.tsx:171`) it would be clipped at the panel edge. | `bg-kb-popover rounded-3xl p-2 shadow-xl border border-gray-200 dark:border-neutral-700` ([kb] `LayerNameBadge.tsx:326`) |
| Dialogs | — | `ui/dialog` | [kb] `ui/dialog.tsx:39-127` |
| Explanations | help text | **Row values first; tooltips only for extra detail** | A reason that decides what the user can do is printed as a row value, never only in a tooltip, because disabled buttons can't be hovered or focused ([kb] `ui/button.tsx:8`, `disabled:pointer-events-none`). Tooltips ([kb] `ui/tooltip.tsx:8-104`) carry only extra detail, and only on focusable triggers. |
| Icons | `@mdi/js` | lucide at 16 px in controls, 20 px in toolbars and the nav | Practice `Gauge`, Overlay `PictureInPicture2` (§4.1) |
| Typeface | keybr fonts | Inter everywhere. `index.css:187` forces Inter on `*`. The typing text is Inter 28/40 with `font-variant-numeric: tabular-nums`. | — |

Practice and Overlay ship **no `.css` file with colors**. All chrome styling is Tailwind tokens in `.tsx`, so the theme guard covers it. That includes the shared new components: they live in `src/components/shared/`, not `src/components/ui/`, because the guard skips the whole `src/components/ui` directory ([kb] `tests/theme/allowlist.ts`, entry "shadcn ui stock"; `no-hardcoded-chrome-colors.test.ts` `scanRepo()`, `if (isAllowedFile(rel)) continue;`) (§9.1). Overlay keeps one small stylesheet for the surface's legend layout and fade keyframe, which contains no colors (§9.1).

#### 5.0.1 Color roles: new tokens (D13)

Add to [kb] `src/index.css` beside the themed `kb-*` tokens (`:root` at `:68`, `.dark` at `:114`, mapped in `@theme` near `:43`). They are **themed**, unlike the literal brand colors (`:51-63`), because they are chrome, not user data.

| Token (`--color-…` → utility) | Light | Dark | Used for | Contrast (approx., from hex) |
|---|---|---|---|---|
| `kb-select` (ring, border, row ring) | `#2b86bd` (kb-blue darkened) | `#5cb8ec` (kb-blue lightened) | Selected ring, hover ring, drop-target ring, selected row ring | vs page `kb-gray`: 3.6:1 light, 8.3:1 dark; vs `kb-surface`: 4.0:1 light, 7.6:1 dark (≥ 3:1 for non-text UI). kb-blue itself is only 2.7:1 on the light page, so it can't be the ring. |
| `kb-select-tint` (selected key face) | `#dfeff9` (kb-blue 16% on white) | `#244154` (kb-blue 28% on `#1d1e21`) | Face of a selected key; Matrix Tester pressed face | legend `text-kb-ink`: 17.9:1 light, 9.6:1 dark |
| `kb-select-strip` (header and footer strips on a selected key) | `#bfdff2` | `#295773` | Replaces the `bg-black/30` strip on a selected key, which would put white text on a light face (≈ 2.4:1) | strip text `text-kb-ink`: 15.1:1 light, 6.9:1 dark |
| `kb-pending` (dashed border, dashed outline, dot) | `#b45309` (amber-700) | `#fbbf24` (amber-400) | Pending key border, Apply button outline, Host settings footer dot. **Borders, outlines and dots only**; not for text unless the text sits on `kb-surface`. Pending **text** on the page uses the notice text color `text-amber-800 dark:text-amber-300` (6.3:1 light on `kb-gray`, 12.7:1 dark). | vs page `kb-gray`: **4.48:1** light, 10.9:1 dark; vs `kb-surface`: 5.0:1 light. Against a green face (`#099e7c`) it is only 1.5:1 light / 2.0:1 dark, so pending is also carried by the **dashed** pattern and the 2 px weight. |
| `kb-pressed`, `kb-pressed-fg` (Practice pressed-now face and legend) | `#000000` / `#ffffff` (= `kb-active`, `kb-active-fg`) | `#111214` / `#e8e9ea` (= dark `kb-active-fg`, `kb-active`) | Practice board, key held now | Legend 21:1 light, 15.4:1 dark. Face vs the layer faces: light 6.2:1 green, 9.5:1 orange, 6.9:1 blue; dark 5.5:1 green, 8.5:1 orange, 6.2:1 blue. Face vs the light-gray non-lesson keys: 14.7:1 light, 13.2:1 dark. Against the dark page (1.0:1) the key's own `kb-key-border` (`#5a5e65`, 2.9:1) outlines it. |
| `kb-select-strong` (Matrix Tester held face) | `#2b86bd` | `#2b86bd` (not themed: Matrix Tester's white and black faces are the same in both themes) | Matrix Tester held key, under a 3 px `kb-select` ring | vs the white "never pressed" face 4.0:1, vs the black "was pressed" face 5.3:1, in both themes |
| `kb-red` (existing literal `#d8304a`, `index.css:59`) | `#d8304a` | `#d8304a` | Wrong-key border and badge; error underline | vs page 4.2:1 light, 3.9:1 dark (≥ 3:1 for UI). Against layer faces it is weak: 1.39:1 on green, 2.14:1 on orange, 1.55:1 on blue, so the wrong-key state also carries the `×` badge (white on `kb-red`, 4.7:1). Error **text** keeps `text-red-700 dark:text-red-400`, as today. |

**Key states with the new roles** (`Key.tsx`, every caller):

| State | Today ([kb] `Key.tsx`) | Revision 3 |
|---|---|---|
| Selected | `bg-red-500 text-white … ring-2 ring-red-500 ring-offset-1` (`:139-140`) | `z-10 bg-kb-select-tint text-kb-ink border-kb-key-border ring-2 ring-kb-select ring-offset-1 ring-offset-background`; header and footer strips `bg-kb-select-strip text-kb-ink` |
| Drag hover (drop target) | same red as selected (`:139`) | same as Selected |
| Hover (no `hoverBorderColor` given) | `hover:border-red-500 hover:ring-2 hover:ring-inset hover:ring-red-500` (`:146`) | `hover:z-10 hover:ring-2 hover:ring-kb-select hover:ring-offset-1 hover:ring-offset-background` (outside the key, like the selection it previews; still no layout shift, because rings are box-shadows) |
| Pending change | `border-2 border-red-500`, only when not selected (`:151`) | `border-2 border-dashed border-kb-pending`, **also when selected**: the ring sits outside (offset 1 px), the dashed border on the key's edge, so a selected key no longer hides that it has unsent edits |
| Held (Matrix Tester) | `selected` → red (`MatrixTester.tsx:177`) | Strong select: `bg-kb-select-strong ring-[3px] ring-kb-select ring-offset-2 ring-offset-background z-10`. Matrix Tester renders no legends ([kb] `MatrixTester.tsx:163-176`), so the face carries no text. The "was pressed" black face and the "never pressed" white face stay ([kb] `MatrixTester.tsx:178`); in dark theme the black face gains `border-kb-gray-border` (4.2:1 against the page; black on the dark page is 1.15:1 and vanishes). |

**Rings, offsets and key gaps.** Editor keys are drawn edge to edge; the 1 px `kb-key-border` is the only gap ([kb] `Key.tsx:80-86,144`; in light theme it equals the page color). A ring with a 1 px offset is 3 px wide outside the key, so it covers the neighbor's edge. Selected and hovered keys therefore take `z-10`, so the ring paints over the neighbors instead of under them. On blue layer faces the ring hue is close to the neighbor's face (`kb-select` on `kb-blue`: 1.31:1 light, 1.38:1 dark); there the **offset gap in the page color**, not the hue, separates ring from neighbor (`kb-select` vs the offset: 3.6:1 light, 8.3:1 dark). The inset hover ring of the first draft sat on the layer face and failed 3:1 on every default layer color (on green 1.18:1 light, 1.54:1 dark), so it was moved outside.

**Matrix Tester held keys (strong select).** The light select tint is nearly the white "never pressed" face (1.18:1), and the dark tint is close to the black "was pressed" face (1.96:1), so the plain selected look would weaken today's red. The strong form keeps the select hue and ring but uses a mid-blue face that clears 3:1 against both other states in both themes:

| Pair | Light | Dark |
|---|---|---|
| held (`#2b86bd`) vs never pressed (white) | 4.0:1, plus the 3 px ring | 4.0:1, plus the 3 px ring |
| held vs was pressed (black) | 5.3:1 | 5.3:1 |
| was pressed vs never pressed | 21:1 | 21:1 |
| ring (`kb-select`) vs page, across the offset | 3.6:1 | 8.3:1 |
| was pressed vs page | 21:1 (black on `#f1f2f2`) | outline `kb-gray-border` 4.2:1 |

**Why Practice's pressed-now face is `kb-pressed`, not the select role (DECISION).** Matrix Tester shows a closed switch as a diagnostic state on a board of plain white and black keys, so the select role fits it. The Practice board is different: (1) its keys are not selectable (§5.2), so a select face would suggest an action that doesn't exist; (2) a press lasts about 100 ms over a saturated layer face, and the select tint is deliberately light, so it would flash weakly; (3) a correct press is the user acting on the ink next-key ring, so the face stays in the dark "you, now" family. In light theme `kb-pressed` is the ink face itself. In dark theme the ink face is light (`#e8e9ea`) and would be lost: it measures 1.17:1 against the light-gray non-lesson keys and 1.82:1 to 2.79:1 against the layer faces. So in dark `kb-pressed` is near-black, the darkest face available, which clears 5.5:1 against every layer face and 13.2:1 against the light-gray keys (token table above). The select role is still used in Practice for the key whose P5 popover is open.

#### 5.0.2 Heat colors (D14)

Heat faces replace the layer color entirely in heatmap views (Progress Keyboard, Fingers, Thumbs). There is no collision concern with layer colors, because no layer color is drawn on a heat face.

**Speed, Accuracy, Errors: color only what needs work.**

| Token (`--color-…`) | Value (both themes, data like brand colors) | Text on face | Meaning | Text contrast | Relative luminance |
|---|---|---|---|---|---|
| `kb-heat-far` | `#d8304a` (= kb-red) | `text-white` | far from target | 4.7:1 | 0.17 |
| `kb-heat-mid` | `#f07f00` (deep orange; darker than kb-orange `#f89804`, see Color vision) | `text-kb-heat-ink` (`#111214`) | getting there | 6.9:1 | 0.34 |
| `kb-heat-near` | `#ffc222` (= kb-yellow) | `text-kb-heat-ink` (`#111214`) | close to target | 11.6:1 | 0.60 |
| (at target) | no token: `bg-kb-surface border-kb-gray-border` | `text-kb-ink`, plus a 10 px lucide `Check` before the value in the footer strip | at or past target | 21:1 light, 14.9:1 dark | — |
| (no data) | no token: the locked look, `bg-transparent border-dashed border-kb-gray-border` | `text-muted-foreground`, value `—` | no samples | — | — |

`kb-heat-ink` is a literal `#111214` (the dark theme's `kb-active-fg`), because the faces it sits on are literals; `text-black` would trip the theme guard's `hardcoded-chrome` rule.

**Usage: single-hue blue ramp** (usage is neither good nor bad, so it never uses red, and every key with samples is colored):

| Token | Light | Text | Dark | Text |
|---|---|---|---|---|
| `kb-use-1` (lowest quartile) | `#d2e8f7` | ink 16.6:1 | `#223745` | `#f1f2f2` 11.0:1 |
| `kb-use-2` | `#8ec6ea` | ink 11.4:1 | `#27506a` | `#f1f2f2` 7.7:1 |
| `kb-use-3` | `#379cd7` | ink 6.9:1 | `#2e7097` | `#f1f2f2` 4.8:1 |
| `kb-use-4` (highest quartile) | `#1f6fa0` | `text-white` 5.5:1 | `#379cd7` | `#111214` 6.2:1 |

The usage tokens are themed: the ramp runs from the page towards strong blue, so more use always means further from the page. Adjacent light steps differ by 1.46:1, 1.65:1 and 1.80:1 (the first draft's `#e1f0f9 · #b9dcf1 · #87c4e7` stepped by only 1.24:1 and 1.32:1, and its first step was 1.04:1 against the page). Dark steps: 1.44:1, 1.59:1, 1.78:1.

**Edges of heat faces.** In light theme the key border token `kb-key-border` equals the page (`#f1f2f2`), so a pale heat face (use-1, near, at target) would have no visible edge. Heat faces and the scale-line swatches therefore take `border-kb-gray-border` in light theme instead (2.1:1 against the page). Dark theme keeps `kb-key-border` (`#5a5e65`), which already outlines them.

**Strips on heat faces.** Heat faces have **no header strip**: the legend stays in the center, as on every Key.tsx cap, and the check moves to the footer. The footer strip drops Key.tsx's `bg-black/30` tint, uses the face's text color with a hairline (`currentColor` at 25%) above it, and carries the value (`38`, `97%`, `6%`, `4%`), led by the check on keys at target (`✓ 36`). The heatmap board is never scaled below 1.0 (§5.8), so the value never renders below 10 px.

**Color vision.** Red, orange and yellow are hard to tell apart by hue for protan and deutan viewers. The mitigations:

1. The three needs-work steps rise in **luminance** (0.17 → 0.34 → 0.60), so they stay ordered dark → light under any color-vision deficiency and in grayscale, with roughly even steps: far → mid 1.74:1, mid → near 1.68:1. The first draft used kb-orange (`#f89804`, luminance 0.42) for mid, which left mid → near at only 1.37:1, so orange and yellow merged under simulated deuteranopia and protanopia (M-24).
2. **Every key prints its value**, and keys at target carry a check, so color is never the only signal.
3. Each heatmap has a one-line **scale** beside its title with the thresholds (§5.8).
4. An optional color-blind palette (viridis-style: `#440154` white text 15.2:1 · `#21918c` black text 5.5:1 · `#fde725` black text 16.6:1) is specified but **not built in v1** (DECISION, recommendation in **Q9**). It would be a SegmentedControl **Heat colors: Standard · Color-blind** in the Progress panel and a second token set; nothing else changes.

#### 5.0.3 New components (OWNER: approve or decline each)

Keybard has no equivalent for these. Each is built only from existing or §5.0.1–§5.0.2 tokens. **Q8** asks the owner to approve the list or strike rows. Components used by both Practice and Overlay live in `src/components/shared/` (§9.1), where the theme guard scans them.

| # | Component | Used in | Look and classes | States | Why no existing idiom fits | Owner |
|---|---|---|---|---|---|---|
| N-1 | **SegmentedControl** (n-way, single select; sizes sm and md) | Lesson type (md, on the page), WPM·CPM, Show·Hide, Hands, Progress metric, scope, Lessons·Days, Overlay Hands, Layer-change highlight, Preview background | OnOffToggle's track and segment classes ([kb] `OnOffToggle.tsx:18-48`) with any labels; md segments `px-4 py-1.5 text-xs`; `role="radiogroup"`, each segment `role="radio" aria-checked`, arrow keys move | default, selected, focus-visible, disabled | OnOffToggle is boolean, with fixed ON/OFF text | ☐ |
| N-2 | **ToggleChipGroup** (multi-select) | Drill Directions | Path-chip shape `px-2.5 py-1 rounded-full text-xs font-medium`; off `bg-kb-gray-medium text-kb-ink`, on `bg-kb-active text-kb-active-fg`; each chip a `button` with `aria-pressed`. The 2S chip appears only when some finger uses a 6-key cluster (`finger_6`). | off, on, focus-visible | No multi-select control exists | ☐ |
| N-3 | **StatCell** | Metrics row, Progress Summary, P5 stats grid | label `text-xs text-muted-foreground`; value `text-[28px] font-semibold leading-none tabular-nums whitespace-nowrap text-kb-ink` (unit `text-sm text-muted-foreground`); delta `text-xs font-medium text-kb-ink` led by ▲ or ▼ | value, value + delta, skeleton | Keybard never shows numbers as primary content | ☐ |
| N-4 | **Status slot** holding a **Banner** or a notice | Lessons, right half of the type row (§5.2) | A fixed `h-12` area, always present and empty when idle. It holds one floating-card banner (`rounded-xl px-3 py-2`) or one notice card at a time (§5.2 gives the priority). | empty, banner, notice | Notices in the page flow would move the text card while the user reads it | ☐ |
| N-5 | **Typing surface** | Lessons text card | Glyph states in §5.2; 2 px ink caret; progress hairline | §5.2 glyph table | No text-entry surface exists | ☐ |
| N-6 | **Next-key ring, dashed alternative ring, step badge** | Lessons board | ring `ring-[3px] ring-kb-ink ring-offset-2 ring-offset-kb-gray`; alternative `outline-dashed outline-[3px] outline-kb-ink outline-offset-2`; step badge `absolute top-0.5 right-0.5 size-3.5 rounded-full bg-kb-ink text-kb-surface text-[10px] font-semibold` | §5.2 board table | Keybard's key emphasis means selection (select role); "type this next" is a different meaning and uses ink | ☐ |
| N-7 | **Pressed-now face** | Lessons board (live) | `bg-kb-pressed text-kb-pressed-fg` while held (ink in light theme, near-black in dark) | held | §5.0.1: the select role suits Matrix Tester, not a non-interactive practice board; the light dark-theme ink face would vanish | ☐ |
| N-8 | **Confidence bar** | Key strip, P5, Characters table | track `bg-muted`, fill `bg-kb-ink`; 3 px in the strip, 6 px elsewhere | empty, partial, full | No progress bar exists | ☐ |
| N-9 | **Heat faces** | Progress Keyboard, Fingers, Thumbs | §5.0.2: far / mid / near faces, plain face at target, blue usage ramp, no-data look; no header strip; value in the footer strip, led by the check at target; `border-kb-gray-border` edge in light theme | far, mid, near, at target, use-1..4, no data | Keybard has no data-colored keys | ☐ |
| N-10 | **Line chart and sparkline** | Progress Speed, P5 | SVG; strokes per the §5.0 table; grid `stroke-border`; labels `text-xs fill-muted-foreground`; hover rule and tooltip | data, hover, empty | Keybard draws no charts | ☐ |
| N-11 | **Today ring** | Metrics row | 36 px ring, `kb-primary` stroke on a `bg-muted` track | 0–100% | — | ☐ |
| N-12 | **Fingers grid** with **direction glyph** | Progress | 64 × 40 `rounded-md` heat cells; each row label carries a 3 × 3 glyph of 10 px outlined squares with that row's direction in `bg-kb-ink`, always visible | data, no data, focused | Nothing in Keybard aggregates by finger | ☐ |
| N-13 | **Inferred chip** | Progress section titles, P5 | path-chip shape, `text-muted-foreground`; a focusable `button` with an `aria-describedby` tooltip | shown, hidden | — | ☐ |
| N-14 | **Uncalibrated marker** | Key strip | full layer face, empty confidence bar, `?` in the header strip | — | An opacity treatment would copy the editor's KC_TRNS ghost look ([kb] `Keyboard.tsx:934-937`) | ☐ |
| N-15 | **Color field** (O3) | Overlay Appearance: key fill, outline, legend, layer change, pressed key | A 28 px round swatch button in the layer-dot idiom ([kb] `LayerNameBadge.tsx:300`) showing the color, with a permanent `ring-1 ring-kb-ink/50` hairline (about 4:1 against the panel in both themes), because the default **Outline only** colors are exactly the ones that vanish (fill `#14202b` on the dark panel 1.01:1; outline `#dce5ec` and legend `#f0f5f7` on the light panel 1.28:1 and 1.10:1). The row value prints the hex (`#dce5ec`). Click opens the portaled Popover (§5.0 Popovers row) with: the Keybard brand swatches plus white and black, as LayerNameBadge's 20 px dots ([kb] `LayerNameBadge.tsx:327-343`: `aria-label`, `aria-pressed`, current color marked with `border-kb-ink`), each with the same hairline in both themes (LayerNameBadge has it in dark only) and an accessible name of the color and its hex ("Brand green, #099e7c"); an `Input` for `#rrggbb` (validated by `core.ts`'s `/^#[\da-f]{6}$/i`); and a row **More colors…** that opens Keybard's in-app picker: the hue, saturation, value and hex section of `CustomColorDialog` ([kb] `src/components/CustomColorDialog.tsx`, hex input validated with `/^#[0-9A-Fa-f]{6}$/` at `:331-349`), shown with the display target only and no LED target. No native `<input type="color">` remains (D11). | closed, open, current color marked, invalid hex (input `aria-invalid`, line `text-red-700 dark:text-red-400` **Use #rrggbb**), More colors dialog | The layer color popover offers the named layer colors plus **Custom layer color**, which opens `CustomColorDialog` ([kb] `LayerNameBadge.tsx:345-353,445`), but it writes a layer color (and an LED color), not a free value with opacity. The Color field reuses its dots and its picker for any hex. | ☐ |
| N-16 | **Overlay preview card** | O1 | `bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden`; canvas area paints one of three **desktop stand-in backgrounds** (Light, Dark, Busy, values moved from `trainer.css:1` `.trainer-bg-*` into a `PREVIEW_BACKGROUNDS` data constant, because they imitate the user's desktop, not Keybard chrome); footer row with the Background SegmentedControl. The page-drawn selection on a preview key is a two-tone ring (§5.14). | Light, Dark, Busy; with Host following; no board selected (dashed well) | Keybard has no "preview over a fake desktop" surface | ☐ |

### 5.1 Responsive frame (P0)

- **Container:** `.practice-workspace`, with the editor's `contentStyle` (margin-left = rail, or rail + panel + 6 px when the panel is pushed; [kb] `EditorLayout.tsx:1136-1138,1196-1205`).
- **Lessons and Progress layout:**
  - page background `bg-kb-gray`;
  - content `px-6 pt-[22px] pb-6`;
  - `max-w-[1600px] mx-auto`;
  - vertical stack with `gap-4`.
- **Header row** (`flex items-center gap-4 flex-wrap`):
  - left: title **Practice**, then the pills **Lessons · Progress**;
  - right (`ml-auto flex items-center gap-2`) on Lessons: the status pill (P4 trigger). There is no settings button; the Lesson panel opens from the nav item (D12).
  - right on Progress: the active profile and scope as plain text, `text-sm text-muted-foreground` (`Me · Last 30 days`). It is a label, not a control; both are set in the Progress panel (G2).
- **Keyboard size:** pick the largest Key.tsx variant whose board width fits the container less 32 px:

  | Variant | Unit | Board width (25u, `research/svalboard-geometry.json` bounds) | Needs container ≥ |
  |---|---|---|---|
  | default | 60 px | 1500 | 1532 |
  | medium | 45 px | 1125 | 1157 |
  | small | 30 px | 750 | 782 |

  - Below 782 px the small board is scaled with `transform: scale()` down to 0.6.
  - Below that, the board is hidden and the floating **Board** button toggles it as an overlay sheet.
  - Under 480 px the key strip shows only the included letters plus a `+19 locked` count, and the page reserves `pb-24` below the text card so the floating tool buttons never cover it.
- **Panel effect on size.** The container width changes when the panel opens or closes (pushed at ≥ 1100 px). At 1440 px with the rail expanded (13rem, [kb] `src/components/ui/sidebar.tsx:20`), the container is about 1190 px with the panel closed (medium board) and about 714 px with it open (small board scaled to about 0.9 on Lessons; the Progress heatmap is never scaled and scrolls instead, §5.8). With the rail collapsed (3rem) and the panel open it is about 874 px (small board). The size is re-chosen after the 320 ms margin transition, not during it.
- **Panel placement by viewport** (same rules as the editor, §4.1):

  | Viewport | Placement | Page |
  |---|---|---|
  | ≥ 1100 px, side layout | Left panel, **pushes** the page | Fully visible; typing may continue with the panel open |
  | 900–1099 px, side layout | Left panel, **overlays** the page | Left part covered; focusing the typing surface closes the panel |
  | < 900 px (auto) or bottom-bar chosen | **Docked at the bottom**, `min(60dvh, 36rem)` tall; page gets matching `padding-bottom` | Page shortened above the panel and scrollable; typing may continue with the panel open, and focusing the surface scrolls the text card into view |

- **Narrow nav:** under 900 px viewport the nav rail auto-collapses ([kb] `Sidebar.tsx:187`).

### 5.2 P1 Lessons: layout

At 1440 × 900 with the nav rail expanded (208 px) and the panel closed, the content width is about 1190 px. The board uses the **medium** variant (1125 × 338).

```
┌ Practice  (Lessons)(Progress)                                        ● Live · USB ┐
│                                                                                    │
│ [a][s][d][f][l][k][j] ┊ [e]┄[r]┄[i]┄[o]┄ …locked…                 Focus  ⟦j⟧        │  key strip
│                                                                                    │
│ Speed            Accuracy          Score          Keys            Today            │  metrics row
│ 31.6 wpm ▲1.2    96.4 %  ▼0.3      1,284          7 / 26          ◔ 12 / 15 min    │
│                                                                                    │
│ ⟮GUIDED│drill│words│custom⟯  Center first ┄┄┄┄┄ status slot (empty while idle) ┄┄┄┄ │  type row (h-12)
│ ╭────────────────────────────────────────────────────────────────────────────╮     │
│ │  jask fla|j sjal kadj jalls fajd dajs                                       │     │  text card
│ │  jakd fjasl kajls djask jafl sjad                                            │     │
│ │  jadk fajls kjas djall sajk jlad                                             │     │
│ ╰────────────────────────────────────────────────────────────────────────────╯     │
│                                                                                    │
│              ┌─────── Svalboard (Key.tsx medium, live layer) ───────┐              │  board
│              │   clusters; next key ringed; cluster backdrop lit    │              │
│              └──────────────────────────────────────────────────────┘              │
│ [↻] [◐]                                                                            │  floating tools
└────────────────────────────────────────────────────────────────────────────────────┘
```

The sample words are illustrative. With only a s d f j k l unlocked and `j` focused, keybr finds fewer than 15 natural words and falls back to phonetic pseudo-words, every one containing the focused letter (§7.1).

#### Key strip

- Row `flex items-center gap-1.5`, with each letter of the lesson alphabet in **unlock order** as a 30 px `Key.tsx` small cap (`disableHover disableDrag disableTooltip`, `layerColor` = the color of the character's layer).
- Each cap is a `button` with an accessible name (`j, 18.4 wpm, 88 percent, right index center`). Click or Enter opens P5.
- Under each cap sits a 3 px confidence bar (§5.0.3 N-8): track `bg-muted`, fill `bg-kb-ink`, width = min(confidence, 1).

| Strip state | Look |
|---|---|
| Included, calibrated | Layer color face |
| Included, uncalibrated (< 3 samples) | Full layer color face, `?` in the header strip, empty bar (§5.0.3 N-14). No opacity change, which would read as the editor's KC_TRNS ghost. |
| Focused | Included look plus `ring-2 ring-kb-ink ring-offset-2 ring-offset-kb-gray` |
| Forced (alphabet size) | Same as included |
| Locked | `bg-transparent border border-dashed border-kb-gray-border text-muted-foreground` with the character shown. The board uses the same look. |
| Newly unlocked (this lesson) | Included look, `motion-safe:animate-in zoom-in-95 fade-in-0` once |
| Its P5 popover open | Included look plus the select role `ring-2 ring-kb-select ring-offset-1 ring-offset-background` (§5.0.1) |

- At the right end: label **Focus** (`text-xs text-muted-foreground`) and the focused character as a 45 px medium cap.
- Tooltip on hover and on focus: `j · 18.4 wpm · 88% · Layer 0 · R-index C`.

#### Metrics row

- Grid of 5 StatCells (§5.0.3 N-3), `grid-cols-5 gap-4`. The breakpoints are container widths (`@container`), because a pushed panel narrows the page as much as a small window does: under 900 px it wraps to 3 + 2; under 480 px to 2 + 2 + 1.
- Each cell:
  - label `text-xs text-muted-foreground`;
  - value `text-[28px] font-semibold leading-none tabular-nums whitespace-nowrap text-kb-ink`, with the unit in `text-sm text-muted-foreground` on the same line;
  - delta `text-xs font-medium text-kb-ink`, prefixed with ▲ or ▼. The glyph carries the direction. Color is not used: kb-primary on kb-gray measured about 3.0:1 and kb-red about 4.2:1, both under 4.5:1 at 12 px.
- Values show the **last completed lesson**, with deltas against the average of the previous 10 lessons (keybr's `SummaryStats`, [up] `packages/keybr-result/lib/summarystats.ts`).

| Cell | Content |
|---|---|
| Speed | WPM by default; CPM via settings. keybr's default unit is WPM ([up] `packages/keybr-result/lib/settings.ts:5`). |
| Accuracy | % |
| Score | keybr score ([up] `packages/keybr-result/lib/result.ts:46-68`) |
| Keys | `included / alphabet`. In Drill it reads `at target / scope size`, with the label **At target**. |
| Today | 36 px ring (stroke `kb-primary` on `bg-muted` track) plus `12 / 15 min`, never wrapped ([up] `packages/keybr-lesson/lib/dailygoal.ts:12-27`) |


#### Type row and status slot

- One fixed `h-12` row between the metrics row and the text card, `flex items-center gap-4`.
- **Left: lesson type.** SegmentedControl (N-1, md) **Guided · Drill · Words · Custom**, `aria-label="Lesson type"`. It is the frequently switched lesson choice, so it lives on the page (D12); everything else about a lesson lives in the Lesson panel.
  - Selecting a type discards the current lesson (typed or paused) and generates a new one at once. With a pointer, focus then returns to the typing surface and the lesson is Ready. With the keyboard, arrow keys change the selection and focus stays on the control; **Enter** moves focus to the typing surface.
  - Right of the control, the **scope** of the current type as a quiet text button, `text-sm text-muted-foreground hover:text-kb-ink` with a `›`: Guided `Center first` or `Frequency`; Drill the scope (`Layer 1 · Symbols · N S`); Words `200 words`; Custom the first 24 characters of the text. It opens the Lesson panel scrolled to that type's section. It names the current scope, so it is not a generic settings button.
- **Right: status slot** (N-4), `flex-1 min-w-0`, always present, so nothing below it moves when a banner or notice appears or goes.
  - It shows **one** item at a time. Priority, highest first: Storage off → Newer schema (§8.6) → OS layout mismatch → Caps Lock on → Layer locked on → Keymap changed → Unsent changes → Board connected → New key → Daily goal reached → New top speed. A lower item waits until the higher one clears.
  - Banners (New key, New top speed, Daily goal reached) use the floating card (`rounded-xl px-3 py-2`). Notices use the notice card. Both are one line, truncated with an ellipsis and their full text in a tooltip when the slot is narrower than the text.
- **Below 900 px** the row wraps into two fixed rows: the type control (`h-10`), then the status slot (`h-12`). The text card still never moves when the slot's content changes.
- **First run** (P2 showing): the type row is hidden; Start sets the type.

#### Text card

- Card classes: `bg-kb-surface text-kb-ink rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 px-10 py-8`, height fixed at 3 lines.
- Text is Inter `text-[28px] leading-[40px] font-medium`. The current line stays on line 2 after the first line is complete (keybr scrolling behavior, [up] `packages/keybr-textinput-ui`).

| Glyph | Style |
|---|---|
| pending | `text-muted-foreground` |
| typed correctly | `text-kb-ink` |
| typed after a miss (recovered) | `text-kb-red underline decoration-wavy decoration-2 decoration-kb-red underline-offset-[6px]` |
| current character after a miss (stop-on-error) | the recovered style plus `bg-kb-red/15 rounded-sm` |
| spaces | invisible by default; `·` in `text-muted-foreground/50` when **Show spaces** is on. A missed space shows as a red wavy underline on the gap. |
| layer underline (on in Drill, off in Guided) | **pending** characters on a non-base layer get a solid `underline decoration-[3px] underline-offset-[6px]` in their layer color via inline `textDecorationColor` (data color). Once typed, the layer underline is dropped, so it never meets the error underline. |

- Errors have a non-color cue (the wavy line), and the two underlines never share a character: solid layer color marks "still to type, on layer N"; wavy red marks "missed".
- The caret is a 2 px `bg-kb-ink` bar before the current character, 32 px tall.
- A 2 px lesson progress line sits along the card's bottom inner edge: `bg-kb-ink/15` track, `bg-kb-ink/40` fill.

#### Board (`PracticeKeyboard`)

- Keys are drawn with `Key.tsx` from `board.keylayout` or the `SVALBOARD_LAYOUT` fallback, exactly as Matrix Tester does ([kb] `MatrixTester.tsx:47-53,152-184`).
- During a lesson the board is **not interactive**: keys are not buttons, and a click anywhere on the board only focuses the typing surface. The board is `aria-hidden`; §5.12 gives its text alternative. Character details open from the key strip (P5).
- Each key gets its real keycode and label for the **displayed layer**, so legends match the editor:
  - Live · USB / Host: the live layer (§9.3 derives it from held layer keys and the masks), resolved with `resolveBinding` ([kb] `src/features/trainer/core.ts:40-49`);
  - Keymap only: the layer of the next character's primary path;
  - before typing starts: the base layer.

| Key state | Look |
|---|---|
| In lesson alphabet (included) | Layer color face (displayed layer) |
| Locked letter | `bg-transparent border border-dashed border-kb-gray-border`, legend `text-muted-foreground` (same as the strip) |
| Not a lesson character (mods, nav, F-keys) | `light-gray` face, legend at `opacity-60` |
| Next key | Included look plus `ring-[3px] ring-kb-ink ring-offset-2 ring-offset-kb-gray`. When the next character is on a layer other than the displayed one, the ringed key shows the **target character's legend** (`!`) on the **target layer's face** (orange), not the displayed layer's legend (`Q`). With prerequisites it carries a step badge `2` (§5.0.3 N-6). |
| Prerequisite of next key (layer hold, Shift) | Ink ring plus step badge `1`. The key's own header (`MO`, `LT1`) and legend stay visible; the badge sits in the top-right corner. On the base-layer view the layer-key face takes the **target layer's** color. |
| Alternative prerequisite | Same as prerequisite, but the ring is the dashed outline `outline-dashed outline-[3px] outline-kb-ink outline-offset-2` (§6.7) |
| Cluster hint | Soft backdrop behind the 5 or 6 keys of the next key's cluster: `rgba(layerColor, 0.18)` with radius 10, drawn like the 3D layer backdrop ([kb] `Keyboard.tsx:478-486,642-664`) |
| Pressed now (live) | `bg-kb-pressed text-kb-pressed-fg` while held (§5.0.3 N-7; the ink face in light theme, near-black in dark; not the select role, §5.0.1) |
| Wrong key (live) | `border-2 border-kb-red` plus the `×` badge (red role, §5.0) from the press until 600 ms after release. It is applied on the press edge, so a wrong press never looks like a correct one. The badge takes the top-right corner; if the key also carries a step badge, the `×` replaces it for those 600 ms. It no longer borrows the editor's pending border, which is amber and dashed now (§5.0.1). |
| Legends hidden (setting) | Keys render with `label=""` and keycode `""`, as Matrix Tester does ([kb] `MatrixTester.tsx:163-176`) |
| No lesson (empty and error wells, §5.3) | Base layer, every key `light-gray` with legend at `opacity-60`, no ring |

- **Hints setting:** **Next key + cluster** (default), **Next key**, or **Off**. With Off, only the pressed-now and wrong-key states remain.
- **Floating tool buttons** (bottom-left, `absolute bottom-9 left-[37px]`, [kb] `MatrixTester.tsx:14`):
  - **Restart lesson** (lucide `RotateCcw`), with tooltip "Restart lesson";
  - **Hints** (lucide `Eye` / `EyeOff`), cycling Next key + cluster → Next key → Off;
  - **Board** (lucide `Keyboard`), only when the board is hidden at narrow widths.

### 5.3 P1 Lessons: states

| State | Trigger | What shows |
|---|---|---|
| **Loading** | Engine or content chunk loading | Header; key strip as 10 caps of `bg-muted`; text card with three `bg-muted rounded h-6` bars (`motion-safe:animate-pulse`); board in base layer |
| **First run** | No results in the active profile and Start has never been completed (§8.1) | P2 Start (§5.4) replaces strip, metrics and text card; the board stays visible |
| **Ready** | Lesson generated, nothing typed | Normal layout; caret on the first character; next-key hint on the board |
| **Typing** | First keystroke | Same; timer runs; live presses show |
| **Paused** | Blur of the typing surface (including focus moving into the Lesson panel or the type control), Esc, tab hidden, leaving the Lessons page or the Practice workspace, or 10 s idle | Text card content `blur-[3px] opacity-60`. Centered over the card: title **Paused** (`text-lg font-semibold`) and an ink pill **Resume** (`Enter` or click). Board dims to `opacity-60`. Status pill reads **Paused** (§3.2). Sampler stops (D10). |
| **Lesson complete** | Last character typed | No modal. Metrics update with deltas (deltas get `motion-safe:animate-in fade-in-0`). The next lesson's text replaces the card in place. An `aria-live` region announces "Lesson complete. 31.6 words per minute, 96 percent." |
| **Key unlocked** | Lesson completion grows the included set ([up] `packages/page-practice/lib/practice/state/event-source-letter.ts:9-35`) | Banner in the status slot (§5.2): medium cap of the new character + title **New key** + its path chips (`Layer 0 · L-middle N`). Its board key and cluster pulse twice (`motion-safe`). The banner clears on the next keystroke; the slot stays, so nothing moves. |
| **Top speed / daily goal** | keybr events | Same banner in the status slot. Titles: **New top speed** (+ value), **Daily goal reached** (+ minutes). |
| **Keymap changed** | The resolver's keymap fingerprint changes mid-lesson. The fingerprint covers the practiced keymap, the default layer and the OS layout (§9.4). It changes on keymap edits that reach the practiced keymap (§5.4 sources), a default-layer change (`DF`, or the default mask), a board swap, or an OS layout change. Momentary layers (`MO`, `LT` holds, `OSL`) and toggles never change it. | The current lesson is discarded and regenerated. Notice in the status slot: **Keymap changed · lesson restarted** (clears after 4 s). |
| **Board disconnected** | `isConnected` → false during Live · USB | Status pill → **Keymap only**; the lesson continues; later keystrokes are `inferred`. No other notice. Keybard keeps the draft on unplug ([kb] `KeyboardContext.tsx:161-167`). |
| **Board connected or switched** | Any connect or reconnect, including replugging the same board and P4 **Connect board** | Keybard's connect flow first asks "You have unsaved edits. Discard them and change the editing target?" when the draft is dirty ([kb] `KeyboardContext.tsx:145-149`). It then sets `keyboard` to null ([kb] `:155-160`), so `MainScreen` shows `ConnectKeyboard` and unmounts `EditorLayout` with Practice and Overlay ([kb] `MainScreen.tsx:9`). Practice accepts this: the in-progress lesson is **discarded unsaved** (at most one lesson). When the board finishes loading, the hash route (§4.2) reopens Practice on the same page, with the panel as a nav click leaves it (§4.1); the profile is unchanged (§8.1); a new lesson is generated; and the notice **Board connected · lesson restarted** shows for 4 s. Practice adds no prompt of its own. |
| **Unsent changes** | Connected board with Live Updating off and edits not yet sent (`hasUnsavedChanges`, [kb] `KeyboardContext.tsx:461-464`) | Notice in the status slot: **Practicing the board's keymap · unsent edits excluded**. Practice uses `originalKeyboard`, which the context exposes ([kb] `KeyboardContext.tsx:476`), because that is what the board types (§5.4). |
| **OS layout mismatch** | §3.1 rule (live only) | Notice **Typed characters don't match US layout** with an inline `ui/select` of Keybard OS layouts that writes `internationalLayout` |
| **Caps Lock on** | `KeyboardEvent.getModifierState('CapsLock')` is true on a lesson keystroke | Notice **Caps Lock is on**. Keystrokes typed while it is on are excluded from stats (not saved as hits or misses); the lesson does not advance on them. Clears when a keystroke reports it off. |
| **Layer locked on** (live only) | The active mask has a layer other than the default, and no held key explains it (no `MO`/`LT`/`OSL` held in the current matrix sample), for 300 ms | Notice **Layer 1 is locked on** (layer name from `cosmetic.layer`). Keystrokes while it shows are excluded from stats. Keymap-only mode can't see this; misses there are counted normally. |
| **Nothing to drill** | The Drill scope resolves to fewer than 3 distinct characters (the minimum for a valid result, §6.9) | Empty well (board in the no-lesson look), title **Nothing to drill in this scope**, ink pill **Change scope** (opens P3 at the Drill section) |
| **No letters** | Fewer than 6 language letters typeable on the keymap | Empty well, title **No letters to practice on this keymap**, quiet pills **QWERTY example** and **Layouts**. Board in the no-lesson look (§5.2). |
| **Content error** | Lazy chunk or model fails to load | Empty well, title **Practice words didn't load**, ink pill **Retry**. Board in the no-lesson look. |
| **Storage off** | IndexedDB open fails (for example a private window) | Notice **Progress isn't being saved**, persistent. Lessons still work in memory. |

### 5.4 P2 Start (first run)

- **Layout:** a floating card (`bg-kb-surface rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-6`, [kb] `EditorLayout.tsx:1494` idiom) in a centered column `max-w-3xl mx-auto`, content `flex flex-col gap-6`. The card gives the category tiles the white ground they sit on in Keybard's settings panel; on the bare `bg-kb-gray` page their inactive fill has no visible edge.
- **Title:** **Start practicing** (`text-[22px] font-semibold`).
- **Goal row:** three category tiles, `grid grid-cols-3 gap-3`, each tile `py-5`, lucide icon `h-5 w-5` with label `text-sm font-medium`:

  | Tile | Icon | Sets |
  |---|---|---|
  | **Learn from the center keys** | `Sprout` | Guided; Start order = Center first; alphabet size 0; target 25 WPM; hints Next key + cluster; daily goal 15 min |
  | **Coming from QWERTY** | `ArrowRightLeft` | Guided; alphabet size 1 (all letters); target 35 WPM; hints Next key; daily goal 15 min |
  | **Drill my keymap** | `Target` | Drill → Weakest; target 45 WPM; hints Off; daily goal 10 min. On a profile with no samples, Weakest falls back to uncalibrated characters in unlock order (§6.2). |

- **Setting rows** (setting row idiom):
  - **Keymap**: `ui/select` of the sources below. Only sources that exist are listed.
  - **Target speed**: slider 15–150 WPM, value shown as `35 wpm`.
- **Forward action:** brand green pill **Start**. It is the only green action on the screen.
- **Board** below the card: base layer. The keys of the first 6 letters for the selected tile are lit in the layer color and every other letter is shown locked (dashed). This previews the first lesson without any prose.
- **States:** default (no tile selected; Start disabled); tile selected; no letters (same as P1 "No letters").
- **With the Lesson panel open** (the nav click opens it, §4.1): the panel shows the current settings. **Start** writes only its preset's fields (type, start order, alphabet size, target, hints, daily goal), so other changes made in the panel survive.

**Keymap sources (DECISION).** What the user types is produced by their physical board, so Practice practices the keymap that board actually runs.

| Source | Offered when | Keymap used | Notes |
|---|---|---|---|
| **Connected board** (default when connected) | A board is connected over WebHID | `originalKeyboard`, the last state confirmed on the board ([kb] `KeyboardContext.tsx:83,456-458,476`) | With Live Updating on ([kb] `LayerSelector.tsx:88,93`, `isInstant`), each edit reaches the board and `originalKeyboard` at once, so practice follows edits immediately. With it off, unsent edits are excluded until **Apply**, with the "Unsent changes" notice. The only source that allows Live · USB. |
| **Loaded file** (default when a file is loaded and no board is connected) | A `.svil` or layout file is the editing target | `keyboard` (the draft, including edits) | No board to read. Practice assumes the user's physical board runs this keymap. Keymap only. |
| **QWERTY example** (default for the example) | The example is loaded ([kb] `ConnectKeyboard.tsx:7,116`) | `keyboard` | Keymap only |
| **Host board** (M5) | Live · Host is available | `useHost().state.board` ([kb] `host.ts:19`) | Required for Live · Host (§3.2) |

There is no separate "Editor draft" source. On a connected board the draft becomes practice keymap only once it is on the board.


### 5.5 P3 Lesson panel (detail panel content)

- **Frame:** the shared detail panel (`SecondarySidebar`, [kb] `SecondarySidebar.tsx:129-146`), opened from the **Practice** nav item while the Lessons page shows (§4.1). Title **Lesson** (22 px), ghost round close. **Esc** inside the panel closes it and returns focus to the typing surface (§4.1).
- **Placement** follows §5.1: pushed beside the page at ≥ 1100 px, over it at 900–1099 px, docked at the bottom in bottom-bar layout. When docked, the sections keep their single-column order and the panel scrolls (`data-panel-scroll-owner`, [kb] `SecondarySidebar.tsx:171`).
- **Typing while open:** at ≥ 1100 px (side placement) and in bottom-bar layout the page sits beside or above the panel, so the user can click the text card and keep typing with the panel open; at 900–1099 px, where the panel covers the page, focusing the typing surface closes the panel (§4.1).
- **Sections** are separated by `text-xs font-medium text-muted-foreground` group labels. There is no Type section: the type is chosen on the page (§5.2). The first section is the current type's rows, titled with the type's name.

**Rows by type** (only the current type's section is shown):

- **Guided**
  - Start order: SegmentedControl **Center first · Frequency**
  - Included letters: slider 0–100% (keybr `alphabetSize`)
  - Real words: OnOffToggle (keybr `naturalWords`, default on)
  - Re-check slow keys: OnOffToggle (keybr `recoverKeys`, default off)
  - Capitals: slider 0–100%
  - Punctuation: slider 0–100%
- **Drill**
  - Layer: layer pills (layer names from `cosmetic.layer`; each pill has an 8 px dot in the layer color), plus **All**
  - Group: category tiles **All · Letters · Numbers · Symbols · Weakest**
  - Directions: ToggleChipGroup (N-2) **C N S E W**, plus **2S** only when some finger uses a 6-key cluster
  - Hands: SegmentedControl **Both · Left · Right**
  - Thumbs: OnOffToggle. **On** includes characters whose target key is a thumb key (Space, Enter, Backspace on the default keymap). **Off** leaves them out. Prerequisites on thumbs (layer holds, Shift) are always allowed. Default On.
  - Number format: OnOffToggle **Benford** (keybr `numbers.benford`, [up] `settings.ts:48-50`), shown only when Group = Numbers. On, the text is keybr's number-shaped text (`1,204 37 8.5`); off, digits come as drill tokens.
  - In scope: read-only row listing the scope as small caps (up to 12, then `+ n`), and the count. Below 3 characters the value reads **Too few characters (2 of 3)** in `text-red-700 dark:text-red-400`; the page then shows "Nothing to drill" (§5.3).
- **Words**
  - Word list size: slider 10–1000 ([up] `settings.ts:22-27`)
  - Long words only: OnOffToggle
- **Custom**
  - Text: clickable row showing the first 40 characters and `›`; opens P6
  - Lowercase, Letters only, Randomize: OnOffToggles ([up] `settings.ts:40-47`)

**Targets.**

- Target speed: slider. keybr's range is 75–750 CPM, shown as 15–150 WPM ([up] `settings.ts:60`).
- Speed unit: SegmentedControl **WPM · CPM**.
- Lesson length: slider 0–100% (keybr `length`, [up] `settings.ts:14`).
- Daily goal: slider 0–120 min ([up] `settings.ts:61`).

**Typing.**

- Stop on error: OnOffToggle (default on)
- Forgive errors: OnOffToggle (default on) ([up] `packages/keybr-textinput/lib/settings.ts:40-42`)
- Show spaces: OnOffToggle
- Layer underlines: OnOffToggle
- Announce next key: OnOffToggle (default off; §5.12)

**Board.**

- Hints: SegmentedControl **Next key + cluster · Next key · Off**
- Legends: SegmentedControl **Show · Hide**
- Board: SegmentedControl **Show · Hide**

**Input.**

- Status row: label **Input**, value = the status pill's text (so **Paused** while the lesson is paused, §3.2).
- Read key presses: OnOffToggle, default on. Off disables Live · USB.

**Keymap.**

- Source: `ui/select` (§5.4 sources).
- OS layout: read-only value (`US`) plus `›`, which opens Keybard's **Settings** panel at the layout row. Settings is workspace-neutral (§4.1), so Practice stays on screen; the Practice nav item brings the Lesson panel back.

**About.**

- Clickable row **Based on keybr.com and River's svalbr** `›`. It opens a popover titled **Based on keybr.com** with two link rows (**keybr.com source** → github.com/aradzie/keybr.com, **svalbr by River** → r-tae.github.io/keybr.com) and one line **Practice is licensed AGPL-3.0 · Source** linking to the Keybard repository. This is attribution, a necessary disclosure. The same row closes the Progress panel (G2).

Data (export, import, reset) is not here; it lives with Progress in G2.

**When settings apply.** Settings are global (Q6). A change to a setting that shapes the lesson (Drill scope, start order, included letters, real words, capitals, punctuation, word list, custom text, lesson length, target speed) discards the current lesson and generates a new one at once, debounced 300 ms for sliders, so the text card beside a pushed panel shows the effect immediately. Display settings (hints, legends, board, show spaces, layer underlines, announce next key, speed unit) apply live and keep the current lesson.

**Panel states:** default; saving (footer `text-xs text-muted-foreground` **Saving…**); storage error (footer **Settings couldn't be saved**, `text-red-700 dark:text-red-400`).

### 5.6 P4 Input status pill and popover

**Pill states:**

| State | Look |
|---|---|
| **Live · USB** | 8 px `bg-kb-primary` dot |
| **Live · Host** | 8 px `bg-kb-primary` dot (green means a live connection; the text names the source). Not blue, which now means selection (§5.0.1). |
| **Keymap only** | 8 px ring `border-2 border-kb-gray-border` |
| **Paused** (lesson state, takes precedence, §3.2) | Gray dot |

**Popover** (Popover idiom, `w-80`). Title **Input**, then rows (`text-sm`, label left, value right). Each title says what the user gets; the value says whether they get it and, when not, why:

| Row | Values |
|---|---|
| Pressed keys | `Shown` / `Shown, may miss quick taps` (Host) / `Not shown · connect the board` / `Not shown · needs Chrome or Edge` / `Not shown · reading is off` |
| Layer | `Live` / `From keymap` |
| Keymap | the source name (`Connected board`, `Loaded file`, `QWERTY example`, `Host board`) |

The measured sample rate and the keymap fingerprint are not shown here. They are diagnostics: they go in the row's tooltip on focus or hover and in exported data (§8.3 `x.km`).

**Actions** (only those that apply):

- brand green pill **Connect board**, when `navigator.hid` exists and nothing is connected. It calls Keybard's existing connect flow, which restarts the lesson (§5.3 "Board connected or switched").
- quiet pill **Connect Keybard Host** (M5, only on allowed origins and not Paranoid; reuses `useHost().connect`, [kb] `host.ts:90,108`);
- ink pill **Stop reading keys** / **Read key presses**, which toggles the setting.

**Unavailable actions are not drawn as disabled buttons.** The reason goes in the Pressed keys value ("needs Chrome or Edge", "Keybard Host isn't allowed on this site", "Paranoid: Host only when it serves this page"), where every user can read it. A disabled button can't show a tooltip ([kb] `ui/button.tsx:8`).

### 5.7 P5 Key detail popover

Opened from a key-strip cap (Lessons), or from a heatmap key, a Fingers cell or Thumbs cell (aggregate variant), a Layers row (aggregate) or a Characters row (Progress). Board keys on Lessons don't open it (§5.2). While it is open, the element that opened it shows the select role (§5.0.1).

- **Header:** medium cap (layer color) + character in `text-[22px] font-semibold` + path chips. Each chip is `px-2 py-0.5 rounded-full bg-kb-gray-medium text-xs`, for example `Layer 1` `hold R-thumb T5` `L-pinky N`. Alternative paths are listed in `text-xs text-muted-foreground` (`or hold L-thumb T1`). A character whose target is a tap-hold or tap-dance key also gets the chip **Delayed output** (§6.5), with a tooltip "Types on release, so its time includes the hold".
- **Stats grid** (2 × 3 StatCells):
  - Speed (filtered `timeToType` → WPM)
  - Best
  - Accuracy
  - Samples
  - Confidence (bar)
  - To target: keybr `remainingLessons` ("≈ 4 lessons"), or "—" when r² < 0.5 ([up] `packages/keybr-lesson/lib/learningrate.ts`)
- **Sparkline:** last 30 samples (SVG 240 × 48, `stroke-kb-blue`, target as a dotted `kb-ink/40` line).
- **Pressed instead** (the on-screen title of the confusions block; live, or inferred with an **Inferred** chip): top 3 entries, as mini cap + count + class (`wrong layer`, `wrong direction`, `wrong finger`, `wrong hand`, `wrong shift`). Example for `!` on the default keymap: `q` ×3 wrong layer (same key, layer 0), `1` ×2 wrong direction (same L-pinky cluster), `@` ×1 wrong finger (L-ring N).
- **Layer reach** (live, layered characters only): mean time from the previous character to the layer key press.
- **Action:** ink pill **Drill this key**. It sets Drill with scope = this character plus its cluster neighbors and focus = this character, then shows the Lessons page (switching from Progress if needed) with a new lesson Ready.
- **Aggregate variant** (finger × direction cell, thumb cell, layer row): the header is the group name ("L-middle · N") with chips of the characters in the group; the stats are aggregates; Pressed instead is omitted. Its action is the ink pill **Drill this group**: Drill with scope = the group's characters (all layers), focus = the group's weakest character.
- **States:**
  - **No data**: "No samples yet" in place of the stats grid, one line. The action stays.
  - **Inferred only**: every sample is inferred. Stats and Pressed instead show, with an **Inferred** chip beside the header; Layer reach is omitted (it needs live data).
  - **Live**: as described.


### 5.8 G1 Progress

- **Layout:** header (§5.1); then a single scrolling column of sections, each titled `text-lg font-semibold text-kb-ink`. There is no sub-navigation.
- **Profile and scope** are set in the Progress panel (G2), which the Practice nav item opens. The header shows them as text (`Me · Last 30 days`). The scope filters every section below.
- **Interactive data:** every element that opens P5 (heatmap key, Fingers cell, Thumbs cell, Layers row, Characters row) is a real `button` (or a row with a button) with an accessible name, for example "e, 38 words per minute, left middle north, at target". Each opens P5 on click, Enter or Space. While its popover is open the element shows the select role (§5.0.1).

1. **Summary.** Stat row of 5 StatCells: Lessons, Time, Top speed, Accuracy (avg), Keys at target (`19 / 26`).
2. **Speed.** SVG line chart (N-10), full width, 240 px tall.
   - x = lesson index; a SegmentedControl switches between **Lessons** and **Days**.
   - Left y: speed in the selected unit, a solid `kb-blue` line. Right y: accuracy %, a dashed (`6 4`) `kb-purple` line. The two differ in stroke as well as hue, so protan and deutan viewers can tell them apart.
   - Each line is labelled directly at its right end (**Speed**, **Accuracy**) in `text-xs font-medium text-kb-ink`, led by a 16 px sample of the line's own stroke (solid blue, dashed purple). The label text is not in the line color: kb-blue and kb-purple measure 3.04:1 and 4.13:1 on the white card and 4.04:1 (purple) on the dark one, under 4.5:1 for `text-xs`. There is no separate swatch legend.
   - Target: dotted (`2 3`) `kb-ink/40`, labelled **Target 35** at its left end. Axes and grid: `stroke-border`, labels `text-xs fill-muted-foreground`.
   - Hover: vertical rule + tooltip (lesson date, speed, accuracy, type). Keyboard users get the same values in the History table.
   - Data transforms are ported from [up] `packages/keybr-chart/lib/dist/`, `graph.ts` and `keyusage.ts`. The drawing in `SpeedChart.tsx`/`ProgressOverviewChart.tsx` is the visual reference only.
3. **Keyboard.** Heatmap board (Key.tsx, same sizing rule as §5.1, except that the heatmap is **never scaled below 1.0**: below a 782 px container the small board scrolls horizontally inside its own `overflow-x-auto`, as the Fingers grid does, so footer values never render below 10 px). Above it, in one toolbar row:
   - a metric SegmentedControl **Speed · Accuracy · Errors · Usage**;
   - the LayerSelector divider (`h-4 w-[1px] bg-slate-400 dark:bg-neutral-600`, [kb] `LayerSelector.tsx:533`);
   - layer pills (layers with any data, each with its color dot). They choose which layer's characters the board shows. The color dots on the pills are the only layer color in the section; key faces show heat only (D14).
   - Beside the section title, a one-line **scale** for the selected metric: small heat swatches with their thresholds, printed values, for example `■ < 18 · ■ 18–26 · ■ 26–35 · ✓ ≥ 35 wpm`. This is a legend, not prose.
   - Each key: heat face (§5.0.2) with the legend for the selected layer in the center and no header strip; the footer strip carries the value (`38` WPM, `97%`, `6%` errors, `4%` usage), led by a check on keys at target (`✓ 36`). Keys with no practiced character on this layer (modifiers, navigation) are drawn in the no-data look without a value.
   - Thresholds:

     | Metric | `kb-heat-far` | `kb-heat-mid` | `kb-heat-near` | At target (plain + check) |
     |---|---|---|---|---|
     | Speed (confidence = target time / time-to-type) | < 0.5 | 0.5–0.75 | 0.75–1.0 | ≥ 1.0 |
     | Accuracy | < 90% | 90–95% | 95–98% | ≥ 98% |
     | Errors (misses on the key plus strays on it, as a share of its presses) | > 10% | 5–10% | 2–5% | ≤ 2% |

     | Metric | `kb-use-1` | `kb-use-2` | `kb-use-3` | `kb-use-4` |
     |---|---|---|---|---|
     | Usage (share of keystrokes in scope) | lowest quartile | second | third | highest quartile |

   - Speed and Accuracy thresholds are fixed; the speed scale line prints them in the selected unit from the target speed. The Errors footer prints the rate; the count is in P5.
   - Title suffix **Inferred** (N-13) when more than 50% of samples are inferred.
4. **Fingers.** A table-grid of 8 finger columns: L-pinky, L-ring, L-middle, L-index | R-index, R-middle, R-ring, R-pinky.
   - Rows: **C, N, S, E, W**, plus a **Finger** totals row. A **2S** row appears only when some finger uses a 6-key cluster; the default keymap uses `finger_5` everywhere (`research/svalboard-geometry.json` notes, `fragment_selections`), so the row is normally absent.
   - Each row label carries the direction glyph (N-12): a 3 × 3 grid with that row's direction filled in ink, always visible, so E and W read correctly without hover. E is always screen-right (+x) ([kb] `src/constants/svalboard-layout.ts`; geometry note "E/W are screen-compass directions").
   - Cells are 64 × 40 `rounded-md` heat faces (§5.0.2) with the value and, at target, the check. The metric follows the Keyboard metric control, and so do the faces: Speed, Accuracy and Errors use far/mid/near/at-target; Usage uses the blue ramp. Cells whose keys carry no practiced character show the no-data look with `—`.
   - A hand gap separates the two halves.
   - A cell opens P5 (aggregate).
5. **Thumbs.** Two 6-row columns (L, R) for T1–T6, with the same heat faces as Fingers. Cell content: what the key did in practice (`Space`, `Shift`, `Layer 1`) + metric value. For layer-hold thumbs (live) the Speed value is **layer reach** time in ms, colored against the same confidence thresholds using the target time.
6. **Layers.** Table: layer (pill with color dot and name), characters, speed, accuracy, reach (ms, live), share of keystrokes. A row opens P5 (aggregate).
7. **Characters.** Sortable table, `text-sm`, row height 36. Columns: cap (30 px small Key, layer color face, since it identifies the character rather than showing heat), character, path, speed, best, accuracy, samples, confidence bar, last practiced. Default sort: confidence ascending. A row opens P5.
8. **History.** List of lessons, 50 per page, newest first. Columns: date/time, type (+ scope), speed, accuracy, length, input (dot as in P4). Pagination via quiet pills **Newer** / **Older**.

**Progress states:**

| State | What shows |
|---|---|
| Empty (no results) | Empty well, title **No lessons yet**, brand pill **Start practicing** → Lessons |
| Loading | Header as normal; Summary as 5 StatCell skeletons; the chart and board areas as `bg-muted rounded-xl` blocks of their final size (`motion-safe:animate-pulse`) |
| Keymap-only data | Heatmap, Fingers, Thumbs and Layers titles get **Inferred** |
| Storage off | Notice card **Progress isn't being saved** under the header. The page shows this session's in-memory lessons only, or the Empty well if there are none. |
| Narrow (< 900) | Fingers grid scrolls horizontally inside its own `overflow-x-auto` (the page never scrolls horizontally) |

### 5.9 G2 Progress panel (detail panel content)

The shared detail panel, opened from the **Practice** nav item while the Progress page shows. Title **Progress**. Every row acts on the **active profile**.

**Profile.**

- Profile: `ui/select`, one entry per profile (§8.1), plus **New profile…**, which opens a small `ui/dialog` **New profile** with a name `Input` and an ink pill **Create**.

**Scope.**

- Period: SegmentedControl **7 days · 30 days · All**. It filters every Progress section and is echoed in the page header.

**Data.** Three setting rows; the rows replace revision 2's Data dialog.

- **Export:** outline button **Export…**. Downloads `keybard-practice-<profile>-<yyyy-mm-dd>.json`. An OnOffToggle **Include keystrokes** (default on) controls whether per-keystroke events are included.
- **Import:** outline button **Import…** (file picker, `.json`).
  - After parsing, the row shows the counts found: `412 lessons · 2 profiles`.
  - A SegmentedControl chooses **Merge · Replace**.
  - With **Merge**, an ink pill **Import** commits. All profiles in the file are merged into the active profile (§8.4).
  - With **Replace**, the commit button becomes the destructive Button **Replace progress…** (red role). It opens a confirm `ui/dialog` titled **Replace progress for <profile>?**, with the line `120 lessons will be deleted` and destructive **Replace** / outline **Cancel**. Replacing data takes the same two steps as deleting it.
  - Invalid file: `text-sm text-red-700 dark:text-red-400 role="alert"` **Not a Keybard practice file**.
- **Reset:** destructive button **Reset progress…** opens a confirm dialog titled **Delete progress for <profile>?** with destructive **Delete** and outline **Cancel**.

**About.** The same row as in P3.

**Panel states:** default; import parsed; import invalid; confirm dialogs open; storage off (Export still exports this session's in-memory lessons; the Import and Reset rows show the value **Not available · progress isn't being saved** instead of buttons).

### 5.10 P6 Custom text dialog

- `ui/dialog` `sm:max-w-2xl`, title **Custom text**.
- `textarea` (Input classes, 12 rows) with a counter `1,204 / 10,000` in `text-xs text-muted-foreground`.
- Under it, when needed, a single line `text-sm text-red-700 dark:text-red-400`: **Not on this keymap:** followed by chips of the untypeable characters (`é` `ñ` `—`). They are stripped at lesson time. Space, newline and tab resolve through the resolver's whitespace table (§9.4), so ordinary text never lists them.
- Footer: outline **Cancel**, ink pill **Use text**.

### 5.11 Keyboard interaction (Practice)

- **Capture:** input goes to a visually hidden, focused `<textarea>` (`autocomplete=off autocorrect=off autocapitalize=off spellcheck=false`).
  - keybr's `InputHandler` listens to `focus`, `blur`, `keydown`, `keyup`, `input` and the three `composition*` events ([up] `packages/keybr-textinput-events/lib/inputhandler.ts:46-56`). It does not listen to `beforeinput`, and Practice doesn't add it.
  - Because focus is in a `textarea`, Keybard's global editing shortcuts yield via `isEditorInput` ([kb] `src/utils/editor-input.ts:2-6`). That covers typing-binds-key ([kb] `KeyBindingContext.tsx:800`), layer paste, and Delete on a selected key.
  - Ctrl/Cmd+B does **not** check `isEditorInput` and still toggles the nav rail ([kb] `src/components/ui/sidebar.tsx:231-243`). This is harmless, because Ctrl combinations are never lesson text.
- **Keys:**

  | Key | Action |
  |---|---|
  | **Esc** | Pause / resume while focus is in the typing surface. With focus in the Lesson panel, Esc closes the panel instead and returns focus to the paused surface (§4.1). |
  | **Enter** while paused | Resume |
  | **Tab** | Leaves the surface (focus moves to the next control) and pauses. keybr calls `preventDefault()` on Tab ([up] `inputhandler.ts:101-103`); the vendored handler is patched to let it through (§9.2). |
  | **Backspace / Ctrl+Backspace** | keybr semantics (`deleteContentBackward`, `deleteWordBackward`) |
  | **Ctrl/Cmd+key** combinations | Not typed. Browser shortcuts work. |

- `event.repeat` is ignored ([up] `inputhandler.ts:97-100`).
- `isTrusted` is required in production builds ([up] `inputhandler.ts:92-96`), so tests run with a non-production `NODE_ENV`.
- Clicking anywhere on the text card or on the board focuses the surface. Nothing on the board opens a popover during a lesson, so a click can't take focus away and pause the lesson. In side layout at 900–1099 px, where the panel covers the page, focusing the surface also closes an open Lesson panel (§4.1).
- There is no keyboard shortcut for the Lesson panel. It is reached like every Keybard panel, through the nav item (a `button` with `aria-pressed`, [kb] `Sidebar.tsx:147`), or through the type row's scope button.

### 5.12 Accessibility

- **Visible text:** `aria-hidden`. The hidden textarea has `aria-label="Practice text"` and `aria-describedby` pointing at an sr-only element holding the current word.
- **Live region:** an `aria-live="polite"` region announces lesson results, unlocks, pause and resume. It never announces per keystroke.
- **Board:** `aria-hidden` and non-interactive (§5.2), with an sr-only line "Next: j, right index, center, layer 0" updated per character only when the setting **Announce next key** is on (off by default; Typing section of §5.5). Everything the board offers is reachable elsewhere: character details through the key strip buttons, the next key through that sr-only line.
- **Progress:** heatmap keys, Fingers and Thumbs cells and table rows are buttons with accessible names (§5.8). The direction glyphs are always visible. **Inferred** chips are focusable, with their tooltip in `aria-describedby`.
- **Contrast:**
  - pending text `muted-foreground` on `kb-surface` is #62748e on #fff ≈ 4.7:1 in light, and #a3a6ab on #1d1e21 ≈ 7.4:1 in dark (approximate hex from visual-language §1b);
  - errors use color plus a wavy underline (§5.2);
  - deltas are `text-kb-ink` with ▲/▼;
  - heat faces meet 4.5:1 for their values in both themes (§5.0.2), and each heatmap prints its numbers and a scale line;
  - the select ring meets 3:1 against the page and surface, and text on the select tint meets 4.5:1 (§5.0.1).
  - chart line labels are `text-kb-ink` with a stroke sample, not the line color (§5.8);
  - the wrong-key state carries the `×` badge as well as the red border, and the pressed-now face clears 5.5:1 against every layer face in both themes (§5.0.1);
  - Overlay color swatches carry a hairline and the preview selection a two-tone ring, because user colors and desktop stand-in backgrounds can match the panel or the ring (N-15, §5.14);
  - **known exception (accepted, OD6):** white text on the brand-green action pill measures 3.39:1, inherited from [kb] `ConnectKeyboard.tsx:176`. Brand colors are not changed.
- **Motion:** all motion is gated with `motion-safe:` (caret glide, unlock pulse, banners). Keybard has no existing reduced-motion handling (visual-language §1f), so Practice introduces it locally.
- **Focus:** all controls are reachable by keyboard with Keybard's standard focus rings (`focus-visible:ring-ring/50 ring-[3px]`). SegmentedControls are radio groups with arrow-key movement (N-1).
- **Overlay:** the preview SVG keeps `role="img"` ([kb] `OverlaySurface.tsx:12`). Its keys are pointer targets only, as today; the **Binding** select in the Recall tile is the keyboard path to the same choice. Color fields are buttons with the color's name and hex as their accessible name ("Outline color, #dce5ec").

### 5.13 Detail panel content by page

§4.1 defines how the panel opens, closes, takes focus and is placed. This table is the content side.

| Workspace · page | Panel title | Content | Opened by |
|---|---|---|---|
| Practice · Lessons | **Lesson** | P3 (§5.5) | Practice nav item; the type row's scope button (§5.2); **Change scope** in the Nothing-to-drill well (§5.3) |
| Practice · Progress | **Progress** | G2 (§5.9) | Practice nav item |
| Overlay | **Overlay** | O2 (§5.15) | Overlay nav item |

- Switching between **Lessons** and **Progress** with the pills swaps the panel content in place when the panel is open; it does not close or reopen it, so focus stays where it was.
- The panel's open or closed state is shared by all workspaces, as it is in the editor (`useSidebar("details-panel")`, [kb] `PanelsContext.tsx:42`). Moving from the editor to Practice with a nav click always opens it (§4.1).

### 5.14 O1 Overlay page

The restyled Overlay page keeps every capability of today's Trainer page and changes only the chrome around the overlay surface. **The overlay surface itself, and the desktop overlay that Keybard Host draws, keep the user's appearance colors exactly as today**; those colors are user data (N10).

**Capabilities kept, and where they live now:**

| # | Capability (today, [kb] `src/features/trainer/`) | Revision 3 |
|---|---|---|
| 1 | Layout source: Live board (Host), loaded snapshot (`originalKeyboard`) or QWERTY example, editor draft (with "· unsaved changes"), QWERTY example, imported layout (`TrainerPage.tsx:118`) | O1 **Layout** row, `ui/select`; the snapshot option is named after where it came from (Layout row below) |
| 2 | Import a layout for the overlay only, with the 10 × 6 check and error (`TrainerPage.tsx:99-106`) | O1 **Layout** row, outline button **Import layout…**; error line under the row |
| 3 | Default layer and preview layer when not following the board (`TrainerPage.tsx:119`) | O1 **Layers** row: **Default layer** `ui/select`, **Preview** layer pills (with color dots; the default layer's pill carries the `House` icon as in the editor's layer pills) |
| 4 | Live layers from Host when following (`TrainerPage.tsx:63-71`) | Unchanged; the Layers row hides, as today |
| 5 | Default layer for older firmware: a Host setting (`manualDefault`), shown whenever Host is connected and reports `default === null`, whatever the preview source (`TrainerPage.tsx:131`, inside `host.state &&`, not gated on `following`) | O2 **Window**, row **Desktop default layer**, beside the other Host-wide settings; shown in exactly the same condition (`host.state && host.state.default === null`), following or not. Its title says what it sets, so it can't be confused with the preview's **Default layer** in the O1 Layers row. |
| 6 | Hands, overlay size (`TrainerPage.tsx:130`) | O2 **Window** |
| 7 | Drag by keys, Place at bottom (`TrainerPage.tsx:130`) | O2 **Window**, Host connected only |
| 8 | Reload layout, Disconnect (`TrainerPage.tsx:130`) | Moved to the O1 **Host** card, beside the board select they act on |
| 9 | Reset appearance and view (`TrainerPage.tsx:130`) | O2 **Window** |
| 10 | Appearance preset and Custom, fill/outline/legend color and opacity, outline thickness, legend halo, layer-change and pressed colors (`TrainerPage.tsx:125-129`) | O2 **Appearance**, with Color fields (N-15), sliders and OnOffToggle |
| 11 | Layer-change highlight and duration (`TrainerPage.tsx:131`) | O2 **Feedback** |
| 12 | Highlight held keys (Host config `highlightPressed`), matrix-unavailable note, Preview held keys (`TrainerPage.tsx:131`) | O2 **Feedback** |
| 13 | Recall: toggle, binding card, Reveal, Remembered/Again, counts; hidden legends and target published to Host every second while the page is active, cleared on leave (`TrainerPage.tsx:84-92,98,132`) | O2 **Recall**. Publishing stays gated on the Overlay **workspace** being active, not on the panel being open. |
| 14 | Familiar bindings: select, Mark familiar, Clear, Hide familiar legends; selecting a key in the preview (`TrainerPage.tsx:115,132`) | O2 **Recall**; the preview key chosen gets the select ring (§5.0.1) |
| 15 | Host install, connect, version and outdated link (`HostInstall.tsx:11-32`) | O1 status pill, **Desktop overlay** well, Host card, outdated notice (§5.16) |
| 16 | Paranoid note (`TrainerPage.tsx:110`) | O1 **Paranoid** well (§5.16) |
| 17 | Host config mirroring: adopt Host config on a new revision when nothing is pending; write changes after 160 ms; mirror `internationalLayout` into `layoutId` (`TrainerPage.tsx:48-62`) | Unchanged logic, moved into `OverlayProvider`. The panel footer shows **Saving…** with a `kb-pending` dot while a write is pending. |
| 18 | Preview background Light · Dark · Busy (`TrainerPage.tsx:116`) | O1 preview card footer, SegmentedControl |
| 19 | Show or hide the desktop overlay; choose the Host's board (`TrainerPage.tsx:112`) | O1 **Host** card |
| 20 | Settings saved in `localStorage` `keybard.trainer.v1`; "Settings could not be saved" footer (`TrainerPage.tsx:46,133`) | Unchanged; O2 footer |

**Layout** (1440 × 900, rail expanded, panel open and pushed, so the page is about 714 px wide):

```
┌ Overlay                                       ● Keybard Host vLaunch2.1 ┐
│ ┌ Host ──────────────────────────────────────────────────────────────┐ │
│ │ Board [Svalboard · Mule        ▾]  [👁 Hide overlay] [↻ Reload] Disconnect │
│ │ Keybard Host vLaunch2.1 · Keybard 61db58a                           │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌ Preview card ──────────────────────────────────────────────────────┐ │
│ │   (desktop stand-in background)   OverlaySurface at Size %          │ │
│ │ Live board                         Background ⟮Light│DARK│Busy⟯    │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ Layout  [Live board · read-only ▾]                  [⇪ Import layout…] │
│ (Layers row hidden while following the board)                          │
└────────────────────────────────────────────────────────────────────────┘
```

- **Frame:** `.overlay-workspace`, same `contentStyle` as the editor; content `px-6 pt-[22px] pb-6 max-w-[1600px] mx-auto flex flex-col gap-4` on `bg-kb-gray`.
- **Header:** title **Overlay** (22 px, no rule, no icon). Right: **Host status pill** (status pill idiom, not interactive, `role="status"`):

  | State | Dot | Text |
  |---|---|---|
  | Connected | 8 px `bg-kb-primary` | `Keybard Host vLaunch2.1` (`dev` and `unknown` print as `Keybard Host dev` and `Keybard Host (older)`) |
  | Not connected | 8 px ring `border-2 border-kb-gray-border` | `Keybard Host not connected` |
  | Connection lost or stale (`host.lost`, §5.16) | 8 px `bg-kb-red` | `Keybard Host connection lost` |

- **Status area:** directly under the header, at most one notice at a time (priority: Connection lost → Host command failed → Host outdated). Not a fixed slot: nothing on this page is being read while it changes.
- **Host card** (connected): `bg-kb-surface rounded-2xl border border-gray-200 dark:border-neutral-700 p-4 flex flex-wrap items-center gap-3`.
  - **Board**: `ui/select` of `host.state.devices` (placeholder **Select a Svalboard**). Choosing one sends `connect` and turns following on, as today.
  - Outline button **Show overlay** / **Hide overlay** (lucide `Eye` / `EyeOff`).
  - Outline button **Reload layout** (`RotateCw`); ghost button **Disconnect** (`Unplug`).
  - When `host.state.valid` is false, the Host's own status text is the Board row's value (`text-sm text-muted-foreground`, `role="status"`).
  - Last line, `text-xs text-muted-foreground`: `Keybard Host vLaunch2.1 · Keybard 61db58a` (the facts `HostVersion` printed as a sentence, [kb] `HostInstall.tsx:11-19`).
- **Preview card** (N-16): the canvas paints the chosen desktop stand-in background and centers `OverlaySurface` at `prefs.scale` % width ([kb] `TrainerPage.tsx:115`). Footer: left, the source as a value, the same name the Layout select shows (`Live board`, `Connected board`, the loaded file's name, `Editor draft`, `QWERTY example`, `Imported layout`; `No board` while Host is connected with no board chosen); right, **Background** SegmentedControl **Light · Dark · Busy**. Clicking a key selects it for Familiar bindings (O2 Recall); the page draws the selection around that key's group, outside the user's colors. `OverlaySurface` gains an optional `selected` prop for this; `HostOverlay` never passes it, so the desktop overlay is unchanged.
  - **Two-tone selection ring.** The ring color follows Keybard's theme, but the canvas follows the user's Background choice, so a plain `kb-select` ring fails 3:1 on some of them (dark-theme `#5cb8ec` on Light `#f5f5f1` 2.02:1, on Busy `#c8d1c8` 1.41:1; light-theme `#2b86bd` on the Busy stripe `#8a9c92` 1.38:1). The ring is therefore 2 px `kb-select` with a 1 px halo outside it in a color chosen by the Background: `#111214` on **Light** and **Busy**, `#ffffff` on **Dark**. The halo carries the 3:1: `#111214` on Light 17.2:1, on Busy 12.0:1, on the Busy stripe 6.5:1; white on Dark 12.9:1. The halo colors belong to `PREVIEW_BACKGROUNDS`, beside the background values.
  - **Recall target.** While a Recall card is unrevealed, the selection ring is not drawn on the Recall target, so it can't give the answer away; after **Reveal** the target shows the user's Layer change outline only. The Familiar-bindings selection is kept and returns when the card moves on.
- **Layout row:** **Layout** `ui/select` (options as today, renamed: **Live board · read-only**; the snapshot option, today "Loaded snapshot", named after where `originalKeyboard` came from; **Editor draft** with the suffix `· unsaved changes` in `text-amber-800 dark:text-amber-300` (the notice text color, 6.3:1 on `kb-gray`; `kb-pending` measures 4.48:1 there and is for borders only, §5.0.1) when the draft differs; **QWERTY example**; **Imported layout**).
  - The snapshot option's name: `originalKeyboard` is set on every load: a board connect, an opened `.svil`/`.vil` file, and the QWERTY demo ([kb] `KeyboardContext.tsx:319,368-370`). So the option reads **Connected board** only when `isConnected`; otherwise it reads the context's `loadedFrom` (the file name, or `QWERTY example (demo)`), falling back to **Loaded layout** when `loadedFrom` is null. A file opened with no board connected never reads "Connected board".
  - Beside the select, outline button **Import layout…** (lucide `Upload`, accepts `.svil,.vil,.viable,.json,.kbi` as today). Errors print under the row as `text-sm text-red-700 dark:text-red-400 role="alert"`: **Choose a Svalboard layout with a 10 × 6 matrix**, **Couldn't read this layout**.
- **Layers row** (not following): **Default layer** `ui/select` (items `0 · Base`, from `cosmetic.layer`) and **Preview** layer pills. Both set the preview only. While following, the row is hidden. The Host's own default layer for older firmware is the O2 Window row **Desktop default layer** (capability 5).
- No prose on the page. The previous notes ("Move the overlay with the handle…", "Select a key in the preview to mark…", "Try a simulated chord…", the install paragraphs) become row titles, button names and tooltips listed in §5.15–§5.16, or move to the manual.

### 5.15 O2 Overlay panel (detail panel content)

- **Frame:** the shared detail panel, title **Overlay**, opened from the Overlay nav item. Esc inside it closes it, after any open select, popover or hex edit has handled its own Esc (§4.1). Placement as §5.1 (push at ≥ 1100 px, overlay at 900–1099 px, docked in bottom-bar layout).
- **Tiles:** a row of four category tiles at the top ([kb] `SettingsPanel.tsx:185-198` idiom), each with a 16 px lucide icon: **Window** (`AppWindow`), **Appearance** (`Palette`), **Feedback** (`Zap`), **Recall** (`Brain`). Default tile **Appearance**, as today's default tab ([kb] `TrainerPage.tsx:34`). The tile choice is remembered for the session only.
- **Rows** use the setting-row idiom ([kb] `SettingsPanel.tsx:224-237`): title left, control right, optional value line under the title.
- **Host connected only** rows (Drag by keys, Position, Desktop default layer, Highlight held keys, Held keys) are **hidden**, not drawn disabled, while Host is not connected, as today ([kb] `TrainerPage.tsx:130-131` wrap them in `host.state && …`) and as §5.6's no-disabled-buttons rule requires. The Window tile then shows Hands, Size and Reset; the Feedback tile shows Layer-change highlight, Duration and Preview (M-30).
- **Footer** (as today's inspector footer, [kb] `TrainerPage.tsx:133`): `text-xs text-muted-foreground` **Saving…** with an 8 px `bg-kb-pending` dot while a Host write is pending or in flight; **Settings couldn't be saved** in `text-red-700 dark:text-red-400` when `localStorage` fails.

**Window.**

| Row | Control | Notes |
|---|---|---|
| Hands | SegmentedControl **Both · Left · Right** | `prefs.hands` |
| Size | slider 50–150 %, value `100 %` | `prefs.scale` |
| Drag by keys | OnOffToggle | Host connected only. Tooltip on the row title: "Move the overlay by its keys as well as by its handle". Today's note about clicks reaching the window underneath moves to the manual. |
| Position | outline button **Place at bottom** | Host connected only |
| Desktop default layer | `ui/select` of the board's layers (`0 · Base`), value line `Older firmware` | Host connected only, and only when Host reports `default === null` (older firmware), following or not. Writes Host config `manualDefault`, as today ([kb] `TrainerPage.tsx:131`). Moved here from the Feedback tab: it is a Host-wide setting, not part of the preview. |
| Reset | outline button **Reset appearance and view** (`RotateCcw`) | Resets to `DEFAULTS` ([kb] `core.ts:19`) and marks Host settings pending, as today |

**Appearance.**

| Row | Control |
|---|---|
| Preset | `ui/select` of `PRESETS` ([kb] `core.ts:10-17`); shows **Custom** (not selectable) when the colors match no preset |
| Key fill | Color field (N-15) + opacity slider 0–100 %, value `75 %` |
| Outline | Color field + opacity slider |
| Legend | Color field + opacity slider |
| Outline thickness | slider 0–4 px, step 0.5, value `1 px` |
| Legend halo | OnOffToggle |
| Layer change | Color field |
| Pressed key | Color field |

**Feedback.**

| Row | Control | Notes |
|---|---|---|
| Layer-change highlight | SegmentedControl **Off · Flash · Fade** | Labels for the stored values `Off`, `Quick flash`, `Short fade` ([kb] `core.ts:18`); the stored values don't change |
| Duration | slider 50–750 ms, step 25 | Hidden when the highlight is Off, rather than drawn disabled |
| Highlight held keys | OnOffToggle | Host connected only; writes Host config `highlightPressed`; while `host.busy` the footer shows Saving… |
| Held keys | value **Unavailable on this firmware** | Only when `host.state.matrixAvailable === false`; replaces today's note |
| Preview | outline button **Preview held keys** | Lights three keys for 800 ms with the Pressed key color, as today. Today's note "No key activity is being monitored" is dropped: the button's name says it is a preview. |

**Recall.**

| Row | Control | Notes |
|---|---|---|
| Recall | OnOffToggle | Today's "Recall practice" switch |
| Desktop legends | value **Hidden while recalling** | Only when following the board with Recall on, because then the desktop legends are hidden too ([kb] `TrainerPage.tsx:84-92`) |
| (card) | Recall card, shown when Recall is on and a binding exists | Floating card idiom (`bg-kb-surface rounded-2xl border p-4 text-center`): label **Find this binding** (`text-xs font-medium text-muted-foreground`), the binding in `text-[22px] font-semibold text-kb-ink`, the hand as a value (`Left hand`). Before reveal: ink pill **Reveal**. After reveal: ink pill **Remembered** and outline **Again**. Each state shows only the buttons that apply, instead of today's disabled ones. Last line `3 remembered · 5 attempts`. |
| **Familiar bindings** (group label) | | |
| Binding | `ui/select` of learnable keys (`Left · Q · 27`), placeholder **Select a key in the preview** | Also set by clicking a preview key |
| | outline **Mark familiar**, ghost **Clear** | **Mark familiar** shows only when a binding with a code is chosen |
| Hide familiar legends | OnOffToggle | |

Closing the panel or switching tiles never changes Recall; leaving the Overlay workspace returns the desktop overlay to reference mode, as today (the publish effect's cleanup, [kb] `TrainerPage.tsx:91`).

### 5.16 Overlay states

| State | Trigger ([kb]) | What shows |
|---|---|---|
| **Not connected, web** | `!host.state`, not Paranoid (`TrainerPage.tsx:110`) | Status pill **Keybard Host not connected**. In place of the Host card, the **Desktop overlay** well (empty/connect well idiom, `PictureInPicture2` icon, title **Desktop overlay**): brand green pill **Download for Windows** (`HOST_DOWNLOAD`, [kb] `HostInstall.tsx:8`); quiet pill **Connect to Keybard Host** (`PlugZap`) when the page isn't served by Host (`onConnect`, [kb] `TrainerPage.tsx:110`), with the tooltip "If the browser asks to let this site access apps on your device, allow it"; link row **Open local Keybard ↗** (`http://127.0.0.1:5178/`), **Release notes ↗** (`HOST_RELEASE`), **Install steps ↗** (the manual's Overlay chapter). The preview, Layout and Layers rows work as usual below it. |
| **Not connected, Paranoid** | `!host.state && PARANOID` | Status pill **Keybard Host not connected**. Well titled **Start Keybard Host in paranoid mode**, with the value chip `Start-Paranoid.cmd` and no actions. Paranoid never contacts Host across origins ([kb] `host.ts:38-39,90`), so there is no Connect button. |
| **Web · Connect pressed, Host not running** | Connect asked and bootstrap failed ([kb] `host.ts:84`: reported only when `asked.current`, which only `connect()` sets, `:90`). Only on the web origin: a Host-served page never offers Connect (`onConnect` is undefined when `host.local`, [kb] `TrainerPage.tsx:110`), and a Host-served page whose Host stops takes the **Connection lost** path instead. | Error notice **Can't reach Keybard Host at 127.0.0.1:5178** with quiet pill **Try again** (calls `connect`), and the browser-permission tooltip on that pill. The Desktop overlay well stays below it, because the page is still not connected. |
| **Connected, no board chosen** | `host.state.selectedDevice` null | Host card with the **Select a Svalboard** placeholder. The preview card shows the dashed empty-well idiom inside the canvas (`border-dashed border-1 border-gray-300 dark:border-neutral-600`, transparent face, title in the muted tone for that background), title **No board selected**, instead of today's "No physical keys in this layout." text ([kb] `OverlaySurface.tsx:8`). The preview footer's source reads `No board`, and the Layout select reads **Live board · read-only** with nothing to follow. |
| **Connected, board not valid** | `!host.state.valid` | Host's status text as the Board row value; preview as above |
| **Following the board** | `host.state && live` ([kb] `TrainerPage.tsx:28`) | Layout select reads **Live board · read-only**; Layers row hidden (older-firmware exception, §5.14); preview shows live layers and held keys from Host |
| **Connection lost or stale** | Poll failure or no data for 1.2 s after Host had answered ([kb] `host.ts:46,68`). Today both paths set `state` to null and leave only an error string, so the page can't tell this from "never connected", and `receive()` never clears the string ([kb] `host.ts:47-54`; only bootstrap, command and configure success clear it, `:81,94,104`). Revision 3's one host.ts change (§1.4): the watchdog and the poll `catch` set `lost = true` instead of writing `error`, and `receive()` sets `lost = false`. `lost` is false before the first snapshot, so a first connect never flashes it. | Status pill red dot **Keybard Host connection lost**; error notice **Keybard Host connection lost**. No Host card (there is no snapshot to fill it) and no Desktop overlay well (Host is installed; it stopped answering). Following stops, so the Layout select loses **Live board** and the preview shows the select's own source, as today ([kb] `TrainerPage.tsx:28-29`); the old copy "preview paused" was not true and is dropped. Polling continues ([kb] `host.ts:70`), so when Host answers `lost` clears, the notice goes and the Host card returns. |
| **Host command failed** | `host.error` from `command` or `configure` ([kb] `host.ts:95,105`), shown only while `host.state` is non-null | Error notice with Host's message, one line. It clears on the next successful command, which comes within a second while Overlay is open, because the Recall publish effect sends one every second ([kb] `TrainerPage.tsx:87-90`). |
| **Overlay hidden** | `host.state.visible` false | Host card's first button reads **Show overlay** (`Eye`) instead of **Hide overlay** (`EyeOff`) |
| **Host outdated** | `build.version` ≠ `HOST_RELEASE_TAG`, not `dev` ([kb] `HostInstall.tsx:13`) | Notice **Keybard Host vLaunch2.1 is available** with link pill **Download** (`HOST_RELEASE`) |
| **Import error** | `TrainerPage.tsx:103,105` | Error line under the Layout row |
| **Saving / not saved** | `hostDirty \|\| host.busy`, `storageError` ([kb] `TrainerPage.tsx:133`) | O2 footer (§5.15): **Saving…** with the pending dot, or **Settings couldn't be saved** in the error text color |
| **Host not connected, Window and Feedback tiles** | `!host.state` | The Host-connected-only rows are hidden, not disabled (§5.15) |
| **Recall on** | Recall toggle | O2 Recall card; with following, the Desktop legends row |
| **Narrow and bottom-bar** | §5.1 | Host card wraps (select full width first); preview card full width; the panel overlays below 1100 px or docks at the bottom |

**Copy changes** (every string is still a title, a value or a tooltip; none is a paragraph):

| Today | Revision 3 |
|---|---|
| "Trainer" (nav and header) | **Overlay** |
| "Use Trainer on your desktop" + three paragraphs ([kb] `HostInstall.tsx:23-29`) | **Desktop overlay** well (titles and buttons above); install steps in the manual |
| "Connected to Keybard Host … · Keybard …." ([kb] `HostInstall.tsx:16`) | status pill + `Keybard Host vLaunch2.1 · Keybard 61db58a` |
| "Practice" tab | **Recall** tile |
| "Overlay" tab | **Window** tile |
| "Self-assessed practice. Nothing is recorded from your typing. …" | dropped (the Recall title, the Desktop legends row and the manual carry it) |
| "Move the overlay with the handle above its corner. …" | tooltip on **Drag by keys** |
| "Select a key in the preview to mark its current binding familiar." | the Binding select's placeholder |
| "Try a simulated chord. No key activity is being monitored." | **Preview held keys** button |
| "Matrix reads are unavailable on this firmware." | Held keys row value |
| "Import for trainer" | **Import layout…** |
| "Host connection lost. The preview is paused." ([kb] `host.ts:68`) | **Keybard Host connection lost** (now from `host.lost`; the preview is not paused, it shows the Layout select's source) |
| "Could not reach Keybard Host at … then try again." ([kb] `host.ts:84`) | **Can't reach Keybard Host at 127.0.0.1:5178** + Try again + tooltip |
| HostInstall's "select **Trainer**" ([kb] `HostInstall.tsx:28`) | manual: "select **Overlay**" |

### 5.17 E1 Editor color roles (D13)

The color roles apply to the whole app. This section lists every place in [kb] `src/` that uses red (or an ad-hoc blue or amber) for something other than an error, a destructive action or a wrong key, found by searching `src/**/*.tsx` and `*.ts` for `red-`, `kb-red`, `(bg|border|ring|text|outline)-(blue|sky|amber|yellow|orange)-` and every `selected=` / `hasPendingChange=` caller (the first revision-3 draft searched only `ring-blue` for blue and missed rows, which the revision-3 review added).

| Where ([kb]) | Today | Revision 3 |
|---|---|---|
| `src/components/Key.tsx:139-140` selected and drag-hover | `bg-red-500 text-white … ring-2 ring-red-500 ring-offset-1` | Selected look (§5.0.1): `bg-kb-select-tint text-kb-ink ring-2 ring-kb-select ring-offset-1 ring-offset-background`, strips `bg-kb-select-strip text-kb-ink` |
| `Key.tsx:146` default hover | `hover:border-red-500 hover:ring-2 hover:ring-inset hover:ring-red-500` | `hover:z-10 hover:ring-2 hover:ring-kb-select hover:ring-offset-1 hover:ring-offset-background` (outside the key; §5.0.1 "Rings, offsets and key gaps") |
| `Key.tsx:151` pending | `border-2 border-red-500`, hidden when selected | `border-2 border-dashed border-kb-pending`, also when selected |
| Callers of `selected`: `Keyboard.tsx:846` (editor, including drop-target highlight `:808`), `MatrixTester.tsx:177`, `LayerPreviewModal.tsx:159` (always `false`), `pages/ProofSheet/KeyProofRow.tsx:57,80,103`, `KeyProofSection.tsx:62`, `ProofSheetPage.tsx:158`, `BindingEditor/AltRepeatEditor.tsx:104,120`, `ComboEditor.tsx:125`, `LeaderEditor.tsx:136,189`, `MacroEditorKey.tsx:28`, `OverrideEditor.tsx:158`, `TapdanceEditor.tsx:161,196`, `BindingEditor/EditorKey.tsx:137` | red via Key.tsx | follow Key.tsx; no caller change |
| Callers of `hasPendingChange`: `Keyboard.tsx:863,972`, `pages/ProofSheet/KeyProofRow.tsx:58,81,104`, `KeyProofSection.tsx:63`, `ProofSheetPage.tsx:159` | red via Key.tsx | follow Key.tsx; no caller change. The ProofSheet page exists to show these key states through its **Selected** and **Pending** toggles ([kb] `ProofSheetPage.tsx:25-26,110-119`), so it is MC's before/after check (§12 MC). |
| `MatrixTester.tsx:177-178` held | `selected` (red); "was pressed" = black face, never = white | Strong select (§5.0.1): `bg-kb-select-strong` face with a 3 px `kb-select` ring and offset, passed as a new `selectedStrong` prop (or `className`) instead of `selected`; black and white faces unchanged, black gains `dark:border-kb-gray-border` |
| `layout/KeyboardViewInstance.tsx:464,468` layer-pill drop target | `bg-red-500 text-white … ring-2 ring-red-500`, `hover:bg-red-500` | `bg-kb-select-tint text-kb-ink ring-2 ring-kb-select ring-offset-1 ring-offset-background` |
| `layout/LayerSelector.tsx:483,487,491` Apply/Save with pending edits (manual updates) | `ring-[3px] ring-red-500`; hover and active `bg-red-500` | `outline-2 outline-dashed outline-kb-pending outline-offset-2`; hover `bg-kb-active/80`; no red, because sending edits is not destructive |
| `SecondarySidebar/components/BindingEditor/EditorKey.tsx:68-77` selected slot and drag hover | `border-2 border-red-600`; drag hover `bg-red-500 … ring-red-500`, header `bg-red-600` | selected `border-2 border-kb-select bg-kb-select-tint`; drag hover the selected look, header `bg-kb-select-strip text-kb-ink` |
| `SecondarySidebar/components/EditorKey.tsx:15-20` palette key hover, selected, drag hover | `hover:border-red-600`, `!bg-red-600 border-red-600 text-white`, `!border-red-500 !bg-red-50 dark:!bg-red-950/40` | `hover:border-kb-select`, `!bg-kb-select-tint border-2 border-kb-select text-kb-ink`, `!border-kb-select !bg-kb-select-tint` |
| `SecondarySidebar/components/BindingsList.tsx:102` bindable item hover | `hover:border-red-600` | `hover:border-kb-select` |
| `components/DragOverlay.tsx:71` dragged key | `border-red-600` | `border-kb-select` |
| `Panels/LeadersPanel.tsx:186`, `Panels/AltRepeatPanel.tsx:121` selected row | `ring-2 ring-blue-500` (already blue) | `ring-2 ring-kb-select` (same meaning, now a themed token) |
| `layout/EditorLayout.tsx:1225` layer being dragged over the canvas | `ring-4 ring-inset ring-blue-400 ring-opacity-50` | `ring-4 ring-inset ring-kb-select/50` |
| `Panels/BoardIdentitySection.tsx:107` unsaved board name | `border-amber-500` (already amber) | `border-kb-pending` |
| `Panels/LayoutsPanel.tsx:299-302` file drop target ("Drop .svil file to import") | `bg-blue-500/10 border-2 border-dashed border-blue-500`; `Upload` icon `text-blue-500`, text `text-blue-700 dark:text-blue-300` | Drop target = select role, and a dashed border now means pending, so: `bg-kb-select-tint/40 border-2 border-solid border-kb-select`; icon and text `text-kb-ink` |
| `components/LayoutGroupCard.tsx:94` **Active** badge | `bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200` | Neutral chip, the path-chip look `bg-kb-gray-medium text-kb-ink` (DECISION). "Active" is a status, not a selection; blue would now read as "selected". |
| `Panels/FragmentsPanel.tsx:270,338,403` fragment status text | `Locked: …` in `text-amber-600 dark:text-amber-400`, `Detected: …` in `text-blue-600 dark:text-blue-400` | Stays, with a note: informational status text, not a key state. Not changed in MC; candidates for `text-muted-foreground` in a later cleanup. |
| `Panels/ScanLabPanel.tsx:549` pacing changed, not yet applied | `text-amber-700 dark:text-amber-400` | Stays `text-amber-*`: it is pending **text**, and the notice text color is the text form of the pending role (§5.0.1). Developer-only panel. |
| `Panels/LayoutsPanel.tsx:247` search focus ring, `:360` "Clear search" link; `components/LayerRow.tsx:218` search-match highlight | `focus:ring-blue-500/20`; `text-blue-600 dark:text-blue-400`; `bg-yellow-200 dark:bg-yellow-800` | Stay: focus, link and search-match colors, none of them a key state |
| `constants/pending-change-styles.ts:6-36` | red pending styles; **no importer** in `src/` | Deleted (dead code) |

**Red stays** (destructive or error, verified by reading each): delete and trash hovers `components/LayerRow.tsx:349,470`, `LayoutCard.tsx:172,263`, `LayoutGroupCard.tsx:106`, `BindingEditorContainer.tsx:527`, `SidebarItemRow.tsx:297`, `BindingEditor/EditorKey.tsx:162`, `MacroEditorText.tsx:56`; destructive confirm buttons `LayerRow.tsx:538`, `LayoutGroupCard.tsx:156`, `BindingEditorContainer.tsx:558`; error boxes and lines `LayoutsPanel.tsx:286`, `ExploreLayoutsPage.tsx:165`, `EditingTargetStatus.tsx:33`, `ConnectKeyboard.tsx:232`, `FirmwareUpdate.tsx:88`, `ScanLabPanel.tsx:385,403,485,668` and every `text-red-*` error line. The **red layer color** (`utils/colors.ts:9,28`) is user data and stays: a layer the user colors red still has red faces.

**Theme guard.** `tests/theme/no-hardcoded-chrome-colors.test.ts` gains a rule **red-reserved**. Unlike the existing rules it scans every file under `src/`, including the `ALLOWED_FILES` entries (`src/components/ui`, `src/pages/ProofSheet`, ScanLab), which `scanRepo()` skips today ([kb] `no-hardcoded-chrome-colors.test.ts`, `if (isAllowedFile(rel)) continue;`); `ui/button.tsx`'s destructive variant uses the `destructive` token, not a red utility, so it needs no entry. The rule: a `(bg|ring|border|outline)-red-N` or `…-kb-red` utility (any variant) in a `.tsx` literal is a finding unless its file and literal are listed in a new `RED_ALLOWED` section of `tests/theme/allowlist.ts`, each entry with a reason (`destructive`, `error`, `wrong-key`). The list starts with the "Red stays" entries above plus Practice's wrong-key border and badge and its error tint. Self-tests cover a selected-key literal (flagged) and a trash-hover literal (allowed). The existing rules are unchanged, and the new tokens are `kb-*` utilities, so they need no allowlisting.

**Before/after mockups** (Appendix A): the editor with one selected key, one pending key, one selected-and-pending key, a hovered key and the Apply button waiting (M-35); Matrix Tester (M-36); the binding editor slot, palette key, drag overlay, bindings-list hover and the Layouts panel drop target (M-37); light and dark for each.

---

## 6. Learning model

### 6.1 Unit of learning (DECISION D3)

The learning unit is the **character** (Unicode code point), as in keybr ([up] `packages/keybr-textinput/lib/histogram.ts:11-38`, `packages/keybr-result/lib/keystats.ts:131-155`, `packages/keybr-lesson/lib/key.ts:104-109`).

Each character `c` has one or more **paths** from the keymap resolver (§9.4): a **primary** path (lowest cost) and any **alternatives** (a duplicated character, Space on two thumbs, `!` through `MO(1)` or `LT1`). Each path has a **path key** `"<layer>:<target>:<shift>"`, where `<target>` is the matrix index of the key that emits the character (M3 combos: the sorted indices joined with `+`, for example `0:14+20:n`), and shift ∈ `n` (none), `f` (firmware modmask), `u` (user Shift).

**The path key names the target key only (DECISION).** Prerequisites (which thumb holds the layer, which key gives Shift) are not part of it. Moving `MO(1)` to another thumb therefore does not restart `!`; the change shows up in the layer-key stats (Thumbs, layer reach) instead. Restarting every layer-1 character because the layer key moved would throw away what the target finger learned.

**Why character rather than physical key:**

1. The text generators produce characters, so the phonetic model only works on characters.
2. On a Svalboard keymap a character almost always maps to one key on one layer. So character stats already are key-plus-layer stats.
3. Physical, finger, direction and layer stats are **aggregations** over per-keystroke attributions (§8.2). That gives the physical view without forking keybr's engine.

**Remap handling.** Stored histograms are kept per (character, path key) (§8.3). `KeyStats` for `c` is built from the samples whose path key is **any current path of `c`**, primary or alternative. So:

- remapping `e` to another key restarts `e` alone (no current path matches its old samples); it shows as uncalibrated, and old samples stay in history;
- adding a duplicate key, or a cost change that swaps primary and alternative, restarts nothing, because the old path is still a current path;
- a live sample through an alternative key (Space on the other thumb) counts towards `c`. It is not dropped.

In Keymap-only mode every sample is recorded against the primary path, because the alternative used can't be observed.

This replaces keybr's partition of history by layout family ([up] `packages/keybr-lesson/lib/lesson.ts:32-36`, `packages/keybr-result/lib/group.ts:38-40`); the vendored `Lesson.filter` is overridden (§9.2).

### 6.2 Alphabet

- **Guided and Words:** the alphabet is the language model's letters ∩ characters with at least one resolvable path. This is the same rule as keybr's `PhoneticModel.restrict(model, keyboard.getCodePoints())` ([up] `packages/keybr-lesson/lib/lesson.ts:28-29`), with `getCodePoints()` supplied by the Svalboard `Keyboard` adapter (§9.5).
- **Drill:** the alphabet is the set of characters whose primary path falls in the selected scope:
  - layer;
  - group (Letters = language letters; Numbers = `0-9`; Symbols = printable ASCII punctuation; Weakest = the 8 lowest-confidence calibrated characters, filled up to 8 with uncalibrated characters in unlock order (§6.3) when fewer than 8 are calibrated);
  - directions;
  - hands;
  - thumbs (On: characters whose target is a thumb key are included; Off: excluded. Thumb prerequisites are always allowed).
- **Minimum scope:** at least 3 distinct characters, the minimum for a valid result (§6.9). A smaller scope shows "Nothing to drill" (§5.3).

### 6.3 Unlock order (DECISION D5)

keybr's guided unlock loop runs unchanged ([up] `packages/keybr-lesson/lib/guided.ts:84-105`):

- the first 6 letters are included;
- `alphabetSize` forces more;
- any key that ever reached confidence 1 stays included;
- one new letter is added only when every included key has a best confidence of at least 1;
- the weakest included key is focused.

Only the **order** changes. With Start order = **Center first**, Practice turns on keybr's `keyboardOrder` ([up] `guided.ts:130-139` → `Letter.weightedFrequencyOrder`) and supplies Svalboard weights through the adapter's `getCodePoints()` ([up] `packages/keybr-keyboard/lib/keyboard.ts:106-128`, where keybr only knows home = 1, top = 2, else 1000):

| Tier (weight) | Primary path |
|---|---|
| 1 | Base layer, finger **C** |
| 2 | Base layer, finger **N** or **S** |
| 3 | Base layer, finger **E** or **W** |
| 4 | Base layer, **2S** |
| 5 | Base layer, thumb |
| 10 + 10·(prerequisites) | Any path needing a layer hold or user Shift |

Within a tier, letters follow language frequency.

**Worked example (default keymap, English, Center first).** The data comes from [kb] `src/default-layouts/sval-default.svil` layer 0. The frequency order within tiers is UNVERIFIED and depends on `model-en.data`.

| Tier | Letters |
|---|---|
| 1 (center) | a s d f j k l (initial 6 ≈ a s d l f k; **j is the 7th unlock**) |
| 2 (N: r e w q / u i o p; S: v c x z / m) | e o i r u c m w p v x q z (**e is the 8th unlock**, the first letter off the center keys) |
| 3 (E/W: g t b / h y n) | t n h y g b |

keybr sorts by weight before frequency (`weight(a) - weight(b) || b.f - a.f`, [up] `packages/keybr-phonetic-model/lib/letter.ts:131-138`), so no tier-2 letter can unlock before every tier-1 letter. The mockups' sample state (Appendix A.1) follows this order.

**Trade-off:** t, n and h are frequent letters but unlock late. Frequency order (keybr's default, `keyboardOrder` off, [up] `settings.ts:17`) starts with e n i a r l with keybr's English model (measured in M1a; an earlier draft guessed e t a o i n), which mixes all directions from lesson 1. Q1 asks the owner to choose the default for new profiles. M1a confirmed the Center-first worked example above on `sval-default.svil`: the initial six are a d f k l s, the 7th unlock is j, the 8th e, then the rest of tier 2, then the E/W letters t n h y g b in frequency order (`tests/practice/lessons/guided.test.ts`).

### 6.4 Target speed and confidence

- Target speed comes from settings. keybr's default is 175 CPM = 35 WPM ([up] `packages/keybr-lesson/lib/settings.ts:60`). Start presets override it (§5.4).
- `confidence = speedToTime(target) / timeToType` ([up] `packages/keybr-lesson/lib/target.ts:1-24`).
- `timeToType` is the exponentially filtered (α = 0.1) per-lesson mean ([up] `packages/keybr-math/lib/filter.ts:11-28`; `keystats.ts:106-155`).
- These formulas are unchanged.

### 6.5 Timing (DECISION D6)

For each expected character step:

```
t_step(c)  = t_input(c)                                  // DOM event.timeStamp, ms
             (live, tap-hold or tap-dance target: the target's press edge instead; see below)
raw        = t_step(c) − t_step(previous step)
presses    = 1 + newPrereqs(c)
timeToType(c) = raw / presses
```

**`newPrereqs(c)` counts only prerequisite presses made for this character:**

- **Live · USB:** the number of prerequisite press edges (layer hold, OSL, user Shift) observed in the interval `(t_step(previous), t_step(c)]`. A layer key or Shift held down through several characters counts once, on the first of them.
- **Keymap only:** the prerequisites of `c`'s primary path that are **not** prerequisites of the previous step's path. A run of layer-1 digits (all on `MO(1)` in the default keymap) counts the hold once; `THE` typed as capitals counts user Shift once.
- Firmware modmask Shift (`KC_EXLM`) is never a press.

This matches keybr's intent: keybr counts Shift/Alt/AltGraph/Dead **keydowns since the previous character**, clearing the set on each measure and ignoring key repeats ([up] `packages/keybr-textinput-events/lib/timetotype.ts:52-84`; `inputhandler.ts:97-100`). Practice keeps the "since the previous character" rule but counts physical presses instead of OS-visible modifiers.

- The replacement is an adapted copy of `TimeToType` (§9.2). The DOM still timestamps characters, except for the live tap-hold case below.
- **Delayed-output keys.** The tap side of an `LT`/`MT` key, and a key reached under a still-undecided `LT`/`MT` hold, emit on **release** (permissive hold, §6.7), and a tap-dance tap emits only after the tapping term (200 ms in `sval-default.svil` `tap_dance`). Policy:
  - **Live:** `t_step` is the target's **press edge**, not the DOM input time, for every step whose emission the correlator matched to a release or a delayed press (§9.3). Both ends of `raw` use edge times when available, so the delay doesn't leak into the next character either.
  - **Keymap only:** the bias is **accepted**, not corrected. These characters get the chip **Delayed output** in P5 (§5.7), so a slower reading on them is explained. A fixed correction would need the board's tapping term, which Keybard doesn't read today (§10).
- **Gaps:** steps with `raw > 2000 ms` are dropped from the histogram (pause), and the gap is removed from the lesson clock. keybr's `makeStats` computes lesson time as last step − first step ([up] `packages/keybr-textinput/lib/stats.ts:13-18`), so the vendored `makeStats` is patched to subtract dropped gaps and paused intervals (§9.2). Without the patch, a lesson resumed after the 10-minute pause window (§4.4) would report its whole wall-clock time.
- **Live-only sub-timings** are stored on the keystroke event (§8.2), not used for confidence:
  - `reach`: time from the previous step to the first new prerequisite's press edge (layer-reach time);
  - `target`: time from the last new prerequisite edge (or the previous step) to the target's press edge.
- Physical key stats (`k` in §8.3) use `target` when live, and `timeToType` otherwise.

### 6.6 Errors

- keybr's typo handling is kept: `stopOnError` and `forgiveErrors` default on; a miss is counted against the **expected** character ([up] `packages/keybr-textinput/lib/textinput.ts:160-200`, `settings.ts:40-42`).
- **Classification** (stored per miss). These six names are used everywhere (§3.1, P5, §8.2):

  | Class | Rule (live: pressed key observed; otherwise: typed character reverse-resolved to its primary path) |
  |---|---|
  | `wrong-layer` | Same matrix index as the expected path, different layer |
  | `wrong-direction` | Same finger cluster (row), different col |
  | `wrong-finger` | Different row, same hand |
  | `wrong-hand` | Other hand |
  | `wrong-shift` | Same key and layer, case or shift mismatch |
  | `unknown` | Typed character has no path |

  Worked example on the default keymap, expected `!` (layer 1, index 27, L-pinky N): typing `q` (layer 0, index 27) is `wrong-layer`; `1` (layer 1, index 26, L-pinky C) is `wrong-direction`; `@` (layer 1, index 21, L-ring N) is `wrong-finger`.
- **Stray presses** (live) are **character-producing** press edges that no step accounts for:
  - Edges the correlator uses for a step, as its target or as a prerequisite, are consumed.
  - Presses of keys that never produce a character are excluded: modifiers, layer keys (`MO`, `LT` hold side, `OSL`, `TG`/`TO`/`DF`/`TT`), Backspace and other edit or navigation keys.
  - A remaining press edge whose key, under the effective layer at that edge (§9.3), resolves to a character is a stray when no step in `(t_prev, t_next)` (the steps before and after it) matched it.
  - Strays are recorded against the **pressed** key's `stray` counter, so the heatmap's Errors metric can show "keys you hit by mistake" as well as "keys you missed". Capitals, symbols and corrections therefore never mark the thumbs as error spots.

### 6.7 Multi-step characters

Example: `!` on the default keymap.

- **Path:** hold **R-thumb T5** `MO(1)` (primary), or **L-thumb T1** `LT1(KC_ENTER)` held (alternative), then press **L-pinky N** on layer 1, where the keycode is `KC_EXLM` (firmware Shift).
- **Presses:** 2 when the hold is new; 1 when the hold was already down for the previous character (§6.5).
- **Tap-hold timing on Svalboard.** Svalboard firmware enables permissive hold and chordal hold by default ([qmk] `keyboards/svalboard/config.h:158-159`, `SVAL_DEFAULT_PERMISSIVE_HOLD 1`, `SVAL_DEFAULT_CHORDAL_HOLD 1`; `:196` `#define PERMISSIVE_HOLD`), and thumbs are `'*'` in the chordal-hold layout ([qmk] `keyboards/svalboard/svalboard.c:563-575`), so an LT thumb plus any finger key can resolve as a hold. With permissive hold, a key pressed while an `LT`/`MT` key is still undecided is buffered until that key's decision: when the other key is released (hold), when the LT key is released (tap), or at the tapping term. So `!` through `LT1` types on the **release** of L-pinky N, often more than 60 ms after its press. `MO(1)` has no decision to make and types on the press. These settings are runtime-configurable ([qmk] `modules/svalboard/core/sval_qmk_settings.c:64,79-84`), so the correlator must not assume them (§9.3).
- **Live:**
  - the sampler sees the T5 press edge at t₁ and the L-pinky N press edge at t₂;
  - `reach = t₁ − t_step(prev)`;
  - `target = t₂ − t₁`;
  - the layer-key stats (Thumbs section) collect `reach`;
  - observed `path_used` tells which of the two layer keys was used.
- **Hints:** the board shows T5 and T1 with a step badge `1` (their own `MO` / `LT1` headers stay visible) and L-pinky N with a step badge `2` and the legend `!` on an orange face. The primary path's prerequisite gets the ink ring; the alternative gets the dashed outline (§5.2).
- **Resolver cost:** an `LT` hold costs more than an `MO` hold (§9.4), because it can delay output and can misfire as a tap.
- **Capitals:** `A` is a separate code point, with path = user Shift (left thumb T5 `KC_LSHIFT`) + left pinky C. keybr only tracks lowercase letters as `LessonKeys` (capitals via `mangledWords`, [up] `guided.ts:111-123`). Practice keeps that, and Shift thumb stats come from live data.
- **Mod-tap and layer-tap tap sides** (for example `LT1(KC_ENTER)` tap = Enter, `LGUI_T(KC_TAB)` tap = Tab) emit on **release**. The correlator matches them to release edges (§9.3).

### 6.8 Progress seeding

- keybr replays all stored results on every load ([up] `packages/page-practice/lib/practice/state/progress.ts:52-96`).
- Practice keeps replay as the source of truth, but writes a per-profile **stats snapshot** after each lesson (§8.1 `snapshots` store).
- On load, Practice uses the snapshot only if **all three** match: `snapshot.resultCount === count(results)`, `snapshot.engineVersion`, and `snapshot.keymapFingerprint` equals the current keymap fingerprint (§9.4). Otherwise it replays (`seedAsync`, chunks of 100). Per-character stats depend on the current paths (§6.1), so a remap with no new result yet must not load the old snapshot.

### 6.9 Other keybr behavior kept as-is

- Daily goal ([up] `dailygoal.ts`).
- Streaks and summary ([up] `packages/keybr-result`).
- Learning-rate forecast ([up] `learningrate.ts`).
- Result validity: length ≥ 10, time ≥ 1 s, at least 3 distinct characters ([up] `result.ts:13-20,70-85`; `histogram.ts:40-50`).
- `recoverResults` ([up] `recover.ts`).

---

## 7. Content

### 7.1 Words and phonetic model (English, v1)

- **Phonetic model:** `model-en.data` (47,054 B; ≈ 25 KB gzip, `research/keybr-engine.md` §5).
  - Vendored as an asset under `practice/content/assets/`.
  - Loaded by a rewritten loader of about 20 lines that replaces `keybr-phonetic-model-loader` ([up] `packages/keybr-phonetic-model-loader/lib/loader.ts:10-20`).
  - Decoding needs `keybr-binary`: `TransitionTable` reads the file with its `Reader` ([up] `packages/keybr-phonetic-model/lib/transitiontable.ts:1,19`), and it also imports `Ngram1`/`Ngram2` from `keybr-keyboard`'s `ngram.ts` (`:2`). Both are vendored (§9.2).
- **Dictionary:** `words-en.json` (128,321 B; ≈ 39 KB gzip) via dynamic `import()`.
- **Blacklist:** EN only. keybr imports every language's blacklist statically ([up] `packages/keybr-phonetic-model/lib/blacklist/blacklist.ts:2-4`); the vendored copy is patched to EN.
- **Generation** is keybr's, unchanged ([up] `guided.ts:111-151`, `phoneticmodel.ts:55-140`, `fragment.ts:5-23`):
  - natural words when at least 15 exist for the filter;
  - otherwise phonetic pseudo-words;
  - every word contains the focused key.

### 7.2 Languages

- v1 bundles English only. The language select is hidden while only one language is bundled.
- Adding a language means bundling its `model-<lang>.data` and `words-<lang>.json` (sizes up to 745 KB for `vi`, `research/keybr-engine.md` §5).
- **Language** (which words) is independent of Keybard's **OS layout** (`internationalLayout`, which decides what character a keycode types). The resolver uses the latter.

### 7.3 Numbers and symbols

- **Numbers** (Drill → Group = Numbers; there is no separate Numbers lesson type): with **Benford** on, keybr's number generator ([up] `packages/keybr-lesson/lib/numbers.ts:20-32`), restricted to digits that have paths; with it off, digit tokens drilled adaptively like symbols. Both use the digits in scope as the adaptive alphabet.
- **Symbols** (new generator, `content/symbols.ts`, about 150 LOC):
  - Tokens are formed from short words of the current letter alphabet plus templates.
  - A template is eligible only if all its symbols are in the drill alphabet.
  - When a focused symbol exists, every token must contain it (mirrors keybr's `Filter` focus rule, [up] `packages/keybr-phonetic-model/lib/filter.ts:8-34`).
  - Templates may nest one level (for example `(#w)`, `#w!`, `#w * #w`), so a focused symbol with a single template (`#` has only `#w` without digits) still mixes with the other symbols in scope. M-21 shows this with focus `#`.
  - Template set:

    | Template | Symbols |
    |---|---|
    | `(w)` `[w]` `{w}` `<w>` | paired brackets |
    | `"w"` `'w'` `` `w` `` | paired quotes |
    | `w,` `w.` `w;` `w:` `w!` `w?` | suffix |
    | `w = w` `w + w` `w - w` `w * w` `w / w` `w % w` `w & w` `w \| w` `w ^ w` | infix |
    | `#w` `@w` `$w` `~/w` | prefix |
    | `w_w` `w-w` `w/w` `w\w` | joiners |
    | `w->w` `w=>w` `w::w` `w != w` `w <= w` | multi-char operators |
    | `12%` `$40` `#3` | with digits, when digits are in the alphabet |

- **Code mode** (keybr grammars) is out of scope for v1 (N5).

### 7.4 Custom text

- keybr `customtext.ts` semantics: ≤ 10,000 characters; Lowercase, Letters only and Randomize options ([up] `packages/keybr-lesson/lib/customtext.ts:22-32`).
- Characters without a path are listed in P6 and stripped. Space, newline and tab have paths through the resolver's whitespace table (§9.4), so they are never stripped when the keymap has Space, Enter and Tab keys.

### 7.5 Bundling and Paranoid

- **Normal builds:** all engine and content code is in `React.lazy` chunks loaded when Practice or Progress first opens. Assets come from Vite `?url` (model) and `import()` (JSON).
- **Paranoid:**
  - fetch is limited to `'self' data: blob:` and Workers are banned ([kb] `build/paranoid.ts:37-53`);
  - the build fails on external references ([kb] `build/paranoid.ts:58-129`).
  - Content is therefore compiled in through a virtual module `virtual:practice-content` (a Practice name, §9.1 Storage names; "trainer" now names the Overlay feature's directory), using the existing pattern of `virtual:bundled-layers` and `virtual:paranoid-fonts` ([kb] `build/paranoid.ts:12-34`, consumer [kb] `src/services/layer-library.service.ts:2,35`). M1b adds its type declaration to `src/vite-env.d.ts` beside theirs.
  - The module exports the model as base64 and the word list as JSON in Paranoid, and `null` otherwise. In that case the loader uses the `?url`/`import()` path.
  - The engine runs on the main thread in every build (no Workers).

---

## 8. Data model and persistence

### 8.1 Stores

- **IndexedDB** database name: `${VITE_STORAGE_NAMESPACE ? ns + ':' : ''}keybard-practice`. This mirrors `scopedStorage` ([kb] `src/utils/app-storage.ts:1-15`) so github.io previews don't share data.
- Version 1:

| Store | Key | Indexes | Value |
|---|---|---|---|
| `profiles` | `id` | — | `{ schema: 1, id, name, createdAt, lastUsedAt, language: 'en', startDone: boolean }` |
| `results` | auto-increment | `profileId`, `[profileId, ts]` | `ResultRecord` (§8.3) |
| `events` | `resultId` | `profileId` | `{ schema: 1, resultId, profileId, layout: 1, packed: ArrayBuffer }` (§8.2) |
| `snapshots` | `profileId` | — | `{ schema: 1, engineVersion, resultCount, keymapFingerprint, keyStats: [...], updatedAt }` (§6.8) |

**Profiles (DECISION, pending Q6).** Practice starts with **one local profile**, named "Me", and every lesson goes to the **active** profile. The Progress panel's Profile select (G2, §5.9) lists profiles and offers **New profile…** (for a second person on the same computer).

Profiles do not follow the board. The first draft keyed profiles on board identity, but Keybard's identity data can't support that:

- every `.svil` carries a `uid` (the example's is `5199957870438586395`, [kb] `src/default-layouts/sval-default.svil`), so files and the QWERTY example would never get their own profiles;
- that uid is `SVALBOARD_VIAL_UID` ([kb] `src/constants/svalboard-vial.ts:5-6`, "Svalboard QMK reports the same UID"), so every Svalboard without a persistent serial would share one profile;
- a file stores `kbid` as a decimal string ([kb] `src/services/file.service.ts:762`) and a connected board as hex ([kb] `src/services/keyboard.service.ts:254-257`), so one board would get two profiles ([kb] `src/contexts/BackupContext.tsx:37-40` uppercases but does not convert);
- a profile keyed on a keymap hash would restart everything on every remap.

None of this matters once stats are keyed by path (§6.1). Several keymaps in one profile coexist: each character's stats come from samples on its current paths, and switching back to an earlier keymap brings its stats back. So no board, file or example decides the profile; the user does.

**Board identity is still recorded** on every result as `x.board`, for filtering and display in History. It is normalized as follows:

| Load source | `x.board` |
|---|---|
| Connected, persistent serial | `sval:<serial>` (from `boardKeyFor`, [kb] `BackupContext.tsx:37-40`) |
| Connected, no serial | `uid:<HEX>`, marked "model UID" (shared by every board reporting it; whether Svalboard UIDs are per unit is UNVERIFIED) |
| Loaded file | `uid:<HEX>`, with the file's decimal `uid` converted to the same 16-digit upper-case hex as a connected board |
| QWERTY example | `example` |
| Host board (M5) | as a connected board, from the Host snapshot |

Moving history to a replacement board needs no action, because history is not tied to a board.

**Settings** are global, not per profile. They go in `appStorage` key `keybard.practice.v1` as a JSON object, parsed by a validating function in the style of `preferences()` ([kb] `src/features/trainer/core.ts:21-39`), which falls back per field. This is separate from Overlay's `keybard.trainer.v1` (which uses raw `localStorage`, [kb] `TrainerPage.tsx:18,46`); the two features share no settings (N1). Custom text is stored here. **Daily goal progress and Today** are per profile, because they come from the profile's results. Start (P2) runs once per profile (`startDone`); its presets write the global settings.

### 8.2 Per-keystroke event schema

In memory:

```ts
interface KeystrokeEvent {
  t: number;                 // ms since lesson start (DOM event.timeStamp clock)
  expected: number;          // code point
  typed: number | null;      // code point from InputEvent.data; null for backspace
  kind: 'hit' | 'miss' | 'backspace' | 'stray';
  raw: number;               // ms since previous step (0 for first)
  ttt: number | null;        // normalized timeToType (§6.5); null if dropped (>2000 ms)
  path: string;              // path key used ("1:27:f")
  prereq: number[];          // matrix indices of new prerequisites (§6.5), at most 2
  phys: {                    // physical attribution
    index: number;           // matrix index (row*cols+col), -1 if none
    layer: number;           // effective layer, -1 if unknown
    confidence: 'observed' | 'inferred';
    skew: number | null;     // ms between matched edge and input event (live)
    reach: number | null;    // §6.5, live
    target: number | null;   // §6.5, live
  };
  errorClass?: 'wrong-layer' | 'wrong-direction' | 'wrong-finger' | 'wrong-hand' | 'wrong-shift' | 'unknown';
}
```

**Persisted layout 1:** an `Int32Array` of **5 words (20 B) per event**. `raw` and `ttt` are not stored: `raw` is the difference of consecutive `t`, and `ttt` follows from `raw`, the prerequisite count and the 2,000 ms rule. `layer`, `index` and `shift` all describe the key **pressed**, so a hit's `path` is rebuilt from them. A miss's expected path is not stored (it is a different key); a miss unpacks with `path` "" and its pressed key, shift included, in `phys`, and the expected path re-resolves from `expected` under the result's keymap fingerprint (`x.km`).

| Word | Bits (from bit 0) | Field |
|---|---|---|
| w0 | 0–31 | `t` × 10 (0.1 ms resolution, unsigned; up to about 119 hours) |
| w1 | 0–20 | `expected` code point |
| | 21–22 | `kind` (0 hit, 1 miss, 2 backspace, 3 stray) |
| | 23 | `confidence` (0 inferred, 1 observed) |
| | 24–26 | `errorClass` (0 none, 1–6 in §6.6 order) |
| | 27–28 | shift of the **pressed** key (0 `n`, 1 `f`, 2 `u`, 3 unknown): a hit's path shift; a miss's or stray's `phys.shift` |
| | 29–30 | prerequisite count (0–2) |
| | 31 | delayed output (§6.5) |
| w2 | 0–20 | `typed` code point (`0x1FFFFF` = null) |
| | 21–25 | `layer` (31 = unknown) |
| | 26–31 | reserved (layout 2: combo flag and target count, M3) |
| w3 | 0–6 | `index` (127 = none) |
| | 7–13 | `prereq[0]` (127 = none) |
| | 14–20 | `prereq[1]` (127 = none) |
| | 21–31 | `skew` in ms, signed 11-bit, clamped to ±1023 (−1024 = null) |
| w4 | 0–15 | `reach` in ms, clamped to 65,534 (65,535 = null) |
| | 16–31 | `target` in ms, same encoding |

- **Size:** a 150-character lesson has about 165 events once misses, backspaces and strays are added (assumption: about 10% extra events), so about **3.3 KB** per lesson. The first draft said 1.8 KB, which was off by about 4× (12 words × 4 B × 150 = 7.2 KB).
- **Retention (pending Q5):** the most recent **1,000 lessons per profile** keep events, about **3.3 MB**. Older event rows are pruned after each lesson; results and aggregates are kept forever. (2,000 lessons would be about 6.6 MB.)
- Combos (M3) need more than one target index. They move to layout 2 using w2's reserved bits; the `layout` field on each `events` row says which layout it uses.

### 8.3 Result record

The record **borrows keybr's legacy field names and its histogram math** ([up] `packages/keybr-result-io/lib/legacyjson.ts:24-52`), but it is **not** readable by keybr's parser and doesn't claim to be. keybr's `l` is a layout id and `m` a `TextType` id (`generated`, `natural`, `numbers`, `code`, [up] `packages/keybr-result/lib/texttype.ts:4-7`), and `resultFromJson` returns null for unknown values ([up] `legacyjson.ts:83-86`). Practice's layout (`Layout.custom`, [up] `packages/keybr-keyboard/lib/layout.ts:7-17`) is not in `Layout.ALL`, so no value of `l` would parse. Practice reads its records with its own validator (§8.4).

```jsonc
{
  "schema": 1,
  "profileId": "me",
  "l": "custom",                      // keybr Layout id Practice runs with (Layout.custom)
  "m": "generated",                   // keybr TextType: generated (Guided), natural (Words, Custom), numbers (Drill · Numbers with Benford)
  "ts": 1759939200000, "n": 152, "t": 28400, "e": 4,
  "h": {                              // per (character | path key)
    "106|0:38:n": { "h": 14, "m": 1, "t": 312 },
    "33|1:27:f":  { "h": 3,  "m": 1, "t": 540 }
  },
  "k": { "38@0": { "h": 14, "m": 1, "t": 290, "s": 0 } },  // per matrix index @ layer (s = stray)
  "r": { "32": { "n": 6, "t": 140 } },                     // layer reach per prerequisite index
  "x": {                                                   // Keybard extensions
    "type": "guided",                 // Practice lesson type: guided | drill | words | custom
    "scope": { "layer": null, "group": null, "dirs": null, "hands": null, "thumbs": true },
    "target": 175, "src": "usb", "obs": 148, "inf": 4,
    "board": "sval:E464…",            // §8.1 normalized board identity
    "os": "us", "km": "a3f9c2…"       // keymap fingerprint (§9.4)
  }
}
```

- `h` keeps one entry per (character, path key) used in the lesson, so a character typed through two paths (Space on either thumb) keeps both (§6.1).

### 8.4 Export and import

- **Export file:**

  ```json
  { "format": "keybard-practice", "version": 1, "exportedAt": "…", "keybard": "<commit>",
    "profiles": [...], "results": [...], "events": [...optional...], "settings": {...} }
  ```

- **Import** validates every field with Practice's own validator, written in the style of keybr's `resultFromJson` ([up] `legacyjson.ts:54-90`); keybr's parser can't read these records (§8.3).
  - Import always targets the **active profile** (§5.9). Every profile in the file is imported into it; the file's `profileId` values are rewritten. To keep two people's data apart, create and select a second profile before importing.
  - **Merge** dedupes results on `(ts, n, t)` within the active profile.
  - **Replace** clears the active profile's results, events and snapshot first, after the confirm dialog (§5.9).
  - Unknown `version` > 1 is refused, with the error line from §5.9.
- keybr or svalbr history cannot be imported, because their data lives in another origin's IndexedDB (`"history"`, [up] `packages/keybr-result-loader/lib/internal/local.ts:10-54`). This is not planned.

### 8.5 Privacy

- No network requests. The engine and content are bundled.
- No telemetry.
- The board is read only while the practice textarea has focus and the tab is visible (D10). Reads are matrix and layer state only. Nothing is ever written to the board.
- Keystroke events record only Practice lesson text, never typing elsewhere.
- Data stays in the browser profile, and export is user-initiated.

### 8.6 Schema versioning

- The IndexedDB version bumps with ordered migrations in `store/migrations.ts`.
- Every record carries `schema`. A record with a newer schema than the app understands puts Practice into a read-only state, with a notice **Progress was saved by a newer Keybard**.
- `engineVersion` (vendored keybr commit + Practice adapter version) invalidates `snapshots` only, never results.

---

## 9. Architecture

### 9.1 Module layout

Practice and Overlay are separate features (D1). They share only generic UI components (`src/components/shared/`) and the workspace plumbing in `src/layout` and `src/contexts`. Neither imports the other's directory. (Optional M5 imports the Host client module `src/features/trainer/host.ts` as a library, with its own instance, §12 M5.)

```
src/features/practice/                    # new (M1a–M4)
  PracticeWorkspace.tsx            # P0 frame: title, Lessons·Progress pills, hash sync, lazy pages
  PracticePanel.tsx                # detail panel content: P3 Lesson or G2 Progress, by page; Esc closes
  PracticeProvider.tsx             # always-mounted shell + PracticeEngine started on first visit (§4.1 Mounting)
  vendor/keybr/                    # vendored engine (AGPL-3.0), README.md + LICENSE (+ every patch, §9.2)
    math/ rand/ unicode/ lang/ settings/ binary/ phonetic-model/ textinput/
    textinput-events/ keyboard/ lesson/ result/ result-io/legacyjson.ts
  keymap/
    resolver.ts                    # char → Path[] (BFS over layers, §9.4)
    whitespace.ts                  # keycode → whitespace/control character table (§9.4)
    svalKeyboard.ts                # builds keybr Keyboard from KeyboardInfo (§9.5)
    fingerprint.ts                 # keymap + default layer + OS layout hash
    geometry.ts                    # cluster/finger/direction from (row,col) via geometry()
  input/
    inputHandler.ts                # adapted keybr inputhandler (Tab passes through)
    timeToType.ts                  # adapted: new-prerequisite divisor (§6.5)
    usbSampler.ts                  # WebHID matrix + layer sampler (§9.3), ring buffer outside React
    hostSampler.ts                 # M5: own useHost() instance, polls only while the text has focus
    correlate.ts                   # DOM step ↔ matrix history matching
    inputMode.ts                   # §3.2 mode machine
  lessons/
    guided.ts drill.ts words.ts custom.ts numbers.ts   # thin wrappers over vendored keybr-lesson
  content/
    loader.ts                      # imports virtual:practice-content (Paranoid) or ?url / import() (§7.5)
    symbols.ts assets/model-en.data words-en.json
  store/
    db.ts results.ts events.ts pack.ts snapshots.ts export.ts migrations.ts memory.ts (test twin)
  state/
    usePracticeSession.ts useProgress.ts useInputMode.ts settings.ts
  ui/
    LessonsPage.tsx StartView.tsx KeyStrip.tsx MetricsRow.tsx TypeRow.tsx StatusSlot.tsx
    TypingSurface.tsx PracticeKeyboard.tsx LessonPanel.tsx InputPopover.tsx KeyPopover.tsx
    CustomTextDialog.tsx Banner.tsx StatCell.tsx
    progress/ProgressPage.tsx SpeedChart.tsx HeatmapBoard.tsx FingerGrid.tsx ThumbGrid.tsx
    progress/LayerTable.tsx CharTable.tsx HistoryList.tsx ProgressPanel.tsx DataRows.tsx

src/features/trainer/                     # Overlay (existing directory, name kept; MO)
  OverlayWorkspace.tsx             # O1 page (the page half of today's TrainerPage.tsx)
  OverlayPanel.tsx                 # O2 panel: Window · Appearance · Feedback · Recall tiles; Esc closes
  OverlayProvider.tsx              # always-mounted shell; OverlayEngine (started on first visit, §4.1)
                                   #   holds the state lifted from TrainerPage.tsx:19-62 (useHost, prefs,
                                   #   source, layers, recall, familiar, selection, Host config mirroring)
  HostInstall.tsx                  # restyled: DesktopOverlayWell, ParanoidWell, HostStatusPill, HostVersion facts
  HostOverlay.tsx core.ts useSurfaceKeys.ts   # unchanged
  OverlaySurface.tsx               # + optional `selected` prop (two-tone ring), used only by the page preview
  host.ts                          # + `lost` flag; lost/stale no longer written to `error` (§5.16)
  overlay-surface.css              # what remains of trainer.css: .trainer-native-surface, .trainer-key-*,
                                   #   .trainer-fade (layout and keyframes only, no colors)
  (TrainerPage.tsx and trainer.css are deleted)

src/components/shared/                    # shared new components (§5.0.3); NOT src/components/ui/, which the
  SegmentedControl.tsx ToggleChipGroup.tsx ColorField.tsx   #   theme guard skips (allowlist "shadcn ui stock")
src/components/CustomColorDialog.tsx      # picker section reusable without the LED target (N-15 More colors…)
src/vite-env.d.ts                         # + declare module "virtual:practice-content" (§7.5)

src/contexts/PanelsContext.tsx            # + workspace, setWorkspace, hash routes (§4.2), returnFocusOverride
src/layout/Sidebar.tsx                    # Practice and Overlay items, workspace-aware click and indicator (§4.1)
src/layout/EditorLayout.tsx               # workspaces, SecondarySidebar outside the editor wrapper, providers
src/layout/PanelContent.tsx               # practice and overlay panels and titles
src/layout/SecondarySidebar/SecondarySidebar.tsx   # practice, overlay in getDetailPanelHeight; returnFocusOverride
src/index.css                             # kb-select*, kb-pending, kb-heat-*, kb-use-* tokens (§5.0.1–§5.0.2)
src/components/Key.tsx and the §5.17 call sites   # color roles (MC)
```

**Why the Overlay directory keeps its name (DECISION).** `src/features/trainer/` is imported by `src/main.tsx:1` (`HostOverlay`), `src/App.tsx:21` (`notifyHostLayoutChanged`), eight test files under `tests/` (seven import it, for example `tests/trainer/core.test.ts:2`; `tests/components/EditorLayout.guides.test.tsx:34` mocks it), the manual's capture tools (`docs/manual/tools/capture-native.py:11`) and the Host release steps (`companion/overlay-host/README.md:94`). Renaming it buys nothing a user sees and touches the Host release process; a one-line `README.md` in the directory says it holds the Overlay feature.

**Storage names.** Overlay keeps `keybard.trainer.v1` ([kb] `core.ts:20`), because existing users' preferences live there. Practice is new, so it takes Practice names: IndexedDB `keybard-practice`, settings key `keybard.practice.v1`, export format `keybard-practice`.

### 9.2 keybr packages: vendor, adapt or rewrite

The first draft called `keybr-lesson`, `keybr-textinput` and `keybr-result` "vendor as-is". They are not: `keybr-lesson/lib/settings.ts:1-2` imports `Syntax` from `@keybr/code` (all code grammars) and `Book` from `@keybr/content` (book covers), and every lesson type imports `lessonProps` from that file (for example `guided.ts:10`). `Lesson.filter` partitions history by `KeyboardOptions.from(settings).layout.family` (`lesson.ts:32-36`). `Result` requires a `Layout` (`keybr-result/lib/result.ts:47`). `keybr-textinput/lib/settings.ts:1` imports `KeyboardOptions`. The table below lists every patch.

| keybr package | Treatment | Patches and rationale (sources: `research/keybr-engine.md` §1.2 and the files named) |
|---|---|---|
| `keybr-math`, `keybr-rand`, `keybr-unicode`, `keybr-lang` | **Vendor as-is** | Pure; no dependencies |
| `keybr-binary` | **Vendor** `io.ts`, `errors.ts` (and `index.ts` trimmed to them) | `TransitionTable` decodes `model-en.data` with its `Reader` ([up] `keybr-phonetic-model/lib/transitiontable.ts:1,19`). The whole package is 541 LOC; `crc32`, `utf8`, `secret` are dropped. |
| `keybr-settings` | **Vendor** props model | Storage adapter replaced by `appStorage` ([up] `preferences.ts:15-32` uses `localStorage`) |
| `keybr-phonetic-model` | **Vendor**, minus `fs-load.ts`, `Alphabet.tsx`, examples; blacklist EN only | Node-only and React bits are cut |
| `keybr-phonetic-model-loader` | **Rewrite** (about 20 LOC) | webpack asset URLs ([up] `lib/assets.ts`, `lib/loader.ts:10-20`) |
| `keybr-keyboard` | **Adapt**: keep `keyboard.ts`, `keyshape.ts`, `keycombo.ts`, `keycharacters.ts`, `types.ts`, `language.ts`, `layout.ts` (the `Layout` class and enum only, for `Layout.custom`), `geometry.ts`, `mod.ts`, `keymodifier.ts`, `ngram.ts`; drop the layout tables under `layout/`, `geometry/`, `load.ts`, `settings.ts`, `context.tsx` | Keyboard is built from the Keybard keymap (§9.5). `ngram.ts` is imported by `transitiontable.ts:2`. `layout.ts` is 1,580 lines and is a size risk (§9.8). |
| `keybr-textinput` | **Adapt**: stub `font.ts`; patch `settings.ts` to drop the `KeyboardOptions` import; patch `stats.ts` `makeStats` to subtract dropped gaps and paused intervals from lesson time | `font.ts` reaches into themes ([up] `font.ts:8`); `stats.ts:13-18` uses last − first step (§6.5) |
| `keybr-textinput-events` | **Adapt**: keep `inputhandler.ts` with the Tab `preventDefault` removed ([up] `inputhandler.ts:101-103`); replace `timetotype.ts`; drop `emulation.ts` | §5.11, §6.5; emulation assumes ANSI/ISO ([up] `emulation.ts:17-90`) |
| `keybr-lesson` | **Adapt**: strip the `code` and `books` props from `lessonProps` and drop `code.ts`, `books.ts` (removes the `@keybr/code` and book-cover imports); override `Lesson.filter` to select by path key (§6.1) instead of layout family; construct with `Layout.custom(Language.EN)` | [up] `settings.ts:1-2`, `lesson.ts:32-36`; about 1.2k LOC + 1.7k LOC tests |
| `keybr-lesson-loader` | **Rewrite** (about 50 LOC) | `pages-shared` coupling |
| `keybr-result` | **Adapt**: minus React context and intl `speedunit` formatting; every `Result` gets `Layout.custom(Language.EN)` | `result.ts:47` requires a `Layout`; formatting moves to Practice UI |
| `keybr-result-io` | **Vendor** `legacyjson.ts` only, as a reference for Practice's own reader (§8.3) | — |
| `keybr-result-loader` | **Rewrite** as `store/` | Namespaced DB; no remote sync |
| `keybr-content`, `keybr-content-words` | **Adapt**: types + EN word list; no `Book` | Vite `import()` |
| `keybr-chart` | **Port transforms only**; draw in SVG | Canvas + `getComputedStyle` theming conflicts with tokens ([up] `use-chart-styles.ts`) |
| `keybr-keyboard-ui`, `keybr-lesson-ui`, `keybr-textinput-ui`, `keybr-widget`, `keybr-themes`, `keybr-color`, `keybr-intl`, `page-practice` views | **Rewrite** as Keybard UI; `page-practice/state/*.ts` logic adapted into `state/` | LESS modules, own theme system, react-intl in every file |
| `keybr-code`, `keybr-content-books`, `keybr-keyboard-io`, sounds, server packages | **Skip** | Size or out of scope. Reachable only through the `lessonProps` imports patched out above. |

- **Size:** non-test TypeScript in the vendored packages (excluding `keybr-keyboard`'s `layout/` and `geometry/` directories) measures about **11.6k LOC**: keyboard 3,608, lesson 1,234, phonetic-model 1,100, result 1,074, unicode 908, textinput 819, textinput-events 747, math 733, lang 462, settings 355, result-io 344, rand 238, plus binary's kept files. The trims above remove part of `keybr-keyboard`; the post-trim figure is measured in M1a.
- **Tests:** keybr's tests for these packages (about **7.1k LOC**, `node:test` + `rich-assert`) are ported to Vitest alongside the vendored code. Vitest is Keybard's runner ([kb] `vitest.config.ts:9-12`). Fixtures that call `loadKeyboard` or use `Layout` tables (for example [up] `guided.test.ts:2`) are rebuilt on a small fake Svalboard keyboard from `svalKeyboard.ts`, because the layout tables are dropped.
- **Vendoring rule:** vendored files are copied verbatim except where a change is required. Each changed file carries a top comment `// Modified for Keybard: <reason>`, and every patch in the table above is listed in `vendor/keybr/README.md`.

### 9.3 Input pipeline

```
           ┌──────────────── DOM (hidden textarea, focused) ────────────────┐
           │ keydown/keyup(code, timeStamp, repeat)   input/composition(data) │
           └───────────────┬──────────────────────────────────┬──────────────┘
                           ▼                                  ▼
                    InputHandler (vendored, patched) ─► TextInput steps (char truth, t_input)
                                                              │
  WebHID (Live·USB) ── usbSampler ── ring buffer (2 s, outside React) ──► correlate ──► KeystrokeEvent.phys
  Keymap only ─────────────────────────── resolver primary path ┘ (inferred)
```

**Characters and timing:** always from DOM events in the focused textarea, as keybr does. The step time is the `input` event's `timeStamp`, except for delayed-output steps when live (§6.5).

**usbSampler (Live · USB):**

- Loop with exactly one request in flight:
  1. `t0 = performance.now()`;
  2. `bits = await keyboardService.pollMatrix(board)`, a single VIA `0x02/0x03` request whose rows come back in one 32-byte report ([kb] `src/services/keyboard.service.ts:469-500`);
  3. `t1 = performance.now()`;
  4. sample time `ts = (t0 + t1) / 2`, uncertainty `±(t1 − t0) / 2`.
- **Constraint:** the sampler calls `keyboardService` directly and keeps samples in a ring buffer held in a ref or a plain module object, **never in React state**. It must not call the context's `pollMatrix` ([kb] `KeyboardContext.tsx:402-406`), which calls `setLastHeartbeat` on every poll and would re-render every `useKeyboard()` consumer, including each `Key.tsx` through `useKeyDrag` ([kb] `src/hooks/useKeyDrag.ts:44`). The UI reads only derived, change-only values (pressed set, live layer) through a small subscription. A test asserts that a running sampler causes no board re-render without a key change (§9.9).
- Every 3rd iteration it also calls `getLayerStateMasks(board)` for active and default masks ([kb] `keyboard.service.ts:515-519`).
- No artificial delay. Target ≥ 100 Hz; the M0 spike measures the real rate (UNVERIFIED). Matrix Tester's 50 ms interval ([kb] `MatrixTester.tsx:13`) is for display and too coarse for attribution.
- **Edges:** for each position, a press edge is 0→1 between consecutive samples and a release edge is 1→0. Edge time = the later sample's `ts`, uncertainty = interval.
- **Lifecycle:** runs only while mode is Live · USB (focus + visible + Practice workspace `active` + Lessons page + lesson not paused). It stops within one iteration of blur. It shares the USB promise queue (1 s per-command timeout, [kb] `usb.service.ts:700-760` per research) with `KeyboardContext`'s 120 ms layer poll ([kb] `KeyboardContext.tsx:409-436`). Practice does not pause that poll; the extra request is acceptable.
- **Errors:** three consecutive failures put the mode into Keymap only, with retries every 2 s while focused.

**Effective layer at an edge.** Layer masks are sampled only every 3rd iteration, and an `LT` hold may not be decided yet when the target is pressed, so the mask alone can lag a fast `MO(1)` → target roll. The effective layer at an edge is therefore derived from the matrix itself:

1. Start from the default layer (from the last mask) plus layers held on by toggles and one-shots (`TG`, `TO`, `OSL`), which only the mask can show.
2. Add the layer of every `MO(n)` key and `LT(n, …)` key that is **down in the same matrix sample** as the edge. Their meaning comes from the keymap. A held `LT` is treated as its hold side for this purpose, even before the firmware decides; rule 2 below handles the case where it turns out to be a tap.

**correlate:**

- For each completed step (character `c` at `t_input`), look at the matrix history over the interval **`(t_step(previous), t_input + ε]`**, with ε = 40 ms (tuned by M0). This replaces a fixed window around `t_input`: with permissive hold, a character reached under an `LT` hold types on the target's release, which can be well over 60 ms after its press (§6.7), and a tap-dance tap types after the tapping term.
- Attribution waits until the sampler's latest sample passes `t_input + ε`. The UI does not wait; hints use the DOM step immediately.
- **Choose:**
  1. A press edge in the interval whose index, under the effective layer at that edge, resolves to a path producing `c`, latest first → **observed hit**, `path_used` = that path. Prerequisite press edges in the interval for that path become `prereq` (§6.5 "new prerequisites"). When the path's prerequisite is an `LT`/`MT` hold, or the target is a tap-dance key, the step is marked **delayed output**, and `t_step` = that press edge.
  2. Else, for tap-side-of-hold keys (`LT`, `MT`, keyContents type `modtap`/`layerhold`, [kb] `src/utils/keys.ts:167-380`), a **release** edge in the interval resolving to `c` → observed hit, delayed output, `t_step` = the matching press edge.
  3. Else, the latest character-producing press edge in the interval → observed physical key, with `errorClass` from §6.6 if `c` ≠ the expected character.
  4. Else (missed tap) → inferred from the primary path, `confidence = 'inferred'`.
- **OS layout mismatch counter:** it increments only when rule 1 or 3 found a press whose resolved character differs from `c` **and** the step is eligible: effective layer = default layer, no prerequisite held, and the target is not a tap-hold or tap-dance key. Layered and delayed steps never count, so symbol drills can't trigger the notice on a correct OS layout.
- **Consumption and strays:** edges used by a step (target or prerequisite) are consumed. Strays follow §6.6: only character-producing presses that no step in `(t_prev, t_next)` matched.
- **Tap-hold settings.** Permissive hold, chordal hold and the tapping term are runtime settings on the board ([qmk] `modules/svalboard/core/sval_qmk_settings.c:64,79-84`). Keybard does not read them today (no QMK-settings client in [kb] `src/`). The history-based interval above works without them. Reading them would sharpen rule 1 and the Keymap-only "Delayed output" estimate; it is optional future work (§10), UNVERIFIED as to the exact command.
- **Clock:** both DOM `event.timeStamp` and `performance.now()` are on the document's high-resolution time origin in Chromium. M0 verifies this (UNVERIFIED).

**Dedupe and merge:** the DOM is the only source of characters. Physical sources only annotate. USB beats Host, and only one physical source is active at a time (§3.2).

### 9.4 Keymap resolution (char → paths)

- **Inputs:**
  - `KeyboardInfo` of the practiced keymap source (§5.4): keymap, combos, tapdances, key_overrides ([kb] `src/types/keyboard.types.ts:4-67,134-166`);
  - the default layer (live mask or 0);
  - `internationalLayout`.
- **Algorithm:**
  1. **Layer reachability.** BFS from the default layer. Edges come from keys on the current effective layer whose `getKeyContents` type is `layer`/`layerhold` ([kb] `src/utils/keys.ts:167-380`): `MO(n)` and `LT(n,…)` hold → hold prerequisite; `OSL(n)` → one-shot prerequisite. `TG`/`TO`/`DF`/`TT` are **excluded** from paths in v1, because toggling is a mode, not a chord. Depth is capped at 2 holds.
  2. **Effective keycode per (layer state, index):** `resolveBinding(keymap, index, activeMask, defaultMask)`, using QMK transparency ([kb] `src/features/trainer/core.ts:40-49`).
  3. **Character output per keycode:**
     - **whitespace and control keys first**, from an explicit table in `keymap/whitespace.ts`: `KC_SPACE` → U+0020, `KC_ENTER` → `\n`, `KC_TAB` → `\t` (and their tap sides on `LT`/`MT` keys). `getLabelForKeycode` can't be used for these: it returns display labels, `"Space"`, `"enter"`, `"tab"` ([kb] `src/components/Keyboards/layouts.ts:316-319,328,497`), which the single-character rule would drop, leaving space, the most common character, with no path;
     - plain → `getLabelForKeycode(keyService.stringify(code), layoutId)`, single character only ([kb] `src/components/Keyboards/layouts.ts:449-527`);
     - user-Shift variant → `getLabelForKeycode('LSFT(<kc>)')` with a prerequisite on the nearest Shift key (`KC_LSFT`/`KC_RSFT`, or mod-tap hold side `LSFT_T`) on the same layer state;
     - **firmware Shift** (`shift = 'f'`) is detected from the **keycode bits**, not from `getKeyContents`: a code in the QMK mods range (`0x0100`–`0x1FFF`) with the Shift bit set (`code & 0x0200`; `0x1200` is right Shift), or a named alias in `US_SHIFT_ALIASES` ([kb] `layouts.ts:440-447`). Named shifted keycodes such as `KC_EXLM` (`0x021e`, [kb] `src/constants/keygen.ts:227`) stringify to their name, so `getKeyContents` doesn't classify them as `modmask` (its basic branch needs `(keyid & 0xff00) === 0`, and its modmask branch needs the `X(...)` form, [kb] `src/utils/keys.ts:247,363-380`);
     - LT/MT tap side → base keycode `code & 0xff` (the logic already in [kb] `useSurfaceKeys.ts:16`), with `emitsOnRelease = true`.
  4. **Cost:**

     | Component | Cost |
     |---|---|
     | Each press | 1 |
     | `MO` hold | +0.5 reach |
     | `LT` hold | +0.8 (reach, plus delayed output and tap misfire risk, §6.7) |
     | OSL | +0.75 |
     | User Shift | +0.5 |
     | Tap-dance tap | +1 (delayed by the tapping term) |
     | Direction tie-break | C 0, N/S 0.1, E/W 0.2, 2S 0.3, thumb 0.15 |

     Lowest cost = **primary**. Others are alternatives. Stats use all current paths (§6.1), so a cost change never restarts a character.
  5. **M3:** combos (`ComboEntry.keys` are keycode strings, [kb] `keyboard.types.ts:134-139`; map each to positions emitting it on the path's layer → multi-target path, cost = n, path key `layer:i1+i2:shift`, event layout 2 (§8.2)), tap-dance tap and double-tap, and key-override replacements. Macros are never paths (N8).
  6. **Reverse map:** `(index, layer, shift) → char`, used for error classification and mismatch detection.
- **Fingerprint:** SHA-256 of (the practiced keymap's resolved paths + default layer + layoutId), shortened to 4 hex digits where shown. Momentary layer state is not part of it (§5.3).
- **Caveat:** `generateAllKeycodes(kbinfo)` mutates global CODEMAP for custom keycodes ([kb] `src/services/key.service.ts:22-60`). The resolver must run after the active board has registered its keycodes. For files and the example, custom keycodes resolve to no character, which is acceptable.

### 9.5 Svalboard `Keyboard` adapter

`svalKeyboard.ts` builds a vendored keybr `Keyboard`:

- `KeyId = "m" + index`;
- `KeyShape` positions from Keybard's `geometry(board)` ([kb] `core.ts:50-59`);
- zones: finger from row (rows 1/6 index, 2/7 middle, 3/8 ring, 4/9 pinky, 0/5 thumb) + hand (`row < 5` left);
- `CharacterDict` per primary path;
- `KeyCombo` extended with `{ layer, prereq[], shift }`;
- `getCodePoints()` returns Svalboard tier weights (§6.3).

The adapter is the only thing keybr's `Lesson` sees. The UI never uses keybr shapes for drawing.

### 9.6 Rendering the Svalboard

- `PracticeKeyboard` and `HeatmapBoard` render `Key.tsx` directly, with layout from `board.keylayout` or `SVALBOARD_LAYOUT` (same selection as [kb] `MatrixTester.tsx:47-53`) and props `disableHover disableDrag disableTooltip`.
- `Key.tsx` needs `useLayoutSettings` and `useKeyDrag` ([kb] `src/components/Key.tsx:61-73`), which are available inside `EditorLayout`.
- The full `Keyboard` component is **not** used, because it is coupled to KeyBinding/Panels/Changes contexts ([kb] `src/components/Keyboard.tsx:60-104`).
- `OverlaySurface` (40 px SVG, appearance presets) stays the Overlay renderer only; Practice never uses it, and Overlay never uses `Key.tsx` (N1, N10).
- Each key is memoised on `(code, layer, state)`, so a keystroke re-renders at most about 6 keys (previous and next key, prerequisites, cluster).

### 9.7 Performance budget

| Item | Budget |
|---|---|
| Keystroke → caret paint | < 1 frame (16 ms) at p95, on a mid-range laptop (UNVERIFIED baseline) |
| Engine work per keystroke (TextInput step + hint update) | < 1 ms |
| Correlation per step | < 0.5 ms |
| Lesson generation | < 50 ms |
| Load: snapshot path | < 100 ms |
| Load: full replay of 5,000 results | < 500 ms (chunked, yields) |
| Sampler | 1 request in flight; zero cost while unfocused |
| IndexedDB write per lesson | < 20 ms, off the input path (after completion) |

### 9.8 Bundle-size budget

| Chunk | Budget (gzip) | Notes |
|---|---|---|
| Editor initial chunk growth | ≤ 3 KB | Practice nav item, `PracticeWorkspace` frame and lazy loaders only |
| `practice` lazy chunk (engine + UI) | ≤ 130 KB | Engine ≈ 11.6k LOC before trimming (§9.2), of which `keybr-keyboard/lib/layout.ts` alone is 1,580 lines; Practice UI on top. The first draft's 90 KB assumed a 5k LOC engine. UNVERIFIED until M1a measures the trimmed engine; if `layout.ts` dominates, it is cut to the `Layout` class plus `custom` only. |
| `content-en` lazy chunk | ≤ 75 KB | model ≈ 25 KB + words ≈ 39 KB + EN blacklist |
| Paranoid single file growth | ≤ 550 KB uncompressed | Inline + base64; raised with the engine estimate |

M1b adds a Vitest check that reads `dist/` stats after `vite build` in CI and fails over budget. The exact mechanism is UNVERIFIED, because Keybard has no size check today ([kb] `package.json` scripts). M1a records the measured engine size so the budgets can be fixed before M1b.

**Measured in M1a (2026-10-08).** The trimmed vendored engine is **9,473 non-test LOC** (keyboard 1,542 after trimming `layout.ts` to `Layout.custom` + `EN_US`; lesson 1,115; result 1,136; phonetic-model 959; unicode 910; textinput 846; math 737; textinput-events 507; lang 463; binary 446; settings 337; rand 238; result-io 206; content 24), plus about 2.2k LOC of Practice engine code (`keymap/`, `store/`, `input/timeToType.ts`, `lessons/`, `state/`). A Vite library build of everything M1a exports (minified, ES2022, Keybard's own modules external) is **136 KB raw, 36 KB gzip**, including the EN blacklist; the vendored engine alone with every export kept is 139 KB raw, 34 KB gzip. Content: `model-en.data` 47,054 B (25.2 KB gzip), `words-en.json` 128,321 B (37.8 KB gzip), 63 KB gzip together. The 130 KB `practice` and 75 KB `content-en` budgets above therefore hold with room for the M1b UI; the M1b check uses them as they are. Ported keybr tests: 6.7k LOC.

**Measured in M1b (2026-10-09).** `build/bundle-stats.ts` records Practice's own share of each build and `tests/build/bundle-size.test.ts` checks it (`npm run check:bundle`; the test workflow runs it on Node 24). Production: Practice code in the entry chunk 1.6 KB gzip, measured before minification (the whole entry chunk grew by 1.0 KB gzip against `d288126`); the practice lazy chunks (engine and UI) 66 KB gzip; the English content 60 KB gzip (word list chunk 37 KB, model asset 25 KB). Paranoid: Practice code (minified share) and inlined content add about 392 KB to the single file; the word list is inlined once.

### 9.9 Testing

- **Vendored engine:** keybr's tests for the vendored packages ported to Vitest (about 7.1k LOC), with fixtures rebuilt on a fake Svalboard keyboard instead of `loadKeyboard`/`Layout` tables (§9.2). Added tests for each patch: `lessonProps` without code/books, the `Lesson.filter` override, and `makeStats` with gaps and pauses.
- **Resolver:** tests against `src/default-layouts/sval-default.svil`:
  - `a` → `0:26:n` (left pinky C);
  - space → `0:33:n` (right thumb T3, `KC_SPACE`) through the whitespace table; Enter (`\n`) → the `LT1(KC_ENTER)` tap side, emits on release;
  - `!` → layer 1 via `MO(1)` (right thumb col 2, index 32; primary) or `LT1` (left thumb col 3, index 3; alternative, higher cost), target left pinky N (index 27), shift `f`. The firmware Shift comes from the keycode bits of `KC_EXLM` (`0x021e`), not from `getKeyContents`;
  - `A` → user Shift (left thumb index 2) + 26;
  - `t` → left middle E (index 13);
  - transparency;
  - an unreachable layer;
  - Custom text containing spaces, newlines and `é` reports only `é` as untypeable.

  (Indices follow `row*6+col`; see `research/svalboard-geometry.json`.)
- **Timing:** synthetic step streams confirm:
  - firmware Shift is not a press; a new layer hold is;
  - a run of layer-1 digits under one held `MO(1)` divides only the first digit by 2 (live and Keymap only);
  - `THE` with Shift held through the word counts Shift once;
  - the 2 s gap drop, and `makeStats` lesson time excluding gaps and pauses;
  - delayed-output steps use the target press edge when live.
- **Correlator:** synthetic sample and event streams covering:
  - normal press;
  - a 30 ms tap that falls between samples → inferred;
  - mod-tap release;
  - **permissive-hold roll**: `LT1` down, L-pinky N down at +40 ms, released at +120 ms, `!` input at +121 ms → observed hit on index 27 with prerequisite 3, delayed output, `t_step` = the +40 ms edge;
  - **tap-dance delay**: input 200 ms after the press → observed hit, delayed output;
  - **fast `MO(1)` roll** under a stale base-layer mask (mask sampled before the hold) → `!`, not `q`; mismatch counter unchanged;
  - a wrong key → `errorClass` per the §6.6 worked example;
  - simultaneous roll of two keys;
  - skew ±40 ms;
  - strays: Shift, `MO`, Backspace presses never become strays; an extra letter press does;
  - OS layout mismatch counter counts only eligible base-layer steps.
- **Sampler:** with a mocked `keyboardService`, a running sampler at 100 Hz causes zero `PracticeKeyboard` re-renders while no key changes, and never calls the context's `pollMatrix`.
- **Store:** `memory.ts` twin (the pattern of `MemoryBackupStore`, [kb] `src/services/backup/store.ts`). Tests cover migrations, the §8.2 pack/unpack round trip for every field and boundary value, retention pruning, snapshot invalidation on a fingerprint change, and export/import round-trip (Merge, Replace).
- **UI (jsdom, Testing Library):**
  - every P1 state in §5.3 renders its title or notice inside the status slot, and the text card's position doesn't change when a banner or notice appears;
  - typing via synthetic `keydown`/`input` events on the textarea advances lessons (keybr's handler has no `beforeinput` listener);
  - Tab leaves the textarea and pauses;
  - hints, rings, step badges and target legends land on the expected keys;
  - board keys are not focusable and a board click focuses the textarea;
  - the lesson type control regenerates the lesson and returns focus to the surface (pointer) or keeps it (arrow keys);
  - Lesson panel: opening it pauses through blur; Esc in it closes it and focus returns to the surface; at ≥ 1100 px and in bottom-bar layout a click on the text card resumes with the panel open (bottom-bar also scrolls the text card into view); at 900–1099 px in side layout focusing the surface closes it; a lesson-shaping setting regenerates the text;
  - heatmap faces: no layer color class on any heat key; keys at target carry the check; every key with samples has a footer value;
  - settings validator fallbacks.
- **Workspace and nav (MW, reused by M1b and MO):** `PanelsContext` and `Sidebar` tests for the §4.1 click table, the indicator rule, footer items staying workspace-neutral, `returnFocusOverride`, and every §4.2 hash (including `#trainer` → `#overlay` and clearing the hash on return to the editor). Also:
  - Matrix Tester on, then the Overlay nav item, then an editor item: Matrix Tester is off and `workspace` is `editor`;
  - an editor panel open, then the Overlay nav item: focus moves into the Overlay panel (the `focusKey` rule, §4.1); Lessons ↔ Progress with the panel open leaves focus where it was;
  - Esc on an open **Preset** select inside the Overlay panel closes only the select; a second Esc closes the panel;
  - providers: opening and closing Overlay and Practice never remounts `SecondarySidebar` or the editor content (a mount counter on both stays at 1);
  - with `servedByHost()` true or a remembered remote Host, no `fetch` to `/api/host/*` happens until Overlay is first opened (D15). `tests/components/MainScreen.navigation.test.tsx` (`#trainer`) and `tests/components/EditorLayout.guides.test.tsx` (which mocks `TrainerPage` and asserts the keep-mounted session, `:34-38,247-257`) are updated to the Overlay workspace.
- **Overlay (MO):** today's tests keep passing (`tests/trainer/core.test.ts`, `host-install.test.tsx`, `host-refresh.test.ts`, `host-remote.test.tsx`, `labels.test.ts`, `live-legends.test.tsx`, `tests/host-native-state.test.tsx`; `host-install.test.tsx` is rewritten for the well and status pill). New tests: each O2 tile's rows per Host state (Host-connected-only rows absent, not disabled, without Host); `host.ts` `lost` (set by the watchdog and a failed poll, cleared by the next snapshot, never set before the first snapshot; `error` keeps only bootstrap, command and configure messages); the Layout select names the snapshot `Connected board` only when `isConnected`, else `loadedFrom`; **Desktop default layer** shows whenever Host reports `default === null`, following or not; Host config mirroring (adopt on a new revision when not pending, write after 160 ms, `layoutId` follows `internationalLayout`); Recall publishes only while the Overlay workspace is active and clears on leave, whether or not the panel is open; Color field validation; `HostOverlay` renders no select ring.
- **Color roles (MC):** `Key.tsx` renders the selected, hover, pending and selected + pending classes of §5.0.1, with `z-10` on selected and hovered keys; Matrix Tester's held key uses the strong select look; the **red-reserved** guard rule with its self-tests (§5.17), including a self-test that a red literal under `src/components/ui/` is still scanned by that rule.
- **Theme compliance:** no color literals in new `.tsx` or `.css` chrome; `tests/theme/no-hardcoded-chrome-colors.test.ts` passes with only the new **red-reserved** rule added (§5.17). A guard self-test asserts that `src/components/shared/SegmentedControl.tsx` is scanned (not matched by `ALLOWED_FILES`), so the shared components can't drift into an allowlisted directory. Heat and usage colors are tokens (§5.0.2) applied as key data; `overlay-surface.css` contains no color values.
- **Paranoid:** `npm run build:paranoid` passes ([kb] `package.json:18`).
- **End-to-end:** Keybard has no browser e2e harness (no Playwright dependency in [kb] `package.json`). E2E coverage is therefore:
  - jsdom integration with the USB mock ([kb] `tests/mocks/usb.mock.ts`) feeding scripted matrix frames;
  - a **manual hardware checklist** run on the Mule test board (never the daily-driver), recorded in the PR: poll rate, attribution rate on 200 lesson characters, layered character via `MO(1)` and via `LT1`, mod-tap Enter, stray detection, unplug mid-lesson, **replug mid-lesson (lesson restarts, Practice reopens on the Lessons page, same profile)**, Connect board with a dirty file draft (Keybard's confirm appears), Firefox fallback, Paranoid launch.

---

## 10. Protocol and firmware dependencies

**Used (all existing, read-only):**

| Message | Path | Source |
|---|---|---|
| VIA `GET_KEYBOARD_VALUE 0x02` / `id_switch_matrix_state 0x03` | WebHID, in tab | [kb] `src/services/usb.service.ts:157,172`; `keyboard.service.ts:469-500`; [qmk] `quantum/via.c:364-390` |
| Sval `0xDF 0x16 LAYER_STATE_GET` (active mask + default mask when flag `1<<6`) | WebHID, in tab | [kb] `usb.service.ts:203`; `keyboard.service.ts:515-519` |
| Keymap and definitions | Keybard's existing load | [kb] `KeyboardContext` |
| (M5) Host `GET /api/host/state` → `pressed`, `active`, `default`, `modifiers`; config `highlightPressed` | Loopback HTTP | [kb] `host.ts:16-24,46,62-71`; [kb] `companion/overlay-host/keybard_host/__main__.py:383-408` |

**Firmware assumptions:**

- `VIA_INSECURE = yes`, so matrix reads need no unlock ([qmk] `keyboards/svalboard/rules.mk:43`).
- Whether `matrix_get_row` is pre- or post-debounce on Svalboard's matrix is UNVERIFIED. Stock QMK is debounced. M0 checks it by comparing edge timing against DOM events.
- Matrix bits come back in a single report for 10 rows × 1 byte ([kb] `keyboard.service.ts:471-499`).

**Required changes:**

- **Firmware:** none.
- **Host:** none.
- **Docs:** `docs/paranoid.md:16` and `:46` must say that **Practice reads key presses while open and in front of you** (today only Matrix Tester and Scan Lab do, [kb] `docs/paranoid.md:16`).
- **Docs (MO):** the user manual's Trainer chapter becomes **Overlay** and takes the install steps removed from the page (§5.16); `README.md:224` documents `/#overlay` and notes that `/#trainer` still works. The manual's capture scripts drive today's Trainer UI by nav name, tab role, select index and switch label, so they are updated and the `trainer-*` assets recaptured ([kb] `docs/manual/tools/capture.py:22`, `capture-walkthroughs.py:52-58`, `capture-extra.py:61-63`). Host's user-facing `companion/overlay-host/README.md` (`:5,12,16,19,24`, "Trainer") is updated to Overlay, noting that `#trainer` still works; that is a docs-only change in the repo, not a Host release, so N6 holds. `RELEASE-NOTES.md` (`:9,15,22-23`) is left for the next Host release's own notes. Host's own UI needs no change: its tray item is **Open Keybard** ([kb] `__main__.py:467`), and "Trainer" appears in Host code only in comments. Host keeps opening `/#trainer` ([kb] `__main__.py:463`), so no Host release is needed.

**Optional future work** (not needed; listed so the owner can decline it explicitly):

- **Firmware:** a Sval command returning a small FIFO of timestamped press and release edges. It would make attribution lossless and remove polling. It would need a `svalboard/qmk` release under the shared launch tag.
- **Keybard client (no firmware change):** read the board's tap-hold settings (permissive hold, chordal hold, tapping term; [qmk] `modules/svalboard/core/sval_qmk_settings.c:64,79-84`) so the correlator and the Keymap-only "Delayed output" estimate can use real values. Keybard has no QMK-settings reader today; the exact Sval command is UNVERIFIED.
- **Host (M5+):** an edge-history field in `/api/host/state` instead of latest-value `pressed`, which today is staleness-gated with no timestamps ([kb] `__main__.py:383-391`). This would need a Host release.
- **Host config caveat for M5:** Host tracks and reports `pressed` only while its config `highlightPressed` is on ([kb] `companion/overlay-host/keybard_host/__main__.py:340,386`; default off, `state.py:11`). That setting belongs to Overlay's Feedback tile. To keep N1, M5 **never writes it**: with Highlight held keys off, Live · Host gives layer-following only and every hit is inferred; with it on (the user's own choice in Overlay), M5 also reads `pressed`. Turning it on and restoring it on exit was the revision-2 design; it was dropped because it made Practice write a setting Overlay owns (§12 M5, Q3).

---

## 11. Licensing and attribution

- keybr.com is AGPL-3.0 by its `LICENSE` file. Its `package.json` says `"license": "GPL-3"` ([up] `package.json:7`; same in [sv]). The `LICENSE` file is treated as governing.
- Keybard currently declares `"license": "ISC"` ([kb] `package.json:27`) and has no `LICENSE` file at its root.
- The owner has said Keybard may go AGPL. **Merging vendored keybr code (M1a) requires that change first:**
  - add an AGPL-3.0 `LICENSE`;
  - update `package.json` `license`;
  - add a "Source code" link in About (AGPL §13: users of the hosted site must be offered the source; the repo is public);
  - embed the notice and a source URL in the Paranoid file.
- The license identifier (`AGPL-3.0-only` vs `AGPL-3.0-or-later`) is the owner's call (§13 Q2).
- **Keybard Host** (`companion/overlay-host`) and the **Overlay** feature (`src/features/trainer/`) contain no keybr code and are unaffected; the vendored code lives only under `src/features/practice/vendor/`.
- **Attribution:**
  - `src/features/practice/vendor/keybr/README.md` records the upstream URL, commit `05a37bc5265f65ff538c59c613db29442f345d51`, the per-package list, and every modification;
  - `LICENSE` is copied alongside;
  - the About-panel credit line and the **About** row of the Lesson and Progress panels name keybr.com (aradzie) and svalbr (River, r-tae).
  - keybr source files carry no per-file copyright headers (checked: [up] `packages/keybr-lesson/lib/guided.ts:1-3`), so nothing needs preserving per file beyond the vendored README.

---

## 12. Milestones

Each milestone merges to `svalboard/keybard` `main` and ships to next.keybard.svalboard.com. Each is tested first on the fork's test site (https://morganvenable.github.io/keybard-test/). That site gets Live · USB but never Host. Production promotion stays the owner's manual launch-tag step; **Q7** asks which milestone is the first one worth promoting.

**Estimates** are rough engineer-days for one developer who knows Keybard, including tests and review fixes. They are **UNVERIFIED** guesses meant for planning and comparison, not commitments. Calendar time depends on review turnaround and hardware access (the Mule).

| Milestone | Estimate | Depends on | Can run in parallel with |
|---|---|---|---|
| MC Color roles (prerequisite) | 3–5 days | — | MW, M0, M1a |
| MW Workspace model (Practice and Overlay plumbing) | 3–4 days | — | MC, M0, M1a |
| MO Overlay restyle | 6–9 days | MC (tokens), MW | M0, M1a, M1b, M2, M3 |
| M0 Measurement spike | 2–3 days | — | MC, MW, MO, M1a |
| M1a Engine and resolver (no UI) | 8–12 days | license change (§11) | MC, MW, MO, M0 |
| M1b Practice core UI (Keymap only) | 11–16 days | MC (tokens), MW (workspace model, shared panel, SegmentedControl), M1a | MO |
| M2 Live · USB | 7–10 days | M0, M1b | MO, M3 |
| M3 Drills and content | 6–9 days | M1b | MO, M2 |
| M4 Progress depth, physical extras and data | 9–13 days | M2, M3 | — |
| M5 (optional) Live · Host | 4–6 days | M2 | — |
| **Total, MC–M4** | **about 55–81 days** of work. With two people (one on M1a → M1b → M2 → M4, the other on MC → MW → M0 → MO → M3), about 35–52 calendar days, set by the Practice path. | | |

The revision-2 total was 42–62 days. Revision 3 adds MC (3–5) and the Overlay work (9–13, split into MW 3–4 and MO 6–9), and adds about one day to M1b for the workspace-panel behavior and the on-page type row; M1b no longer builds a shell of its own. The split keeps the Overlay restyle off Practice's critical path: M1b waits only for MW, MC's tokens and M1a, not for the restyle.

**MC. Color roles (prerequisite, D13).**

- **Scope:**
  - tokens `kb-select`, `kb-select-tint`, `kb-select-strip`, `kb-select-strong`, `kb-pending`, `kb-pressed`, `kb-pressed-fg` in `src/index.css`, light and dark (§5.0.1); heat and usage tokens added here too, unused until M4, so all new tokens land in one review;
  - `Key.tsx` selected, hover (outside ring), drag-hover and pending states, with pending shown on selected keys and `z-10` on selected and hovered keys (§5.0.1);
  - every call site in §5.17, including Matrix Tester's held key (strong select) and its dark-theme "was pressed" outline, the layer-pill drop target, the Apply button, the binding editor keys, the palette keys, the bindings list hover, the drag overlay, the selected rows in Leaders and Alt-Repeat, the board-name dirty border, the Layouts panel file-drop target, the neutral **Active** chip; deletion of the unused `constants/pending-change-styles.ts`;
  - the **red-reserved** theme-guard rule and its `RED_ALLOWED` list (§5.17);
  - before/after screenshots in the PR for M-35 to M-37 and for the ProofSheet page with its **Selected** and **Pending** toggles on ([kb] `pages/ProofSheet/ProofSheetPage.tsx:25-26,110-119`), light and dark.
- **Acceptance:**
  - no red utility outside `RED_ALLOWED` in `src/**/*.tsx` (the new rule passes, and its self-tests flag a selected-key literal);
  - existing tests pass, including `tests/theme/no-hardcoded-chrome-colors.test.ts`;
  - in both themes, the select ring measures ≥ 3:1 against the page and the surface, and selected-key legends ≥ 4.5:1 (§5.0.1 values, measured against the built CSS);
  - a pending key that is also selected shows both the ring and the dashed border;
  - Matrix Tester shows held keys with the blue face and 3 px ring, and the "was pressed" keys black (outlined in dark theme), on the Mule; each pair of states measures ≥ 3:1 or carries the ring (§5.0.1 table);
  - ProofSheet with **Selected** and **Pending** on shows the select ring and tint and the amber dashed border on the same keys.

**MW. Workspace model (D1, D12, D15).** Small and first, so both M1b and MO build on it. Can run in parallel with MC, M0 and M1a.

- **Scope:**
  - `PanelsContext` `workspace`, `returnFocusOverride` and the hash routes `#overlay`, `#trainer` (alias), `#practice`, `#practice/progress` (§4.2);
  - `Sidebar.tsx` items **Practice** (`Gauge`, hidden until M1b) and **Overlay** (`PictureInPicture2`) replacing **Trainer**; workspace-aware click and indicator; footer items workspace-neutral; the dead `matrixtester` arm removed (§4.1);
  - `EditorLayout`: workspaces with the editor's `contentStyle`, `SecondarySidebar` moved out of the editor wrapper and rendered in every workspace, and the always-mounted provider shells with `activated` (§4.1 Mounting);
  - `SecondarySidebar`: the `focusKey` focus rule; `practice` and `overlay` in `getDetailPanelHeight`; `PanelContent` and `getPanelTitle` ready for both ids;
  - SegmentedControl (N-1) in `src/components/shared/`, with the theme-guard self-test (§9.9);
  - until MO lands, the Overlay workspace shows today's `TrainerPage` unchanged and `overlay` stays out of the panel auto-open, so the interim build behaves like today apart from the nav name.
- **Acceptance:**
  - nav and workspace tests (§9.9): a nav click opens page and panel; a second click closes the panel and keeps the page; an editor item returns to the editor; Settings opens over a workspace without leaving it; the indicator stays on the workspace item while its panel is closed; `#trainer` and `#overlay` open Overlay and the hash reads `#overlay`; returning to the editor clears the hash; Matrix Tester → Overlay → editor leaves Matrix Tester off; switching from an open editor panel moves focus into the new panel; no remount of `SecondarySidebar` or the editor content; no Host contact before Overlay is first opened;
  - `tests/components/MainScreen.navigation.test.tsx` and `tests/components/EditorLayout.guides.test.tsx` updated and passing;
  - both lucide icons resolve in the installed `lucide-react`.

**MO. Overlay restyle (D11, D12).** Depends on MC (tokens) and MW. Runs in parallel with M1b, M2 and M3; it is not on Practice's critical path.

- **Scope:**
  - **State lift:** `OverlayProvider`'s `OverlayEngine` with today's `TrainerPage` state and effects unchanged (Host config mirroring, Recall publishing gated on the Overlay workspace, board-change resets); the `host.ts` `lost` flag (§5.16);
  - **Restyle:** O1 page, O2 panel (and `overlay` joins the panel auto-open), Color field (N-15, with the portaled Popover and the `CustomColorDialog` picker section), preview card (N-16, two-tone selection ring), Host status pill, wells and notices (§5.14–§5.16); the Layout select's source naming; **Desktop default layer** in Window; `trainer.css` reduced to `overlay-surface.css`; `TrainerPage.tsx` deleted;
  - **Docs:** the manual's Trainer chapter renamed **Overlay**, with the install steps that left the page; the manual capture scripts updated for the Overlay nav item, tiles and new controls, and the `trainer-*` assets recaptured; `README.md:224` updated (`/#overlay`, `/#trainer` still works); `companion/overlay-host/README.md` updated (Trainer → Overlay); `HostInstall`'s pointer to "select Trainer" removed (§10).
- **Acceptance:**
  - every row of the §5.14 capability table works as today, checked against today's tests (`tests/trainer/*.test.ts(x)`, `tests/host-native-state.test.tsx`) and new tests: tiles and rows render per Host state; Host config mirroring (adopt on revision, write after 160 ms, `layoutId` follows `internationalLayout`); Recall publishes only while the Overlay workspace is active and clears on leave; the preview's selected ring is not drawn by `HostOverlay`, nor on an unrevealed Recall target; `lost` is set and cleared; Connection lost shows no Desktop overlay well;
  - the manual capture scripts run against the new UI;
  - push at ≥ 1100 px, overlay below, docked in bottom-bar layout, with no horizontal page scroll at 900 px;
  - no color literal in Overlay `.tsx` or `.css` chrome (the theme guard and a grep of `overlay-surface.css`);
  - manual Host checklist on Windows with the Mule: open Keybard from the Host tray (lands on Overlay), connect, choose the board, show/hide, drag by keys, place at bottom, reload, disconnect, change every appearance row and see it on the desktop overlay, highlight held keys, Recall hides desktop legends and restores them on leave, older Host shows the outdated notice;
  - `build:paranoid` passes, and Paranoid shows the Paranoid well with no Connect button.

**M0. Measurement spike (hidden).**

- **Scope:** a `#practice/lab` view behind `?practiceLab=1` (§4.2). It runs `usbSampler` against the Mule and logs:
  - samples/s;
  - round-trip p50 and p95;
  - DOM-to-edge skew distribution;
  - fraction of taps caught, across 500 typed characters;
  - permissive-hold release-to-input delay for `LT1` rolls;
  - debounced vs raw evidence.
- **Acceptance:** a numbers table posted in the PR; correlator ε and sample-rate targets fixed in this spec; a firmware-load sanity check (no dropped keystrokes on the board while sampling at full rate).

**M1a. Engine and resolver (no UI).**

- **Scope:**
  - license change (§11);
  - vendored engine with every §9.2 patch listed in `vendor/keybr/README.md`;
  - ported keybr tests (about 7.1k LOC) with rebuilt fixtures;
  - resolver (whitespace table, plain, layer holds, user and firmware Shift, LT/MT tap side, costs) with tests;
  - Svalboard `Keyboard` adapter and Guided lesson generation in English, Center-first and Frequency orders;
  - `store/` with the §8.2 packing, snapshots and the memory twin;
  - measured size of the trimmed engine, recorded in this spec (§9.8).
- **Acceptance:**
  - a new profile on `sval-default.svil` starts with the 6 center letters; the 7th unlock is `j` and the 8th `e` (§6.3);
  - every listed engine, resolver, timing and store test passes;
  - no import of `@keybr/code` or book assets remains in the bundle graph.

**M1b. Practice core UI (Keymap only).**

- **Scope:**
  - nav item **Practice** (`Gauge`) shown, and the Practice workspace on MW's model; `PracticeProvider`'s `PracticeEngine`;
  - P0 frame with **Lessons · Progress** pills; the Lesson panel (P3) and the Progress panel's Profile and Scope sections (G2) in the shared detail panel, with Esc and the typing-surface return focus (§4.1);
  - P1 with every §5.3 state except live-only ones, including the type row with the on-page lesson type control and the status slot. Until M3 the control offers only **Guided**; M3 adds Drill, Words and Custom;
  - P2 Start; P3 with Guided, Targets, Typing, Board, Input, Keymap and About sections;
  - G1 Summary, Speed and Characters sections;
  - Paranoid content bundling;
  - bundle checks.
- **Acceptance:**
  - Keymap source rules (§5.4): on a connected board with Live Updating **on**, remapping one letter in the editor restarts only that letter; with it **off**, the letter restarts only after **Apply**, and the Unsent changes notice shows meanwhile; on a loaded file, editing the draft restarts only that letter;
  - panel behavior: the Practice nav item opens Lessons with the Lesson panel; at ≥ 1100 px and in bottom-bar layout typing continues with the panel open after a click on the text card; at 900–1099 px in side layout focusing the typing surface closes the panel; Esc in the panel closes it and the lesson resumes on Enter; changing a lesson-shaping setting regenerates the text at once;
  - the lesson type control regenerates the lesson and returns focus to the typing surface;
  - the text card does not move when any banner or notice appears;
  - every listed UI test and the theme test pass;
  - `build:paranoid` passes;
  - bundle budgets are met;
  - works in Firefox with no board (QWERTY example).

**M2. Live · USB.**

- **Scope:**
  - `usbSampler` (outside React state), `correlate` (history interval, effective layer from held keys, delayed output), the mode machine and P4;
  - pressed and wrong-key states on the board;
  - observed attribution and the six error classes;
  - **Read key presses** setting; Caps Lock and Layer locked notices;
  - `docs/paranoid.md` update.
- **Acceptance:**
  - ≥ 95% of hits observed (not inferred) on the Mule at the M0-measured rate, including `!` through `LT1`;
  - sampling stops within 100 ms of blur (test + manual);
  - unplugging mid-lesson falls back without losing the lesson;
  - **replugging mid-lesson** restarts the lesson, reopens Practice on the Lessons page and keeps the profile;
  - Paranoid reads only while focused.

**M3. Drills and content.**

- **Scope:**
  - Drill (layer, group, directions, hands, thumbs, Weakest, Numbers with Benford), Words, Custom (P6), Symbols generator, "Nothing to drill";
  - **Drill this key** from P5;
  - resolver support for combos (event layout 2), tap dance and key overrides;
  - the Drill, Words and Custom segments of the lesson type control, the type row's scope button for them, and their P3 sections.
- **Acceptance:**
  - Layer 1 drill on the default keymap teaches digits and symbols adaptively;
  - every symbol template only emits typeable symbols;
  - Custom flags untypeable characters and keeps spaces.

**M4. Progress depth, physical extras and data.**

- **Scope:**
  - G1 Keyboard heatmap with the color heat faces and usage ramp (§5.0.2), Fingers, Thumbs, Layers, History;
  - G2 Data rows: export, import (with the Replace confirm) and reset;
  - P5 full (sparkline, Pressed instead, reach, Drill this group);
  - **layer-reach timing, stray presses and OS layout mismatch detection** (kept out of M2 so M2 stays small; see Q7);
  - event retention and pruning;
  - the color-blind heat palette only if Q9 is answered yes.
- **Acceptance:**
  - heatmap values match the character table for the same scope;
  - keys at target show the plain face and the check; no heat face shows a layer color;
  - heat-face text meets 4.5:1 in both themes (§5.0.2 values, measured against the built CSS);
  - Inferred labels appear by rule;
  - export → reset → import round-trips byte-identical results;
  - a symbol drill on a correct OS layout never shows the mismatch notice;
  - narrow layout has no horizontal page scroll.

**M5 (optional). Live · Host.**

- **Scope:** `hostSampler` on allowed origins, the **Host board** keymap source (§5.4), and P4 Host actions. To keep N1 and OD1, M5 shares nothing with Overlay: it runs **its own** `useHost()` instance (the Host client module `host.ts` used as a library, no Overlay UI, state or provider), polls only while the practice text has focus, and **never writes Host settings**. Host reports `pressed` only while its `highlightPressed` setting is on ([kb] `__main__.py:386`), and that setting belongs to Overlay's Feedback tile, so M5 reads `pressed` when the user has turned it on there and otherwise gets layer-following only (every hit inferred). P4 shows which, as a row value (`Pressed keys · Turn on Highlight held keys in Overlay`).
- **Acceptance:** works from next.keybard with a stock Host; refuses on the test site; refuses when the practiced keymap is not the Host's board; Firefox + Host gets layer-following, plus best-effort attribution when Highlight held keys is on; Host config is never written by Practice (a test spies on `configure`).

---

## 13. Risks and open questions

### 13.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| WebHID poll rate or latency too low to catch short taps (UNVERIFIED; Matrix Tester uses 50 ms, which would miss taps under 50 ms) | Physical stats become mostly inferred | M0 measures before M2 commits. Fallback is per-keystroke inferred attribution. Firmware edge-FIFO stays an option (§10). |
| Continuous polling affects firmware scanning or USB | Typing glitches | M0 firmware-load check; one request in flight; poll only while focused |
| DOM vs matrix clock skew; tap-hold keys emit on release under permissive hold; tap dances emit after the tapping term | Mis-attribution, inflated times | History-interval correlation; effective layer from held keys; delayed-output timing from press edges (§6.5, §9.3); correlator tests; M0 measures the delay |
| Board tap-hold settings differ from the defaults (runtime-configurable) | Correlator assumptions wrong | The history interval doesn't depend on them; reading them is optional future work (§10) |
| OS layout ≠ Keybard `internationalLayout` | Wrong expected characters and paths | Live mismatch notice with a one-click fix (eligible steps only); keymap-only can't detect it |
| Keymap edits mid-lesson | Stale lesson | Fingerprint check, then restart notice |
| Any connect unmounts the editor, Practice and Overlay | Lost in-progress lesson | At most one lesson lost; the hash route restores the workspace and page (§4.2, §5.3) |
| AGPL change not done before M1a merge | License violation | M1a gate |
| Engine larger than first estimated (11.6k LOC, not 5k) | Bigger lazy chunk and Paranoid file | Trim `keybr-keyboard`; measure in M1a; budgets in §9.8 |
| Paranoid file size growth | Slower load | ≤ 550 KB budget; EN only |
| Hidden-but-mounted Practice or Overlay leaks listeners or timers ([kb] `EditorLayout.tsx:1214` pattern) | Background reads; Recall keeps hiding desktop legends | Every Practice effect gated on its workspace being active, the Lessons page and focus (D10); Recall publishing gated on the Overlay workspace (§5.15); tests |
| IndexedDB unavailable (private windows) | No persistence | In-memory store + persistent notice |
| Chrome-only WebHID | Firefox/Safari never Live | Keymap-only works fully. M5 Host covers Firefox on allowed origins. |
| `generateAllKeycodes` global mutation | Wrong custom-keycode labels for non-active boards | Resolve against the active board; custom keycodes → no path |
| One half not working (unlinked inter-half cable) | Every letter from that half is a miss | Out of scope in v1 (N9). Drill → Hands for deliberate one-handed practice. |
| **Pushed panel shrinks the board** (§5.1): at 1440 px with the rail expanded, the Lessons board drops from medium to a scaled small board while the Lesson panel is open | Harder to read the hint board with the panel open | The size rule re-runs after the transition; closing the panel (nav item, X, Esc) restores the medium board; below 1100 px the panel overlays instead and closes when typing starts |
| **Color-role change touches every editor user** (MC) | Users used to red selection; screenshots in docs and the manual go stale | Ships to next.keybard first for the owner's trial (**Q10**); one PR with before/after shots; the manual's screenshots are refreshed in the same release |
| kb-blue is both the select color family and a layer color | A selected key on a blue layer could be misread | Selection is a light tint face with a ring and offset, not a saturated blue face (§5.0.1); M-35 draws it on layer 2 |
| Overlay state lift (`TrainerPage` → `OverlayProvider`) changes effect timing | Host config written twice, or Recall not cleared | Effects move unchanged; MO tests for mirroring and Recall cleanup; manual Host checklist (§12 MO) |
| Two `useHost()` instances if M5 is built (Overlay and Practice) | Two loopback polls at 80 ms while the practice text has focus and Overlay has been opened | Accepted to keep N1: M5 shares no state with Overlay. Its poll runs only while the practice text has focus (D10), so the overlap is bounded by typing time; Host serves `/api/host/state` per request ([kb] `host.ts:62-71`). |
| Overlay or Practice providers start work at app load (D15) | Host bootstrapped and polled at 80 ms from launch; remounted editor | Always-mounted shells with the engine gated on first visit (§4.1 Mounting); tests for no Host contact before first open and no remount (§9.9) |
| Heat colors and color-vision deficiency | Red, orange and yellow hard to tell apart by hue | Luminance-ordered steps, printed values, check at target, scale line (§5.0.2); optional palette is **Q9** |

### 13.2 Questions for the owner (each has a recommendation)

Revision 2's Q2 (landing pill), Q8 (where Overlay lives), Q9 (pressed color) and Q10 (heatmap palette) are closed by owner decisions OD1–OD5 (§0.1). The rest are renumbered.

- **Q1. Default unlock order for new "Learn" profiles.**
  - *Center first* (§6.3): teaches Svalboard motions in order of difficulty, but t/n/h arrive late.
  - *Frequency* (keybr default): real words sooner, all directions from lesson 1.
  - **Recommend Center first** for the "Learn from the center keys" preset. Frequency stays one control away in the Lesson panel. The QWERTY preset includes all letters, so it is unaffected.
- **Q2. License identifier for Keybard.**
  - **Recommend AGPL-3.0-or-later.** It matches keybr's unversioned AGPL `LICENSE` and keeps future compatibility.
  - This must land before M1a merges. Licensing is your call; this spec only flags the dependency.
- **Q3. Include Keybard Host as a live input source for Practice (M5)?**
  - **Recommend no for now.** USB covers Chromium users. Host adds coarse data and a keymap-matching requirement (§3.2). Revisit if Firefox/Safari users ask. It is an input source only; it adds nothing to Overlay (N1).
  - If built, M5 is fully separate from Overlay (§12 M5): its own Host client, and it never writes Host settings. Host reports presses only while **Highlight held keys** is on, which is Overlay's setting, so Practice gets physical attribution from Host only when the user has turned that on, and layer-following otherwise. Revision 2's handshake (Practice turns the setting on and restores it on exit) was dropped because it made Practice write a setting Overlay owns, which OD1 rules out. If you would accept that one Host-config interaction as a named exception to N1, say so and M5 can bring the handshake back.
- **Q4. Paranoid: may Practice read key presses while it is open and focused?**
  - **Recommend yes**, with the `docs/paranoid.md` wording in §10. Without it, Paranoid Practice is keymap-only.
- **Q5. Per-keystroke event retention.**
  - Events take about 20 B each in the §8.2 layout, about 3.3 KB per 150-character lesson including misses, backspaces and strays.
  - **Recommend the last 1,000 lessons per profile (≈ 3.3 MB)**, with results and aggregates forever. Alternatives: 2,000 lessons (≈ 6.6 MB); 300 lessons (≈ 1 MB); or aggregates only, which is smallest but means stats can't be recomputed after an engine improvement.
- **Q6. Profile scope.**
  - **Recommend one local profile by default, chosen by the user, never by the board** (§8.1). Stats are keyed by physical path, so different keymaps share a profile safely, and the identity problems of board-keyed profiles (files and the example all carry the Svalboard model UID; decimal vs hex `kbid`) disappear. Settings stay global; daily goal is per profile.
  - Alternative: one profile per board (serial, else UID). This needs the kbid normalization in §8.1, still merges every serial-less Svalboard into one profile, and needs a "move history to this board" action for replacements.
- **Q7. Production launch order and MVP cut.**
  - **Recommend promoting MC, MW and MO first**, together, at the next launch tag after they have run on next.keybard for a week: they are independent of the engine, they fix the Overlay page's off-system look, and Host's `/#trainer` link keeps working. MW alone is not worth promoting (it only renames the nav item). Then **promote Practice after M2** (Keymap-only Practice plus Live · USB attribution, Guided lessons, basic Progress), the smallest release that does what keybr can't on a Svalboard.
  - Cut list, deferred to M4 or later unless you want them at launch: OS layout mismatch detection, stray-press tracking, layer-reach timing, per-keystroke event storage beyond results, Fingers and Thumbs grids, the Keyboard heatmap, export/import, symbol generator and Custom text (M3).
  - The M0 lab view (`?practiceLab=1#practice/lab`) ships to next.keybard and the test site only. **Recommend** removing it before the first production launch tag that includes Practice, or leaving it unlinked; your call.
- **Q8. New components.** §5.0.3 lists 16 components with no Keybard equivalent (N-15 Color field and N-16 preview card are new in revision 3).
  - **Recommend approving the list as a whole.** Each row has a decline box; declining a row means finding an existing idiom or dropping the feature that needs it.
- **Q9. Color-blind heat palette (new).**
  - The standard heat faces are luminance-ordered and every key prints its value (§5.0.2), so they are readable without hue.
  - **Recommend no setting in v1.** Add the viridis-style palette (one token set and a **Heat colors: Standard · Color-blind** SegmentedControl in the Progress panel, about half a day) if a user asks. Alternative: ship it in M4.
- **Q10. Keep the new color roles after the trial (new).**
  - MC changes every editor user's selection and pending colors.
  - **Recommend keeping them** if a week on next.keybard brings no regressions you dislike, then promoting with Q7's first launch. Reverting is one PR: the roles are tokens, and the call sites are listed in §5.17.

---

## Appendix A. Screens to mock up

### A.1 Global rules for every mockup

- **Frame:** 1440 × 900 desktop, nav rail **expanded** (208 px, `ml-2`, `rounded-3xl`), unless a row says otherwise. The "layout" group reads **Layouts · Practice · Overlay**, with the 3 px `bg-kb-active` indicator on the current workspace's item.
- **Panel:** when a row says "panel open", the detail panel is drawn at its real geometry (left of the page, `min(32rem, …)`, `top-2 bottom-2`) and the page is **pushed** (≥ 1100 px), so the page is about 714 px wide. Rows without "panel open" show the panel closed.
- **Themes:** produce **light and dark** for every screen marked ◐. Dark = `.dark` tokens from `research/keybard-tokens.css`, plus the §5.0.1–§5.0.2 tokens.
- **Board:** keymap `src/default-layouts/sval-default.svil`, layer 0 legends, layer colors from its `cosmetic.layer_colors` (0 green `#099e7c`, 1 orange `#f89804`, 2 blue `#379cd7`). Geometry `fragments_finger5` from `research/svalboard-geometry.json`. Key caps follow the `Key.tsx` spec (visual-language §4); medium variant (45 px) unless stated, small (30 px) when the panel is pushed.
- **Practice sample state** (use consistently). It follows the Center-first unlock order of §6.3: the six initial center letters, then `j` as the 7th.

  | Field | Value |
  |---|---|
  | Profile | "Me" |
  | Lesson | Guided, Center first |
  | Included | a s d f l k j |
  | Focus | j (the newest key, lowest confidence) |
  | Locked | e r i o u c m w p v x q z t n h y g b (`e` unlocks next) |
  | Last lesson | 31.6 wpm ▲1.2, 96.4 % ▼0.3, score 1,284 |
  | Keys | 7 / 26 |
  | Today | 12 / 15 min |
  | Text | illustrative pseudo-words of a s d f j k l, each containing `j` (§5.2): line 1 `jask flaj sjal kadj jalls fajd` (typed through "jask fla", with the `a` of `jask` recovered after a miss), line 2 `jakd fjasl kajls djask jafl sjad`, line 3 `jadk fajls kjas djall sajk jlad` |
  | Next key | `j` → right index C (index 38) |
  | Pressed now | `a` → left pinky C (index 26), just typed |
  | Progress scope | Me · Last 30 days, 120 lessons |

- **Overlay sample state:**

  | Field | Value |
  |---|---|
  | Host | connected, `vLaunch2.1`, Keybard `61db58a` |
  | Host board | "Svalboard · Mule", following (live), layer 0 |
  | Appearance | preset **Outline only** (`core.ts` DEFAULTS) |
  | Feedback | Short fade, 150 ms; Highlight held keys on |
  | Preview background | Dark |
  | Panel tile | Appearance |
  | Familiar binding | `Left · W · 21` (L-ring N), deliberately not the Recall target `Q` |

- **Editor sample state (M-35):** default keymap, layer 0 selected in the editor, manual updates (Live Updating off). L-middle C (`d`) **selected**; L-middle N (`e`) **pending** (remapped, unsent); L-index C (`f`) **selected and pending** in the second frame; R-index C (`j`) **hovered**; the Apply button shows 2 pending edits. A second panel repeats the selected key on layer 2 (blue faces).
- **Typeface:** Inter only. No explanatory paragraphs anywhere; tooltips may be shown open where a state calls for it.
- **Annotations:** each mockup carries a side legend that maps every element to its Keybard idiom from §5.0, or to its row in §5.0.3 when it is new. Numbered badges sit just outside the annotated element's top-left corner (or beside its left or right edge where that corner would cover another annotated element), never on top of the state under review; the page's **Callouts** toggle hides them. "Before/after" mockups show today's look on the left and revision 3 on the right, at the same scale.

### A.2 Mockup list

**Practice · Lessons**

| # | Screen / state | ◐ | Exact contents |
|---|---|---|---|
| M-01 | **P1 Lessons · Live · USB · typing** | ◐ | Full §5.2 layout, panel closed. Header **Practice** with **Lessons** pill active; status pill **Live · USB** (green dot). Type row: **Guided** selected, scope button `Center first ›`, empty status slot. Board: layer 0 live; `j` ringed in ink; right-index cluster backdrop; `a` **pressed now** (`kb-pressed` face: black in light, near-black `#111214` in dark, beside light-gray keys); locked letters dashed; mods light-gray. Caret after "jask fla". Nav indicator on **Practice**. |
| M-02 | P1 · **Opened from the nav: panel open, pushed** | ◐ | Same lesson, Lesson panel open beside the rail (title **Lesson**, Guided section first), page pushed to about 714 px: key strip, metrics wrapped 3 + 2, type row wrapped, text card, small board scaled about 0.9. Text card shows **Paused** with **Resume** (focus is in the panel). Second frame: after a click on the text card, typing continues with the panel still open; status pill **Live · USB**. |
| M-03 | P1 · **Layered next character** | ◐ | Punctuation slider above 0, so `!` appears. Caret before `!`. Panel 1, board on layer 0: R-thumb T5 (`MO(1)`, ink ring) and L-thumb T1 (`LT1`, dashed outline) keep their own headers and get step badge `1`, faces orange; L-pinky N shows `!` on an orange face with step badge `2`. `!` underlined orange in the text (pending). Panel 2: the user holds T5 (`kb-pressed` face) and the board follows to layer 1, L-pinky N ringed. |
| M-04 | P1 · **Wrong key (live)** | — | Light only. Expected `j`; user pressed R-middle C (`k`). Text: current character with the red tint and wavy underline. Board: R-middle C with `border-2 border-kb-red` and the `×` badge, R-index C still ringed. |
| M-05 | P1 · **Keymap only** | ◐ | Status pill **Keymap only** (gray ring). No pressed state. Board shows the next character's layer. Otherwise as M-01. |
| M-06 | P1 · **Paused** | ◐ | Panel closed. Text card blurred, **Paused** title + ink pill **Resume**; board at 60% opacity; status pill **Paused**. |
| M-07 | P1 · **Lesson complete + banners** | ◐ | Metrics with deltas. Status slot (right of the type control) banner: medium cap `e` (green) + **New key** + chips `Layer 0` `L-middle N`. Board: L-middle N pulsing (2-frame strip). Key strip: `e` with zoom-in and the uncalibrated `?`. Extra crops: **New top speed** and **Daily goal reached** banners in the same slot. |
| M-08 | P1 · **Loading** | — | Skeleton per §5.3; type row with the control and an empty slot. |
| M-09 | P1 · **Notices in the status slot** | — | Eight crops of the type row, one notice each, at the same position: **Keymap changed · lesson restarted**; **Typed characters don't match US layout** + inline select; **Progress isn't being saved**; **Practicing the board's keymap · unsent edits excluded**; **Caps Lock is on**; **Layer 1 is locked on**; **Board connected · lesson restarted**; **Progress was saved by a newer Keybard**. One crop shows a truncated notice with its tooltip open. |
| M-10 | P1 · **Empty / error wells** | — | Three variants, each with the board in the no-lesson look: **No letters to practice on this keymap** (quiet pills **QWERTY example**, **Layouts**); **Practice words didn't load** (ink pill **Retry**); **Nothing to drill in this scope** (ink pill **Change scope**, which opens the Lesson panel). |
| M-11 | P1 · **Narrow 1000 × 800, panel over the page** | ◐ | Rail collapsed (48 px). Side layout below 1100 px: Lesson panel overlays the left of the page (not pushed). Second frame: after a click on the text card the panel has closed and typing continues; board small (30 px); type row on one line (container about 952 px, ≥ 900). |
| M-12 | P1 · **Bottom-bar layout 860 × 900** | — | Auto bottom-bar (< 900 px). Lesson panel docked at the bottom, `min(60dvh, 36rem)` tall; page shortened above it by `padding-bottom` and scrolled to the text card; text card and a scaled board visible above the panel; typing continues with the panel open. |
| M-13 | P1 · **Phone width 390 × 844** (for completeness; Keybard isn't a phone app) | — | Panel closed. Board hidden, **Board** floating button, text 22 px, metrics 2 + 2 + 1 with unwrapped values, type control full width, `+19 locked`, `pb-24`, no horizontal scroll. |
| M-14 | **P2 Start** | ◐ | §5.4 on a floating card: three tiles with **Learn from the center keys** selected; Keymap select "Connected board"; Target 25 wpm; green **Start**; board below with a s d f k l lit green, other letters dashed. Type row hidden. Second state: no tile selected, Start disabled. |
| M-15 | **P3 Lesson panel · Guided** | ◐ | Panel open and pushed, over a paused lesson. All §5.5 rows: Guided, Targets, Typing, Board, Input (**Paused**), Keymap, About. No Type tiles and no Data row. Third shot: the About popover open. |
| M-16 | P3 · **Drill, Words, Custom** | — | Drill: type control on the page reads **Drill**, scope button `Layer 1 · Symbols · N S ›`; panel Drill section with Layer pills (Layer 1), Group tiles (Symbols), Direction chips N and S on (no 2S chip), Hands, Thumbs, In scope row. Crops of the Words and Custom sections. |
| M-17 | P3 · **Saving / error footers** | — | Two footer variants. |
| M-18 | **P4 Input popover** | ◐ | Three variants with outcome rows: Live · USB (Pressed keys Shown, Stop reading keys); Keymap only with green **Connect board**; Keymap only in Firefox (Pressed keys "Not shown · needs Chrome or Edge", no disabled button). |
| M-19 | **P5 Key popover** | ◐ | For `!`, opened from its key-strip cap in a Layer 1 drill (the cap shows the select ring): header cap orange + chips `Layer 1` `hold R-thumb T5` `L-pinky N`, `or hold L-thumb T1`; stats; sparkline; **Pressed instead** (`q` ×3 wrong layer, `1` ×2 wrong direction, `@` ×1 wrong finger); Layer reach 182 ms; **Drill this key**. Further variants: aggregate cell "L-middle · N" with **Drill this group**; "No samples yet" (locked `e`); inferred only. |
| M-20 | **P6 Custom text** | — | Textarea with sample code text, counter, **Not on this keymap:** chips `é` `—`; Cancel / Use text. |
| M-21 | **P1 Lessons · Drill · Layer 1 symbols (live)** | ◐ | Type control **Drill**, scope `Layer 1 · Symbols · N S ›`. Key strip of the scope's symbols in orange; **At target** cell `3 / 8`; text of symbol tokens with layer underlines on pending characters, every token containing the focused `#`; the user holds R-thumb T5, so the board shows layer 1 with the next symbol ringed. |

**Practice · Progress**

| # | Screen / state | ◐ | Exact contents |
|---|---|---|---|
| M-22 | **G1 Progress · full page, panel open** | ◐ | Tall frame. Header **Practice** with **Progress** pill active and `Me · Last 30 days` at the right. Progress panel open (Profile **Me**, Period **30 days**, Data rows, About). Page: Summary; Speed chart (solid blue speed, dashed purple accuracy, dotted target at 35 wpm, direct labels, 120 lessons); Keyboard heatmap (metric **Speed**, divider, Layer 0 pill, scale line `■ < 18 · ■ 18–26 · ■ 26–35 · ✓ ≥ 35 wpm`) with red/orange/yellow faces on slow keys, plain faces on keys at target with the check before the value in the footer, values in footers, no layer color, unscaled small board scrolling horizontally inside its section; Speed chart labels in ink with stroke samples; Fingers grid with direction glyphs and the same faces, no 2S row; Thumbs; Layers table; Characters table (first 10 rows); History (first 8 rows). |
| M-23 | G1 · **Heatmap variants** | ◐ | Board only, small multiples: **Speed**, **Accuracy**, **Errors** (far/mid/near/at target, each with its scale line), **Usage** (blue ramp, quartile scale line), and **Speed on Layer 1**. Each in light and dark. Light-theme heat faces and swatches carry the `kb-gray-border` edge; footer values legible at 10 px with the check beside them. |
| M-24 | G1 · **Heat colors and color vision** | — | One Speed heatmap in four renderings side by side: as designed, simulated deuteranopia, simulated protanopia, grayscale; the luminance order (far 0.17 → mid 0.34 → near 0.60, steps 1.74:1 and 1.68:1) and the printed values carry the meaning in all four, and mid and near stay distinct. A fifth panel shows the optional viridis-style palette from Q9, labelled "not in v1". |
| M-25 | G1 · **Inferred labels** | — | Keyboard and Fingers section titles with the **Inferred** chip; tooltip shown as on focus. |
| M-26 | G1 · **Empty, loading, storage off** | ◐ | **No lessons yet** + green **Start practicing**; loading skeleton; storage-off notice. |
| M-27 | **G2 Progress panel · Data** | — | Panel crops: default; after choosing an import file (`412 lessons · 2 profiles`, Merge selected, **Import**); Replace selected (destructive **Replace progress…**); Replace confirm dialog; invalid-file error line; Reset confirm dialog; **New profile** dialog; storage-off rows. |

**Overlay**

| # | Screen / state | ◐ | Exact contents |
|---|---|---|---|
| M-28 | **O1 Overlay · Host connected, panel open (Window)** | ◐ | Overlay sample state. Nav indicator on **Overlay**. Header **Overlay**, status pill **Keybard Host vLaunch2.1** (green dot). Host card (Board select **Svalboard · Mule**, Hide overlay, Reload layout, Disconnect; `Keybard Host vLaunch2.1 · Keybard 61db58a`). Preview card on the Dark background with the Outline only overlay, footer **Live board** and Background control. Layout row **Live board · read-only**, Layers row hidden. Panel **Overlay** with tiles, **Window** selected: Hands, Size, Drag by keys (tooltip open), Place at bottom, Reset. |
| M-29 | O2 · **Appearance** with the Color field | ◐ | Panel on **Appearance**: Preset **Outline only**, Key fill / Outline / Legend rows (swatch, hex value, opacity slider), Outline thickness, Legend halo, Layer change, Pressed key. Color field popover (O3) open on **Outline**: brand swatches, white and black, hex input `#dce5ec`, **More colors…**. Second crop: invalid hex with **Use #rrggbb**. Footer **Saving…** with the amber pending dot. |
| M-30 | O2 · **Feedback** | — | Two crops: Host connected (Off · Flash · **Fade**, Duration 150 ms, Highlight held keys ON, Preview held keys) with three preview keys lit in the Pressed color; Host connected on old firmware (Held keys **Unavailable on this firmware**). Third crop: highlight **Off**, so Duration is hidden. Fourth and fifth crops: **Window** and **Feedback** with Host not connected (the Host-connected-only rows are absent, not disabled). Sixth crop: **Window** on older firmware with **Desktop default layer** (`0 · Base`, value line `Older firmware`). |
| M-31 | O2 · **Recall** | ◐ | Recall ON, following: **Desktop legends · Hidden while recalling** row; Recall card **Find this binding**, `Q`, `Left hand`, ink **Reveal**, `3 remembered · 5 attempts`. Second state after Reveal: **Remembered** / **Again**, the target key outlined in the user's Layer change color on the preview (no select ring on it). Familiar bindings: Binding select `Left · W · 21` (that preview key carries the two-tone select ring; the Recall target `Q` never does while unrevealed), **Mark familiar**, **Clear**, Hide familiar legends. Extra crops in **dark theme**: the preview with the selection ring on the **Light** and **Busy** backgrounds (dark halo). |
| M-32 | O1 · **Not connected** | ◐ | Three variants: web (status pill **Keybard Host not connected**, **Desktop overlay** well with green **Download for Windows**, quiet **Connect to Keybard Host** with its tooltip, link row), with the preview, Layout row (**Connected board**: a board is connected over USB) and Layers row (Default layer select, Preview layer pills with House on layer 0) below; **web · Connect pressed, Host not running** (error notice **Can't reach Keybard Host at 127.0.0.1:5178** + **Try again**, Desktop overlay well below); Paranoid (well **Start Keybard Host in paranoid mode**, chip `Start-Paranoid.cmd`, no actions; no board connected, so the Layout select reads the file name `sval-default.svil`). |
| M-33 | O1 · **Host states** | — | Crops: no board chosen (Select a Svalboard; dashed **No board selected** well in the preview; footer source `No board`); board not valid (Host status text as the row value); connection lost (red dot pill, error notice **Keybard Host connection lost**, no Host card and no Desktop overlay well, preview on the Layout select's own source); **Host command failed** (error notice with Host's message above the Host card); overlay hidden (Host card's **Show overlay** with `Eye`); outdated Host (notice **Keybard Host vLaunch2.1 is available** + **Download**); import error line; Overlay panel footer **Settings couldn't be saved**. |
| M-34 | O1 · **Narrow and bottom-bar** | — | 1000 × 800 with the panel over the page; 860 × 900 bottom-bar with the Overlay panel docked; Host card wrapped. |

**Editor color roles (E1, before/after)**

| # | Screen / state | ◐ | Exact contents |
|---|---|---|---|
| M-35 | **Editor keys · before/after** | ◐ | Editor sample state. Before: selected `d` red fill and ring; pending `e` red border; `f` selected-and-pending (pending border hidden by the red fill); hovered `j` red inset ring; Apply button with the red ring. After: `d` light blue face with `kb-select` ring and light strips, painted over its neighbors; `e` amber dashed border; `f` blue ring and tint **and** amber dashed border; `j` blue ring outside the key with an offset (not inset); Apply with the amber dashed outline. Second row: the selected key on layer 2 (blue faces) after the change. A layer pill shown as a drop target, before (red) and after (select). |
| M-36 | **Matrix Tester · before/after** | ◐ | Same matrix state: three keys held, five "was pressed" keys (black), the rest white. Before: held keys red. After: held keys with the strong select look (`#2b86bd` face, 3 px `kb-select` ring with offset); in dark theme the black keys carry the `kb-gray-border` outline. |
| M-37 | **Binding editor and palette · before/after** | ◐ | Combo editor slot selected; palette key hovered and selected; drag overlay over a slot; bindings-list item hover; the Layouts panel file-drop target (before: blue dashed; after: solid `kb-select` border on a faint tint). Before red, after select role. A trash button hover beside them stays red in both (destructive). Light and dark, so the drag-hover header on `kb-select-strip` and the palette tint can be checked against `kb-surface` in dark. |

**Reference**

| # | Screen / state | ◐ | Exact contents |
|---|---|---|---|
| M-38 | **Visual-language sheet** | ◐ | One board-free sheet showing every idiom beside its Keybard source: pills (LayerSelector), SegmentedControl sm and md (OnOffToggle), ToggleChipGroup, category tiles (Settings), OnOffToggle, detail panel (pushed and docked), floating tool button, status pill, notice and error notice, empty well, Color field, preview card; color roles (ink, select, pending, red, brand green) with their tokens and contrast values; key cap states (included / uncalibrated / locked / not-in-lesson / next / prerequisite / alternative / pressed (`kb-pressed`) / wrong (border + `×` badge) / selected / hover (outside ring) / pending / selected + pending / Matrix Tester held (strong select) / heat far, mid, near, at target / use-1..4 / no data); text states (pending / typed / miss / recovered / caret / layer underline). |

---

## Appendix B. Review log

### B.1 Revision 3: owner decisions

Revision 3 applies five binding owner decisions (§0.1). Each was applied throughout the document, not appended; text that contradicted them was removed. Keybard facts used for them were re-read in the [kb] snapshot (`61db58a`): `Sidebar.tsx`, `PanelsContext.tsx`, `EditorLayout.tsx`, `SecondarySidebar.tsx`, `PanelContent.tsx`, `use-mobile.ts`, `LayoutSettingsContext.tsx`, `TrainerPage.tsx`, `HostInstall.tsx`, `host.ts`, `core.ts`, `OverlaySurface.tsx`, `trainer.css`, `Key.tsx`, `MatrixTester.tsx`, every red, blue and amber utility in `src/`, `index.css`, `tests/theme/*`, Host's `__main__.py:463`.

| Owner decision | What changed |
|---|---|
| **OD1 Split** | D1 rewritten; the Trainer shell (T0) and its three pills are gone. Practice (pills **Lessons · Progress**) and Overlay are separate nav items with lucide `Gauge` and `PictureInPicture2` (§4.1, reasons given). New `workspace` model replaces the Trainer full-workspace special case (§4.1 table, verified against `PanelsContext.tsx:35,49-57`, `Sidebar.tsx:183-211`, `EditorLayout.tsx:1087-1089,1126-1127,1214-1220`). Deep links `#practice`, `#practice/progress`, `#overlay`, with `#trainer` kept as an alias because Host opens it (§4.2). N1 now forbids convergence features. Module layout split into `src/features/practice/` and the existing `src/features/trainer/` for Overlay (§9.1). Storage renamed to `keybard-practice` (D7, §8). Resolved rev-2 Q2 and Q8. |
| **OD2 Restyle Overlay in v1** | New D11 and §5.14–§5.16: a 20-row capability table mapping every existing behavior to its new place, page layout, panel tiles **Window · Appearance · Feedback · Recall**, every state, copy changes. New components N-15 Color field and N-16 preview card. New milestone MO (9–13 days, parallel with M0/M1a). Mockups M-28–M-34. N1 (non-goal "restyle") removed; N10 states the surface is untouched. |
| **OD3 Panel from the nav item** | New D12; §4.1 specifies the click table, close, Esc (scoped to Practice and Overlay panels; editor panels have no Esc handler today), focus on open and close (`SecondarySidebar.tsx:78-87` plus a `returnFocusOverride`), typing with the panel open (push at ≥ 1100 px; focusing the surface closes an overlaying or docked panel), deep links, bottom-bar layout (`getDetailPanelHeight`). The gear button is removed (§5.1). The lesson type moved to an on-page SegmentedControl in a type row shared with the status slot (§5.2). The Lesson panel lost its Type tiles and Data row; Progress filters and data moved into the Progress panel (§5.9), which replaces the Data dialog. The "Lesson panel open" pause trigger became the ordinary blur rule (§3.2, §5.3). Board-size effect of the pushed panel recorded (§5.1, risk). |
| **OD4 Color roles** | New D13, §5.0.1 (tokens `kb-select`, `kb-select-tint`, `kb-select-strip`, `kb-pending` with light/dark values and contrast) and §5.17 (every call site in `src/`, with citations; "red stays" list; dead `pending-change-styles.ts`). Theme guard gains the **red-reserved** rule. New prerequisite milestone MC. Pressed-now in Practice stays ink, with a justification; Matrix Tester pressed takes the select role. Mockups M-35–M-37. Resolved rev-2 Q9. |
| **OD5 Color heatmap** | New D14 and §5.0.2: far/mid/near faces (kb-red, kb-orange, kb-yellow) with white or dark text and contrast; at target plain with a check; Usage blue ramp, themed; no layer color on heat faces; luminance order, printed values and scale lines as color-vision mitigation; optional viridis-style palette not built (new **Q9**). §5.8 thresholds (Errors now an absolute rate), Fingers and Thumbs, N-9, M4 acceptance, mockups M-22–M-24 updated. Resolved rev-2 Q10. |

Other revision-3 changes made for consistency:

- §13.2 renumbered: rev-2 Q1, Q3, Q4, Q5, Q6, Q7, Q11, Q12 are now Q1–Q8; new Q9 (color-blind palette) and Q10 (keep the color roles after the trial). Every cross-reference in the document follows the new numbers.
- Q7 now recommends promoting MC and MO before Practice.
- Milestones re-estimated: total MC–M4 about 55–81 days of work (rev 2: 42–62), with a dependency column (§12).
- Appendix A renumbered M-01–M-38, adding the nav-opened panel (M-02), narrow and bottom-bar panels (M-11, M-12), heat variants and color-vision check (M-23, M-24), the Progress panel (M-27), seven Overlay screens and three before/after editor screens.
- The lab view moved to `?practiceLab=1#practice/lab`.

Superseded revision-2 dispositions (kept below for history): ux-visual-01, completeness-red-semantics (pressed color; now OD4); ux-visual-03, ux-visual-10 (heat ramp; now OD5); ux-visual-06, completeness-panel-placement (panel overlay, separate instance; now OD3); ux-visual-12 (Overlay placement; now OD1 and OD2); and the Data dialog in ux-visual-14 (now rows in G2, with the same confirm).

### B.2 Revision 3: review of revision 3

Each finding was checked against the [kb] snapshot before acting. **Fixed** means the spec, the mockups (sources in `build/`, `mockups.html` regenerated), or both now reflect it. **Owner** means the question is in §13.2 with a recommendation. No owner decision (OD1–OD5) was reversed.

| ID | Severity | Disposition |
|---|---|---|
| r3-decisions-m11-type-row-wrap | minor | **Fixed.** A.2 M-11 now says the type row stays on one line (container about 952 px, ≥ 900); the conflict note left the M-11 caption. |
| r3-decisions-overlay-states-missing-from-appendix | minor | **Fixed.** Confirmed (`TrainerPage.tsx:130-131`). §5.15 says Host-connected-only rows are hidden, not disabled; §5.16 adds rows for Overlay hidden and for the tiles without Host; M-33 adds Host command failed, Overlay hidden and the panel's **Settings couldn't be saved** footer; M-30 adds Window and Feedback without Host. A.2 lists them. |
| r3-decisions-m32-cant-reach-label | minor | **Fixed.** Variant renamed **Web · Connect pressed, Host not running** in §5.16, A.2 and the mockup; the Desktop overlay well below the notice is now consistent (web origin). No served-by-Host failure state is added: that case is **Connection lost**. |
| r3-decisions-color-role-callsites-incomplete | minor | **Fixed.** Confirmed every cited line. §5.17 adds the Layouts file-drop target (`LayoutsPanel.tsx:299-302` → solid `kb-select` border on a faint tint), the **Active** badge (`LayoutGroupCard.tsx:94` → neutral chip, DECISION), the missing `selected=` and `hasPendingChange=` callers, FragmentsPanel and other blue/amber/yellow uses with their reason to stay, and the widened search. |
| r3-decisions-m37-dark-mismatch | minor | **Fixed.** M-37 is ◐ in A.2 and drawn in both themes; it also gains the Layouts drop target. |
| r3-decisions-mo-blocks-m1b | minor | **Fixed.** MO split into **MW** (workspace model, 3–4 days) and **MO** (Overlay restyle, 6–9 days). M1b depends on MC's tokens, MW and M1a; MO runs in parallel with M1b, M2, M3. Totals unchanged (55–81 days of work); calendar estimate revised to about 35–52 days for two people. Q7, §9.9 and the icon check follow. |
| r3-decisions-m5-couples-practice-overlay | minor | **Fixed (first option).** M5 is now fully separate: its own `useHost()` instance, polls only while the text has focus, never writes Host settings. Host reports presses only while `highlightPressed` is on ([kb] `__main__.py:340,386`), so M5 gets attribution only when the user turned on Highlight held keys in Overlay. N1, §3.3, §9.1, §10, §12 M5, §13.1 and Q3 updated; Q3 tells the owner how to bring the handshake back as a named exception. |
| r3-decisions-pending-text-contrast | minor | **Fixed.** Confirmed 4.48:1. The `· unsaved changes` suffix uses the notice text color `text-amber-800 dark:text-amber-300` (6.3:1); §5.0.1 restricts `kb-pending` to borders, outlines and dots and quotes 4.48:1. |
| r3-decisions-trainer-content-module-name | minor | **Fixed.** `virtual:practice-content` in §7.5, §9.1 `content/loader.ts` and the `src/vite-env.d.ts` declaration (which already holds `virtual:bundled-layers` and `virtual:paranoid-fonts`). |
| r3-overlay-feasibility-host-lost-state | major | **Fixed (option a).** Confirmed (`host.ts:46,68`, `receive()` at `:47-54` never clears `error`, `TrainerPage.tsx:110`). `host.ts` gets one change: a `lost` flag set by the watchdog and the failed poll, cleared by `receive()`, never set before the first snapshot; lost/stale no longer go into `error`. §1.4, §5.14, §5.16, §9.1, §9.9, MO and M-33 updated: while lost, no Host card and no Desktop overlay well; the preview shows the Layout select's source (the old "preview paused" copy was not true and is dropped). Noted: the Recall publish effect's command already clears `error` within a second while Overlay is open (`TrainerPage.tsx:87-90`), which the Host command failed row now relies on. |
| r3-overlay-feasibility-provider-lifecycle | major | **Fixed.** Confirmed (`EditorLayout.tsx:1214-1220`, `host.ts:39,62-71`, `TrainerPage.tsx:20,48-62`). New D15 and §4.1 Mounting: providers are always-mounted shells inside `PanelsProvider`; the stateful `OverlayEngine` / `PracticeEngine` is a sibling rendered only after first visit, publishing through `useSyncExternalStore`, so the tree never changes shape. Requirement and tests: no Host contact before Overlay is first opened; no remount of `SecondarySidebar` or the editor content. |
| r3-overlay-feasibility-connected-board-label | major | **Fixed.** Confirmed (`KeyboardContext.tsx:319,368-370`; `loadedFrom` is exposed, `:40`). The snapshot option reads **Connected board** only when `isConnected`, otherwise `loadedFrom` (file name or `QWERTY example (demo)`), falling back to **Loaded layout**. §5.14, preview footer, M-32 (Paranoid variant now shows `sval-default.svil`) updated. |
| r3-overlay-feasibility-matrixtester-not-workspace | minor | **Fixed.** Confirmed (`LayerSelector.tsx:575-601`, `EditorLayout.tsx:1263-1264`, `Sidebar.tsx:84-95,188`). §4.1 restated: Matrix Tester is an editor mode; the dead `matrixtester` arm is removed; test added (Matrix Tester → Overlay → editor leaves it off). |
| r3-overlay-feasibility-focus-on-open | minor | **Fixed.** Confirmed (`SecondarySidebar.tsx:80-87`, `Sidebar.tsx:200-208`). The focus effect runs on `[state, focusKey]`, with `focusKey` set only for `practice` and `overlay`, so editor panels are unchanged; test added. |
| r3-overlay-feasibility-bottombar-covered | minor | **Fixed.** Confirmed (`EditorLayout.tsx:1196-1205`). Bottom-bar is treated like the push case: typing continues with the panel open, and focusing the surface scrolls the text card into view. §4.1, §5.1 ("Page shortened above the panel"), §5.5, §5.11, §9.9, M1b and M-12 updated. |
| r3-overlay-feasibility-theme-guard-ui-dir | minor | **Fixed.** Confirmed (allowlist entry `src/components/ui`, `scanRepo()` skips it). Shared components move to `src/components/shared/` (§5.0, §5.0.3, §9.1), with a guard self-test that they are scanned. The red-reserved rule also scans allowlisted directories (§5.17). |
| r3-overlay-feasibility-color-field-idiom | minor | **Fixed.** Confirmed (`LayerNameBadge.tsx:326,345-353,445`, `CustomColorDialog.tsx`, no `ui/popover.tsx`). **More colors…** opens the `CustomColorDialog` picker section without the LED target; the native color input is gone; the popover is a portaled Radix Popover, an idiom Keybard already uses (`PendingChangesPopover.tsx:1`). N-15's "why" corrected. |
| r3-overlay-feasibility-red-callsites-incomplete | minor | **Fixed.** Same edits as r3-decisions-color-role-callsites-incomplete, plus ScanLab `:549` (stays amber text, as the text form of pending) and the ProofSheet **Selected** / **Pending** toggles in MC's scope and acceptance. |
| r3-overlay-feasibility-esc-handler | minor | **Fixed.** Confirmed the four inline-edit handlers. §4.1 corrected; the panel Esc handler returns early on `defaultPrevented` and inside open selects, popovers, dialogs and editing inputs; test added (Esc on an open Preset select closes only the select). |
| r3-overlay-feasibility-docs-tooling | minor | **Fixed.** Confirmed (`capture.py:22`, `capture-walkthroughs.py:52-58`, `capture-extra.py:61-63`, Host `README.md`, `RELEASE-NOTES.md`). MO and §10 add the capture scripts, recaptured assets and Host README; release notes wait for the next Host release. Checked further: Host's own UI says **Open Keybard** (`__main__.py:467`), so no Host change is needed. |
| r3-overlay-feasibility-cant-reach-variant | minor | **Fixed.** Confirmed (`host.ts:84,90`, `TrainerPage.tsx:110`). Same edits as r3-decisions-m32-cant-reach-label. |
| r3-overlay-feasibility-older-fw-default | minor | **Fixed.** Confirmed (`TrainerPage.tsx:131`, not gated on `following`). The control is the O2 Window row **Desktop default layer**, shown whenever `host.state && host.state.default === null`, following or not; the O1 Layers row only sets the preview. Capability row 5, §5.14–§5.16, M-30 (new crop) and M-33 (old crop removed) updated. |
| r3-visual-01 | major | **Fixed.** Confirmed 1.17:1 and 1.82–2.79:1. The pressed-now face is a new token `kb-pressed`: the ink face in light theme, near-black `#111214` in dark (5.5:1 or more against every layer face, 13.2:1 against the light-gray keys). The pressed face stays in the dark "you, now" family, as the owner allowed; it isn't a reversal. D13, §5.0, §5.0.1 (the "both themes" claim corrected), N-7, §5.2, mockup CSS updated. |
| r3-visual-02 | major | **Fixed.** Confirmed 1.18:1 and 1.96:1. Matrix Tester held = strong select: `kb-select-strong` `#2b86bd` face (4.0:1 vs white, 5.3:1 vs black, both themes) under a 3 px `kb-select` ring; "was pressed" black keys get a `kb-gray-border` outline in dark. Pairwise contrast table in §5.0.1; M-36 redrawn. |
| r3-visual-03 | major | **Fixed.** Confirmed the cited ratios. The preview selection is a two-tone ring: 2 px `kb-select` inside a 1 px halo chosen by the Background (`#111214` on Light and Busy, white on Dark), which clears 3:1 everywhere (§5.14, N-16). M-31 adds dark-theme crops on Light and Busy. |
| r3-visual-04 | major | **Fixed.** Confirmed. Every swatch (trigger and popover dot) has a permanent `ring-kb-ink/50` hairline; popover dots are named ("Brand green, #099e7c"), use `aria-pressed`, and mark the current color with the ink ring, as LayerNameBadge's dots do (`:327-343`). N-15 and the mockup CSS updated. |
| r3-visual-05 | minor | **Fixed.** Confirmed the inset-ring ratios. Hover is an outside ring with an offset; selected and hovered keys take `z-10`, because editor keys are drawn edge to edge with only the 1 px border as a gap (`Key.tsx:80-86,144`); §5.0.1 says the offset gap, not the hue, separates the ring from blue neighbors. M-35 and M-38 updated. |
| r3-visual-06 | minor | **Fixed.** Confirmed 1.37:1. `kb-heat-mid` is now `#f07f00` (luminance 0.34): steps 1.74:1 and 1.68:1, text 6.9:1. The review's suggested `#d96a00` was not used, because it shrinks the far-to-mid step to 1.35:1. §5.0.2, M-23, M-24 updated. |
| r3-visual-07 | minor | **Fixed.** Confirmed. Light-theme heat faces and scale swatches take a `kb-gray-border` edge; the light usage ramp becomes `#d2e8f7 · #8ec6ea · #379cd7 · #1f6fa0` (steps 1.46, 1.65, 1.80:1; text 16.6, 11.4, 6.9, 5.5:1). |
| r3-visual-08 | minor | **Fixed.** Confirmed 3.04:1 and 4.13:1. Chart labels are `text-kb-ink`, each led by a 16 px sample of its stroke (§5.0, §5.8, mockup chart). |
| r3-visual-09 | minor | **Fixed.** The select ring is never drawn on an unrevealed Recall target (§5.14); the sample Familiar binding is now `Left · W · 21` (A.1, M-31). |
| r3-visual-10 | minor | **Fixed.** Heat faces have no header strip; the check sits before the value in the footer; the Progress heatmap is never scaled below 1.0 and scrolls inside its section, so values render at 10 px or more (§5.0.2, §5.8, §5.1, M-22, M-23). |
| r3-visual-11 | minor | **Fixed.** Same as r3-decisions-overlay-states-missing-from-appendix, plus the **Show overlay** crop. |
| r3-visual-12 | minor | **Fixed.** The no-board preview is the dashed, transparent well in a muted tone for the background; the footer source reads `No board` (§5.16, M-33). |
| r3-visual-13 | minor | **Fixed.** Same as r3-decisions-pending-text-contrast. The amber-800 token alternative was not taken: the notice text color already exists and keeps `kb-pending` a border color. |
| r3-visual-14 | minor | **Fixed.** Confirmed 1.39:1 on green. Wrong key adds a 14 px `×` badge (white on `kb-red`, 4.7:1) beside the red border; it replaces a step badge for its 600 ms. Face contrasts recorded in §5.0.1. §5.0, §5.2, M-04, M-38 updated. |
| r3-visual-15 | minor | **Closed by OD6 (brand colors unchanged).** Former Q11. Confirmed 3.39:1. Listed as a known inherited exception in §5.0 and §5.12. The owner kept the brand colors, so the inherited pill stays as it is. |
| r3-visual-16 | minor | **Fixed.** Mockup badges are now placed just outside the element's top-left corner (`06-doc.js` `placeCallouts`), and A.1 states the rule. |

**Verification.** `mockups.html` was regenerated with `build.py`, and the generated script parses. Headless screenshots of M-01, M-22, M-23, M-30, M-31, M-32, M-33, M-36 and M-37 (in `shots/`, prefix `r3r-`) were checked for the changed states.

**Final verification.** Every major marked Fixed was re-checked in the spec text and in fresh headless screenshots (prefix `vf-`/`vf2-`). `mockups.html` equals a fresh `build.py` output, has a `<title>`, and references only Google Fonts. All 38 Appendix A screens render in light and dark with no console errors, warnings or unhandled rejections. Two small mockup fixes: in O2 Appearance color rows the hex value and the swatch were not laid out as a flex row, so the hex ran into the swatch (`01-head.html`, M-29); in M-35 the pending badge covered the **Apply 2 Changes** pill and hid the selected badge, so it now sits beside the key's right edge (A.1 rule widened to allow this).

### B.3 Revision 2: review of revision 1

Revision 2 applies the review of revision 1. Each finding was checked against the snapshots before acting (and, for tap-hold, against the read-only `GitHub/svalboard-qmk` clone at `7d71434`). **Fixed** means the spec, the mockups, or both now reflect it. **Owner** means the decision is in §13.2 with a recommendation; the spec text follows the recommendation until the owner decides. **Partly rejected** notes what was not taken and why.

| ID | Severity | Disposition |
|---|---|---|
| feasibility-keybr-lesson-not-vendorable-as-is | major | **Fixed.** Confirmed (`keybr-lesson/lib/settings.ts:1-2`, `lesson.ts:32-36`, `result.ts:47`, `textinput/lib/settings.ts:1`, `stats.ts:13-18`; LOC re-measured at about 11.6k + 7.1k tests). D2, §9.2 (every patch), §6.1, §6.5, §9.8 (budget 130 KB, UNVERIFIED until M1a), §9.9, §12. |
| feasibility-keybr-binary-skipped-but-required | major | **Fixed.** Confirmed (`transitiontable.ts:1,19`). `keybr-binary` (`io.ts`, `errors.ts`) and `ngram.ts` vendored; §7.1, §9.1, §9.2. |
| feasibility-space-has-no-path | major | **Fixed.** Confirmed (`layouts.ts:316-319,328,497`). Whitespace table in §9.4; §3.1, §5.10, §7.4; resolver tests for space, Enter and Custom text with spaces (§9.9). |
| feasibility-tap-hold-buffering-breaks-correlator | major | **Fixed, partly rejected.** Confirmed in `keyboards/svalboard/config.h:158-159,196`, `svalboard.c:563-575`, `sval_qmk_settings.c`, and `tapping_term: 200` in the default `.svil`. Correlator now uses the history interval `(t_step(prev), t_input + ε]`, release edges and delayed-output marking (§9.3, §6.5, §6.7); LT costs more than MO (§9.4); tests added. Not taken: "read the tap-hold settings through the existing Sval QMK settings". Keybard has no QMK-settings reader today (no match in `src/`), so this became optional future work (§10), and the correlator does not depend on it. |
| feasibility-stale-layer-mask-false-mismatch | major | **Fixed.** Effective layer derived from held MO/LT keys in the same matrix sample, masks only for default/toggles/OSL; mismatch counter limited to eligible base-layer, non-tap-hold steps (§9.3, §3.1); test added. |
| feasibility-divisor-counts-held-prereqs | major | **Fixed.** Confirmed keybr clears its set per measure (`timetotype.ts:52-84`). `newPrereqs` rule for live and Keymap only (§6.5, D6); timing tests for digit runs and held-Shift capitals (§9.9). |
| feasibility-stray-counts-modifier-presses | major | **Fixed.** Consumption and exclusions defined; strays are character-producing presses unmatched in `(t_prev, t_next)` (§6.6, §9.3); test added. |
| feasibility-event-storage-arithmetic | minor | **Fixed.** Arithmetic confirmed (12 × 4 B × 150 = 7.2 KB). Bit-packed 5-word layout in §8.2 (about 3.3 KB per lesson including non-hit events); Q6 restated with corrected sizes (**Owner**). |
| feasibility-result-record-not-keybr-compatible | minor | **Fixed, partly rejected.** Compatibility claim dropped (§8.3, §8.4). The suggested alternative of storing `l: "custom"` was not taken as a compatibility fix: `Layout.custom` is not in `Layout.ALL` (`keybr-keyboard/lib/layout.ts:7-17,1412`), so keybr's parser would still return null. `l`/`m` now hold valid-shaped values for reference only, and the lesson type moved to `x.type`. |
| feasibility-firmware-shift-detection | minor | **Fixed.** Confirmed (`keygen.ts:227`, `keys.ts:247,363-380`). Detection by keycode bits or `US_SHIFT_ALIASES` (§9.4); resolver test notes it (§9.9). |
| feasibility-sample-state-contradicts-unlock-order | minor | **Fixed.** Confirmed (`letter.ts:131-138`). Sample state is now a s d f l k j, focus j; M-06 unlocks e (L-middle N); "dealt" removed; every sample word contains the focused letter (A.1, §5.2, §6.3, M-01–M-06, M-10, M-11, M-17). |
| feasibility-m17-confusion-classes-wrong | minor | **Fixed.** Confirmed from the default keymap. M-17 shows `q` ×3 wrong layer, `1` ×2 wrong direction, `@` ×1 wrong finger; worked example added to §6.6; A.2 and §5.7 updated. |
| feasibility-keybr-input-citations | minor | **Fixed.** `timetotype.ts:52-84` (85 lines); no `beforeinput` listener (`inputhandler.ts:46-56`), removed from the pipeline diagram and the UI test; Tab patch listed (§5.11, §9.2). |
| feasibility-host-mode-keymap-mismatch | minor | **Fixed.** Host board source and the matching requirement (§3.2, §5.4, M5 acceptance). |
| feasibility-context-pollmatrix-rerenders | minor | **Fixed.** Confirmed (`KeyboardContext.tsx:402-406`, `useKeyDrag.ts:44`). Constraint in §3.2 and §9.3; sampler re-render test (§9.9). |
| feasibility-milestones-unestimated-m1-overloaded | minor | **Fixed.** Rough estimates per milestone (marked UNVERIFIED); M1 split into M1a and M1b (§12). |
| ux-visual-01 | major | **Fixed.** Red is error only; pressed-now is the ink active face (§5.0 color roles, §5.2, N-7); M-01, M-02, M-25, comparisons redrawn. Alternative recorded as **Q9** (**Owner**). |
| ux-visual-02 | major | **Fixed.** Target shows the target legend on the target-layer face; step numbers moved to a badge so MO/LT1 headers stay (§5.2, N-6); M-02 redrawn. |
| ux-visual-03 | major | **Fixed.** Heat faces moved to a neutral ink ramp (§5.0.1, N-9); M-19–M-21 and M-25 redrawn. Brand-palette alternative recorded as **Q10** (**Owner**). |
| ux-visual-04 | major | **Fixed.** Board keys non-interactive during lessons; P5 from the key strip and Progress; Progress data are buttons with accessible names; direction glyph always visible (§4.3, §5.2, §5.7, §5.8, §5.11, §5.12). |
| ux-visual-05 | major | **Fixed.** Chose a fixed-height status slot (N-4) over the toast option, so banners stay near the text the user is reading; §5.2, §5.3; M-01, M-06, M-08 redrawn. |
| ux-visual-06 | major | **Fixed.** Left-anchored, 32rem, overlay, separate instance, covers the pills while open (§5.0, §5.5); M-13 flag removed. |
| ux-visual-07 | major | **Fixed.** §5.0.2 lists 14 new components with classes and states; OnOffToggle limited to ON/OFF; SegmentedControl and ToggleChipGroup added; 2S chip conditional. Approval is **Q12** (**Owner**). |
| ux-visual-08 | major | **Fixed.** Reasons are row values (§5.0 Explanations, §5.6); Inferred chip is a focusable button (§3.3, N-13); M-16 and M-21 redrawn. |
| ux-visual-09 | major | **Fixed.** Wavy red underline for errors; layer underline only on pending characters, so they never collide (§5.0, §5.2, §5.12); CSS and M-25 updated. |
| ux-visual-10 | major | **Fixed.** Neutral ramp passes 4.5:1 in both themes (§5.0.1 table); strips on heat faces drop the black/30 tint; deltas are `text-kb-ink` with ▲/▼ (§5.2). |
| ux-visual-11 | major | **Fixed.** One locked look (dashed, transparent) in strip and board, both themes (§5.0, §5.2); all practice boards and M-25 updated. |
| ux-visual-12 | major | **Owner (Q8).** Options A/B/C with a recommendation to keep the pill unchanged in v1 and restyle right after M1b, because the request was to keep the change focused on the trainer. M-24 now also drawn in dark and flagged. |
| ux-visual-13 | major | **Fixed.** Added M-26 (Drill · Layer 1 symbols, live), Words and Custom crops (M-14), About popover (M-13), P5 inferred-only (M-17), Unsent changes plus Caps Lock and Layer locked (M-08), Top speed and Daily goal banners (M-06), Progress loading and storage-off (M-22), M-24 dark. |
| ux-visual-14 | major | **Fixed.** Replace turns the commit destructive and goes through a confirm (§5.9); M-23 adds both states. |
| ux-visual-15 | minor | **Fixed.** Same as feasibility-m17-confusion-classes-wrong. |
| ux-visual-16 | minor | **Fixed.** "Drill this group" defined, alternative ring row added, no-lesson board look specified, "Pressed instead" label (§5.2, §5.3, §5.7); M-09 now shows the gray board in all three wells. |
| ux-visual-17 | minor | **Fixed.** Start content on a floating card (§5.4); M-12 redrawn. |
| ux-visual-18 | minor | **Fixed.** Uncalibrated = full face + `?` header + empty bar (§5.2, N-14); M-06 and M-25 updated. |
| ux-visual-19 | minor | **Fixed.** Accuracy dashed, target dotted, direct line labels, one-line scale beside heatmap titles (§5.0, §5.8); M-19 and M-20 redrawn. |
| ux-visual-20 | minor | **Fixed.** 2S row and chip only with a 6-key cluster (§5.5, §5.8); M-14 and M-19 redrawn. Rows with no practicable character are kept when any finger has data (W carries h, y, n). |
| ux-visual-21 | minor | **Fixed.** Outcome rows Pressed keys / Layer / Keymap; Hz and hash moved to tooltip and export (§5.6); M-16 redrawn. |
| ux-visual-22 | minor | **Fixed.** Metric and scope are SegmentedControls; LayerSelector divider before the layer pills (§5.8); M-19 redrawn. |
| ux-visual-23 | minor | **Fixed.** `whitespace-nowrap` on values and 2-column metrics under 480 px (§5.2); header callouts placed beside, not over, the title and pills. |
| completeness-unlock-order-sample | major | **Fixed.** Same as feasibility-sample-state-contradicts-unlock-order. |
| completeness-profile-identity | major | **Fixed; Owner (Q7).** Confirmed every point (`BackupContext.tsx:37-40`, `.svil` uid = `SVALBOARD_VIAL_UID`, decimal vs hex `kbid`). Profiles no longer follow the board: one user-chosen profile, safe because stats key on paths; board identity normalized into `x.board` (§8.1). Import target defined (§8.4, §5.9). Board-keyed alternative in Q7. Whether Svalboard UIDs are per unit stays UNVERIFIED. |
| completeness-snapshot-stale-after-remap | major | **Fixed.** Fingerprint added to snapshot validity and schema (§6.8, §8.1); store test (§9.9). |
| completeness-event-size-math | major | **Fixed.** Same as feasibility-event-storage-arithmetic; Q6 (**Owner**) restated. |
| completeness-reconnect-teardown | major | **Fixed.** Confirmed (`KeyboardContext.tsx:145-160`, `MainScreen.tsx:9`, `PanelsProvider` inside `EditorLayout.tsx:61`). New §5.3 row, hash restore rule (§4.2), P4 note (§5.6), M2 acceptance and checklist. |
| completeness-keymap-source | major | **Fixed.** `originalKeyboard` is exposed (`KeyboardContext.tsx:476`), resolving the UNVERIFIED. Source table with defaults, Live Updating on and off, no "Editor draft" (§5.4); M1b remap acceptance rewritten. |
| completeness-layer-stuck-capslock | major | **Fixed.** Caps Lock and Layer-locked states with stats exclusion; fingerprint scope stated (§5.3, §9.4); M-08 draws both. |
| completeness-new-idioms-unlisted | major | **Fixed; Owner (Q12).** Same as ux-visual-07. |
| completeness-panel-placement | major | **Fixed.** Same as ux-visual-06; bottom-panel layout explicitly not applied (DECISION, §5.5). |
| completeness-mvp-cut | major | **Owner (Q11).** Recommendation: promote after M2, with a cut list; M1 split; physical extras moved from M2 to M4; lab view added to §4.2. |
| completeness-drill-scope-empty | minor | **Fixed.** Minimum scope, "Nothing to drill" state, Weakest fallback, Thumbs defined, Numbers merged into Drill (§2, §5.3, §5.5, §6.2, §7.3); M-09, M-14. |
| completeness-path-key-model | minor | **Fixed.** Path key = target only (DECISION); stats from all current paths; histogram per (character, path); combos via path key `i1+i2` and event layout 2 (§6.1, §8.2, §8.3, §9.4). |
| completeness-timing-release-emit | minor | **Fixed.** Live uses press-edge time for delayed-output steps; Keymap only accepts the bias with a "Delayed output" chip (DECISION, §6.5, §5.7). |
| completeness-red-semantics | minor | **Fixed; Owner (Q9).** Same as ux-visual-01. |
| completeness-mockup-flags-unresolved | minor | **Fixed.** Every revision-1 flag is resolved in the spec (target legend §5.2, no-lesson board §5.3, Drill this group §5.7, unsent notice drawn in M-08, Fingers grid §5.8, sample text A.1). Remaining flags in the mockups only explain revisions or point at Q8. |
| completeness-confusion-examples-wrong | minor | **Fixed.** Same as feasibility-m17-confusion-classes-wrong. |
| completeness-split-half | minor | **Fixed by scoping.** Declared out of scope for v1 (N9) with a risk row; split-link reporting stays UNVERIFIED. |
| completeness-internal-inconsistencies | minor | **Fixed.** Paused defined as a lesson state with precedence (§3.2, §5.6; M-13 Input row reads Paused); error-class names unified (§3.1, §6.6); Announce next key added to §5.5; Overlay note reworded as a fourth §1.4 change. |
| completeness-settings-scope | minor | **Fixed.** Settings global, daily goal per profile, Start once per profile (§8.1); mid-lesson setting changes split into regenerate vs live (§5.5). |

**Verification pass (after revision 2).** Every disposition above was checked against this spec and the mockups. Small fixes made in that pass: M-26 lesson text now obeys the §7.3 focus rule (every token contains the focused `#`), with one-level template nesting added to §7.3; M-08 gains the **Board connected · lesson restarted** and **Progress was saved by a newer Keybard** notices (A.2 updated); M-11 now draws the §5.1 phone rule (locked letters collapsed to `+19 locked`, `pb-24` under the text card) instead of flagging it; M-19's Profile select reads **Me** (profiles no longer follow the board, §8.1); M-21's crop now includes the Keyboard title and its open tooltip; M-16's action callouts are numbered; M-17's live shot names where the popover opens from; the Space label citation is `layouts.ts:328`, not `:327`.
