import { describe, expect, it, vi } from 'vitest';
import {
    POINT_CONTROL_FLAG, POINT_DEFAULTS, POINT_GAIN_DEFAULTS, POINT_TABLE_VERSION, formatGain,
    upgradePointControls, encodePointControls, decodePointControls, validatePointControls, type PointControls,
} from '@/constants/point-controls';
import { PointControlsService } from '@/services/point-controls.service';
import { fileService } from '@/services/file.service';
import { prepareImport } from '@/services/import-preflight';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { SvilUSB } from '@/services/usb.service';

// Table version 6: version 5 plus the touchpad and TrackPoint device gains (sixteenths).
// As a board reports them (one encode and decode, so every field is in its canonical form).
const v5 = (): PointControls => decodePointControls(encodePointControls(upgradePointControls({version: 1, profiles: structuredClone(POINT_DEFAULTS)}, 5)), 5);
const v6 = (touchpad = 32, trackpoint = 32): PointControls => decodePointControls(encodePointControls({...upgradePointControls(v5(), 6), gains: {touchpad, trackpoint}}), 6);
const board = (controls?: PointControls) => ({rows: 1, cols: 1, layers: 1, keymap: [[0x7e00]], feature_flags2: POINT_CONTROL_FLAG, pointing_controls: controls, svil_proto: 3, kbid: '01', custom_keycodes: [], macros: [], combos: [], tapdances: [], key_overrides: [], alt_repeat_keys: [], leaders: []} as KeyboardInfo);
const getReply = (value: PointControls, cmd = SvilUSB.CMD_SVIL_POINT_TOOLS_GET, generation = 3, status = 0) =>
    new Uint8Array([cmd, status, value.version, generation, 0, ...encodePointControls(value)]);

describe('pointing tools device gains (table version 6)', () => {
    it('writes version 6 and defaults both gains to 2.0, as the firmware does', () => {
        expect(POINT_TABLE_VERSION).toBe(6);
        expect(POINT_GAIN_DEFAULTS).toEqual({touchpad: 32, trackpoint: 32});
        expect(formatGain(32)).toBe('2.0x');
        expect(formatGain(16)).toBe('1.0x');
        expect(formatGain(20)).toBe('1.25x');
    });
    it('appends the touchpad then the TrackPoint gain after the tools, and reads them back', () => {
        const value = v6(48, 8);
        const bytes = encodePointControls(value);
        expect(bytes).toHaveLength(21);
        expect(bytes.slice(0, 19)).toEqual(encodePointControls(v5()));
        expect(bytes.slice(19)).toEqual([48, 8]);
        expect(decodePointControls(bytes, 6)).toEqual(value);
        expect(() => decodePointControls(bytes.slice(0, 20), 6)).toThrow('Incomplete');
    });
    it('accepts gains 1-255 on version 6 only', () => {
        expect(() => validatePointControls(v6(1, 255))).not.toThrow();
        for (const bad of [0, 256, 1.5, -1]) expect(() => validatePointControls(v6(bad, 32))).toThrow('gain');
        const missing = v6(); delete missing.gains;
        expect(() => validatePointControls(missing)).toThrow('gain');
        expect(() => validatePointControls({...v5(), gains: {touchpad: 32, trackpoint: 32}})).toThrow('version 6');
    });
    it('upgrades to 6 with the defaults, keeps a value at 6, and drops the gains going to 5', () => {
        expect(upgradePointControls(v5(), 6).gains).toEqual(POINT_GAIN_DEFAULTS);
        expect(upgradePointControls(v6(48, 8))).toEqual(v6(48, 8)); // the default target keeps 6
        const down = upgradePointControls(v6(48, 8), 5);
        expect(down.version).toBe(5);
        expect(down.gains).toBeUndefined();
        expect(() => validatePointControls(down)).not.toThrow();
        expect(upgradePointControls(v5()).version).toBe(5);
    });
    it('loads a version 6 board and saves its gains in a version 6 SET', async () => {
        const saved = v6(40, 24);
        const usb = {sendSvil: vi.fn().mockResolvedValueOnce(getReply(v6())).mockResolvedValueOnce(getReply(saved, SvilUSB.CMD_SVIL_POINT_TOOLS_SET, 4))};
        const service = new PointControlsService(usb as any);
        expect(await service.load()).toEqual(v6());
        await service.save(saved);
        const args = usb.sendSvil.mock.calls[1][1];
        expect(usb.sendSvil.mock.calls[1][0]).toBe(SvilUSB.CMD_SVIL_POINT_TOOLS_SET);
        // version, generation, 16 speeds, 3 tools, touchpad gain, TrackPoint gain
        expect(args).toHaveLength(24);
        expect(args.slice(0, 3)).toEqual([6, 3, 0]);
        expect(args.slice(22)).toEqual([40, 24]);
    });
    it('refuses a version 6 reply too short to hold the gains, and a gains readback that differs', async () => {
        const short = getReply(v6()).slice(0, 25);
        await expect(new PointControlsService({sendSvil: vi.fn().mockResolvedValue(short)} as any).load()).rejects.toThrow('matching keyboard firmware');
        const usb = {sendSvil: vi.fn().mockResolvedValueOnce(getReply(v6())).mockResolvedValueOnce(getReply(v6(32, 32), SvilUSB.CMD_SVIL_POINT_TOOLS_SET))};
        const service = new PointControlsService(usb as any);
        await service.load();
        await expect(service.save(v6(48, 32))).rejects.toThrow('readback');
    });
    it('still loads and saves a version 5 board, with no gains', async () => {
        const usb = {sendSvil: vi.fn().mockResolvedValueOnce(getReply(v5())).mockResolvedValueOnce(getReply(v5(), SvilUSB.CMD_SVIL_POINT_TOOLS_SET))};
        const service = new PointControlsService(usb as any);
        const loaded = await service.load();
        expect(loaded.version).toBe(5);
        expect(loaded.gains).toBeUndefined();
        await service.save(loaded);
        expect(usb.sendSvil.mock.calls[1][1]).toHaveLength(22);
        await expect(service.save(v6())).rejects.toThrow('Update the keyboard firmware');
    });
    it('reads STATUS format 2: each hand\'s device type and whether a touchpad is read from its contacts', async () => {
        const format2 = new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_STATUS, 2, 2, 2, 3, 0, 0, 1, 9, 0, 0, 0, 7, 0, 0, 0, 2, 0, 0, 0, 2, 1, 1]);
        const status = await new PointControlsService({sendSvil: vi.fn().mockResolvedValue(format2)} as any).status();
        expect(status).toEqual({left: 2, right: 2, axes: 3, locked: false, session: false, recognized: 9, admitted: 7, dropped: 2, devices: [2, 1], contacts: [true, false]});
        const format1 = new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_STATUS, 1, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        const old = await new PointControlsService({sendSvil: vi.fn().mockResolvedValue(format1)} as any).status();
        expect(old.devices).toBeUndefined();
        await expect(new PointControlsService({sendSvil: vi.fn().mockResolvedValue(format2.slice(0, 21))} as any).status()).rejects.toThrow('unavailable');
    });
    it('carries the gains through a layout export and import', () => {
        const exported = JSON.parse(fileService.kbinfoToSvil(board(v6(48, 8))));
        expect(exported.pointing_controls.gains).toEqual({touchpad: 48, trackpoint: 8});
        expect(fileService.svilToKBINFO(exported).pointing_controls).toEqual(v6(48, 8));
        // Damaged gains drop the tools block only.
        exported.pointing_controls.gains.touchpad = 0;
        const damaged = fileService.svilToKBINFO(exported);
        expect(damaged.pointing_controls).toBeUndefined();
        expect(damaged.keymap?.[0][0]).toBe(0x7e00);
    });
    it('import preflight: gains move between version 6 boards and a version 5 file keeps the board\'s gains', () => {
        const both = prepareImport(board(v6(48, 8)), board(v6()));
        expect(both.keyboard.pointing_controls).toEqual(v6(48, 8));
        expect(both.summary.join(' ')).toContain('touchpad and TrackPoint gains');
        const old = prepareImport(board(v5()), board(v6(40, 24)));
        expect(old.keyboard.pointing_controls?.version).toBe(6);
        expect(old.keyboard.pointing_controls?.gains).toEqual({touchpad: 40, trackpoint: 24});
        expect(old.warnings).toEqual([]);
    });
    it('import preflight: a version 6 file onto version 5 firmware imports the rest and skips the gains', () => {
        const review = prepareImport(board(v6(48, 8)), board(v5()));
        expect(review.errors).toEqual([]);
        expect(review.keyboard.pointing_controls?.version).toBe(5);
        expect(review.keyboard.pointing_controls?.gains).toBeUndefined();
        expect(review.summary).toContain('Pointing tool settings');
        expect(review.warnings.join(' ')).toContain('gains are skipped');
    });
});
