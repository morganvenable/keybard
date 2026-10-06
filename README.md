# KeyBard

[![Test Coverage](https://img.shields.io/codecov/c/github/svalboard/keybard-ng?style=flat-square&label=coverage)](https://codecov.io/gh/svalboard/keybard-ng)
[![Tests](https://img.shields.io/github/actions/workflow/status/svalboard/keybard-ng/test.yml?branch=main&style=flat-square&label=tests)](https://github.com/svalboard/keybard-ng/actions/workflows/test.yml)

A modern Vite-based keyboard configuration UI built with React and TypeScript.

## Quick Start

```bash
npm install        # Install dependencies
npm run dev        # Start development server
# → http://localhost:5173
```

## Project Structure

```text
keybard-ng/
├── src/           # Vite + React + TypeScript
│   ├── constants/      # KeyMap constants
│   ├── components/     # React components
│   ├── contexts/       # VialContext
│   ├── services/       # TypeScript Vial services
│   │   ├── key.service.ts
│   │   ├── usb.ts
│   │   ├── utils.ts
│   │   └── vial.service.ts
│   └── types/         # TypeScript definitions
├── tests/         # Test suite
│   ├── services/       # Service layer tests
│   ├── contexts/       # React Context tests
│   ├── fixtures/       # Test data and mocks
│   └── mocks/          # USB and API mocks
└── dist/          # Build output (gitignored)
```

## Key Technologies

- **React 19** with TypeScript
- **Vite** for fast dev server and builds
- **xz-decompress** for XZ decompression (keyboard data, includes types)
- **WebHID API** for USB keyboard communication

## Available Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Loading Keyboard Configurations

KeyBard supports two ways to view keyboard configurations:

### 1. Connect to Physical Keyboard

Click "Connect Keyboard" to connect to a Vial-compatible keyboard via WebHID.

**Browser Support**: Chrome (89+), Edge (89+), Opera (75+), Brave
**Not Supported**: Firefox, Safari (WebHID unavailable)

### 2. Load Configuration File

Click "Load File" to load a `.svil` or `.vil` configuration file.

**Supported formats**:
- `.svil` - Native Svalboard layout format (recommended). Legacy `.viable` files still load.
- `.vil` - Vial-compatible format

**File size limit**: 1MB maximum

### Switching Between Sources

You can freely switch between connected keyboards and loaded files. The display always shows the most recent source. The "Loaded From" field indicates whether you're viewing a device or a file.

## Integration Points

### VialContext Hook

```tsx
import { useVial } from './contexts/VialContext';

function MyComponent() {
  const {
    keyboard,
    isConnected,
    loadedFrom,
    connect,
    loadKeyboard,
    loadFromFile
  } = useVial();

  // Use Vial services...
}
```

### Services Available

- `VialUSB` - USB HID communication
- `VialService` - Keyboard operations (load, getKeyboardInfo, etc.)
- `KeyService` - Keycode parsing and stringifying (parse, stringify, define, etc.)
- Utilities - Byte manipulation (LE16, BE16, etc.)

## What's Working

✅ TypeScript conversion of core Vial modules
✅ USB communication layer
✅ XZ decompression via npm package (xz-decompress with built-in types)
✅ KEY utilities (keycode parsing, CODEMAP, KEYMAP, KEYALIASES)
✅ React Context provider
✅ Basic connection UI
✅ File loading (.svil and .vil configuration files)

## What's Next

- Keymap editor component
- Macro management UI
- Combo/tap-dance configuration
- Additional Vial features

## Theming

The app has light and dark themes (Settings > General > Appearance: System, Light or Dark). Dark mode is the `dark` class on `<html>`, set before first paint by the inline script in `src/index.html` and kept in sync by `src/components/ThemeSync.tsx`. Helpers live in `src/lib/theme.ts`.

### Tokens

Chrome colours come from tokens defined in `src/index.css` (`:root` for light, `.dark` for dark). Each light value equals the literal it replaced, so light mode is unchanged.

| Utility | Light | Dark | Use for |
|---|---|---|---|
| `bg-kb-gray` | `#f1f2f2` | `#141517` | Page background, row borders |
| `border-kb-key-border` | `#f1f2f2` | `#3a3d42` | Key gap/outline (`Key.tsx` only) |
| `bg-kb-gray-medium` | `#eaeae9` | `#26282b` | Raised/recessed panels, unselected chips |
| `border-kb-gray-border` | `#a7a9ac` | `#6b6f76` | Strong borders, control outlines |
| `bg-kb-surface` | `#ffffff` | `#1d1e21` | Panels and cards (instead of `bg-white` / `border-white`) |
| `text-kb-ink` (`fill-`, `border-`, `ring-`) | `#000000` | `#f1f2f2` | Chrome text, icons, logos, focus rings (instead of `text-black` etc.) |
| `bg-kb-active` / `text-kb-active-fg` | `#000` / `#fff` | `#e8e9ea` / `#111214` | Selected pill or chip |
| `bg-kb-popover` | `#EEEEEE` | `#33363b` | Colour-picker popovers |

The shadcn variables (`--background`, `--foreground`, `--popover`, `--primary`, `--muted`, `--border`, `--input`, `--ring`, ...) are also redefined under `.dark`, so shadcn primitives in `src/components/ui` theme themselves.

### Rules

1. **Chrome uses a token or a `dark:` partner.** Never write `bg-white`, `text-black`, `border-black`, `fill-black`, `ring-black`, `bg-[#hex]` or `fill="black"` for chrome; use the tokens above. For a `gray-*`/`slate-*` utility, put a `dark:` class for the same property and variants in the same string literal: `text-gray-500 dark:text-neutral-400`, `hover:bg-gray-100 dark:hover:bg-neutral-800`. Never change the light class itself.
2. **Key data is never themed.** Layer colours (`src/utils/colors.ts`), key face colours and `headerClassName` key headers (e.g. `bg-kb-sidebar-dark`) look the same in both themes. Never put `kb-active` or other theme tokens in a `headerClassName`.
3. **Printed output stays light.** `PrintableKeymap*` is not themed, and `index.css` forces a light page under `@media print`.

`tests/theme/no-hardcoded-chrome-colors.test.ts` enforces rules 1 and 2 on `src/**/*.tsx` as part of `npm test`. Justified exceptions (dead code, developer tools, data lookups) go in `tests/theme/allowlist.ts` with a reason.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (during development)
npm run test:watch

# Open Vitest UI
npm run test:ui
```

### Test Coverage

This project maintains **90% code coverage** across:

- ✅ Utility functions and byte manipulation
- ✅ KeyService (keycode parsing, custom keys, layers)
- ✅ USB communication layer (mocked WebHID API)
- ✅ VialService (keyboard loading, keymap management)
- ✅ QMK settings service
- ✅ React Context state management

### Test Structure

```text
tests/
├── services/       # Service layer tests
├── contexts/       # React Context tests
├── fixtures/       # Test data and mocks
├── mocks/          # USB and API mocks
└── utils/          # Test utilities
```

### Writing Tests

Tests follow the AAA (Arrange-Act-Assert) pattern:

```typescript
it('should update key at specific position', async () => {
  // Arrange
  const layer = 0, row = 1, col = 2;
  const keymask = 0x0004; // KC_A

  // Act
  await vialService.updateKey(layer, row, col, keymask);

  // Assert
  expect(mockUSB.send).toHaveBeenCalledWith(/* ... */);
});
```

### CI/CD

Tests run automatically on:

- Pull requests (all commits)
- Pushes to main/master
- Coverage reports posted to PRs

## Documentation

See [VITE_SETUP.md](./VITE_SETUP.md) for detailed setup and development documentation.
