import type { KeyboardInfo, CustomKeycode, MacroData, ComboData, TapdanceData, KeyOverrideData } from '../../src/types/keyboard.types';
import type { QMKSettings, QMKSettingsTab } from '../../src/types/qmk';

// Test constants
export const TEST_VENDOR_ID = 0x1234;
export const TEST_PRODUCT_ID = 0x5678;
export const TEST_DEVICE_NAME = 'Test Svalboard';

// Extended types for testing
export interface TestKeyboardInfo extends KeyboardInfo {
  // Ensures all optional properties are defined for testing
  via_proto: number;

  kbid: string;
  layers: number;
  custom_keycodes: CustomKeycode[];
  keymap: string[][];
  macros: MacroData;
  macro_count: number;
  macros_size: number;
  settings: Record<number, number>;
}

export interface TestQMKSettings extends QMKSettings {
  tabs: QMKSettingsTab[];
}

// Factory function signatures
export type KeyboardInfoFactory = (overrides?: Partial<KeyboardInfo>) => KeyboardInfo;
export type QMKSettingsFactory = (overrides?: Partial<QMKSettings>) => QMKSettings;

// Keymap test types
export interface TestKeymap {
  [key: string]: {
    code: number;
    qmkid?: string;
    str?: string;
    title?: string;
    type?: string;
    idx?: number;
  };
}

export interface TestCodemap {
  [code: number]: string;
}

export interface TestKeyaliases {
  [alias: string]: string;
}

// Common test data structures
export interface TestLayer {
  layer: number;
  keys: string[][];
}

export interface TestMacro {
  id: number;
  name: string;
  actions: string[];
}

export interface TestCustomKeycode {
  index: number;
  name: string;
  shortName: string;
  title: string;
}

// Helper types for test scenarios
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TestUSBResponse {
  data: Uint8Array;
  reportId?: number;
  error?: Error;
}

export interface TestScenario {
  name: string;
  setup: () => void;
  expectedResult: any;
  teardown?: () => void;
}