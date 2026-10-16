import { describe,it,expect,vi } from 'vitest';
import { POINT_CONTROL_FLAG } from '@/constants/point-controls';
import { POINT_DEFAULTS,upgradePointControls,encodePointControls,decodePointControls,validatePointControls,configuredPointKey,POINT_KEYS } from '@/constants/point-controls';
import { PointControlsService } from '@/services/point-controls.service';
import { prepareImport } from '@/services/import-preflight';
import { fileService } from '@/services/file.service';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { SvilUSB } from '@/services/usb.service';
const make=()=>{const c=upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)});c.profiles[0].action=7;c.profiles[0].reversal=1;return decodePointControls(encodePointControls(c),5);};
describe('proportional scrolling configuration',()=>{
    it('uses the existing slot bindings and storage with a zero or nonzero dead zone',()=>{
        const c=make();expect(c.version).toBe(5);expect(configuredPointKey(POINT_KEYS[0],c).label).toBe('SCROLL\nHOLD');
        for(const dead of [0,7,63]){c.profiles[0].reversal=dead+1;const packed=encodePointControls(c);expect(packed).toHaveLength(19);expect(decodePointControls(packed,5)).toEqual(c);}
        expect(()=>validatePointControls({...c,version:4})).toThrow();
    });
    it('saves through the existing generation guarded HID transaction',async()=>{
        const c=make(),bytes=encodePointControls(c);
        const usb={sendSvil:vi.fn().mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_GET,0,5,9,0,...bytes])).mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_SET,0,5,10,0,...bytes]))};
        const service=new PointControlsService(usb as any);expect(await service.load()).toEqual(c);await service.save(c);
        expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_POINT_TOOLS_SET,[5,9,0,...bytes],{uint8:true});
    });
    it('round trips files and skips proportional behavior on v4 firmware',()=>{
        const kb={rows:1,cols:1,layers:1,keymap:[[0x7e00]],feature_flags2:POINT_CONTROL_FLAG,pointing_controls:make(),svil_proto:3,kbid:'01',custom_keycodes:[],macros:[],combos:[],tapdances:[],key_overrides:[],alt_repeat_keys:[],leaders:[]} as KeyboardInfo;
        const imported=fileService.svilToKBINFO(JSON.parse(fileService.kbinfoToSvil(kb)));expect(imported.pointing_controls).toEqual(kb.pointing_controls);
        const old={...kb,pointing_controls:upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)},4)};
        const skipped=prepareImport(imported,old);expect(skipped.errors).toEqual([]);expect(skipped.keyboard.pointing_controls).toEqual(old.pointing_controls);
        const upgraded=prepareImport(old,kb);expect(upgraded.errors).toEqual([]);expect(upgraded.keyboard.pointing_controls?.version).toBe(5);
    });
});
