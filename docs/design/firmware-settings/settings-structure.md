# Settings structure, round 2

Status: design proposal, nothing built. 2026-10-14, branch `design/firmware-settings`
(Keybard at vLaunch2.4, `6ed296f`). It revises the three round-1 options in
[options/](options/) after the owner's review. Sources: the
[inventory](settings-inventory.md), the three options, and `src/` at `6ed296f`.

## 1. The rule

**Settings holds two kinds of thing: preferences for the Keybard app, and management of
the board and its firmware. Anything that configures the board's layout or devices lives
in the main editor. Settings doesn't host it, mirror it or link to it.**

Round 1 broke the rule in all three options. Each one pulled some configuration into Settings,
or linked to it from there, even where the main editor already had a home for it: a
Pointing section, a "Pointer settings" link, a header gear, a Lighting page, an "Elsewhere"
link. Round 2 removes every case.

Each item falls in one of three classes:

- **(a) App preference.** It changes how Keybard looks or behaves in this browser. **Settings.**
- **(b) Board or firmware management.** It acts on the board as a device: what it runs, what
  it's called, backups of it, files in and out. **Settings.**
- **(c) Board configuration.** It changes what the board does when you type or point.
  **The main editor**, in the panel for that feature.

## 2. What leaves Settings, and where it goes

These destinations are the same in all three options.

| Item | Was (round 1) | Goes to | Reason |
|---|---|---|---|
| Tap-Hold, Auto Shift, One Shot, Magic, Grave Escape (QMK settings) | Inside Settings in all three | **New rail item "Typing behavior"** in the features group, after Overrides | It changes how keys behave when typed. Today it has no rail entry, and is reached only through Settings, which caused the confusion |
| QMK mouse keys values (9: move delay, interval, max speed...) | Settings > Typing (SP, BT), Settings > Pointing (BS) | **Mouse Keys panel**, a "Movement" section under the movement keys | These values tune exactly the keys in that panel |
| Combo timeout | Combos panel (SP, BT); moved into Settings with a gear (BS) | **Combos panel** only. The BS reversal is dropped | Its home already has the input |
| Leader timeout and per-key timing | as combos | **Leaders panel** only | Same |
| Pointing DPI, scroll mode, Auto Mouse, natural scroll, axis lock | Settings section + link row (SP), Settings page + gear (BS), "Elsewhere" link (BT) | **Pointing Devices panel** only, as today. No section, link, gear or "Elsewhere" row in Settings | Its home already configures pointing devices |
| Fragments: presets and per-finger cluster selects | Settings "Hardware" / "Finger clusters" in all three | **New rail item "Clusters"** in the layouts group, beside Layouts (N4) | It changes the drawn layout and the keys on it. It was misfiled in Settings even before round 1 |
| Layer colors (all 16) | New Settings > Lighting (BS) | **Layer header color dot** only, as today | The color belongs to the layer, and the dot edits it in place |
| LED brightness | Lighting (BS) | **The layer color dialog**, as today | Same |
| Dim RGB When Idle, scan period, idle and deep-idle timing, clocks, pointer rest (the definition's `developer` section) | Developer > Pointer tuning (SP, BT); promoted to "Scanning and power" (BS) | **Scan Lab**, as a "Tuning" section | It tunes exactly what Scan Lab measures. It's developer-only and must not get a customer home in the editor |
| Live Updating / Manual Updates | toolbar, plus a Settings mirror (BT) | **Toolbar** only | It's a working mode of the editor, used while editing |
| Overlay / Keybard Host | Settings section (SP), About shortcut (BT) | **Rail** only. Host status appears inside the firmware update sheet, which pauses Host | It's a feature, not a preference |
| Key size, panel position | moved to Settings (SP, BS), mirrored in both places (BT) | **Settings > Appearance** only. The canvas corner control goes (N5) | App preferences, one home each |
| Settings search with "Elsewhere" results | SP | **Removed** | With configuration gone, Settings has about 25 rows, so anchors find them. Search that reaches into the editor belongs to an app-wide search, if Keybard ever gets one |

## 3. What Settings keeps

| Group | Item | Class | Reason |
|---|---|---|---|
| Firmware | Status per half: release, `USB` tag, detected pointing module (read-only) | b | What the board runs, and the facts that decide which file fits |
| Firmware | Install list: carried releases, `Choose a file…`, `Update one half…` | b | The one install path ([update-flow.md](update-flow.md) 3.3) |
| Firmware | Halves-differ state, manual install, the update sheet | b | Firmware management |
| Board | Name, Save | b | The board's identity (the USB product string), kept through every install |
| Board | Serial (read-only, copy) | b | Identity |
| Board | Restart keyboard | b | A device action |
| Backups and files | Backup folder; snapshots per board (Restore, Download, Delete); `Before <release>` snapshots; `Back up now` | b | Copies of the board's configuration. Restore writes to the board, so this is board management, even though snapshots are stored in the browser |
| Backups and files | Import layout, Export layout (with Print as an export format) | b | Files in and out of the board. The toolbar keeps its two icons as shortcuts to the same two dialogs (section 5) |
| Appearance | Theme, Key size, Panel position | a | How Keybard looks |
| Editing | Typing binds a key, Advance after assigning (Serial Assignment), Key legends (International Keyboards) | a | How the editor behaves while assigning |
| About | Keybard release (the real one, not "1.0.0"), Manual, Release notes, Svalboard community, `Bleeding edge: next.keybard.svalboard.com` (on production) or `Stable: keybard.svalboard.com` (on next) | a | App info. The site row is a plain link, since the site *is* the channel (update-flow 3.2) |
| Developer | Scan Lab, Key Proof Sheet | tools | Developer tools, collapsed by default (section 5) |

Not in Settings, and never was: the Layouts library import and Make Default Layer stay where
they are.

## 4. The three options, revised

All three now hold the same content (section 3). They differ in how it's arranged. Each
option's full item-by-item placement, with a one-line reason per item, is in its
`mapping.md`.

| | Single page (SP) | By scope (BS) | By task (BT) |
|---|---|---|---|
| Shape | One scrolling page, anchor chips, Firmware row first | Landing list in three groups, each row drilling into a page | Landing list of five jobs, each a page |
| Groups | This keyboard (Firmware, Board, Backups and files) · This browser (Appearance, Editing) · Keybard (About, Developer) | the same three groups, as landing sections | Keyboard (identity + firmware on one page) · Backups and files · Editor · About · Developer |
| Firmware | Status row that expands to the install list, with Update opening the sheet | Firmware page with a hero | Keyboard page: identity at the top, firmware below it |
| Clicks to any row | 0 (scroll) | 1 | 1 |
| Rows | about 25 | the same, over 7 pages | the same, over 5 pages |
| Mapping | [single-page/mapping.md](options/single-page/mapping.md) | [by-scope/mapping.md](options/by-scope/mapping.md) | [by-task/mapping.md](options/by-task/mapping.md) |
| Rationale | [single-page/rationale.md](options/single-page/rationale.md) | [by-scope/rationale.md](options/by-scope/rationale.md) | [by-task/rationale.md](options/by-task/rationale.md) |

**Recommended: single page.** Without the configuration, Settings is short, about 25 rows.
One page shows all of it with no navigation, and the firmware status is always the first
line. Its round-1 weakness (110 rows, needing search) is gone. BS and BT spend a click
to reach pages of three to six rows. BS's grouping argument, "this group resets on an
update", no longer applies: nothing left in Settings is reset by an install, and the update
sheet now carries that story itself (update-flow 4.1).

**Ideas worth grafting**

| Idea | From | Into | Why |
|---|---|---|---|
| Group titles "This keyboard / This browser / Keybard" | BS | SP, BT | Plain, and they say what each group acts on. Better than round 1's "Stored on the keyboard" |
| Print as a format inside the Export dialog | BS | SP, BT | One dialog for every file that leaves the board, and one fewer row |
| `Back up now`, and `Before <release>` snapshots pinned at the top of their board | BT | SP, BS | Pairs with the update's automatic backup, and makes the safety net visible |
| Identity and firmware together ("what is this board, what does it run") | BT | SP (Board directly under the Firmware row) | One glance answers "which board, which release" |
| A live value beside each landing row (release, theme, backup count) | BT | BS | Makes up for BS's extra click |
| Fixed control column (190 px, 150 px on a phone), one control per job | BS | all | Values line up. All three already share the control set |
| Developer collapsed by default, shown expanded only once someone has opened it in this browser | SP | all | Keeps tools out of customers' way without hiding them |
| App-wide search ("tapping term" → opens Typing behavior) | SP's round-1 search | later, outside Settings | The only right home for search across the editor |

## 5. Pointers, argued

The rule says Settings never points into the main editor. Three cross-links remain, and
each is argued here:

1. **Developer > Scan Lab.** Scan Lab is a developer tool, not a feature panel with a home
   in the editor. Settings > Developer is its only entry, as it is today. Its tuning
   section (section 2) lives inside the tool, so Settings still holds no configuration.
2. **Import and Export in two places.** They're board file operations (class b), so their
   home is Backups and files. The toolbar's two icons open the same two dialogs as quick
   shortcuts, since people use them mid-edit. This isn't the duplication the rule forbids:
   one dialog, one owner, two doors. Dropping the toolbar icons would cost frequent users a
   click. Dropping the Settings rows would leave file operations without a home beside
   Backups.
3. **Main editor → Firmware**, the reverse direction. The trackball mismatch dialog, the
   unsupported-firmware card, and "Make Default Layer (needs newer firmware)" each open
   Settings > Firmware. They point to management from configuration, which is allowed:
   firmware has exactly one home.

No other link connects Settings and the editor.

## 6. Effects on the main editor

Round 2 adds two rail items and one panel section. All of them must work in both sidebar
and bottom-bar modes, per the repo rule.

- **Typing behavior** (new rail item, features group): `QMKSettingsPanel`'s body, without
  Combo, Leader and Mouse keys. Tap-Hold is open by default; the others are accordions.
- **Clusters** (new rail item, layouts group): presets as a segmented control (Default,
  6-key, Fang), then per-finger selects grouped by hand. The canvas could later open the
  same picker when a cluster is right-clicked (N4).
- **Mouse Keys panel**: a "Movement" section with the nine mouse key values, below the
  movement keys.
- **Scan Lab**: a "Tuning" section rendering the definition's `developer` menu section.

## 7. Open questions for the owner (round 2)

Firmware questions N1 and N2 are in [update-flow.md](update-flow.md) section 10 and
[update-technical.md](update-technical.md) section 7.

| # | Question | Recommendation |
|---|---|---|
| N3 | Which Settings layout: single page, by scope, or by task (each revised, section 4)? | Single page, with the grafts above |
| N4 | Where do finger clusters (today's Fragments) live in the editor: a "Clusters" rail item beside Layouts, a picker that opens when you right-click a cluster on the canvas, or both? | A "Clusters" rail item now; add the right-click later |
| N5 | Key size and panel position: Settings > Appearance only, or keep only the canvas-corner control? Showing them in both places would break the one-home rule. | Appearance only. They default to Auto and rarely change |
