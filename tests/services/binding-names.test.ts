import { describe, it, expect, vi } from 'vitest';
import { LabelService } from '../../src/services/label.service';
import { SvilUSB } from '../../src/services/usb.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

function setup() {
    const names = new Map<number, Map<number, string>>();
    const codec = new LabelService({} as SvilUSB);
    const usb = { svilProtocolVersion: 3, sendSvil: vi.fn(async (cmd: number, args: number[]) => {
        const [type, lo, hi] = args; const index = lo | hi << 8;
        if (!names.has(type)) names.set(type, new Map());
        const table = names.get(type)!;
        if (cmd === SvilUSB.CMD_SVIL_LABEL_SET) table.set(index, codec.decode(Uint8Array.from(args.slice(3))));
        if (cmd === SvilUSB.CMD_SVIL_LABEL_CLEAR) table.delete(index);
        if (cmd === SvilUSB.CMD_SVIL_LABEL_GET) {
            const found = [...table.keys()].sort((a,b) => a-b).find(i => i >= index);
            return found === undefined ? Uint8Array.of(cmd,type,0) : Uint8Array.from([cmd,type,1,found & 255,found >> 8,...codec.encode(table.get(found)!)]);
        }
        return Uint8Array.of(cmd,0);
    }) };
    const service = new LabelService(usb as unknown as SvilUSB);
    const kb: KeyboardInfo = { svil_proto: 3, macro_count: 4, tapdance_count: 4 };
    return { service, kb, usb };
}

describe('macro and tap dance labels', () => {
    it('reloads both name types separately, clears blanks and replaces stale defaults', async () => {
        const {service,kb} = setup();
        await service.saveName(kb, 'macro', 2, 'Email');
        await service.saveName(kb, 'tapdance', 2, 'Escape');
        kb.cosmetic = { macros: {'1':'Stale'}, tapdances: {'3':'Default'} };
        await service.loadBindingNames(kb);
        expect(kb.cosmetic.macros).toEqual({'2':'Email'});
        expect(kb.cosmetic.tapdances).toEqual({'2':'Escape'});
        await service.saveName(kb, 'macro', 2, '');
        await service.loadBindingNames(kb);
        expect(kb.cosmetic.macros).toEqual({});
        expect(kb.cosmetic.tapdances).toEqual({'2':'Escape'});
    });
    it('rejects unsupported firmware and overlong UTF8 before issuing commands', async () => {
        const { service, kb, usb } = setup();
        await expect(service.saveName({...kb,svil_proto:1}, 'macro', 0, 'Name')).rejects.toThrow('firmware');
        await expect(service.saveName(kb, 'tapdance', 0, '😀'.repeat(5))).rejects.toThrow('16 UTF-8');
        expect(usb.sendSvil).not.toHaveBeenCalled();
    });
    it('propagates a refused label save', async () => {
        const {service,kb,usb} = setup();
        usb.sendSvil.mockResolvedValue(Uint8Array.of(SvilUSB.CMD_SVIL_LABEL_SET,1));
        await expect(service.saveName(kb,'macro',0,'Email')).rejects.toThrow('refused');
    });
});

describe('combo names on the board', () => {
    it('saves combo names as label type 3 and reloads them from the board, replacing Keybard\'s', async () => {
        const { service, kb, usb } = setup();
        Object.assign(kb, { feature_flags2: 0x80, combo_count: 8 });
        await service.saveName(kb, 'combo', 5, 'Dictation');
        expect(usb.sendSvil.mock.calls[0][1].slice(0, 3)).toEqual([3, 5, 0]);
        kb.cosmetic = { combos: { '1': 'Only in Keybard' } };
        await service.loadBindingNames(kb);
        expect(kb.cosmetic.combos).toEqual({ '5': 'Dictation' });
        await service.saveName(kb, 'combo', 5, '');
        await service.loadBindingNames(kb);
        expect(kb.cosmetic.combos).toEqual({});
    });
    it('leaves combo names alone, and refuses to save them, on firmware without the capability', async () => {
        const { service, kb, usb } = setup();
        kb.cosmetic = { combos: { '1': 'Kept in Keybard' } };
        await service.loadBindingNames(kb);
        expect(kb.cosmetic.combos).toEqual({ '1': 'Kept in Keybard' });
        expect(usb.sendSvil.mock.calls.some(([, args]) => args[0] === 3)).toBe(false);
        await expect(service.saveName(kb, 'combo', 0, 'Zoom')).rejects.toThrow('firmware');
    });
});
