# Trainer/host implementation validation — 2026-10-05

Branch: `feat/trainer-workspace`, now based on production `svalboard/keybard` main `28aa05a`. The initial integration incorrectly used the obsolete fork main `e7e9f3d`; the production migration below supersedes that base. Existing Sval Trainer and context companion implementations were not modified.

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

## Connection flow correction

Removed the host snapshot connection adapter: it incorrectly returned success while leaving isConnected false. KeyboardContext, ConnectKeyboard, and MainScreen now match origin/main e7e9f3d exactly. A #trainer URL no longer bypasses the connection screen; it selects the panel only after a layout has loaded. The companion opens the root URL, and Trainer remains an ordinary left-panel option.

The Sval transport already supports concurrent client IDs. On Windows, a second read-only HID client loaded all 16 main-board layers and performed 100 layer queries while the companion remained valid. Queries averaged 3.0 ms, maximum 4.7 ms. This validates concurrent HID clients, not a browser chooser interaction. Regression tests confirm host-served pages use the original USB transport and report isConnected true, and a Trainer hash cannot bypass the landing connection flow. Production build and all 427 web tests pass.

## Simplified Trainer controls

Removed Hide preview, decorative headings/subtitles, routine host status, saved confirmations, raw layer masks, and nonzero-layer dots. Trainer is below Layouts. Dragging remains the default; Click through keyboard is an explicit opt-in. A separate 52×24 native grip/menu window remains interactive while the keyboard window passes input through. Its menu hides the overlay, opens Keybard, or toggles click-through. Hiding also hides the grip; restore from Keybard or the tray.

Build and all 430 web tests pass. All 30 companion tests pass on Windows, including three new native control tests; Ubuntu passes 27 with the three Qt WebEngine tests skipped because that runtime is unavailable there. Restarted the updated Windows companion and confirmed its remembered main board reconnects with dragging enabled. Physical mixed-DPI and compositor interaction still require manual acceptance.

## Native layer latency

Measured the original Windows overlay polling at approximately 94 ms per HTTP cycle (about 3 ms request duration), in addition to the worker's 40 ms post-read pause. Native overlays now receive changed snapshots directly through their local Qt webview, with idle heartbeats and an initial HTTP snapshot for bootstrapping/recovery. Ordinary browser previews retain their prior polling cadence. Device polling targets an 8 ms cycle including read time; slow device replies can extend it.

A temporary Windows native surface received 15 synthetic layer transitions, without any device writes. Delivery through two animation-frame callbacks averaged 17.7 ms (4.1–32.9 ms); only one initial HTTP state request occurred. This measures the local renderer path, not physical key-to-photon latency. The real host was restarted and reconnected to the main board. Regression tests cover direct native updates and layout caching without recurring native HTTP polling, immediate publishing of changed states, and idle heartbeat throttling.

## Production base correction

Merged current production `svalboard/keybard` main `28aa05a`, retaining its Sval v2/v3 support, connection-state handling, current panel layouts, and stationary sidebar icons. KeyboardContext, the protocol service, landing component, and MainScreen match production exactly. Removed the obsolete firmware guard and redirect tests inherited from the old fork. Trainer remains below Layouts with its existing state preservation and native renderer.

Production build and all 611 tests pass. Browser validation loaded the example through the standard landing page and exercised all 15 sidebar destinations, returning to Trainer with its practice state retained and no uncaught errors.

Deprecated the old fork main by archiving `e7e9f3d` at `archive/main-before-production-alignment-20261005`. GitHub prohibits force-pushes, so replacement commit `7b51ee5` merges both histories with a tree exactly matching production `28aa05a`; the atomic, exact-tip-checked push preserved branch protections. Trainer work remains isolated on its feature branch.

## Shared key-label formatting

Extracted the keyboard's text/shift/modifier display rules into `src/utils/key-display.ts`, consumed by both Key and Trainer. Native, live-browser, and offline previews now use this formatter instead of prioritizing the companion's plain-text labels. Device-only tap-dance/custom-key metadata remains a fallback where definitions are unavailable. The selected international keyboard layout is carried in host preferences so the native view uses the same symbol mapping.

All 622 web tests and 32 native Windows tests pass; production build passes. Verified the actual main-board layout in a temporary Windows native renderer: layer 0 includes `:` and layer 3 includes `!`. Synthetic view-layer selection did not write to the board. Restarted the installed companion with the new formatter and confirmed remembered-board reconnect.

## Live character legends and shared action icons (2026-10-05)

- Native character legends follow local Shift/Caps flags, without routing through the browser or changing the board. Assigned shifted symbols remain resolved through Keybard's language map; mod-tap hold modifiers are not applied to their tap character merely because they are assigned.
- Overlay key faces now render the existing Keybard SVG icons for layer actions, tap dances, macros, mouse actions, and other supported types. Layer-tap header/tap text remain separate. Icons inherit overlay colors/opacity and disappear with hidden practice legends. Unknown custom behaviors retain their device label.
- Escape, Delete, Shift, Control, Alt, Caps and other ordinary control legends use consistent casing. Modifier updates do not cancel ongoing layer-change highlights.
- Ubuntu: 646 web tests passed; production build passed; 36 native tests completed (four Qt-dependent tests skipped). Chromium exercised Shift/Caps combinations, unavailable-state fallback and shared SVG rendering.
- Windows: 36 native tests passed. Actual Qt WebEngine rendering checked `:`, `!`, lowercase, Shift uppercase and Shift+Caps lowercase using display-only snapshots. The running companion reports native modifier flags and reconnects to the remembered main board. No firmware writes, flashing or synthetic keyboard input.
- macOS reader is implemented with mocked flag tests but has not been hardware-tested. Wayland deliberately retains static uppercase rather than using incomplete XWayland state. Validate physical Shift press/release and Caps toggles while another application has focus on Windows and X11; firmware one-shot modifiers become visible only after they reach the OS.

### Short fade under Windows reduced motion

Fixed a CSS override that converted the explicitly selected opacity fade into a full-brightness flash when Windows reported reduced motion. Keep this non-spatial effect enabled when the user selects Short fade; Off remains available. Confirmed on Windows Qt WebEngine with `prefers-reduced-motion: reduce` and the existing 250 ms setting: before the fix, opacity stayed at 1 until removal; afterward it decreased through 0.53, 0.27, 0.07 to 0 across the animation. Production build and Windows package updated; no preference changes.
