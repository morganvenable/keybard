# MO: Overlay restyle: implementation notes

Milestone MO from [spec.md](../spec.md) §12 (D11, D12, OD2, §1.4, §4.1 Mounting, §5.14–§5.16, §9.1, §9.9, §10, Appendix A M-28 to M-34). Branch `feat/practice-trainer`, on top of MC and MW. Base for this milestone: `0b08c3c`.

## What was built

| Area | Files |
|---|---|
| Host client: `lost` (set by a failed poll or the 1.2 s watchdog after Host had answered, cleared by the next snapshot, never set before the first) and `unreachable` (Connect pressed, no Host answered); `error` keeps only bootstrap, command and configure messages; unreachable copy **Can't reach Keybard Host at 127.0.0.1:5178** | `src/features/trainer/host.ts` |
| State lift: TrainerPage's state and effects, unchanged, as a hook; Host config mirroring, Recall publishing gated on the workspace, board-change resets; source naming (`snapshotName`), layer options with layer colors, import checks, the queue for Host-only panel choices (Highlight held keys, Desktop default layer) | `src/features/trainer/useOverlayController.ts` |
| OverlayEngine runs the hook once Overlay is first opened and publishes `model` through the provider's store; `useOverlay()` for the page and panel | `src/features/trainer/OverlayProvider.tsx` |
| O1 page: title and Host status pill; one notice at a time; Host card; Desktop overlay or Paranoid well; preview card (N-16) with Background control and source; Layout row; Layers row with House on the default pill | `src/features/trainer/OverlayWorkspace.tsx` |
| O2 panel: Window · Appearance · Feedback · Recall tiles, setting rows, Recall card, footer | `src/features/trainer/OverlayPanel.tsx` |
| Host pieces: status pill, facts line, outdated notice, Desktop overlay well, Paranoid well, Connect pill with the permission tooltip | `src/features/trainer/HostInstall.tsx` |
| Page-drawn two-tone selection ring (`selected`, `selectionHalo`), drawn after every key; HostOverlay never passes it | `src/features/trainer/OverlaySurface.tsx` |
| Desktop stand-ins as data, with the ring halo and the empty-well tone per background | `src/features/trainer/preview-backgrounds.ts` |
| `trainer.css` reduced to the surface's layout and fade, no colors; `TrainerPage.tsx` and `trainer.css` deleted | `src/features/trainer/overlay-surface.css` |
| Color field (N-15): swatch with hairline, portaled popover, brand swatches plus white and black named with their hex, validated hex input, More colors… | `src/components/shared/ColorField.tsx`, `src/components/shared/color-swatches.ts` |
| `CustomColorDialog`: `displayOnly` (no LED target) and `title` for More colors… | `src/components/CustomColorDialog.tsx` |
| Notice card (amber notice, red error) and pill classes (brand, ink, quiet) shared with Practice | `src/components/shared/Notice.tsx`, `src/components/shared/pills.ts` |
| Overlay opens its panel from the nav item; the interim `WORKSPACE_HAS_PANEL` switch removed | `src/layout/workspaces.ts`, `src/contexts/PanelsContext.tsx`, `src/layout/Sidebar.tsx`, `src/layout/EditorLayout.tsx` |
| Manual: the chapter is **Overlay: your layout on the desktop** (`#overlay`, `#trainer` kept as an anchor), with the install steps that left the page; capture scripts drive the new UI; `trainer-*` clips and stills recaptured; PDF rebuilt by `validate.py` | `docs/manual/content/*.html`, `docs/manual/index.html`, `docs/manual/tools/*.py`, `docs/manual/assets/trainer-*`, `docs/manual/evidence/*` |
| READMEs say Overlay; `#trainer` still works | `README.md`, `companion/overlay-host/README.md`, `docs/manual/README.md` |
| Screenshots (production build of this branch, mocked Host over playwright routes) | `docs/practice/notes/mo-screens/` |

### Tests

| File | Covers |
|---|---|
| `tests/trainer/host-lost.test.tsx` (new) | `lost` is never set before the first snapshot, is set by a failed poll and by the watchdog, is cleared by the next snapshot, and never writes `error` |
| `tests/trainer/host-remote.test.tsx` (updated) | The unreachable copy and `unreachable`, cleared by Connect |
| `tests/trainer/host-install.test.tsx` (rewritten, as §9.9 asks) | The Desktop overlay well (versioned download, local Keybard, release notes, install steps; Connect only when offered), the Paranoid well, the facts line and outdated notice, the three status pills |
| `tests/trainer/overlay-controller.test.tsx` (new) | Mirroring: adopt on a new revision when nothing is pending, write 160 ms after a change with Saving… meanwhile, `layoutId` follows `internationalLayout`, no Saving… without Host; Recall publishes only while the workspace shows and clears on leave, also with the panel showing Settings; Highlight held keys and Desktop default layer wait for a write in flight, and a refused write is sent once; Desktop default layer lists Host's board; Preview held keys works while following; source naming; No board; layer labels and colors; import errors |
| `tests/trainer/overlay-ui.test.tsx` (new) | Page per Host state (web, Host-served, Paranoid, can't reach, lost, connected, command failed, hidden, outdated, no board, import error, background, ring never on the Recall target); panel tiles and rows per Host state (Host-only rows absent without Host; Desktop default layer whenever `default === null`, following or not; Duration hidden when Off; Held keys unavailable; Recall card buttons; Mark familiar; footer); Esc on the real Preset select closes only the select, a second Esc closes the panel |
| `tests/trainer/overlay-surface.test.tsx` (new) | The ring's two tones, paint order and pointer events; the halo per background; HostOverlay draws no ring |
| `tests/trainer/overlay-styles.test.ts` (new) | One stylesheet, `overlay-surface.css`, with no colors; no hex literals in the Overlay `.tsx` files; TrainerPage and trainer.css gone |
| `tests/components/ColorField.test.tsx` (new) | Swatch name and hairline, swatches and names (American spelling), current marked, swatch pick, hex validation with **Use #rrggbb**, More colors… without the LED target |
| `tests/components/Workspaces.nav.test.tsx`, `tests/layout/workspaces.test.ts`, `tests/components/EditorLayout.guides.test.tsx`, `tests/layout/workspace-providers.test.tsx` (updated on purpose) | Overlay now opens its panel from the nav item (second click closes it, focus moves in, Esc closes it, deep links open it with focus); the interim no-panel case and its `WORKSPACE_HAS_PANEL` test are gone; the guides test mocks `OverlayWorkspace` and keeps the real provider, so "no Host contact before Overlay is first opened" now runs through OverlayEngine |

`tests/trainer/core.test.ts`, `labels.test.ts`, `live-legends.test.tsx`, `host-refresh.test.ts` and `tests/host-native-state.test.tsx` are unchanged and pass.

## Acceptance criteria

| Criterion (§12 MO) | Status |
|---|---|
| Every §5.14 capability works as today | Done for rows 1–18 and 20 (tests above). Row 19: choosing the Host's board is on the Host card; **showing and hiding the desktop overlay is not**, because vLaunch2.2 removed that button on purpose (deviation 1). |
| Tiles and rows render per Host state | Done (`overlay-ui.test.tsx`) |
| Host config mirroring (adopt on revision, write after 160 ms, `layoutId` follows `internationalLayout`) | Done (`overlay-controller.test.tsx`) |
| Recall publishes only while the Overlay workspace is active and clears on leave | Done, including with another panel open over Overlay |
| The preview's ring is not drawn by HostOverlay, nor on an unrevealed Recall target | Done. The ring is never drawn on the Recall target while Recall is on (revealed or not); after Reveal the target shows the user's Layer change outline only, as the spec says. |
| `lost` is set and cleared; Connection lost shows no Desktop overlay well | Done (`host-lost.test.tsx`, `overlay-ui.test.tsx`) |
| The manual capture scripts run against the new UI | Done: `capture.py`, `capture-walkthroughs.py trainer-appearance trainer-practice-action trainer-feedback`, `capture-extra.py trainer-familiar trainer-layers`, `capture-native.py`, `capture-overlay-action.py` and `validate.py` all pass. Only the Overlay assets were kept (see Stubbed). |
| Push at ≥ 1100 px, overlay below, docked in bottom-bar layout, no horizontal page scroll at 900 px | Done. Checked at 1440, 1100 (pushed), 1000 (panel over the page), 900, 860 (bottom bar, panel docked) and 390: `scrollWidth == clientWidth` at each (`mo-screens/m34-*`). |
| No color literal in Overlay `.tsx` or `.css` chrome | Done: the theme guard (with two new `RED_ALLOWED` entries, both errors) and `overlay-styles.test.ts` |
| Manual Host checklist on Windows with the Mule | **Needs Mule testing** (below) |
| `build:paranoid` passes; Paranoid shows the Paranoid well with no Connect button | Done. Opened `dist-paranoid/keybard-paranoid.html` in Chrome: the well is there, no Connect button, no network requests. |

## Deviations from the spec, and why

1. **No Show/Hide overlay button** (§5.14 row 19, §5.16 Overlay hidden, M-28, M-33). Keybard Host vLaunch2.2 removed it from the page on purpose (`d1f5c7d`: "the overlay's handle menu and the tray hide and show it"), after the spec was written against `61db58a`. Code wins: the Host card has Reload layout and Disconnect only, and says **Desktop overlay hidden** while Host reports `visible: false`. The manual says where to hide and show it.
2. **`host.ts` has two new flags, not one.** Besides `lost`, `unreachable` marks "Connect pressed, no Host answered". Telling that state apart from `!state && error` would misfire when a command error is still set as the connection drops. The error text is now the spec's **Can't reach Keybard Host at 127.0.0.1:5178**; the old sentence of instructions is the Try again tooltip. `host-remote.test.tsx` was updated for the new copy.
3. **Saving… shows only while Host is connected.** TrainerPage set `hostDirty` on every change and only cleared it after a Host write, so without Host the footer said "Saving…" forever. §5.15 ties the footer to a Host write; changes made without Host are still written when Host connects, as before.
4. **Empty preview titles.** The spec draws the dashed well for no board chosen and says "preview as above" for a board that isn't valid. The well reads **No board selected** only when no board is chosen; **No layout from the board yet** while a chosen board has no keys; **No physical keys in this layout** offline (TrainerPage's old paragraph).
5. **Desktop default layer lists the layers of the board Host reads** (`hostLayers`), and shows the highest set bit of a multi-bit `manualDefault`. TrainerPage listed the preview board's layers and read `log2` of the mask, which gave a fraction for two bits (review finding).
6. **Highlight held keys and Desktop default layer have no disabled state.** OnOffToggle can't be disabled, and §5.6 forbids disabled buttons anyway, so a choice made while another Host write is in flight shows at once and is sent when Host is free (TrainerPage disabled the Switch, and dropped a Desktop default layer choice made during a write). A choice Host refuses (400, or 500 when it can't write its preferences) is dropped after the one attempt, so the control shows Host's value again and the error notice says why; it is not retried (review MO-1).
7. **Preview held keys also works while following the board.** TrainerPage showed only Host's held keys while following, so the button did nothing with Host connected; M-30 shows it lighting keys with Host connected. The simulated chord now adds to Host's held keys for 800 ms.
8. **Import error copy without periods** (**Choose a Svalboard layout with a 10 × 6 matrix**, **Couldn't read this layout**), as §5.14 writes them.
9. **Bottom-bar panel** lays its rows out in an auto-fill grid (18 rem columns) under the tiles; the spec only says the panel docks.
10. **The Drag by keys tooltip** sits on a focusable row title (dotted underline), so keyboard users reach it (§5.0 "tooltips only on focusable triggers").
11. **Manual asset names stay `trainer-*`** (not user visible; the capture case names and evidence files use them). The chapter id is `overlay`, with an empty `#trainer` anchor kept for old links.
12. **The preview's accessible name** is "Overlay keyboard preview" (was "Trainer keyboard preview"); HostOverlay shares the component, and the native capture scripts were updated.
13. Spec line numbers are for `61db58a`. Every cited TrainerPage, host.ts and HostInstall site was found at or near its line on this base (vLaunch2.2), apart from the removed Hide button (deviation 1).
14. **`host.configure` returns null when it sent nothing** (no Host state yet, or another write in flight), and false only when Host refused the write or couldn't be reached. The panel queue and the 160 ms mirroring write keep their change pending on null instead of dropping it.
15. **Keybard's color dialog hands back an exact hex** (`CustomColorDialog` `initialDisplayHex`, and a third `displayHex` argument to `onApply`). Its sliders are 8-bit QMK HSV, which can't hold most hex colors, so until a slider moves the dialog returns the initial or typed hex unchanged. The layer color badge ignores the new argument, so its behavior is unchanged.

## OWNER_Q usage

- **Q8** (`OWNER_Q8_NEW_COMPONENTS_APPROVED`, informational): MO builds N-15 (Color field) and N-16 (preview card) on that approval. Nothing switches on it.
- No other question affects Overlay. **Q3** (Host as a Practice input) stays false; MO touches nothing in Practice.

## Stubbed or deferred

- **Other manual screenshots** (landing, workspace and the editor panels) still show the pre-MC look. `capture.py` recaptures them all; only `trainer.png` and `trainer-practice.png` were kept, so this milestone doesn't carry unrelated asset churn. `evidence/screenshot-ui.json` is the full run's text. Refresh the rest in the release that ships MC (MC notes say the same).
- **A state poll that keeps failing before Host's first snapshot** shows nothing (no lost, no error), because the spec keeps `lost` false before the first snapshot. Rare (bootstrap answered but state doesn't); a follow-up could report it as unreachable after a few failures.
- **ConnectKeyboard's brand pill** keeps its own classes; `pills.ts` copies them. Switching it to `PILL_BRAND` is a separate cleanup.
- **The ring's contrast** is the spec's measured values plus a test of the halo colors; it wasn't measured on screen.
- **`companion/overlay-host/RELEASE-NOTES.md`** is untouched, as §10 says (the next Host release writes its own notes).

## Needs Mule testing

The manual Host checklist from §12 MO, on Windows with Keybard Host and the Mule (not the daily-driver right half):

1. Open Keybard from the Host tray: it lands on Overlay, the address reads `#overlay`, and Overlay connects only then.
2. Connect, choose the board in **Board**; the desktop overlay appears and the page follows it (Layout reads **Live board · read-only**, Layers row hidden).
3. Hide and show the overlay from its handle menu and the tray; the Host card says **Desktop overlay hidden** while hidden.
4. **Drag by keys** and **Place at bottom** in the Window tile; **Reload layout** and **Disconnect** on the Host card.
5. Change every Appearance row (presets, the three Color fields with opacity, a hex typed in, More colors…, thickness, halo, Layer change, Pressed key) and see each on the desktop overlay; the footer shows Saving… with the amber dot while it writes.
6. Turn on **Highlight held keys** and hold keys on the Mule; on firmware without matrix reads, **Held keys** reads Unavailable on this firmware.
7. Turn on **Recall**: the desktop legends hide (**Desktop legends · Hidden while recalling**); leaving Overlay (an editor nav item) restores them.
8. Quit Host while Overlay is open: the status turns red, **Keybard Host connection lost** shows, no Host card and no install well; start Host again and the card returns without a reload.
9. An older Host shows **Keybard Host vLaunch2.2 is available** with Download.
10. On older firmware (no default layer reported), **Desktop default layer** in Window lists the board's layers and sets the desktop overlay's base.

## Checks run

- `npx tsc --noEmit -p .` and `npm test` before every commit (final at the second review: 116 files, 1139 tests, all passing). Intermediate commits were checked in isolation with the later work set aside in a uniquely tagged stash, applied back by SHA and dropped.
- `npm run build` and `npm run build:paranoid` before each push: both pass. The existing warning that the main chunk is over 500 kB still shows.
- Playwright (system Chrome) against `npm run dev` and against `vite preview` of the production build, with Keybard Host mocked by request routes (board from `sval-default.svil`): every state in M-28 to M-34, light and dark, the Color field popover, Recall with the ring on Light, Dark and Busy, and the widths above. Paranoid checked from the built single file.
- The manual: `tools/build.py` and `tools/validate.py` (local server) pass; the PDF was regenerated by `validate.py`.

## Follow-ups

- When M1b shows the Practice nav item, Overlay is no longer "directly below Layouts"; the manual already says "in the layout group below Layouts".
- The `focusKey` rule re-runs on Practice ↔ Overlay switches made from inside the panel and keeps the earlier return target (MW follow-up). Overlay now has a panel, so this path is live; it isn't covered by a test yet.
- Consider memoizing the published model (the engine publishes a new object on every render, adding one commit per Host poll while Overlay has been opened; TrainerPage re-rendered on every poll too).

## Review

An independent review (`/code-review high`, `0b08c3c..888f47d`) produced ten candidates. Each was checked against the code.

| Finding | Disposition |
|---|---|
| The panel footer's `bg-sidebar-background` generates nothing (no such token), so rows showed through the sticky footer | **Fixed** (`908dd9c`): `bg-kb-surface`, the panel's surface |
| Desktop default layer listed the preview board's layers, not the board Host reads | **Fixed**: `hostLayers`; test |
| Highlight held keys silently dropped a click while another Host write was in flight | **Fixed**: the choice shows at once and is sent when Host is free; test |
| A state poll failing before the first snapshot reports nothing | **Kept, per spec** (`lost` is false before the first snapshot); listed under Stubbed |
| The engine publishes a new model object on every render | **Partly addressed**: derived values memoized; the model itself is a follow-up |
| The import check told its errors apart by message prefix | **Fixed**: the 10 × 6 check runs after the read |
| `HEX_COLOR` duplicated core.ts's inline regex | **Fixed**: core.ts imports it |
| `PILL_BRAND` copies ConnectKeyboard's and Button's brand classes | **Deferred** (separate cleanup), listed under Stubbed |
| Swatch names said "grey" (British) | **Fixed**: "Brand gray", "Brand light gray"; test |
| `log2` of a multi-bit `manualDefault` matched no option | **Fixed**: the highest set bit; test |

### Second review (at `428e6a5`)

| Id | Finding | Disposition |
|---|---|---|
| MO-1 | The Highlight held keys queue resent the write every time `busy` settled while Host kept refusing it (500, 400) | **Fixed**: a write Host refuses settles the choice (dropped, the toggle shows Host's value, the error notice says why); only "nothing sent, another write in flight" (`configure` now returns null for it) waits and retries. Test: `/config` answers 500 and exactly one write is sent |
| MO-2 | Desktop default layer lost a choice made while another Host write was in flight | **Fixed**: it goes through the same queue as Highlight held keys (`pendingHost`), and the select shows the waiting choice (`manualDefault` on the model). Tests: the write is sent after the one in flight and that one's Size change is kept; the panel shows a waiting choice |
| MO-3 | More colors… round-tripped through 8-bit HSV and changed colors the user didn't edit (#099e7c came back #099e7d) | **Fixed**: the dialog returns the exact hex until a slider moves, and a hex typed in it passes straight through (deviation 15). Tests: Apply without changes keeps #099e7c, #001144 and #dce5ec; a typed hex passes through; a moved slider still returns the slider color |
| MO-4 | The engine test changed the workspace and checked nothing, so the clear-on-leave gate in OverlayEngine was untested | **Fixed**: it rerenders after leaving the workspace, asserts the clearing `practice` command, and checks a second later that nothing is published again. The failed-write test from MO-1 was added too |

Also found while fixing MO-1: the 160 ms mirroring write dropped its pending change (`hostDirty` cleared) when `configure` returned early because a panel choice's write had just started. It now waits for that write and sends after it (deviation 14).
