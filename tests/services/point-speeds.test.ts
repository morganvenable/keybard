import { describe,it,expect,vi } from 'vitest';
import { POINT_CONTROL_FLAG } from '@/constants/point-controls';
import { POINT_DEFAULTS,upgradePointControls,encodePointControls,decodePointControls,effectiveSpeed,validatePointControls } from '@/constants/point-controls';
import { PointControlsService } from '@/services/point-controls.service';
import { fileService } from '@/services/file.service';
import { prepareImport } from '@/services/import-preflight';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { SvilUSB } from '@/services/usb.service';
const config=()=>upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)},3);
describe('point speed storage and transport',()=>{
    it('packs all inheritance, axis links and advanced settings into the existing 16-byte table',()=>{
        const value=config();value.defaults={horizontal:12,vertical:63,linked:false};value.profiles[1].speed={horizontal:0,vertical:45,linked:false};value.profiles[1].interval=249;value.profiles[1].reversal=64;
        const bytes=encodePointControls(value);expect(bytes).toHaveLength(16);const loaded=decodePointControls(bytes);expect(encodePointControls(loaded)).toEqual(bytes);expect(loaded.defaults).toEqual(value.defaults);expect(loaded.profiles[1].speed).toEqual(value.profiles[1].speed);expect(loaded.profiles[1].interval).toBe(249);expect(loaded.profiles[1].reversal).toBe(64);
    });
    it('matches the firmware golden default packet',()=>{const value=config();value.universal=true;value.profiles.forEach(p=>{p.speed={...value.defaults!};p.useDefaults=true;p.interval=0;});expect(encodePointControls(value)).toEqual([36, 57, 73, 14, 112, 144, 228, 0, 7, 73, 14, 112, 144, 228, 0, 7]);});
    it('migrates old speeds as linked overrides without changing output limits',()=>{
        const value=config();expect(value.universal).toBe(false);expect(effectiveSpeed(value,1).horizontal).toBe(45);expect(value.profiles[3].interval).toBe(160);expect(value.profiles[1].useDefaults).toBe(false);
    });
    it('rejects linked pairs with conflicting values',()=>{const value=config();value.defaults!.vertical=1;expect(()=>validatePointControls(value)).toThrow();});
    it.each([2,3])('loads and saves v%s through the existing generation-checked transaction',async version=>{
        const value=config();if(version===3)value.profiles.forEach(p=>p.interval=0);const table=encodePointControls(value);const usb={sendSvil:vi.fn().mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_GET,0,version,9,0,...table])).mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_SET,0,version,10,0,...table]))};
        const service=new PointControlsService(usb as any);const loaded=await service.load();await service.save(loaded);expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_POINT_TOOLS_SET,[version,9,0,...table],{uint8:true});
    });
});

it('exports independent axes and rejects importing them onto an old board before writes',()=>{
    const value=config();value.defaults={horizontal:10,vertical:50,linked:false};
    const kb={rows:1,cols:2,layers:1,keymap:[[0x7e08,0x7e10]],feature_flags2:POINT_CONTROL_FLAG,pointing_controls:value,svil_proto:3,kbid:'01',custom_keycodes:[],macros:[],combos:[],tapdances:[],key_overrides:[],alt_repeat_keys:[],leaders:[]} as KeyboardInfo;
    const imported=fileService.svilToKBINFO(JSON.parse(fileService.kbinfoToSvil(kb)));
    expect(imported.pointing_controls).toEqual(value);
    const old={...kb,pointing_controls:{version:1 as const,profiles:structuredClone(POINT_DEFAULTS)}};
    expect(prepareImport(imported,old).errors.join(' ')).toContain('Update the keyboard firmware');
    expect(prepareImport(old,kb).keyboard.pointing_controls?.version).toBe(3);
});

it('supports an uncapped v3 table while retaining v2 validation',()=>{
    const value=config();value.profiles.forEach(p=>p.interval=0);
    expect(decodePointControls(encodePointControls(value)).profiles.every(p=>p.interval===0)).toBe(true);
    expect(()=>validatePointControls({...value,version:2})).toThrow();
    value.profiles[0].interval=4;expect(()=>validatePointControls(value)).not.toThrow();
});
