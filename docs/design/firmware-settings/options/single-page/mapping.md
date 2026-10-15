# Single page: where every item goes (round 2, recommended)

Round 2 revision. Round 1 put pointing, typing (QMK), hardware (Fragments), and a link into
Pointing Devices on this page. All of that has left Settings. The rule and the shared
destinations are in [settings-structure.md](../../settings-structure.md). Mockups:
[index.html](index.html). Its round-2 banner lists what the drawings still show from
round 1.

## The page

```
Settings                                     [Firmware] [Board] [Backups] [Appearance] [Editing] [About]
  Firmware  vLaunch3 · both halves              Update ▸      <- status row, expands
  THIS KEYBOARD
    Board            name · serial · restart
    Backups and files  folder · snapshots · back up now · import · export
  THIS BROWSER
    Appearance       theme · key size · panels
    Editing          typing binds a key · advance after assigning · key legends
  KEYBARD
    About            release · manual · release notes · community · other site
    Developer ▸      Scan Lab · Key Proof Sheet       (collapsed)
```

About 25 rows. Anchor chips jump to a section and follow the scroll. There's no search box
(settings-structure 2).

## Settings: every item, with its home and reason

| Item | Today | Home here | Control | Reason |
|---|---|---|---|---|
| Firmware status per half | About, chip, note | Firmware row (first on the page): `vLaunch3 · both halves`, expanding to one line per half | Status row | The board's most important fact. First, so it's seen without looking for it |
| Detected pointing module | Fragments, "Locked" | Firmware row, expanded: `Left half vLaunch3 · Trackball` | Value | Read-only fact that decides which file fits. It isn't configuration |
| Install list, `Choose a file…` | (new) | Firmware row, expanded | List + primary button | One path for update, reinstall, downgrade and custom files (update-flow 3.3) |
| `Update one half…` | (new) | Firmware row, expanded, Advanced | Link row | Rare (Q9), so it's behind Advanced |
| Halves differ, no updater, newer than Keybard | chip, card | Firmware row states (orange when halves differ) | Status row | One place says it, with one wording |
| The update itself | (new) | Opens the sheet (update-flow B1) as a dialog over the page | Dialog | Hands-off flow, so it doesn't need to stay in a scrolling page |
| Board name, Save | General | This keyboard › Board › Name | Text + Save | Board identity |
| Serial | General | Board › Serial | Value + copy | Identity |
| Restart keyboard | General, after a save | Board › Restart keyboard | Button, always shown | A device action that shouldn't hide behind a save |
| Backup folder | Backups | This keyboard › Backups and files › Backup folder | Value + ⋮ (Resume, Change, Stop using) | Where the board's backups go |
| Snapshots: Restore, Download, Delete, Show all | Backups | Backups and files, under a heading per board | Rows | Copies of the board. Restore writes to it |
| `Before <release>` snapshots | (new) | Pinned at the top of their board (graft from BT) | Row | The update's safety net, kept visible |
| `Back up now` | (new) | Backups and files, first row (graft from BT) | Button | A manual safety net beside the automatic one |
| Import layout | toolbar | Backups and files › Import layout (the toolbar icon opens the same dialog) | Link row | A board file operation. Two doors, one dialog (settings-structure 5) |
| Export layout | toolbar | Backups and files › Export layout, with Print as a format (graft from BS) | Link row | Every file leaving the board in one dialog |
| Print layers | General | Inside Export, as the format `Printed layers (PDF)` | Format option | It's an output, not a setting |
| Theme | General | This browser › Appearance › Theme | Segmented: System / Light / Dark | App preference |
| Key size | canvas corner | Appearance › Key size | Segmented: Auto / Normal / Medium / Small | App preference, one home (N5) |
| Panel position | canvas corner | Appearance › Panels | Segmented: Auto / Sidebar / Bottom bar | App preference, one home (N5) |
| Typing Binds a Key | General | This browser › Editing | Switch | How assigning works |
| Serial Assignment | General | Editing › Advance after assigning | Select | How assigning works. The new label says what it does |
| International Keyboards | General | Editing › Key legends | Select (24) | What the legends show |
| Keybard release | About ("1.0.0") | Keybard › About › Keybard `vLaunch2.4` | Value | Fixes the wrong value |
| Manual, Release notes, Svalboard community | About, rail | About | Link rows | App info |
| Other site (`Bleeding edge: next.keybard…` or `Stable: keybard…`) | (new) | About | Link row | The site is the channel (update-flow 3.2) |
| Scan Lab | Developer | Keybard › Developer › Scan Lab | Link row | Developer tool (settings-structure 5) |
| Key Proof Sheet | Developer | Developer › Key Proof Sheet | Link row | Developer tool |
| Developer group | Developer tab | Collapsed by default | Group row | Keeps tools out of customers' way |

## Outside Settings (same in all three options)

| Item | Home | Reason |
|---|---|---|
| Tap-Hold, Auto Shift, One Shot, Magic, Grave Escape | New rail item **Typing behavior** | Typing configuration |
| Mouse keys values (9) | **Mouse Keys** panel › Movement | They tune those keys |
| Combo timeout | **Combos** panel | Already its home |
| Leader timeout, per-key timing | **Leaders** panel | Already its home |
| DPI, scroll mode, Auto Mouse, natural scroll, axis lock | **Pointing Devices** panel | Already its home. Nothing in Settings links to it |
| Fragments presets and per-finger selects | New rail item **Clusters** (N4) | They change the drawn layout |
| Layer colors, brightness | **Layer header color dot** | They belong to the layer |
| Scan and idle tuning, Dim RGB When Idle | **Scan Lab** › Tuning | Developer tuning of what Scan Lab measures |
| Scan Lab's reboot into bootloader | Scan Lab | Developer only, not the customer path |
| Live Updating / Manual | **Toolbar** | A working mode while editing |
| Overlay / Keybard Host | **Rail** | A feature. Host status shows inside the update sheet |
| Layouts library Import | **Layouts** panel | Adds to the library |
| Make Default Layer | **Layer menu** | A per-layer action |

## Removed

| What | Reason |
|---|---|
| Round 1's Hardware, Typing and Pointing sections, and the Pointing panel's "Pointer settings" link row | Board configuration has its home in the editor |
| Round 1's Overlay section | A feature, not a preference |
| Settings search and its "Elsewhere" results | Short page. Cross-editor search belongs to an app-wide search |
| Category tiles, the separate QMK Settings panel id, the About panel and its rail item | Replaced by the page and the Typing behavior panel |
| `OnOffToggle` and native selects in Settings | One control set |
| Dead `SETTINGS` entries, the stub `HARDWARE_SETTINGS_REGISTRY`, the dead Export dialog and hidden input in `SettingsPanel`, `components/KeyboardConnector.tsx` | Unreachable code |
| 6 s firmware chip, `FirmwareUpdateNote` | The Settings dot and the Firmware row replace them (U-Q1) |
