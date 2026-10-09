# Keybard visual language

How Keybard looks, written down so new Trainer screens look native. Source: snapshot of `svalboard/keybard` main @61db58a (`src/keybard-main`). Paths are relative to that root, with line numbers. Things I could not confirm from code are marked **UNVERIFIED**.

Companion files:
- `keybard-tokens.css`: the tokens, verbatim, for static mockups.
- `svalboard-geometry.json`: key positions as Keybard renders them.

---

## 0. Ground rules

1. **Tailwind v4 + shadcn/ui ("new-york", base color slate, CSS variables)** (`components.json:3-11`). Radix primitives, `lucide-react` icons (`components.json:12`, `package.json:53-70`). `tailwind.config.ts` is a v3 leftover that nothing loads: `components.json:7` sets `"config": ""` and `src/index.css` has no `@config`. Ignore it.
2. **Theme switch = `dark` class on `<html>`** (`src/lib/theme.ts:46-49`, `src/index.css:4` `@custom-variant dark (&:is(.dark *))`). The default is **light**. The app follows the OS only when Appearance is set to System (`src/lib/theme.ts:16-17`, `src/index.html:12-28`).
3. **Chrome uses tokens. Key data never does.** (README.md:144-150, enforced by `tests/theme/no-hardcoded-chrome-colors.test.ts:9-22`.) Chrome may not use `bg-white`, `text-black`, `border-black|white`, `fill-black`, `ring-black` or `bg-[#hex]`. Any `gray-*`/`slate-*` utility needs a `dark:` partner on the same property in the same string literal. Layer colors, key faces and key header strips look the same in both themes.
4. **Titles carry the meaning.** This is a product-voice rule: if a field or step title isn't enough on its own, the design has failed. Inline explanatory paragraphs are a failure signal. Design rationale belongs in specs, never on screens. A legally or materially necessary disclosure survives, compressed to a line. Teaching uses progressive disclosure (a tooltip or a small "?"), not paragraphs. Keybard chrome mostly follows this: panels are a 22px title plus controls. The current Trainer page breaks it (see section 8).

---

## 1. Tokens

All values come from `src/index.css`: light from `:root` at lines 68-112, dark from `.dark` at lines 114-157. Hex values in *italics* are sRGB approximations of oklch values, for reference only. The tokens file keeps the oklch originals.

### 1a. Keybard `kb-*` tokens (themed)

| Token / utility | Light | Dark | Used for |
|---|---|---|---|
| `--kb-gray` → `bg-kb-gray` | `#f1f2f2` | `#141517` | Page background (`index.css:191` body). Editor canvas (`EditorLayout.tsx:1222`). Dark value must equal the no-flash style (`index.html:28`) and `DARK_PAGE_BG` (`lib/theme.ts:20`). |
| `--kb-key-border` → `border-kb-key-border` | `#f1f2f2` | `#5a5e65` | 1px key outline. In light it equals the page, so it reads as the gap between keys (`Key.tsx:137-144`). |
| `--kb-gray-medium` → `bg-kb-gray-medium` | `#eaeae9` | `#26282b` | Recessed panels, binding workspace (`SecondarySidebar.tsx:207`), unselected chips |
| `--kb-gray-border` → `border-kb-gray-border` | `#a7a9ac` | `#75797f` | Strong borders, code-block outline (`ConnectKeyboard.tsx:236`) |
| `--kb-surface` → `bg-kb-surface` | `#ffffff` | `#1d1e21` | Panels, cards, nav rail (`ui/sidebar.tsx:388`), detail panel (`SecondarySidebar.tsx:137`) |
| `--kb-ink` → `text-/fill-/border-/ring-kb-ink` | `#000000` | `#f1f2f2` | Chrome text, icons, logo, panel titles |
| `--kb-active` / `--kb-active-fg` | `#000000` / `#ffffff` | `#e8e9ea` / `#111214` | Selected pill or chip, nav indicator bar (`Sidebar.tsx:103`), OnOffToggle "on" |
| `--kb-popover` → `bg-kb-popover` | `#EEEEEE` | `#33363b` | Color-picker popovers (`LayerNameBadge.tsx:326`) |

README.md:133-140 lists dark `kb-key-border` as `#3a3d42` and dark `kb-gray-border` as `#6b6f76`. `index.css` (`#5a5e65`, `#75797f`) is what ships, so the README is stale.

### 1b. shadcn tokens (themed)

| Token | Light (oklch) | ≈ hex | Dark | Used for |
|---|---|---|---|---|
| `--background` | `oklch(1 0 0)` | *#ffffff* | `#1d1e21` | Dialog surface, outline-button fill, focus ring offset |
| `--foreground` | `oklch(0.129 0.042 264.695)` | *#020618* | `#f1f2f2` | Body text (`index.css:191`), tooltip background |
| `--card` / `--card-foreground` | `oklch(1 0 0)` / fg | | `#1d1e21` / `#f1f2f2` | (no Card primitive in `ui/`) |
| `--popover` / `--popover-foreground` | `oklch(1 0 0)` / fg | | `#26282b` / `#f1f2f2` | Select, dropdown and context-menu content |
| `--primary` | `oklch(0.208 0.042 265.755)` | *#0f172b* | `#e8e9ea` | `<Button>` default, slider range |
| `--primary-foreground` | `oklch(0.984 0.003 247.858)` | *#f8fafc* | `#111214` | |
| `--secondary`, `--muted`, `--accent` | `oklch(0.968 0.007 247.896)` | *#f1f5f9* | `#2c2e33` | Ghost/outline hover, slider track, unselected category tiles |
| `--secondary/accent-foreground` | `oklch(0.208 0.042 265.755)` | *#0f172b* | `#f1f2f2` | |
| `--muted-foreground` | `oklch(0.554 0.046 257.417)` | *#62748e* | `#a3a6ab` | Secondary text, setting descriptions |
| `--destructive` | `oklch(0.577 0.245 27.325)` | *#e7000b* | `oklch(0.704 0.191 22.216)` *#ff6467* | Destructive button |
| `--border` | `oklch(0.929 0.013 255.508)` | *#e2e8f0* | `oklch(1 0 0 / 12%)` | Default border on everything (`index.css:186`) |
| `--input` | `oklch(0.929 0.013 255.508)` | *#e2e8f0* | `#75797f` | Input, select and switch-off borders/fills |
| `--ring` | `oklch(0.704 0.04 256.788)` | *#90a1b9* | `#babec4` | Focus rings (`ring-ring/50`, 3px) |
| `--chart-1..5` | `oklch(.646 .222 41.1)`, `(.6 .118 184.7)`, `(.398 .07 227.4)`, `(.828 .189 84.4)`, `(.769 .188 70.1)` | *#f54900 #009689 #104e64 #ffb900 #fe9a00* | `(.488 .243 264.4)`, `(.696 .17 162.5)`, `(.769 .188 70.1)`, `(.627 .265 303.9)`, `(.645 .246 16.4)` | No chart usage found in `src/` (**UNVERIFIED** as unused) |
| `--sidebar*` | slate set as above (`sidebar` *#f8fafc*) | | `#1d1e21`, accent `#2c2e33`, border 12% white | Mostly unused: the rail paints `bg-kb-surface` (`ui/sidebar.tsx:388`) |

### 1c. Literal brand and layer colors (same in both themes)

From `src/index.css:51-65` and `src/utils/colors.ts:1-39`. These are **user data**: a layer's color comes from `keyboard.cosmetic.layer_colors[layer]`, and the default is `primary`/`green` (`Keyboard.tsx:340-343`).

| Name | Hex | Key face class (text) |
|---|---|---|
| primary / green | `#099e7c` | `bg-kb-primary text-white` |
| blue | `#379cd7` | `bg-kb-blue text-white` (also the Switch "on" color, `ui/switch.tsx:11`) |
| purple | `#8672b5` | `text-white` |
| orange | `#f89804` | `text-white` |
| yellow | `#ffc222` | `text-orange-800` |
| brown | `#b39369` | `text-white` |
| magenta | `#b5508a` | `text-white` |
| red | `#d8304a` | `text-white` (also error text `text-kb-red`, `ConnectKeyboard.tsx:227`) |
| gray | `#85929b` | `text-gray-200` |
| light-gray | `#D8D8D8` | `text-black` |
| white | `#ffffff` | `bg-white text-black` |
| sidebar (transmit mode) | `#3E3E3E` | header `#000000` (`kb-sidebar-dark`) |

### 1d. Radius

`--radius: 0.625rem` (10px). Keybard **overrides** Tailwind's radius scale (`index.css:7-10`):

| Utility | Keybard | Tailwind default |
|---|---|---|
| `rounded-sm` | 6px | 4px |
| `rounded-md` | **8px** | 6px |
| `rounded-lg` | 10px | 8px |
| `rounded-xl` | 14px | 12px |
| `rounded-2xl` / `rounded-3xl` | 16px / 24px (not overridden) | same |
| `rounded-full` | pills | |

Use of each: buttons and inputs are `rounded-md` (8px). The detail panel is `rounded-2xl`. The nav rail and popovers are `rounded-3xl`. Pills, toggles and icon buttons are `rounded-full`.

### 1e. Type

- **Family:** Inter only. It is forced with `!important` on `*` (`index.css:187`) and loaded from Google Fonts with the variable opsz/wght axes (`index.html:32`). Paranoid builds bundle `@fontsource-variable/inter` (`main.tsx:6`, `package.json:33`). Monospace is used only for code and commands (`font-mono text-xs`, `ConnectKeyboard.tsx:237`).
- **Scale in use** (Tailwind 4.1.14): `text-xs` 12/16, `text-sm` 14/20, `text-base` 16/24, `text-lg` 18/28, plus arbitrary values.

| Role | Classes | Where |
|---|---|---|
| Panel title | `text-[22px] font-semibold leading-none text-kb-ink` | `SecondarySidebar.tsx:55,154` |
| Dialog title | `text-lg leading-none font-semibold` | `ui/dialog.tsx:111` |
| Page header (Trainer) | 16px / 600 | `trainer.css:14` |
| Nav label | `text-md font-medium` (`text-md` is not a Tailwind v4 size, so it inherits 16px: **UNVERIFIED** visually) | `ui/sidebar.tsx:560` |
| Body / controls | `text-sm` (14px) `font-medium` on buttons | `ui/button.tsx:8` |
| Setting label + description | `text-md` + `text-xs text-muted-foreground` | `SettingsPanel.tsx:226-227` |
| Tooltip | `text-xs` | `ui/tooltip.tsx:80` |
| Micro caps (toggle) | `text-[10px] uppercase tracking-wide font-bold` | `ui/OnOffToggle.tsx:29` |
| Key legend | see section 4 | |

### 1f. Elevation, motion

- **Shadows:** `shadow-xs` on inputs and outline buttons, `shadow-md` on the active layer pill, `shadow-lg` on the nav rail, detail panel, dialog and floating tool buttons, `shadow-xl` on popovers.
- **Motion:** the common vocabulary is `transition-all duration-200 ease-in-out`.
  - The nav indicator slides `duration-300 ease-in-out` (`Sidebar.tsx:103`).
  - The content margin animates `320ms cubic-bezier(0.22,1,0.36,1)` (`EditorLayout.tsx:1196`).
  - Radix popups use `animate-in fade-in-0 zoom-in-95` plus a 2-unit slide (`ui/tooltip.tsx:80`, `ui/select.tsx:62`, from `tw-animate-css`, `index.css:2`).
  - 3D view transitions are 500ms (`Keyboard.tsx:553-555`).
  - Panel entry uses `panelFadeBounceIn 130ms` (`SecondarySidebar.css:1-16`).
  - Nothing in `src/` uses `motion-reduce`/`prefers-reduced-motion`. Only `trainer.css:28-29` discusses it.

---

## 2. Iconography

- **Library:** `lucide-react` 0.544. Size is `size-4` inside buttons by default (`ui/button.tsx:8`), `h-5 w-5` in the nav rail and toolbar (`Sidebar.tsx:140`, `LayerSelector.tsx:544`), and `h-4 w-4` in close buttons.
- **Custom icons:** about 50 stroke icons drawn to match lucide, in `src/components/icons/*.tsx` (with `.svg` sources). Examples: `GraduationCapIcon` (Trainer nav), `LayersDefault`, `MacrosIcon`, `Tapdance`, `ComboIcon`, `MatrixTester`, `KeybardLogo`.
- **Color:** icons inherit `currentColor`. Use `text-kb-ink`, or `text-kb-gray` when the icon sits on a `bg-kb-active` button (`LayerSelector.tsx:594-597`). Inactive nav icons are `text-gray-400 dark:text-neutral-400` (`Sidebar.tsx:134`).
- **Trainer:** the nav uses the custom `GraduationCapIcon` (`Sidebar.tsx:87`). The Trainer page header uses lucide `GraduationCap size=19 text-kb-green` (`TrainerPage.tsx:108`).

---

## 3. Component inventory (canonical class strings)

Copy these class strings verbatim. `cn()` = clsx + tailwind-merge.

### Buttons: `src/components/ui/button.tsx:7-32`
Base: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer`

| Variant | Classes |
|---|---|
| default | `bg-primary text-primary-foreground hover:bg-primary/90` |
| outline (**most used in Trainer**) | `border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50` |
| secondary | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| ghost | `hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50` |
| destructive | `bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60` |
| kb-primary (brand) | `bg-kb-primary text-white hover:bg-kb-primary/90 focus-visible:ring-kb-primary/20` |
| sizes | default `h-9 px-4 py-2`, sm `h-8 px-3 gap-1.5`, lg `h-10 px-6`, icon `size-9` |

**Pill buttons**, the Keybard-native look for primary actions. They are hand-rolled, not `<Button>`:
- Brand CTA: `flex items-center justify-center gap-2 text-sm font-medium cursor-pointer transition-all bg-kb-primary text-white hover:bg-kb-primary/90 px-5 py-1.5 rounded-full` (`ConnectKeyboard.tsx:176`)
- Ink CTA: `… bg-kb-active text-gray-200 dark:text-neutral-900 hover:bg-gray-800 dark:hover:bg-neutral-300 px-5 py-1.5 rounded-full` (`LayerSelector.tsx:399`, `ConnectKeyboard.tsx:212`)
- Quiet: `… bg-kb-gray text-kb-ink hover:bg-kb-gray-medium px-5 py-1.5 rounded-full border border-gray-300 dark:border-neutral-500` (`ConnectKeyboard.tsx:220`)
- Disabled pill: `bg-gray-200 dark:bg-neutral-700 text-kb-ink border-gray-200 dark:border-neutral-700 cursor-not-allowed` (`LayerSelector.tsx:479-481`)

**Round icon buttons** (toolbar): `p-2 rounded-full transition-all cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700`, icon `h-5 w-5 text-kb-ink`. The active state is `bg-kb-active hover:bg-gray-800 dark:hover:bg-neutral-300` with icon `text-kb-gray` (`LayerSelector.tsx:586-597`).

**Floating tool button** (bottom-left of the canvas): `w-12 h-12 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 bg-kb-surface shadow-lg flex items-center justify-center text-kb-ink border border-gray-200 dark:border-neutral-700` (`MatrixTester.tsx:14`), placed `absolute bottom-9 left-[37px]`.

### Tabs / segmented controls
Keybard has **no shadcn Tabs primitive**. It uses three patterns:
1. **Layer pills** (the main tab strip): `px-4 py-1 rounded-full transition-colors text-sm font-medium cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2`.
   - Active: `bg-gray-800 text-white dark:bg-neutral-200 dark:text-neutral-900 shadow-md scale-105`.
   - Inactive: `bg-transparent text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700` (`LayerSelector.tsx:295-300`).
   - Row: `flex items-center gap-2 pl-5 py-2 whitespace-nowrap overflow-x-auto` (`LayerSelector.tsx:340`).
2. **Category tiles** (Settings): `flex-1 flex flex-col items-center gap-2 py-3 rounded-lg transition-all`.
   - Active: `bg-kb-active text-kb-active-fg`.
   - Inactive: `text-muted-foreground hover:bg-muted bg-muted/60`. Icon `h-4 w-4`, label `text-xs font-medium` (`SettingsPanel.tsx:185-198`).
3. **OnOffToggle** (binary segmented): track `flex items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-0.5 w-fit border border-gray-200 dark:border-neutral-500`. Segment `px-3 py-1 text-[10px] uppercase tracking-wide rounded-full font-bold`. On: `bg-kb-active text-kb-active-fg shadow-sm`. Off: `text-gray-500 hover:text-kb-ink dark:text-neutral-400` (`ui/OnOffToggle.tsx:18-48`). Settings rows use this, not Switch.

### Cards / panels
No Card primitive. The patterns are:
- **Detail panel** (right-hand context panel): `fixed z-[60] flex flex-col bg-kb-surface border shadow-lg top-2 bottom-2 rounded-2xl`, width `min(32rem, …)`.
  - Header `px-4 py-3`, then `flex items-center justify-between gap-4 pt-1.5` holding the 22px title and a `Button variant=ghost size=icon rounded-full` with `X h-4 w-4`.
  - Body `flex-1 overflow-auto px-4 pb-4` (`SecondarySidebar.tsx:137-176`).
- **Floating card:** `bg-kb-surface text-kb-ink shadow-lg rounded-xl p-4 border border-gray-200 dark:border-neutral-700` (`EditorLayout.tsx:1494`).
- **Notice card:** `rounded-md border border-amber-300 dark:border-amber-800 bg-kb-surface p-3 text-sm text-amber-800 dark:text-amber-300 shadow-sm` (`EditingTargetStatus.tsx:24`).
- **Empty/connect well:** `p-10 max-w-xl mx-auto rounded-md border-dashed border-1 border-gray-300 dark:border-neutral-600` (`ConnectKeyboard.tsx:154`).
- **Setting row:** `flex flex-row flex-wrap items-center justify-between p-3 gap-3`. The left column is `flex flex-col items-start gap-3 flex-1 basis-44 min-w-0`, with a label (`text-md`) and an optional `text-xs text-muted-foreground` description. The control goes on the right (`SettingsPanel.tsx:224-237`). Clickable row: `hover:bg-accent hover:text-accent-foreground rounded-md` plus `›` (`SettingsPanel.tsx:288-311`).
- **Popover:** `bg-kb-popover rounded-3xl p-2 shadow-xl border border-gray-200 dark:border-neutral-700` (`LayerNameBadge.tsx:326`).
- **Dialog:** `bg-background rounded-lg border p-6 shadow-lg sm:max-w-lg gap-4`, overlay `bg-black/50`, title `text-lg font-semibold`, description `text-muted-foreground text-sm`, footer `flex-col-reverse sm:flex-row sm:justify-end gap-2` (`ui/dialog.tsx:39-127`).

### Inputs
- **Input:** `h-9 w-full rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-1 text-base md:text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive` (`ui/input.tsx:11-13`).
- **Select trigger:** `border-input dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs data-[size=default]:h-9 data-[size=sm]:h-8`, plus a `ChevronDownIcon size-4 opacity-50`.
  - Content: `bg-popover text-popover-foreground rounded-md border shadow-md`.
  - Item: `rounded-sm py-1.5 pr-8 pl-2 text-sm focus:bg-accent` with `CheckIcon` (`ui/select.tsx:38-118`).
- **Slider:** track `bg-muted h-1.5 rounded-full`, range `bg-primary`, thumb `size-4 rounded-full border border-primary bg-kb-surface shadow-sm hover:ring-4 ring-ring/50` (`ui/slider.tsx:40-58`).

### Toggles
- **Switch:** root `inline-flex h-[1.15rem] w-8 rounded-full border border-transparent shadow-xs data-[state=checked]:bg-kb-blue data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80`. Thumb `size-4 rounded-full bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-white data-[state=checked]:translate-x-[calc(100%-2px)]` (`ui/switch.tsx:11-19`). **On is blue (#379cd7), not brand green.** Trainer CSS overrides it to `#099e7c` (`trainer.css:1` `.trainer-toggle [data-state=checked]`).
- **OnOffToggle:** see Tabs. It is the Settings-panel idiom.

### Badges / chips
No Badge primitive. Status text appears inline as a pill: `flex items-center text-sm font-medium pl-2 pr-5 py-1.5 rounded-full bg-transparent text-kb-ink border border-transparent` ("Live Updating", `LayerSelector.tsx:461`). Pending state is shown as `ring-[3px] ring-red-500 ring-offset-2 ring-offset-kb-gray` on the Apply pill (`LayerSelector.tsx:488-490`). The Trainer's own `.trainer-badge` (`trainer.css:1`) is off-system.

### Tooltips
`bg-foreground text-background rounded-md px-3 py-1.5 text-xs text-balance z-[10000]`, with arrow `size-2.5 rotate-45 rounded-[2px] bg-foreground`. They open instantly (`delayDuration=0`). `DelayedTooltip` waits 500ms for action buttons (`ui/tooltip.tsx:8-104`). This is an inverted chip: black on light, near-white on dark.

### Dividers
- Vertical toolbar divider: `h-4 w-[1px] bg-slate-400 dark:bg-neutral-600` (`LayerSelector.tsx:533`).
- Nav divider: `mx-4 my-2 h-[1px] bg-slate-400 dark:bg-neutral-600` (`Sidebar.tsx:345`).
- Dotted leader: `.sidebar-dotted-line`, radial dots at `#d1d5db`, `#4b4f55` in dark (`SecondarySidebar.css:18-25`).

### Feedback text
- Error: `text-sm text-red-700 dark:text-red-400` with `role="alert"` (`SettingsPanel.tsx:145`).
- Connection error: `text-kb-red`, `AlertTriangle w-5 h-5`, `font-medium` (`ConnectKeyboard.tsx:226-232`).
- Busy: `Loader2 animate-spin` (`App.tsx:73`).

---

## 4. Key cap rendering spec

Renderer: `src/components/Key.tsx` (HTML divs, absolutely positioned), placed by `src/components/Keyboard.tsx`. `src/components/Key.css` (gradient `.key` class) is **legacy**: `Key.tsx` never uses `.key`, so ignore it.

| Property | default | medium | small | Source |
|---|---|---|---|---|
| Unit (1u) | **60px** | 45px | 30px | `Keyboard.tsx:114-116`, `svalboard-layout.ts:16` |
| Box | `w*unit × h*unit`, keys drawn edge to edge (no margin) | | | `Key.tsx:80-86` |
| Radius | `rounded-md` = **8px** | `rounded-[5px]` | `rounded-[5px]` | `Key.tsx:137` |
| Border | 1px `border-kb-key-border` (`#f1f2f2` light = page color → acts as the inter-key gap. `#5a5e65` dark) | | | `Key.tsx:144` |
| Face | layer color class, e.g. `bg-kb-primary text-white` (section 1c) | | | `Key.tsx:123`, `utils/colors.ts:24-39` |
| Text transform | `uppercase`, `font-semibold`, Inter | | | `Key.tsx:134,238` |
| Header strip (modifier/top label, layer-key name) | `h 18px`, `text-sm`, `rounded-t-sm` | `h 14px`, `text-[11px]`, `rounded-t-[4px]` | `h 10px`, `text-[10px]`, `rounded-t-[4px]` | `Key.tsx:159-174` |
| Header color | `bg-black/30 text-white` over the layer color (`bg-black/50` on black. `bg-kb-sidebar-dark` in transmit mode) | | | `utils/colors.ts:79-94` |
| Footer strip (bottomStr) | same as header with `rounded-t-none rounded-b-sm` | | | `Key.tsx:244-247` |
| Center legend | `text-[16px]` for 1 char, otherwise `text-[15px]`. 13px when crowded. `0.6rem` for long/user/OSM | `text-[12px] px-1` (0.6rem crowded) | `text-[10px] px-0.5` (8.5px for ≥4 chars, 0.5rem crowded) | `Key.tsx:94-113,238` |
| Type icon (macro, TD, combo…) | `mt-2 h-8` | `mt-1.5 h-6` | `mt-1 h-4` | `utils/key-icons.tsx:90-110` |
| Layer key | header = layer name. Body = target number `text-[16px]` (14px if 2 digits) + Layers icon | 14px + `w-5 h-5` | 13px + `w-3 h-3` | `Key.tsx:187-210` |
| Motion | `transition-all duration-200 ease-in-out` | | | `Key.tsx:134` |

**States** (`Key.tsx:139-152`, `Keyboard.tsx:771-1010`, `MatrixTester.tsx:163-178`):

| State | Look |
|---|---|
| Normal | layer color face, 1px key-border |
| Hover | `hover:border-red-500 hover:ring-2 hover:ring-inset hover:ring-red-500` (inset, so no layout shift) |
| Selected / drop target | `bg-red-500 text-white border-kb-key-border ring-2 ring-red-500 ring-offset-1 ring-offset-background` |
| Pending (unsaved) change | `border-2 border-red-500` |
| Drag source | `bg-kb-light-grey border-kb-light-grey opacity-60 dark:bg-neutral-700 dark:border-neutral-700` |
| Ghost (KC_TRNS showing a lower layer) | transparent key that reveals the lower layer's key on hover/selection. Underneath: `border-solid border-[3px] opacity-50` in the source layer color (`Keyboard.tsx:934-937`) |
| Transmit mode (picking keys for combo/macro/TD/override) | every key uses `sidebar` color `#3E3E3E` + `bg-kb-sidebar-dark` header, and hover shows the real layer color (`Keyboard.tsx:771-778`) |
| **Live pressed (Matrix Tester)** | pressed now = **Selected** look (red). Pressed earlier = `layerColor="black"` (`bg-black text-white`). Never pressed = `white` (`bg-white text-black`) (`MatrixTester.tsx:177-178`). This is the only existing "live key" visual. |
| 3D mode underlay | extra div under each key, offset 4px down, `rgb(layer*0.7)` fill+border, opacity .65, radius 6px (5px small/medium) (`Keyboard.tsx:535-546,815-828`) |
| 3D layer backdrop | `rgba(layer, 0.65 active / backdropOpacity)` behind the clusters. `mix-blend-multiply` in light, `screen` in dark (`Keyboard.tsx:478-486,642-664`) |

The Trainer overlay preview uses its own SVG renderer, not `Key.tsx` (`features/trainer/OverlaySurface.tsx:182-201`): 40px/unit, `rx=6`, keys `w*40-3` (3px gap), colors from user-chosen Appearance presets (`core.ts:228-235`). That style is the desktop-overlay look and is a separate system from editor key caps.

**Geometry:** see `svalboard-geometry.json`.
- Composed layout (finger_5): 52 keys, 25u × 7.5u → **1500 × 450px** at default size.
- 6-key fingers: 60 keys, 25u × 8.5u.
- Legacy fallback: 24.3u × 7.3u, with thumbs at y ≥ 6 pushed +0.3u.

---

## 5. Layout grid of the main window

Measured from code. Pixel values assume a 16px root.

```
┌──┬────────────────────────────────────────────────────────────────────────┐
│N │  LayerSelector  (pt-[22px]; toolbar row pl-5 py-2; layer-pill row)     │
│a │  ── gap = 1 key height (dynamicTopPadding, EditorLayout.tsx:1144) ──   │
│v │                                                                        │
│  │            Keyboard canvas (bg-kb-gray, centered, 60px/unit)            │
│r │                                                                        │
│a │  [floating tool btn 48×48 rounded-2xl, bottom-9 left-[37px]]           │
│i │                                                                        │
│l │                                                                        │
└──┴────────────────────────────────────────────────────────────────────────┘
 ↑ 48px collapsed / 208px expanded
```

| Element | Value | Source |
|---|---|---|
| Nav rail, collapsed | `--sidebar-width-icon: 3rem` (48px) | `ui/sidebar.tsx:22,268` |
| Nav rail, expanded | `--sidebar-width: 13rem` (208px). Mobile sheet 18rem | `ui/sidebar.tsx:20-21` |
| Nav rail frame | `fixed ml-2 h-[98vh] mt-[1vh] rounded-3xl border border-sidebar-border shadow-lg`, inner `bg-kb-surface rounded-3xl`. Width animates 300ms | `Sidebar.tsx:275-278`, `ui/sidebar.tsx:368,388` |
| Nav items | `h-[26px]` buttons, `gap-4` (42px pitch), icon gutter = rail width, icon 20px | `Sidebar.tsx:31-38`, `ui/sidebar.tsx:533,560` |
| Nav active indicator | 3×26px bar `bg-kb-active` at `left-[4px]`, slides 300ms | `Sidebar.tsx:101-106` |
| Nav groups (top→bottom) | logo · Standard Keys, Pointing Devices, [board menus] · Special, Layer, Mouse, Tap Dance, Macro Keys · Alt-Repeat, Leaders, Combos, Overrides · **Layouts, Trainer** · (footer) Quick Start, Manual, About, Settings | `Sidebar.tsx:49-97` |
| Content column | `marginLeft = rail width`, `px-2 sm:px-4 h-dvh flex flex-col bg-kb-gray`. Margin animates 320ms | `EditorLayout.tsx:1121,1190-1199,1219-1225` |
| Detail panel (side mode) | `fixed top-2 bottom-2 rounded-2xl`, width `min(32rem, 100vw - left - 8px)`. Content shifts by `rail + 32rem + 6px` when the viewport is ≥ 1100px | `SecondarySidebar.tsx:26,137-145`, `EditorLayout.tsx:1135-1137` |
| Detail panel (bottom mode) | full-width bottom sheet, height 150-400px (36rem cap for settings-like panels) | `EditorLayout.tsx:1169-1187`, `SecondarySidebar.tsx:27-29` |
| Panel paddings | header `px-4 py-3`, body `px-4 pb-4` | `SecondarySidebar.tsx:148,171` |
| Toast/alert | `fixed top-2 right-2 z-[100] rounded border bg-kb-surface p-3 text-sm` | `EditorLayout.tsx:1209` |
| Trainer slot | when `activePanel === "trainer"`, the whole editor is replaced by `.trainer-shell-content` (marginLeft = rail width, `container-type: inline-size`). No detail panel or bottom panel shows. The nav click toggles Trainer like Matrix Tester | `EditorLayout.tsx:1087-1089,1126-1127,1214-1218`, `Sidebar.tsx:188-198`, `trainer.css:12` |
| Breakpoints | nav auto-collapses <900px. Detail panel stops pushing content <1100px. Binding workspace stacks <1000px. There is no mobile sheet: `MOBILE_BREAKPOINT = 0`, so the rail is always the shared rail | `Sidebar.tsx:187`, `EditorLayout.tsx:1129`, `SecondarySidebar.css:42`, `hooks/use-mobile.ts:3-5` |

---

## 6. Empty / disconnected states

- **No board:** `MainScreen` shows `ConnectKeyboard` instead of the editor (`MainScreen.tsx:8-9`). It is a centered logo row with a dashed well (`p-10 max-w-xl rounded-md border-dashed`), holding a column of `w-50` pills:
  - Connect Keyboard (brand green, `Unplug` icon; `PlugZap` while connecting)
  - known devices (`bg-kb-gray-medium`)
  - "or"
  - Load File (ink)
  - QWERTY Example (quiet)
  
  Errors are `text-kb-red` with a triangle icon (`ConnectKeyboard.tsx:154-232`).
- **Trainer without Keybard Host:** a `HostInstall` section (`HostInstall.tsx:23-33`): a white box, a "Download for Windows" green button, and three paragraphs of instructions. Paranoid builds show a single note instead (`TrainerPage.tsx:110`).
- **No keys:** `OverlaySurface` renders the plain `<p>No physical keys in this layout.</p>` (`OverlaySurface.tsx:8`).
- **Busy:** a full-screen `bg-black/50` overlay with `Loader2 h-10 w-10 animate-spin text-white` and "Importing..." (`App.tsx:67-79`). Pills swap their label to "Saving…" or "Connecting...".

---

## 7. Existing Trainer screens (as built)

`src/features/trainer/TrainerPage.tsx` + `trainer.css`. Structure:

- `header.trainer-header`: height 64px, `padding 0 24px`, `border-bottom 1px #ddd`, transparent background, `GraduationCap` + `<h1>Trainer</h1>` at 16px/600 (`trainer.css:13-14`).
- `main.trainer-main` (24px padding) → `.trainer-workspace`: a grid of `minmax(0,1fr) 336px`, gap 24, max-width 1700. It drops to 280px under a 900px container and to one column under 700px (`trainer.css:1,19-20`).
  - **Stage** (left):
    - Host toolbar (native `<select>` + outline "Show overlay").
    - `.trainer-preview-card`: white, `1px #d8dcda`, radius 10. Inside it, a `.trainer-canvas` with a fake desktop background (Light/Dark/Busy) and the SVG overlay.
    - Footer with a "Preview background" segmented control.
    - "Layout source" select + "Import for trainer".
    - Default-layer and preview-layer selects.
  - **Inspector** (right, sticky): an underline tab bar (Overlay · Appearance · Feedback · Practice). Tab text is 11px. The selected tab has a 2px `#099e7c` underline and `#087e60` text. The pane has 20px padding with fields of label 12px/500 and a native control.
  - **Practice tab:** "Recall practice" switch → a recall card ("FIND THIS BINDING" eyebrow, 22px binding, Reveal → Remembered / Again, a count line), then a "Familiar bindings" select, "Mark familiar" and "Hide familiar legends".

**Where it departs from the system** (fix in the new design):
1. **Hard-coded colors** throughout `trainer.css`: `white`, `#ddd`, a green-tinted gray family (`#7b857e #819087 #526359 #d8dcda …`) and `#099e7c/#087e60` accents. Dark mode is patched with parallel `.dark` rules (`trainer.css:40-59`). The `.tsx` theme guard only scans `.tsx`, so CSS files escape it.
2. **Native `<select>` / `<input type=range>` / `<input type=color>`** instead of `ui/select`, `ui/slider` and the Keybard color popover.
3. **Underline tabs** that appear nowhere else in Keybard. The native idioms are pills, category tiles and OnOffToggle.
4. **Switch recolored green** (`trainer.css:1`) while the rest of the app's Switch is blue and Settings uses OnOffToggle.
5. **Explanatory copy on screen:** `.trainer-note` paragraphs ("Self-assessed practice. Nothing is recorded…", "Move the overlay with the handle…", the three-paragraph `HostInstall`). This breaks rule 0.4.
6. **Page header with bottom border.** No other Keybard page has a header bar. Panels use a 22px title with no rule.
7. **Radii:** 10px cards, 5-6px controls and a square install box. Keybard uses 8px controls, 16px panels and pill CTAs.

---

## 8. Do / don't

**Do**
- Use the token utilities: `bg-kb-gray` (page), `bg-kb-surface` (panels), `text-kb-ink` (titles and icons), `text-muted-foreground` (secondary text), `border` (defaults to `--border`), `bg-kb-active`/`text-kb-active-fg` (selected).
- Title a surface with `text-[22px] font-semibold leading-none text-kb-ink`. Close it with a ghost icon button with `rounded-full`.
- Use pills (`rounded-full px-5 py-1.5 text-sm font-medium`) for primary actions. Use brand green (`bg-kb-primary`) only for the one forward action on a screen (Connect, Download, Start). Use the ink pill for commit-style actions.
- Use layer pills for picking a layer or mode. Use OnOffToggle for binary settings in setting rows. Use category tiles for 3-5 top-level sections inside a panel.
- Render keys with `Key.tsx` sizes, radii and layer colors, so the trainer keyboard looks like the editor keyboard. Show live presses the way Matrix Tester does (red selected ring). Use the layer color, not a new accent, for "target" emphasis.
- Keep key data unthemed: key faces look identical in light and dark. Only the page, border and chrome change.
- Use lucide icons at 16px in controls and 20px in toolbars and the nav, with `currentColor`.
- Make every label self-sufficient. Put any "why" in a tooltip (`Tooltip` / `DelayedTooltip`), never a paragraph.
- Animate with `transition-all duration-200 ease-in-out`. Wrap anything that moves in `motion-safe:`. Keybard lacks reduced-motion handling, so new code should add it.

**Don't**
- Don't write `bg-white`, `text-black`, `#hex` chrome colors or bare `gray-*` without a `dark:` partner. Don't add new hard-coded CSS color files the way `trainer.css` does.
- Don't use underline tabs, page header bars with rules, dashed "host" cards or eyebrow caps labels. None of these are Keybard idioms.
- Don't recolor primitives per feature (for example, the green Switch).
- Don't add paragraphs that explain the screen, privacy notes beyond one line, or instructions a title could carry.
- Don't use Tailwind's stock radius values when mocking. Keybard's `rounded-md` is 8px.
- Don't use the legacy `Key.css` gradient look or the overlay's 40px SVG style for in-app keyboards.
- Don't theme `headerClassName` key strips (the test fails on `kb-active`/`kb-header` inside them).
