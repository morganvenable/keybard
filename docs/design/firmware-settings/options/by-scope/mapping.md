# By scope: where every item goes (round 2)

Round 2 revision. Round 1 filled the "On the keyboard" group with board configuration:
Typing, Pointing, Lighting, and Scanning and power. It also moved combo and leader timing
into Settings, with a gear in each panel. All of that has left Settings, and the gears are
gone. The rule and shared destinations are in
[settings-structure.md](../../settings-structure.md). Mockups: [index.html](index.html).
Its round-2 banner lists what the drawings still show from round 1.

## The structure

The landing list has three groups, named for what each acts on. Each row shows its current
value and drills into a page with a back arrow.

```
THIS KEYBOARD
  Firmware            vLaunch3 · both halves       (dot when an update is carried)
  Board               Kip
  Backups             12 snapshots
THIS BROWSER
  Appearance          System · Auto
  Editing             English (US)
KEYBARD
  About               vLaunch2.4
  Developer           Scan Lab, Key Proof Sheet
```

Round 1's argument was "this group is reset by a firmware update". Nothing left in Settings
is reset by an install now, so the groups simply say what each page acts on. The reset
story lives on the update sheet (update-flow 4.1).

## Settings: every item, with its home and reason

| Item | Today | Home here | Control | Reason |
|---|---|---|---|---|
| Firmware status per half | About, chip, note | This keyboard › Firmware › "This keyboard" | Value rows | What the board runs |
| Detected pointing module | Fragments | Firmware › "This keyboard", per half | Value | Read-only status that decides which file fits |
| Install list, `Choose a file…` | (new) | Firmware page hero and list | List + primary button | The one install path |
| `Update one half…` | (new) | Firmware › Advanced | Link row | Rare |
| Halves differ, no updater, newer than Keybard | chip, card | Firmware page states | Page state | One place, one wording |
| The update | (new) | The sheet opens over the Firmware page | Dialog | Hands-off flow |
| Board name, Save | General | This keyboard › Board › Name | Text + Save on Enter/blur | Identity |
| Serial | General | Board › Serial | Value | Identity |
| Restart keyboard | General | Board › Restart keyboard | Button | A device action |
| Backup folder | Backups | This keyboard › Backups › Backup folder | Value + actions | Round 1 filed it under "In this browser". It moves here because restore writes to the board |
| Snapshots, Restore, Download, Delete, Show all | Backups | Backups | Rows | Copies of the board |
| `Before <release>`, `Back up now` | (new) | Backups, top (graft from BT) | Row, button | The update's safety net |
| Import layout | toolbar | Backups › Import layout (the toolbar icon opens the same dialog) | Link row | Board file operation, two doors |
| Export layout, with Print as a format | toolbar, General | Backups › Export layout | Link row | One dialog for every file out (kept from round 1) |
| Theme | General | This browser › Appearance › Theme | Segmented | App preference |
| Key size | canvas corner | Appearance › Key size | Segmented | App preference, one home (N5) |
| Panel position | canvas corner | Appearance › Panels | Segmented | App preference, one home (N5) |
| Typing Binds a Key | General | This browser › Editing | Switch | How assigning works |
| Serial Assignment | General | Editing › Advance after assigning | Select | How assigning works |
| International Keyboards | General | Editing › Key legends | Select | What the legends show |
| Keybard release and build | About | Keybard › About | Value | Fixes "1.0.0" |
| Manual, Release notes, community, other site | About, rail | About | Link rows | App info. The site is the channel |
| Scan Lab | Developer | Keybard › Developer › Scan Lab | Link row | Developer tool (settings-structure 5) |
| Key Proof Sheet | Developer | Developer › Key Proof Sheet | Link row | Developer tool |
| Scan Lab's reboot into bootloader | Scan Lab | Stays in Scan Lab (round 1 moved it to Firmware › Advanced) | | Developer only. The customer path is the install list |

## Outside Settings (same in all three options)

| Item | Home | Reason |
|---|---|---|
| Tap-Hold, Auto Shift, One Shot, Magic, Grave Escape | New rail item **Typing behavior** | Typing configuration |
| Mouse keys values (9) | **Mouse Keys** panel › Movement | They tune those keys |
| Combo timeout | **Combos** panel, inline input kept, no gear | Already its home |
| Leader timeout, per-key timing | **Leaders** panel, inline input kept, no gear | Already its home |
| DPI, scroll mode, Auto Mouse, natural scroll, axis lock | **Pointing Devices** panel, no gear | Already its home |
| Fragments presets and per-finger selects | New rail item **Clusters** (N4) | They change the drawn layout |
| Layer colors, brightness | **Layer header color dot** | They belong to the layer. No Lighting page |
| Scan and idle tuning, Dim RGB When Idle | **Scan Lab** › Tuning | Developer tuning, not a customer page |
| Live Updating / Manual | **Toolbar** | A working mode |
| Overlay / Keybard Host | **Rail** | A feature |
| Layouts library Import, Make Default Layer | **Layouts** panel, **layer menu** | Unchanged |

## Removed

| What | Reason |
|---|---|
| Round 1's Typing, Pointing, Lighting, and Scanning and power pages | Board configuration has its home in the editor |
| Header gears in Pointing Devices, Combos and Leaders | No configuration in Settings, so nothing to point to |
| Round 1's "Board > Finger clusters" | Moved to Clusters |
| Category tiles, the QMK Settings panel id, the About rail item, `OnOffToggle` in Settings | Replaced |
| Dead `SETTINGS` entries, the registry stubs, the dead Export dialog, `KeyboardConnector.tsx` | Unreachable code |
| 6 s chip, `FirmwareUpdateNote`, round 1's toolbar firmware pill | The Settings dot (U-Q1) replaces them. The halves-differ banner (U-Q6) is the only firmware message in the editor |
