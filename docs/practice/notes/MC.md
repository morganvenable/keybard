# MC: Color roles: implementation notes

Milestone MC from [spec.md](../spec.md) §12 (D13, OD4, OD6, §5.0.1, §5.17, Appendix A M-35 to M-37). Branch `feat/practice-trainer`.

## What was built

| Area | Files |
|---|---|
| Tokens: `kb-select`, `kb-select-tint`, `kb-select-strip`, `kb-pending`, `kb-pressed`, `kb-pressed-fg` (themed); `kb-select-strong` (literal); heat `kb-heat-far/-mid/-near/-ink` (literals); usage `kb-use-1..4` and `kb-use-1..4-fg` (themed). Brand colors unchanged (OD6). | `src/index.css` |
| Role class strings shared by every call site | `src/constants/color-roles.ts` |
| Key caps: selected and drag-hover = select tint face, ink legend, `ring-2 ring-kb-select ring-offset-1 ring-offset-background`, `z-10`; strips `bg-kb-select-strip text-kb-ink` (with a `group-hover:` partner so the layer hover strip doesn't darken it); default hover = the ring outside the key with `hover:z-10`; pending = `border-2 border-dashed border-kb-pending`, also on selected keys; new `selectedStrong` prop (Matrix Tester held) | `src/components/Key.tsx` |
| Matrix Tester: held keys use `selectedStrong`; "was pressed" black keys get `dark:border-kb-gray-border` | `src/components/MatrixTester.tsx` |
| §5.17 call sites: layer-pill drop target, Apply N Changes (dashed amber outline, hover/active `bg-kb-active/80`), binding editor slot and drag hover, palette keys, bindings-list hover, drag overlay, Leaders and Alt-Repeat selected slots, layer dragged over the canvas, unsaved board name, Layouts file-drop target, neutral **Active** chip | `KeyboardViewInstance.tsx`, `LayerSelector.tsx`, `BindingEditor/EditorKey.tsx`, `components/EditorKey.tsx`, `BindingsList.tsx`, `DragOverlay.tsx`, `LeadersPanel.tsx`, `AltRepeatPanel.tsx`, `EditorLayout.tsx`, `BoardIdentitySection.tsx`, `LayoutsPanel.tsx`, `LayoutGroupCard.tsx` |
| Dead code deleted | `src/constants/pending-change-styles.ts` |
| Theme guard rule **red-reserved** with `RED_ALLOWED` and self-tests | `tests/theme/no-hardcoded-chrome-colors.test.ts`, `tests/theme/allowlist.ts` |
| Token contrast checks, both themes | `tests/theme/color-roles-contrast.test.ts` |
| Call-site pins for the ad-hoc blue/amber sites | `tests/theme/color-roles-callsites.test.ts` |
| Key role states | `tests/components/Key.colorRoles.test.tsx` |
| README Theming: role tokens table and rule 4 | `README.md` |

## Acceptance criteria

| Criterion | Status |
|---|---|
| No red utility outside `RED_ALLOWED` in `src/**/*.tsx`; self-tests flag a selected-key literal | Done. The rule scans `.ts` too (see deviations). Self-tests: selected-key literal flagged, trash-hover literal allowed, a red literal under `src/components/ui/` still scanned. |
| Existing tests pass, including `no-hardcoded-chrome-colors.test.ts` | Done: 104 files, 998 tests. No existing test needed changing. |
| Select ring ≥ 3:1 against page and surface; selected legends ≥ 4.5:1, both themes, against the built CSS | Done in `color-roles-contrast.test.ts` (reads `src/index.css`). Checked by hand that `npm run build` copies the same hex values into `dist/assets/index-*.css` (`--kb-select:#2b86bd` / `#5cb8ec`, etc.) and emits every new utility, including the variant ones (`hover:ring-kb-select`, `ring-kb-select/50`, `bg-kb-select-tint/40`, `dark:border-kb-gray-border`, `group-hover:bg-kb-select-strip`). |
| Selected + pending shows both ring and dashed border | Done: `Key.colorRoles.test.tsx` ("pending and selected"), for regular and layer keys. |
| Matrix Tester held = blue face + 3 px ring, "was pressed" black (outlined in dark), on the Mule; pairs ≥ 3:1 | Pairs checked in the contrast test. Class wiring checked in tests. **Needs Mule testing** (live presses). |
| ProofSheet with Selected and Pending on shows ring + tint and the dashed border on the same keys | ProofSheet passes `selected`/`hasPendingChange` straight to `Key.tsx`, so it follows. Needs an eye check in the browser, light and dark. |

## Deviations from the spec, and why

1. **red-reserved also scans `.ts` files.** The spec asks for `.tsx` literals. Role class strings now live in `src/constants/color-roles.ts` (a `.ts` file), and the deleted `pending-change-styles.ts` shows red can hide in `.ts`. Scanning both closes that gap. Cost: one extra entry, `src/utils/colors.ts`'s red layer face, with a new reason `layer-data` (the spec's reasons are `destructive`, `error`, `wrong-key`).
2. **red-reserved also reads `headerClassName` values and the literals inside template `${…}` spans.** The existing rules skip both; red in a key header (the binding editor's drag hover had `bg-red-600`) must not hide there.
3. **Usage text tokens `kb-use-1-fg`…`kb-use-4-fg` added.** The spec gives the usage text colors per step (§5.0.2) but no token names. Adding them now keeps all new tokens in one review, as §12 MC asks.
4. **Binding editor slot passes `bg-kb-select-strip` in `headerClassName`.** README rule 2 says key headers are never themed. Selection strips are chrome, not key data, so README rule 4 now names this one exception. The guard's `header-themed` rule only looks for `kb-active`/`kb-header`, so nothing in the guard changed.
5. **Apply button:** the old hover also set a red border, and `hover:ring-kb-ink` swapped the ring. Both are gone. The pill keeps `border-transparent`, the outline stays dashed amber on hover, and hover and press lighten the ink face (`bg-kb-active/80`). The spec names only the hover. Using the same lightening for press is my choice.
6. **Palette `EditorKey` selected classes now go through `cn()`** (they were string-concatenated), so `text-kb-ink` replaces the green key's `text-white` deterministically.
7. **`ring-opacity-50` dropped** at the canvas layer-drag ring: it is Tailwind v3 syntax and generated nothing under v4. `ring-kb-select/50` is the v4 form, as the spec says.
8. Spec line numbers were for `61db58a`. Every §5.17 site was found at or near the cited line on the current base (`c2a70b8`, vLaunch2.2). Nothing new since then used red for selection; the Host overlay resize grip has no red.

## OWNER_Q10

`OWNER_Q10_NEW_COLOR_ROLES` (`src/constants/owner-decisions.ts`) is `true`. Nothing switches on it. A cheap switch back to red would need the old red literals in source, which the red-reserved rule exists to forbid. Going back means reverting the MC commits. `color-roles.ts` says so in its header.

## Stubbed or deferred

- **Before/after screenshots** for M-35, M-36, M-37 and ProofSheet, light and dark: the spec wants them in the PR, and no PR is opened in this run. Take them when the PR is prepared. M-36 needs the Mule.
- Practice's `RED_ALLOWED` entries (wrong-key border and badge, error tint): added with the Practice code (M1b). Until that code exists they would be stale entries, and stale entries fail the test.
- `kb-pressed`, heat and usage tokens are unused until M1b/M4, as planned.
- FragmentsPanel status text (`text-amber-*`/`text-blue-*`), ScanLab's pending text, the Layouts search focus ring, the "Clear search" link and the search-match highlight stay as they are, per the §5.17 "stays" rows.
- The manual's screenshots show red selection. Refresh them in the release that ships MC (§13.1 risk row).

## Needs Mule testing

- Matrix Tester: hold three keys and release five. Check that held keys show the blue face with the 3 px ring, "was pressed" keys are black, and in dark theme the black keys show the gray outline.
- Editor on the board in manual-update mode: a pending key shows the dashed amber border, the Apply pill shows the dashed amber outline, and **Apply** clears both.

## Follow-ups

- Eye check in a browser (no hardware needed): the editor with a selected key on a blue layer (ring vs blue neighbors, §13.1), hover rings on edge-to-edge keys, palette and binding-editor keys in sidebar **and** bottom-bar modes, and the Layouts drop target, all in light and dark.
- Keys inside `overflow-hidden` panel rows may clip the new outside hover ring where no `hoverBorderColor` is passed. Most panels pass one, so this is unlikely. Watch for it in the eye check.
