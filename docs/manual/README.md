# Keybard launch user manual

Open [index.html](index.html), or serve this directory with `python3 -m http.server 5190 --directory docs/manual` from the repository root. The manual needs no JavaScript framework, package install, external font, or network connection to read. All essential instructions remain visible without JavaScript; search, image enlargement and recording playback are enhancements. Use Print / Save as PDF for a paper copy.

## Scope and product baseline

Launch Keybard `6d9bd1f` and Svalboard-QMK launch notes at firmware `9331eacc46`. This is an end-user walkthrough, not a claim that every firmware control, sensor, migration path or native platform has been hardware-validated.

The guide covers first-time offline exploration, a safe first connected edit, migration from supported Vial firmware, returning users, layers, behavior authoring/assignment, pointing, settings/diagnostics, files/library/printing, and the read-only Trainer companion. It distinguishes board state, pending draft state and exported files throughout.

## Planned process

1. Read production sources and map three golden paths: new/offline, new/connected, and existing/returning.
2. Independently audit workflow semantics and feature coverage before drafting.
3. Capture actual application screens using the bundled QWERTY example; use explicitly identified controlled fixtures where a connected state is needed. Do not access physical boards or include personal layouts or internal board names.
4. Write a progressive walkthrough, followed by practical reference material and recovery guidance.
5. Cross-review chapters against the source, then run a separate adversarial usability/accessibility review.
6. Correct findings, check links/assets/search/navigation/illustrations at desktop and mobile sizes, verify print output, and record limitations.

## Sources and important verified distinctions

| Area | Primary source |
| --- | --- |
| Connection, reconnection, target changes | `src/contexts/KeyboardContext.tsx` |
| Live defaults and typing assignment | `src/contexts/SettingsContext.tsx`, `src/contexts/KeyBindingContext.tsx` |
| Actual toolbar labels and export dialog | `src/layout/LayerSelector.tsx` |
| Save queue, retry and partial writes | `src/contexts/ChangesContext.tsx` |
| Import limits and retained fields | `src/services/import-preflight.ts`, `src/services/import.service.ts` |
| Backup formats | `src/services/file.service.ts` |
| Local layer library | `src/layout/SecondarySidebar/Panels/LayoutsPanel.tsx` |
| Behavior workflows | `src/layout/SecondarySidebar/components/BindingEditor/` and `Panels/` |
| Immediate board identity operations | `src/layout/SecondarySidebar/Panels/BoardIdentitySection.tsx` |
| Physical matrix display | `src/components/MatrixTester.tsx` |
| Trainer and native overlay | `src/features/trainer/`, `companion/overlay-host/README.md` |
| Firmware migration and limitations | [Firmware launch notes](https://github.com/svalboard/qmk/blob/svalboard/keyboards/svalboard/docs/release/launch.md) |

## Adversarial review record

Two independent source auditors mapped the journeys and feature workflows. They drafted separate chapters, then cross-reviewed each other's material. A third reviewer inspected the assembled page in a browser at desktop and mobile sizes. The following findings changed the manual:

- Corrected stale Update/Revert wording to current Apply N Changes and Discard pending edits.
- Made Live Updating and Typing Binds a Key defaults explicit before the first connected experiment.
- Explained that switching to Live applies the queue and that ordinary typing with a selected target can reassign it.
- Corrected the export format label to `.svil (Recommended)`.
- Separated first-boot firmware migration from blocked direct legacy-file import.
- Replaced unsafe “reconnect and Retry” guidance: export a retained draft before reconnecting, because reconnection rereads the board and may discard pending edits.
- Distinguished the local library's Import from the toolbar's Import Layout; documented retained fields and capacity checks.
- Corrected immediate board-name button to Save now.
- Added Matrix Tester and printing walkthroughs; made clear neither is a restorable backup or resolved-output trace.
- Added intrinsic screenshot dimensions to prevent image loading from moving deep-linked chapters.
- Added a full-resolution image link for small screens and focus transfer after mobile navigation.

No physical board was modified to create this manual. Browser validation is not a substitute for firmware or native desktop hardware acceptance testing. Capture metadata and automated manual checks live under `evidence/`.

## Maintenance

Edit `content/start.html` and `content/features.html`, then run:

```sh
python3 docs/manual/tools/build.py
```

`index.html` is committed so the manual can be opened directly. The builder uses only the Python standard library. Capture scripts require Playwright and a Chromium installation; adjust their environment/path settings for your machine. Screenshot captions distinguish offline examples and simulated connected/native state. Re-run `tools/validate.py` after changes to content, images or navigation.

Capture scripts use Playwright’s installed Chromium by default; set `CHROMIUM_PATH` to use another executable, `KEYBARD_CAPTURE_URL` for the running Keybard development server (default port 5188), and `MANUAL_URL` for the manual server (default port 5190). With Playwright installed, run captures in this order: `capture.py`, `capture-editors.py`, `capture-files.py`, `capture-connected.py`, `capture-native.py`. Then rebuild and validate. Connected captures block physical HID access and inject controlled device responses.

Final acceptance passed at widths 360, 390, 768, 1280 and 1600 pixels, including search, mobile navigation, layer comparison, image enlargement, keyboard focus, stable deep links, local links, JavaScript-disabled reading and PDF generation. All eleven chapters remain readable without JavaScript. The independent usability re-review found no remaining material blocker.

## Action demonstrations

`tools/capture-actions.py` uses Playwright and Pillow to record real mouse and typing interactions in the bundled offline example. It verifies the dropped key's keycode, the macro text and the downloaded backup JSON. The export capture disables the native save-picker API to exercise the real browser-download fallback; it does not mock file contents. GIFs show the actual application; an orange pointer ring is a recording aid. No hardware is accessed. `evidence/actions.json` records results and timing. Run with the same browser environment as the other capture scripts.

The manual replaces three overview images with explicit Play/Stop demonstrations: dragging A onto Q, creating a text macro, and exporting a backup. They autoplay only while visible; Pause remains in effect when scrolling away and back. Autoplay remains enabled with reduced motion, as explicitly requested; individual Pause controls remain available. GIFs are the default HTML source, including without JavaScript. Print uses stills when JavaScript is enabled. Direct GIF links are provided.

The expanded recordings cover the worked browser tutorials throughout the manual. Run `capture-walkthroughs.py` and `capture-extra.py` (optionally passing individual case names), plus `capture-overlay-action.py`. `action_recorder.py` provides pointer movement and GIF encoding; `connected-fixture.js` supplies controlled board responses and blocks real USB commands. Each recording has an outcome assertion and an evidence file. The native renderer demonstration uses controlled reports and is explicitly not a Windows desktop or timing test. Native OS device/file choosers, installing/running Windows software, physical key presses and firmware upgrades are outside browser capture; their instructions remain written, with those boundaries called out.

Recording the actual workflows corrected the mod-tap and layer-tap instructions: assignment can clear the target selection, so reselect before composing. The Transparent/Blank example now compares the same A position in two cases with explicit output, rather than requiring readers to operate an unexplained three-key schematic.

Expanded acceptance: all 34 GIFs decode completely. Browser checks pass at five widths, including every Play/Pause control, viewport autoplay, persistent user pause, reduced-motion preference changes and the two-case layer comparison. The regenerated PDF has 44 pages and uses stills.

Autoplay correction: GIF URLs are now present directly in the HTML, and playback no longer depends on the system motion preference. JavaScript pauses offscreen recordings and honors individual Pause controls. Content-hashed script/style URLs prevent older cached playback code from surviving a page refresh.
