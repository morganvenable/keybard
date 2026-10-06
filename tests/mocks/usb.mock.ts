import type { SvilUSB } from '../../src/services/usb.service';

export interface MockUSBControl {
  setConnected: (connected: boolean) => void;
  setShouldFail: (shouldFail: boolean) => void;
  setResponseData: (data: Uint8Array | ((cmd: Uint8Array) => Uint8Array)) => void;
  triggerDisconnect: () => void;
  resetStats: () => void;
  getStats: () => MockUSBStats;
}

export interface MockUSBStats {
  openCalls: number;
  closeCalls: number;
  sendCalls: number;
  sendFeatureCalls: number;
  lastSentData: Uint8Array | null;
  lastReportId: number | null;
}

class MockUSBInstance implements Partial<SvilUSB> {
  private connected = false;
  private shouldFail = false;
  private responseData: Uint8Array | ((cmd: Uint8Array) => Uint8Array) = new Uint8Array(32);
  private stats: MockUSBStats = {
    openCalls: 0,
    closeCalls: 0,
    sendCalls: 0,
    sendFeatureCalls: 0,
    lastSentData: null,
    lastReportId: null
  };

  public hidDevice: HIDDevice | null = null;

  async open(_filters?: HIDDeviceFilter[]): Promise<boolean> {
    this.stats.openCalls++;

    if (this.shouldFail) {
      this.connected = false;
      return false;
    }

    // Simulate successful connection
    this.connected = true;
    this.hidDevice = {
      vendorId: 0x1234,
      productId: 0x5678,
      productName: 'Mock Keyboard',
      opened: true,
      collections: [{
        usage: 0x61,
        usagePage: 0xff60,
        inputReports: [],
        outputReports: [],
        featureReports: []
      }]
    } as unknown as HIDDevice;

    return true;
  }

  async close(): Promise<void> {
    this.stats.closeCalls++;
    this.connected = false;
    this.hidDevice = null;
  }

  async send(cmd: number, args: number[], options?: any): Promise<any> {
    this.stats.sendCalls++;
    // Convert command and args to Uint8Array for internal tracking
    const data = new Uint8Array([cmd, ...args]);
    this.stats.lastSentData = data;
    this.stats.lastReportId = null;

    if (!this.connected) {
      throw new Error('USB device not connected');
    }

    if (this.shouldFail) {
      throw new Error('USB communication failed');
    }

    // Return mock response based on command
    if (typeof this.responseData === 'function') {
      return this.responseData(data);
    }
    return this.responseData;
  }

  async sendSvil(cmd: number, args: number[], options?: any): Promise<any> {
    // Svil commands are sent with 0xDF prefix (wrapped in 0xDD client wrapper)
    // For testing, we simulate the response without the actual wrapper
    this.stats.sendCalls++;
    const data = new Uint8Array([0xDF, cmd, ...args]);
    this.stats.lastSentData = data;
    this.stats.lastReportId = null;

    if (!this.connected) {
      throw new Error('USB device not connected');
    }

    if (this.shouldFail) {
      throw new Error('USB communication failed');
    }

    // Return mock response based on command
    if (typeof this.responseData === 'function') {
      return this.responseData(data);
    }

    // Handle different response formats based on options
    if (options?.uint16) {
      return new Uint16Array(this.responseData.buffer);
    }
    if (options?.uint8) {
      return this.responseData;
    }
    if (options?.unpack) {
      // Simple unpack simulation - return array of values
      const result = [];
      for (let i = 0; i < this.responseData.length; i++) {
        result.push(this.responseData[i]);
      }
      return result;
    }
    return this.responseData;
  }

  async getViaBuffer(cmd: number, size: number, options?: any): Promise<Uint8Array> {
    // Mock implementation for buffer operations
    const buffer = new Uint8Array(size);
    // Fill with mock data
    for (let i = 0; i < size; i++) {
      buffer[i] = i % 256;
    }
    return buffer;
  }

  async pushViaBuffer(cmd: number, size: number, data: ArrayBuffer): Promise<void> {
    // Mock implementation for buffer push
    this.stats.sendCalls++;
    this.stats.lastSentData = new Uint8Array(data);
  }

  async getDynamicEntries(dynamicCmd: number, count: number, options?: any): Promise<any[]> {
    // Mock implementation for dynamic entries
    const entries = [];
    for (let i = 0; i < count; i++) {
      entries.push(new Uint8Array([i]));
    }
    return entries;
  }

  async sendFeatureReport(reportId: number, data: Uint8Array): Promise<void> {
    this.stats.sendFeatureCalls++;
    this.stats.lastSentData = data;
    this.stats.lastReportId = reportId;

    if (!this.connected) {
      throw new Error('USB device not connected');
    }

    if (this.shouldFail) {
      throw new Error('Feature report failed');
    }
  }

  isOpen(): boolean {
    return this.connected;
  }

  // Control methods
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (connected && !this.hidDevice) {
      this.hidDevice = {
        vendorId: 0x1234,
        productId: 0x5678,
        productName: 'Mock Keyboard',
        opened: true,
        collections: []
      } as unknown as HIDDevice;
    } else if (!connected) {
      this.hidDevice = null;
    }
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setResponseData(data: Uint8Array | ((cmd: Uint8Array) => Uint8Array)): void {
    this.responseData = data;
  }

  triggerDisconnect(): void {
    this.connected = false;
    this.hidDevice = null;
    // Could emit disconnect event if needed
  }

  resetStats(): void {
    this.stats = {
      openCalls: 0,
      closeCalls: 0,
      sendCalls: 0,
      sendFeatureCalls: 0,
      lastSentData: null,
      lastReportId: null
    };
  }

  getStats(): MockUSBStats {
    return { ...this.stats };
  }
}

export function createMockUSB(): { mock: SvilUSB; control: MockUSBControl } {
  const instance = new MockUSBInstance();

  const control: MockUSBControl = {
    setConnected: (connected: boolean) => instance.setConnected(connected),
    setShouldFail: (shouldFail: boolean) => instance.setShouldFail(shouldFail),
    setResponseData: (data: Uint8Array | ((cmd: Uint8Array) => Uint8Array)) =>
      instance.setResponseData(data),
    triggerDisconnect: () => instance.triggerDisconnect(),
    resetStats: () => instance.resetStats(),
    getStats: () => instance.getStats()
  };

  return {
    mock: instance as unknown as SvilUSB,
    control
  };
}

// Helper functions for common USB responses
export const USBResponses = {
  // Via protocol version response
  viaVersion: (version = 0x0C): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0x01; // Via protocol
    response[1] = version;
    return response;
  },

  // Keyboard ID response
  keyboardId: (id = 'test_kb'): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0xFE;
    response[1] = 0x02; // Get keyboard ID command
    const encoded = new TextEncoder().encode(id);
    response.set(encoded.slice(0, 30), 2);
    return response;
  },

  // Matrix size response
  matrixSize: (rows = 5, cols = 14): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0xFE;
    response[1] = 0x03; // Get matrix size
    response[2] = rows;
    response[3] = cols;
    return response;
  },

  // Layer count response
  layerCount: (layers = 4): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0xFE;
    response[1] = 0x11; // Get layer count
    response[2] = layers;
    return response;
  },

  // Keymap value response
  keymapValue: (layer: number, row: number, col: number, keycode: number): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0x04; // Get keymap value
    response[1] = layer;
    response[2] = row;
    response[3] = col;
    response[4] = (keycode >> 8) & 0xFF;
    response[5] = keycode & 0xFF;
    return response;
  },

  // QMK settings response
  qmkSettings: (_settings: Record<number, number>): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0xFE;
    response[1] = 0x20; // QMK settings command
    // Encode settings as needed
    return response;
  },

  // Error response
  error: (errorCode = 0xFF): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0xFF; // Error indicator
    response[1] = errorCode;
    return response;
  },

  // Success/ACK response
  success: (): Uint8Array => {
    const response = new Uint8Array(32);
    response[0] = 0x01; // ACK
    return response;
  }
};

// Helper to simulate disconnection scenarios
export function simulateUSBDisconnect(_mock: SvilUSB, control: MockUSBControl): void {
  control.triggerDisconnect();
  control.setShouldFail(true);
}

// Helper to simulate permission denied
export function simulatePermissionDenied(control: MockUSBControl): void {
  control.setShouldFail(true);
  control.setResponseData(USBResponses.error(0x01)); // Permission denied error
}

// Helper to create a mock that responds like a real keyboard
export function createRealisticKeyboardMock(): { mock: SvilUSB; control: MockUSBControl } {
  const { mock, control } = createMockUSB();

  // Set up realistic responses based on command
  control.setResponseData((cmd: Uint8Array) => {
    const command = cmd[0];

    // Via protocol commands
    if (command === 0x01) {
      return USBResponses.viaVersion();
    }

    // Keymap commands
    if (command === 0x04) { // Get keymap value
      const layer = cmd[1];
      const row = cmd[2];
      const col = cmd[3];
      return USBResponses.keymapValue(layer, row, col, 0x04); // Return KC_A
    }

    if (command === 0x05) { // Set keymap value
      return USBResponses.success();
    }

    // Default response
    return USBResponses.success();
  });

  return { mock, control };
}
