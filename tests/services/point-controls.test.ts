import { describe, expect, it, vi } from 'vitest';
import { POINT_CONTROL_FLAG } from '@/constants/point-controls';
import { PointControlsService } from '@/services/point-controls.service';
import { POINT_DEFAULTS, POINT_KEYS, validatePointControls } from '@/constants/point-controls';
import { keyService } from '@/services/key.service';
import { getKeyContents } from '@/utils/keys';
import { fileService } from '@/services/file.service';
import { prepareImport } from '@/services/import-preflight';
import { ImportService } from '@/services/import.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { SvilUSB } from '@/services/usb.service';

const config = () => ({version: 1 as const, profiles: structuredClone(POINT_DEFAULTS)});
const reply = (cmd=SvilUSB.CMD_SVIL_POINT_TOOLS_GET, generation=4, status=0) => new Uint8Array([cmd,status,1,generation,0,...POINT_DEFAULTS.flatMap(p=>[p.distance&255,p.distance>>8,p.interval,p.reversal])]);
const keyboard = () => ({rows:1, cols:2, layers:1, keymap:[[0x7e08,0x7e10]], feature_flags2:POINT_CONTROL_FLAG, pointing_controls:config(), svil_proto:3, kbid:'01', custom_keycodes:[], macros:[], combos:[], tapdances:[], key_overrides:[], alt_repeat_keys:[], leaders:[]} as KeyboardInfo);

describe('pointing controls system contract', () => {
    it('loads the firmware table and sends a bounded versioned atomic update with its generation', async () => {
        const usb={sendSvil:vi.fn().mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply(SvilUSB.CMD_SVIL_POINT_TOOLS_SET,5))};
        const service=new PointControlsService(usb as any);
        expect(await service.load()).toEqual(config());
        await service.save(config());
        expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_POINT_TOOLS_SET,[1,4,0,...POINT_DEFAULTS.flatMap(p=>[p.distance&255,p.distance>>8,p.interval,p.reversal])],{uint8:true});
        expect(usb.sendSvil.mock.calls[1][1]).toHaveLength(19);
    });
    it.each([[1,'Stop active'],[2,'another window'],[3,'rejected'],[4,'could not save']])('surfaces firmware refusal %s', async (status, message) => {
        const usb={sendSvil:vi.fn().mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply(SvilUSB.CMD_SVIL_POINT_TOOLS_SET,4,status as number))};
        const service=new PointControlsService(usb as any); await service.load();
        await expect(service.save(config())).rejects.toThrow(message as string);
    });
    it('rejects invalid values before sending USB and requires a loaded connection', async () => {
        const usb={sendSvil:vi.fn()};const service=new PointControlsService(usb as any);
        await expect(service.save(config())).rejects.toThrow('Reconnect');
        const invalid=config();invalid.profiles[0].distance=0;
        await expect(service.save(invalid)).rejects.toThrow('Invalid');expect(usb.sendSvil).not.toHaveBeenCalled();
        expect(()=>validatePointControls({version:2,profiles:POINT_DEFAULTS})).toThrow();
    });
    it('decodes live status and verifies Stop acknowledgement', async () => {
        const usb={sendSvil:vi.fn().mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_STATUS,1,1,4,2,1,1,1,5,0,0,0,3,0,0,0,2,0,0,0])).mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_STOP,0,1]))};
        const service=new PointControlsService(usb as any);
        expect(await service.status()).toEqual({left:1,right:4,axes:2,locked:true,session:true,multiplier:1,recognized:5,admitted:3,dropped:2});
        await service.stop();expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_POINT_TOOLS_STOP,[],{uint8:true});
    });
    it('uses named keys without confusing existing Sval custom keycodes', () => {
        const kb=keyboard();kb.custom_keycodes=[{name:'SV_LEFT_DPI_INC',title:'DPI',shortName:'DPI'}];
        keyService.generateAllKeycodes(kb);
        for (const key of POINT_KEYS) {
            expect(keyService.parse(key.name)).toBe(key.code);
            expect(keyService.stringify(key.code)).toBe(key.name);
            expect(getKeyContents(kb,key.name).title).toBe(key.title);
        }
        expect(keyService.parse('SV_LEFT_DPI_INC')).toBe(0x7e40);
        keyService.generateAllKeycodes({...kb,feature_flags2:0,pointing_controls:undefined});
        expect(keyService.stringify(0x7e00)).not.toBe(POINT_KEYS[0].name);
    });
    it('round-trips named bindings and all tuning through a normal layout export', () => {
        const kb=keyboard(); kb.pointing_controls!.profiles[2].distance=233;
        const exported=JSON.parse(fileService.kbinfoToSvil(kb));
        expect(exported.layout[0][0]).toEqual(['SV_POINT_R_VOLUME_HOLD','SV_POINT_CANCEL']);
        const imported=fileService.svilToKBINFO(exported);
        expect(imported.keymap?.[0].slice(0,2)).toEqual(kb.keymap![0]);
        expect(imported.pointing_controls).toEqual(kb.pointing_controls);
        expect(prepareImport(imported,{...kb,feature_flags2:0,pointing_controls:undefined}).errors.join(' ')).toContain('matching firmware');
    });
    it('queues imported tuning through the normal import batch', async () => {
        const kb=keyboard(), next=keyboard();next.pointing_controls!.profiles[0].distance=100;
        const enqueue=vi.fn().mockResolvedValue(undefined);
        await new ImportService().syncWithKeyboard(next,kb,enqueue,{});
        expect(enqueue.mock.calls.some(call=>call[2]?.writeKey==='pointing-controls')).toBe(true);
    });
});

describe('pointing tools protocol numbers', () => {
    it('uses its own commands and discovery bit, apart from pointing hardware and motion', async () => {
        const { supportsPointControls } = await import('@/constants/point-controls');
        expect([SvilUSB.CMD_SVIL_POINT_TOOLS_GET, SvilUSB.CMD_SVIL_POINT_TOOLS_SET, SvilUSB.CMD_SVIL_POINT_TOOLS_STATUS, SvilUSB.CMD_SVIL_POINT_TOOLS_STOP]).toEqual([0x2f, 0x30, 0x31, 0x32]);
        expect(POINT_CONTROL_FLAG).toBe(0x20);
        // Bits 0-4 belong to default layer, pointing hardware, modifier state, pointing motion and gestures.
        for (const bit of [0x01, 0x02, 0x04, 0x08, 0x10]) expect(supportsPointControls({ feature_flags2: bit })).toBe(false);
        expect(supportsPointControls({ feature_flags2: 0x22 })).toBe(true);
    });
});
