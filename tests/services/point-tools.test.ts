import { describe, expect, it, vi } from 'vitest';
import { POINT_CONTROL_FLAG } from '@/constants/point-controls';
import { POINT_DEFAULTS, POINT_KEYS, upgradePointControls, encodePointControls, decodePointControls, validatePointControls, configuredPointKey } from '@/constants/point-controls';
import { PointControlsService } from '@/services/point-controls.service';
import { fileService } from '@/services/file.service';
import { prepareImport } from '@/services/import-preflight';
import { getKeyContents } from '@/utils/keys';
import type { KeyboardInfo } from '@/types/keyboard.types';
import { SvilUSB } from '@/services/usb.service';
const config=()=>decodePointControls(encodePointControls(upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)},4)),4);
const keyboard=()=>({rows:1,cols:1,layers:1,keymap:[[0x7e08]],feature_flags2:POINT_CONTROL_FLAG,pointing_controls:config(),svil_proto:3,kbid:'01',custom_keycodes:[],macros:[],combos:[],tapdances:[],key_overrides:[],alt_repeat_keys:[],leaders:[]} as KeyboardInfo);
describe('configurable pointing tools',()=>{
    it('keeps all legacy slot identities and tuning on upgrade',()=>{
        const old=upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)},3);
        const next=upgradePointControls(old,4);expect(next.version).toBe(4);
        expect(next.profiles.map(p=>p.action)).toEqual([0,1,2,3]);
        next.profiles.forEach((p,i)=>expect(p).toMatchObject({...old.profiles[i],invertHorizontal:false,invertVertical:false}));
        expect(configuredPointKey(POINT_KEYS[8],next).title).toBe('Hold Tool 1 · Volume · Right pointer');
        expect(configuredPointKey(POINT_KEYS[8],next).label).toBe('Vol1\nHold');
        expect(configuredPointKey(POINT_KEYS[9],next).label).toBe('Vol1\nTG');
    });
    it('round trips every preset and inversion pair in all four slots',()=>{
        for(let slot=0;slot<4;slot++)for(let action=0;action<7;action++)for(let flags=0;flags<4;flags++){
            const c=config();Object.assign(c.profiles[slot],{action,invertHorizontal:!!(flags&1),invertVertical:!!(flags&2)});
            const bytes=encodePointControls(c);expect(bytes).toHaveLength(19);
            expect(configuredPointKey(POINT_KEYS[slot*2],c).label.split('\n')[0].length).toBeLessThanOrEqual(4);
            expect(decodePointControls(bytes,4)).toEqual(c);
        }
        expect(encodePointControls(config()).slice(16)).toEqual([32,136,1]);
    });
    it('rejects missing fields, unknown actions, short frames and reserved bits',()=>{
        const c=config();c.profiles[0].action=7;expect(()=>validatePointControls(c)).toThrow();
        delete c.profiles[0].action;expect(()=>validatePointControls(c)).toThrow();
        expect(()=>decodePointControls(new Uint8Array(18),4)).toThrow('Incomplete');
        const bytes=encodePointControls(config());bytes[18]|=128;expect(()=>decodePointControls(bytes,4)).toThrow('reserved');
    });
    it('sends a complete generation checked update that fits the existing HID frame',async()=>{
        const c=config();c.profiles[0].action=4;c.profiles[2].action=5;
        const bytes=encodePointControls(c);
        const usb={sendSvil:vi.fn().mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_GET,0,4,9,0,...bytes])).mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_POINT_TOOLS_SET,0,4,10,0,...bytes]))};
        const service=new PointControlsService(usb as any);expect(await service.load()).toEqual(c);await service.save(c);
        expect(usb.sendSvil).toHaveBeenLastCalledWith(SvilUSB.CMD_SVIL_POINT_TOOLS_SET,[4,9,0,...bytes],{uint8:true});expect(usb.sendSvil.mock.calls[1][1]).toHaveLength(22);
    });
    it('preserves bindings and custom tools in files and skips them on older firmware',()=>{
        const kb=keyboard();kb.pointing_controls!.profiles[0].action=4;kb.pointing_controls!.profiles[0].invertVertical=true;
        expect(getKeyContents(kb,'SV_POINT_R_VOLUME_HOLD').title).toBe('Hold Tool 1 · Zoom · Right pointer');
        const imported=fileService.svilToKBINFO(JSON.parse(fileService.kbinfoToSvil(kb)));
        expect(imported.pointing_controls).toEqual(kb.pointing_controls);expect(imported.keymap).toEqual(kb.keymap);
        const old={...kb,pointing_controls:upgradePointControls({version:1,profiles:structuredClone(POINT_DEFAULTS)},3)};
        const plan=prepareImport(imported,old);
        expect(plan.errors).toEqual([]);
        expect(plan.keyboard.pointing_controls).toEqual(old.pointing_controls);
        expect(prepareImport(old,kb).keyboard.pointing_controls?.version).toBe(4);
    });
});
