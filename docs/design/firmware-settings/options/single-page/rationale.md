# Single page: rationale (round 2, recommended)

Mockups: [index.html](index.html) ([light](preview-light.png), [dark](preview-dark.png)).
Item-by-item: [mapping.md](mapping.md). The rule and shared destinations:
[settings-structure.md](../../settings-structure.md).

## The idea

Settings is one scrolling page, with anchor chips that jump to a section and follow the
scroll. Every row has its label on the left and its control on the right, built from one
small control set. Firmware is the first row: a status line that expands into the install
list. **Update** opens the hands-off update sheet ([update-flow.md](../../update-flow.md)
4-5).

The page has three groups: **This keyboard** (Firmware, Board, Backups and files), **This
browser** (Appearance, Editing) and **Keybard** (About, and Developer, collapsed).

## What changed from round 1

- **Hardware, Typing and Pointing left the page.** So did the Pointing panel's "Pointer
  settings" link, and the Overlay section. They configure the board, or they're features,
  and each now has one home in the editor (settings-structure 2).
- **Search went.** About 25 rows don't need it, and its "Elsewhere" results pointed into the
  editor.
- **Group titles changed** from "Stored on the keyboard / in this browser" to BS's plainer
  "This keyboard / This browser / Keybard". Nothing left on the page is reset by an install,
  so the storage framing had nothing to say.
- **The update flow no longer expands inline.** The flow is now one confirm and then hands
  off, so a dialog over the page fits better than a flow inside a scrolling panel. The
  expanded Firmware row shows status and the install list only.
- **Grafts:** `Back up now` and pinned `Before <release>` snapshots (from BT), and Print as an
  Export format (from BS).

## Why recommend it

1. **Short now, so one page is enough.** With configuration gone, every row is visible with a
   scroll and no navigation. Round 1's main weakness (about 110 rows, so it needed search) is
   gone.
2. **Firmware is a status, always in view.** "vLaunch3 · both halves" is the first line. When
   an update is carried, the dot on Settings leads here, and the row already says so.
3. **Fewest moving parts.** No landing list, no page router, no back crumbs. In bottom-bar
   mode, a page this short fits a two-column layout instead of a drill-down (open, below).
4. **One control set**, the same in all three options.

## Trade-offs

- **Less room to grow.** If Keybard gains many more app preferences, the page grows. Anchors
  carry it to about 40 rows. Past that, BS's drill-in pages scale better.
- **No landing summary.** BT's home shows a live value per destination. Here the rows *are*
  the values, so nothing is lost, but there's no compact overview either.
- **Key size and panel position leave the canvas corner** (N5). That costs a click for anyone
  who toggles them often.

## Build cost

The Settings part is smaller than round 1's, since the configuration sections aren't
re-homed into it. Settings work runs separately from the updater work.

- `SettingsPanel.tsx`: rewritten as the page. The dead Export dialog and hidden input go.
- `SettingsContext.tsx`: categories become sections. The dead `SETTINGS` entries and
  `refreshHardwareSettings()` go.
- New `components/settings/` rows (`SettingsRow`, `SettingSwitch`, `SettingSelect`,
  `SettingSegmented`, `SettingLinkRow`, `SettingGroupRow`, `SettingsSection`).
- New `features/firmware-update/` (FirmwareRow, the sheet, the state machine,
  `updater.service.ts`, `firmware-releases.ts`). The same under any option.
- Editor side (all options): a Typing behavior panel from `QMKSettingsPanel.tsx`, a Clusters
  panel from `FragmentsPanel.tsx`, a Movement section in Mouse Keys, a Tuning section in
  `ScanLabPanel.tsx`. All are registered in `SecondarySidebar.tsx` and `BottomPanel.tsx`.
- `AboutPanel.tsx` is deleted. `EditorControls.tsx` loses the corner controls (if N5 is
  answered that way).

## Open

- **Bottom-bar mode:** two columns in a full-width bottom panel, or a full-height sheet?
  Recommended: two columns. The page is short enough now.
- The owner's questions (N3-N5) are in settings-structure section 7.
