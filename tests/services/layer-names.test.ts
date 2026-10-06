import { describe, it, expect, vi } from 'vitest';
import { LabelService } from '../../src/services/label.service';
import { SvilUSB } from '../../src/services/usb.service';
import { svalService } from '../../src/services/sval.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

function board() {
    const stored = new Map<number, number[]>();
    const usb = {
        svilProtocolVersion: 3,
        sendSvil: vi.fn(async (cmd: number, args: number[]) => {
            const index = args[1] | (args[2] << 8);
            if (cmd === SvilUSB.CMD_SVIL_LABEL_SET) {
                stored.set(index, args.slice(3));
                return new Uint8Array([cmd, 0]);
            }
            if (cmd === SvilUSB.CMD_SVIL_LABEL_CLEAR) {
                stored.delete(index);
                return new Uint8Array([cmd, 0]);
            }
            const next = [...stored.keys()].sort((a, b) => a - b).find(i => i >= index);
            return new Uint8Array(next === undefined ? [cmd, 0, 0] : [cmd, 0, 1, next & 255, next >> 8, ...stored.get(next)!]);
        }),
    };
    return { usb, service: new LabelService(usb as unknown as SvilUSB) };
}
const keyboard = (): KeyboardInfo => ({ rows: 1, cols: 1, layers: 16, svil_proto: 3 });

describe('layer names stored on the board', () => {
    it('restores several names into a fresh connection, including Unicode and layer 15', async () => {
        const { service } = board();
        for (const [index, name] of [[0, 'Work'], [4, 'Symbols'], [15, 'Møuse 🎹']] as const) {
            await service.saveLayerName(keyboard(), index, name);
        }
        const reconnected = keyboard();
        svalService.setupCosmeticLayerNames(reconnected);
        await service.loadLayerNames(reconnected);
        expect(reconnected.cosmetic?.layer).toMatchObject({ '0': 'Work', '4': 'Symbols', '15': 'Møuse 🎹' });
        expect(svalService.getLayerName(reconnected, 15)).toBe('Møuse 🎹');
        expect(svalService.getLayerNameNoLabel(reconnected, 0)).toBe('Work');
    });

    it('clears the stored name so it stays cleared after reconnect', async () => {
        const { service } = board();
        await service.saveLayerName(keyboard(), 2, 'Temporary');
        await service.saveLayerName(keyboard(), 2, '');
        const reconnected = keyboard();
        await service.loadLayerNames(reconnected);
        expect(reconnected.cosmetic?.layer?.['2']).toBeUndefined();
        expect(svalService.getLayerName(reconnected, 2)).toBe('Layer 2');
    });

    it('treats blank board labels as authoritative, including layers 4, 5 and 15', async () => {
        const { service } = board();
        await service.saveLayerName(keyboard(), 7, 'Tools');
        const reconnected = keyboard();
        // Simulate stale/default names already in the app when loading the board.
        reconnected.cosmetic = { layer: { '0': 'default', '4': 'NAS', '5': 'Fn Keys', '15': 'Mouse' }, layer_colors: { '4': 'red' } };
        await service.loadLayerNames(reconnected);
        expect(reconnected.cosmetic.layer).toEqual({ '7': 'Tools' });
        expect(reconnected.cosmetic.layer_colors).toEqual({ '4': 'red' });
        for (const index of [0, 4, 5, 15]) {
            expect(svalService.getLayerName(reconnected, index)).toBe(`Layer ${index}`);
            expect(svalService.getLayerNameNoLabel(reconnected, index)).toBe(`${index}`);
        }
        await service.saveLayerName(reconnected, 7, '');
        await service.loadLayerNames(reconnected);
        expect(reconnected.cosmetic.layer).toEqual({});
    });

    it('rejects names that would be truncated on hardware, before writing', async () => {
        const { service, usb } = board();
        await expect(service.saveLayerName(keyboard(), 0, '🎹'.repeat(5))).rejects.toThrow('16 UTF-8 bytes');
        expect(usb.sendSvil).not.toHaveBeenCalled();
        await service.saveLayerName(keyboard(), 0, 'abcdefghijklmnop');
    });

    it('reports firmware refusal and avoids unsupported commands on old firmware', async () => {
        const { service, usb } = board();
        const old = { ...keyboard(), svil_proto: 1 };
        await service.loadLayerNames(old);
        await expect(service.saveLayerName(old, 0, 'Work')).rejects.toThrow('cannot save');
        expect(usb.sendSvil).not.toHaveBeenCalled();
        usb.sendSvil.mockResolvedValueOnce(new Uint8Array([SvilUSB.CMD_SVIL_LABEL_SET, 1]));
        await expect(service.saveLayerName(keyboard(), 0, 'Work')).rejects.toThrow('refused');
    });
});
