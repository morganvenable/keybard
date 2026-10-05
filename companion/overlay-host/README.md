# Keybard Host — native tray preview

A per-user, read-only Svalboard companion. The desktop overlay is the same React/SVG renderer as Keybard's Trainer preview, hosted in a transparent Qt WebEngine window. The existing Sval Trainer and Windows context companion are unchanged.

## Windows

Run `Start-Windows.cmd`. First launch downloads a separate, pinned Python/Qt runtime into this directory; no admin rights, PATH changes, or persistent PowerShell changes. The WebEngine dependency makes this preview substantially larger than a future optimized native shell. Settings live in Qt's per-user `Keybard Host` application-data directory, not the source checkout. The Svalboard mark identifies the tray icon and application.

The tray offers Open Keybard, Show overlay, Arrange overlay, Place at bottom, Reload layout, and Quit. Closing the browser keeps the host and overlay running. Quit through the tray to stop it. A second launch opens the existing control page instead of starting another device worker.

Open **http://127.0.0.1:5178/#trainer**. Pick the intended board when multiple devices are attached. Successful connections remember serial and definition UID; reconnect never substitutes an unrelated board. The host reads geometry, all keymap layers, and labels. Automatic defaults are used only when firmware advertises support; older firmware retains a manual default selector. Held-key highlighting is opt-in, performs read-only matrix queries, and may miss short taps.

Arrange starts on; use Finish arranging or the tray toggle for click-through. Colors, opacity, outline, halo, hands, scale, and transition timing are saved on this computer and apply to the native overlay. Recall/familiar-key masking is transient; when the web controls disappear its lease expires and the desktop returns to reference mode. Offline/imported previews do not replace the board's live layout.

**Current boundary:** the host owns the board connection; the hosted page blocks a competing direct WebHID connection. Editing through the host is not implemented. Disconnect the host before editing in ordinary Keybard, then reconnect/reload the host. The browser-only Keybard development server remains available independently.

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

The read-only reader and worker are carried from Sval Trainer commit `7bfef64` into `keybard_host/device` unchanged, with protocol/definition regression coverage. They are deliberately isolated from the existing context companion's write-capable protocol. Native window movement, focus/click-through, fullscreen, and hardware layer/held-key transitions still need interactive host acceptance.
