# Keybard Host — Windows preview

A Svalboard desktop learning overlay, configured through Keybard's Trainer panel. This preview is a portable ZIP for Windows 10/11 x64, not a signed installer.

## Start here

1. Download **KeybardHost-Windows.zip** and extract the entire ZIP to a folder you want to keep.
2. Open the extracted **KeybardHost** folder and run **Start-Windows.cmd**. First launch downloads a pinned, private Python/Qt runtime, so keep the internet connection available. No system Python, administrator access or PATH changes are required.
3. The app opens local Keybard in your browser. Use **Connect Keyboard**, then select **Trainer** below **Layouts**. Use Chrome or Edge for WebHID.
4. Configure the overlay in Trainer. Keybard Host stays in the system tray; closing the browser leaves the overlay running. Use the tray menu to reopen Keybard or quit.

## Use it from keybard.svalboard.com

With Keybard Host running, open **Trainer** on [keybard.svalboard.com](https://keybard.svalboard.com) and click **Connect to Keybard Host**. If Chrome or Edge asks to let the site access apps and services on this device, allow it. The page then controls the overlay just like the local copy, and reconnects automatically on later visits. The host accepts this site only, and every change still needs the host's per-session token.

You can also open [local Keybard](http://127.0.0.1:5178/), the copy served by Keybard Host itself.

## Paranoid mode (new in preview 3)

For a Keybard that cannot reach the network at all:

- **Start-Paranoid.cmd** runs Keybard Host in paranoid mode. It serves Keybard Paranoid, a single-file build of Keybard with a no-network security policy, and accepts no website, keybard.svalboard.com included. It opens Keybard in a separate Chrome or Edge profile behind a dead proxy, so only services on your own machine are reachable. The Trainer and overlay work as usual.
- **Open-Paranoid.cmd** opens `keybard-paranoid.html` on its own in the same contained profile, for editing without the Host.
- Keybard Paranoid reads the board's active layer, and the Matrix Tester reads key presses, only while you're looking at Keybard. Keybard Host itself reads the board continuously so the overlay works while you type elsewhere; key presses only if you turn on held-key highlighting. See `docs/paranoid.md` in the source for exactly what is and isn't protected.

## New in preview 2

- Use Trainer from keybard.svalboard.com, as above.
- The bundled Keybard includes dark mode: Settings → General → Appearance (System, Light or Dark).

## Included

- Loads your board's layout and remembers the selected Svalboard.
- Follows active layers; automatic default layers require firmware that advertises that capability. Older firmware retains manual default selection.
- Shares Keybard's command icons and symbol legends. Shift and Caps Lock update native character legends; function-key names stay uppercase.
- Transparent, draggable overlay with color, outline, opacity and halo controls. A small interactive grip/menu remains available in click-through mode.
- Configurable layer-change highlights and optional held-key highlights, plus recall practice.

## Limits and updates

- The companion's board operations are read-only; it does not flash firmware. Layout editing in Keybard remains separate. Reload the companion layout after editing the board.
- First launch downloads substantial Qt WebEngine dependencies. Windows may show its normal warning for an unsigned download; only run a package from this release page that you trust. This preview is not code-signed.
- Matrix highlighting and automatic default layers depend on firmware support. Some firmware one-shot modifiers become visible only when sent to the OS.
- This release distributes Windows only. macOS remains untested; Wayland has compositor and global-modifier limitations.
- To update, quit Keybard Host from the tray, extract the newer release into a new folder, then launch it. Your preferences live separately in your user application-data directory. There is no automatic updater yet.

`SHA256SUMS.txt` records the ZIP checksum. The corresponding tag contains the source used to build this package.
