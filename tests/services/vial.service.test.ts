import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SvilService } from '../../src/services/vial.service';
import { SvilUSB } from '../../src/services/usb.service';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';
import { keyService } from '../../src/services/key.service';
import { svalService } from '../../src/services/sval.service';
import LZMA from 'js-lzma';

vi.mock('../../src/services/key.service', () => ({
  keyService: {
    stringify: vi.fn((keycode: number) => `KC_${keycode.toString(16).toUpperCase()}`),
    parse: vi.fn((keystr: string) => parseInt(keystr.replace('KC_', ''), 16)),
    generateAllKeycodes: vi.fn()
  }
}));

vi.mock('js-lzma', () => ({
  default: {
    decompressFile: vi.fn()
  }
}));

const defaultPayload = {
  name: 'Test Keyboard',
  matrix: { rows: 2, cols: 3 },
  customKeycodes: [],
  viable: {
    tap_dance: 0,
    combo: 0,
    key_override: 0,
    alt_repeat_key: 0,
    leader: 0
  }
};

describe('SvilService', () => {
  let svilService: SvilService;
  let mockUSB: any;
  let definitionBytes: Uint8Array;

  beforeEach(() => {
    vi.clearAllMocks();

    definitionBytes = new Uint8Array(Array.from({ length: 32 }, (_, i) => i));

    vi.mocked(LZMA.decompressFile).mockImplementation((_inStream: any, outStream: any) => {
      const bytes = new TextEncoder().encode(JSON.stringify(defaultPayload));
      for (const b of bytes) {
        outStream.writeByte(b);
      }
    });

    mockUSB = {
      send: vi.fn(),
      sendSvil: vi.fn(),
      getViaBuffer: vi.fn(),
      pushViaBuffer: vi.fn(),
      open: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      getDeviceName: vi.fn().mockReturnValue('Mock Device')
    };

    mockUSB.send.mockImplementation((cmd: number, _args: number[], options?: any) => {
      if (cmd === SvilUSB.CMD_VIA_GET_PROTOCOL_VERSION && options?.unpack === 'B>H' && options?.index === 1) {
        return Promise.resolve(0x0c);
      }
      if (cmd === SvilUSB.CMD_VIA_GET_LAYER_COUNT && options?.uint8 && options?.index === 1) {
        return Promise.resolve(2);
      }
      if (cmd === SvilUSB.CMD_VIA_MACRO_GET_COUNT && options?.uint8) {
        return Promise.resolve(new Uint8Array([SvilUSB.CMD_VIA_MACRO_GET_COUNT, 0, 0]));
      }
      if (cmd === SvilUSB.CMD_VIA_MACRO_GET_BUFFER_SIZE && options?.unpack === 'B>H' && options?.index === 1) {
        return Promise.resolve(0);
      }
      if (cmd === SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE) {
        const response = new Uint8Array(32);
        response[0] = SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE;
        response[1] = SvilUSB.VIA_SWITCH_MATRIX_STATE;
        response[3] = 0b00000101; // row 0
        response[4] = 0b00000000; // row 1
        return Promise.resolve(response);
      }
      return Promise.resolve(new Uint8Array(32));
    });

    mockUSB.sendSvil.mockImplementation((cmd: number, args: number[]) => {
      if (cmd === SvilUSB.CMD_SVIL_GET_INFO) {
        return Promise.resolve(
          new Uint8Array([
            SvilUSB.CMD_SVIL_GET_INFO,
            0x06, 0x00, 0x00, 0x00, // protocol version
            0xef, 0xcd, 0xab, 0x90, 0x78, 0x56, 0x34, 0x12, // uid LE
            0x00 // feature flags
          ])
        );
      }

      if (cmd === SvilUSB.CMD_SVIL_DEFINITION_SIZE) {
        return Promise.resolve(definitionBytes.length);
      }

      if (cmd === SvilUSB.CMD_SVIL_DEFINITION_CHUNK) {
        const offset = (args[0] || 0) | ((args[1] || 0) << 8);
        const requestedSize = args[2] || 0;
        const chunk = definitionBytes.slice(offset, offset + requestedSize);
        return Promise.resolve(
          new Uint8Array([
            SvilUSB.CMD_SVIL_DEFINITION_CHUNK,
            args[0] || 0,
            args[1] || 0,
            chunk.length,
            ...chunk
          ])
        );
      }

      return Promise.resolve(new Uint8Array(32));
    });

    mockUSB.getViaBuffer.mockImplementation((cmd: number, size: number, options?: any) => {
      if (cmd === SvilUSB.CMD_VIA_KEYMAP_GET_BUFFER && options?.uint16) {
        return Promise.resolve(Array.from({ length: size / 2 }, (_, i) => i));
      }
      return Promise.resolve(new Uint8Array(size));
    });

    svilService = new SvilService(mockUSB);
  });

  describe('init', () => {
    it('should initialize without errors', async () => {
      const kbinfo = createTestKeyboardInfo();
      await expect(svilService.init(kbinfo)).resolves.toBeUndefined();
    });
  });

  describe('getKeyboardInfo', () => {
    it('should retrieve protocol, id, and matrix from svil definition', async () => {
      const kbinfo = createTestKeyboardInfo();

      await svilService.getKeyboardInfo(kbinfo);

      expect(kbinfo.via_proto).toBe(0x0c);
      expect(kbinfo.svil_proto).toBe(6);
      // Kept on the connection so table requests pick the v1 or v2 format
      expect(mockUSB.svilProtocolVersion).toBe(6);
      expect(kbinfo.kbid).toBe('1234567890abcdef');
      expect(kbinfo.rows).toBe(2);
      expect(kbinfo.cols).toBe(3);
      expect(kbinfo.name).toBe('Test Keyboard');
    });

    it.each(['sval', 'viable'])('should populate optional payload fields from %s definitions', async (namespace) => {
      const kbinfo = createTestKeyboardInfo();
      const payload = {
        ...defaultPayload,
        [namespace]: {
          tap_dance: 2,
          combo: 3,
          key_override: 4,
          alt_repeat_key: 1,
          leader: 5
        },
        fragments: { cluster: { variants: [] } },
        composition: [{ fragment: 'cluster' }],
        menus: [{ label: 'Lighting' }]
      };

      vi.mocked(LZMA.decompressFile).mockImplementationOnce((_inStream: any, outStream: any) => {
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        for (const b of bytes) {
          outStream.writeByte(b);
        }
      });

      await svilService.getKeyboardInfo(kbinfo);

      expect(kbinfo.tapdance_count).toBe(2);
      expect(kbinfo.combo_count).toBe(3);
      expect(kbinfo.key_override_count).toBe(4);
      expect(kbinfo.alt_repeat_key_count).toBe(1);
      expect(kbinfo.leader_count).toBe(5);
      expect(kbinfo.fragments).toEqual(payload.fragments);
      expect(kbinfo.composition).toEqual(payload.composition);
      expect(kbinfo.menus).toEqual(payload.menus);
    });

    it('should reject unreasonable payload sizes', async () => {
      const kbinfo = createTestKeyboardInfo();

      mockUSB.sendSvil.mockImplementation((cmd: number) => {
        if (cmd === SvilUSB.CMD_SVIL_GET_INFO) {
          return Promise.resolve(
            new Uint8Array([
              SvilUSB.CMD_SVIL_GET_INFO,
              0x06, 0x00, 0x00, 0x00,
              0xef, 0xcd, 0xab, 0x90, 0x78, 0x56, 0x34, 0x12,
              0x00
            ])
          );
        }
        if (cmd === SvilUSB.CMD_SVIL_DEFINITION_SIZE) {
          return Promise.resolve(51 * 1024 * 1024);
        }
        return Promise.resolve(new Uint8Array(32));
      });

      await expect(svilService.getKeyboardInfo(kbinfo)).rejects.toThrow('Invalid payload size');
    });

    it('should handle USB disconnection during info retrieval', async () => {
      const kbinfo = createTestKeyboardInfo();
      mockUSB.send.mockRejectedValue(new Error('USB disconnected'));

      await expect(svilService.getKeyboardInfo(kbinfo)).rejects.toThrow('USB disconnected');
    });
  });

  describe('getFeatures', () => {
    it('should retrieve macro count and buffer size', async () => {
      const kbinfo = createTestKeyboardInfo();

      mockUSB.send.mockImplementation((cmd: number, _args: number[], options?: any) => {
        if (cmd === SvilUSB.CMD_VIA_MACRO_GET_COUNT && options?.uint8) {
          // Older firmware: count in one byte, high byte left zero
          return Promise.resolve(new Uint8Array([SvilUSB.CMD_VIA_MACRO_GET_COUNT, 2, 0]));
        }
        if (cmd === SvilUSB.CMD_VIA_MACRO_GET_BUFFER_SIZE && options?.unpack === 'B>H' && options?.index === 1) {
          return Promise.resolve(256);
        }
        return Promise.resolve(new Uint8Array(32));
      });

      await svilService.getFeatures(kbinfo);

      expect(kbinfo.macro_count).toBe(2);
      expect(kbinfo.macros_size).toBe(256);
    });
  });

  describe('getKeyMap', () => {
    it('should retrieve keymap for all layers', async () => {
      const kbinfo = createTestKeyboardInfo({ rows: 2, cols: 2 });

      await svilService.getKeyMap(kbinfo);

      expect(kbinfo.keymap).toHaveLength(2);
      expect(kbinfo.keymap?.[0]).toEqual([0, 1, 2, 3]);
      expect(kbinfo.keymap?.[1]).toEqual([4, 5, 6, 7]);
    });

    it('should throw error if layer count is not available', async () => {
      const kbinfo = createTestKeyboardInfo({ rows: 2, cols: 2 });

      mockUSB.send.mockImplementation((cmd: number, _args: number[], options?: any) => {
        if (cmd === SvilUSB.CMD_VIA_GET_LAYER_COUNT && options?.uint8 && options?.index === 1) {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(new Uint8Array(32));
      });

      await expect(svilService.getKeyMap(kbinfo)).rejects.toThrow('Failed to get layer count');
    });

    it('should throw error if getViaBuffer does not return an array', async () => {
      const kbinfo = createTestKeyboardInfo({ rows: 2, cols: 2 });
      mockUSB.getViaBuffer.mockResolvedValueOnce(new Uint8Array(8));

      await expect(svilService.getKeyMap(kbinfo)).rejects.toThrow('Expected array of keycodes from getViaBuffer');
    });
  });

  describe('load', () => {
    it('should load complete keyboard information', async () => {
      const kbinfo = createTestKeyboardInfo();

      const result = await svilService.load(kbinfo);

      expect(result).toBe(kbinfo);
      expect(kbinfo.via_proto).toBe(0x0c);
      expect(kbinfo.svil_proto).toBe(6);
      expect(kbinfo.kbid).toBe('1234567890abcdef');
      expect(kbinfo.keymap).toHaveLength(2);
      expect(keyService.generateAllKeycodes).toHaveBeenCalledWith(kbinfo);
    });

    it('should propagate load errors', async () => {
      const kbinfo = createTestKeyboardInfo();
      mockUSB.sendSvil.mockRejectedValue(new Error('Load failed'));

      await expect(svilService.load(kbinfo)).rejects.toThrow('Load failed');
    });

    it('loads optional svil features and fragment composition when available', async () => {
      const kbinfo = createTestKeyboardInfo({
        feature_flags: 0x0c,
        alt_repeat_key_count: 1,
        leader_count: 1
      });
      const composedLayout = { k0: { x: 0, y: 0 } };

      vi.spyOn(svilService, 'getKeyboardInfo').mockImplementationOnce(async (target) => {
        target.rows = 2;
        target.cols = 3;
        target.layers = 2;
        target.feature_flags = 0x0c;
        target.alt_repeat_key_count = 1;
        target.leader_count = 1;
        return target;
      });
      vi.spyOn(svalService, 'check').mockResolvedValueOnce(true);
      const pullSpy = vi.spyOn(svalService, 'pull').mockResolvedValueOnce();
      const syncColorsSpy = vi.spyOn(svalService, 'syncCosmeticLayerColors').mockImplementation(() => {});
      const setupNamesSpy = vi.spyOn(svalService, 'setupCosmeticLayerNames').mockImplementation(() => {});
      const altRepeatSpy = vi.spyOn(svilService, 'getAltRepeatKeys').mockResolvedValueOnce();
      const leadersSpy = vi.spyOn(svilService, 'getLeaders').mockResolvedValueOnce();
      const oneShotSpy = vi.spyOn(svilService, 'getOneShot').mockResolvedValueOnce();
      const fragmentGetSpy = vi.spyOn((svilService as any).fragment, 'get').mockResolvedValueOnce();
      vi.spyOn((svilService as any).fragment, 'hasFragments').mockReturnValueOnce(true);
      const composeSpy = vi.spyOn((svilService as any).fragmentComposer, 'composeLayout').mockReturnValueOnce(composedLayout);

      const result = await svilService.load(kbinfo);

      expect(result).toBe(kbinfo);
      expect(pullSpy).toHaveBeenCalledWith(kbinfo);
      expect(syncColorsSpy).toHaveBeenCalledWith(kbinfo);
      expect(setupNamesSpy).toHaveBeenCalledWith(kbinfo);
      expect(altRepeatSpy).toHaveBeenCalledWith(kbinfo);
      expect(leadersSpy).toHaveBeenCalledWith(kbinfo);
      expect(oneShotSpy).toHaveBeenCalledWith(kbinfo);
      expect(fragmentGetSpy).toHaveBeenCalledWith(kbinfo);
      expect(composeSpy).toHaveBeenCalledWith(kbinfo);
      expect((kbinfo as any).keylayout).toEqual(composedLayout);
    });

    it('continues loading when optional svil features are unavailable', async () => {
      const kbinfo = createTestKeyboardInfo({
        feature_flags: 0x0c,
        alt_repeat_key_count: 1,
        leader_count: 1
      });

      vi.spyOn(svalService, 'check').mockResolvedValueOnce(false);
      vi.spyOn(svalService, 'setupCosmeticLayerNames').mockImplementation(() => {});
      vi.spyOn(svilService, 'getAltRepeatKeys').mockRejectedValueOnce(new Error('no alt repeat'));
      vi.spyOn(svilService, 'getLeaders').mockRejectedValueOnce(new Error('no leaders'));
      vi.spyOn(svilService, 'getOneShot').mockRejectedValueOnce(new Error('no oneshot'));
      vi.spyOn((svilService as any).fragment, 'hasFragments').mockReturnValueOnce(true);
      vi.spyOn((svilService as any).fragment, 'get').mockRejectedValueOnce(new Error('no fragments'));

      await expect(svilService.load(kbinfo)).resolves.toBe(kbinfo);
    });

    it('swallows keylayout deserialization failures', async () => {
      const kbinfo = createTestKeyboardInfo();
      kbinfo.payload = {
        layouts: {
          keymap: [{ x: 0, y: 0 }]
        }
      } as any;

      vi.spyOn(svilService, 'getKeyboardInfo').mockResolvedValueOnce(kbinfo);
      vi.spyOn(svalService, 'check').mockResolvedValueOnce(false);
      vi.spyOn(svalService, 'setupCosmeticLayerNames').mockImplementation(() => {});
      vi.spyOn((svilService as any).kle, 'deserializeToKeylayout').mockImplementationOnce(() => {
        throw new Error('bad kle');
      });

      await expect(svilService.load(kbinfo)).resolves.toBe(kbinfo);
    });
  });

  describe('pollMatrix', () => {
    it('should return matrix state as boolean array', async () => {
      const kbinfo = createTestKeyboardInfo({ rows: 2, cols: 8 });

      const matrix = await svilService.pollMatrix(kbinfo);

      expect(matrix).toHaveLength(2);
      expect(matrix[0]).toEqual([true, false, true, false, false, false, false, false]);
      expect(matrix[1]).toEqual([false, false, false, false, false, false, false, false]);
    });

    it('should handle larger matrices with row byte-order mapping', async () => {
      const kbinfo = createTestKeyboardInfo({ rows: 4, cols: 16 });

      mockUSB.send.mockImplementation((cmd: number) => {
        if (cmd !== SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE) {
          return Promise.resolve(new Uint8Array(32));
        }

        const response = new Uint8Array(32);
        response[0] = SvilUSB.CMD_VIA_GET_KEYBOARD_VALUE;
        response[1] = SvilUSB.VIA_SWITCH_MATRIX_STATE;

        // start at offset 3, 2 bytes per row
        response[3] = 0x00; response[4] = 0x01; // row 0 => col 0 true
        response[5] = 0x01; response[6] = 0x00; // row 1 => col 8 true
        response[7] = 0x00; response[8] = 0x02; // row 2 => col 1 true
        response[9] = 0x00; response[10] = 0x00; // row 3 => none

        return Promise.resolve(response);
      });

      const matrix = await svilService.pollMatrix(kbinfo);

      expect(matrix).toHaveLength(4);
      expect(matrix[0][0]).toBe(true);
      expect(matrix[1][8]).toBe(true);
      expect(matrix[2][1]).toBe(true);
    });

    it('returns false values when matrix bytes are shorter than expected', async () => {
      const kbinfo = createTestKeyboardInfo({ rows: 2, cols: 8 });

      mockUSB.send.mockResolvedValueOnce(new Uint8Array([0x00]));

      const matrix = await svilService.pollMatrix(kbinfo);

      expect(matrix).toEqual([[false, false, false, false, false, false, false, false]]);
    });
  });

  describe('feature getters', () => {
    it('loads alt-repeat key entries', async () => {
      const kbinfo = createTestKeyboardInfo({ alt_repeat_key_count: 1 });
      mockUSB.sendSvil.mockResolvedValueOnce(new Uint8Array([0x07, 0x00, 0x04, 0x00, 0x05, 0x00, 0x03, 0x80]));

      await svilService.getAltRepeatKeys(kbinfo);

      expect(kbinfo.alt_repeat_keys).toEqual([{
        arkid: 0,
        keycode: 'KC_4',
        alt_keycode: 'KC_5',
        allowed_mods: 3,
        options: 128
      }]);
    });

    it('loads leader entries and omits zero keycodes from sequences', async () => {
      const kbinfo = createTestKeyboardInfo({ leader_count: 1 });
      mockUSB.sendSvil.mockResolvedValueOnce(new Uint8Array([
        0x14, 0x00,
        0x04, 0x00,
        0x00, 0x00,
        0x06, 0x00,
        0x00, 0x00,
        0x08, 0x00,
        0x09, 0x00,
        0x34, 0x12
      ]));

      await svilService.getLeaders(kbinfo);

      expect(kbinfo.leaders).toEqual([{
        ldrid: 0,
        sequence: ['KC_4', 'KC_6', 'KC_8'],
        output: 'KC_9',
        options: 0x1234
      }]);
    });

    it('loads one-shot settings', async () => {
      const kbinfo = createTestKeyboardInfo();
      mockUSB.sendSvil.mockResolvedValueOnce(new Uint8Array([0x09, 0x2c, 0x01, 0x03]));

      await svilService.getOneShot(kbinfo);

      expect(kbinfo.one_shot).toEqual({
        timeout: 300,
        tap_toggle: 3
      });
    });

    it('returns early when optional counts are missing', async () => {
      const kbinfo = createTestKeyboardInfo({ alt_repeat_key_count: 0, leader_count: 0 });

      await svilService.getAltRepeatKeys(kbinfo);
      await svilService.getLeaders(kbinfo);

      expect(kbinfo.alt_repeat_keys).toBeUndefined();
      expect(kbinfo.leaders).toBeUndefined();
    });
  });

  describe('layer state helpers', () => {
    it('gets layer state mask as unsigned integer', async () => {
      mockUSB.sendSvil.mockResolvedValueOnce(-1);

      await expect(svilService.getLayerStateMask()).resolves.toBe(0xffffffff);
    });

    it('finds active layer from a bitmask', () => {
      expect(svilService.getActiveLayerIndexFromMask(0)).toBe(0);
      expect(svilService.getActiveLayerIndexFromMask(0b00000100)).toBe(2);
      expect(svilService.getActiveLayerIndexFromMask(0x80000000)).toBe(31);
    });

    it('gets the active layer index from the keyboard mask', async () => {
      vi.spyOn(svilService, 'getLayerStateMask').mockResolvedValueOnce(0b1000);

      await expect(svilService.getActiveLayerIndex()).resolves.toBe(3);
    });
  });

  describe('updateKey', () => {
    it('should update a key at specific position', async () => {
      await svilService.updateKey(0, 1, 2, 0x0004);

      expect(mockUSB.send).toHaveBeenCalledWith(
        SvilUSB.CMD_VIA_SET_KEYCODE,
        [0, 1, 2, 0, 4],
        {}
      );
    });

    it('should encode keymask as big endian', async () => {
      await svilService.updateKey(2, 3, 7, 0x1234);

      expect(mockUSB.send).toHaveBeenCalledWith(
        SvilUSB.CMD_VIA_SET_KEYCODE,
        [2, 3, 7, 0x12, 0x34],
        {}
      );
    });

    it('should handle USB disconnection during update', async () => {
      mockUSB.send.mockRejectedValue(new Error('USB disconnected'));

      await expect(svilService.updateKey(0, 0, 0, 0x0004)).rejects.toThrow('USB disconnected');
    });
  });

  describe('update helpers', () => {
    it('delegates macro, tapdance, combo, override, qmk, and fragment updates', async () => {
      const kbinfo = createTestKeyboardInfo();
      const macroPush = vi.spyOn((svilService as any).macro, 'push').mockResolvedValueOnce();
      const tapdancePush = vi.spyOn((svilService as any).tapdance, 'push').mockResolvedValueOnce();
      const comboPush = vi.spyOn((svilService as any).combo, 'push').mockResolvedValueOnce();
      const overridePush = vi.spyOn((svilService as any).override, 'push').mockResolvedValueOnce();
      const qmkPush = vi.spyOn((svilService as any).qmk, 'push').mockResolvedValueOnce();
      const fragmentSet = vi.spyOn((svilService as any).fragment, 'setSelection').mockResolvedValueOnce(true);

      await svilService.updateMacros(kbinfo);
      await svilService.updateTapdance(kbinfo, 1);
      await svilService.updateCombo(kbinfo, 2);
      await svilService.updateKeyoverride(kbinfo, 3);
      await svilService.updateQMKSetting(kbinfo, 4);
      await expect(svilService.updateFragmentSelection(kbinfo, 5, 6)).resolves.toBe(true);

      expect(macroPush).toHaveBeenCalledWith(kbinfo);
      expect(tapdancePush).toHaveBeenCalledWith(kbinfo, 1);
      expect(comboPush).toHaveBeenCalledWith(kbinfo, 2);
      expect(overridePush).toHaveBeenCalledWith(kbinfo, 3);
      expect(qmkPush).toHaveBeenCalledWith(kbinfo, 4);
      expect(fragmentSet).toHaveBeenCalledWith(kbinfo, 5, 6);
    });

    it('updates alt-repeat, leader, one-shot, save, and reset commands', async () => {
      const kbinfo = createTestKeyboardInfo({
        alt_repeat_keys: [{
          arkid: 0,
          keycode: 'KC_4',
          alt_keycode: 'KC_5',
          allowed_mods: 3,
          options: 128
        }],
        leaders: [{
          ldrid: 0,
          sequence: ['KC_4', 'KC_5'],
          output: 'KC_6',
          options: 0x1234
        }],
        one_shot: {
          timeout: 300,
          tap_toggle: 2
        }
      });

      await svilService.updateAltRepeatKey(kbinfo, 0);
      await svilService.updateLeader(kbinfo, 0);
      await svilService.updateOneShot(kbinfo);
      await svilService.saveSvil();
      await svilService.resetSvil();

      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        SvilUSB.CMD_SVIL_ALT_REPEAT_KEY_SET,
        [0, 4, 0, 5, 0, 3, 128],
        { uint8: true }
      );
      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        SvilUSB.CMD_SVIL_LEADER_SET,
        [0, 4, 0, 5, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0x34, 0x12],
        { uint8: true }
      );
      expect(mockUSB.sendSvil).toHaveBeenCalledWith(
        SvilUSB.CMD_SVIL_ONE_SHOT_SET,
        [0x2c, 0x01, 0x02],
        {}
      );
      expect(mockUSB.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_SAVE, [], {});
      expect(mockUSB.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_RESET, [], {});
    });

    it('returns early when optional update entries are missing', async () => {
      const kbinfo = createTestKeyboardInfo({
        alt_repeat_keys: [],
        leaders: [],
        one_shot: undefined
      });

      await svilService.updateAltRepeatKey(kbinfo, 0);
      await svilService.updateLeader(kbinfo, 0);
      await svilService.updateOneShot(kbinfo);

      expect(mockUSB.sendSvil).not.toHaveBeenCalled();
    });
  });

  describe('misc helpers', () => {
    it('exposes fragment services and checks empty layers', () => {
      expect(svilService.getFragmentService()).toBe((svilService as any).fragment);
      expect(svilService.getFragmentComposer()).toBe((svilService as any).fragmentComposer);
      expect(svilService.isLayerEmpty([0, -1, 255])).toBe(true);
      expect(svilService.isLayerEmpty([0, 4, 255])).toBe(false);
    });
  });

  describe('LZMA decompression error handling', () => {
    it('should surface js-lzma decompression errors', async () => {
      vi.mocked(LZMA.decompressFile).mockImplementationOnce(() => {
        throw new Error('LZMA decompression failed');
      });

      const kbinfo = createTestKeyboardInfo();

      await expect(svilService.getKeyboardInfo(kbinfo)).rejects.toThrow('LZMA decompression failed');
    });
  });
});
