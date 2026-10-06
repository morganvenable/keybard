# KeyBard-NG Type Definitions

## Overview

Complete TypeScript type definitions used throughout the KeyBard-NG application, organized by domain and purpose.

## Core Types

### KeyboardInfo

Central state container for all keyboard data.

**Location:** `src/types/keyboard.types.ts`

```typescript
interface KeyboardInfo {
  id: string;                      // Unique keyboard identifier
  payload?: KeyboardPayload;        // Decompressed layout definition
  matrix?: number[][][];            // [layer][row][col] keycode matrix
  features?: {
    macros?: MacroData[];          // Macro definitions
    combos?: ComboData[];          // Combo configurations
    tapdance?: TapdanceData[];     // Tap dance sequences
    overrides?: KeyOverrideData[]; // Key override rules
  };
  settings?: Record<number, number>; // QMK settings (QSID → value)
  sval?: {                          // Svalboard-specific data
    layerColors?: Array<[number, number, number]>; // HSV colors
    layerNames?: string[];         // Custom layer names
  };
}
```

### KeyboardPayload

Decompressed keyboard layout definition from the board.

```typescript
interface KeyboardPayload {
  name: string;                    // Display name
  vendorId: string;                // USB vendor ID (hex)
  productId: string;               // USB product ID (hex)
  matrix: {
    rows: number;                  // Matrix row count
    cols: number;                  // Matrix column count
  };
  layouts: {
    keymap?: Array<Array<any>>;    // Physical key layout
    labels?: string[];             // Layout option labels
  };
  customKeycodes?: CustomKeycode[]; // User-defined keycodes
  lighting?: 'none' | 'qmk_backlight' | 'qmk_rgblight';
  viaClusters?: Array<any>;       // VIA layout clusters
}
```

## Feature Types

### MacroData

Keyboard macro definition.

```typescript
interface MacroData {
  id: number;                      // Macro ID (0-based)
  name?: string;                   // Display name
  sequence: MacroAction[];         // Action sequence
}

interface MacroAction {
  type: 'down' | 'up' | 'tap' | 'delay' | 'text';
  keycode?: number;                // For key actions
  delay?: number;                  // For delay action (ms)
  text?: string;                   // For text action
}
```

### ComboData

Key combination configuration.

```typescript
interface ComboData {
  id: number;                      // Combo ID
  keys: number[];                  // Key indices that trigger combo
  keycode: number;                 // Resulting keycode when triggered
  timeout?: number;                // Combo timeout (ms)
}
```

### TapdanceData

Tap dance sequence configuration.

```typescript
interface TapdanceData {
  id: number;                      // Tap dance ID
  onTap: number;                   // Keycode for single tap
  onHold: number;                  // Keycode for hold
  onDoubleTap?: number;            // Keycode for double tap
  onTapHold?: number;              // Keycode for tap then hold
  tappingTerm?: number;            // Tapping term (ms)
}
```

### KeyOverrideData

Key override rule configuration.

```typescript
interface KeyOverrideData {
  id: number;                      // Override ID
  trigger: number;                 // Trigger keycode
  replacement: number;             // Replacement keycode
  layers?: number;                 // Layer mask (bitfield)
  triggerMods?: number;            // Required modifiers
  suppressedMods?: number;         // Mods to suppress
  options?: number;                // Override options bitfield
}
```

### CustomKeycode

User-defined custom keycode.

```typescript
interface CustomKeycode {
  name: string;                    // Display name
  title: string;                   // Tooltip/description
  shortName: string;               // Short display name
}
```

## USB Communication Types

### USBSendOptions

Options for USB communication operations.

**Location:** `src/types/keyboard.types.ts`

```typescript
interface USBSendOptions {
  unpack?: string;                 // Python struct format string
  dtype?: 'uint8' | 'uint16' | 'uint32'; // Data type
  indexed?: boolean;               // Return object vs array
  endianness?: 'little' | 'big';  // Byte order
}
```

### KeyboardAPI

API contract for keyboard updates.

```typescript
interface KeyboardAPI {
  getProtocolVersion(): Promise<number>;
  getKeyboardValue(command: number): Promise<number>;
  setKeyboardValue(command: number, value: number): Promise<void>;
  getKeycode(layer: number, row: number, col: number): Promise<number>;
  setKeycode(layer: number, row: number, col: number, keycode: number): Promise<void>;
  getDynamicEntries(type: number, count: number): Promise<Uint8Array>;
}
```

## Keymap Types

### KeyString

Key identifier type.

**Location:** `src/types/keymap.d.ts`

```typescript
type KeyString = string | number;
```

### KeyMapEntry

Individual keycode definition.

```typescript
interface KeyMapEntry {
  qmkid: string;                   // QMK identifier
  str: string;                     // Display string
  title: string;                   // Tooltip text
  isDualAction?: boolean;          // Has tap/hold behavior
}
```

### CodeMap

Numeric to string keycode mapping.

```typescript
type CodeMap = Record<number, string>;
// Example: { 0x0004: "KC_A", 0x0005: "KC_B" }
```

### KeyMap

String to entry keycode mapping.

```typescript
type KeyMap = Record<string, KeyMapEntry>;
// Example: {
//   "KC_A": { qmkid: "KC_A", str: "A", title: "A key" }
// }
```

### KeyAliases

Keycode alias mapping.

```typescript
type KeyAliases = Record<string, KeyString>;
// Example: { "ESC": "KC_ESC", "CTRL": "KC_LCTRL" }
```

## QMK Settings Types

### QMKSettings

Complete QMK settings schema.

**Location:** `src/types/qmk.d.ts`

```typescript
interface QMKSettings {
  tabs: QMKSettingsTab[];          // Setting groups
}
```

### QMKSettingsTab

Settings tab grouping.

```typescript
interface QMKSettingsTab {
  name: string;                    // Tab display name
  fields: QMKSettingsField[];      // Settings in this tab
}
```

### QMKSettingsField

Individual QMK setting field.

```typescript
interface QMKSettingsField {
  type: 'boolean' | 'integer';    // Field type
  label: string;                   // Display label
  qsid: number;                    // QMK Setting ID
  bit?: number;                    // Bit position (boolean)
  min?: number;                    // Minimum value (integer)
  max?: number;                    // Maximum value (integer)
  step?: number;                   // Value increment (integer)
}
```

## Context Types

### KeyboardContextType

React context shape.

**Location:** `src/contexts/KeyboardContext.tsx`

```typescript
interface KeyboardContextType {
  keyboard: KeyboardInfo | null;   // Current keyboard state
  isConnected: boolean;            // USB connection status
  isLoading: boolean;              // Loading operation status
  error: string | null;            // Error message
  connect: () => Promise<void>;    // Connect to keyboard
  disconnect: () => void;          // Disconnect from keyboard
  loadKeyboard: () => Promise<void>; // Load keyboard data
  updateKey: (                     // Update single key
    layer: number,
    row: number,
    col: number,
    keymask: number
  ) => Promise<void>;
}
```

## Component Props Types

### KeyProps

Props for Key component.

**Location:** `src/components/Key.tsx`

```typescript
interface KeyProps {
  position: {
    x: number;                     // X coordinate (units)
    y: number;                     // Y coordinate (units)
    width?: number;                // Width (units, default: 1)
    height?: number;               // Height (units, default: 1)
  };
  label: string;                   // Display text
  onClick?: () => void;            // Click handler
  isSelected?: boolean;            // Selection state
  className?: string;              // Additional CSS classes
}
```

## Protocol Constants

### VIA Protocol Commands

```typescript
enum VIACommand {
  GET_PROTOCOL_VERSION = 0x01,
  GET_KEYBOARD_VALUE = 0x02,
  SET_KEYBOARD_VALUE = 0x03,
  GET_KEYCODE = 0x04,
  SET_KEYCODE = 0x05,
  // ... additional commands
}
```

### Sval Protocol Commands

Sval commands use the `0xDF` prefix inside the `0xDD` client-ID wrapper. Wrapped VIA operations use `0xFE`. See `src/services/usb.service.ts` for the current command registry.

### QMK Commands

```typescript
enum QMKCommand {
  PREFIX = 0x00,
  CAPABILITIES_QUERY = 0x06,
  GET_VALUE = 0x07,
  SET_VALUE = 0x08,
}
```

## Utility Types

### Unpack Format Types

Python struct-like format for data unpacking.

```typescript
type UnpackFormat =
  | 'B'    // unsigned char (1 byte)
  | 'H'    // unsigned short (2 bytes)
  | 'I'    // unsigned int (4 bytes)
  | 'BB'   // two unsigned chars
  | 'HH'   // two unsigned shorts
  | 'BBBB' // four unsigned chars
  | string; // Any combination
```

### Matrix Position

Key position in keyboard matrix.

```typescript
interface MatrixPosition {
  layer: number;                   // Layer index (0-15)
  row: number;                     // Row index
  col: number;                     // Column index
}
```

### RGB Color

RGB color representation.

```typescript
interface RGBColor {
  r: number;                       // Red (0-255)
  g: number;                       // Green (0-255)
  b: number;                       // Blue (0-255)
}
```

### HSV Color

HSV color representation.

```typescript
interface HSVColor {
  h: number;                       // Hue (0-360)
  s: number;                       // Saturation (0-255)
  v: number;                       // Value/brightness (0-255)
}
```

## Type Guards

### Type checking utilities

```typescript
// Check if value is KeyboardInfo
function isKeyboardInfo(value: any): value is KeyboardInfo {
  return value &&
    typeof value.id === 'string' &&
    (!value.payload || typeof value.payload === 'object');
}

// Check if error is USB error
function isUSBError(error: any): error is DOMException {
  return error instanceof DOMException &&
    error.name === 'NetworkError';
}

// Check if browser supports WebHID
function hasWebHID(): boolean {
  return 'hid' in navigator;
}
```

## Generic Types

### AsyncResult

Generic async operation result.

```typescript
type AsyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Nullable

Nullable type helper.

```typescript
type Nullable<T> = T | null;
```

### DeepPartial

Deep partial type for nested objects.

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};
```

## Usage Examples

### Working with Types

```typescript
// Creating keyboard info
const keyboard: KeyboardInfo = {
  id: 'svalboard',
  payload: {
    name: 'Svalboard',
    vendorId: '0x1234',
    productId: '0x5678',
    matrix: { rows: 5, cols: 14 },
    layouts: { keymap: [] }
  },
  matrix: Array(16).fill(null).map(() =>
    Array(5).fill(null).map(() =>
      Array(14).fill(0x0000)
    )
  )
};

// Type-safe USB operations
const options: USBSendOptions = {
  dtype: 'uint16',
  unpack: 'H',
  endianness: 'big'
};

// Component props
const keyProps: KeyProps = {
  position: { x: 0, y: 0, width: 1.5 },
  label: 'Tab',
  onClick: () => console.log('Key clicked'),
  isSelected: false
};
```

### Type Narrowing

```typescript
// Narrowing with discriminated unions
type KeyAction =
  | { type: 'tap'; keycode: number }
  | { type: 'hold'; keycode: number; duration: number }
  | { type: 'combo'; keys: number[] };

function processAction(action: KeyAction) {
  switch (action.type) {
    case 'tap':
      // action.keycode is available
      break;
    case 'hold':
      // action.keycode and action.duration are available
      break;
    case 'combo':
      // action.keys is available
      break;
  }
}
```