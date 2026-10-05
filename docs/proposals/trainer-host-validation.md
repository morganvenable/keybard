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

## Shared Keybard workspace follow-up

Trainer now renders inside the editor's existing SidebarProvider, PanelsProvider, and layout providers, using the real AppSidebar with its selected-item indicator. The separate logo/back-button header is removed. Navigation between Trainer and the editor retains the loaded Vial layout and panel context. Sidebar icons have accessible names when collapsed, and a navigation trigger is available on mobile.

Validated the production build, all 422 Vitest tests, and browser navigation from Trainer to the QWERTY editor and back twice with the loaded snapshot retained. Browser checks also verified 1024×768, 760×650, and 480×700 without horizontal overflow, recall practice, and the simulated-host configuration/stale-state/independent-renderer checks. This changes web controls only; the native overlay remains keyboard-only.
