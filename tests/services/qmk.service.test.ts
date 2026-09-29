import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { QMKService } from '../../src/services/qmk.service';
import { createMockUSB, type MockUSBControl } from '../mocks/usb.mock';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';
import type { SvilUSB } from '../../src/services/usb.service';

// Mock the QMK settings constants
vi.mock('../../src/constants/qmk-settings', () => ({
  QMK_SETTINGS: {
    tabs: [
      {
        name: 'General',
        fields: [
          { qsid: 1, width: 1, type: 'boolean', title: 'NKRO' },
          { qsid: 2, width: 2, type: 'integer', title: 'Tapping Term' },
          { qsid: 3, width: 1, type: 'boolean', title: 'Permissive Hold' }
        ]
      },
      {
        name: 'RGB',
        fields: [
          { qsid: 4, width: 1, type: 'integer', title: 'RGB Mode' },
          { qsid: 5, width: 4, type: 'integer', title: 'RGB Speed' }
        ]
      }
    ]
  }
}));

interface MockSvilUSB extends SvilUSB {
  sendSvil: Mock;
}

const queryPage = (values: number[]) => new Uint16Array([...values, 0xffff]);
const qsid8 = (value: number) => new Uint8Array([0x11, 0x00, value & 0xff]);
const qsid16 = (value: number) => new Uint8Array([0x11, 0x00, value & 0xff, (value >> 8) & 0xff]);
const qsid32 = (value: number) => new Uint8Array([0x11, 0x00, value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]);

describe('QMKService', () => {
  let qmkService: QMKService;
  let mockUSB: MockSvilUSB;
  let usbControl: MockUSBControl;

  beforeEach(() => {
    const { mock, control } = createMockUSB();
    mockUSB = mock as MockSvilUSB;
    usbControl = control;
    qmkService = new QMKService(mockUSB);
    mockUSB.sendSvil = vi.fn();
  });

  describe('get', () => {
    it('should retrieve supported QMK settings', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil
        .mockResolvedValueOnce(queryPage([1, 2, 3]))
        .mockResolvedValueOnce(queryPage([]))
        .mockResolvedValueOnce(qsid8(1))
        .mockResolvedValueOnce(qsid16(200))
        .mockResolvedValueOnce(qsid8(0));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toEqual({
        1: 1,
        2: 200,
        3: 0
      });
    });

    it('should handle keyboards with no QMK settings', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil.mockResolvedValueOnce(queryPage([]));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toEqual({});
    });

    it('should handle partial QMK settings support', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil
        .mockResolvedValueOnce(queryPage([1, 4]))
        .mockResolvedValueOnce(queryPage([]))
        .mockResolvedValueOnce(qsid8(1))
        .mockResolvedValueOnce(qsid8(5));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toEqual({
        1: 1,
        4: 5
      });
      expect(kbinfo.settings![2]).toBeUndefined();
      expect(kbinfo.settings![3]).toBeUndefined();
    });

    it('should handle different width QMK settings correctly', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil
        .mockResolvedValueOnce(queryPage([1, 2, 3, 4, 5]))
        .mockResolvedValueOnce(queryPage([]))
        .mockResolvedValueOnce(qsid8(1))
        .mockResolvedValueOnce(qsid16(0x1234))
        .mockResolvedValueOnce(qsid8(0))
        .mockResolvedValueOnce(qsid8(10))
        .mockResolvedValueOnce(qsid32(0x12345678));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toEqual({
        1: 1,
        2: 0x1234,
        3: 0,
        4: 10,
        5: 0x12345678
      });
    });

    it('should handle multiple query pages', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      const firstPage = Array.from({ length: 16 }, (_, i) => i + 1);
      const secondPage = [17, 18, 19, 20];

      mockUSB.sendSvil
        .mockResolvedValueOnce(queryPage(firstPage))
        .mockResolvedValueOnce(queryPage(secondPage))
        .mockResolvedValueOnce(queryPage([]))
        .mockResolvedValueOnce(qsid8(10))
        .mockResolvedValueOnce(qsid16(20))
        .mockResolvedValueOnce(qsid8(30))
        .mockResolvedValueOnce(qsid8(40))
        .mockResolvedValueOnce(qsid32(50));

      await qmkService.get(kbinfo);

      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        expect.anything(),
        [0, 0],
        expect.objectContaining({ uint16: true })
      );
      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        expect.anything(),
        [16, 0],
        expect.objectContaining({ uint16: true })
      );
      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        expect.anything(),
        [20, 0],
        expect.objectContaining({ uint16: true })
      );
    });

    it('should handle USB disconnection during settings retrieval', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(false);

      mockUSB.sendSvil.mockRejectedValue(new Error('USB device not connected'));

      await expect(qmkService.get(kbinfo)).rejects.toThrow('USB device not connected');
    });

    it('should handle array or typed array responses', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil
        .mockResolvedValueOnce([1, 2, 0xffff])
        .mockResolvedValueOnce([0xffff])
        .mockResolvedValueOnce(qsid8(1))
        .mockResolvedValueOnce(qsid16(200));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toBeDefined();
      expect(kbinfo.settings![1]).toBe(1);
      expect(kbinfo.settings![2]).toBe(200);
    });
  });

  describe('push', () => {
    it('should push individual QMK setting', async () => {
      const kbinfo = createTestKeyboardInfo({
        settings: { 1: 1, 2: 300, 3: 0 }
      });
      usbControl.setConnected(true);
      mockUSB.sendSvil.mockResolvedValue(undefined);

      await qmkService.push(kbinfo, 1);

      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        0x12,
        [1, 0, 1, 0, 0, 0],
        {}
      );
    });

    it('should throw error when no settings available to push', async () => {
      const kbinfo = createTestKeyboardInfo({ settings: undefined });
      usbControl.setConnected(true);

      await expect(qmkService.push(kbinfo, 1)).rejects.toThrow('No settings available to push');
    });

    it('should handle USB disconnection during settings push', async () => {
      const kbinfo = createTestKeyboardInfo({ settings: { 1: 1 } });
      usbControl.setConnected(false);

      mockUSB.sendSvil.mockRejectedValue(new Error('USB device not connected'));

      await expect(qmkService.push(kbinfo, 1)).rejects.toThrow('USB device not connected');
    });

    it('should encode values as LE32 correctly', async () => {
      const kbinfo = createTestKeyboardInfo({
        settings: {
          1: 255,
          2: 65535,
          5: 0x12345678
        }
      });
      usbControl.setConnected(true);

      let capturedArgs: number[] | null = null;
      mockUSB.sendSvil.mockImplementation((_cmd: number, args: number[]) => {
        capturedArgs = args;
        return Promise.resolve(undefined);
      });

      await qmkService.push(kbinfo, 5);

      expect(capturedArgs).toEqual([5, 0, 0x78, 0x56, 0x34, 0x12]);
    });
  });

  describe('Edge cases', () => {
    it('should treat malformed query responses as no settings', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil.mockResolvedValueOnce(null);

      await expect(qmkService.get(kbinfo)).resolves.toBeUndefined();
      expect(kbinfo.settings).toEqual({});
    });

    it('should skip unknown QSIDs', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil
        .mockResolvedValueOnce(queryPage([999]))
        .mockResolvedValueOnce(queryPage([]));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toEqual({});
      expect(mockUSB.sendSvil).toHaveBeenCalledTimes(2);
    });

    it('should handle settings with value 0', async () => {
      const kbinfo = createTestKeyboardInfo();
      usbControl.setConnected(true);

      mockUSB.sendSvil
        .mockResolvedValueOnce(queryPage([1, 2]))
        .mockResolvedValueOnce(queryPage([]))
        .mockResolvedValueOnce(qsid8(0))
        .mockResolvedValueOnce(qsid16(0));

      await qmkService.get(kbinfo);

      expect(kbinfo.settings).toEqual({
        1: 0,
        2: 0
      });
    });
  });
});
