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
| Binding-editor slot and palette key states, rendered (review MC-1 to MC-3) | `tests/components/EditorKey.colorRoles.test.tsx` |
| After screenshots: ProofSheet, M-35, M-37, light and dark, sidebar and bottom bar | `docs/practice/notes/mc-screens/` |
| README Theming: role tokens table and rule 4 | `README.md` |

## Acceptance criteria

| Criterion | Status |
|---|---|
| No red utility outside `RED_ALLOWED` in `src/**/*.tsx`; self-tests flag a selected-key literal | Done. The rule scans `.ts` too (see deviations). Self-tests: selected-key literal flagged, trash-hover literal allowed, a red literal under `src/components/ui/` still scanned. |
| Existing tests pass, including `no-hardcoded-chrome-colors.test.ts` | Done: 105 files, 1005 tests after the review fixes. No pre-MC test needed changing; MC's own source pins for the binding editor were updated with the review fix. |
| Select ring ≥ 3:1 against page and surface; selected legends ≥ 4.5:1, both themes, against the built CSS | Done in `color-roles-contrast.test.ts` (reads `src/index.css`). Checked by hand that `npm run build` copies the same hex values into `dist/assets/index-*.css` (`--kb-select:#2b86bd` / `#5cb8ec`, etc.) and emits every new utility, including the variant ones (`hover:ring-kb-select`, `ring-kb-select/50`, `bg-kb-select-tint/40`, `dark:border-kb-gray-border`, `group-hover:bg-kb-select-strip`). |
| Selected + pending shows both ring and dashed border | Done: `Key.colorRoles.test.tsx` ("pending and selected"), for regular and layer keys. |
| Matrix Tester held = blue face + 3 px ring, "was pressed" black (outlined in dark), on the Mule; pairs ≥ 3:1 | Pairs checked in the contrast test. Class wiring checked in tests. **Needs Mule testing** (live presses). |
| ProofSheet with Selected and Pending on shows ring + tint and the dashed border on the same keys | Done, checked by eye in headless Chrome against `npm run dev`, light and dark, green and blue layer colors, plain keys and keys with header strips (Layer Tap, Mod-Tap): ring, tint and dashed amber border on the same keys, strips light with ink legends. Screenshots `mc-screens/proofsheet-*.png`. |

## Deviations from the spec, and why

1. **red-reserved also scans `.ts` files.** The spec asks for `.tsx` literals. Role class strings now live in `src/constants/color-roles.ts` (a `.ts` file), and the deleted `pending-change-styles.ts` shows red can hide in `.ts`. Scanning both closes that gap. Cost: one extra entry, `src/utils/colors.ts`'s red layer face, with a new reason `layer-data` (the spec's reasons are `destructive`, `error`, `wrong-key`).
2. **red-reserved also reads `headerClassName` values and the literals inside template `${…}` spans.** The existing rules skip both; red in a key header (the binding editor's drag hover had `bg-red-600`) must not hide there.
3. **Usage text tokens `kb-use-1-fg`…`kb-use-4-fg` added.** The spec gives the usage text colors per step (§5.0.2) but no token names. Adding them now keeps all new tokens in one review, as §12 MC asks.
4. **Selection strips are the one themed class on key strips.** README rule 2 says key headers are never themed. Selection strips are chrome, not key data, so README rule 4 names this one exception. Since the review (MC-1) no caller passes the strip in `headerClassName`: `Key.tsx` adds it on selected and drop-target keys, and the binding editor slot goes through that path.
5. **Apply button:** the old hover also set a red border, and `hover:ring-kb-ink` swapped the ring. Both are gone. The pill keeps `border-transparent`, the outline stays dashed amber on hover, and hover and press lighten the ink face (`bg-kb-active/80`). The spec names only the hover. Using the same lightening for press is my choice.
6. **Palette `EditorKey` selected classes now go through `cn()`** (they were string-concatenated), so `text-kb-ink` replaces the green key's `text-white` deterministically.
7. **`ring-opacity-50` dropped** at the canvas layer-drag ring: it is Tailwind v3 syntax and generated nothing under v4. `ring-kb-select/50` is the v4 form, as the spec says.
8. **Selected binding-editor slot: border only, no ring** (review MC-3). Mockup M-37 and §5.17 give the slot `border-2 border-kb-select bg-kb-select-tint` and no ring, while `Key.tsx` adds the ring to every selected key. `SELECTED_SLOT_CLASSES` keeps the mockup look by adding `ring-0 ring-offset-0`, which tailwind-merge puts in place of the ring and its offset. The slot under a drag keeps the ring (mockup `.slotk.n-drag`).
9. Spec line numbers were for `61db58a`. Every §5.17 site was found at or near the cited line on the current base (`c2a70b8`, vLaunch2.2). Nothing new since then used red for selection; the Host overlay resize grip has no red.

## OWNER_Q10

`OWNER_Q10_NEW_COLOR_ROLES` (`src/constants/owner-decisions.ts`) is `true`. Nothing switches on it. A cheap switch back to red would need the old red literals in source, which the red-reserved rule exists to forbid. Going back means reverting the MC commits. `color-roles.ts` says so in its header.

## Stubbed or deferred

- **After screenshots** for M-35, M-37 and ProofSheet, light and dark, are in `mc-screens/` (taken with the QWERTY example; see Review, MC-5). **Before** screenshots were not retaken: that needs the pre-MC build running beside this one, and this run only works in this worktree. The before states are drawn in mockups.html (M-35 to M-37, `bo-*` states), which the owner approved. Retake them from `18711f4` when the PR is prepared if the reviewer wants live ones. M-36 (Matrix Tester) needs the Mule.
- Practice's `RED_ALLOWED` entries (wrong-key border and badge, error tint): added with the Practice code (M1b). Until that code exists they would be stale entries, and stale entries fail the test.
- `kb-pressed`, heat and usage tokens are unused until M1b/M4, as planned.
- FragmentsPanel status text (`text-amber-*`/`text-blue-*`), ScanLab's pending text, the Layouts search focus ring, the "Clear search" link and the search-match highlight stay as they are, per the §5.17 "stays" rows.
- The manual's screenshots show red selection. Refresh them in the release that ships MC (§13.1 risk row).

## Needs Mule testing

- Matrix Tester: hold three keys and release five. Check that held keys show the blue face with the 3 px ring, "was pressed" keys are black, and in dark theme the black keys show the gray outline.
- Editor on the board in manual-update mode: a pending key shows the dashed amber border, the Apply pill shows the dashed amber outline, and **Apply** clears both.

## Follow-ups

- Still to see by eye: the editor with a selected key **among blue-layer neighbors** (ProofSheet showed selected keys on a blue layer, not next to unselected blue ones), the Layouts drop target (needs a real file drag), and the palette key's drag hover (`components/EditorKey.tsx` only renders today as the drag overlay, which never gets `onDrop`, so that state isn't reachable in the UI; it's covered by a render test).
- Keys inside `overflow-hidden` panel rows may clip the new outside hover ring where no `hoverBorderColor` is passed. The editor board does not clip it (`m35-selected-hover-zoom-*.png`: the ring on S paints over ESC, B and X). Panels not checked.
- The headless check drove Chrome over CDP with a throwaway script in the session scratchpad (the chrome-devtools MCP browser couldn't load any page). It's not part of the repo.

## Review

An independent review produced five findings. Each was checked against the code.

| ID | Severity | Disposition |
|---|---|---|
| MC-1 | major | **Fixed.** Confirmed with a render: the drop-target slot's strip kept `text-white` on `kb-select-strip`. The slot now passes `selected={selected \|\| isDropTarget}` to `Key`, so `Key.tsx` puts `SELECTED_STRIP_CLASSES` after the base `text-white`, and passes no strip in `headerClassName`. New render tests in `tests/components/EditorKey.colorRoles.test.tsx` assert `text-kb-ink` and no `text-white` on the strip, for the selected and the drag-hover slot. Checked by eye in both themes (`mc-screens/m37-combo-slot-states-zoom.png`). |
| MC-2 | minor | **Fixed.** `dragHover` in `components/EditorKey.tsx` adds `text-kb-ink`. It isn't `!text-kb-ink`: tailwind-merge only drops the green key's `text-white` for a class of the same kind, and an important class would leave both in the list. Render test added. This state isn't reachable in the UI today (the component only renders as the drag overlay, without `onDrop`), so the bug was latent. |
| MC-3 | minor | **Fixed, mockup look kept.** New `SELECTED_SLOT_CLASSES` (`color-roles.ts`) = `border-2 border-kb-select bg-kb-select-tint ring-0 ring-offset-0`, which cancels the ring `Key.tsx` adds to selected keys. Recorded as deviation 8. Render test asserts no `ring-2`/`ring-offset-1`. |
| MC-4 | minor | **Fixed.** `RedAllowed` entries carry `tokens: string[]`, and `matchesRedAllowed` requires the finding's token to be listed. A listed token that no longer appears is reported as stale. New self-test: `ring-red-500` added next to the allowed trash hover in `BindingEditor/EditorKey.tsx` is still flagged. |
| MC-5 | minor | **Mostly fixed.** Ran the dev server and checked in headless Chrome: ProofSheet with Selected and Pending on (light, dark, green and blue layer colors, keys with header strips), the editor's selected key with a hovered neighbor (M-35) in sidebar and bottom-bar modes, and the combo editor's selected and drop-target slots (M-37) in sidebar and bottom-bar modes, all light and dark. Screenshots are in `mc-screens/`. Before screenshots weren't retaken (see Stubbed or deferred). The built-CSS part: after `npm run build`, `dist/assets/index-*.css` has the same token values as `src/index.css` (`--kb-select:#2b86bd`/`#5cb8ec`, `--kb-select-tint:#dfeff9`/`#244154`, `--kb-select-strip:#bfdff2`/`#295773`, `--kb-pending:#b45309`/`#fbbf24`) and emits `.ring-0` and `.ring-offset-0`. The contrast test stays on `src/index.css`: `npm test` runs before any build, and Tailwind v4 copies the values unchanged. M-36 (Matrix Tester live presses) remains **needs Mule testing**. |
