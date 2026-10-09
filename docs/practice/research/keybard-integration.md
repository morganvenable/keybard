# Keybard integration map for a keybr-style trainer

Snapshot: `svalboard/keybard` main @61db58a (`scratchpad/src/keybard-main`). Paths below are relative to that root unless prefixed `qmk:` (= read-only `GitHub/svalboard-qmk` @7d7143498c, 2026-10-06). Line numbers are from the snapshot. Anything not verified is marked UNVERIFIED.

---

## 0. Headline findings

1. **Today's Trainer is a keymap-reference overlay, not a typing trainer.** It renders the board's resolved legends (live layer) as an SVG, mainly to drive Keybard Host's always-on-top desktop overlay. Its only "practice" is self-graded flash-card recall ("Remembered"/"Again"); it explicitly records nothing from typing (`src/features/trainer/TrainerPage.tsx:132`).
2. **Firmware has no key-event stream.** Apps poll. Physical key state is only available as a level snapshot of the debounced switch matrix (VIA `id_switch_matrix_state`), so a short tap can fall between polls (`qmk:keyboards/svalboard/docs/protocol.md:26`). No timestamps, no press/release events, no keycode, no "which layer produced this" from firmware.
3. **The typed character must therefore come from browser `keydown`/`keyup`** (as keybr does). Matrix + layer-state polling can only *supplement* it (which physical key / finger / layer was used), with tens-of-ms granularity.
4. **The browser can poll matrix and layer state itself over WebHID, without Keybard Host**: `keyboardService.pollMatrix` (`src/services/keyboard.service.ts:469-500`) and `getLayerStateMasks` (`:515-519`); `KeyboardContext` already polls layer state every 120 ms (`src/contexts/KeyboardContext.tsx:409-436`). The Host path is only needed while the user types in *other* apps (overlay), not for an in-Keybard practice page.
5. **Reverse mapping "character → binding" does not exist yet.** Keybard has keycode→label (`getLabelForKeycode`, `src/components/Keyboards/layouts.ts:449`) and keymap layer resolution (`resolveBinding`, `src/features/trainer/core.ts:40-49`); a trainer needs to invert these into "char → [layer, physical key, required mods/hold keys]" paths.
6. **Paranoid constraints**: no fetch, **`worker-src 'none'`** (no Web Workers), single inlined file (`build/paranoid.ts:37-53`). Word lists/language models must be bundled (virtual-module pattern exists: `build/paranoid.ts:16-34`). Paranoid also promises matrix reads only while Matrix Tester / Scan Lab are open (`docs/paranoid.md:16,46`) — a trainer reading the matrix changes that promise and the doc.

---

## 1. The Trainer today (`src/features/trainer/**`, 570 lines)

### Files
| File | Lines | Role |
|---|---|---|
| `TrainerPage.tsx` | 137 | The in-app page: preview canvas + inspector tabs |
| `OverlaySurface.tsx` | 48 | Pure SVG keyboard renderer shared by page and desktop overlay |
| `useSurfaceKeys.ts` | 45 | `surfaceKeys()`: board + layer masks → positioned, labelled keys |
| `core.ts` | 63 | Preferences/presets, `resolveBinding`, `geometry`, `haloColor` |
| `host.ts` | 154 | `useHost()` client for Keybard Host HTTP API; `notifyHostLayoutChanged()` |
| `HostOverlay.tsx` | 31 | Root component rendered inside the Host's transparent Qt webview |
| `HostInstall.tsx` | 33 | "Use Trainer on your desktop" install card, version notice |
| `trainer.css` | 59 | All styling (plain CSS, hard-coded hex + manual `.dark` overrides) |

### Routing / mounting
- Sidebar entry `{ title: "Trainer", url: "trainer", icon: GraduationCapIcon }` in the "layout" group next to Layouts (`src/layout/Sidebar.tsx:85-88`). Trainer and Matrix Tester are special-cased as **full-workspace panels** that close the details sidebar instead of opening it (`src/layout/Sidebar.tsx:188-197`; `src/contexts/PanelsContext.tsx:49-57`).
- Deep link: `#trainer` hash opens it on load (`src/contexts/PanelsContext.tsx:35`). There is no router; "panels" are an `activePanel` string in `PanelsContext`, and App-level "pages" are a tiny `NavigationContext` (`src/App.tsx:24-65`: `main | explore | proof-sheet`).
- `EditorLayout` mounts `TrainerPage` lazily on first visit and then **keeps it mounted, hidden** (`hidden={!isTrainer}`), passing `active={isTrainer}`; entering the trainer calls `clearSelection()` and hides the details sidebar/bottom panel (`src/layout/EditorLayout.tsx:1086-1089,1126-1127,1214-1218`). Consequence: any practice mode must gate listeners/timers on `active`.
- Separate entry point for the desktop overlay: `?hostOverlay` query renders `<HostOverlay/>` instead of `<App/>` (`src/main.tsx:10`); the Host loads `http://127.0.0.1:<port>/?hostOverlay=1` (`companion/overlay-host/keybard_host/__main__.py:66`).

### UX (TrainerPage)
- Header "Trainer" with green graduation-cap icon (`TrainerPage.tsx:108`).
- If no Host: `HostInstall` card (download, "Connect to Keybard Host") or a Paranoid note (`:110`).
- Two-column workspace: stage (left) + 336 px inspector (right), collapsing to one column under 700 px container width (`trainer.css:1,19-20`).
- Stage: optional Host toolbar (device select, show/hide overlay) (`:112`); preview card with `OverlaySurface` on a Light/Dark/Busy fake-desktop background (`:114-117`); "Layout source" select: Live board (Host) / Loaded snapshot / Editor draft / QWERTY example / Imported file (`:118`); default-layer and preview-layer selects when not following live (`:119`).
- Inspector tabs **Overlay / Appearance / Feedback / Practice** (`:123-132`):
  - Appearance: preset (Dark, Subtle, Outline only, Light, High contrast — `core.ts:10-17`), fill/outline/legend color+alpha, width, halo, layer-change + pressed accents.
  - Overlay (Host): drag by keys, place, reload, disconnect; hands Both/Left/Right; scale 50–150 %.
  - Feedback: layer-change highlight Off/Quick flash/Short fade + duration; "Highlight held keys" (turns on Host matrix polling) (`:131`).
  - Practice: "Recall practice" — shows target binding label, Reveal, then self-grade Remembered/Again with a counter; "Familiar bindings" can hide legends of keys you mark familiar (`:132`). All of this is session state, reset whenever the board changes (`:47`). Note text: "Self-assessed practice. Nothing is recorded from your typing."
- While following the Host, hidden/target keys are pushed to the Host every 1 s via `op: 'practice'` so the desktop overlay hides legends too (`:87-92`); the Host expires them after 2.5 s (`__main__.py:407-408`).

### State and persistence
- Local React state only; no context/store. Preferences persisted to `localStorage['keybard.trainer.v1']` with a validating parser `preferences()` (`core.ts:20-39`, `TrainerPage.tsx:18,46`). Note: this uses raw `localStorage`, **not** the namespaced `appStorage` (`src/utils/app-storage.ts:3-15`), which `host.ts:14` does use.
- When a Host is connected, preferences are mirrored to Host config with optimistic revisioning (debounced 160 ms, `TrainerPage.tsx:48-57`; Host validation `companion/overlay-host/keybard_host/state.py:14-44`).

### How it renders the keyboard
- `geometry(board)` (`core.ts:50-59`): uses `board.keylayout` (fragment-composed) or falls back to `SVALBOARD_LAYOUT`; id = `row*cols+col`; hand = `row < 5 ? 'Left' : 'Right'`.
- `resolveBinding(keymap, index, active, defaults)` (`core.ts:40-49`): walks layers 31→0 over `active|default` mask, skipping `KC_TRNS` (code 1) — QMK's transparency semantics.
- `surfaceKeys()` (`useSurfaceKeys.ts:7-45`): stringify keycode → label via international layout → legend parts (`getKeyDisplayText`, `getKeyLabel`), live Shift/Caps casing from Host modifiers, device-supplied labels for TD/custom keycodes.
- `OverlaySurface` (`OverlaySurface.tsx:7-33`): plain `<svg>` at 40 px/unit, `<rect rx=6>` per key; stroke switches to `pressed` color for held keys, `changed` color for the recall target; legend via `foreignObject` with Keybard's `getHeaderIcons/getCenterContent/getTypeIcon` (`src/utils/key-icons`). Colors are **user appearance hex values, not theme tokens** (intentional: they stand in for a desktop overlay; see comment `trainer.css:40`).

### Tests
`tests/trainer/{core,host-install,host-refresh,host-remote,labels,live-legends}.test.ts(x)`, `tests/host-native-state.test.tsx`; `tests/components/EditorLayout.guides.test.tsx:34` mocks `TrainerPage`.

---

## 2. Live key data path

### 2a. Firmware (svalboard/qmk)
- Transport: 32-byte Raw HID reports, usage page 0xFF61 / usage 0x62, wrapped `[0xDD][client_id:4][0xDF Sval | 0xFE VIA][payload]`; client IDs are leases (~2 min) that separate replies but don't lock (`qmk:keyboards/svalboard/docs/protocol.md:13-22`; `companion/overlay-host/keybard_host/device/protocol.py:10,105-119`).
- **No push events**: "Apps poll for state; there is no push stream of key events, so a very short tap can fall between two polls." and no layout-change notification (`qmk:keyboards/svalboard/docs/protocol.md:26-27`).
- Matrix read = VIA `GET_KEYBOARD_VALUE (0x02)` / `id_switch_matrix_state (0x03)` with a row offset; returns `matrix_get_row()` bytes, one byte per row for 6 columns (`qmk:quantum/via.c:364-390`). Svalboard builds with `VIA_INSECURE = yes` (`qmk:keyboards/svalboard/rules.mk:43`), so **any connected page/app can read held keys without unlock**. Whether `matrix_get_row` is pre- or post-debounce on Svalboard's custom matrix: UNVERIFIED (stock QMK returns the debounced matrix).
- Layer state = Sval `0xDF 0x16 LAYER_STATE_GET`: 32-bit active mask, plus 32-bit default mask when feature flag `1<<6` is set (`src/services/keyboard.service.ts:515-519`; `protocol.py:12,173-177`). Format doc: `qmk:modules/svalboard/core/docs/LAYER_STATE_PROTOCOL.md` (not read).
- **What a "key report" contains, in full**: a set of held matrix positions (row 0–9, col 0–5) at the moment of the poll. No keycode, no layer, no timestamp, no press/release edge, no tap-dance/combo/mod-tap resolution, no OS-level character. Edges and timing must be inferred by the client from successive samples.

### 2b. In-browser WebHID (Keybard itself)
- `SvilUSB` owns the `HIDDevice`, serializes requests through a promise queue with 1 s timeout per command, validates wrapper/client ID (`src/services/usb.service.ts:700-760`, listener `:632-642`). Command IDs: VIA `0x02` + `VIA_SWITCH_MATRIX_STATE=0x03` (`:157,172`), Sval `CMD_SVIL_LAYER_STATE_GET=0x16` (`:203`).
- `keyboardService.pollMatrix(kbinfo)` → `boolean[rows][cols]` (`src/services/keyboard.service.ts:469-500`), exposed as `useKeyboard().pollMatrix` (`src/contexts/KeyboardContext.tsx:402-406`). Matrix Tester polls it every **50 ms** (`src/components/MatrixTester.tsx:13,77-137`), only when `!(PARANOID && !userIsLooking())` (`:86`).
- Layer polling: `KeyboardContext` polls `getLayerIndexes` every **120 ms** and exposes `activeLayerIndex`/`defaultLayerIndex` (indices, not masks) (`src/contexts/KeyboardContext.tsx:409-436`). The trainer would want masks (`getLayerStateMasks`) for correct transparency resolution.
- Latency: one request/response round-trip over full-speed USB HID; Keybard has no measurement in-tree. Expect a few ms per poll and that matrix and layer reads share the single queue with editor writes (UNVERIFIED numbers). Practical sampling rate in the browser: ~5–20 ms (UNVERIFIED; must be measured). A 30 ms tap is plausible to miss at 50 ms.

### 2c. Keybard Host (companion/overlay-host)
- **Read-only allowlist**: Sval `0x00,0x01,0x0D,0x0E,0x16,0x18,0x19,0x1B`, VIA `0x02` (matrix row 0 only), `0x11`, `0x12` (`keybard_host/device/protocol.py:14-17,121-126`). No setter is expressible.
- Device worker loop: each cycle reads layer snapshot then, if press tracking is enabled, the matrix; target cycle **8 ms** (`keybard_host/device/worker.py:96-109`). Matrix → `frozenset((row,col))` (`protocol.py:179-187`). Press tracking is off unless config `highlightPressed` is on (`state.py:11`; `__main__.py:340`).
- Host state: `pressed = [row*6+col …]`, dropped if the sample is >0.5 s old and cleared after 0.5 s without a sample (`__main__.py:383-391,401-408`). Snapshot fields: `active`, `default`, `valid`, `pressed`, `modifiers {shift,capsLock}` (OS-level, read every 16 ms via `GetAsyncKeyState` etc., `modifiers.py:1-31`, `__main__.py:260`), `board` (serialized profile incl. `trainerLabels`), practice fields (`state.py:99-113`). **No timestamps and no event history in the snapshot** — it is a latest-value state.
- Delivery: to the native overlay window by `runJavaScript` dispatching `keybard-host-state` CustomEvents on every change (`__main__.py:280-292`); to browser pages by **HTTP long-ish polling** `GET /api/host/state` every response+80 ms with a 1.2 s staleness watchdog (`src/features/trainer/host.ts:46,62-71`). There is no WebSocket. Effective browser-side latency for a held key ≈ 8 ms sample + ≤80 ms poll + request time — fine for highlighting, too coarse for keystroke timing.
- **Origin gate**: `REMOTE_ORIGINS = {https://keybard.svalboard.com, https://next.keybard.svalboard.com}` (`keybard_host/server.py:26-31`); `Host` header must be `127.0.0.1:<port>`/`localhost:<port>` (DNS-rebinding guard, `server.py:70-79`); CORS + Private-Network-Access only for `/api/host/*` from those origins (`server.py:82-101`); every POST needs the per-session `X-Keybard-Token` from `/api/host/bootstrap` (`server.py:117,139-141`). Extra origins only via `--allow-origin` CLI (testing) (`__main__.py:484`); paranoid mode accepts **no** remote origin (`__main__.py:225`). Commands allowed: `show, arrange, place, connect, disconnect, reload, refresh, scan, practice` (`server.py:153`); `practice` validates `hidden` ≤60 ints and `target` (`server.py:156-159`). So the test site (`morganvenable.github.io/keybard-test`) cannot reach a stock Host — trainer features that depend on Host must be testable via the local Host-served Keybard or `--allow-origin`.
- The browser client only connects remotely after an explicit user click (loopback probe can trigger a permission prompt) and remembers that choice (`host.ts:7-14,39,90`); never in Paranoid unless served by the Host.
- No firmware-side origin gating exists (UNVERIFIED beyond `VIA_INSECURE`); gating is only in the Host and in Keybard's own code.

### 2d. Implication for a typing trainer
| Signal | Source | Granularity | Use |
|---|---|---|---|
| Typed character, `key`, `code`, `repeat`, timestamps (`event.timeStamp`) | DOM `keydown`/`keyup`/`beforeinput` in the Keybard tab | per event, sub-ms | **Primary** input for accuracy/WPM (keybr model) |
| Held physical keys | WebHID matrix poll (in-tab) or Host `pressed` | 5–50 ms (browser, UNVERIFIED) / 8 ms + 80 ms (Host) | Attribute keystroke → physical key/finger; detect wrong-key-right-char; heatmaps |
| Active/default layer | WebHID 0x16 (in-tab, KeyboardContext already polls at 120 ms) or Host | 120 ms / ~8 ms+80 ms | Show which layer the user is on; teach layer paths |
| Shift / Caps | DOM event modifiers (in-tab) / Host `modifiers` | per event | Case and shifted-symbol expectations |

Polling the matrix while the user types competes with nothing else in the trainer, but a trainer must stop polling when `active` is false and must honor `PARANOID && !userIsLooking()`.

---

## 3. How Keybard models the keyboard

- **`KeyboardInfo`** (`src/types/keyboard.types.ts:4-67`): `rows`, `cols`, `keymap: number[][]` (layer → flat `row*cols+col` array of 16-bit QMK keycodes), `combos`, `tapdances`, `key_overrides`, `alt_repeat_keys`, `leaders`, `one_shot`, `macros`, `custom_keycodes`, `keylayout` (fragment geometry), `cosmetic.layer` names, `layer_colors`, `keycode_version`, feature flags.
- **Geometry**: `SVALBOARD_LAYOUT` (`src/constants/svalboard-layout.ts:17-92`), matrix 10×6 (`:95-96`). Rows: 0 = left thumb (6 keys), 1–4 = left index, middle, ring, pinky; 5 = right thumb (6 keys); 6–9 = right index…pinky. Finger rows use cols 0–4: col2 = center, col3 = north (y−1), col0 = south (y+1), col1 = +x, col4 = −x in screen space (so col1 is *inward* on the left hand and *outward* on the right; e.g. left index G at `:12` vs right index `'` at `:72`). Col 5 is unused on finger rows in this fallback; fragment layouts (`board.keylayout`, `src/components/Keyboard.tsx:91-104`) can differ. Thumb cluster labels ("Outer Top", "Middle", …) in `src/constants/keyboard-visuals.ts:37-51`. Default example layout: `src/default-layouts/sval-default.svil`.
- **Keycode stringification**: `keyService.stringify(number) → "KC_A" | "LT3(KC_F24)" | "TD(4)"…`, `parse`, `canonical`, `parseDesc` (`src/services/key.service.ts:106-260`). Note `generateAllKeycodes(kbinfo)` **mutates global KEYMAP/CODEMAP** for custom keycodes (`:22-60`) — a trainer working on a non-active board (example/import) inherits whatever board last ran it.
- **Key contents / behavior typing**: `getKeyContents(kbinfo, keystr)` classifies into `modtap`, `user`, `OSM`, `layer`, `tapdance`, `layerhold`, `macro`, `modmask`, `other` (`src/utils/keys.ts:167-380`); `getKeyLabel` (`src/utils/layers.ts:63-95`); `getKeyDisplayText` (`src/utils/key-display.ts:4`); modifier decomposition `decomposeKeycode`, `MOD_TAP_MAP`, `MASK_TO_MODIFIERS` (`src/utils/modifierUtils.ts:8-101`).
- **OS layout (what character a keycode produces)**: `LAYOUTS` for us/uk/german/french/spanish/italian/br/danish/swiss/arabic/russian (others are empty stubs) as default+shift rows (`src/components/Keyboards/layouts.ts:8-238`), `LAYOUT_KEY_MAPS` per-locale char→KC overrides (`:337-438`), `US_SHIFT_ALIASES` (`:440-447`), `getLabelForKeycode(keycode, layoutId)` (`:449-527`). User's choice lives in `LayoutSettingsContext.internationalLayout` (`src/contexts/LayoutSettingsContext.tsx:18,44`). Browser-side `KEYBOARD_EVENT_MAP` maps `KeyboardEvent.code → KC_*` assuming US positions (`src/utils/keyboard-mapper.ts:3`).
- **Combos/tap dance/overrides**: combos are keyed by **keycode strings**, not positions: `ComboEntry { keys: string[]; output: string; options }` (`keyboard.types.ts:134-139`) — mapping a combo to physical keys requires resolving which positions currently emit those keycodes on the active layer. Tap dance `{tap, hold, doubletap, taphold, tapping_term}` (`:147-155`); key overrides `{trigger, replacement, layers, trigger_mods, …}` (`:157-166`); alt-repeat and leaders exist (`:215-248`).
- **Consequence for "how do I type X"**: a character can be produced by (a) plain key on default layer; (b) key on a layer reached via MO/LT/TG/OSL hold key(s) (find them with `getKeyContents` type `layer`/`layerhold`); (c) `LSFT(...)`-style modmask or OS Shift; (d) mod-tap hold side; (e) tap-dance tap/double-tap; (f) combo output; (g) key override replacement; (h) macro text. Path enumeration = BFS over layers from the default mask using layer-activating keys, then reverse-lookup char via the international layout. Nothing like this exists yet; `resolveBinding` is the forward half.

---

## 4. App architecture relevant to a trainer

- **Providers** (`src/App.tsx:108-130`): Keyboard → Settings → Changes → Backup → KeyBinding → LayoutLibrary → Navigation; `LayoutSettingsProvider`/`DragProvider` wrap editor views (the `Key` component needs `useLayoutSettings` and `useKeyDrag`, `src/components/Key.tsx:61-73`).
- **Panels**: `PanelsContext.activePanel` string; full-workspace panels are `matrixtester` and `trainer` (`src/contexts/PanelsContext.tsx:50,54`).
- **Global key handlers to respect** (all yield to `isEditorInput`, i.e. focused `input, textarea, select, button, a, [contenteditable]…`, `src/utils/editor-input.ts:2-6`): "typing binds key" assigns keycodes when a key is selected (`src/contexts/KeyBindingContext.tsx:721-804`; neutralised because entering Trainer clears selection, `EditorLayout.tsx:1089`); Ctrl/Cmd+V layer paste (`EditorLayout.tsx:979-993`); Ctrl/Cmd+B sidebar toggle (`src/components/ui/sidebar.tsx:23,235-242`); Delete/Backspace on a selected key (`src/components/Keyboard.tsx:375-393`). A practice surface should capture input in a focused text field (as keybr does) so these yield, and `preventDefault` browser shortcuts deliberately.
- **Persistence**: `appStorage` = `localStorage` with optional `VITE_STORAGE_NAMESPACE` prefix so github.io previews don't clash (`src/utils/app-storage.ts:1-15`) — use it for trainer stats. IndexedDB is used only by backups (`src/services/backup/store.ts`). keybr's result history could go in IndexedDB (a new store) or `appStorage` if compact.
- **Theming**: tokens in `src/index.css:43-65` (`kb-gray, kb-surface, kb-ink, kb-active, kb-key-border, kb-gray-border`, brand `kb-primary/green #099e7c, kb-blue, kb-purple, kb-orange, kb-yellow, kb-red …`), light `:root` `:68-110`, dark `.dark` `:114-157`, `@custom-variant dark (&:is(.dark *))` `:4`. `tests/theme/no-hardcoded-chrome-colors.test.ts:1-23` scans **string literals and JSX attributes in `src/**/*.tsx`** for `bg-white`, `text-black`, `bg-[#hex]`, gray/slate utilities without `dark:` pairs, and SVG `fill="black"`-style attributes; exemptions in `tests/theme/allowlist.ts`. It does not scan `.css` files, which is how `trainer.css` gets away with hex colors + hand-written `.dark` overrides (`trainer.css:40-59`). New trainer UI should use Tailwind tokens (`bg-kb-surface`, `text-kb-ink`, `border-kb-gray-border`) rather than extend that CSS.
- **UI kit**: shadcn-style `@/components/ui/{button,switch,…}`, Radix, `lucide-react` icons (`package.json:53-70`), React 19, Vite 7, Tailwind 4.1, Vitest 3 + jsdom (`vitest.config.ts:9-12`, setup `tests/setup.ts`; coverage thresholds only on four services, `:16-27`).
- **Paranoid** (`docs/paranoid.md`, `build/paranoid.ts`): single inlined HTML; CSP `default-src 'none'`, hashed scripts, `connect-src 'self' data: blob:`, `worker-src 'none'`, `font-src data:` (`build/paranoid.ts:37-53`); build fails on any external URL reference (`:58-129`, `docs/paranoid.md:58`). Data that is fetched normally must be compiled in via a virtual module (pattern: `virtual:bundled-layers`, `build/paranoid.ts:12-34`, consumer `src/services/layer-library.service.ts:2,35`). Background board reads only while `userIsLooking()` (`src/lib/paranoid.ts`; used `KeyboardContext.tsx:415`, `MatrixTester.tsx:86`). Implications: bundle word lists/n-gram models (size matters — whole app is one file); no Web Workers (keybr's generators must run on the main thread); no remote fonts; update `docs/paranoid.md:16,46` if the trainer polls the matrix.

---

## 5. Integration seams

**Where a practice mode plugs in**
1. **As a fifth inspector tab or a stage mode inside `TrainerPage`** — e.g. a top-level segmented control "Reference | Practice" in the trainer header that swaps the stage between today's preview and a typing surface. `TrainerPage` already owns board source selection, layer state and the keyboard SVG; `active` prop already exists for gating listeners. The 137-line one-liner-heavy file should be split first (state hook + stage components).
2. Alternatively a new sidebar entry/full-workspace panel (add to `Sidebar.tsx:85-88` and the `matrixtester||trainer` special-cases in `Sidebar.tsx:188` and `PanelsContext.tsx:50,54`). Less desirable: duplicates board-source and host plumbing.
3. Hash deep link: extend `PanelsContext.tsx:35` (e.g. `#trainer/practice`).

**Directly reusable**
- `geometry`, `resolveBinding`, `surfaceKeys` (finger/hand from row; labels per OS layout) — `core.ts`, `useSurfaceKeys.ts`.
- `OverlaySurface` for an SVG keyboard with held/target/hidden states (needs token-based colors for in-app use rather than overlay presets; it already accepts an `Appearance` object, so an in-app "theme" appearance can be derived from CSS variables).
- Alternatively Keybard's editor `Key` component (as used by Matrix Tester with `selected`/`layerColor`, `MatrixTester.tsx:157-184`) for visual parity with the editor; the full `Keyboard` component is coupled to KeyBinding/Panels/Changes contexts (`src/components/Keyboard.tsx:60-104`) and is not a good fit.
- `useKeyboard()` → `keyboard`, `originalKeyboard`, `isConnected`, `pollMatrix`, `activeLayerIndex` (`KeyboardContext.tsx:48,402-436`); `keyboardService.getLayerStateMasks`.
- `useHost()` → `state.pressed`, `active/default`, `modifiers`, `board` for Host-backed sessions; `op:'practice'` to hide legends / highlight the target on the desktop overlay (could highlight the *next key to type* while practicing in another app — but `target` is a single key id and expires after 2.5 s).
- `getLabelForKeycode` + `LAYOUTS`/`LAYOUT_KEY_MAPS` → invert to char→keycode(+shift) per OS layout.
- `appStorage` for settings/stats; virtual-module pattern for bundled corpora; `fileService.parseContent` + `sval-default.svil` sample for an offline example board.

**New pieces needed (not in Keybard)**
- keybr core (text generation by letter frequency/phonetic model, per-key speed/confidence, lesson unlock, results) — port from `keybr-upstream`/`svalbr` (license allowed per owner).
- Char→binding path solver (layers, hold keys, mods, combos, TD, overrides) — see §3.
- Matrix sampler with edge detection + correlation of DOM keystrokes to physical positions (accepting ±1 poll of skew) and a clear "precision" disclaimer.
- Host API additions if desktop-wide practice is wanted (UNVERIFIED need): event history or higher-rate push instead of 80 ms polling; would require a Host release under the shared launch tag.

**Constraints checklist for the spec**
- Must work with no board connected (example/imported layout; DOM keystrokes only).
- Must not write to the board; Host stays read-only.
- Paranoid: bundled corpora, no workers, matrix polling only while visible+focused and doc update.
- Theme: tokens/Tailwind in `.tsx`; theme test must pass; dark mode via `.dark`.
- Remote Host only from the two exact origins; test site cannot use Host without `--allow-origin`.
- Hidden-but-mounted page: stop polling/listeners when `active` is false.
