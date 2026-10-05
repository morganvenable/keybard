# Keybard Host — Windows preview

A Svalboard desktop learning overlay, configured through Keybard's Trainer panel. This preview is a portable ZIP for Windows 10/11 x64, not a signed installer.

## Start here

1. Download **KeybardHost-Windows.zip** and extract the entire ZIP to a folder you want to keep.
2. Open the extracted **KeybardHost** folder and run **Start-Windows.cmd**. First launch downloads a pinned, private Python/Qt runtime, so keep the internet connection available. No system Python, administrator access or PATH changes are required.
3. The app opens local Keybard in your browser. Use **Connect Keyboard**, then select **Trainer** below **Layouts**. Use Chrome or Edge for WebHID.
4. Configure the overlay in Trainer. Keybard Host stays in the system tray; closing the browser leaves the overlay running. Use the tray menu to reopen Keybard or quit.

Already running? Open [local Keybard](http://127.0.0.1:5178/). A hosted Keybard page does not automatically access the local companion; its install prompt links to this local control page.

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
