# Keybard Host — Windows preview

Keybard Host shows your Svalboard layout as a transparent overlay on your desktop. It follows the layer you're on, so you can glance at it while you type in any app. You set it up in the **Trainer** panel of [Keybard](https://keybard.svalboard.com).

This preview is a portable ZIP for 64-bit Windows 10 and 11, not a signed installer.

## New in this preview

- **The overlay keeps up with your edits.** When Keybard saves a change to the keyboard, the overlay updates about a second later, without going blank. Before, you had to choose **Reload layout** from the tray.
- **The bundled Keybard is current:** it can reorder layers by dragging their tabs, shows and sets the default layer, and warns when the keyboard couldn't save a setting.
- **Shows which version you have.** Trainer says which Keybard Host is connected and which Keybard it bundles, and points to a newer release when there is one. The tray icon's tooltip shows the same.
- **Made for Svalboard firmware vLaunch2.** It works with older firmware too, but moving or setting the default layer needs vLaunch2.

## Get started

1. Download **KeybardHost-Windows.zip** and extract the whole ZIP to a folder you'll keep.
2. Run **Start-Windows.cmd**. The first launch downloads its own copy of Python and Qt, so you need to be online. No admin rights or system changes are needed. Keybard Host then sits in your system tray and opens Trainer on [keybard.svalboard.com](https://keybard.svalboard.com).
3. In Trainer (Chrome or Edge), connect your keyboard and click **Connect to Keybard Host**. If the browser asks whether the site can access apps on this device, allow it.
4. Set up the overlay in Trainer. Use the tray icon to show, move or hide it, or to quit.

## What it does

- Shows your board's layout and follows your active layer, and your default layer on firmware that reports it.
- Keeps up with edits: when Keybard saves a change to the keyboard, the overlay re-reads the layout by itself, showing the old one until the new one is read.
- Uses Keybard's key icons. Shift and Caps Lock change the letters shown.
- Stays on top, can be dragged into place, and lets clicks pass through once it's placed.
- Adjustable color, outline, opacity and halo.
- Highlights layer changes and, optionally, the keys you're holding. Includes recall practice.

## Paranoid mode

Paranoid mode is a separate way to run Keybard Host, for people who want Keybard to have no network access at all.

- **Start-Paranoid.cmd** starts the Host with Keybard Paranoid, a single-file build of Keybard that can't reach the network. It ignores all websites, keybard.svalboard.com included, and opens Keybard in a separate browser profile that can only reach your own computer. The overlay works as usual.
- **Open-Paranoid.cmd** opens Keybard Paranoid on its own, without the overlay.

`docs/paranoid.md` in the source explains exactly what it protects.

## Limits

- **Read-only:** Keybard Host never changes your layout or flashes firmware. After you edit your layout, choose **Reload layout** from the tray.
- **Unsigned:** Windows may warn you about it. Only run a ZIP you downloaded from this release page.
- **Windows only for now:** macOS is untested, and Wayland has limits.
- **No automatic updates:** to update, quit from the tray, extract the new release to a new folder, and run it. Your settings carry over.

`SHA256SUMS.txt` has the ZIP's checksum.
