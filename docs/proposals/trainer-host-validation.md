# Trainer/host implementation validation — 2026-10-05

Branch: `feat/trainer-workspace`, based on Keybard `origin/main` e7e9f3d plus the isolated architecture/mockup commits. Existing Sval Trainer and context companion implementations were not modified.

Implemented a native Qt/Python tray host for this first runnable increment, retaining the proven read-only reader/worker from Sval Trainer. This is an implementation choice for rapid native validation; the long-term framework choice in the architecture proposal remains open. All keyboard rendering is React/SVG shared by Keybard and the resident webview.

- Production TypeScript/Vite build passes. Existing bundle-size and mixed static/dynamic import warnings remain.
- All 422 Keybard Vitest tests pass, including 4 new shared trainer resolver/preferences/geometry tests.
- All 27 host tests pass on Linux and native Windows: protocol/definition regressions, configuration bounds/persistence/revisions, deep-copy isolation, local API authorization, rejected origins/tokens/unsupported commands, and static host-mode injection.
- Browser checks exercised presets, opacity, recall/reveal/scoring, tabs, and no horizontal page overflow at 1024×768, 760×650, and 480×700.
- A simulated host using a real read-only board snapshot verified configuration acknowledgement, identical renderer appearance, practice relay, stale clearing/recovery, and overlay visibility without changing the user's running host preferences.
- The native Windows host enumerated both `52 1BTU Right` and `FlipFET Left Mule`. It read all 16 layers of the main board and reported valid live state. That board did not advertise default-layer reporting; manual fallback was retained. No firmware or keyboard writes were performed.
- Restarted the companion and confirmed automatic reconnect to the remembered main board. Windows Qt WebEngine rendered both the actual host-served Trainer controls and the independent keyboard-only overlay entry; there were no logged JavaScript errors.
- The native runtime, preferences, and packaged assets are local to the new Windows companion preview. A Svalboard-logo desktop shortcut was created. No runtime or preferences were copied from the existing trainer.

Not established by these checks: physical layer/held-key transitions under typing load, interactive click-through/focus acceptance, native mouse dragging across mixed-DPI monitors for this webview implementation, fullscreen behavior, Ubuntu desktop compositor behavior, or macOS support. Browser screenshots are not evidence for native input pass-through. The underlying reader's prior tests cover protocol behavior but do not replace these host acceptance checks.

Current limits: desktop editing through the host is not implemented, and old-firmware defaults remain manual. Recall practice is controlled from the web page and reverts to reference after its short heartbeat expires. Installed runtime download is relatively large because this preview includes Qt WebEngine. The test ZIP is unsigned and bootstraps pinned native dependencies on first run.

## Panel integration correction

Trainer is a single left-navigation option backed by the existing PanelsContext, like Matrix Tester. It does not have an App navigation route. ConnectKeyboard is restored exactly to origin/main, without Trainer links, host notices, or editing instructions. The native host's direct /#trainer entry initializes the panel; normal landing-page behavior is unchanged.

The existing editor and Trainer remain mounted during panel switches. Trainer retains its tab, imported preview, and practice state; its practice heartbeat stops while inactive. Other sidebar selections use their original panel behavior and never navigate to the connection screen. The keyboard-only native overlay is unchanged.

Regression checks cover landing content in host mode and Trainer session preservation. Browser validation clicked all 15 existing sidebar destinations and returned to Trainer, both with an editor layout loaded and through the direct host entry without one. No uncaught JavaScript errors or unexpected landing navigation occurred. Responsive checks at 1024×768, 760×650, and 480×700 found no horizontal Trainer overflow.

## Host landing connection

The existing Connect Keyboard button and remembered-device list now use a host connection adapter on the host-served origin. They load a fresh layout from the selected board, or explicitly connect the chosen enumerated device and await its layout. Browser-only WebHID behavior is unchanged. Host snapshots remain read-only: they do not mark the USB transport connected or enable device writes. Optional tap-dance definitions can be absent without crashing the editor.

Verified the attached main board reports 16 layers and that its actual snapshot loads through Connect Keyboard and opens Trainer with 52 keys. Adapter tests cover selected-board reuse, enumeration, ambiguous selection, switching boards, unreachable hosts, and omitted tap-dance metadata.

Native Windows Qt WebEngine then exercised the actual server (no API mocks): Connect Keyboard loaded the live main-board snapshot, and clicking Trainer rendered 52 keys for `52 1BTU Right`. Production build and all 430 tests passed.

## Simplified Trainer controls

Removed Hide preview, decorative headings/subtitles, routine host status, saved confirmations, raw layer masks, and nonzero-layer dots. Trainer is below Layouts. Dragging remains the default; Click through keyboard is an explicit opt-in. A separate 58×24 native grip/menu window remains interactive while the keyboard window passes input through. Its menu hides the overlay, opens Keybard, or toggles click-through. Hiding also hides the grip; restore from Keybard or the tray.

Build and all 430 web tests pass. All 30 companion tests pass on Windows, including three new native control tests; Ubuntu passes 27 with the three Qt WebEngine tests skipped because that runtime is unavailable there. Restarted the updated Windows companion and confirmed its remembered main board reconnects with dragging enabled. Physical mixed-DPI and compositor interaction still require manual acceptance.
