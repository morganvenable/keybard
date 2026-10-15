# By task: where every item goes (round 2)

Round 2 revision. Round 1's Board page held typing behavior (QMK), hardware (Fragments), and
an "Elsewhere > Pointing Devices" link. Editor mirrored Live Updating, key size and panel
position, and About had a Keybard Host shortcut. All of that is gone. The rule and shared
destinations are in [settings-structure.md](../../settings-structure.md). Mockups:
[index.html](index.html). Its round-2 banner lists what the drawings still show from
round 1.

## The structure

The home is a list of five jobs. Each opens a page, with a "Settings" back crumb, and the
home shows a live value beside each one.

```
Settings
  Keyboard           Kip · vLaunch3        what this board is and what it runs; update it
  Backups and files  12 snapshots          back up, restore, import, export, print
  Editor             System · English (US) how Keybard looks and assigns keys
  About              vLaunch2.4            Keybard release, manual, other site
  Developer          (collapsed)           Scan Lab, Key Proof Sheet
```

Round 1 split Board and Firmware. With configuration gone, Board is three rows, so it joins
Firmware on one **Keyboard** page: identity at the top, then firmware. One page answers
"which board is this, what does it run, update it".

## Settings: every item, with its home and reason

| Item | Today | Home here | Control | Reason |
|---|---|---|---|---|
| Board name, Save | General | Keyboard › Name | Text + Save | Identity, first on the page |
| Serial | General | Keyboard › Serial | Value | Identity |
| Restart keyboard | General | Keyboard › Restart keyboard | Button | A device action |
| Firmware status per half | About, chip, note | Keyboard › Firmware, one card per half | Cards | What the board runs |
| Detected pointing module | Fragments | On each half's card | Value | Read-only status that decides which file fits |
| Install list, `Choose a file…` | (new) | Keyboard › Firmware › Install | List + primary button | The one install path |
| `Update one half…` | (new) | Firmware › Advanced | Link row | Rare |
| Every firmware state (available, halves differ, no updater, newer than Keybard, offline) | chip, card, dialogs | Keyboard page states | Page state | BT's strength from round 1, kept |
| The update | (new) | The sheet opens over the Keyboard page | Dialog | Hands-off flow |
| Backup folder | Backups | Backups and files › Backup folder | Value + actions | Where the board's backups go |
| Snapshots, Restore, Download, Delete, Show all | Backups | Backups and files | Rows | Copies of the board |
| `Before <release>` (pinned), `Back up now` | (new) | Backups and files, top | Row, button | Kept from round 1 |
| Import layout | toolbar | Backups and files › Import (the toolbar icon opens the same dialog) | Link row | Board file operation, two doors |
| Export layout | toolbar | Backups and files › Export, with Print as a format (graft from BS) | Link row | One dialog for every file out |
| Theme | General | Editor › Look › Theme | Segmented | App preference |
| Key size | canvas corner | Editor › Look › Key size, **only** here (round 1 mirrored it) | Segmented | One home (N5) |
| Panel position | canvas corner | Editor › Look › Panels, only here | Segmented | One home (N5) |
| Key legends | General | Editor › Look › Key legends | Select | What the legends show |
| Typing Binds a Key | General | Editor › Assigning keys | Switch | How assigning works |
| Advance after assigning | General (Serial Assignment) | Editor › Assigning keys | Select | How assigning works |
| Keybard release | About | About › Keybard | Value | Fixes "1.0.0" |
| Manual, Release notes, community | About, rail | About | Link rows | App info |
| Other site | (new in round 1) | About › Site | Link row (no toggle) | The site is the channel |
| Scan Lab | Developer | Developer › Scan Lab | Link row | Developer tool (settings-structure 5) |
| Key Proof Sheet | Developer | Developer › Key Proof Sheet | Link row | Developer tool |

## Outside Settings (same in all three options)

| Item | Home | Reason |
|---|---|---|
| Tap-Hold, Auto Shift, One Shot, Magic, Grave Escape | New rail item **Typing behavior** | Typing configuration. It was round 1's "Board > Typing behavior" |
| Mouse keys values (9) | **Mouse Keys** panel › Movement | They tune those keys |
| Combo timeout | **Combos** panel | Already its home |
| Leader timeout, per-key timing | **Leaders** panel | Already its home |
| DPI, scroll mode, Auto Mouse, natural scroll, axis lock | **Pointing Devices** panel. No "Elsewhere" link | Already its home |
| Fragments presets and per-finger selects | New rail item **Clusters** (N4) | It was round 1's "Board > Hardware" |
| Layer colors, brightness | **Layer header color dot** | They belong to the layer |
| Scan and idle tuning, Dim RGB When Idle | **Scan Lab** › Tuning | Developer tuning |
| Live Updating / Manual | **Toolbar** only (round 1 mirrored it in Editor) | A working mode |
| Overlay / Keybard Host | **Rail** only (round 1 added an About shortcut) | A feature. Host status shows inside the update sheet |
| Make Default Layer | **Layer menu**. Its "needs newer firmware" note links to Keyboard › Firmware | A per-layer action. The link points toward management, which is allowed (settings-structure 5) |
| Layouts library Import | **Layouts** panel | Unchanged |

## Removed

| What | Reason |
|---|---|
| Round 1's Board › Typing behavior, Board › Hardware, Board › Elsewhere | Board configuration has its home in the editor |
| Round 1's mirrors: Editor › Sending changes, the corner controls mirrored in Editor › Look | One home each |
| Round 1's About › Keybard Host shortcut | A feature, not app info |
| Round 1's separate Board and Firmware destinations | Merged into Keyboard |
| Category tiles, the `qmksettings` and `about` panel ids, the About rail item | Replaced |
| Dead `SETTINGS` entries, the registry stubs, the dead Export dialog, `KeyboardConnector.tsx` | Unreachable code |
| 6 s chip, `FirmwareUpdateNote`, round 1's editor firmware pill | The Settings dot (U-Q1) replaces them. The halves-differ banner (U-Q6) stays |
