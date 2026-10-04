# Keybard Context — Windows layer-switching draft

This first draft selects an **existing keyboard layer when an application gains focus**. It supports native Windows apps by executable name and Onshape in Chrome through an optional browser extension. You configure the layer's keys in Keybard; this companion only chooses when the layer applies.

It starts **paused**, including after restoring a saved configuration. Tap-dance variants are deferred. There is no automatic flashing, cloud dependency, or input hook.

## Run on Windows

Extract the supplied `KeybardContext-Windows.zip`, keep the entire `KeybardContext` folder together, and launch `KeybardContext.exe`. The package is experimental and unsigned. `build-info.json` identifies the build; `SHA256SUMS` provides the packaged checksums.

For a hardware-free preview, run:

```powershell
.\KeybardContext.exe --demo
```

The demo simulates a keyboard and offers Desktop / Onshape / Other Chrome tab focus. Its example Onshape rule uses layer 1 only as a simulation. The sample configuration is cleared before connecting real hardware; an explicitly opened configuration is retained.

For a source checkout with Python 3.12:

```powershell
cd companion
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m context_companion --demo
# Real hardware, still paused until you enable it:
.venv\Scripts\python -m context_companion
```

## Matching PMW3389 firmware

The companion requires the **context-layer firmware draft**, whose source branch is `feat/context-layers` in the Sval QMK repository. An ordinary firmware build, or the earlier tap-dance draft, does not provide this layer protocol. The app probes support and refuses incompatible firmware.

For your PMW3389 hardware, use the matching board-side artifacts:

- `svalboard_trackball_pmw3389_left_sval.uf2`
- `svalboard_trackball_pmw3389_right_sval.uf2`

Export your current layout through Keybard first. Flash the correct file to each corresponding side using the normal Svalboard procedure. Do not substitute a generic, PMW3360, or trackpoint build. The companion never flashes the keyboard.

Close Keybard/Vial device connections before connecting this draft. It serializes its own HID operations but does not coordinate other applications' device connections. Use one companion instance per keyboard.

## Try Onshape in Chrome

1. In Keybard, identify an existing layer you want to use for Onshape. Layer indices are **zero-based**. Choose the actual index in your layout; do not assume layer 1 is appropriate. Create/configure a layer in Keybard if needed.
2. Launch the companion. Select the real keyboard and click **Connect**. It checks layer support and remains paused.
3. Keep **Default → Onboard / manual** for the initial trial. This removes the app's temporary layer when no rule matches.
4. Click **Add app**, name it Onshape, use `chrome.exe`, leave the origin as `https://cad.onshape.com` (or your actual HTTPS Onshape origin), and choose your existing Onshape layer. Check **Rule enabled**, then click **Apply rule / default**. New rules are disabled until you do this.
5. Pair the extension using the instructions below.
6. Click **Enable app switching**, then focus the Onshape tab. The status should acknowledge the Onshape context and your chosen layer. Test a harmless key first in a disposable document.
7. Switch to a different Chrome tab, then a native app. The status should return to Default / Onboard. Return to Onshape and confirm it selects the layer again.
8. While Onshape is selected, hold one of your existing manual momentary-layer keys. Its non-base manual layer should take precedence; releasing it should expose the Onshape layer again.
9. Hold an ordinary keyboard key while switching context with the mouse. Verify release is handled correctly and no key remains held. This needs a physical test; automated simulation does not establish it.
10. Test **Pause app switching**, which clears only the app contribution. After re-enabling, use Task Manager to end the companion and confirm the app contribution disappears within about five seconds without further control traffic.
11. **Save config** when satisfied. On the next launch, the last opened/saved file is restored, but connection and enabling remain explicit.

No real hardware trial or interactive Windows/Chrome validation is claimed by these instructions. They describe the checks to perform on your setup.

## Pair the Chrome extension

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select the supplied `browser-extension` folder.
3. In the companion, click **Copy pairing token**. Click the extension's toolbar icon to open its options, paste the token, and choose **Save and test connection**.
4. Reload already-open Onshape tabs. Keep both the Onshape tab and its browser window focused.

The extension sends only the HTTPS Onshape origin, focus, browser identity, and sequence/timing metadata to `127.0.0.1:19732`. It sends no document names, full document URLs, model contents, or keystrokes. Requests use a locally stored random pairing token. Incognito is excluded. Edge is also supported using `msedge.exe` and `edge://extensions`; Chrome is the primary trial path.

Only Onshape website matching is implemented. Leave the origin field empty to match an entire app, such as a CAD executable, video editor, or game. Recognizing an app does not detect its editing mode, focused text field, game chat, or other internal state. An Onshape rule also applies while typing into Onshape's fields.

Browser signals expire after 2.5 seconds without a fresh observation and must match the foreground browser window. Browser and operating-system focus updates cannot be atomic, so rapid tab/window/profile changes can briefly retain the previous context.

## Controls and layer behavior

| Control | Effect |
|---|---|
| Enable app switching | Start evaluating ordered app rules. |
| Pause app switching | Stop following apps and remove the host layer contribution. |
| Pin selected app layer | Keep that app's selected layer across focus changes. |
| Use default | Keep the configured Default behavior until Follow apps or Pin. |
| Follow apps | Release Pin/Use default and resume rule matching while enabled. |
| Default: Onboard / manual | No host layer when no rule matches. |
| Default: numbered layer | Select that layer when no rule matches. |

The first enabled matching rule wins. Edits become active while enabled; pause before editing if you want to finish configuration first. Saving persists the file, not an enabled state. Closing exits the companion and attempts to clear its layer contribution.

Firmware keeps host context separate from manual layer state. Active **manual non-base layers take precedence**, followed by the app layer, then the normal base/default layers. Transparent keys fall through. Manual layer priority does not depend on whether its index is higher than the app layer. Layer 0 and firmware default layers are treated as base layers.

The companion displays the app layer separately. Keyboard RGB layer indicators, ordinary Keybard active-layer display, and existing layer hooks/constraints still see manual state only. A physical `TO(base)` changes manual state but does not clear the app contribution; use Pause to clear it.

A context switch selects existing assignments without rewriting the saved keymap, saved tap-dance definitions, or calibration. Ordinary held-key releases use QMK's existing source-layer cache; this draft requires normal release behavior, not strict layer release. The app renews a five-second firmware lease. On crash or loss of USB control traffic, lease expiry removes only the host contribution, preserving manual/base state.

This is a layer selector, not a layout editor. Rules refer to numeric layer indices: recheck them after changing your keyboard layout. Tray startup, automatic reconnect, general website matching, and per-app tap-dance variants are deferred.

## Build and validate

Run `./build-windows.ps1` in PowerShell with Python 3.12 available. It runs tests, exercises the native demo UI, builds with PyInstaller, tests the packaged executable, and creates the ZIP. The UI smoke test checks paused connection, automatic Onshape selection, pinning, returning to default, and pausing; callback or worker failures fail the test.

```sh
cd companion
python -m unittest discover -s tests -v
node --test browser-extension/tests/*.test.cjs
```

Fake-HID and simulated UI tests establish software behavior. They do not establish correctness of a physical PMW3389 keyboard, every Windows foreground transition, or browser timing under real workloads.
