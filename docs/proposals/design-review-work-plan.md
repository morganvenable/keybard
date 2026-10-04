# Keybard design review and work proposals

This document collects the three proposed batches from the design review, preserves the original work-item numbers, and incorporates the subsequent implementation and design feedback.

## Product direction

**Keybard is a mouse-first GUI for editing a physical keyboard.** Clicking, selecting, dragging, and using visible controls should provide a complete, efficient workflow. Keyboard operation is an optional alternative, not the organizing principle of the interface.

Because the keyboard being used may also be the keyboard being edited, ordinary typing must never implicitly become assignment. Keyboard navigation and recording a key are separate operations. Recording requires an explicit action, a visible destination, and a clear way to cancel. Menus, dialogs, form fields, and ordinary navigation must not accidentally change live bindings.

Other constraints agreed during review:

- Preserve vertical space. Routine connection identity and status must fit existing controls or their tooltips. Do not add a permanent status row above the editor.
- Keep the preview badge exactly **“Sval preview.”**
- Keep power and diagnostic controls under Developer, including trackball rest mode.
- Treat blank names as intentional. Do not skip blank layers or substitute old default names.
- Improve the existing app incrementally. Each numbered package remains independently reviewable.
- Keep production users unaffected while the changes are reviewed and tested.

## Scope, evidence, and status

The review combined source inspection by three subagents with Chromium checks of the local demo at desktop, laptop, and narrow-window sizes. Findings about hardware writes were initially source findings; implementation tests use simulated device responses. Physical-board verification remains necessary.

The earlier Pointing Devices nested-scrollbar repair and layer-name persistence repair were already present at review time. They are not listed as unfixed regressions. The proposals address related problems elsewhere and prevent recurrence.

| Batch | Packages | Objective | Current status |
| --- | --- | --- | --- |
| 1 | 1–5 | Reliable edits, persistence, import, and recovery | Implemented for local review on `fix/keybard-editing-reliability`; physical-board acceptance remains |
| 2 | 6–9 | Reachable layouts, consistent panels, optional accessible operation | Proposed; not authorized for implementation |
| 3 | 10–15 | Clear organization, usable editors, consistent visuals, useful help | Proposed; not authorized for implementation |

Batch 1 implementation: `712de8d`. Follow-up corrections: concentric layer-color indicator in `16d1e62`; removal of the extra status row and relocation of Undo into the existing toolbar in `201703b`.

Validation at the end of the main implementation: **549 tests passed**, TypeScript passed, and the preview build succeeded. The final full-suite run used two workers and a 15-second test timeout after parallel runs encountered timing failures. The subsequent small UI corrections passed TypeScript; the status correction also passed its three focused tests. Browser checks exercised the offline demo and import review, not a connected physical board. No deployment or upstream push was performed.

Priority: **P1** means high-priority correctness, safety, or reachability work. **P2** means the next usability/consistency pass. Small, medium, and large are relative effort estimates, not delivery dates.

## Batch 1 — Editing and data reliability

### 1. Make saving consistent and truthful

**P1 · Large · Implemented for review**

**Problem:** Different controls have different persistence behavior. Some bypass Manual Updates; some fail without retaining pending work; some callbacks write stale snapshots. Apply and mode switching do not consistently explain progress or failure.

Specific work:

- **1.1** Route editable device settings through one mutation queue, including binding assignment, drag/drop, options, clears, timing controls, and hardware configuration.
- **1.2** Make Manual mode stage changes without device writes until Apply.
- **1.3** Serialize writes and coalesce them by the actual firmware write unit: one key position, one combo, one tap dance, or the complete macro table as appropriate.
- **1.4** Await writes and persistence operations; propagate failures to the queue instead of logging and continuing as though saved.
- **1.5** Retain failed and newer edits. Provide visible pending, saving, failure, and retry states.
- **1.6** Show the pending scope, prevent duplicate Apply transactions, and switch to Live only after a successful commit.
- **1.7** Make Discard explicitly refer to pending draft edits. Do not imply it reverses successful hardware writes from a partially completed transaction.
- **1.8** Prevent queued or in-flight operations for one board from reaching a replacement board.
- **1.9** Keep routine save information within existing controls. Explain immediate maintenance actions separately rather than disguising them as ordinary queued edits.

Acceptance:

- Manual editing produces zero configuration writes before Apply.
- An A → B → A editing sequence leaves the final draft on the device, not an older captured version.
- Rejected writes retain recoverable work and never produce a successful-save claim.
- A target change cannot redirect old queued writes to the new keyboard.
- Reconnect and power-cycle checks confirm durable changes on supported firmware.

Implementation notes: the queue now supports serialization, stable write keys, retry, pending details, guarded mode switching, and target-change coordination. Board-name maintenance remains an explicitly confirmed **Save now** action and is serialized with other device activity. Discard is restricted after a failed transaction rather than pretending it can roll back partially applied hardware changes.

### 2. Remove accidental and invisible editing

**P1 · Medium · Implemented for review**

**Problem:** Off-target drops remove bindings; opening empty editors can enable entries; globally armed typing can turn ordinary keyboard use into live edits.

Specific work:

- **2.1** Treat an off-target drop as cancellation, preserving the original binding.
- **2.2** Cancel dragging on Escape or loss of window focus.
- **2.3** Make opening, inspecting, and closing an editor read-only. Enabling an entry must be an intentional action.
- **2.4** Replace implicit typing capture with explicit **Record a key**, showing the destination and stopping after assignment or cancellation.
- **2.5** Keep navigation and form input out of the assignment handler. Escape and Tab must not accidentally bind themselves during navigation.
- **2.6** Provide an immediate Undo action for supported key/binding edits and clears, restoring the affected entry without erasing unrelated edits.
- **2.7** Keep click-to-select and visible GUI controls as the normal editing path.

Acceptance:

- Browsing an empty combo, override, leader, or alternate-repeat editor does not write to the board.
- Abandoned drags preserve bindings.
- Typing without explicitly recording does not assign keys.
- Dialog navigation and field editing do not mutate selected bindings.
- Undo behaves consistently in Live and Manual modes and is cleared when the editing target changes.

Implementation notes: Undo is a last-action facility, not a complete transaction-history system. It occupies the existing toolbar. Explicit recording is optional; this work does not make keyboard navigation the primary editing workflow.

### 3. Repair editor persistence inconsistencies

**P1 · Medium · Implemented for review**

**Problem:** Keyboard deletion in the macro editor follows a different path from its trash button. Macro and tap-dance names look editable without a dependable persistence contract.

Specific work:

- **3.1** Use the same mutation path for macro deletion by keyboard and by trash control.
- **3.2** Preserve pending/save state consistently when changing or deleting actions.
- **3.3** Persist macro and tap-dance labels through the firmware label mechanism where supported.
- **3.4** Reload labels on connection and replace stale maps with board-authoritative values.
- **3.5** Support blank names as deliberate clears; keep label types and device identities separate.
- **3.6** Validate firmware support and UTF-8 byte limits before writing names.
- **3.7** Make unsupported-device behavior explicit. Offline names remain exportable metadata; do not claim they are stored on unsupported firmware.

Acceptance:

- Mouse and keyboard deletion produce the same draft and saved macro.
- Supported names survive refresh/reconnect; clearing a name stays cleared.
- Editing one label type does not overwrite another.
- Unsupported or refused label writes produce a useful error rather than a false save claim.

Implementation notes: new macro/tap-dance label loading and saving use the existing label protocol. The existing layer-name repair is preserved.

### 4. Make import and backup trustworthy

**P1 · Large · Implemented for review**

**Problem:** Import can start writing immediately, exceed device capacities, silently omit content, or conceal lossy conversion. Toolbar and Settings imports have separate behavior.

Specific work:

- **4.1** Use one reviewed-import workflow from both toolbar and Settings.
- **4.2** Parse and validate without writes; show what will be replaced, retained, skipped, or rejected.
- **4.3** Validate matrix dimensions, layer/table capacities, keycodes, macro buffer limits, names, timing values, and custom-value widths.
- **4.4** Offer a backup of the current layout before applying.
- **4.5** Require an explicit Apply/Open action after review. Selecting or cancelling a file must not write.
- **4.6** Stage the complete import before execution. Manual mode leaves it pending; Live mode commits the complete staged set.
- **4.7** Include the final persistence command in the transaction. A failed final save must remain retryable.
- **4.8** Restore supported imported names, including blanks, and report labels that cannot be restored to the current firmware.
- **4.9** Preserve backup contents faithfully, including Unicode text, zero values, colors, and disabled tap dances. Distinguish lossless storage from what firmware can actually execute.
- **4.10** Correct format detection and advertise only formats with an actual supported path.
- **4.11** Surface import/export failures and partial outcomes. Do not silently skip unsupported custom fields.
- **4.12** Route offline imports through the offline-target lifecycle so source identity, baseline, and pending-work protection remain correct.

Acceptance:

- No writes occur before approval.
- Incompatible files are blocked with specific reasons.
- Unsupported fields are listed; preserved board settings stay preserved.
- Supported content survives export/import round trips.
- Failed application or final persistence cannot be reported as a successful import.

Scope boundary: comprehensive migration from old Vial `.vil` or `.kbi` layouts remains the separately deferred project. This batch makes current support truthful and safe; it does not promise universal historical conversion. Unsupported cross-firmware migration is explicitly blocked or explained.

### 5. Clarify connection, offline files, and recovery

**P1 · Medium · Implemented for review**

**Problem:** Browser capability guidance is disabled, errors lose useful details, offline files can inherit previous-board metadata, and changing targets can leave ambiguous connection or draft state.

Specific work:

- **5.1** Detect WebHID capability and explain unsupported connection environments while retaining supported offline/demo functions.
- **5.2** Distinguish connecting, loading, connected, offline/demo, and failed states.
- **5.3** Identify the current editing target through existing controls/tooltips, without a permanent extra row.
- **5.4** Preserve useful connection/load errors and provide the relevant recovery path.
- **5.5** Avoid duplicate loads, unhandled rejections, and racing cleanup.
- **5.6** Close the old transport when entering offline work and prevent old structural metadata from leaking into unrelated files.
- **5.7** Protect dirty work during refresh and target changes; respect cancellation.
- **5.8** Settle active device work before transport replacement and prevent interaction during the transition.
- **5.9** Keep permitted devices individually selectable, including identical models.

Acceptance:

- Users can determine whether they are editing a device or an offline file without sacrificing workspace height.
- Cancelled target changes retain the current work.
- Connection failures leave a recoverable interface.
- Offline editing never silently writes to an old or later-connected board.

## Batch 2 — Layout, panel consistency, and optional access

### 6. Fix clipping and responsive layout

**P1 · Large · Proposed**

**Problem:** Browser checks reproduced clipped board/layer content at 1024×768 and substantial inaccessible content in a narrow window. The 850px editor minimum and shrinking keycaps do not form a usable responsive strategy.

Specific work:

- **6.1** Define normal desktop, constrained desktop/zoom, and narrow inspection layouts.
- **6.2** Remove inappropriate page-wide minimum widths while retaining a deliberate board-canvas size.
- **6.3** Make the board independently pannable when needed; keep commands and settings inside the viewport.
- **6.4** Bound panel height to available space, including short windows.
- **6.5** Reflow, disclose, or scroll controls before reducing essential text to tiny sizes.
- **6.6** Keep the selected key, editing destination, and relevant actions reachable while panels are open.

Acceptance: common mouse-driven tasks work at 1280×720, 1024×768, and 200% zoom. A narrow screen has a deliberate usable presentation. Board panning is acceptable; clipping essential commands is not.

### 7. Give every panel one scrolling owner

**P2 · Medium · Proposed**

**Problem:** Settings, Quick Start, QMK Settings, Scan Lab, Fragments, and their shells contain competing scroll containers. The structural risk is confirmed; double bars were not reproduced in every panel and mode.

Specific work:

- **7.1** Define the panel shell as the ordinary vertical scrolling owner.
- **7.2** Remove redundant child overflow/height constraints.
- **7.3** Specify stable header/footer behavior and explicit exceptions for independent lists or tables.
- **7.4** Apply the same contract to sidebar and bottom-bar presentations.
- **7.5** Check long content, short windows, zoom, wheel, and touch scrolling.

Acceptance: each ordinary panel has one content scrollbar, all controls remain reachable, and scrolling does not unexpectedly transfer between nested containers.

### 8. Preserve functionality across layout modes

**P1 · Medium · Proposed**

**Problem:** Compact Settings omits functions, and bottom-bar Quick Start/About lack real content cases. Layout selection changes available functionality.

Specific work:

- **8.1** Share one panel registry and one settings definition.
- **8.2** Restore parity for board identity, QMK settings, Scan Lab, hardware configuration, and ordinary preferences.
- **8.3** Replace visible placeholder destinations with their real content.
- **8.4** Use an appropriately sized drawer or dialog when bottom-panel space cannot accommodate a task.
- **8.5** Preserve the active section and draft when changing placement.

Acceptance: every advertised destination works in every supported layout, with the same terminology and persistence behavior.

### 9. Provide safe, optional keyboard and assistive access

**P1 for focus/control correctness · Medium–Large · Proposed, revised after feedback**

**Direction:** Preserve the complete mouse-first GUI. Optional keyboard operation should make the existing interface usable consistently; it should not reshape the app around keyboard commands or encourage typing into a live binding unintentionally.

Specific work:

- **9.1** Give buttons, settings, and icon controls meaningful accessible names and semantic states.
- **9.2** Associate settings labels, values, units, and help text with their controls.
- **9.3** Remove hidden panels from the focus sequence and accessibility tree.
- **9.4** Manage focus on open/close, restore it sensibly, and provide visible focus indicators.
- **9.5** Preserve navigation labels when the sidebar collapses into icons.
- **9.6** Make rename, color, and other existing GUI actions optionally operable without a mouse.
- **9.7** Provide an optional board-selection navigation mechanism with clear position/binding/selection announcements. Its exact interaction design should be reviewed before implementation.
- **9.8** Keep key recording separate from navigation. No implicit capture or automatic live assignment based merely on focus or selection.

Acceptance:

- The normal workflow remains visibly mouse-driven and complete.
- Optional keyboard operation performs the same explicit actions and uses the same save pipeline.
- Hidden controls cannot receive focus; controls announce their names and state.
- Navigating the app with the physical keyboard cannot accidentally rebind it.

This replaces the earlier keyboard-navigation-centered framing of package 9. The optional board-navigation sub-item can be approved separately from basic labels, focus, and hidden-panel fixes.

## Batch 3 — Organization, editor usability, and visual consistency

### 10. Reorganize navigation around recognizable tasks

**P2 · Medium · Proposed**

Specific work:

- **10.1** Group key assignment, advanced behaviors, layouts/backups, and board/app settings explicitly.
- **10.2** Resolve overlapping destinations such as Pointing Devices versus Mouse Keys.
- **10.3** Make menu names and panel titles identical.
- **10.4** Rename Fragments to a recognizable term such as Hardware configuration.
- **10.5** Put scan diagnostics, power tuning, and proof tools together under Developer.
- **10.6** Keep normal tap/hold configuration accessible rather than classifying everything originating in QMK as developer-only.
- **10.7** Retain direct access for experienced users while adding short explanations for unfamiliar behaviors.

Acceptance: changing pointer speed, making a key type a phrase, changing tap/hold behavior, and backing up a layout each have an identifiable entry point without exploring unrelated panels.

### 11. Separate pointer settings from pointer key assignment

**P2 · Medium · Proposed**

Specific work:

- **11.1** Distinguish Pointer settings from Pointer keys.
- **11.2** Make DPI, scrolling, and auto-mouse settings accessible without passing a large assignment palette.
- **11.3** Limit binding pickers to assignable keys; remove hardware settings from picker mode.
- **11.4** Explain Hold versus Toggle for Sniper and Boost.
- **11.5** Replace unexplained `TG`/multiplier-only meaning with concise help while retaining compact keycaps where useful.
- **11.6** Restore hover/focus explanations and verify speed semantics against firmware.
- **11.7** Keep power controls, including trackball rest mode, under Developer.

Acceptance: users can find device settings quickly and understand the six speed actions without knowing QMK abbreviations.

### 12. Improve macro and advanced-binding editing

**P2 · Medium · Proposed**

Specific work:

- **12.1** Reorder macro steps by insertion, preserving the order of intervening steps, instead of swapping endpoints.
- **12.2** Add visible insertion feedback and GUI Move up/down alternatives.
- **12.3** Preserve the caret during text editing and buffer text writes sensibly.
- **12.4** Validate delays and expose macro capacity and incomplete key-down/key-up sequences.
- **12.5** Explain override terminology with concise examples.
- **12.6** Use layer names where available rather than unexplained numeric grids alone.
- **12.7** Show which keys reference a behavior before clearing it, and explain the resulting behavior.

Acceptance: ordinary macro edits behave like a sequence editor; mid-string typing remains stable; invalid inputs are actionable; destructive operations explain their scope. These controls must work well with the mouse.

### 13. Establish a coherent visual system

**P2 · Medium · Proposed**

Specific work:

- **13.1** Define a small set of typography sizes, spacing increments, control heights, surfaces, and interaction states.
- **13.2** Set a readable floor for essential text; remove 8–9px compact labels.
- **13.3** Group toolbar actions by purpose and reduce competition between ordinary controls and development metadata.
- **13.4** Balance panel density and canvas space without consuming extra vertical rows for routine status.
- **13.5** Preserve physical/LED colors while choosing readable UI foregrounds and borders independently.
- **13.6** Correct low-contrast key-label combinations; several current token pairings calculate to approximately 2.2:1–3.4:1.
- **13.7** Make selected, disabled, empty, populated, pending, and failed states consistent and distinguishable without color alone.
- **13.8** Give empty macro slots a clear purpose and distinguish them from populated entries.
- **13.9** Check visual alignment of repeated primitives, including color indicators, badges, and keycap labels.

Acceptance: ordinary text meets contrast targets, essential controls stay readable, related controls look and behave consistently, and routine information does not displace the editing workspace.

Already corrected during Batch 1 review: the layer-color dot and ring now share a single SVG center, and the dot's offset shadow was removed.

### 14. Support touch, cancellation, and reduced motion

**P2 · Medium · Proposed**

Specific work:

- **14.1** Preserve click/tap-select followed by click/tap-assign as a complete alternative to dragging.
- **14.2** Use pointer events and proper capture/cancellation for mouse, touch, and pen.
- **14.3** Prevent panel scrolling from accidentally initiating a drag.
- **14.4** Increase hit regions around small color and toggle visuals.
- **14.5** Respect the operating system's reduced-motion preference, with an optional app preference if needed.
- **14.6** Remove flying, bouncing, zooming, and 3D transitions in reduced-motion mode without delaying state updates.

Acceptance: mouse use remains efficient, touch/pen do not require precision dragging, cancellation preserves bindings, and reduced-motion users can operate the same features.

Overlap already implemented: Escape, loss of focus, and off-target drag cancellation belong to Batch 1 safety work. Broader pointer support and motion treatment remain proposed.

### 15. Replace stale help and improve support information

**P2 · Small–Medium · Proposed**

Specific work:

- **15.1** Replace the dense first-use guide with connect/demo → select → assign → understand saving → back up.
- **15.2** Separate advanced shortcuts and viewing options into reference material.
- **15.3** Correct extensions, control names, typos, and hardcoded device limits.
- **15.4** Show accurate app/build and firmware identity in About.
- **15.5** Add Copy diagnostics and useful documentation/support links.
- **15.6** Move verbose branch/commit descriptions out of the ordinary editing canvas, retaining developer detail where useful.
- **15.7** Explain browser-local layouts, their backup/recovery path, and storage separation between production and preview deployments.
- **15.8** Keep the short “Sval preview” badge unchanged.

Acceptance: the guide matches the product, teaches a successful edit and backup early, and enables useful support reports without reading tiny build text from the canvas.

## Follow-up observation: slow terminal scrolling

The user reports that smooth scrolling in the terminal feels too slow unless DPI is raised substantially. The terminal application and input method still need confirmation. This is not yet attributed to Keybard, firmware scroll scaling, or terminal smoothing.

Reproduction should distinguish pointer movement speed from scroll output, compare the same input in another application, and record the relevant board scroll settings. If firmware scroll scaling is involved, its GUI controls should describe that separately from pointer DPI. No firmware or terminal changes are authorized by this observation alone.

## Review and acceptance workflow

Approve by package number or sub-item number. Batch 1 is on a local review branch; approval of its implementation does not authorize Batches 2 or 3.

For each approved batch, use the applicable parts of this matrix:

| Dimension | Checks |
| --- | --- |
| Editing target | Connected board, offline file, demo, switching targets, cancellation |
| Persistence | Live, Manual, Apply, retry, partial failure, Undo/Discard scope |
| Durability | Refresh/reconnect and power cycle on a physical board |
| Data | Blank and populated entries, long names, non-ASCII text, zero values, disabled behaviors |
| Import/export | Native round trip, incompatible file, unsupported fields, capacity limits, cancellation, failed final save |
| Layout | Sidebar and bottom bar, long panels, constrained height, 1024×768, 200% zoom |
| Input | Mouse-first workflow, optional keyboard navigation, explicit recording, touch/pen where supported |
| Recovery | Disconnect during work, refused write, unsupported browser, stale target callbacks |

Keep screenshots and focused regression tests tied to the behavior being changed. Broader responsive, screen-reader, touch, and physical-device acceptance should be reported as completed only after it has actually been exercised.
