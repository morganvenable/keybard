# KeyBard-NG API Documentation

## Service APIs

### KeyboardService

Primary service for Sval protocol operations.

#### Methods

##### `load(kbinfo: KeyboardInfo): Promise<KeyboardInfo>`
Loads complete keyboard configuration from connected device.

**Parameters:**
- `kbinfo`: Initial keyboard info object to populate

**Returns:** Promise resolving to populated KeyboardInfo

**Example:**
```typescript
const info = await keyboardService.load(initialInfo);
```

---

##### `getKeyboardInfo(): Promise<KeyboardPayload>`
Retrieves and decompresses keyboard layout definition.

**Returns:** Promise resolving to keyboard payload with layout structure

**Protocol:** Uses VIA commands 0x01 (protocol version) and Sval GET_INFO (keyboard info)

---

##### `getKeyMap(kbinfo: KeyboardInfo): Promise<void>`
Fetches all layer keycodes from keyboard.

**Parameters:**
- `kbinfo`: Keyboard info to populate with keymap data

**Note:** Modifies kbinfo.matrix in-place

---

##### `updateKey(layer: number, row: number, col: number, keymask: number): Promise<void>`
Updates a single key mapping on the keyboard.

**Parameters:**
- `layer`: Layer index (0-based)
- `row`: Matrix row position
- `col`: Matrix column position
- `keymask`: 16-bit keycode value

**Example:**
```typescript
await keyboardService.updateKey(0, 1, 2, 0x0004); // Set KC_A on layer 0
```

---

##### `pollMatrix(): Promise<Uint8Array>`
Polls current key press state from keyboard matrix.

**Returns:** Promise resolving to array of pressed key states

---

### QMKService

Manages QMK configuration settings.

#### Methods

##### `get(kbinfo: KeyboardInfo): Promise<void>`
Queries and fetches all QMK settings from keyboard.

**Parameters:**
- `kbinfo`: Keyboard info to populate with settings

**Protocol:** Uses QMK commands 0x06 (query) and 0x07 (get)

---

##### `push(qsid: number, val: number): Promise<void>`
Updates a QMK setting on the keyboard.

**Parameters:**
- `qsid`: QMK Setting ID
- `val`: New value to set

**Example:**
```typescript
await qmkService.push(1, 1); // Enable auto shift
```

---

### SvalService

Svalboard-specific protocol extensions.

#### Methods

##### `check(): Promise<boolean>`
Verifies if connected keyboard supports Svalboard protocol.

**Returns:** Promise resolving to true if Svalboard detected

---

##### `pull(kbinfo: KeyboardInfo): Promise<void>`
Fetches Svalboard-specific data (layer colors, names).

**Parameters:**
- `kbinfo`: Keyboard info to populate with Svalboard data

---

##### `setLayerColor(layer: number, h: number, s: number, v: number): Promise<void>`
Updates layer indicator color.

**Parameters:**
- `layer`: Layer index (0-based)
- `h`: Hue (0-360)
- `s`: Saturation (0-255)
- `v`: Value/brightness (0-255)

---

##### `setLayerName(layer: number, name: string): Promise<void>`
Sets custom layer name (cosmetic only).

**Parameters:**
- `layer`: Layer index
- `name`: Display name (max 16 chars)

---

### KeyService

Keycode translation and management utilities.

#### Methods

##### `stringify(keymask: number): string`
Converts numeric keycode to string representation.

**Parameters:**
- `keymask`: 16-bit keycode value

**Returns:** String representation (e.g., "KC_A", "LCTRL(KC_C)")

**Example:**
```typescript
keyService.stringify(0x0004); // Returns "KC_A"
keyService.stringify(0x01E0); // Returns "KC_LCTRL"
```

---

##### `parse(keystr: string): number`
Parses string keycode to numeric value.

**Parameters:**
- `keystr`: String representation of key

**Returns:** 16-bit keycode value

**Example:**
```typescript
keyService.parse("KC_A"); // Returns 0x0004
keyService.parse("LCTRL(KC_C)"); // Returns 0x0106
```

---

##### `define(alias: string, value: string | number): void`
Defines a custom keycode alias.

**Parameters:**
- `alias`: Alias name
- `value`: Target keycode (string or numeric)

---

##### `parseDesc(keystr: string): object`
Parses key descriptor for UI rendering.

**Parameters:**
- `keystr`: Key string (e.g., "TD(0)", "MO(1)")

**Returns:** Object with properties:
- `value`: Numeric parameter
- `tap?`: Additional tap parameter

---

### SvilUSB

Low-level USB communication service.

#### Methods

##### `open(filters?: USBDeviceFilter[]): Promise<void>`
Opens connection to USB device.

**Parameters:**
- `filters`: Optional USB device filters

**Throws:** Error if WebHID not supported or connection fails

---

##### `send(cmd: number, args?: any[], options?: USBSendOptions): Promise<any>`
Sends command to keyboard and awaits response.

**Parameters:**
- `cmd`: Command byte
- `args`: Command arguments
- `options`: Send options (unpacking format, data type)

**Returns:** Promise resolving to command response

**Options:**
```typescript
interface USBSendOptions {
  unpack?: string;      // Python struct format
  dtype?: 'uint8' | 'uint16' | 'uint32';
  indexed?: boolean;    // Return as object vs array
  endianness?: 'little' | 'big';
}
```

---

##### `sendReport(reportId: number, data: Uint8Array): Promise<void>`
Sends raw HID report to device.

**Parameters:**
- `reportId`: HID report ID (usually 0)
- `data`: Report payload

---

##### `close(): void`
Closes USB connection and cleans up resources.

---

## React Context API

### KeyboardContext

Central state management for keyboard operations.

#### Hook Usage

```typescript
import { useKeyboard } from './contexts/KeyboardContext';

function MyComponent() {
  const {
    keyboard,        // Current keyboard info
    isConnected,     // Connection state
    isLoading,       // Loading state
    error,           // Error message
    connect,         // Connect function
    disconnect,      // Disconnect function
    loadKeyboard,    // Load keyboard data
    updateKey        // Update key mapping
  } = useKeyboard();
}
```

#### Context Shape

```typescript
interface KeyboardContextType {
  keyboard: KeyboardInfo | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  loadKeyboard: () => Promise<void>;
  updateKey: (layer: number, row: number, col: number, keymask: number) => Promise<void>;
}
```

## Type Definitions

### KeyboardInfo

Central keyboard state container:

```typescript
interface KeyboardInfo {
  id: string;           // Unique keyboard identifier
  payload?: KeyboardPayload;  // Layout definition
  matrix?: number[][];  // Keymap data (layers × rows × cols)
  features?: {
    macros?: MacroData[];
    combos?: ComboData[];
    tapdance?: TapdanceData[];
    overrides?: KeyOverrideData[];
  };
  settings?: Record<number, number>;  // QMK settings
  sval?: {
    layerColors?: Array<[number, number, number]>;
    layerNames?: string[];
  };
}
```

### KeyboardPayload

Decompressed keyboard layout structure:

```typescript
interface KeyboardPayload {
  name: string;         // Display name
  vendorId: string;     // USB VID
  productId: string;    // USB PID
  matrix: {
    rows: number;
    cols: number;
  };
  layouts: {
    keymap?: Array<Array<any>>;  // Physical layout
    labels?: string[];            // Layout options
  };
  customKeycodes?: CustomKeycode[];
  lighting?: 'none' | 'qmk_backlight' | 'qmk_rgblight';
}
```

### USB Protocol Constants

```typescript
// VIA Commands
const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
const CMD_VIA_GET_KEYBOARD_VALUE = 0x02;
const CMD_VIA_SET_KEYBOARD_VALUE = 0x03;
const CMD_VIA_GET_KEYCODE = 0x04;
const CMD_VIA_SET_KEYCODE = 0x05;

// Sval commands use 0xDF inside the 0xDD client-ID wrapper.
// See src/services/usb.service.ts for the authoritative command registry.

// QMK Commands
const CMD_VIA_QMK_PREFIX = 0x00;
const CMD_VIA_QMK_GET_SETTINGS = 0x06;
const CMD_VIA_QMK_SET_SETTINGS = 0x07;
```

## Error Handling

All service methods follow consistent error patterns:

```typescript
try {
  const result = await service.method();
  // Handle success
} catch (error) {
  if (error.message.includes('WebHID')) {
    // Browser compatibility issue
  } else if (error.message.includes('Device')) {
    // Connection issue
  } else {
    // Protocol error
  }
}
```

Common error types:
- `WebHID not supported`: Browser compatibility
- `No device selected`: User cancelled selection
- `Device disconnected`: Lost USB connection
- `Invalid response`: Protocol mismatch
- `Timeout`: Command didn't respond

## Usage Examples

### Basic Connection Flow

```typescript
// 1. Connect to keyboard
await connect();

// 2. Load keyboard configuration
await loadKeyboard();

// 3. Access keyboard data
const { keyboard } = useKeyboard();
console.log(keyboard.payload.name);
console.log(keyboard.matrix[0][0][0]); // Layer 0, row 0, col 0

// 4. Update a key
await updateKey(0, 1, 2, keyService.parse("KC_SPACE"));

// 5. Disconnect when done
disconnect();
```

### Working with QMK Settings

```typescript
// Get current settings
await qmkService.get(keyboard);

// Check auto shift state
const autoShiftEnabled = keyboard.settings[1] & 1;

// Enable auto shift
await qmkService.push(1, 1);
```

### Custom Keycodes

```typescript
// Define custom alias
keyService.define("MY_MACRO", "USER00");

// Use in keymap
const keycode = keyService.parse("MY_MACRO");
await keyboardService.updateKey(0, 1, 1, keycode);
```