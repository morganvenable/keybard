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

## Trainer and native overlay preview

Trainer is available from the layout navigation and the connection screen, or directly at `/#trainer` when serving with a root base path. It has independent appearance controls, saved presets, a shared SVG keyboard renderer, offline/imported previews, and recall practice. Trainer imports do not replace the editor draft.

The [native Keybard Host](companion/overlay-host/README.md) serves this same web UI and runs its renderer as a transparent tray-managed desktop overlay. It has an isolated Windows runtime and read-only Svalboard device worker. Host mode supports live active/default layers, optional held-key feedback, remembered-board reconnect, and configuration from Keybard. Direct browser HID editing is blocked in host mode until unified editor transport is implemented; ordinary browser-only Keybard remains available.
