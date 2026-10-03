import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SvilUSB, svilEntryOffset, svilIndexArgs } from '../../src/services/usb.service';
import { TapdanceService } from '../../src/services/tapdance.service';
import { ComboService } from '../../src/services/combo.service';
import { OverrideService } from '../../src/services/override.service';
import { LabelService } from '../../src/services/label.service';
import { SvilService } from '../../src/services/vial.service';
import { keyService } from '../../src/services/key.service';
import { createTestKeyboardInfo } from '../fixtures/keyboard-info.fixture';

// Sval protocol v2 (256-entry tables) against v1 (one-byte indices), plus the
// 256-macro changes: a two-byte macro count and keycodes 0x7680-0x76FF for M128-M255.

const LABEL = (s: string) => {
  const out = new Uint8Array(16);
  out.set(new TextEncoder().encode(s));
  return out;
};

function makeUsb(version: number) {
  return {
    svilProtocolVersion: version,
    send: vi.fn(),
    sendSvil: vi.fn(),
  };
}

/** A GET response as the app sees it: [cmd_echo][index (1 or 2 bytes)][entry...] */
function entryResponse(version: number, cmd: number, args: number[], entry: number[]): Uint8Array {
  const index = version >= 2 ? args.slice(0, 2) : args.slice(0, 1);
  return new Uint8Array([cmd, ...index, ...entry]);
}

describe('Sval protocol v1/v2 table requests', () => {
  it('encodes the index as one byte on v1 and two little-endian bytes on v2', () => {
    expect(svilIndexArgs(1, 0)).toEqual([0]);
    expect(svilIndexArgs(1, 255)).toEqual([255]);
    expect(svilIndexArgs(2, 0)).toEqual([0, 0]);
    expect(svilIndexArgs(2, 255)).toEqual([255, 0]);
    expect(svilIndexArgs(2, 256)).toEqual([0, 1]);
    // Unknown version (e.g. a mock without one) is treated as v1
    expect(svilIndexArgs(undefined, 7)).toEqual([7]);
    expect(() => svilIndexArgs(1, 256)).toThrow(RangeError);
  });

  it('reads the entry at offset 2 on v1 and 3 on v2 (byte 4 of the inner payload)', () => {
    expect(svilEntryOffset(1)).toBe(2);
    expect(svilEntryOffset(2)).toBe(3);
  });

  describe.each([1, 2])('protocol v%i', (version) => {
    let usb: ReturnType<typeof makeUsb>;

    beforeEach(() => {
      usb = makeUsb(version);
    });

    it('tap dance get/set use the right index width and entry offset', async () => {
      const count = version >= 2 ? 256 : 50;
      usb.sendSvil.mockImplementation((cmd: number, args: number[]) => {
        const i = version >= 2 ? args[0] | (args[1] << 8) : args[0];
        // tap = KC_A, hold = KC_B, doubletap = KC_C, taphold = KC_D, term = (i + 100) | enabled
        const term = (i + 100) | 0x8000;
        return Promise.resolve(entryResponse(version, cmd, args, [0x04, 0, 0x05, 0, 0x06, 0, 0x07, 0, term & 0xff, term >> 8]));
      });

      const service = new TapdanceService(usb as unknown as SvilUSB);
      const kbinfo = createTestKeyboardInfo({ tapdance_count: count });
      await service.get(kbinfo);

      expect(kbinfo.tapdances).toHaveLength(count);
      expect(usb.sendSvil).toHaveBeenNthCalledWith(1, SvilUSB.CMD_SVIL_TAP_DANCE_GET, svilIndexArgs(version, 0), { uint8: true });
      const last = kbinfo.tapdances![count - 1];
      expect(last).toMatchObject({ idx: count - 1, tap: 'KC_A', hold: 'KC_B', doubletap: 'KC_C', taphold: 'KC_D', tapping_term: count - 1 + 100 });
      if (version >= 2) {
        expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_TAP_DANCE_GET, [255, 0], { uint8: true });
      }

      usb.sendSvil.mockReset();
      usb.sendSvil.mockResolvedValue(new Uint8Array([SvilUSB.CMD_SVIL_TAP_DANCE_SET, 0]));
      await service.push(kbinfo, count - 1);
      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_TAP_DANCE_SET, [
        ...svilIndexArgs(version, count - 1),
        0x04, 0, 0x05, 0, 0x06, 0, 0x07, 0, (count - 1 + 100) & 0xff, ((count - 1 + 100) >> 8) | 0x80,
      ], {});
    });

    it('combo get/set use the right index width and entry offset', async () => {
      usb.sendSvil.mockImplementation((cmd: number, args: number[]) =>
        Promise.resolve(entryResponse(version, cmd, args, [0x04, 0, 0x05, 0, 0, 0, 0, 0, 0x06, 0, 0x34, 0x12]))
      );
      const service = new ComboService(usb as unknown as SvilUSB);
      const kbinfo = createTestKeyboardInfo({ combo_count: 1 });
      await service.get(kbinfo);

      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_COMBO_GET, svilIndexArgs(version, 0), { uint8: true });
      expect(kbinfo.combos![0]).toMatchObject({ cmbid: 0, keys: ['KC_A', 'KC_B', 'KC_NO', 'KC_NO'], output: 'KC_C', options: 0x1234 });

      usb.sendSvil.mockReset();
      kbinfo.combos![0].cmbid = 255;
      await service.push(kbinfo, 255);
      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_COMBO_SET, [
        ...svilIndexArgs(version, 255),
        0x04, 0, 0x05, 0, 0, 0, 0, 0, 0x06, 0, 0x34, 0x12,
      ], {});
    });

    it('key override get/set use the right index width and entry offset', async () => {
      usb.sendSvil.mockImplementation((cmd: number, args: number[]) =>
        Promise.resolve(entryResponse(version, cmd, args, [0x04, 0, 0x05, 0, 0x0f, 0, 0, 0x80, 1, 2, 3, 4]))
      );
      const service = new OverrideService(usb as unknown as SvilUSB);
      const kbinfo = createTestKeyboardInfo({ key_override_count: 1 });
      await service.get(kbinfo);

      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_KEY_OVERRIDE_GET, svilIndexArgs(version, 0), { uint8: true });
      expect(kbinfo.key_overrides![0]).toMatchObject({
        koid: 0, trigger: 'KC_A', replacement: 'KC_B', layers: 0x8000000f,
        trigger_mods: 1, negative_mod_mask: 2, suppressed_mods: 3, options: 4,
      });

      usb.sendSvil.mockReset();
      await service.push(kbinfo, 0);
      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_KEY_OVERRIDE_SET, [
        ...svilIndexArgs(version, 0),
        0x04, 0, 0x05, 0, 0x0f, 0, 0, 0x80, 1, 2, 3, 4,
      ], {});
    });

    it('alt-repeat key and leader get/set use the right index width and entry offset', async () => {
      usb.sendSvil.mockImplementation((cmd: number, args: number[]) => {
        if (cmd === SvilUSB.CMD_SVIL_ALT_REPEAT_KEY_GET) {
          return Promise.resolve(entryResponse(version, cmd, args, [0x04, 0, 0x05, 0, 3, 0x80]));
        }
        if (cmd === SvilUSB.CMD_SVIL_LEADER_GET) {
          return Promise.resolve(entryResponse(version, cmd, args, [0x04, 0, 0x05, 0, 0, 0, 0, 0, 0, 0, 0x06, 0, 0x34, 0x12]));
        }
        return Promise.resolve(new Uint8Array([cmd, 0]));
      });
      const service = new SvilService(usb as unknown as SvilUSB);
      const kbinfo = createTestKeyboardInfo({ alt_repeat_key_count: 1, leader_count: 1 });
      await service.getAltRepeatKeys(kbinfo);
      await service.getLeaders(kbinfo);

      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_ALT_REPEAT_KEY_GET, svilIndexArgs(version, 0), { uint8: true });
      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_LEADER_GET, svilIndexArgs(version, 0), { uint8: true });
      expect(kbinfo.alt_repeat_keys![0]).toMatchObject({ keycode: 'KC_A', alt_keycode: 'KC_B', allowed_mods: 3, options: 0x80 });
      expect(kbinfo.leaders![0]).toMatchObject({ sequence: ['KC_A', 'KC_B'], output: 'KC_C', options: 0x1234 });

      usb.sendSvil.mockClear();
      await service.updateAltRepeatKey(kbinfo, 0);
      await service.updateLeader(kbinfo, 0);
      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_ALT_REPEAT_KEY_SET, [
        ...svilIndexArgs(version, 0), 0x04, 0, 0x05, 0, 3, 0x80,
      ], {});
      expect(usb.sendSvil).toHaveBeenCalledWith(SvilUSB.CMD_SVIL_LEADER_SET, [
        ...svilIndexArgs(version, 0), 0x04, 0, 0x05, 0, 0, 0, 0, 0, 0, 0, 0x06, 0, 0x34, 0x12,
      ], {});
    });

    it('label set/clear use the right index width', async () => {
      usb.sendSvil.mockImplementation((cmd: number) => Promise.resolve(new Uint8Array([cmd, 0])));
      const labels = new LabelService(usb as unknown as SvilUSB);

      expect(await labels.set(SvilUSB.SVIL_LABEL_TYPE_MACRO, 200, 'Sig')).toBe(true);
      expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_LABEL_SET, [
        SvilUSB.SVIL_LABEL_TYPE_MACRO, ...svilIndexArgs(version, 200), ...LABEL('Sig'),
      ], { uint8: true });

      expect(await labels.clear(SvilUSB.SVIL_LABEL_TYPE_TAP_DANCE, 255)).toBe(true);
      expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_LABEL_CLEAR, [
        SvilUSB.SVIL_LABEL_TYPE_TAP_DANCE, ...svilIndexArgs(version, 255),
      ], { uint8: true });

      usb.sendSvil.mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_LABEL_SET, 2]));
      expect(await labels.set(SvilUSB.SVIL_LABEL_TYPE_LAYER, 40, 'x')).toBe(false);
    });
  });
});

describe('LabelService scans', () => {
  it('v2: walks sparse labels one per request and stops at found = 0', async () => {
    const usb = makeUsb(2);
    const stored = new Map<number, string>([[3, 'Nav'], [200, 'Ünïcödé'], [255, 'Last']]);
    usb.sendSvil.mockImplementation((cmd: number, args: number[]) => {
      const [type, lo, hi] = args;
      const start = lo | (hi << 8);
      const next = [...stored.keys()].sort((a, b) => a - b).find(i => i >= start);
      if (next === undefined) {
        return Promise.resolve(new Uint8Array([cmd, type, 0, 0, 1, ...new Uint8Array(16)]));
      }
      return Promise.resolve(new Uint8Array([cmd, type, 1, next & 0xff, next >> 8, ...LABEL(stored.get(next)!)]));
    });

    const labels = await new LabelService(usb as unknown as SvilUSB).getAll(SvilUSB.SVIL_LABEL_TYPE_MACRO, 256);

    expect([...labels.entries()]).toEqual([[3, 'Nav'], [200, 'Ünïcödé'], [255, 'Last']]);
    expect(usb.sendSvil.mock.calls.map(c => c[1])).toEqual([
      [2, 0, 0], [2, 4, 0], [2, 201, 0], [2, 0, 1],
    ]);
    expect(usb.sendSvil.mock.calls.every(c => c[0] === SvilUSB.CMD_SVIL_LABEL_GET)).toBe(true);
  });

  it('v2: no labels at all is a single request', async () => {
    const usb = makeUsb(2);
    usb.sendSvil.mockResolvedValue(new Uint8Array([SvilUSB.CMD_SVIL_LABEL_GET, 0, 0, 0, 1, ...new Uint8Array(16)]));
    const labels = await new LabelService(usb as unknown as SvilUSB).getAll(SvilUSB.SVIL_LABEL_TYPE_LAYER, 32);
    expect(labels.size).toBe(0);
    expect(usb.sendSvil).toHaveBeenCalledTimes(1);
  });

  it('v1: reads the presence bitmap and follows the continuation flag', async () => {
    const usb = makeUsb(1);
    // 10 tap dances, labels at 1 and 9; bitmap MSB first: 0b01000000 0b01000000
    // Packets hold one label here, so the first sets "more" and the second finishes.
    usb.sendSvil
      .mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_LABEL_GET, 1, 0x01, 0x40, 0x40, ...LABEL('One')]))
      .mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_LABEL_GET, 1, 0x00, ...LABEL('Nine')]));

    const labels = await new LabelService(usb as unknown as SvilUSB).getAll(SvilUSB.SVIL_LABEL_TYPE_TAP_DANCE, 10);

    expect([...labels.entries()]).toEqual([[1, 'One'], [9, 'Nine']]);
    expect(usb.sendSvil.mock.calls.map(c => c[1])).toEqual([[1, 0], [1, 2]]);
  });

  it('truncates labels to 16 bytes without splitting a character', () => {
    const service = new LabelService(makeUsb(2) as unknown as SvilUSB);
    const bytes = service.encode('ééééééééé'); // 9 x 2 bytes
    expect(bytes).toHaveLength(16);
    expect(service.decode(new Uint8Array(bytes))).toBe('éééééééé');
  });
});

describe('256 macros', () => {
  it('reads the macro count as two bytes, and one-byte counts from older firmware', async () => {
    for (const [lo, hi, expected] of [[0x00, 0x01, 256], [0x20, 0x00, 32]]) {
      const usb = makeUsb(2);
      usb.send.mockImplementation((cmd: number) => {
        if (cmd === SvilUSB.CMD_VIA_MACRO_GET_COUNT) {
          return Promise.resolve(new Uint8Array([SvilUSB.CMD_VIA_MACRO_GET_COUNT, lo, hi, 0, 0]));
        }
        return Promise.resolve(0x1000);
      });
      const kbinfo = createTestKeyboardInfo();
      await new SvilService(usb as unknown as SvilUSB).getFeatures(kbinfo);
      expect(kbinfo.macro_count).toBe(expected);
    }
  });

  it('maps M128-M255 to 0x7680-0x76FF and keeps M0-M127 at QK_MACRO', () => {
    expect(keyService.parse('M0')).toBe(0x7700);
    expect(keyService.parse('M127')).toBe(0x777f);
    expect(keyService.parse('M128')).toBe(0x7680);
    expect(keyService.parse('M255')).toBe(0x76ff);
    expect(keyService.stringify(0x7680)).toBe('M128');
    expect(keyService.stringify(0x76ff)).toBe('M255');
    expect(keyService.stringify(0x777f)).toBe('M127');
    // 0x7780+ is no longer a macro
    expect(keyService.stringify(0x7780)).not.toBe('M128');
  });

  it('types M128-M255 as macros with their index', () => {
    keyService.generateAllKeycodes(createTestKeyboardInfo());
    expect(keyService.define('M200')).toMatchObject({ type: 'macro', idx: 200 });
    expect(keyService.define(0x76ff)).toMatchObject({ type: 'macro', idx: 255 });
    expect(keyService.parseDesc('M255')).toEqual({ type: 'macro', mask: 'M', idx: 255 });
  });
});
