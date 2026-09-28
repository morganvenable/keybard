import { describe, it, expect, vi } from 'vitest';
import { CustomValueService } from '../../src/services/custom-value.service';
import type { ViableUSB } from '../../src/services/usb.service';
import { SVALBOARD_POINTING_MENU } from '../fixtures/pointing-menu.fixture';

const LEFT_KEY = 'id_left_automouse';
const RIGHT_KEY = 'id_right_automouse';

/** Minimal USB stand-in: answers GETs from a `channel:id -> bytes` table, records SETs/SAVEs. */
function makeService(deviceValues: Record<string, number[]> = {}) {
    const usb = {
        customValueGet: vi.fn(async (channel: number, valueId: number, width: number) =>
            new Uint8Array(deviceValues[`${channel}:${valueId}`] ?? new Array(width).fill(0))),
        customValueSet: vi.fn(async () => undefined),
        customValueSave: vi.fn(async () => undefined),
    };
    return { usb, service: new CustomValueService(usb as unknown as ViableUSB) };
}

describe('CustomValueService: svalboard per-pointer auto mouse values', () => {
    it('discovers both toggles nested under the showIf group as channel 0 / ids 11 and 12, one byte wide', () => {
        const { service } = makeService();
        const refs = service.extractAllItemsWithRefs(SVALBOARD_POINTING_MENU);
        const left = refs.find((r) => r.ref.key === LEFT_KEY);
        const right = refs.find((r) => r.ref.key === RIGHT_KEY);
        expect(left?.ref).toMatchObject({ channel: 0, valueId: 11 });
        expect(right?.ref).toMatchObject({ channel: 0, valueId: 12 });
        expect(service.getByteWidth(left!.item)).toBe(1);
        expect(service.getByteWidth(right!.item)).toBe(1);
    });

    it('bulk-loads both from the device at connect time and caches the integer values', async () => {
        const { service, usb } = makeService({ '0:11': [1], '0:12': [0] });
        const entries = await service.loadAllMenuValues(SVALBOARD_POINTING_MENU);
        expect(usb.customValueGet).toHaveBeenCalledWith(0, 11, 1);
        expect(usb.customValueGet).toHaveBeenCalledWith(0, 12, 1);
        expect(entries.find((e) => e.key === LEFT_KEY)).toEqual({ key: LEFT_KEY, channel: 0, valueId: 11, data: [1] });
        expect(entries.find((e) => e.key === RIGHT_KEY)).toEqual({ key: RIGHT_KEY, channel: 0, valueId: 12, data: [0] });
        expect(service.getCached(LEFT_KEY)).toBe(1);
        expect(service.getCached(RIGHT_KEY)).toBe(0);
    });

    it('setValue writes a single byte to the matching id and updates the cache', async () => {
        const { service, usb } = makeService();
        await service.setValue(RIGHT_KEY, 0, SVALBOARD_POINTING_MENU);
        expect(usb.customValueSet).toHaveBeenCalledWith(0, 12, [0]);
        expect(service.getCached(RIGHT_KEY)).toBe(0);
        expect(usb.customValueSet).not.toHaveBeenCalledWith(0, 11, expect.anything());
    });
});
