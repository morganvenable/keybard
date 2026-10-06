# KeyBard-NG Component Documentation

## Component Overview

React components that make up the KeyBard-NG user interface, organized by responsibility and hierarchy.

## Component Hierarchy

```
App
└── KeyboardProvider
    └── KeyboardConnector
        ├── Connection UI
        ├── Keyboard
        │   └── Key (multiple instances)
        └── QMKSettings
```

## Core Components

### App Component

**Location:** `src/App.tsx`

Root component that sets up the application context.

**Responsibilities:**
- Wraps application with KeyboardProvider
- Provides global error boundaries
- Sets up theme and styling

**Usage:**
```tsx
function App() {
  return (
    <KeyboardProvider>
      <KeyboardConnector />
    </KeyboardProvider>
  );
}
```

---

### KeyboardProvider

**Location:** `src/contexts/KeyboardContext.tsx`

Context provider for keyboard state and operations.

**Props:**
- `children`: React children components

**Provides:**
- Keyboard connection state
- Loading and error states
- Connection/disconnection methods
- Keyboard data loading
- Key update operations

**Usage:**
```tsx
<KeyboardProvider>
  {/* Child components can access useKeyboard() hook */}
</KeyboardProvider>
```

---

### KeyboardConnector

**Location:** `src/components/KeyboardConnector.tsx`

Main orchestration component for keyboard connection and UI.

**Responsibilities:**
- WebHID browser support detection
- Connection/disconnection UI
- Loading state management
- Error display
- Conditional rendering of keyboard UI

**State Management:**
- Uses `useKeyboard()` hook for all keyboard operations
- Manages local UI state for user interactions

**Rendered UI:**
```tsx
<div className="keyboard-connector">
  {/* Connection controls */}
  <button onClick={connect}>Connect Keyboard</button>

  {/* Keyboard info display */}
  {keyboard && (
    <>
      <div>Connected: {keyboard.payload.name}</div>
      <Keyboard />
      <QMKSettings />
    </>
  )}
</div>
```

**Error Handling:**
- Displays browser compatibility warnings
- Shows connection errors
- Handles loading states gracefully

---

### Keyboard

**Location:** `src/components/Keyboard.tsx`

Visual keyboard layout renderer with layer management.

**Props:**
None (uses context)

**State:**
- `selectedLayer`: Currently viewed layer (0-15)
- `selectedKey`: Currently selected key position

**Features:**
- Layer selection with visual indicators
- HSV to RGB color conversion for layer colors
- Key layout rendering from SVALBOARD_LAYOUT
- Click handling for key selection
- Keycode to label translation

**Layout Rendering:**
```tsx
{SVALBOARD_LAYOUT[selectedLayer].map((row, rowIndex) =>
  row.map((col, colIndex) => (
    <Key
      key={`${rowIndex}-${colIndex}`}
      position={getKeyPosition(rowIndex, colIndex)}
      label={getKeyLabel(selectedLayer, rowIndex, colIndex)}
      onClick={() => selectKey(rowIndex, colIndex)}
      isSelected={isKeySelected(rowIndex, colIndex)}
    />
  ))
)}
```

**Layer Colors:**
Converts HSV values from Svalboard to RGB for display:
```typescript
function hsvToRgb(h: number, s: number, v: number): string {
  // Conversion logic
  return `rgb(${r}, ${g}, ${b})`;
}
```

**Key Label Resolution:**
1. Gets keycode from matrix
2. Translates via KeyService
3. Applies display transformations
4. Shows special indicators for layers/macros

---

### Key

**Location:** `src/components/Key.tsx`

Individual key component for keyboard visualization.

**Props:**
```typescript
interface KeyProps {
  position: {
    x: number;      // X coordinate in units
    y: number;      // Y coordinate in units
    width?: number; // Width in units (default: 1)
    height?: number;// Height in units (default: 1)
  };
  label: string;    // Display text
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}
```

**Styling:**
- Absolute positioning based on UNIT_SIZE (60px)
- Dynamic sizing for non-standard keys
- Visual states: default, hover, selected
- Responsive to container scaling

**Example Usage:**
```tsx
<Key
  position={{ x: 0, y: 0, width: 1.5 }}
  label="Tab"
  onClick={() => handleKeyClick(0, 0)}
  isSelected={selectedKey === '0-0'}
/>
```

**CSS Classes:**
- `.key`: Base key styling
- `.key-selected`: Selected state
- `.key-hover`: Hover state
- `.key-modifier`: Special modifier keys
- `.key-layer`: Layer switching keys

---

### QMKSettings

**Location:** `src/components/QMKSettings.tsx`

QMK configuration settings display component.

**Props:**
None (uses context)

**Features:**
- Tab-based organization
- Boolean fields (checkboxes)
- Integer fields (number inputs)
- Read-only display (updates pending)
- Bit manipulation for boolean extraction

**Settings Structure:**
```typescript
// From QMK_SETTINGS constant
{
  tabs: [
    {
      name: "Auto Shift",
      fields: [
        { type: "boolean", label: "Enabled", qsid: 1, bit: 0 },
        { type: "integer", label: "Timeout", qsid: 2 }
      ]
    }
  ]
}
```

**Field Rendering:**
```tsx
{field.type === 'boolean' ? (
  <input
    type="checkbox"
    checked={(settings[field.qsid] >> field.bit) & 1}
    disabled // Read-only for now
  />
) : (
  <input
    type="number"
    value={settings[field.qsid]}
    disabled // Read-only for now
  />
)}
```

---

## Component Patterns

### Context Usage

All components access keyboard state via the `useKeyboard` hook:

```typescript
function MyComponent() {
  const { keyboard, isConnected, updateKey } = useKeyboard();

  if (!isConnected) {
    return <div>Please connect a keyboard</div>;
  }

  return <div>{keyboard?.payload.name}</div>;
}
```

### Error Boundaries

Components should handle potential errors gracefully:

```typescript
try {
  await updateKey(layer, row, col, keymask);
} catch (error) {
  console.error('Failed to update key:', error);
  // Show user-friendly error message
}
```

### Performance Optimization

Key components use React.memo for optimization:

```typescript
export const Key = React.memo(({ position, label, onClick }: KeyProps) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return prevProps.label === nextProps.label &&
         prevProps.isSelected === nextProps.isSelected;
});
```

## Styling Architecture

### CSS Organization

```
src/styles/
├── components/
│   ├── Keyboard.css
│   ├── Key.css
│   └── QMKSettings.css
├── themes/
│   ├── light.css
│   └── dark.css
└── index.css      // Global styles
```

### Design Tokens

```css
:root {
  /* Spacing */
  --unit-size: 60px;
  --key-gap: 4px;

  /* Colors */
  --key-bg: #f0f0f0;
  --key-border: #ccc;
  --key-selected: #4CAF50;
  --key-hover: #e0e0e0;

  /* Typography */
  --key-font-size: 14px;
  --key-font-family: monospace;
}
```

### Responsive Design

Components adapt to container size:

```css
.keyboard-container {
  max-width: 100%;
  overflow-x: auto;
}

.keyboard-grid {
  position: relative;
  width: calc(var(--unit-size) * 15);
  height: calc(var(--unit-size) * 5);
  transform-origin: top left;
  scale: var(--keyboard-scale, 1);
}
```

## Component Testing

### Testing Strategy

```typescript
// Component test example
describe('Keyboard Component', () => {
  it('renders all keys for selected layer', () => {
    const { getAllByRole } = render(
      <KeyboardProvider>
        <Keyboard />
      </KeyboardProvider>
    );

    const keys = getAllByRole('button');
    expect(keys).toHaveLength(EXPECTED_KEY_COUNT);
  });

  it('handles key selection', async () => {
    const { getByText } = render(<Keyboard />);
    const key = getByText('KC_A');

    await userEvent.click(key);
    expect(key).toHaveClass('key-selected');
  });
});
```

### Mock Context

```typescript
const mockKeyboardContext = {
  keyboard: mockKeyboardInfo,
  isConnected: true,
  isLoading: false,
  error: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  loadKeyboard: jest.fn(),
  updateKey: jest.fn()
};

<KeyboardContext.Provider value={mockKeyboardContext}>
  <ComponentUnderTest />
</KeyboardContext.Provider>
```

## Future Component Enhancements

### Planned Components

1. **MacroEditor**: Create and edit keyboard macros
2. **ComboConfig**: Configure key combinations
3. **TapDanceEditor**: Set up tap dance sequences
4. **LayerManager**: Advanced layer configuration
5. **KeymapImporter**: Import/export keymap files
6. **FirmwareUpdater**: OTA firmware updates

### Component Roadmap

```
Phase 1 (Current):
├── KeyboardConnector ✓
├── Keyboard ✓
├── Key ✓
└── QMKSettings ✓

Phase 2 (Next):
├── KeyEditor (key customization)
├── MacroEditor
└── LayerManager

Phase 3 (Future):
├── ComboConfig
├── TapDanceEditor
├── KeymapImporter
└── FirmwareUpdater
```

## Accessibility

### Keyboard Navigation

- Tab navigation through all interactive elements
- Arrow keys for navigating keyboard grid
- Enter/Space for key selection
- Escape to deselect

### ARIA Attributes

```tsx
<div
  role="grid"
  aria-label="Keyboard layout"
  aria-rowcount={rows}
  aria-colcount={cols}
>
  <button
    role="gridcell"
    aria-label={`Key ${label} at row ${row} column ${col}`}
    aria-selected={isSelected}
    tabIndex={0}
  >
    {label}
  </button>
</div>
```

### Screen Reader Support

- Descriptive labels for all controls
- Status announcements for state changes
- Keyboard shortcuts documentation
- High contrast mode support