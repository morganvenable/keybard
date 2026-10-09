# MW: Workspace plumbing: implementation notes

Milestone MW from [spec.md](../spec.md) §12 (D1, D12, D15, OD1, OD3, §4, §5.13, §9.1, §9.9). Branch `feat/practice-trainer`, on `c2a70b8` (vLaunch2.2).

## What was built

| Area | Files |
|---|---|
| Workspace ids, the panel switch per workspace (`WORKSPACE_HAS_PANEL`), the Practice nav flag, and the §4.2 hash routes (parse, canonical hash, `replaceState` sync) | `src/layout/workspaces.ts` |
| `PanelsContext`: `workspace`, `setWorkspace`, `practicePage`, `setPracticePage`, `returnFocusOverride`; the initial route from the hash (workspace, page, panel set together); hash sync on every workspace or page change; a `hashchange` listener; the auto-open rule now reads `WORKSPACE_HAS_PANEL` (only `matrixtester` and panel-less workspaces stay closed) | `src/contexts/PanelsContext.tsx` |
| Nav: **Practice** (`Gauge`) and **Overlay** (`PictureInPicture2`) replace **Trainer** after **Layouts**; the §4.1 click table; footer items workspace-neutral; the main-group indicator marks the workspace item when `activePanel` isn't a main-group item; the dead `matrixtester` arm removed | `src/layout/Sidebar.tsx` |
| Workspaces in `EditorLayout`: Overlay (today's `TrainerPage`) and Practice pages use the editor's `contentStyle` (push at ≥ 1100 px, `padding-bottom` in bottom-bar layout), mount on first visit and stay mounted and hidden; `SecondarySidebar` moved out of the editor wrapper and serves every workspace; `clearSelection()` on leaving the editor; the `trainer-mobile-nav` trigger removed | `src/layout/EditorLayout.tsx` |
| Always-mounted provider shells with `activated`, the engine components (render nothing; empty until MO and M1b) and the `useSyncExternalStore` store | `src/layout/workspace-store.ts`, `src/features/trainer/OverlayProvider.tsx`, `src/features/practice/PracticeProvider.tsx` |
| `SecondarySidebar`: the `focusKey` focus rule; `returnFocusOverride` on close; Esc closes the Practice and Overlay panels; `practice` and `overlay` in `getDetailPanelHeight` | `src/layout/SecondarySidebar/SecondarySidebar.tsx`, `src/hooks/useWorkspacePanelEscape.ts` |
| `PanelContent`: `practice` → `PracticePanel`, `overlay` → `OverlayPanel`; `getPanelTitle` returns **Lesson** or **Progress** (by page) and **Overlay** | `src/layout/PanelContent.tsx` |
| Practice placeholder: P0 frame (title, **Lessons · Progress** pills) and a placeholder panel, both modes | `src/features/practice/PracticeWorkspace.tsx`, `src/features/practice/PracticePanel.tsx` |
| Overlay panel placeholder (not reachable until MO) | `src/features/trainer/OverlayPanel.tsx` |
| SegmentedControl (N-1): sm and md, radiogroup with one tab stop, arrows/Home/End skip disabled segments, `onChange(value, "pointer" \| "keyboard")` | `src/components/shared/SegmentedControl.tsx` |
| README: Overlay name, `/#overlay`, `/#trainer` still works; a one-line README in the Overlay directory (§9.1) | `README.md`, `src/features/trainer/README.md` |
| Screenshots (headless Chrome against `npm run dev`, QWERTY example) | `docs/practice/notes/mw-screens/` |

### Tests

| File | Covers |
|---|---|
| `tests/components/Workspaces.nav.test.tsx` (new) | Real nav + `PanelsProvider` + detail panel: the nav items and their icons; Practice click opens page and panel, second click closes the panel and keeps the page; indicator stays on Practice with its panel closed and with Settings open over it; panel title follows the page and swaps in place; an editor item returns to the editor and clears the hash; Quick Start, About and Settings open over Overlay without leaving it; Overlay (interim) opens with the panel closed; Matrix Tester → Overlay → editor item leaves Matrix Tester off; focus moves into the panel when an open editor panel switches to Practice; focus stays put on Lessons ↔ Progress; close returns focus to the opener or to `returnFocusOverride`; Esc closes the Practice panel but not editor panels; deep links `#practice`, `#practice/progress`, `#trainer` and `#overlay` (hash reads `#overlay`), `#practice/lab` without the query; a hash typed while open; a remount reopens the same workspace and page |
| `tests/components/EditorLayout.guides.test.tsx` (updated) | Overlay keep-mounted session (was Trainer); Overlay stays visible with Settings open over it; mount counters on `SecondarySidebar` and the editor content stay at 1 across editor → Overlay → editor → Practice → Overlay → editor; Practice mounts on first visit and stays mounted; **no `fetch` to `/api/host/*` before Overlay is first opened** on a Host-served page (the TrainerPage stand-in runs the real `useHost`) |
| `tests/components/MainScreen.navigation.test.tsx` (renamed only) | `#trainer` still requires the normal connection flow |
| `tests/layout/workspaces.test.ts` (new) | Hash parsing, the lab rule with Q7, canonical hashes, `replaceState` sync (keeps the query, clears only workspace hashes, no-op when equal), `WORKSPACE_HAS_PANEL` |
| `tests/layout/workspace-providers.test.tsx` (new) | Providers start nothing before their workspace opens, stay started after, start at once from a deep link, never remount children; the store |
| `tests/hooks/useWorkspacePanelEscape.test.tsx` (new) | With a real `ui/select` (Radix) in a stand-in panel: one Esc closes only the open select, a second closes the panel; edited text keeps Esc; open listbox/dialog/menu/trigger keep it; an expanded accordion doesn't |
| `tests/components/SegmentedControl.test.tsx` (new) | Roles, tab stop, pointer vs keyboard source, wrap and disabled skip, sizes, track classes |
| `tests/theme/no-hardcoded-chrome-colors.test.ts` (one self-test added) | `src/components/shared/SegmentedControl.tsx` is scanned, unlike `src/components/ui` |

## Acceptance criteria

| Criterion (§12 MW) | Status |
|---|---|
| A nav click opens page and panel | Done for Practice. Overlay opens its page with the panel closed until MO, as the MW scope says. |
| A second click closes the panel and keeps the page | Done (Practice). For Overlay a second click keeps the page and changes nothing (there is no panel yet). |
| An editor item returns to the editor | Done |
| Settings opens over a workspace without leaving it | Done (also Quick Start and About) |
| The indicator stays on the workspace item while its panel is closed | Done, also with Settings open over it |
| `#trainer` and `#overlay` open Overlay and the hash reads `#overlay` | Done (tests, and by hand in headless Chrome after the QWERTY example loads) |
| Returning to the editor clears the hash | Done |
| Matrix Tester → Overlay → editor leaves Matrix Tester off | Done |
| Switching from an open editor panel moves focus into the new panel | Done with Practice. Overlay gets the same rule once MO gives it a panel (`focusKey` covers both ids). |
| No remount of `SecondarySidebar` or the editor content | Done (mount counters) |
| No Host contact before Overlay is first opened | Done (test on a Host-served page) |
| `MainScreen.navigation.test.tsx` and `EditorLayout.guides.test.tsx` updated and passing | Done |
| Both lucide icons resolve in the installed `lucide-react` (0.544) | Done: `tsc`, the build, and a render test that finds `svg.lucide-gauge` and the picture-in-picture icon |
| Both sidebar and bottom-bar modes | Practice page and panel checked in both (`mw-screens/practice-lessons-panel-*.png`, `bottom-bar-practice-progress.png`), Settings over Overlay in both, the 900–1099 px overlay placement (`side-1000-panel-over-page.png`) and 390 px (`phone-390-practice.png`). No horizontal page scroll at 1600, 1000, 860 or 390 px. |

## Deviations from the spec, and why

1. **Esc lives on the panel root in `SecondarySidebar`, gated on the `practice` and `overlay` panel ids**, not in `PracticePanel` and `OverlayPanel`. Focus lands on the `aside` when the panel opens; a handler inside the panel content never sees an Esc pressed there. Editor panels are unaffected (the handler isn't attached for them), which is what the spec's placement was for. The logic is one hook, `useWorkspacePanelEscape`.
2. **The open-layer check doesn't use `[data-state="open"]`.** Radix Accordion and Collapsible content carry `data-state="open"` too, so Esc inside an expanded section would never close the panel. The check is `[role=listbox]`, `[role=dialog]` (Radix popover content), `[role=alertdialog]`, `[role=menu]`, plus a focused combobox or popup trigger with `aria-expanded="true"`. Editable text inputs keep Esc ("an input in edit mode"); read-only and non-text inputs don't.
3. **A `hashchange` listener** (not in the spec, which only extends the initial-hash check). Without it, typing `#practice` into the address bar of an open Keybard changed the address but not the page. A workspace hash now acts like a nav click, and an empty hash (Back or Forward to an entry without one, or a typed bare `#`) returns to the editor and closes the workspace's own panel; other hashes are ignored. Commits `b19f6c6` and `5240e37` (review MW-1).
4. **`practicePage` and the hash sync live in `PanelsContext`**, not in `PracticeWorkspace` (§9.1 says the workspace does the hash sync). The initializer has to set workspace, page and panel together from the hash (§4.2), and the Practice page must survive while Practice isn't mounted, so one routing owner is simpler. `PracticeWorkspace` just reads and sets `practicePage`.
5. **The Practice nav item shows in development builds** (`PRACTICE_NAV_VISIBLE = import.meta.env.DEV`, `src/layout/workspaces.ts`) and is hidden in every production build (test site, next, stable, Paranoid), as "hidden until M1b" asks. `#practice` opens the placeholder in every build. M1b sets the flag to true.
6. **Overlay interim click:** opening Overlay closes any open panel (today's Trainer did `setOpen(false)` too). A second click on Overlay no longer returns to the editor (Trainer toggled); the workspace model never leaves a workspace from its own item.
7. **Focus on a panel switch:** when an open panel switches to Practice or Overlay, focus is not first restored to the old opener; the return target becomes the element focused at the switch (the nav button), unless focus was already inside the panel. Only a close returns focus. A consequence: the restore no longer runs if `SecondarySidebar` unmounts with the panel open (a board connect remounts `EditorLayout`); the old target is in the unmounting tree anyway.
8. **`getPanelTitle` takes a third argument**, the Practice page. The `#practice/lab` page uses the **Lesson** title until M0 decides otherwise.
9. **EditorLayout's visited flags come from the providers** (`activated`), instead of separate `practiceVisited`/`overlayVisited` state in `EditorLayout`, so the page and the engine start on exactly the same first visit.
10. **The engines publish only `running`.** MW has no state to lift yet (MO lifts `TrainerPage`; M1b adds the session). The store and the start-on-first-visit wiring are in place and tested.
11. **README updated now** (an MO docs item), because the nav item is already called Overlay.
12. `usePanels` threw "useKeyboard must be used within a KeyboardProvider"; it now names itself. No test depended on the old text.
13. Spec line numbers are for `61db58a`; every cited site was found at or near its line on `c2a70b8`. The Trainer page no longer has a Hide overlay button upstream (vLaunch2.2), and `TrainerPage` here has none; MO's Host card (§5.14 capability 19) must account for that.

## OWNER_Q usage

- **Q7** (`OWNER_Q7_LAB_VIEW_ENABLED`): `parseWorkspaceHash` opens `#practice/lab` as the lab page only with `?practiceLab=1` and Q7 true; otherwise it opens Practice · Lessons and the hash is rewritten to `#practice`. The lab page itself is a placeholder until M0.

## Stubbed or deferred

- **Practice page and panel are placeholders** (title, pills, a "Not available yet" well; a "Lesson settings" / "Progress settings" row). M1b replaces them and makes the pages `React.lazy` chunks (not done now: a lazy placeholder would only add a chunk); M1b also adds the status pill.
- **Overlay**: `WORKSPACE_HAS_PANEL.overlay` is false, so Overlay opens no panel and `TrainerPage` keeps its own inspector; `OverlayPanel` is a placeholder; `OverlayEngine` is empty. MO flips the switch, lifts `TrainerPage.tsx:19-62` into the engine and builds the panel. Search `TODO(practice)`.
- **`returnFocusOverride` is never set yet.** M1b points it at the typing surface while Lessons shows. The close path and its test are done.
- §4.1 "Typing and the panel" (pause on blur, close on focus at 900–1099 px, `scrollIntoView` in bottom-bar layout) is M1b.
- The Esc test with an open select uses a stand-in panel with a `ui/select`; the real **Preset** select arrives in MO, which should repeat the test there.
- Interim copy still says Trainer where a user can see it: `TrainerPage`'s header and its install text ("select **Trainer**"). Both go with MO's restyle. The firmware notice (`FirmwareUpdate.tsx:103`) now says "lets the Overlay follow your layers", since the nav item it points to is Overlay. The manual, its capture scripts and `companion/overlay-host/README.md` are MO's docs items.

## Needs Mule testing

Nothing in MW reads the board. One check needs Keybard Host on Windows (a board isn't required): open Keybard from the Host tray. Host opens `/#trainer` (`companion/overlay-host/keybard_host/__main__.py:522`); it should land on Overlay and the address should read `#overlay`, and Overlay should connect to Host only then.

## Checks run

- `npx tsc --noEmit -p .` and `npm test` before every commit (final after the review fixes: 110 files, 1070 tests, all passing). The `EditorLayout.guides` run prints "Internal React error: Expected static flag was missing" in the 3D guide test; it prints the same on the base commit, before any MW change.
- `npm run build` and `npm run build:paranoid` before the push: both pass. The existing warning that the main chunk is over 500 kB still shows (1,446 kB).
- Headless Chrome against `npm run dev` (port 5291), QWERTY example: every nav flow above in sidebar and bottom-bar modes, light and dark, deep links after a full reload, widths 1600, 1000, 860 and 390 with no horizontal scroll.

## Follow-ups

- When M1b shows the Practice nav item, recheck the nav rail height at short viewports: the layout group grows by one item.
- The `focusKey` rule also re-runs when a workspace panel switches to the other workspace's panel (Practice → Overlay) from inside the panel; it keeps the earlier return target then. Recheck once Overlay has a panel.

## Review

An independent review of `033e447..67e2d2c` found three minor issues and no blockers. All three were verified against the code and fixed.

| Finding | Disposition |
|---------|-------------|
| **MW-1** The `hashchange` listener ignored an empty hash, so Back out of a workspace entered by a typed hash left Practice on screen with the address reading `/`. | **Fixed** (`5240e37`). An empty hash or a bare `#` sets the editor workspace and closes the panel only when it is a workspace panel; Settings, About and editor panels stay. Tests: Back after a pushed `#practice`, and an empty hash with Settings open over Overlay. Confirmed in headless Chrome: `location.hash = "#practice"`, then `history.back()`, lands in the editor with the panel closed. |
| **MW-2** The editor's Ctrl/Cmd+V layer paste wasn't gated on the workspace: in Practice or Overlay it opened the Paste Layer dialog and could overwrite the hidden editor layer. | **Fixed** (`EditorLayout: Ctrl+V layer paste only in the editor`). The handler returns unless `isEditor`; `usePanels` moved above the effect so it can read it. Test: Ctrl+V with a layer clipboard does nothing in Practice and Overlay, and still opens the dialog in the editor. |
| **MW-3** With a footer panel docked over the interim Overlay in bottom-bar layout, `TrainerPage`'s 100dvh root made the workspace box scroll as well as `.trainer-main`, and the header scrolled away. | **Fixed** (`Overlay: fit the interim page above a docked panel`). The overlay workspace box carries `[&>.trainer-page]:!h-full`, so the page fills the box above the panel's padding. The important modifier is needed: `trainer.css` is unlayered and outranks Tailwind's utilities layer (the plain variant had no effect in the browser). Measured in headless Chrome at 860 x 900 with Settings docked: box 900 px with 540 px padding and no outer scroll; page 360 px; only `.trainer-main` scrolls. Sidebar layout at 1600 x 1000 is unchanged (page 1000 px). Screenshot replaced: `mw-screens/bottom-bar-settings-over-overlay.png`. MO's restyle can drop the override (`TODO(practice)`). |

Checks after the fixes: `npx tsc --noEmit -p .` passes; `npm test` passes (110 files, 1070 tests); `npm run build` and `npm run build:paranoid` pass.
