# Svalbr standalone preview

Svalbr is a trainer-only entry point built from the existing Keybard Practice engine and UI. Its own sidebar offers Guided, Drill, Words, Custom, and Progress. The Keybard editor and Overlay entry point remain available through the existing build commands.

## Run locally

```powershell
cd C:\Users\morga\OneDrive\Documents\GitHub\svalbr
npm run dev:svalbr
```

Open http://127.0.0.1:5188/. For this checkout, dependencies are already available through a local junction to the Practice checkout; a fresh checkout should use `npm ci`.

Connect a Svalboard in Chrome/Edge, import a keymap, or choose the QWERTY example. Choose a starting goal and then use the sidebar to change modes. Lesson settings opens the trainer controls; Progress & data includes profiles, export, import, and reset. The keymap chooser lives at the bottom of the sidebar. The mobile navigation opens from the menu button.

## Independent release artifact

```powershell
npm run build:svalbr
npm run preview:svalbr
```

The standalone build writes `dist-svalbr/`, with its own HTML entry and title. It can be deployed independently to any static HTTPS host. It uses `/` as its default base path; set `VITE_BASE_PATH` for subdirectory hosting. Hosting has intentionally not been selected or configured yet.

`.env.svalbr` sets the `svalbr` storage namespace, separating settings and the Practice IndexedDB database from Keybard even when hosted on the same origin. No existing Keybard progress is modified or automatically migrated. To transfer progress, export from the integrated Practice UI and import in the standalone Progress & data panel. Browser storage remains origin-specific; export before moving to a new host.

The standalone entry is `src/svalbr/main.tsx`, with its shell in `SvalbrApp.tsx`. Shared components use the optional Practice presentation context. The default presentation and `npm run build` retain Keybard's integrated behavior. Display-only keycaps use `ReadOnlyKey` and the shared `KeyFace`, without loading the editor's key-binding or drag providers.

The branch is `feat/svalbr-standalone`, based on `feat/practice-trainer` at `9edd301`. The original Practice checkout is untouched. Shared engine fixes can continue to serve both apps; the standalone UI and deployment need not track Keybard releases.

## Validation and remaining checks

The standalone integration tests mount the real providers, keymap importer, key renderer, lesson engine, and IndexedDB. They exercise example loading, failed-load recovery, typing, mode changes, OS layout controls, progress/data, and routing without the editor. Existing Practice and key-renderer tests cover the shared implementation.

Real-board USB timing and browser visual checks from the Practice handoff remain relevant. The original license and attribution are retained. Before a hosted release, publish the corresponding source revision and make the source link point to that released source.


## Content-selection prototype

The standalone sidebar follows Keybr's content types: Guided, Words, Books, Custom, Source code, and Numbers, with Drill retained for physical keymap practice. Guided starts immediately; other modes show their content controls above the lesson. Changes regenerate the lesson and leave it paused for review.

- Words: common-word vocabulary size, long-word filtering, and the actual vocabulary preview. Capitals, punctuation, and repetition are available in Lesson settings.
- Books: Keybr's three English public-domain books, paragraph selection, passage preview, lowercase and letters-only controls. Uses the restored upstream BooksLesson with complete book text.
- Custom: paste/edit text, Keybr's three examples, text preview, lowercase, letters-only, and shuffle.
- Source code: Keybr's grammar generator, all 16 syntax choices, syntax-specific flags, and generated code preview. Missing keymap characters are reported.
- Numbers: the existing upstream NumbersLesson with its own Benford-frequency preference, independent of Drill scope.
- Drill: visible group, hand, layer, direction, and in-scope character controls; further controls remain in Lesson settings.

Content selections persist in the standalone settings namespace. The original integrated mode picker still offers its four established modes. The prototype is English-only; it does not claim Keybr's full multilingual content catalog or account features.

Upstream revision and adaptations are recorded in `src/features/practice/vendor/CONTENT-SOURCES.md`. Browser checks use isolated headless Chrome on the local preview; they do not open or control the hosted Keybard trainer.
