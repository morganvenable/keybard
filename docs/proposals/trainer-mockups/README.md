# Trainer interaction mockup

Open `index.html` in a browser. It is self-contained and requires no server, dependencies, network, or device access. The top strip switches between Keybard controls, the desktop overlay, and the host tray menu. The CAD workspace, board status, labels, and device events are illustrative.

Working interactions: appearance presets, color pickers, separate opacity sliders, outline thickness, halo, preview backgrounds, hands/size, show/hide, simulated layer changes and held keys, recall/reveal, inspector tabs, and drag positioning in Arrange mode. Changes are held only in this mock session. Display selection, autostart, and effect configuration illustrate controls; they do not operate on the host. Other Keybard navigation entries are visual context only.

The host scene depicts Windows. The web controls and keyboard renderer are proposed to be shared on macOS and Linux; native tray/menu placement would follow each OS. This HTML does not create a real transparent native window or establish click-through behavior.

Images:
- `01-keybard.png`: Trainer workspace with appearance inspector.
- `02-desktop.png`: Keyboard-only overlay over an illustrative CAD workspace.
- `03-host-menu.png`: Small host menu; all experience settings remain in Keybard.
- `04-compact-window.png`: Keybard mockup at 1024 × 768.

Validation: Chromium rendering and interactive smoke checks for presets, feedback, practice, visibility, arrange, and navigation. No JavaScript errors; no horizontal page overflow at 1280×800, 1024×768, 760×650, and 480×700. Production applications and device operations are unchanged.
