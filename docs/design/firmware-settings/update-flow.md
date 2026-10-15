# Installing firmware from Keybard: the end-to-end flow

Status: design proposal, nothing built. Round 2, 2026-10-14, on branch
`design/firmware-settings` (Keybard at vLaunch2.4). Builds on
[update-technical.md](update-technical.md) (the "tech doc": risks K1-K26, decisions
Q1-Q17, and the firmware LED reference in 1.10) and
[settings-structure.md](settings-structure.md) (where Firmware sits in Settings).

Mockups: [flow/index.html](flow/index.html) (previews: [light](flow/preview-light.png),
[dark](flow/preview-dark.png)). Screen IDs below (D1, B1, U2, ...) match the mockup labels.

## 0. What changed in round 2

The owner's review settled most of round 1's questions (tech doc section 7). The flow
changed in six ways:

1. **One confirm, then hands off.** The user makes every choice on one sheet (B1),
   including what happens to their layout afterwards. After **Start update**, Keybard
   asks nothing more. The only thing left for the user is one chord on the keyboard.
   Round 1's restore prompt after the install (A1) is gone.
2. **One chord approves both halves** (owner decision). A full update asks for the chord
   exactly once, at the start, on the half with USB. After that it runs to the end with no
   human step. This needs firmware addition F-N3 (tech doc 1.4), which the Keybard flow
   requires.
3. **Every install is backup, install, put back.** An update, a reinstall of the same
   release, a downgrade, a file the user picked, and a one-half update all take the same
   path. There is no "keeps settings" install in the flow, and no "reinstall keeps,
   downgrade resets" distinction.
4. **One way to choose what to install.** The Firmware page lists the releases this
   Keybard carries and a **Choose a file…** entry. Round 1's separate "Install from
   file", "Reinstall" and channel toggle are folded into that one list (Q2 + Q11).
5. **Developer builds may skip the approval chord.** Release builds can't. Keybard
   reads this from the board and leaves the approval steps out (Q10, tech doc 1.4).
6. **The keyboard-light guidance is rebuilt from the firmware.** Section 5.3 shows,
   per half and per step, exactly what each half's light does (tech doc 1.10),
   including the rainbow and both meanings of magenta.

---

## 1. Principles

1. **One home.** Firmware lives at **Settings > Firmware**. The old firmware mentions (the
   6 s chip, the dismissible note, About, the connect card, the reset and mismatch
   dialogs) all lead there instead of to GitHub.
2. **Quiet discovery.** An available update is a dot (U-Q1). The only firmware message
   that interrupts is a real fault: halves on different firmware (a banner, U-Q6), or
   settings reset outside an update.
3. **Gentle.** Hardware mismatches are warnings, and the primary button turns into
   **Update anyway**. The only refusal is an integrity failure, where a carried file's
   hash doesn't match.
4. **Your layout always comes back.** Keybard backs up before anything is sent (to
   Backups and as a downloaded file) and puts the layout back after, whatever was
   installed. The user picks "put it back" or "start from defaults" before starting.
5. **Decide once, then let it run.** One sheet holds every decision. After Start, the
   only interaction is holding the chord once, at the start, when the dialog says so.
   Failures stop the flow and say what to do. They are the only screens with buttons.
6. **Every stop names its outcome.** There are three: *Nothing was changed*, *Halves
   differ* (finish the update), *{half} needs a manual install*.
7. **Titles carry the meaning.** Body text is a line at most. The light guidance
   explains a color only where a user would otherwise misread it (5.3).

Copy conventions: "the split cable"; "left half" and "right half" come from each half's
INFO hand. The examples assume USB is on the **right** half. `{usb}` and `{other}` are the
resolved half names. `{chord}` is the two chord keys' layer-0 legends (default `M` + `,`
on the right, `V` + `C` on the left). Release names are tags (`vLaunch4`, `vNext2`).

---

## 2. Flow map

```
connect
  |-- updater with one-chord approval ---- D1 dot -> D2 Firmware page
  |-- vLaunch2 / Vial / vNext1 ----------- D1 dot -> D2b -> M (manual install)
  |-- halves differ / reset flag --------- banner (F9) / A4

D2: pick a release (or Choose a file...) -> Update
  |
B1  the sheet: checks, backup, warnings, "Afterwards: put my layout back / start
    from defaults", what to do on the keyboard          [the one confirm]
  |
  Start update  ----------------------------------------- hands off from here
  |
U1  approve both halves: one chord on {usb} (skipped on a developer build)
U2  send -> copy over the split cable -> {other} installs and restarts
U3  send -> {usb} installs (already approved in U1: nothing to do)
U4  {usb} restarts -> Keybard reconnects
U5  put the layout back (or apply defaults), as chosen on B1
  |
A1  result: Updated to vLaunch4 (or a failure screen, section 8)
```

---

## 3. Discovering an update and choosing what to install

### 3.1 The signal (D1)

A `kb-primary` dot on the Settings rail item and on the Firmware row inside Settings (U-Q1,
option A). It clears when the user opens Firmware for that release, remembered per release
in `localStorage`. With nothing newer there's no dot, and the page reads **Up to date**.

### 3.2 What each site carries (Q5, decided)

Each Keybard site carries its own firmware files inside its deploy (Q1). So the list of
releases a site offers is fixed when that site is published, and there is no channel
toggle:

- **keybard.svalboard.com** carries the vLaunch release promoted with it and the one
  before it, so a user can go back one release.
- **next.keybard.svalboard.com** carries the newest vNext and the same vLaunch releases
  as production.

Example: on keybard.svalboard.com the list reads `vLaunch4` (newest) and `vLaunch3`. On
next.keybard.svalboard.com it reads `vNext2` (newest), `vLaunch4`, `vLaunch3`. To try
vNext2, a user opens next.keybard. To go back, they pick `vLaunch4` from the same list.

Only releases whose firmware supports the one-chord update (F-N2, F-N3) are listed, since
an install through Keybard ends on that firmware. vLaunch2, Vial and vNext1 never appear
in the list. Going back to one of them is a manual install from its GitHub release.

### 3.3 The Firmware page (D2)

| Element | Copy |
|---|---|
| Title | `Firmware` |
| "This keyboard" | `Left half` `vLaunch3` · `Trackball` and `Right half` `vLaunch3` · `No pointing module`, with a `USB` tag on the USB half. The detected module is read-only status: it decides which file fits, and it's configured nowhere in Settings. |
| "Install" list | Rows, one per carried release, newest first: `vLaunch4` `Newest` · `What's new` (a link to the GitHub release). Older rows: `vLaunch3` `Older`. The row matching the board reads `Installed`. Last row: `Choose a file…` |
| Highlights | Up to three one-line bullets for the selected release, from Keybard's pinned release data (U-Q3) |
| Primary button | `Update to vLaunch4`. It follows the selected row: `Reinstall vLaunch4`, `Install vLaunch3`, `Install file`. All of them open the same sheet. |
| Advanced (collapsed) | `Update one half…` (Q9) |

Selecting a row only changes the button. Every choice goes through B1, so the user always
sees the same checks, backup and "Afterwards" choice.

**Choose a file…** accepts one or two `.svup` files (Paranoid: also the only way in, Q12).
Keybard reads each file's manifest and assigns it to the half whose hand the manifest
names: two files cover both halves, and one file covers its half only. A file whose SHA-256 matches a carried file is treated
as that release, with no warning. Any other file installs with the `Unknown firmware
file` warning (B1).

**Other states of the page**

| State | This keyboard | Install list | Button |
|---|---|---|---|
| D2a Up to date | both halves `vLaunch4` | `vLaunch4` `Installed` selected | `Reinstall vLaunch4` (enabled; same path as an update) |
| D2b No usable updater (vLaunch2, Vial; also vNext1, whose updater predates the one-chord approval) | one row `vLaunch2` (these builds don't report per half; vNext1 does) | `vLaunch4` `Newest` · `One manual install, then updates come from Keybard` | `Install vLaunch4` (opens M) |
| D2c Halves differ | the stale half in `kb-orange`, heading `Halves differ` | the release both should run, preselected | `Finish update` |
| D2d Board newer than this Keybard | `vLaunch5` · `Newer than this Keybard` | list as usual (picking one is a downgrade) | `Reload` to look for a newer Keybard |
| D2e No keyboard | `Connect a keyboard to see its firmware.` | the list, with `What's new` | `Connect` |

---

## 4. Before: the sheet (the one confirm)

### 4.1 B1

The sheet opens from any Firmware button. Keybard runs every check from tech doc 2.1 while
it opens (1-3 s; rows fill in as they pass) and takes the backup. **Start update** is
enabled once both are done.

| Group | Content |
|---|---|
| Title | `Update to vLaunch4` (or `Reinstall vLaunch4`, `Install vLaunch3`, `Install custom firmware`) |
| Sub-line | `Left and right halves · About 2 minutes` |
| Checks | `Both halves connected` ✓ · `Firmware files verified` ✓ · `Keybard Host paused` ✓ (only when Host is connected) · `Scan Lab closed` ✓ (only when it was open) |
| Backup | `Layout saved` ✓ · `Kip-vLaunch3-2026-10-14.svil` · `Downloads` · link `Backups` |
| Afterwards | Two choices, the first selected: **`Put my layout back`** · `Start from the vLaunch4 defaults` |
| On the keyboard | The `{usb}` half drawn with the two chord keys lit. `Hold M + , once, when the light blinks blue` · `One hold approves both halves`. `Keep USB and the split cable connected.` |
| Footer | `Cancel` · **`Start update`** |

Notes:

- **Backup** (tech doc 4.2): a `Before vLaunch4` snapshot in Backups (and the backup folder,
  if set), plus a downloaded file named `<board name>-<installed release>-<date>.svil`.
  Keybard parses it back before enabling Start. The download is the copy that survives a
  different site or cleared storage, which is why the sheet names it.
- **Afterwards** is the only layout decision, and it's made here. **Put my layout back**
  writes the backup after the install, every time, whether or not the firmware reset the
  settings (tech doc 4.3). **Start from defaults** leaves the new firmware's defaults. On an
  identical-build reinstall, where the firmware would keep settings (D39), Keybard sends a
  settings reset so the result matches the choice. That reset is firmware addition F-N2,
  which the Keybard flow requires, so the choice is always honored (tech doc 4.3).
- **The chord diagram** shows the keys by position (Index South + Middle South on `{usb}`),
  labeled with their current layer-0 legends. It's the same line on every update: one hold,
  whether one half or both are installed.
- **Developer build without the chord** (tech doc 1.4): the "On the keyboard" group reads
  `Nothing to press: this developer build installs without approval`, in `kb-orange`.
- **Linux**: an extra check row, `Device access`, with `Copy command` when the udev rule
  isn't confirmed (K13). It's a warning.
- **New USB product ID** (rare from vNext on, since every build uses 0x4044/0x4045; tech
  doc 2.6): the sheet adds `At the end, choose Svalboard in the browser's list once`. The
  browser requires that click; Keybard can't skip it. It's the one possible click after
  Start, and the sheet says so up front.

### 4.2 Warnings on the same sheet

A warning is a `kb-orange` row in Checks with a one-line consequence. With any warning
present, the button reads **Update anyway**. Nothing opens a second dialog.

| Trigger | Row | Detail |
|---|---|---|
| Image hand ≠ the half's hand (K5, D33) | `File is for the left hand` | `On the right half, the halves stop working together.` |
| Pointing ID ≠ the half's module (D33; custom builds) | `No trackball driver in this file` | `Pointing stops on the right half.` |
| Older than the board | `vLaunch3 is older than vLaunch4` | `Settings added since vLaunch3 won't come back.` |
| File not carried by this Keybard (Q11) | `Unknown firmware file` | `Keybard can't check where it came from.` |
| File's Sval protocol newer than this Keybard (K18) | `Keybard may not configure this firmware` | `You can still install it.` |
| File is a no-chord developer build (tech doc 1.4) | `Developer build` | `Later installs on this keyboard won't ask for approval.` |
| Linux access rule unknown (K13) | `Device access` | `Copy command` |
| Backup failed (Q8, K16) | `Layout not saved` | `Afterwards` switches to `Start from defaults`, and `Put my layout back` is disabled with `No backup`. A link `Save layout manually` opens Export. |
| Other half not answering | `Left half not answering` | `Check the split cable.` The button becomes `Update right half only` (Q9). |
| Board latched in an earlier session's error | no row: Keybard sends ABORT and continues | |

**Refusal (integrity, the only one):** a carried file whose SHA-256 doesn't match its pin
(K2, K23). The row is red and Start is gone: `Firmware file failed its check` · `Keybard
won't install it. Reload Keybard and try again.` · `Reload` · `Close`.

---

## 5. During: hands off

### 5.1 The progress dialog

The sheet turns into the progress view. Clicking outside doesn't close it, and
`beforeunload` warns for the whole update. **Cancel** stays available until the first
install starts. After that the dialog has no buttons until the result.

Two rows, `{other}` first. Each row has the half name, a `USB` tag on the USB half, a
stage label, a bar, and a small **light swatch** that animates the way that half's light
is behaving right now (5.3). Users can match the screen to the keyboard without reading
anything.

| Stage | Label | Bar |
|---|---|---|
| waiting its turn | `Waiting` | empty |
| approval (U1 only, both rows at once) | `Approve` | 30 s countdown |
| erase | `Preparing` | sectors erased / to erase |
| send over USB | `Sending 42%` | staged / length |
| verify | `Checking` | indeterminate |
| copy over the split cable | `Copying to left half 63%` | acked / length |
| install | `Installing` | time-based fill, `kb-magenta` |
| restart | `Restarting` | indeterminate |
| put the layout back | `Putting your layout back` (on the `{usb}` row) | items written / total |
| done | `vLaunch4` ✓ | full |

The dialog's title follows the step that matters: `Hold M + , on the right half` during the
approval, `Installing · don't unplug` during an install, `Updating keyboard` otherwise.
Footer lines, one at a time: during the copy, `Don't type on the left half` (the split link
pauses, tech doc 2.5). Otherwise, `About 1 min left`.

### 5.2 The approval (U1), once for both halves

Right after Start, Keybard arms the update and the `{usb}` half's light blinks blue twice a
second. That's the only time the user has to act. The title becomes `Hold M + , on the right
half`, the diagram from B1 reappears with the keys lit, and the 30 s countdown runs. One
hold approves both halves' files (F-N3, tech doc 1.4). The `{usb}` half later installs its
own file with no second approval, so blue never blinks again in that update (U3).

- Both keys must be seen up once after the light starts blinking, and any bounce
  restarts the 1 s hold. The countdown line under the diagram reads `Let go, then hold
  both for 1 second` only if the keys were already down when the blinking began.
- When the chord registers, the light flashes white twice (300 ms) and goes straight into
  the rainbow: Keybard continues at once, and the flash plays out over the start of the
  next step. Solid blue appears only if Keybard is slow to continue. The screen moves on by
  itself. The keys stay hidden from typing until they're released.
- On a developer build without the chord, this step doesn't appear. The rows go straight
  from `Waiting` to `Preparing`.
- A one-half update (Advanced, or `Finish update`) has the same single approval.

### 5.3 What the lights show

Grounded in the firmware at `42c3de6036` (tech doc 1.10). While the updater owns a half's
light, it shows the updater color at about 38% brightness. It does this even if the user
turned lighting off or the board was idle, and returns to the layer color afterwards.

**Both halves updated (the default), USB on the right**

| Step | Right half (USB) | Left half | Shown to the user |
|---|---|---|---|
| Checks and backup (B1) | Layer color | Layer color | nothing |
| U1 Approve, once for both halves | **Blue, blinking** | Layer color | the approval title and diagram (5.2) |
| Chord registered | White double flash (0.3 s), then straight into the rainbow | Layer color | nothing; the screen moves on |
| Sending the left half's firmware | **Rainbow**, one slow continuous cycle | Layer color | progress |
| Copying over the split cable | Rainbow, continuing | **Rainbow** from the first copied piece | `Don't type on the left half` |
| Left half installs | **Magenta, steady** (it waits for the left half) | **Magenta, steady** | title `Installing · don't unplug` |
| Left half restarts | Magenta for up to about 15 s, then **red, blinking slowly** for a few seconds, until Keybard starts the right half | Restarts into vLaunch4, then a layer color: probably its own default green, since its settings reset and it may not sync with the old right half (not verified on hardware) | on the right row while red is lit: `Red until this half updates` |
| U3 Sending the right half's firmware | Red, then **rainbow**. No blue: U1 already approved this file (F-N3) | Layer color, as above (not verified on hardware) | progress |
| Right half installs | Magenta, steady | Layer color, as above (not verified on hardware) | title `Installing · don't unplug` |
| Restart and reconnect | Off for a moment, then the default layer color | Default layer color | `Restarting` |
| Putting the layout back | Layer colors change back to the user's as they're written | same | `Putting your layout back` |
| A1 Done | The user's layer color | same | result |

**One half only**

| Update | Right half (USB) | Left half |
|---|---|---|
| Right half only | Blue blink (the one approval), white flash, rainbow, magenta, restart | Normal color throughout (not verified on hardware) |
| Left half only | Blue blink (the one approval), white flash, rainbow through sending and copying, magenta while the left installs, then a short red blink until the halves match | Rainbow while receiving the copy, magenta while installing, then restarts |

After a left-half-only update that brings the halves together (the usual "Finish update"
case), the red lasts about half a second. If the halves still differ, it stays red until
the right half is updated. The banner and D2c then say `Halves differ`.

**Where explanation is needed, and why**

- **Blue blinking** is the only "act now" signal, and it appears once per update, right
  after Start. The dialog says what to do at that moment, so the color needs no legend.
- **The rainbow** covers checking, preparing, sending and copying. It's one continuous
  cycle, so it looks like a single "busy" state. The progress bar already says "busy",
  so it gets no words.
- **Magenta** means "installing, don't unplug". During the left half's install, *both*
  halves are magenta, although only the left is writing. The title `Installing · don't
  unplug` covers both halves, so the dialog doesn't explain which half is writing. Magenta
  is also the default color of layer 15 (auto mouse), so the light alone isn't proof of an
  install. Only the dialog is.
- **Red, blinking slowly** between the two halves is expected: the halves differ until
  the right half is updated, which starts on its own a few seconds later. It's the one color that reads as failure when it isn't, so it
  keeps its line (U-Q4). Red is also the default color of layers 6 and 7. The slow blink is
  the difference, and the dialog is the authority.
- **Default colors after the install.** Each new install starts from the firmware's
  default lighting, layer 0 green at default brightness, until the layout is put back. The
  `Putting your layout back` step covers it. If the user chose defaults, the defaults are
  what they keep.

**Lights on a failure** (shown only on failure screens, section 8):

- An error before any install: the right half (and the left, if its copy failed) blinks red
  once a second. Keybard sends ABORT at once, so the blinking stops and the old firmware
  keeps running. Failure screens don't describe it, because it's gone by the time they
  show.
- A half that stays **magenta with no light change** and shows a drive named `RPI-RP2` failed
  its install. It needs a manual install (F10, F11), and that screen says so: `Its light
  stays magenta and a drive named RPI-RP2 appeared.` (The frozen magenta is inferred and
  needs checking on hardware.)

### 5.4 Restart and reconnect (U4)

After the `{usb}` half installs, the device disconnects. The dialog stays, built from the
flow state in `sessionStorage`.

| Phase | Label on the `{usb}` row |
|---|---|
| waiting for the device (up to 30 s; Windows may add a new device, K26) | `Restarting` |
| device back, same product ID | `Reconnecting` (opens it with no chooser) |
| both halves answer (presence MATCH within 10 s) | `Checking both halves` |

With a new product ID (warned on B1), the dialog shows `Choose Svalboard in the browser's
list` and one `Choose keyboard` button (`requestDevice` filtered to the predicted ID).
On Linux, an open failure here becomes F12.

### 5.5 Putting the layout back (U5)

As chosen on B1, with no prompt:

- **Put my layout back:** the import preflight, then `syncWithKeyboard`, with no review
  dialog. Anything the preflight trims is listed on A1.
- **Start from defaults:** nothing is written, except the settings reset on an
  identical-build reinstall (4.1).
- `0x2A` (clear the reset flag) is sent last, after the restore succeeds or the defaults
  are confirmed (tech doc 4.3).
- If GET_INFO bit 1 (settings can't be saved) is set, Keybard skips the write and shows F17.

---

## 6. After

### 6.1 A1, the result

| Element | Copy |
|---|---|
| Title | `Updated to vLaunch4` (or `Reinstalled vLaunch4`, `Installed vLaunch3`) |
| Rows | `Left half vLaunch4` ✓ · `Right half vLaunch4` ✓ |
| Layout | `Layout put back` ✓ · backup file name. Trimmed items in `kb-orange` with counts, e.g. `Combos: 6 of 8 (this firmware has 6)`. With defaults chosen: `Started from defaults` · backup file name |
| Link | `What's new in vLaunch4` |
| Button | `Done` |

Both versions come from INFO page 1 on each half. If they differ, A1 is replaced by F9. The
`Before vLaunch4` snapshot stays in Backups until the user deletes it.

### 6.2 A4, settings reset outside an update

A board that connects with bit 2 set while no update is in flight (a `.uf2` installed by
hand, or a tab closed mid-update) has had no up-front choice. So this is the one place a
restore is asked afterwards. It replaces today's `StorageResetDialog` "OK only":

| Title | `New firmware reset your settings` |
|---|---|
| Body | the newest backup for this board: `Kip · vLaunch3 · Today 10:42` |
| Buttons | `Start from defaults` · `Other backups` · **`Put my layout back`** |

Bit 0 (storage unreadable) keeps its own dialog, and gains the same button.

---

## 7. Manual install (M): the first move off vLaunch2, and every recovery

Boards on vLaunch2 or Vial have no updater (tech doc finding 1). D2b opens a guided manual
install. The same screens, filtered to one half, recover a half stuck in BOOTSEL (K8, K9).
It follows the same rule as everything else: backup first, the "Afterwards" choice up front,
put back at the end.

| Step | Title | Content | Done when |
|---|---|---|---|
| M1 | `Install vLaunch4 by hand` | sub-line `Once per keyboard. Later updates come from Keybard.` · the Afterwards choice | |
| 1 | `Layout saved` | file name · `Downloads` | automatic |
| 2 | `Download firmware` | `Left half .uf2` · `Right half .uf2` (Keybard's own copies, hash-checked) | both clicked |
| 3 | `Install on the left half` | `Plug USB into the left half` · `Double-tap its reset button` · `Copy the left file onto the RPI-RP2 drive` | `Next` (the browser can't see the drive) |
| 4 | `Install on the right half` | the same three lines | `Next` |
| 5 | `Connect your keyboard` | `Plug USB back into your usual half` · `Connect` | connects; then U5 and A1 |

The half the user doesn't usually plug in goes first (U-Q5), so the cable ends in its usual
place. The manual path has more than one confirm because the browser can't see the drive.
That's unavoidable here. If the Q16 prototype (writing the `.uf2` with File System Access)
works, steps 3-4 gain `Copy for me`.

---

## 8. Failure paths

Each row says what happened to the keyboard. Its button is the exact next step.

| ID | Risk | When | Title | Body | Buttons |
|---|---|---|---|---|---|
| F1 | K19 | no updater (vLaunch2, Vial) | (D2b) | `One manual install, then updates come from Keybard` | `Install vLaunch4` → M |
| F2 | K2, K23 | carried file's hash mismatch | `Firmware file failed its check` | `Keybard won't install it. Reload Keybard and try again.` | `Reload` · `Close` |
| F3 | K15 | OTHER_CLIENT / BUSY | `Another app is using the keyboard` | `Close other Keybard tabs and the overlay, then try again.` | `Try again` |
| F4 | K21 | chord not made in 30 s | `Not approved in time` | `Nothing was changed.` | `Try again` · `Close` |
| F5 | K7, K12 | unplug, cable, timeout, verify or CRC failure before any install | `Update stopped` | `Nothing was changed. Your keyboard still runs vLaunch3.` | `Try again` · `Close` |
| F6 | K10 | tab closed mid-update; on reopen | `Update didn't finish` | `Nothing was changed.`, or the F9 text | `Try again` / `Finish update` |
| F7 | K11 | tab hidden or computer about to sleep | toast `Keep this tab open until the update finishes` | | none |
| F9 | K6 | halves on different releases (a stop between halves, including U1's approval lapsing before the `{usb}` half starts, or seen on any connect, Q17) | `Halves differ` | `Left half vLaunch4 · Right half vLaunch3` | `Finish update` (or `Install by hand` without an updater) |
| F10 | K8 | power lost while `{usb}` installs; it's now `RPI-RP2` | `Right half needs a manual install` | `Its light stays magenta and a drive named RPI-RP2 appeared.` | `Download right half .uf2` · then M 4-5 |
| F11 | K9 | power lost or split cable pulled while `{other}` installs | `Left half needs a manual install` | `Plug USB into the left half. It shows up as the RPI-RP2 drive.` | `Download left half .uf2` · then M 3, 5 |
| F12 | K13 | Linux refuses the device after restart | `Linux blocked the keyboard` | `Run this command, then reconnect.` | `Copy command` · `Reconnect` |
| F14 | K26 | no device after 30 s | `Keyboard didn't come back` | `If a drive named RPI-RP2 appeared, the right half needs a manual install.` | `Keep waiting` · `Install by hand` |
| F16 | K16 | putting the layout back failed or partly failed | `Layout not fully put back` | `Your backup is safe in Backups and Downloads.` | `Try again` · `Open Backups` · `Keep defaults` |
| F17 | K20 | settings writes failing (bit 1; ARM is refused) | `Your keyboard can't save settings` | `Updates from Keybard are off until this is fixed.` | `Install by hand` · `Close` |
| F18 | K20 | not a 16 MiB flash (UNAVAILABLE) | `This keyboard installs firmware by hand` | | `Install by hand` |
| F19 | K18, K25 | running firmware's Sval protocol newer than this Keybard | `This Keybard can't configure vLaunch4` | `Reload Keybard to get a newer one.` | `Reload` |
| F21 | K24 | post-COMMIT probe "unconfirmed" | no UI; decide from INFO and presence after the restart | | |
| F22 | K1, K3 | compromised release or origin | no UI; pinning and the chord | | |
| F23 | K4 | another page asks for the chord | no UI; release notes say `Only approve updates you started` | | |
| F25 | K22 | GitHub down or offline | no UI (files are carried); `What's new` is the only GitHub link | | |

Round 1's F8, F13, F15, F20, F24 and F26 are now rows on the B1 sheet or steps in the
dialog (4.2, 5.4, 6.2), so they're not separate screens.

---

## 9. What this needs beyond the tech doc

- **A flow state machine outside the connection**, in `sessionStorage`: the chosen files and
  their hashes, the Afterwards choice, which halves are done, the backup id, and whether
  `0x2A` was sent. Every screen is a pure function of that state plus INFO and STATUS.
- **Carried release data** (`firmware-releases.ts`): tag, fw_version, site, hand, PID,
  SHA-256 per file, and three highlights (U-Q3), written by the PR that pins a release (Q3).
- **Light swatches** in the progress rows: derived from flow state using the firmware
  table (tech doc 1.10), never read from the board.
- **Backups**: a `Before <release>` kind, and "newest backup for this board" for A4.
- **Firmware additions** (tech doc section 7): the developer no-chord build flag (F-N1); a
  host "reset settings" op for "start from defaults" on an identical build (F-N2, required);
  and one chord approving both halves (F-N3, required). Keybard offers its install flow
  only to a board whose running firmware reports F-N2 and F-N3. Any other board, including
  vNext1, takes the manual install (M) once.
- **About** loses its firmware prose and the fake "1.0.0". The chip and `FirmwareUpdateNote`
  go. `UnsupportedFirmwareCard` points to M instead of GitHub.

## 10. Open questions for the owner (round 2)

Only questions that are the owner's call. The full list, with Settings questions, is in
[settings-structure.md](settings-structure.md) section 7. Settled in round 2: one chord
approves both halves (was N2; tech doc section 7).

| # | Question | Recommendation |
|---|---|---|
| N1 (was Q4) | When Keybard is open, should it ask GitHub whether there's firmware newer than the files it carries, only to say "a newer firmware exists" (never to install it)? **Yes:** users hear about a release before their Keybard site carries it. Each check sends the user's IP address to GitHub, and the message points at a Keybard that may not exist yet. **No:** Keybard knows only what it carries, and new firmware appears when the site is redeployed. | No. Production and its firmware ship together under one launch tag, so the stable site never lags its own release. |
