import type { KeyboardInfo, CustomKeycode, MacroData } from '../../src/types/keyboard.types';
import type { KeyboardInfoFactory, TestCustomKeycode } from './types';
import { TEST_VENDOR_ID, TEST_PRODUCT_ID } from './types';

// Minimal valid KeyboardInfo
export const minimalKeyboardInfo: KeyboardInfo = {
  rows: 4,
  cols: 12,
  layers: 1,
  via_proto: 12,

  kbid: 'minimal_test_kb',
  keymap: [[]],
  settings: {}
};

// Typical Svalboard configuration
export const typicalSvalboardInfo: KeyboardInfo = {
  rows: 5,
  cols: 14,
  layers: 4,
  via_proto: 12,

  kbid: 'svalboard_v1',
  custom_keycodes: [
    {
      name: 'LAYER_TAP_1',
      shortName: 'LT1',
      title: 'Layer Tap 1'
    },
    {
      name: 'LAYER_TAP_2',
      shortName: 'LT2',
      title: 'Layer Tap 2'
    }
  ],
  keymap: [
    // Layer 0 - Base layer (simplified) - 5 rows * 14 cols = 70 keys
    Array(5 * 14).fill('KC_A'),
    // Layer 1 - Number layer
    Array(5 * 14).fill('KC_1'),
    // Layer 2 - Symbol layer
    Array(5 * 14).fill('KC_EXLM'),
    // Layer 3 - Function layer
    Array(5 * 14).fill('KC_F1')
  ],
  macros: {
    buffer: new Uint8Array(256),
    size: 256,
    count: 2
  } as MacroData,
  macro_count: 2,
  macros_size: 256,
  settings: {
    0: 1,  // Feature enabled
    1: 100, // Timeout value
    2: 50  // Threshold value
  },
  payload: {
    matrix: {
      rows: 5,
      cols: 14
    },
    layouts: {
      'LAYOUT_svalboard': {
        col: 0,
        row: 0,
        color: '#cccccc',
        decal: false,
        ghost: false,
        h: 1,
        height2: 1,
        labels: [],
        nub: false,
        profile: '',
        rotation_angle: 0,
        rotation_x: 0,
        rotation_y: 0,
        sb: '',
        sm: '',
        st: '',
        stepped: false,
        text: '',
        textColor: '#000000',
        textSize: [3],
        w: 1,
        width2: 1,
        x: 0,
        x2: 0,
        y: 0,
        y2: 0
      }
    }
  }
};

// Complex configuration with many features
export const complexKeyboardInfo: KeyboardInfo = {
  rows: 6,
  cols: 16,
  layers: 8,
  via_proto: 12,

  kbid: 'complex_test_kb',
  custom_keycodes: Array(16).fill(null).map((_, i): CustomKeycode => ({
    name: `CUSTOM_${i}`,
    shortName: `C${i}`,
    title: `Custom Key ${i}`
  })),
  keymap: Array(8).fill(null).map((_, layer) => {
    // Create a flat array of keys for each layer (6 rows * 16 cols = 96 keys)
    return Array(6 * 16).fill(null).map((_, index) => {
      const col = index % 16;
      // Create varied keycodes based on layer and position
      if (layer === 0) return `KC_${String.fromCharCode(65 + (col % 26))}`;
      if (layer === 1) return `KC_${(col % 10)}`;
      if (layer === 2) return `KC_F${(col % 12) + 1}`;
      if (layer === 3) return col % 2 === 0 ? 'KC_LSFT' : 'KC_LCTL';
      return `M${col % 32}`; // Macro keys
    });
  }),
  macros: {
    buffer: new Uint8Array(2048),
    size: 2048,
    count: 32
  } as MacroData,
  macro_count: 32,
  macros_size: 2048,
  combos: {
    count: 8,
    entries: [] // Would contain ComboEntry objects with keys and output
  },
  tapdance: {
    count: 16,
    entries: [] // Would contain TapdanceEntry objects with tap/hold actions
  },
  key_overrides: {
    count: 32,
    entries: [] // Would contain KeyOverrideEntry objects
  },
  settings: Object.fromEntries(
    Array(20).fill(null).map((_, i) => [i, Math.floor(Math.random() * 255)])
  ),
  payload: {
    matrix: {
      rows: 6,
      cols: 16
    },
    customKeycodes: Array(16).fill(null).map((_, i): CustomKeycode => ({
      name: `CUSTOM_${i}`,
      shortName: `C${i}`,
      title: `Custom Key ${i}`
    }))
  }
};

// Factory function to create custom keyboard info
export const createTestKeyboardInfo: KeyboardInfoFactory = (overrides = {}) => {
  const base: KeyboardInfo = {
    rows: 5,
    cols: 14,
    layers: 4,
    via_proto: 12,

    kbid: 'test_keyboard',
    keymap: [[]],
    settings: {}
  };

  const merged = { ...base, ...overrides };

  // Auto-generate keymap if not provided but layers/rows/cols are set
  if ((!overrides.keymap || overrides.keymap.length === 0) &&
      merged.layers && merged.rows && merged.cols) {
    merged.keymap = Array(merged.layers).fill(null).map(() =>
      // Each layer is a flat array of rows * cols keys
      Array(merged.rows * merged.cols).fill('KC_NO')
    );
  }

  return merged;
};

// Helper to generate random valid keyboard data
export const generateRandomKeyboardInfo = (): KeyboardInfo => {
  const rows = Math.floor(Math.random() * 6) + 2; // 2-7 rows
  const cols = Math.floor(Math.random() * 16) + 8; // 8-23 cols
  const layers = Math.floor(Math.random() * 8) + 1; // 1-8 layers
  const macroCount = Math.floor(Math.random() * 32);

  return createTestKeyboardInfo({
    rows,
    cols,
    layers,
    macro_count: macroCount,
    macros_size: macroCount * 64,
    macros: macroCount > 0 ? {
      buffer: new Uint8Array(macroCount * 64),
      size: macroCount * 64,
      count: macroCount
    } as MacroData : undefined,
    custom_keycodes: Array(Math.floor(Math.random() * 16)).fill(null)
      .map((_, i): CustomKeycode => ({
        name: `RND_${i}`,
        shortName: `R${i}`,
        title: `Random Key ${i}`
      })),
    settings: Object.fromEntries(
      Array(Math.floor(Math.random() * 10)).fill(null)
        .map((_, i) => [i, Math.floor(Math.random() * 255)])
    )
  });
};

// Common test scenarios
export const testScenarios = {
  disconnected: createTestKeyboardInfo({ kbid: undefined }),
  minimal: minimalKeyboardInfo,
  typical: typicalSvalboardInfo,
  complex: complexKeyboardInfo,
  noLayers: createTestKeyboardInfo({ layers: 0 }),
  noMacros: createTestKeyboardInfo({ macro_count: 0 }),
  maxLayers: createTestKeyboardInfo({ layers: 32 }),
  largeMatrix: createTestKeyboardInfo({ rows: 10, cols: 20 })
};
