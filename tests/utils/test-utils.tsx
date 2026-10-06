import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { renderHook as rtlRenderHook, RenderHookOptions } from '@testing-library/react';
import { KeyboardProvider } from '../../src/contexts/KeyboardContext';
import type { KeyboardInfo } from '../../src/types/keyboard.types';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';
import { vi } from 'vitest';

// Mock context values
export interface MockKeyboardContextValue {
  keyboard: KeyboardInfo | null;
  isConnected: boolean;
  connect: (filters?: HIDDeviceFilter[]) => Promise<boolean>;
  disconnect: () => Promise<void>;
  loadKeyboard: () => Promise<void>;
  updateKey: (layer: number, row: number, col: number, keymask: number) => Promise<void>;
}

// Default mock context value
export const createMockKeyboardContextValue = (
  overrides?: Partial<MockKeyboardContextValue>
): MockKeyboardContextValue => ({
  keyboard: null,
  isConnected: false,
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  loadKeyboard: vi.fn().mockResolvedValue(undefined),
  updateKey: vi.fn().mockResolvedValue(undefined),
  ...overrides
});

// Mock provider for testing
export const MockKeyboardProvider: React.FC<{
  children: React.ReactNode;
  value?: Partial<MockKeyboardContextValue>;
}> = ({ children, value }) => {
  const mockValue = createMockKeyboardContextValue(value);

  // We need to mock the actual context module
  const KeyboardContext = React.createContext<MockKeyboardContextValue | undefined>(undefined);

  return (
    <KeyboardContext.Provider value={mockValue}>
      {children}
    </KeyboardContext.Provider>
  );
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  keyboardContextValue?: Partial<MockKeyboardContextValue>;
}

export function render(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const { keyboardContextValue, ...renderOptions } = options || {};

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (keyboardContextValue !== undefined) {
      return (
        <MockKeyboardProvider value={keyboardContextValue}>
          {children}
        </MockKeyboardProvider>
      );
    }
    return <KeyboardProvider>{children}</KeyboardProvider>;
  };

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Custom renderHook with providers
interface CustomRenderHookOptions<TProps> extends Omit<RenderHookOptions<TProps>, 'wrapper'> {
  keyboardContextValue?: Partial<MockKeyboardContextValue>;
}

export function renderHook<TResult, TProps = {}>(
  hook: (props: TProps) => TResult,
  options?: CustomRenderHookOptions<TProps>
) {
  const { keyboardContextValue, ...renderOptions } = options || {};

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (keyboardContextValue !== undefined) {
      return (
        <MockKeyboardProvider value={keyboardContextValue}>
          {children}
        </MockKeyboardProvider>
      );
    }
    return <KeyboardProvider>{children}</KeyboardProvider>;
  };

  return rtlRenderHook(hook, { wrapper: Wrapper, ...renderOptions });
}

// Factory functions for common test scenarios
export const testScenarios = {
  // Disconnected state (default)
  disconnected: (): Partial<MockKeyboardContextValue> => ({
    keyboard: null,
    isConnected: false
  }),

  // Connected with keyboard loaded
  connected: (): Partial<MockKeyboardContextValue> => ({
    keyboard: createTestKeyboardInfo(),
    isConnected: true
  }),

  // Connecting state
  connecting: (): Partial<MockKeyboardContextValue> => ({
    keyboard: null,
    isConnected: false,
    connect: vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(true), 100))
    )
  }),

  // Loading keyboard state
  loading: (): Partial<MockKeyboardContextValue> => ({
    keyboard: null,
    isConnected: true,
    loadKeyboard: vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 100))
    )
  }),

  // Error state
  error: (): Partial<MockKeyboardContextValue> => ({
    keyboard: null,
    isConnected: false,
    connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
    loadKeyboard: vi.fn().mockRejectedValue(new Error('Load failed'))
  }),

  // With custom keyboard
  withKeyboard: (keyboard: KeyboardInfo): Partial<MockKeyboardContextValue> => ({
    keyboard,
    isConnected: true
  })
};

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Export act for async operations
export { act } from '@testing-library/react';