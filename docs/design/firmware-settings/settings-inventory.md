# Settings and firmware inventory (Keybard vLaunch2.4)

Baseline for the firmware-update and Settings redesign. Everything here describes
Keybard **as it is today** at `vLaunch2.4` (commit `6ed296f`, branch
`design/firmware-settings`). Nothing in `src/` was changed.

Screenshots live in [`ref/`](ref/), each in `-light.png` and `-dark.png`, taken at
1440x900 with the built-in **QWERTY Example** (no board). Connected-board states
were faked in the browser only: [`ref/shoot.cjs`](ref/shoot.cjs) intercepts the dev
server's `KeyboardContext.tsx` module, exposes its state setters, and turns off the
auto-load, so the real components render with a pretend `vLaunch` board, storage
flags and pointing-hardware reports. No HID traffic, no hardware.

| # | Screenshot | What it shows |
|---|---|---|
| 01 | [connect screen](ref/01-connect-screen-light.png) | Connect Keyboard, Load File, QWERTY Example |
| 02 | [unsupported firmware, connect screen](ref/02-unsupported-firmware-connect-light.png) | `UnsupportedFirmwareCard` (old Vial board) |
| 03 | [editor, offline](ref/03-editor-offline-light.png) | Nav rail expanded, toolbar, size/layout controls |
| 10 | [Settings > General](ref/10-settings-general-light.png) | |
| 11 | [Settings > Fragments](ref/11-settings-fragments-light.png) | |
| 12 | [Settings > Backups](ref/12-settings-backups-light.png) | |
| 13 | [Settings > Developer](ref/13-settings-developer-light.png) | |
| 14 | [QMK Settings](ref/14-qmk-settings-light.png) | Reached from Settings > General |
| 15 | [Print dialog](ref/15-print-dialog-light.png) | Reached from Settings > General |
| 20 | [About, offline](ref/20-about-offline-light.png) | |
| 21 | [Layouts](ref/21-layouts-light.png) | Layout library, its own Import |
| 22 | [Quick Start](ref/22-quick-start-light.png) | |
| 23 | [Overlay dialog](ref/23-overlay-dialog-light.png) | Keybard Host offer |
| 24 | [Export dialog (toolbar)](ref/24-export-dialog-light.png) | The reachable Export |
| 30 | [connected, firmware note + chip](ref/30-connected-firmware-note-light.png) | `FirmwareUpdateNote` and the 6 s firmware chip |
| 31 | [About, connected, outdated](ref/31-about-connected-outdated-light.png) | Release identification, "vLaunch2 is available" |
| 32 | [Settings > General, connected](ref/32-settings-general-connected-light.png) | Board name hidden (identity read fails without a board) |
| 33 | [unsupported firmware, editor](ref/33-unsupported-firmware-editor-light.png) | Card stacked against the update note |
| 40 | [storage reset dialog](ref/40-storage-reset-dialog-light.png) | `StorageResetDialog`, reset branch |
| 41 | [storage write-failed dialog](ref/41-storage-write-failed-dialog-light.png) | `StorageResetDialog`, write-failure branch |
| 42 | [wrong pointing-device firmware](ref/42-trackball-mismatch-dialog-light.png) | `TrackballMismatchDialog`, two problems |
| 43 | [pointing device not picked up](ref/43-pointing-not-picked-up-dialog-light.png) | `TrackballMismatchDialog`, auto build |

Not captured: Scan Lab (needs a board for most of it; its bootloader controls are
described below), Key Proof Sheet (a separate page), Board name with a real board
(source below), Backups with snapshots (source below), the import review dialog,
and bottom-bar layout mode.

---

## 1. Where things live

### Navigation rail (`src/layout/Sidebar.tsx`)

Five groups, top to bottom. Only the footer group matters here, but the whole rail is
listed because Settings content leaks into the other groups.

| Group | Items |
|---|---|
| Top | Standard Keys, Pointing Devices, then any dynamic menus from the keyboard definition (`keyboard.menus` minus the exclusions in `constants/custom-ui-exclusions.ts`) |
| Key pickers | Special Keys, Layer Keys, Mouse Keys, Tap Dance Keys, Macro Keys |
| Features | Alt-Repeat, Leaders, Combos, Overrides |
| Layouts | Layouts, Overlay (opens a dialog, not a panel) |
| Footer | Quick Start, Manual (opens `/manual/` in a new tab; absent in Paranoid), **About**, **Settings** |

### Panels a user would call "settings"

There are four places, and the owner's "three, if not four" is right:

1. **Settings** (footer), itself four tabs: General, Fragments, Backups, Developer.
2. **QMK Settings**, a separate panel (`qmksettings`) with no nav item: reachable only
   from a row in Settings > General. The panel title, then an inner heading that
   repeats "QMK Settings" ([14](ref/14-qmk-settings-light.png)).
3. **Pointing Devices** (top of the rail): key picker plus the board's pointing menu
   (DPI, scroll, automouse) rendered from the definition through
   `DynamicMenuPanel section="pointing"`.
4. **About**, which is where the only firmware status lives.

Plus settings that are not in any panel: the **Live Updating / Manual Updates**
switch in the editor toolbar, **Import Layout / Export Layout** in the toolbar, key
size (**NORMAL / MEDIUM / SMALL / AUTO**) and layout mode (**Sidebar / Bottom bar /
AUTO**) in the bottom-right corner, and the **Overlay** dialog.

---

## 2. Control-by-control inventory

Scope key: **Browser** = `localStorage` (`keyboard-settings`) on this browser only.
**Board** = written to the keyboard. **Board, queued** = goes through the change
queue, so it follows Live/Manual update mode. **Board, immediate** = bypasses the
queue (`runDeviceMaintenance`). **Navigation** = opens something else.
Frequency is my estimate for a typical owner.

### 2.1 Settings > General ([10](ref/10-settings-general-light.png), [32](ref/32-settings-general-connected-light.png))

Rendered generically from `SETTINGS` / `SETTINGS_CATEGORIES` in
`src/contexts/SettingsContext.tsx`, with `BoardIdentitySection` injected on top.

| Label (as shown) | Control | Changes | Scope | Frequency |
|---|---|---|---|---|
| Board name (connected, firmware with identity support only) | Text input + **Save now** button, char counter, then **Restart keyboard** button after a save; Serial shown read-only below | The USB product string the computer shows; confirms via `window.confirm` | Board, immediate; restart is a separate confirm | Once per board |
| Serial `<value>` | Read-only text ("Generated on this keyboard" when the flash has no ID) | nothing | read-only | never touched |
| Appearance | Native `<select>`: System / Light / Dark | Theme | Browser | Once |
| Typing Binds a Key | `OnOffToggle` (black ON/OFF pill), with description | Whether typing assigns to the selected key | Browser | Rare |
| Serial Assignment | Native `<select>`: None / Down columns then rows / Across rows then columns / Svalboard by key direction | Order of auto-advance when assigning keys | Browser | Rare |
| International Keyboards | Native `<select>`, 24 layouts | Legends in the key pickers | Browser | Once |
| QMK Settings... | Row with chevron | Opens the QMK Settings panel | Navigation | Occasional |
| Print Layers... | Row with chevron, description "Print all non-empty keyboard layers to PDF" | Opens the Print dialog ([15](ref/15-print-dialog-light.png)) | Navigation (file output) | Rare |

### 2.2 Settings > Fragments ([11](ref/11-settings-fragments-light.png))

`FragmentsPanel` embedded whole (its `fragments` panel title, "Hardware configuration",
is unused because there's no nav item for it).

| Label | Control | Changes | Scope | Frequency |
|---|---|---|---|---|
| Default / 6-key / Fang | Pill buttons (presets; explanation only in `title` tooltip) | All finger-cluster selections at once | Board, queued | Once per hardware change |
| Left: Pinky, Ring, Middle, Index, Thumb; Right: same | Radix `Select` per cluster ("5-key finger cluster (no 2S)", ...) | Which fragment draws that cluster | Board, queued | Once per hardware change |
| Pointing slot rows (left/right) | Read-only status box, "Locked" tag when detected | nothing (detected hardware) | read-only | never |

### 2.3 Settings > Backups ([12](ref/12-settings-backups-light.png))

`BackupsSection` (automatic `.svil` snapshots in IndexedDB, optional mirror folder).

| Label | Control | Changes | Scope | Frequency |
|---|---|---|---|---|
| Backup folder: **Choose backup folder** / folder name, **Resume backups**, **Change folder**, **Stop using folder** | Buttons (File System Access API) | Where snapshots are mirrored on disk | Browser + local disk | Once |
| Per-board group (board name, "Connected", board key) | Header | nothing | read-only | |
| Snapshot row: time, Connected/Edited, summary, "Unsent (n)" | Text | nothing | read-only | |
| **Restore** | Button | Opens the import review for that snapshot, then writes the board | Board (via import review) | Rare, but critical after a flash |
| Download (icon), Delete (icon) | Icon buttons, `title` only | Save `.svil` / delete snapshot (`window.confirm`) | Local disk / Browser | Rare |
| Show all (n) / Show fewer | Text link | List length | view | |

### 2.4 Settings > Developer ([13](ref/13-settings-developer-light.png))

| Label | Control | Changes | Scope | Frequency |
|---|---|---|---|---|
| Pointing developer controls (only when the board's pointing menu has a `developer` section) | `DynamicMenuPanel section="developer"` (definition-driven toggles/dropdowns/ranges) | Sensor tuning values | Board, queued | Developers only |
| Scan Lab... | Row with chevron, "Measure key scanning and test sensor timing." | Opens Scan Lab panel | Navigation | Developers only |
| Key Proof Sheet... | Row with chevron, "Visual inspection of key renderings at all sizes" | Navigates to the proof-sheet page | Navigation | Developers only |

**Scan Lab** (`ScanLabPanel.tsx`) contains, among timing and power tools, a
**Firmware** section: "Reboot a half into the RP2040 bootloader without touching it.
Two clicks: arm, then confirm." with per-half **Reboot Left/Right into bootloader**
then **Confirm: reboot ...** buttons. Supported only on builds with
`SVAL_HOST_BOOTLOADER` (`power[h].hostBootloader`). Its success message tells the user
to run `keyboards/svalboard/tools/flash.sh`. This is today's only "flash" affordance
in Keybard, and it is a developer tool.

### 2.5 QMK Settings ([14](ref/14-qmk-settings-light.png))

`QMKSettingsPanel.tsx`, fields from `constants/qmk-settings`, shown only if the board
reports the QSID.

| Label | Control | Changes | Scope | Frequency |
|---|---|---|---|---|
| Header "QMK Settings", "Configure firmware behavior. Changes follow your update mode." | text | | | |
| Sections: Magic, Grave Escape, Tap-Hold (open by default), Auto Shift, Combo, One Shot Keys, Mouse keys, Leader Key (open by default) | Accordion headers | view | | |
| Booleans (e.g. Permissive Hold (new), Hold On Other Key Press, Retro Tapping (new), Chordal Hold) | shadcn `Switch` (blue `kb-blue` when on) | QMK setting bit | Board, queued | Occasional, mostly once |
| Integers (e.g. Tapping Term, Quick Tap Term, Tap Code Delay, Tap Hold Caps Delay, Tapping Toggle, Flow Tap) with "Range: a - b" | Number `Input`, commit on Enter/blur | QMK setting value | Board, queued | Occasional |

A TODO in the source says the Combo and Leader Key sections are temporary duplicates of
the timing controls in the Combos and Leaders panels.

### 2.6 About ([20](ref/20-about-offline-light.png), [31](ref/31-about-connected-outdated-light.png))

| Label | Control | Notes |
|---|---|---|
| "Keybard version 1.0.0" | text | Hard-coded; not the real release (`vLaunch2.4`) |
| "Developed for the Svalboard community." | text | |
| Keyboard firmware: Release, Build (only if `sval_firmware`), Sval protocol, QMK keycodes | definition list | "Connect a keyboard to see its firmware." when offline |
| "vLaunch2 is available: get it from the latest Svalboard firmware release." | inline link | Only when `identifyFirmwareRelease().outdated` |
| "Newest Svalboard firmware this Keybard knows: vLaunch2. The firmware doesn't report its release over USB; Keybard identifies it from the features it reports." | small print | Explanatory text in the UI |

### 2.7 Controls outside any panel

| Label | Where | Control | Scope | Frequency |
|---|---|---|---|---|
| Live Updating / Manual Updates (aria "Switch to Live Updating" / "Switch to Manual Updates") | Editor toolbar, left ([30](ref/30-connected-firmware-note-light.png)) | Mode button; Manual shows Pending (n), Apply, Discard | Browser (`live-updating`) | Occasional |
| Import Layout | Editor toolbar icon | file picker, then import review | Board, via review | Occasional |
| Export Layout | Editor toolbar icon | "Export Keyboard Configuration" dialog: Format `.svil (Recommended)` / `.vil`, Include Macros switch ([24](ref/24-export-dialog-light.png)) | Local file | Occasional; required before any flash |
| Import (Layouts panel) | Layouts panel header ([21](ref/21-layouts-light.png)) | button: adds a `.svil` to the layout library | Browser | Occasional |
| NORMAL / MEDIUM / SMALL / AUTO | Bottom right | segmented buttons | Browser | Rare |
| Sidebar / Bottom bar / AUTO layout | Bottom right | icon segmented buttons | Browser | Rare |
| Overlay | Nav rail | Dialog "Desktop overlay": Connect, Download for Windows ([23](ref/23-overlay-dialog-light.png)) | Keybard Host (local app) | Once |
| Make Default Layer / "Make Default Layer (needs newer firmware)" | Layer context menu | menu item | Board | Rare |

### 2.8 Dead or orphaned settings code

Found in the source, not reachable in the UI:

- `SETTINGS` defines **Live Updating**, **Import...**, **Export...**, **Left DPI**,
  **Right DPI**, **Use right/left device for scrolling**, **Automatically switch to
  mouse layer...**, **Auto-mouse switch timeout (ms)**, **Fix pointer drift**. None is
  in any category. The DPI/scroll/automouse ones are `scope: "hardware"` and go to
  `HARDWARE_SETTINGS_REGISTRY`, whose handlers are stubs (`return 1000`,
  `console.log`). `SettingsProvider` still calls `refreshHardwareSettings()` on mount.
- `SettingsPanel` still owns a hidden file input, an **Export Configuration** dialog
  (different title and wording from the toolbar's **Export Keyboard Configuration**)
  and the `import-settings` / `export-settings` actions, none of which a row can
  trigger now.
- The repo `CLAUDE.md` test plan still describes Settings tabs "Pointing" and
  "Import / Export" that no longer exist.
- `components/KeyboardConnector.tsx` (which shows "Svalboard Firmware: ...") is not
  imported anywhere.

---

## 3. Every firmware mention

| Where | What | Trigger | Action offered |
|---|---|---|---|
| `constants/firmware.ts` | `SVALBOARD_FIRMWARE_URL = github.com/svalboard/qmk/releases/latest`; `LATEST_FIRMWARE_RELEASE = "vLaunch2"` (baked in, no network); `MIN_SVIL_PROTO = 3`; `identifyFirmwareRelease` (infers vRC0 / vRC1-2 / vLaunch / "vLaunch2 or later" / "newer than vLaunch2" from GET_INFO flags, because the firmware doesn't report its tag); `firmwareUpdateNotice`; `describeFirmware` | | |
| `EditingTargetStatus.tsx`: firmware chip | "Firmware: Svalboard QMK vLaunch" pill, top right, 6 s after each connect ([30](ref/30-connected-firmware-note-light.png)) | connect | none |
| `EditingTargetStatus.tsx` + `FirmwareUpdate.tsx` `FirmwareUpdateNote` | "Newer Svalboard firmware (vLaunch2) is available. It keeps your settings more reliably, and lets you choose the default layer here. Get it from the latest Svalboard firmware release." Three variants (`rc0`, `rc`, `launch`). Dismiss is remembered per variant in `localStorage` ([30](ref/30-connected-firmware-note-light.png)) | connected board identified as outdated | link to GitHub |
| `EditingTargetStatus.tsx`: unknown keycodes alert | "This keyboard numbers keycodes as QMK x; this Keybard knows up to y... Update Keybard before editing." | newer keycode numbering | none (Keybard, not firmware) |
| `FirmwareUpdate.tsx` `UnsupportedFirmwareCard` | Titles "Update your Svalboard's firmware", "Not a Svalboard firmware", "The keyboard didn't respond", "Keyboard firmware not recognized"; manual `FlashSteps`: save `.vil` in Vial, download `.uf2` per half and sensor, double-tap reset, copy to `RPI-RP2`, connect again ([02](ref/02-unsupported-firmware-connect-light.png), [33](ref/33-unsupported-firmware-editor-light.png)) | connect refused (`UnsupportedFirmwareError`: old Vial, protocol < 3, other QMK, no response) | link to GitHub + manual steps |
| `utils/unsupported-firmware.ts` | Error-message text for the same cases | connect | |
| `AboutPanel.tsx` | Release / Build / Sval protocol / QMK keycodes; "vLaunch2 is available..." ([31](ref/31-about-connected-outdated-light.png)) | user opens About | link to GitHub |
| `StorageResetDialog.tsx` | "Your keyboard's settings were reset ... Load your layout file to restore your setup." OK clears the flag with command `0x2A`. Second branch: "Your keyboard can't save changes" ([40](ref/40-storage-reset-dialog-light.png), [41](ref/41-storage-write-failed-dialog-light.png)) | GET_INFO storage flags | OK only; no Restore button, no link to Backups |
| `TrackballMismatchDialog.tsx` + `utils/pointing-hardware.ts` | "Wrong pointing-device firmware" / "Pointing device not picked up"; names the exact `.uf2` (`svalboard_trackball_pmw3389_right_sval_<release>.uf2`), manual flashing steps ([42](ref/42-trackball-mismatch-dialog-light.png), [43](ref/43-pointing-not-picked-up-dialog-light.png)) | `POINTING_HARDWARE` report | link to GitHub, file name |
| `BoardIdentitySection.tsx` | "Kept on the keyboard across firmware updates." | Settings > General | |
| `ScanLabPanel.tsx` / `scanlab.service.ts` | Reboot a half into the bootloader (two-step arm/confirm); tells the user to run `flash.sh` | Settings > Developer > Scan Lab | developer only |
| `KeyboardViewInstance.tsx` | "Make Default Layer (needs newer firmware)" | older firmware | none |
| `features/trainer/HostInstall.tsx` | `HOST_RELEASE` GitHub link for Keybard Host (not firmware, but the same "go to GitHub releases" pattern) | Overlay dialog | download |
| `docs/manual/content/start.html` | "vLaunch2 resets every board setting once. Export your layout before flashing...", restore via Settings > Backups | manual | |

What does **not** exist yet: any flashing in Keybard; any network lookup of releases
(the latest release is a compile-time constant); any handling of the D39 "new build
reset" flag (GET_INFO byte 18 bit 2); any warning for mixed releases across halves;
any re-select prompt for a changed USB product ID; any link from a reset dialog to
Backups.

---

## 4. Diagnosis

### 4.1 Settings mixes four scopes with no visible boundary

General alone holds a **board, immediate** write (Board name, with its own Save now
and Restart keyboard buttons), three **browser** preferences, and two **navigation**
rows ([10](ref/10-settings-general-light.png)). Fragments and the Developer pointing
controls are **board, queued**. Backups is **browser and local disk**, with a Restore
that writes the board. Nothing in the layout tells the user which rows touch the
keyboard, which is exactly the distinction a firmware-update flow will lean on
("this resets your board settings; your browser preferences stay").

### 4.2 Four control idioms for the same job

- Boolean: `OnOffToggle` (black ON/OFF pill) in General vs shadcn `Switch` (blue
  `kb-blue`) in QMK Settings ([14](ref/14-qmk-settings-light.png)) and the Export
  dialog ([24](ref/24-export-dialog-light.png)).
- Choice: native `<select>` with bold value text in General vs Radix `Select` boxes in
  Fragments ([11](ref/11-settings-fragments-light.png)) and the Export dialog. The
  General values don't even line up: "System" sits at the right, "None" and
  "English (US)" float mid-row.
- Number: slider + number box (defined, unused), number box with "Range: a - b" in
  QMK Settings, definition-driven ranges in Pointing.
- Action: chevron rows ("QMK Settings...", "Print Layers...") vs solid black pill
  buttons (Fragments presets, "Choose backup folder") vs outline buttons (Backups
  rows) vs icon-only buttons with tooltip text (Download, Delete).

### 4.3 Things in Settings that aren't settings

- **Print Layers...** is an output action.
- **Backups** is a data-management tool (history, restore, folder).
- **Fragments** describes the physical hardware: it's board configuration, closer to
  Pointing Devices than to Appearance.
- **Developer** holds tools (Scan Lab, Key Proof Sheet), not preferences.
- **QMK Settings** *is* settings, but sits one click deeper than Appearance, as a
  sibling panel that replaces Settings (and the nav highlight leaves Settings).

### 4.4 Duplicated or split entry points

- Export: toolbar **Export Layout** dialog ("Export Keyboard Configuration") vs the
  dead Settings **Export Configuration** dialog; manual text and the storage-reset
  dialog say "Load your layout file" without saying where.
- Import: toolbar **Import Layout**, Layouts panel **Import** (different meaning: adds
  to the library), Backups **Restore** (same import review), connect-screen Load File.
- Update mode: toolbar switch only, but `live-updating` is still a Settings
  definition, and BoardIdentity's confirm text talks about "Manual Updates mode".
- QMK timing: Combo and Leader Key sections duplicated in QMK Settings and in the
  Combos/Leaders panels (acknowledged TODO).
- Pointing: hardware settings in Pointing Devices; developer pointing settings in
  Settings > Developer; module detection in Fragments; module mismatch in a modal.
- Firmware status: a 6-second chip, a dismissible note, About, a modal, and a card,
  each with its own wording and each pointing at the same GitHub page
  ([30](ref/30-connected-firmware-note-light.png), [31](ref/31-about-connected-outdated-light.png),
  [33](ref/33-unsupported-firmware-editor-light.png)).

### 4.5 Firmware has no home

The only persistent firmware view is About, which also carries a fake app version
("Keybard version 1.0.0") and explanatory prose about how detection works. Updating
is always "go to GitHub, pick the right `.uf2` for each half and sensor, double-tap
reset, drag to `RPI-RP2`", repeated in three components. The notes overlay the layer
tabs ([30](ref/30-connected-firmware-note-light.png)), and with an unsupported-firmware
card they cover much of the top of the editor ([33](ref/33-unsupported-firmware-editor-light.png)).
After a reset, the dialog offers only OK ([40](ref/40-storage-reset-dialog-light.png)),
though Backups already holds the exact snapshot needed.

### 4.6 Explanatory text in the UI

Against the "titles carry meaning" rule: About's detection note, Board name's
three-sentence description, the QMK Settings sub-header, the Layouts paragraph, the
Overlay dialog sentence, preset meanings hidden in tooltips, and the long
`FlashSteps` lists inside cards and modals.

### 4.7 Smaller inconsistencies

- Category tabs are large icon tiles; nothing else in Keybard uses that pattern.
- QMK Settings' header repeats the panel title.
- Fragments' panel title ("Hardware configuration") differs from its tab label.
- Settings rows use `panel-layer-item` (the layer-list row style), not a settings
  row component.
- Some status colors are hard-coded Tailwind (`text-amber-600`, `text-red-700`,
  `border-amber-300`) rather than tokens.

---

## 5. Visual language (for the redesign)

`keybard-wt-pointing-design/docs/design/pointing/visual-language.md` does not exist
(that folder has only `behavior-spec.md`), so this is a summary from `src/index.css`
and `src/components/ui`.

**Themed tokens** (`:root` light / `.dark`), the ones to use for chrome:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--kb-gray` | `#f1f2f2` | `#141517` | Page background |
| `--kb-surface` | `#ffffff` | `#1d1e21` | Panels, cards, dialogs |
| `--kb-gray-medium` | `#eaeae9` | `#26282b` | Hover, inactive tiles |
| `--kb-gray-border` | `#a7a9ac` | `#75797f` | Card and chip borders |
| `--kb-ink` | `#000000` | `#f1f2f2` | Text |
| `--kb-active` / `--kb-active-fg` | `#000` / `#fff` | `#e8e9ea` / `#111214` | Selected tab, primary pill, active nav |
| `--kb-popover` | `#EEEEEE` | `#33363b` | Popovers |

**Fixed brand colors** (literal, never change): `kb-primary` / `kb-green` `#099e7c`
(links, default keys), `kb-blue` `#379cd7` (Switch on), `kb-purple` `#8672b5`,
`kb-orange` `#f89804` ("Unsent"), `kb-yellow` `#ffc222`, `kb-red` `#d8304a`
(error titles), `kb-grey` `#85929b`, `kb-brown`, `kb-magenta`.

**Components and patterns**: Inter type; shadcn/Radix `Button` (default black pill,
`outline`, `secondary`, `ghost`, `icon`), `Dialog` (white card, title + description +
right-aligned footer, OK as the only action), `Select`, `Switch`, `Input`, `Slider`,
`Tooltip`, `Sheet`; the in-house `OnOffToggle`; panels are rounded `kb-surface` cards
beside a rounded nav rail with a sliding 3 px `kb-active` indicator; rows use
`panel-layer-item`; secondary text is `text-muted-foreground` at `text-xs`; notices are
`kb-surface` cards with a `kb-gray-border` border and a dismiss X. Dark mode is a
`dark` class on `<html>`, and `tests/theme/no-hardcoded-chrome-colors.test.ts` rejects
hard-coded white/black/gray chrome.
