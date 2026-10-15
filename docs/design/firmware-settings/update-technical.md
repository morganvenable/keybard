# Keybard installs the latest firmware: technical grounding and risk register

Status: design input, nothing built. Written 2026-10-13. **Revised 2026-10-14 (round 2)**
after the owner's review. The decisions are in section 7, and the sections they changed
say so (1.4, 1.10, 2.3-2.5, 3.1, 3.4, 4.1-4.3, 5, 6). Round 2 added the LED reference (1.10),
read at firmware `42c3de6036`, and the one-chord design (F-N3, 1.4). Round 1 was written against:

- Firmware: `svalboard/qmk` branch `svalboard` at `01305aba07` (the same commit as the `vNext1` tag). Read with `git -C GitHub/svalboard-qmk show origin/svalboard:<path>`. Paths under `keyboards/svalboard/` are shortened to `kb/`.
- Keybard: worktree `keybard-wt-firmware-design`, branch `design/firmware-settings`, at production vLaunch2.4 (`6ed296f`).
- Live checks: the GitHub releases of `svalboard/qmk`, and HTTP headers fetched from GitHub on 2026-10-13 (section 3.3).

Line numbers are for those commits. "updater.md" is `docs/updater.md`, "plan" is `docs/updater-plan.md`, both in the firmware repo.

---

## 0. Findings that change the brief

1. **No board in customers' hands can use the updater yet.** `vLaunch2`, the current stable firmware, has no updater: its tree has no `kb/updater/` and no `build_reset.c`, and its release has 12 `.uf2` files and no `.svup`. The only firmware with the updater is the `vNext1` prerelease (fw_version 3, published 2026-10-14 03:39 UTC: two `.uf2` and two `.svup`). So every existing board needs one more manual BOOTSEL + `.uf2` install. Keybard can guide it but can't do it over WebHID. The firmware's own release-notes draft calls this release "the last manual update" (`docs/updater-release-notes-draft.md:12-32`).
2. **No build can skip the chord.** The brief says "dev builds can skip it". No such option exists on `svalboard`, on the `vNext1` tag or on any fork branch. A pickaxe search over every ref for `SVAL_UPDATE_SKIP`, `NO_CHORD` and `SVAL_UPDATE_NO_CONFIRM` found nothing. BEGIN returns NOT_CONFIRMED until `update_gesture_done()` (`kb/updater/updater.c:429-432`), with no compile-time escape. Release and plain updater builds differ in only one thing here: a release build refuses DIAGNOSTIC images (updater.md:60, 126). **Round 2 decision (Q10):** add a developer-only skip that release builds can't have. The design is in 1.4.
3. **"GET_INFO byte 18" is index 17 in Keybard.** The firmware counts the `0xDF` prefix (`modules/svalboard/core/sval.c:442-462`, `data[18]`). Keybard strips the prefix and reads the storage flags at `svilInfo[17]` (`src/services/keyboard.service.ts:253-254`). Bit 2, the D39 notice "settings reset because a different build was installed", comes from `sval_storage_flags_kb()` (`kb/svalboard.c:176-178`). Keybard doesn't read it today.
4. **Protocol 3 transfer time has not been measured.** Every timing in the plan was taken on protocol 1 or 2, with 18- or 23-byte chunks. Protocol 3 sends 50-byte chunks (`f428132e3c`). WebHID has never driven the updater.
5. **The release API already publishes a SHA-256 for every asset.** For example, `svalboard_left_sval_vNext1.svup` is `sha256:82ebb1bb…8c33`. That gives Keybard a hash from a second channel without signing.

---

## 1. How the updater works today, end to end

### 1.1 Pieces

| Piece | Where |
|---|---|
| Session state machine, HID handler | `kb/updater/updater.c` (protocol in its header comment, lines 6-117) |
| Manifest struct, status and op codes | `kb/updater/update_manifest.h` |
| Staging-slot erase and program | `kb/updater/update_flash.c` |
| RAM-only commit | `kb/updater/update_commit.c` |
| Image structure checks | `kb/updater/update_image.c` |
| Chord | `kb/updater/update_gesture.c`, constants in `kb/config.h:83-96` |
| Split relay and the other half's side | `kb/updater/update_split.c`, wire format in `update_split_wire.h` |
| Build-info record (side, pointing, version, flags) | `kb/updater/update_build_info.c/.h` |
| Settings reset on a new build (D39) | `kb/build_reset.c` |
| `.svup` builder and offline verifier | `kb/tools/make_update.py` |
| Reference host client | `kb/tools/sval_update.py` |

The updater is compiled in only with `SVAL_UPDATER=yes` (updater.md:3-5). Since D34, release CI builds exactly two images, `svalboard/left:sval` and `svalboard/right:sval`, as release updater builds. They carry every pointing driver (pointing ID 5, "auto") (updater.md:596-601, plan D34 line 377).

### 1.2 The `.svup` file

A `.svup` is a 108-byte manifest followed by the raw image, with nothing between or after them (updater.md:113-134). Fields that matter to Keybard:

| Offset | Field | Device rule |
|---|---|---|
| 0 | magic `SVUP` | checked |
| 4 | manifest version | 2 (version 1, the signed one, is refused) |
| 7 | hand (0 left, 1 right) | reported, not checked (D33) |
| 8 | pointing ID (5 = auto) | reported, not checked (D33) |
| 10 | flags: bit0 RELEASE, bit1 DIAGNOSTIC | a release build refuses DIAGNOSTIC |
| 12, 14 | security epoch, storage format | at or above the device's floors |
| 15 | updater protocol | of the image |
| 16 | image length | 0x200 to 0x160000, a multiple of 256 |
| 20 | fw_version u32 | the number from `kb/updater/fw_version.txt` (D32) |
| 28 | version string, 16 chars | the release tag |
| 44 | SHA-512 of the image | checked at verify, at commit step 0, and on the other half |

`vNext1`'s `.svup` files are 126,060 B each, so the images are 125,952 B. The manifest has **no USB product ID and no Sval (configurator) protocol version**. Keybard can't learn either from the file (section 3).

### 1.3 Protocol

Each request is one 64-byte raw HID report: `[0xDD][client_id:4][0xFE][0x07|0x08][0x55][op][value_data:55]`. The reply is the same packet with `value_data` rewritten, and `value_data[0]` is always a status (updater.md:136-160). Every request starts with `[hand]`: this half, the other half, or `0xFF` (INFO only). Every op except INFO needs the client wrapper.

| Op | Use in a Keybard flow |
|---|---|
| `0x00 INFO` page 0 | state, protocol (3), max image, JEDEC, pointing ID, hand, fw_version, storage floor, epoch, flags (bit0 16 MiB die, bit1 settings writes failing, bit2 release build, bit5 the other half's version differs), last error, then the piece sizes (50, 52, 64). With the other hand, the other half answers through the relay; `0xFF` state means no answer (updater.c:20-32, 86-90) |
| `0x00 INFO` page 1 | fw_version and the 16-char version string (the tag) |
| `0x01 MANIFEST` | 108 bytes in pieces of up to 52 (3 reports) |
| `0x02 ARM` | nonce u32 and the first 4 bytes of SHA-512(manifest); starts the 30 s chord window; BUSY during a Scan Lab sweep |
| `0x03 BEGIN` | ACCEPTED once the chord is made; erase follows, one 4 KiB sector per main-loop pass |
| `0x04 CHUNK` | up to 50 data bytes, strictly in order; replays are acknowledged without a write |
| `0x05 END` | starts the SHA-512 and structure verify, 2 KiB per pass |
| `0x06 STATUS` | state, bytes staged, image length, sectors erased and to erase, last error, verify ms, CRC low 16, flags (chord made, session bound), the other half's presence (0 none, 1 match, 2 version differs, 3 same hand, 4 invalid) |
| `0x07 COMMIT` | nonce + CRC low 16. For this half: commit 100 ms later. For the other half: the first COMMIT relays, the second commits |
| `0x08 ABORT` | nonce; from anyone while ERROR is latched; never erases |
| `0x09 REBIND` | moves the session to a renewed client ID |
| `0x0C RELAY` | relay phase and progress |

The session times out after 30 s without an op (updater.md:190). Failures latch ERROR until ABORT (updater.md:181-190).

**The session binding** keeps well-behaved clients apart: two Keybard tabs, Keybard Host, a stray tool. It doesn't stop a hostile process that has the device open. That process can REBIND, stall, ABORT or time the COMMIT, but it can't change what gets installed, because the chord approved the manifest hash and the manifest's SHA-512 binds the image to it (updater.md:192-201, updater.c:105-110).

### 1.4 The chord, and why it exists

After ARM, the user holds Index South + Middle South for 1 s on the half with USB: right `[6,0]+[7,0]` (`M`, `,`), left `[1,0]+[2,0]` (`V`, `C`) (updater.md:203-212, `kb/config.h:83-96`). The chord is read from the scanned matrix, never from keycodes. Both keys are hidden from QMK while the updater waits, and rows are scanned with at least 500 µs pre and post waits, so a Scan Lab timing can't misread the keys.

Why it exists:

- **Physical presence.** Any page or process that can open the HID device can drive every other op. The chord is the only gate on what gets installed (plan R10, line 412). It plays the role of holding BOOTSEL: "anyone who can get a user to make the chord can install any image, exactly as anyone who can get them to drag a UF2" (updater.md:31-34).
- **Binding to one image.** The chord approves one manifest hash (D5). The host shows 4 bytes of that hash at ARM.
- **No host forgery.** `SVAL_UPDATER` can't be combined with `SVAL_KEYTEST`, because keytest injects key events and would let a host fake the chord (updater.md:78-79, plan R11).

The chord is required on every updater build today (finding 2). Today's firmware asks for it once per half, so a pair update made with `sval_update.py` needs it twice, both times on the half with USB (sval_update.py:775). **The owner decided that one chord approves both halves** (section 7). Keybard's flow depends on that change, F-N3, below.

**One chord for both halves (firmware addition F-N3, required).** A full update asks for the chord exactly once, at the start, on the half with USB. After that, it runs to the end with no human step.

1. **One approval covers two manifests.** Before ARM, Keybard sends the other half's manifest (as today) and the USB half's own manifest into a second manifest buffer. The USB half checks both against both halves' fields (the 2.1 pre-checks, done on the device too), so the user is never asked to approve a file either half would refuse. ARM for the other half then starts one chord window for the pair, and its reply carries 4 bytes of each manifest's SHA-512. Keybard shows both codes.
2. **The USB half keeps the second approval in RAM.** After the chord, it stores the SHA-512 of its own manifest, bound to the session's client ID (it follows REBIND). The other half's update runs as today.
3. **The USB half's own session uses it.** When Keybard sends MANIFEST and ARM for the USB half, a manifest whose SHA-512 equals the stored one counts as approved: BEGIN is accepted at once. The approval is used once and then cleared. It is also cleared by ABORT, by any error in either session, by a reset of the USB half, by a client other than the bound one, and after a window long enough for the other half's commit, hold and probes plus Keybard's checks (about 120 s after the relay ends; the exact value is the firmware's call).
4. **LEDs.** A pre-approved ARM shows no blue and no white flash. The light goes from red (the halves differ) straight to the rainbow, so nothing on the keyboard looks like a second request (1.10).
5. **INFO reports it** with a page-0 flag bit. Keybard's flow requires it. A board without it (vNext1, the only updater release so far) takes the manual install once (update-flow M).
6. **A one-half update** (Advanced, or finishing a stopped update) uses today's single-manifest ARM: still one chord.

Security: the chord still approves exact images, both bound by hash. While the second approval is held, a hostile client with the HID device open can't install anything else. It can only start the approved file early, stall it, or ABORT it, which it can already do to any session (1.3). The approval doesn't survive a reset, so it can't be used later.

**Developer builds without the chord (round 2, Q10, firmware addition F-N1).** A developer build may skip the chord. A release build must never be able to. The firmware already has this pattern for test hooks, and the skip copies it at every gate:

1. **Build option.** `SVAL_UPDATE_NO_CHORD ?= no` in `kb/rules.mk`. Its `ifeq` block adds `-DSVAL_UPDATE_NO_CHORD`, and it calls `$(error ...)` when combined with `SVAL_UPDATE_RELEASE=yes`, as lines 113-117 do for `SVAL_UPDATE_TEST_HOOKS`.
2. **Compile-time guard** in `kb/updater/update_build_info.c`: `#if defined(SVAL_UPDATE_NO_CHORD) && defined(SVAL_UPDATE_RELEASE)` → `#error "release updater builds cannot skip the chord"`, beside the existing guards at lines 12-22.
3. **The skip itself**, in one place: under `#ifdef SVAL_UPDATE_NO_CHORD`, `op_begin` treats the gesture as done (`kb/updater/updater.c:429-432`). ARM, the manifest-hash binding and every check stay as they are.
4. **The build-info record says so.** A new flag, `UPDATE_BUILD_NO_CHORD 0x40` (0x02 and 0x20 are retired and must stay 0, `update_build_info.h:20-25`).
5. **Release CI refuses it.** `tools/check_release_elf.py` fails on the flag, as it does for test hooks (lines 13, 37-40). `tools/make_update.py` adds it to `BI_NOT_IN_RELEASE` (line 68), so `--release` won't build a `.svup` from such an image.
6. **INFO reports it** with a free page-0 flag bit, so Keybard leaves out the approval steps (update-flow 4.1, 5.2). Keybard also reads the build-info record inside a file the user picks, and shows a `Developer build` warning before installing it (update-flow 4.2).

Risk: on a no-chord build, any page or program that can open the keyboard's HID interface can replace its firmware without the user touching the keyboard.

### 1.5 Verification

- At ARM, again at BEGIN, and again at commit step 0: magic, version, reserved fields, known flags, DIAGNOSTIC on a release build, epoch and storage floors, and the length bounds (updater.md:218-227).
- After END, on the staged image: the SHA-512 equals the manifest's, the boot2 CRC of page 0 is valid, the initial SP is in RAM, and the reset vector is odd and inside the image. The image CRC is kept.
- COMMIT must carry the low 16 bits of that CRC (updater.md:170). `sval_update.py` also compares the board's CRC with its own (sval_update.py:572-574).
- Not checked: side, pointing device (D33), or who built the image. No signing in v1 (updater.md:20-34). The signed implementation is kept at tag `archive/fw-updater-signed`.

### 1.6 The commit

`update_commit.c` (updater.md:229-278):

- **Step 0** runs from flash. It re-checks everything, and refuses with nothing changed if settings writes are failing, the die isn't 16 MiB, or the slot's hash or CRC changed.
- **Steps 1-7** run from RAM with interrupts off:
  1. A RAM vector table, so any fault resets the board, and an 8 s watchdog.
  2. Program page 0 to zeros. From here on, a power cut ends in BOOTSEL, never in a half-written image.
  3. Erase.
  4. Copy the image sector by sector.
  5. CRC verify, with one retry.
  6. Write page 0 last.
  7. Clear RAM magic and reset through the watchdog.

COMMIT to reboot takes about 1-2 s (plan line 179).

### 1.7 The other half, over the split cable

A request whose hand is the other side's starts a session for the other half. It runs on the half with USB, where the chord is made (updater.md:432-461):

1. MANIFEST, ARM, chord, BEGIN, CHUNK and END stage and verify the image in the USB half's own slot, exactly as for itself.
2. COMMIT #1 (state RELAYING): the USB half pauses the split link, sends the manifest, and waits while the other half checks it itself (D7) and erases its slot. Then it resumes the link and streams PAGE fragments (24 B each, at most 4 ms of RPCs per pass, so both halves keep typing). It pauses again while the other half verifies. State RELAYED.
3. COMMIT #2 (SUBSIDE_COMMITTING): the other half commits with the same RAM routine. The link stays paused 4.5 s, then the USB half probes and returns to IDLE.

The relay phase table is at updater.md:463-487. If the other half stops answering for 2 s, the relay fails with UNAVAILABLE. The other half drops a session 5 s after its last request.

**Order (V).** The half without USB goes first. Straight after its commit, the half with USB updates itself, without waiting to hear from the other half, because the new firmware may not be able to talk to the old one (plan line 201, sval_update.py:781-782).

**Mixed halves.** Updater builds add a split transaction and fold the transaction count into every handshake. So an updater half can't talk to a default-build half at all, and a release that changes the split table can't talk to the previous release (updater.md:365-369, 484-487). After a relay, or while presence reads "version differs", the USB half blinks red at 1 Hz and sets INFO flag bit5 until presence reads MATCH (updater.md:404-408, 484-487). Keybard doesn't read any of this yet.

### 1.8 Power loss, unplug, recovery, by stage

| Stage | Unplug or power cut | Host goes away (tab closed) | Recovery |
|---|---|---|---|
| Before ARM, or CONFIRM_WAIT | Old image, nothing touched | 30 s chord window → NOT_CONFIRMED, latched until ABORT | None (ABORT clears it) |
| ERASING, RECEIVING, VERIFYING, VERIFIED | Old image boots; the slot is ignored and erased by the next BEGIN (updater.md:284) | 30 s → TIMEOUT latched; the old image keeps running | None |
| Relay (other half), any phase before COMMIT #2 | The other half keeps its old image. **Pulling the split cable browns out the USB half too** (plan line 218, 225) | The USB half's 30 s timeout stops the relay before the copy (D23) | None |
| USB half COMMIT accepted, copy running (1-2 s) | Before page 0 is written: BOOTSEL (`RPI-RP2`). After: the new image | Irrelevant: the commit runs on its own | Copy the `.uf2` in BOOTSEL |
| Other half COMMIT #2, copy running | That half comes up in BOOTSEL or on the new image. With its power coming over the split cable, a cut there also resets the USB half | Irrelevant | Plug USB into that half and copy its `.uf2` |
| Any time | BOOTSEL held at plug-in, or double-tap reset within 500 ms | — | The `.uf2` |

Settings and identity sit outside everything the commit writes (updater.md:290-292). The D39 reset happens afterward, at the first boot of a different image (section 4).

**When the board won't update at all.** The updater reports UNAVAILABLE and does nothing on a die that isn't 16 MiB (updater.md:110-111, D26). ARM is refused while `wear_leveling_write_failed()` is latched (D12). In both cases Keybard falls back to the guided manual copy.

### 1.9 Measured timings (from the plan)

| What | Measured | Protocol |
|---|---|---|
| USB transfer, 118 KB | 16.7-17.7 s, about 6,600 round trips at 1.6-1.8 ms (hidapi, Windows) | 1 (18 B chunks) (plan:179) |
| USB transfer to the half with USB | 17-20 s, mean round trip 1.5-2.2 ms | 2 (23 B chunks) (plan:221) |
| Image verify | about 485 ms | 1 |
| Sector erase | 50-53 ms each (about 31 sectors: about 1.6 s) | 1 |
| COMMIT to reboot | about 1-2 s | 1 |
| Relay to the other half, 125,696 B | 11.1-11.4 s, 64-78 retries | relay (unchanged in protocol 3) (plan:215, 221) |
| Other half commit + reboot hold | 4.5 s fixed pause; the probe found it still rebooting every time, so DONE is always "unconfirmed" (plan:224) | relay |

**Protocol 3 estimate (unmeasured):** 125,952 B / 50 B = 2,520 CHUNKs. At hidapi's 1.5-2.2 ms that's 4-6 s. WebHID round trips are unmeasured; at an assumed 2-4 ms (Keybard's promise queue plus `sendReport` and the `inputreport` event) it would be 5-10 s per USB transfer. Measuring it is the first M4 task.

### 1.10 LEDs during an update (round 2)

Read at `svalboard/qmk` `origin/svalboard` `42c3de6036`. Paths are under `kb/`, except those starting with `docs/`. The user-facing guidance built from this table is in [update-flow.md](update-flow.md) 5.3.

**How the LEDs are driven.** In an `SVAL_UPDATER=yes` build, rgblight's driver goes through a gate (`updater/update_led.c:6-13, 34-53`). While the updater owns the LEDs, it drops rgblight's writes. Rgblight's animations, layer colors, idle dimming and split sync keep running, in RAM only.

- The updater writes the WS2812s directly, at brightness `SVAL_UPDATE_LED_VAL` 96 of 255, about 38% (`config.h:98`). The whole half shows one color.
- Updater colors show even when RGB is off, the host is asleep or the board is idle. Idle dimming is skipped while `updater_active()` is true (`svalboard.c:672-675`).
- When the updater gives the LEDs back, they repaint from rgblight's current state (`update_led.c:82-86, 95-97`).
- Each half decides from its own state on every main-loop pass (`updater.c:815-854, 928`).

**The six patterns** (`update_led.c:26-29, 59-78`; enum `update_led.h:10-18`)

| Mode | Output |
|---|---|
| CONFIRM | Blue (0,0,96), blinking at 2 Hz: 250 ms on, 250 ms off |
| CHORD | White (96,96,96): on 75, off 75, on 75, off 75 ms, 300 ms in all, once (`updater.c:153`) |
| APPROVED | Solid blue (0,0,96) |
| PROGRESS (the rainbow) | A full-saturation hue sweep, one turn in about 2.05 s (8 ms per hue step, at most 50 writes a second). It never resets while it stays in this mode, so it reads as one continuous cycle across erase, receive, verify and relay |
| WRITING (magenta) | Solid magenta (96,0,96). The commit sets it and freezes it with two flushes before interrupts go off (`update_led.c:112-123`, called at `updater/update_commit.c:511`). It stays until the reset |
| ERROR | Red (96,0,0), blinking at 1 Hz: 500 ms on, 500 ms off |

**State by state.** USB = the half with USB; OTHER = the half without. States are from `updater/update_manifest.h:126-143`.

| Updater state | Half | LED | Starts | Stops |
|---|---|---|---|---|
| Idle, halves match | both | Layer color | | |
| Idle, halves mismatch (version differs, same hand, or bad answer) | USB | Red 1 Hz | Presence ping (every ~500 ms, `svalboard.c:680`) reads 2, 3 or 4 (`updater.c:216-220, 831`; `update_split.c:77-78`; `docs/updater.md:404-406`) | Presence reads MATCH |
| Idle, halves mismatch | OTHER | Layer color. OTHER always reports presence NONE (`update_manifest.h:146-148`) | | |
| Idle after updating the other half (`awaiting_match`) | USB | Red 1 Hz, even while presence reads NONE | Relay DONE (`update_split.c:844-846`; `docs/updater.md:484-487`) | First MATCH (`update_split.c:70`), usually one ping later. If the release changed the split table, red stays until USB is updated too |
| MANIFEST_LOADING (1) | USB | Layer color, or red if mismatched (`updater.c:832-835`) | First MANIFEST piece | ARM |
| CONFIRM_WAIT before the chord (2) | USB, also for an OTHER update (`docs/updater.md:435`) | Blue 2 Hz | ARM (`updater.c:416-418`) | The chord, or 30 s after ARM: NOT_CONFIRMED, red (`updater.c:874-876`; `config.h:96`) |
| Chord recognized | USB | White double flash | `done_ms` (`update_gesture.c:64-66`; `updater.c:847-848`) | 300 ms later, even if BEGIN came first: `update_gesture_disarm()` leaves `done` set (`update_gesture.c:34-37`), and `led_mode()` checks the flash before the state (`updater.c:847-848`). The keys stay hidden from QMK until released (`update_gesture.c:72-80`) |
| CONFIRM_WAIT after the chord | USB | Solid blue | End of the flash | BEGIN. Keybard sends BEGIN as soon as STATUS shows the chord, normally inside the flash, so solid blue usually never shows. After 30 s with no request: TIMEOUT, red (`updater.c:864-873`; `config.h:97`) |
| USB half's own ARM, pre-approved by the pair chord (F-N3, proposed) | USB | Rainbow from ARM: no blue, no flash (1.4 step 4) | ARM with the stored hash | as states 3-7 |
| VERIFYING_MANIFEST, ERASING, RECEIVING, VERIFYING_IMAGE, VERIFIED (3-7) | USB | Rainbow (`updater.c:853`), VERIFIED included | BEGIN | COMMIT (magenta) or an error |
| Same, during a USB-half update | OTHER | Layer color, following USB's rgblight over split sync. Inferred from `update_led.c:9-10`; check on hardware | | |
| RELAYING, RELAYED (10, 11) | USB | Rainbow (`updater.c:841-843`) | COMMIT accepted for the other half (`updater.c:509-511`) | SUBSIDE_COMMITTING or an error |
| Being relayed to (its states 1-7) | OTHER | Rainbow (`updater.c:818-829`; `docs/updater.md:513-514`) | First KEYBOARD_UPDATE frame | Commit, error, or 5 s with no request (`update_split.c:440-447`; `config.h:101`) |
| COMMITTING (8), own half | USB, or OTHER on its own commit | Magenta, frozen | COMMIT accepted; the copy starts 100 ms later (`updater.c:526-527, 909-917`; slave: `update_split.c:264-265, 421, 459`) | Watchdog reset. The new image repaints; after a settings reset that's layer 0 green at brightness 128 |
| SUBSIDE_COMMITTING (12) | USB | Magenta, although USB isn't writing (`updater.c:838-840`) | Second COMMIT (`updater.c:513-514`) | Relay DONE: a 2.0 s + 2.5 s hold (`update_split.c:596-599`; `config.h:118-119`) plus up to 20 × 500 ms probes (`update_split.c:822-834`); then `awaiting_match` red |
| ERROR (9) | USB | Red 1 Hz, with no timeout. The 30 s timeout applies to states 1-7, 10 and 11 only (`updater.c:864`) | `fail()` (`updater.c:245-250`) | ABORT from any client (`updater.c:531-548`), or unplug and replug |
| ERROR | OTHER | Red 1 Hz | `slave_fail` (`update_split.c:148-152`) | ABORT relayed, or 5 s with no request (`update_split.c:440-447`) |
| Commit failed into BOOTSEL (`RPI-RP2`) | the committing half | No firmware runs. Most likely frozen on magenta. Inferred: WS2812s hold their last frame while powered (`docs/updater.md:285-288, 322-327`); check on hardware | The commit invalidates page 0 (`docs/updater.md:249-268`) | A UF2 copy |
| BOOTSEL entered by hand | either | Not driven by firmware: probably dark after a cold plug, the last frame after a double-tap (inferred) | | |
| Settings-reset notice | | No LED signal. It's a host-only flag, GET_INFO byte 18 bit 2 (`svalboard.c:174-177`), set on the first boot of a different build (`build_reset.c:67-93`). What the user sees: layer colors and brightness return to their defaults (`svalboard.c:149-164`; brightness 128, `config.h:271`) until the layout is put back | | |

**Collisions a UI must allow for:**

- Magenta is also the default color of layer 15, the auto-mouse layer (HSV 0xD5, `svalboard.c:164`; `keymaps/keymap_support.h:62`).
- Red is the default color of layers 6 and 7 (`svalboard.c:155-156`). Only the blink tells updater red apart.
- The docs' LED summary (`docs/updater.md:214-216`) leaves out VERIFIED, the relay and the mismatch states.

**Not verified on hardware:** the OTHER half's light during a USB-half update (after a pair update it runs the new release and may not sync with the old USB half), and the LED in BOOTSEL. The F-N3 row is a design, not built.

---

## 2. What Keybard must implement over WebHID

`sval_update.py` is the reference client. Its `Session.run` (sval_update.py:492-605), `relay_and_commit` (635-691), `confirm_other` (693-718) and `pair` (741-820) are the flow to port. The plan's M4 list is at plan:301-308.

### 2.1 Preconditions (before anything is sent)

1. Connected over WebHID with 64-byte reports. `usb.reportLength` comes from the descriptor (`src/services/usb.service.ts:273-276`). INFO's report size must be 64 (sval_update.py:265-273).
2. **INFO (hand 0xFF):** protocol must be 3, and the flag bits for F-N2 and F-N3 must be set (otherwise the manual path, update-flow M). Check the 16 MiB flag, the "settings writes failing" flag, state IDLE, and no latched ERROR. If ERROR is latched (a tab that died mid-session), send ABORT first; anyone may ABORT a latched error.
3. **The other half:** STATUS presence must be MATCH or VERSION within 5 s (sval_update.py:609-630). Then INFO with the other hand: `0xFF` state means no answer, so offer USB-half-only or the manual path.
4. **Refusal pre-check** against both halves' INFO: protocol, DIAGNOSTIC on a release build, epoch, storage floor, size (sval_update.py:284-300, 769-772). Check both images against both halves before sending anything, so the second half can't refuse after the first has committed.
5. **Mismatch warnings** (D33), never refusals: an image hand ≠ the half's hand, or a pointing ID ≠ the half's (sval_update.py:309-323). For release auto images, pointing never mismatches on an auto build. It does on a board still running a per-module build such as vLaunch2's trackball images, but those boards can't reach the updater anyway (finding 1).
6. **Stop competing traffic:** close the Scan Lab and matrix tester (ARM is BUSY during a sweep). Ask Keybard Host to disconnect (`/api/host/command {op:"disconnect"}`, `companion/overlay-host/keybard_host/server.py:153`). Hold a Web Lock so a second Keybard tab on the same origin stays out.
7. **Settings backup** (section 4).

### 2.2 The send path

- **Don't use `usb.send()`'s silent retry.** On a rejected client ID, `send()` re-bootstraps and retries once (`usb.service.ts:733-747`). For the updater that would leave the session on the old ID. The updater path must catch the wrapper error, take the new ID, send REBIND with the nonce, then retry (plan:304, D3 line 329).
- **Client ID renewal** keeps its 50 s period (`usb.service.ts:32`, 604-625). The updater service must send REBIND right after each renewal, before its next op. sval_update.py's `renew()` does this (sval_update.py:456-475).
- **Timeouts:** Keybard fails a command after 1000 ms (`usb.service.ts:765-768`). Every updater op answers within 50 ms by design (plan:97), so that's fine. BEGIN and END are asynchronous: poll STATUS.
- **Reports:** MANIFEST in 3 pieces of 52/52/4 bytes. CHUNK `[hand][off u24][n][≤50 B]`. On OUT_OF_ORDER, resync to the board's next offset (sval_update.py:556-564).

### 2.3 Steps, per half

```
INFO, presence, pre-checks, backup (section 4)
-- the other half (if both halves are updated) --
MANIFEST x3 (hand = other) + the USB half's manifest (second buffer, F-N3)
ARM (pair) -> show "approve on the keyboard", both codes   <- the only human step
poll STATUS until chord_made (<= 35 s) -> BEGIN
poll STATUS until RECEIVING (erase, ~1.6 s)
CHUNK x2,520 (REBIND after each renewal) -> END
poll until VERIFIED; compare crc_lo16 with Keybard's own CRC-32/MPEG-2
COMMIT #1 -> poll RELAY until RELAYED (~11 s; phases: erase, sending %, verify)
COMMIT #2 -> poll STATUS until IDLE (4.5 s hold)
INFO(other) until it answers (<= 10 s); presence will read VERSION (expected)
-- the half with USB --
MANIFEST x3 (hand = self) -> ARM (pre-approved, F-N3) -> BEGIN at once -> erase -> CHUNKs -> END
VERIFIED, CRC check -> COMMIT -> the device disconnects within ~100 ms + 1-2 s
-- after --
wait for the device (2.1.4), reopen, bootstrap a client ID
INFO page 1: version string = the tag; fw_version = the manifest's
STATUS presence = MATCH within 10 s (sval_update.py:791-820)
GET_INFO storage flags -> act on the Afterwards choice made before Start (section 4.3)
```

Keybard computes the CRC with the same CRC-32/MPEG-2 over `[0x100, len)` that `make_update.crc32_mpeg2` uses. The SHA-512 of the manifest (Web Crypto `SHA-512`) gives the 4-byte hash to compare with ARM's (sval_update.py:497, 535-536).

### 2.4 Time budget

| Stage | Estimate |
|---|---|
| Pre-checks + backup read | 1-3 s (the board config is already in memory; export is local) |
| The chord, once for both halves (human) | 2-30 s |
| Other half: erase + USB transfer + verify | about 7-12 s (protocol 3 estimate) |
| Relay | about 11.5 s (measured) |
| Other half commit + hold + reanswer | about 5-10 s |
| USB half: erase + transfer + verify + commit | about 8-13 s |
| Reboot, re-enumerate, reconnect | 3-10 s (Windows installs a new HID device instance on a new PID) |
| Presence MATCH + restore | 5-20 s |
| **Total** | **about 45 s to 2 minutes** |

### 2.5 Progress

STATUS and RELAY carry enough data for a real progress bar. Suggested weighting by measured time: erase (sectors erased / to erase), transfer (staged / image_len), verify (indeterminate, under 1 s), relay (acked / image_len, and the other half's sectors during erase), commit and reboot (indeterminate, with a time-based fill). The one chord wait is a separate, explicit state with the keyboard LED shown: blue blink, then a white double flash, then the rainbow (1.10). Show both halves as two rows: one chord approves both images, but they install one after the other. During the relay's paused windows (erase, verify, commit) the other half doesn't type: tell the user up front not to type.

### 2.6 Reconnecting after the reboot

- **WebHID permission is per VID/PID/serial.** The USB serial is `sval:` plus the board's stored serial (`kb/config.h:132-136`, identity.c), the same on vLaunch2 and vNext, so it survives the update. The PID changes only when the build changes it. From vNext on, everything is left 0x4044 / right 0x4045. Coming from a per-module build (vLaunch2 trackball right is 0x4049) it changes, but that path is manual anyway.
- **Same PID:** listen for `navigator.hid` `connect`. `getDevices()` returns the board again (`src/contexts/KeyboardContext.tsx:71-77`), and Keybard opens it with no chooser.
- **New PID:** Keybard can predict it from hand → auto PID (a table in Keybard; the manifest doesn't carry it). It then needs one user click, because `requestDevice` needs a user gesture (`usb.service.ts:294-297`). Use a filter `{vendorId: 0x303a, productId: <new>}` so the chooser shows only the board.
- **Keep the flow's state outside the connection.** `handleDisconnect` closes the connection (`usb.service.ts:280-286`). The update flow (images, backup, expected fw) must survive that and resume when the board comes back. Store it in `sessionStorage` with the Afterwards choice, so a reload still finishes the restore without asking.
- **Linux:** a new PID can fail `open()` with NotAllowedError if the user's udev rule names the old PID. Keybard's rule already globs 0x4044-0x404D (`src/utils/linux-hid-access.ts:16-19, 33-45`). Show it before the update on Linux, not only after a failure.
- **Other half silent after the update:** presence NONE or VERSION for more than 10 s. Offer, in order: run the USB half's update again; then the manual copy for the other half (plug USB into it, copy its `.uf2`) (sval_update.py:716-718, plan:201).

---

## 3. "The latest firmware it can accept"

### 3.1 What compatibility means

| Axis | Source on the board | Source for the image | Rule |
|---|---|---|---|
| Updater protocol | INFO byte 1 | manifest byte 15 | USB half must be 3. The other half may be 2 or 3 (sval_update.py:105-107) |
| Raw HID report size | descriptor, INFO byte 24 | (image) | 64. Keybard ≥ vLaunch2.3 |
| Sval (config) protocol | GET_INFO `svil_proto` | **not in the `.svup`** | The new firmware's Sval protocol must be one this Keybard speaks: `MIN_SVIL_PROTO` = 3 (`src/constants/firmware.ts:12`). A firmware with a newer protocol is reported as "newer than vLaunch2" (`firmware.ts:53`), but nothing stops Keybard installing a firmware it then can't configure. That's a configurator lockout, not a brick |
| Version | INFO fw_version (u32), INFO page 1 tag | manifest bytes 20, 28 | "Newer" = a higher fw_version. Numbers rise through vNext too (D36): a stable vLaunch must exceed every vNext before it |
| Channel | (none on the board) | GitHub `prerelease` flag; tag `vLaunch<N>` or `vNext<N>` (D38) | Round 2 (Q5, decided): there's no channel setting. Each site offers the releases its deploy carries. Production carries its vLaunch and the one before it, and next.keybard adds the newest vNext (update-flow 3.2). Only releases with F-N2 and F-N3 are carried, so vLaunch2, Vial and vNext1 are never offered |
| Floors | INFO epoch and storage format | manifest bytes 12, 14 | The image must be at or above them, or the board refuses |
| Release vs diagnostic | INFO flag bit2 | manifest flags | Release builds refuse DIAGNOSTIC; release CI never publishes DIAGNOSTIC |
| Side | INFO hand (the build's, not the hardware's: plan R8) | manifest byte 7 | Pick each image by the hand each half reports (sval_update.py:747-751). A mismatch is a warning (D33) |
| Pointing | INFO pointing ID | manifest byte 8 | Release images are auto (5): matches anything. Custom builds: a warning |
| MCU and flash | INFO JEDEC, flag bit0 | (none) | 16 MiB die, else UNAVAILABLE and the manual path (D26) |
| Presence | STATUS byte 21 | (none) | Both halves need MATCH or VERSION to update the other half |

**Missing metadata.** The `.svup` can't tell Keybard (a) the Sval protocol of the image, (b) the USB PID it will come up with, or (c) the oldest Keybard that can configure it. Recommendation: release CI also publishes a small `release.json` with tag, prerelease, fw_version, updater protocol, Sval protocol, minimum Keybard, and per file the hand, pointing, PID, size, SHA-256 and SHA-512 (Q15). Until then, Keybard can keep that knowledge in its own build, as `LATEST_FIRMWARE_RELEASE` already does (`firmware.ts:20-30`).

**Definition:** the latest firmware a given Keybard build can accept is the highest-fw_version release among those that site carries that (1) this Keybard build knows, pinned in its source (3.4); (2) has an updater protocol and Sval protocol this Keybard speaks; and (3) passes every floor in both halves' INFO. Releases newer than the build knows are announced ("a newer firmware exists; update Keybard") but not installed.

### 3.2 How Keybard learns what's available

- **Baked into the build (current practice).** `LATEST_FIRMWARE_RELEASE` is "baked into the build: no network lookup" (`firmware.ts:20-30`). The firmware download today is a link to `releases/latest` (`firmware.ts:5`, `src/components/FirmwareUpdate.tsx:9-16`).
- **GitHub releases API.** `api.github.com/repos/svalboard/qmk/releases` answers with `Access-Control-Allow-Origin: *` (checked 2026-10-13), so a page can read it. Limits: 60 requests per hour per IP unauthenticated, shared behind NAT. It reveals the user's IP to GitHub on every check. It returns each asset's `digest` (`sha256:…`), size and `browser_download_url`.

### 3.3 Hosting the bytes

Checked 2026-10-13:

- `github.com/.../releases/download/...` answers 302 with no `Access-Control-Allow-Origin`.
- The redirect target `release-assets.githubusercontent.com` answers 200 `application/octet-stream`, also with no ACAO.
- So `fetch()` from keybard.svalboard.com fails. The API's asset endpoint (`Accept: application/octet-stream`) redirects to the same host.
- GitHub Pages (keybard.svalboard.com) and `raw.githubusercontent.com` both send `Access-Control-Allow-Origin: *`.

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Bundle into Keybard's deploy** | The deploy workflow downloads the release's `.svup` (and `.uf2` for the manual path), checks them against the API digest and `check_release_assets.py`, and serves them at `/firmware/<tag>/…` on the same origin | Same origin, so no CORS, no CSP change and no new service. Production is promoted with a launch tag, so firmware and Keybard ship together, as the shared launch tags already intend. Keybard's own code carries the expected hashes. About 250 KB (both `.svup`) or 750 KB with the `.uf2` per release | Firmware reaches users only through a Keybard deploy. next.keybard must redeploy for each vNext (it redeploys on every merge anyway). Old releases accumulate unless pruned |
| B. A Pages mirror under `svalboard` (e.g. `svalboard/firmware`) | A workflow on `release: published` in `svalboard/qmk` copies assets and writes `index.json` | CORS `*`; decoupled from Keybard deploys; one URL for Keybard, Host and the docs | A new repo and workflow with write tokens, so a new supply-chain hop. A Keybard that trusts `index.json` makes the mirror the trust root, unless hashes are pinned or cross-checked |
| C. Cloudflare Worker proxy | Fetches the GitHub asset server-side and adds CORS | Always current; no copies | A third party and a new account; the worker is in the trust path; per-request cost and availability |
| D. Keybard Host downloads | Python fetches the asset (no CORS) and hands it to the page over its localhost API | No hosting; works for Host users | Only for Host users; new Host API surface; REMOTE_ORIGINS stays exact (`server.py:28`) |
| E. The user picks a file | A download link, then drag and drop or a file picker | Always works; the only option in Paranoid; covers custom builds | Manual; users can pick the wrong file (the hand check warns) |
| F. jsDelivr / raw.githubusercontent of a repo | Commit `.svup` files to a repo branch | CORS `*` | Commits binaries; jsDelivr is a third party; raw is fine but is effectively B |

**Integrity, whatever the host.** The manifest's SHA-512 only proves the image matches *the manifest*. It doesn't prove where either came from. Keybard should accept bytes only if the SHA-256 of the whole `.svup` equals a value from a channel the byte host doesn't control:

1. **Pinned in Keybard's build (recommended).** A `firmware-releases.ts` lists tag, fw_version, the sites that carry it, hand, and SHA-256 per file. It gets updated by a PR when a release ships, so a release needs a second human review in a second repo before Keybard offers it. With option A this is automatic: the deploy fails if the downloaded file doesn't match the pin.
2. **Cross-checked against the API digest.** Fetch `digest` from `api.github.com` (CORS-enabled) and the bytes from B or C. A compromised mirror alone can't pass. A compromised `svalboard/qmk` release passes both, which is why (1) matters.
3. **Signatures (deferred).** The Ed25519 design and code are kept at `archive/fw-updater-signed`. Signing is the only defense if Keybard's origin itself is compromised, and only if the firmware checks it.

A hash mismatch is an integrity failure, so Keybard refuses the bytes. That's consistent with "gentle": the gentle rule covers hardware mismatches, not corrupt or substituted files.

### 3.4 Pinning the build Keybard trusts

- Production (keybard.svalboard.com): pins the vLaunch release promoted with the same launch tag, plus the vLaunch before it when that one has F-N2 and F-N3, so a user can go back one release. Never a vNext.
- next.keybard: pins the newest vNext and production's vLaunch releases. A new vNext pin lands by PR (Q3, decided).
- keybard-test: as next.

**User files take the same path (round 2, Q2 + Q11).** Keybard installs the releases it pins, *and* any `.svup` the user chooses, through one flow (update-flow 3.3):

- The Firmware page lists the pinned releases and a `Choose a file…` entry. A reinstall, a downgrade and a custom build are all just different picks from that list.
- A chosen file whose SHA-256 matches a pin is treated as that release, with no warning.
- Any other chosen file installs with the `Unknown firmware file` warning and the D33 hand and pointing checks. It never gets the integrity refusal, which applies only to a *carried* file that fails its pin.
- In Paranoid, the file picker is the only source. Its files are matched against the pins compiled into that Paranoid build (Q12).

### 3.5 Offline and Paranoid

- Keybard Paranoid can't fetch anything (`docs/paranoid.md`), and updating in Paranoid is out of scope in the plan (plan:442). Options: (a) no updater in Paranoid; (b) file picker only, checked against the hashes pinned in that Paranoid build, with an "unknown file" warning for anything else; (c) embed the two `.svup` in the HTML (about 340 KB as base64), so the Host release that carries Paranoid also carries its firmware. (b) fits Paranoid's model, since nothing new enters the page without the user, and costs almost nothing. `build/paranoid.ts` allows embedded data.
- Offline on the normal site: with option A the files are part of the deploy, but the service worker (if any) must cache them for offline use. Without that, the file picker is the fallback.

---

## 4. Settings safety

### 4.1 What happens to settings

D39 (plan:381, updater.md:603, `kb/docs/settings-storage.md:14-23`):

- The first boot of a different image resets **every** stored setting on that half, through the same path as a new EECONFIG magic (`kb/build_reset.c:67-77`).
- The identical image keeps them.
- Identity (serial, user's name) and updater state are kept.
- The USB half then reports GET_INFO storage-flags bit 2 (Keybard's `svilInfo[17] & 4`) until the host sends `0x2A` (`kb/svalboard.c:176-181`, `sval.c:467-473`).
- If the record can't be written, bit 1 is set, and the next boot resets again.
- Boards coming from Vial or vLaunch2 never wrote a record, so they count as "different" and reset too.

An update that fails before the copy keeps the old image, so the settings stay. Keybard can tell: no bit 2, and fw_version unchanged.

**Round 2 decision (Q6): every install is backup, install, put back.** Keybard never relies on the firmware keeping settings. Every install backs up first (4.2) and acts on the user's up-front choice afterwards (4.3): an update, a reinstall of the identical build, a downgrade, a user file, a one-half update. The firmware still keeps settings on an identical image. Keybard just doesn't make that a separate kind of install.

### 4.2 Before the update: automatic export

1. Build the `.svil` from the live board. `FileService` already serializes keymap, macros, combos, tap dances, overrides, QMK settings, fragments and custom values (VIA3 menus: pointing settings, layer colors) (`src/services/file.service.ts:119`, `:440-520`).
2. Save it two ways:
   - as a backup snapshot of a new kind, `pre-update`, in IndexedDB (`src/services/backup/store.ts:3`, `backup.service.ts:51`), mirrored to the user's backup folder if one is set;
   - as a downloaded file. IndexedDB is per origin, so a backup taken on next.keybard is invisible on keybard.svalboard.com, and clearing site data deletes it.
3. Check the export before ARM by parsing it back with `FileService.loadFile`. If it fails, warn on the same sheet and switch "Afterwards" to "Start from defaults" (Q8; update-flow 4.2). Don't block (gentle), and don't open a second dialog.
4. Record which board it belongs to (kbid, serial) and the fw_version and tag it came from.

### 4.3 After the update: restore

The user chooses **before** anything is sent, on the one confirm sheet (round 2, Q7; update-flow 4.1): "put my layout back" (the default) or "start from defaults". That still meets D35's requirement to offer the choice (plan:380); the offer just comes first. After the install, Keybard acts on the choice without asking again. It asks afterwards only when it finds a reset and no update was in flight (update-flow 6.2).

1. On reconnect, read GET_INFO.
   - **Put my layout back:** write the backup, whether or not bit 2 is set. Without bit 2 (an identical build kept its settings), the write is redundant but harmless. It also covers whatever the other half reset locally (4.4).
   - **Start from defaults:** with bit 2 set, write nothing. Without it (an identical build kept the old settings), Keybard resets them with **firmware addition F-N2**: a Sval op that runs the D39 reset path (`kb/build_reset.c:67-77`) on both halves, at once or on the next boot. Today's Sval reset (`0x0C`, `sval.c:381-399`) isn't enough: it clears the Sval block, keymap and macros, but not the keyboard's own saved values (layer colors, pointing and scan settings, kept in the VIA custom config: `svalboard.c:108-110, 122-165`). F-N2 is required, like F-N3, so this case never keeps the old settings.
   - **Bit 2 set:** settings were reset. This is the usual case after a different build.
   - **Bit 1 set:** changes won't survive a restart (`StorageResetDialog.tsx:27`). Restoring now is pointless until that's fixed: say so.
   - **Bit 0** (storage unreadable) has its own dialog (`StorageResetDialog.tsx:28`). Make sure bit 2 doesn't fall into it.
2. Restore through the existing import path, `import-preflight.ts`, then `ImportService.syncWithKeyboard` (`src/services/import.service.ts:34`). The preflight handles count differences and the keycode version, and the firmware also translates stored keycodes across versions (`545ce06707`).
3. Send `0x2A` (`CMD_SVIL_STORAGE_RESET_CLEAR`, `usb.service.ts:231`; Keybard already sends it at `keyboard.service.ts:756`) **only after** the restore succeeded or the user chose defaults. If Keybard clears it first and the restore fails, the next connect can't tell the board was reset.
4. Keep the pre-update snapshot until the user dismisses it, at least for the backup retention period.

### 4.4 What's lost if the restore fails

- **The whole settings region of the USB half:** keymap, macros, combos, tap dances, key overrides, QMK settings (tap-hold, one-shot, etc.) and Sval custom values (pointing DPI and scroll settings, layer colors, timing). The `.svil` file still holds them, so a retry or a later manual import recovers them.
- **Not recoverable through the `.svil`:** anything the board stores that Keybard doesn't export. To verify:
  1. Does every hardware setting in `src/services/hardware-settings.registry.ts` (Scan Lab timing and the like) round-trip through `custom_values`?
  2. What does the half *without* USB store locally that its own D39 reset clears? Keybard can't see that half's bit 2. Only the USB half answers GET_INFO, and the relay's INFO doesn't carry storage flags.
- **Kept:** identity (serial, the user's board name as the USB product string), the build reset record, the staging slot.

---

## 5. Risk register

Likelihood and impact are for the M4 design with the recommendations in section 6. L = low, M = medium, H = high.

| # | Risk | Likelihood | Impact | Mitigation | Still unmitigated |
|---|---|---|---|---|---|
| K1 | **Compromised firmware release**: a maintainer account or token, a malicious merge, or a compromised CI run publishes a hostile `.svup` | L | H: persistent firmware that can type, log keys and survive Keybard | Release CI: pinned toolchain, `contents: read` builds, tag-to-commit checks, artifact lint (updater.md:637-659). **Pinning in Keybard** (3.3/3.4) adds a second review in a second repo. The chord means only a present user can install. Builds are reproducible with a pinned `SOURCE_DATE_EPOCH` (plan:261, 290), so anyone can rebuild and compare | Unsigned (deferred). A hostile release that passes review and the pin. A deploy-time pin on next.keybard (if chosen) has no second review |
| K2 | **Compromised mirror, CDN or worker** serves other bytes | L-M (more hops, more exposure) | H | SHA-256 pinned in Keybard, or cross-checked against `api.github.com`'s digest; mismatch = refuse | None if pinning holds. With option A there's no mirror |
| K3 | **Compromised Keybard origin** (XSS, npm dependency, Pages takeover) | L | H: can push any firmware; can already rewrite macros today | Dependency review, CSP; the chord requires the user's hands; the manifest hash shown at ARM | Fully unmitigated without firmware-side signature checks; the user will approve what Keybard asks. RP2040 has no secure boot, so BOOTSEL always accepts anything |
| K4 | **Social engineering via the chord**: another page or tool with HID access asks the user to "hold M and ," | L | H | The chord is the user's consent; release notes say "only approve updates you started" (`updater-release-notes-draft.md:44-46`) | The user can't tell which software asked |
| K5 | **Wrong-hand image** | L (Keybard picks by INFO hand) | M: the halves can't talk (presence code 3); recovery is a UF2 | Pick each image by the hand each half reports; warn and confirm on a mismatch (D33) | A half whose *build* hand is already wrong (MCU moved) reports the wrong hand (plan R8) |
| K6 | **Mixed halves** after a partial update (the other half done, the USB half failed or was abandoned) | M | M: the half without USB is silent, or keys missing, until fixed | Both images pre-checked against both halves before anything is sent; the USB half goes straight after; red LED + INFO bit5; **Keybard must read presence and show it** | Today's Keybard shows nothing. A board where only the USB half works can still take its own update over USB |
| K7 | **Interrupted transfer** (unplug, cable, crash) before COMMIT | M | L: old image boots; settings kept | Firmware design (1.8); Keybard ABORTs a latched ERROR on the next connect and restarts | — |
| K8 | **Power loss during the USB half's copy** (1-2 s) | L | M: BOOTSEL; needs the manual `.uf2` | Page 0 last; the watchdog; Keybard tells the user not to unplug during "writing" (magenta) and links the `.uf2` for recovery | Rare manual recovery |
| K9 | **Power loss during the other half's copy**, including a pulled split cable, which browns out both halves | L | M-H: that half in BOOTSEL; the user must plug USB into the other half | As K8; guided recovery for "the other half" | Users rarely know how to plug USB into the other half; docs and UI must show it |
| K10 | **Browser tab closed, navigated or crashed** mid-session | M | L before COMMIT (30 s timeout, old image); none after | Firmware timeouts (D23); `beforeunload` warning; flow state in `sessionStorage`; on reopen, read INFO and offer resume or ABORT | A tab closed between the two halves leaves mixed halves (K6) until the user returns |
| K11 | **Computer sleeps** or USB is suspended | L-M | L before the copy (abort), ignored after (D23) | Screen Wake Lock while updating; a warning if the tab is hidden | Laptops that cut VBUS on sleep during a copy: K8/K9 |
| K12 | **Background-tab throttling** stretches polling past the 30 s session timeout | L | L: TIMEOUT, old image | The CHUNK loop is promise-driven (no timers); STATUS polling under 1 s; Wake Lock; ask the user to keep the tab in front | — |
| K13 | **Linux udev** blocks the device after a PID change | M on Linux | M: "can't connect" right after an update | Keybard's glob rule (0x4044-0x404D, `linux-hid-access.ts`), shown *before* the update on Linux | Rule installs need sudo; PIDs outside the glob |
| K14 | **The PID changes** and WebHID permission doesn't carry over | M (per-module builds) / L (vNext to vNext) | L-M: a confusing chooser | Predict the PID by hand; one "Reconnect" click with a filtered chooser; flow state survives the disconnect | Needs a user gesture; can't be automatic |
| K15 | **Two tabs, Keybard Host or `sval_update.py`** hold the device | M (Host users) | L-M: OTHER_CLIENT or BUSY; a hostile one could stall or time the COMMIT but not change the image | Session binding; Web Lock across same-origin tabs; ask Host to disconnect; check INFO state IDLE before starting | Different origins (next vs production) can't coordinate; the firmware's binding is the backstop |
| K16 | **Settings lost**: export incomplete, restore fails, or the new firmware is incompatible with the old layout | M | M: the user rebuilds their layout | Automatic `.svil` export (IndexedDB + file), import preflight, keycode translation, `0x2A` only after the restore | Items not in the `.svil` (4.4); the other half's local settings |
| K17 | **The D39 flag mishandled**: cleared too early, or confused with bit 0 | M (new code) | L-M | Explicit state machine; bit 2 tested against `StorageResetDialog` | — |
| K18 | **Keybard can't configure the new firmware** (Sval protocol bump) | L | M: configurator lockout until Keybard updates | Offer only pinned releases; `release.json` with the Sval protocol and minimum Keybard | Custom builds from file |
| K19 | **Board on non-updater firmware** (Vial, vLaunch2) | **H today** | M: no in-Keybard update; first move is manual | Guided manual install (download, BOOTSEL, copy, both halves) with an automatic `.svil` export; optional File System Access write to `RPI-RP2` (untested) | Still manual once per board |
| K20 | **Non-16 MiB flash or settings-write failure latched** | L | L: UNAVAILABLE at INFO or ARM | Read INFO flags first; manual path | — |
| K21 | **User can't make the chord** in 30 s (missing switch, a mobility limit, a remapped layout) | L-M | L: NOT_CONFIRMED; retry | Matrix-level, so remaps don't matter; LED feedback; Keybard shows the two keys on its own key map; retry is cheap | No alternative approval method |
| K22 | **GitHub API rate limit or outage**, offline | M (shared NAT) | L | With option A, no runtime API call is needed; the API only for "check for newer" | — |
| K23 | **A release asset re-uploaded** under the same name after pinning | L | L: refuse on hash mismatch | Pin per file; refuse and point to the release page | — |
| K24 | **The post-COMMIT probe reads "unconfirmed"** every time (plan:224) | H | L: false alarms if the UI trusts it | Decide by INFO and presence after the reboot, as `sval_update.py` does (sval_update.py:683-718) | — |
| K25 | **Old Keybard after the update**: a cached tab, or a Keybard before vLaunch2.3 can't talk to 64-byte firmware | L | L | Production is vLaunch2.4; reload the tab after an update | Users on self-hosted old copies |
| K26 | **Windows driver install delay** on a new PID | M | L: a few seconds of "not found" | Wait up to 30 s with a visible state | — |
| K27 | **The held second approval** (F-N3): the USB half keeps an approval for its own file while the other half updates | L | L: a hostile HID client can start, stall or ABORT the approved file, never a different one | Bound by SHA-512 and client ID; used once; cleared by ABORT, any error, a reset, another client, or a time window (1.4) | A stall or ABORT leaves mixed halves (K6), fixed by `Finish update` with its own chord |

---

## 6. Recommendations

1. **Bytes: bundle into Keybard's deploy (option A).**
   - The deploy workflow fetches the release's `.svup` and `.uf2`, checks them against the release API's `digest` and `check_release_assets.py`, and serves them same-origin.
   - Production and firmware already move together by launch tag. No CORS, no new service, no runtime network lookup. This matches today's "baked into the build".
   - Keep option E (file picker) for custom builds and Paranoid.
2. **Trust: pin per Keybard build.** A `firmware-releases.ts` holds tag, fw_version, the sites that carry it, hand, PID, and SHA-256 per file. The deploy fails on a mismatch, and Keybard refuses bytes that don't match. Production pins its vLaunch and the one before it. next.keybard adds the newest vNext. User-chosen files take the same install path (3.4).
3. **Firmware: add `release.json` to release CI**, so Keybard stops guessing PID, Sval protocol and minimum Keybard.
4. **Flow:** port `sval_update.py`'s `pair`, with one chord for both halves (F-N3).
   - Both halves by default; the other half first; both images checked against both halves first, then approved together.
   - REBIND after each renewal; no silent re-bootstrap.
   - Wake Lock, a Web Lock across tabs, Host asked to disconnect.
   - Measure WebHID round trips in the first M4 commit.
5. **Settings:** the automatic `.svil` export as a `pre-update` snapshot plus a downloaded file, checked before ARM, with a warning if it fails. Every install backs up and acts on the choice made before flashing: put the layout back (the default) or start from defaults. Send `0x2A` last (4.3). Verify what isn't in the `.svil` (4.4) before shipping.
6. **Show the split state:** read STATUS presence and INFO bit5. Show "halves on different firmware" with a one-click fix. This is useful even without an update in progress, and closes the "silent half" gap.
7. **First migration (vLaunch2, Vial or vNext1 to the first release with F-N2 and F-N3):** guided manual flow. Export the layout, download both `.uf2` from Keybard's own copy, show BOOTSEL steps for each half, then restore. It's the last manual install.
8. **Add a developer-only chord skip (round 2, Q10; design in 1.4).** Three gates keep it out of release builds: `rules.mk`, the `#error` guard, and release CI's ELF and `.svup` lints. Keybard reads it from INFO.
9. **Revisit signing** before Keybard ever offers firmware it didn't pin (a runtime "latest" lookup). Until then, pinning makes it unnecessary for the normal path.

---

## 7. Decisions

Round 1 asked Q1-Q17. The owner answered them on 2026-10-14, and settled round 2's N2 the
same day. The "Decision" column records each answer, paraphrased. Round 2's open questions follow the table.

| # | Question | Decision |
|---|---|---|
| Q1 | Where do the firmware bytes come from? | **Bundled** in Keybard's deploy (option A) |
| Q2 | Pinned releases only, or whatever GitHub calls latest? | **Pinned**, and Keybard also installs a firmware file the user chooses. Both go through one path, merged with Q11 (3.4; update-flow 3.3) |
| Q3 | On next.keybard, is a new vNext pinned by PR or fetched at deploy time? | **By PR** |
| Q4 | Does Keybard ever ask GitHub at runtime whether newer firmware exists? | **Open**, restated plainly as N1 below |
| Q5 | Channels | **Decided by the design (round 2).** There's no channel setting. Each site offers the releases its deploy carries. Example: keybard.svalboard.com lists `vLaunch4` and `vLaunch3`; next.keybard.svalboard.com lists `vNext2`, `vLaunch4` and `vLaunch3`. Releases without F-N2 and F-N3 (vLaunch2, vNext1) are never listed (3.1, 3.4; update-flow 3.2) |
| Q6 | Reinstall keeps settings, downgrade resets them? | **Neither distinction.** Every install backs up first and puts the layout back after: update, reinstall and downgrade alike (4.1) |
| Q7 | Restore by default, or ask first? | **Choose before flashing.** The sheet holds the restore choice, and then the update runs to the end with no prompts except the one chord at the start (4.3; update-flow 4-5) |
| Q8 | If the backup fails: warn and allow, or stop? | **Warn and allow** |
| Q9 | Both halves always, or one half alone? | **Both by default; one half under Advanced** |
| Q10 | A chord skip for dev builds? | **Yes for developer builds; never for release builds.** Three gates enforce it: `rules.mk`, an `#error` guard, and release CI. Design and risk in 1.4 (F-N1) |
| Q11 | Install from a local file? | **Yes, with the D33 warnings**, merged with Q2 |
| Q12 | Paranoid | **File picker, matched against pinned hashes** |
| Q13 | Ship M4 unsigned, relying on pinning? | **Yes**; signing comes before any unpinned install |
| Q14 | Keybard asks Keybard Host to disconnect? | **Yes** |
| Q15 | `release.json` in firmware release CI? | **Yes** |
| Q16 | First migration: guided copy, plus a File System Access prototype? | **Guided copy; prototype separately** |
| Q17 | Show "halves on different firmware" now? | **Yes** |
| N2 | One chord for both halves? | **Yes, decided by the owner in round 2.** A full update asks for the chord exactly once, at the start, on the half with USB. ARM carries both manifest hashes (F-N3, required), and the update then runs to the end with no human step (1.4) |

**Firmware additions these decisions need**

| # | Addition | Why |
|---|---|---|
| F-N1 | `SVAL_UPDATE_NO_CHORD`: a developer-only build option with a build-info flag and an INFO flag bit, refused in release builds at three gates (1.4) | Q10 |
| F-N2 | **Required.** A Sval op that resets stored settings through the D39 path, on both halves | "Start from defaults" on an identical-build reinstall, which today keeps settings (4.3) |
| F-N3 | **Required.** One chord approves both halves: ARM carries both manifest hashes, and the USB half's own install needs no second chord (1.4) | N2, decided |

The Keybard flow needs F-N2 and F-N3 in the firmware the board runs, so they ship together in the first release Keybard installs, and boards reach it by one manual install. F-N1 is a developer-build option and isn't needed for releases.

**Open questions for the owner (round 2)**

| # | Question | Recommendation |
|---|---|---|
| N1 (was Q4) | While Keybard is open, should it ask GitHub whether there's firmware newer than the files it carries? The answer would only show a "newer firmware exists" note; Keybard would never install from it. **Yes:** users hear about a release before their Keybard site carries it. But every check sends the user's IP address to GitHub, and the note points at a Keybard that may not exist yet. **No:** Keybard knows only what it carries, and new firmware appears when the site redeploys. | **No.** Production and its firmware ship together under one launch tag, so the stable site never lags its own release |
