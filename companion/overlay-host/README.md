# Keybard Host

Keybard Host shows your Svalboard layout as a transparent overlay on your desktop. It follows the layer you're on, so you can glance at it while you type in any app. It runs in the system tray and only reads from the keyboard: it never changes your layout or flashes firmware.

You choose what the overlay looks like in the **Trainer** panel of [Keybard](https://keybard.svalboard.com).

## Install (Windows)

1. Download `KeybardHost-Windows.zip` from [Releases](https://github.com/svalboard/keybard/releases) and extract the whole ZIP to a folder you'll keep.
2. Run `Start-Windows.cmd`. The first launch downloads its own copy of Python and Qt, so you need to be online. No admin rights or system changes are needed.

Keybard Host is now in your system tray.

## Set up the overlay

1. Open [keybard.svalboard.com](https://keybard.svalboard.com) in Chrome or Edge and connect your keyboard.
2. Open **Trainer** and click **Connect to Keybard Host**. If the browser asks whether the site can access apps on this device, allow it. Next time it reconnects on its own.
3. Pick the board to show, if you have more than one, and set the overlay's colors, size and other options. They're saved on this computer.

Keybard Host also opens its own built-in copy of Keybard in your browser when it starts (`http://127.0.0.1:5178/`). Setting up the overlay works the same in either one.

## Using it

- **Place it:** the overlay starts out draggable. Once it's where you want it, turn on **Click through keyboard** in Trainer or in the overlay's small menu. The grip next to the overlay stays clickable either way.
- **Tray menu:** show or hide the overlay, drag or place it at the bottom of the screen, reload the layout, open Keybard, or quit. Closing the browser leaves the overlay running.
- **After you edit your layout**, choose **Reload layout** from the tray so the overlay shows the change.
- **Held keys:** optionally highlight the keys you're holding. Very short taps can be missed.
- **Shift and Caps Lock** change the letters and symbols shown, using the keyboard language chosen in Keybard. This doesn't work on Wayland.

## What it doesn't do

Keybard Host never writes to the keyboard, flashes firmware or records what you type. Its control page listens only on your own computer. It takes commands only from its built-in Keybard and from keybard.svalboard.com, and each change needs a per-session token.

## Updating

Quit Keybard Host from the tray, extract the new release to a new folder, and run `Start-Windows.cmd` there. Your settings are kept, because they're stored in your user profile rather than in the app folder.

## Paranoid mode

Paranoid mode is a separate way to run Keybard Host, for people who want Keybard to have no network access at all. `Start-Paranoid.cmd` starts the Host with Keybard Paranoid, a single-file build of Keybard that can't reach the network. It ignores all websites, keybard.svalboard.com included, and opens Keybard in a separate browser profile that can only reach your own computer. `Open-Paranoid.cmd` opens Keybard Paranoid on its own, without the overlay. See `docs/paranoid.md` for exactly what it protects.

## Linux and macOS

Linux: copy the web build to `companion/overlay-host/web`, then run `bash companion/overlay-host/start-linux.sh`. It needs the usual Qt desktop libraries. On Wayland, placement, stacking and click-through depend on the compositor. macOS hasn't been tested.

## For developers

### Build

From the repository root:

```sh
npm ci
VITE_BASE_PATH=/ npm run build
python3 companion/overlay-host/scripts/package.py
```

This makes `dist/KeybardHost-Windows.zip`, a local test build. It isn't signed, and it doesn't include downloaded runtimes or anyone's settings.

### Test

```sh
npm test
PYTHONPATH=companion/overlay-host python3 -m unittest discover -s companion/overlay-host/tests -v
```

These don't cover moving the window, focus, click-through, fullscreen, or live layer and held-key changes on real hardware. Check those by hand.

### Publish a Windows preview

1. Update `RELEASE-NOTES.md`.
2. Run the tests above and a Windows smoke test.
3. Build with `npm run build:svalboard`, then run `python3 companion/overlay-host/scripts/package.py`.
4. In `dist`, run `sha256sum KeybardHost-Windows.zip > SHA256SUMS.txt`.
5. Tag the commit `keybard-host-vX.Y.Z-preview.N` and publish a GitHub prerelease with the ZIP and the checksum.
6. Point `HOST_RELEASE` in `src/features/trainer/HostInstall.tsx` at the new release, so Trainer's install link finds it. Link the tag itself, not GitHub's `latest` redirect, which skips prereleases.

Instead of steps 3–5, you can run the **Package Keybard Host preview** workflow with an existing tag. It builds a draft prerelease with both files; test the ZIP before you publish it.
