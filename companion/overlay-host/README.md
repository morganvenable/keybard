# Keybard Host — native tray preview

A per-user, read-only Svalboard companion. The desktop overlay is the same React/SVG renderer as Keybard's Trainer preview, hosted in a transparent Qt WebEngine window. The existing Sval Trainer and Windows context companion are unchanged.

## Windows

Run `Start-Windows.cmd`. First launch downloads a separate, pinned Python/Qt runtime into this directory; no admin rights, PATH changes, or persistent PowerShell changes. The WebEngine dependency makes this preview substantially larger than a future optimized native shell. Settings live in Qt's per-user `Keybard Host` application-data directory, not the source checkout. The Svalboard mark identifies the tray icon and application.

The tray offers Open Keybard, Show overlay, Drag to reposition, Place at bottom, Reload layout, and Quit. Closing the browser keeps the host and overlay running. Quit through the tray to stop it. A second launch opens the existing control page instead of starting another device worker.

Open **http://127.0.0.1:5178/** in a WebHID-capable browser and use Keybard’s normal Connect Keyboard flow. Then select Trainer below Layouts. Pick the intended overlay board in Trainer when multiple devices are attached. Successful connections remember serial and definition UID; reconnect never substitutes an unrelated board. The host reads geometry, all keymap layers, and labels. Automatic defaults are used only when firmware advertises support; older firmware retains a manual default selector. Held-key highlighting is opt-in, performs read-only matrix queries, and may miss short taps.

Dragging starts on and stays on until you explicitly enable Click through keyboard in the Overlay tab or the overlay menu. The small grip/menu beside the overlay stays clickable in either mode; drag the grip to reposition it, or use its menu to hide the overlay and open Keybard. Restore a hidden overlay from the tray or Keybard. Colors, opacity, outline, halo, hands, scale, and transition timing are saved on this computer and apply to the native overlay. Recall/familiar-key masking is transient; when the web controls disappear its lease expires and the desktop returns to reference mode. Offline/imported previews do not replace the board's live layout.

Keybard retains its original WebHID connection and editor transport. The companion is a separate read-only client using the firmware’s multi-client protocol. The browser does not substitute an offline snapshot for a connection. Reload the companion layout after changing the device keymap.

No keyboard writes, flashing, app-context layer switching, or key logging. Desktop controls communicate only with this host's loopback server. POST operations require its token, exact local Origin/Host, bounded JSON, command allowlisting, and revision checks for persistent configuration.

## Building

From the Keybard repository root:

```sh
npm ci
VITE_BASE_PATH=/ npm run build
python3 companion/overlay-host/scripts/package.py
```

This creates `dist/KeybardHost-Windows.zip` with the web build, source runner, startup/bootstrap scripts, and pinned runtime manifest. Runtime downloads and user preferences are excluded. The ZIP is a local test distribution, not a signed installer.

For Ubuntu/X11/Wayland investigation, copy `dist` web assets to `companion/overlay-host/web`, then run `bash companion/overlay-host/start-linux.sh`. Qt WebEngine needs the normal desktop system libraries. Wayland stacking/placement/click-through are compositor-dependent and unverified; this is not a layer-shell implementation. macOS is unverified.

## Validation

```sh
npm test
PYTHONPATH=companion/overlay-host python3 -m unittest discover -s companion/overlay-host/tests -v
```

The read-only reader and worker originated in Sval Trainer commit `7bfef64`; the companion polling loop now targets an 8 ms cycle, with protocol/definition regression coverage. They are deliberately isolated from the existing context companion's write-capable protocol. Native window movement, focus/click-through, fullscreen, and hardware layer/held-key transitions still need interactive host acceptance.

### Live legends and command icons

The native overlay uses Keybard's layer, tap dance, macro, mouse and other action icons, with separate hold/tap labels. Control names use readable casing (Escape, Delete, Shift, Control, Alt, Caps). Appearance colors and opacity also apply to the icons.

Shift and Caps Lock update character legends from local host modifier flags, sampled every 16 ms and delivered directly to the native renderer. Letters use Shift XOR Caps Lock; Shift changes punctuation using the keyboard language selected in Keybard. A modifier assigned to a mod-tap hold does not shift its tap legend by itself. Browser previews and unavailable modifier sources retain static uppercase keycaps.

Windows uses User32 key flags, macOS uses CoreGraphics session flags, and Linux X11 uses XKB state. Wayland currently retains static legends: XWayland state cannot faithfully represent modifiers in other Wayland applications. These flags describe the host's combined keyboard state, not a guessed Svalboard matrix state. Pending firmware one-shot modifiers and application-specific text transformations are not visible before the firmware sends them to the host. No input is captured or injected, and no firmware update is needed.
