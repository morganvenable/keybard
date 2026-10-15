# By task: rationale (round 2)

Mockups: [index.html](index.html) ([light](preview-light.png), [dark](preview-dark.png)).
Item-by-item: [mapping.md](mapping.md). The rule and shared destinations:
[settings-structure.md](../../settings-structure.md).

## The structure

```
Settings
  Keyboard           Kip · vLaunch3
  Backups and files  12 snapshots
  Editor             System · English (US)
  About              vLaunch2.4
  Developer          (collapsed)
```

The home is a list of jobs, each with a live value. Each opens a page with a "Settings"
back crumb.

## What changed from round 1

- **Board lost Typing behavior, Hardware and its "Elsewhere > Pointing Devices" link.** They
  configure the board, and they live in the editor now (settings-structure 2).
- **Board and Firmware merged into Keyboard.** What's left of Board is name, serial and
  restart. Putting it at the top of the firmware page answers "which board, what does it
  run, update it" in one place.
- **No mirrors.** Round 1 showed Live Updating, key size and panel position both in their
  quick spots and in Editor. Live Updating stays in the toolbar only, and key size and panel
  position live in Editor › Look only (N5).
- **No Keybard Host shortcut in About.** Host status shows inside the update sheet, where
  it matters.

## Why it's still worth having

- **Job names are the explanation.** "Keyboard", "Backups and files" and "Editor" say what
  you go there to do.
- **The Keyboard page covers every firmware state** (available, halves differ, no updater,
  newer than Keybard, offline) in one place. That was BT's strength in round 1, and SP
  grafts it.
- **Live values on the home list** let a user check the release, theme or backup count
  without opening anything.
- **`Back up now` and pinned `Before <release>` snapshots** come from BT. All three options
  now use them.

## Trade-offs

- **A drill-in for short pages.** Editor and About hold three to five rows each. The live
  values soften it, but SP shows the same rows with no click.
- **Keyboard mixes a rarely-used part (identity) with a status that changes (firmware).**
  Identity sits at the top, so firmware is one short scroll down.

## Build cost

Like SP, plus a destination list and a router in `SettingsPanel.tsx` (sub-routes in
`PanelsContext` for deep links). Round 1's Board page with QMK and Fragments isn't built.
The editor-side work is shared (settings-structure 6).

## Open

The owner's questions (N3-N5) are in settings-structure section 7.
