# By scope: rationale (round 2)

Mockups: [index.html](index.html) ([light](preview-light.png), [dark](preview-dark.png)).
Item-by-item: [mapping.md](mapping.md). The rule and shared destinations:
[settings-structure.md](../../settings-structure.md).

## The idea

One Settings panel opens on a landing list in three groups, named for what each acts on:

1. **This keyboard:** Firmware, Board, Backups.
2. **This browser:** Appearance, Editing.
3. **Keybard:** About, Developer.

Each row shows its current value and drills into a page with a back arrow and a breadcrumb.

## What changed from round 1

- **The keyboard group lost Typing, Pointing, Lighting, and Scanning and power.** Round 1 made
  "On the keyboard" mean "everything stored on the board", which pulled board configuration
  into Settings. Under the round-2 rule, that configuration lives in the editor
  (settings-structure 2).
- **Combo and leader timing go back to their panels.** The gears are gone.
- **Backups moved from the browser group to the keyboard group.** Snapshots are stored in the
  browser, but restore writes to the board. The group names what it acts on.
- **Scan Lab's bootloader reboot stays in Scan Lab.** Round 1 moved it under Firmware ›
  Advanced. The customer's path is the install list.
- **The toolbar firmware pill is gone.** The Settings dot (U-Q1) is the signal.

## Why it's still worth having

- **The group titles are the clearest labels of the three options.** "This keyboard" and "This
  browser" answer "does this follow my board to another computer?" without help text. SP and
  BT both graft them.
- **It scales best.** If Keybard grows many more app preferences or tools, each becomes a page
  under a group, and the landing list stays short.
- **Print inside Export** is BS's idea: one dialog for every file that leaves the board.

## Trade-offs

- **A click for very little.** Most pages now hold two to six rows, so a drill-in costs a
  click to reach almost nothing. That's the main reason SP is recommended over it.
- **Its round-1 argument is gone.** Round 1 justified the grouping by "this group is reset by
  an update". Nothing in Settings is reset by an install now. The groups still read well, but
  only as labels.
- **About is one level deeper.** Showing the version on the About row makes up for it.

## Build cost

Like SP, plus a landing list and a page router in `SettingsPanel.tsx` (settings sub-routes in
`PanelsContext` for deep links from the dot and dialogs). Round 1's Typing, Pointing, Lighting
and Scanning pages aren't built. The editor-side work is shared (settings-structure 6).

## Open

The owner's questions (N3-N5) are in settings-structure section 7.
