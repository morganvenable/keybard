import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { KeyboardProvider, useKeyboard } from '../../src/contexts/KeyboardContext';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

// Mock the services
vi.mock('../../src/services/file.service', () => ({
  fileService: {
    loadFile: vi.fn(),
  },
}));

vi.mock('../../src/services/keyboard.service', () => ({
  keyboardService: {
    init: vi.fn(),
    load: vi.fn(),
    updateKey: vi.fn(),
    getActiveLayerIndex: vi.fn().mockResolvedValue(0),
  },
  KeyboardService: {
    isWebHIDSupported: vi.fn(() => true),
  },
}));

vi.mock('../../src/services/qmk.service', () => ({
  qmkService: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/services/usb.service', () => ({
  usbInstance: {
    open: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    getDeviceName: vi.fn(),
    getAllLayerColors: vi.fn().mockResolvedValue([]),
  },
}));

import { fileService } from '../../src/services/file.service';
import { usbInstance } from '../../src/services/usb.service';
import { KeyboardService, keyboardService } from '../../src/services/keyboard.service';

describe('KeyboardContext - File Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <KeyboardProvider>{children}</KeyboardProvider>
  );

  it('uses the real USB connection even on a host-served page', async () => {
    document.documentElement.dataset.keybardHost = 'true';
    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(keyboardService.init).mockResolvedValue(undefined);
    vi.mocked(keyboardService.load).mockResolvedValue({ rows: 10, cols: 6, keymap: [Array(60).fill(4)] });
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    try {
      await act(async () => { await result.current.connect(); });
      expect(usbInstance.open).toHaveBeenCalledTimes(1);
      expect(result.current.isConnected).toBe(true);
      expect(keyboardService.load).toHaveBeenCalled();
    } finally { delete document.documentElement.dataset.keybardHost; }
  });

  it('loadFromFile successfully loads file and updates keyboard state', async () => {
    const mockKeyboardInfo: KeyboardInfo = {
      rows: 6,
      cols: 14,
      kbid: 'test-keyboard',
    };

    vi.mocked(fileService.loadFile).mockResolvedValue(mockKeyboardInfo);

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    const mockFile = new File(['{}'], 'test.kbi', { type: 'application/json' });

    await act(async () => {
      await result.current.loadFromFile(mockFile);
    });

    expect(result.current.keyboard).toEqual(mockKeyboardInfo);
    expect(fileService.loadFile).toHaveBeenCalledWith(mockFile);
  });

  it('loadFromFile sets loadedFrom to file name', async () => {
    const mockKeyboardInfo: KeyboardInfo = {
      rows: 6,
      cols: 14,
    };

    vi.mocked(fileService.loadFile).mockResolvedValue(mockKeyboardInfo);

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    const mockFile = new File(['{}'], 'my-keyboard.kbi', { type: 'application/json' });

    await act(async () => {
      await result.current.loadFromFile(mockFile);
    });

    expect(result.current.loadedFrom).toBe('my-keyboard.kbi');
  });

  it('loadFromFile sets isConnected to false', async () => {
    const mockKeyboardInfo: KeyboardInfo = {
      rows: 6,
      cols: 14,
    };

    vi.mocked(fileService.loadFile).mockResolvedValue(mockKeyboardInfo);

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    const mockFile = new File(['{}'], 'test.kbi', { type: 'application/json' });

    await act(async () => {
      await result.current.loadFromFile(mockFile);
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('loadFromFile throws error for invalid file', async () => {
    vi.mocked(fileService.loadFile).mockRejectedValue(new Error('Invalid file'));

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    const mockFile = new File(['{}'], 'invalid.kbi', { type: 'application/json' });

    await expect(async () => {
      await act(async () => {
        await result.current.loadFromFile(mockFile);
      });
    }).rejects.toThrow('Invalid file');
  });

  it('device connection after file load updates loadedFrom to device name', async () => {
    // First load a file
    const mockFileInfo: KeyboardInfo = {
      rows: 6,
      cols: 14,
    };

    vi.mocked(fileService.loadFile).mockResolvedValue(mockFileInfo);

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    const mockFile = new File(['{}'], 'test.kbi', { type: 'application/json' });

    await act(async () => {
      await result.current.loadFromFile(mockFile);
    });

    expect(result.current.loadedFrom).toBe('test.kbi');

    // Now connect a device
    const mockDeviceInfo: KeyboardInfo = {
      rows: 5,
      cols: 12,
      kbid: 'device-keyboard',
    };

    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(usbInstance.getDeviceName).mockReturnValue('Svalboard');
    vi.mocked(keyboardService.init).mockResolvedValue(undefined);
    vi.mocked(keyboardService.load).mockResolvedValue(mockDeviceInfo);

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.loadKeyboard();
    });

    expect(result.current.loadedFrom).toBe('Svalboard');
  });

  it('file load after device connection updates loadedFrom to file name', async () => {
    // First connect a device
    const mockDeviceInfo: KeyboardInfo = {
      rows: 5,
      cols: 12,
      kbid: 'device-keyboard',
    };

    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(usbInstance.getDeviceName).mockReturnValue('Svalboard');
    vi.mocked(keyboardService.init).mockResolvedValue(undefined);
    vi.mocked(keyboardService.load).mockResolvedValue(mockDeviceInfo);

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.loadKeyboard();
    });

    expect(result.current.loadedFrom).toBe('Svalboard');

    // Now load a file
    const mockFileInfo: KeyboardInfo = {
      rows: 6,
      cols: 14,
    };

    vi.mocked(fileService.loadFile).mockResolvedValue(mockFileInfo);

    const mockFile = new File(['{}'], 'test.kbi', { type: 'application/json' });

    await act(async () => {
      await result.current.loadFromFile(mockFile);
    });

    expect(result.current.loadedFrom).toBe('test.kbi');
  });

  it('disconnect retains draft source identity', async () => {
    // First connect a device
    const mockDeviceInfo: KeyboardInfo = {
      rows: 5,
      cols: 12,
      kbid: 'device-keyboard',
    };

    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(usbInstance.getDeviceName).mockReturnValue('Svalboard');
    vi.mocked(keyboardService.init).mockResolvedValue(undefined);
    vi.mocked(keyboardService.load).mockResolvedValue(mockDeviceInfo);

    const { result } = renderHook(() => useKeyboard(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      await result.current.loadKeyboard();
    });

    expect(result.current.loadedFrom).toBe('Svalboard');

    // Now disconnect
    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.loadedFrom).toBe('Svalboard');
    expect(result.current.connectionState).toBe('offline');
  });
  it('does not borrow capabilities from a previously loaded target and closes USB', async () => {
    vi.mocked(fileService.loadFile).mockResolvedValueOnce({rows: 1, cols: 1, name: 'old', macros_size: 999})
      .mockResolvedValueOnce({rows: 2, cols: 2});
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await act(async () => { await result.current.loadFromFile(new File(['{}'], 'old.svil')); });
    const firstSession = result.current.connectionSessionId;
    await act(async () => { await result.current.loadFromFile(new File(['{}'], 'new.svil')); });
    expect(result.current.keyboard?.name).toBeUndefined();
    expect(result.current.keyboard?.macros_size).toBeUndefined();
    expect(usbInstance.close).toHaveBeenCalledTimes(2);
    expect(result.current.connectionSessionId).toBeGreaterThan(firstSession);
  });

  it('preserves a dirty draft when target change is cancelled', async () => {
    vi.mocked(fileService.loadFile).mockResolvedValue({rows: 1, cols: 1});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await act(async () => { await result.current.loadFromFile(new File(['{}'], 'draft.svil')); });
    act(() => result.current.setKeyboard(kb => ({...kb!, name: 'edited'})));
    await act(async () => { await result.current.connect(); });
    expect(usbInstance.open).not.toHaveBeenCalled();
    expect(result.current.keyboard?.name).toBe('edited');
    confirm.mockRestore();
  });

  it('normalizes string file failures and preserves current target', async () => {
    vi.mocked(fileService.loadFile).mockRejectedValue('Empty file');
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await expect(result.current.loadFromFile(new File([''], 'empty.svil'))).rejects.toThrow('Empty file');
    expect(usbInstance.close).not.toHaveBeenCalled();
    expect(result.current.connectionSessionId).toBe(0);
  });

  it('does not mark unrelated edits saved when acknowledging an earlier snapshot', async () => {
    vi.mocked(fileService.loadFile).mockResolvedValue({rows: 1, cols: 1});
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await act(async () => { await result.current.loadFromFile(new File(['{}'], 'draft.svil')); });
    const confirmed = result.current.getKeyboardSnapshot()!;
    act(() => result.current.setKeyboard(kb => ({...kb!, name: 'newer edit'})));
    act(() => result.current.markAsSaved(confirmed));
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('loads offline files in browsers without WebHID', async () => {
    vi.mocked(KeyboardService.isWebHIDSupported).mockReturnValue(false);
    vi.mocked(fileService.loadFile).mockResolvedValue({rows: 1, cols: 1});
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await act(async () => { await result.current.loadFromFile(new File(['{}'], 'offline.svil')); });
    expect(result.current.keyboard).not.toBeNull();
    expect(usbInstance.close).not.toHaveBeenCalled();
    vi.mocked(KeyboardService.isWebHIDSupported).mockReturnValue(true);
  });

  it('loads once automatically and exposes failures without a writable connection', async () => {
    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(keyboardService.load).mockRejectedValueOnce(new Error('Definition read failed'));
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await act(async () => { await result.current.connect(); });
    await waitFor(() => expect(result.current.connectionState).toBe('error'));
    expect(result.current.connectionError).toBe('Definition read failed');
    expect(result.current.isConnected).toBe(false);
    expect(keyboardService.load).toHaveBeenCalledTimes(1);
    expect(usbInstance.close).toHaveBeenCalled();
  });

  it('waits for the previous write guard before opening another transport', async () => {
    vi.mocked(usbInstance.open).mockResolvedValue(false);
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    let finish!: (release: (discard?: boolean) => void) => void;
    const release = vi.fn();
    result.current.registerTargetChangeGuard(() => new Promise(resolve => { finish = resolve; }));
    let connecting!: Promise<boolean>;
    act(() => { connecting = result.current.connect(); });
    expect(usbInstance.open).not.toHaveBeenCalled();
    await act(async () => { finish(release); await connecting; });
    expect(usbInstance.open).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith(false);
  });

  it('discards old queued callbacks only after successfully switching to an offline file', async () => {
    vi.mocked(fileService.loadFile).mockResolvedValue({rows: 1, cols: 1});
    const release = vi.fn();
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    result.current.registerTargetChangeGuard(async () => release);
    await act(async () => { await result.current.loadFromFile(new File(['{}'], 'offline.svil')); });
    expect(release).toHaveBeenCalledWith(true);
  });

  it('serializes maintenance with queued writes and preserves pending callbacks', async () => {
    vi.mocked(usbInstance.open).mockResolvedValue(true);
    vi.mocked(keyboardService.load).mockResolvedValue({rows: 1, cols: 1});
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    await act(async () => { await result.current.connect(); });
    const release = vi.fn();
    let finish!: (release: (discard?: boolean) => void) => void;
    result.current.registerTargetChangeGuard(() => new Promise(resolve => { finish = resolve; }));
    const operation = vi.fn().mockResolvedValue('saved');
    let maintenance!: Promise<unknown>;
    act(() => { maintenance = result.current.runDeviceMaintenance(operation); });
    expect(operation).not.toHaveBeenCalled();
    await act(async () => { finish(release); expect(await maintenance).toBe('saved'); });
    expect(release).toHaveBeenCalledWith(false);
  });

});
