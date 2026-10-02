import { describe, it, expect, vi } from 'vitest';
import type { SvilUSB } from '../../src/services/usb.service';
import {
    ScanLabService,
    SCANLAB_CHANNEL,
    SweepState,
    lowestCleanValue,
    suggestWithMargin,
} from '../../src/services/scanlab.service';

/** USB stand-in: answers GETs from a table keyed by "channel:valueId", records SETs and SAVEs. */
function makeService(responses: Record<string, number[] | (() => number[])> = {}) {
    const usb = {
        customValueGet: vi.fn(async (channel: number, valueId: number, size: number) => {
            const r = responses[`${channel}:${valueId}`];
            const bytes = typeof r === 'function' ? r() : r ?? [];
            const out = new Uint8Array(size);
            out.set(bytes.slice(0, size));
            return out;
        }),
        customValueSet: vi.fn(async () => undefined),
        customValueSave: vi.fn(async () => undefined),
    };
    return { usb, service: new ScanLabService(usb as unknown as SvilUSB) };
}

const statusBytes = (over: Partial<{ rev: number; state: number; done: number; target: number; pre: number; post: number; isLeft: number; fmask: number; tmask: number; savedPre: number; savedPost: number; other: number }> = {}) => {
    const o = { rev: 1, state: 0, done: 0, target: 0, pre: 200, post: 200, isLeft: 1, fmask: 0b000100, tmask: 0, savedPre: 200, savedPost: 200, other: 1, ...over };
    const b = new Array(23).fill(0);
    b[0] = 1; b[1] = o.rev; b[2] = o.state;
    b[3] = o.done & 0xff; b[4] = o.done >> 8; b[5] = o.target & 0xff; b[6] = o.target >> 8;
    b[7] = 1; b[8] = o.pre & 0xff; b[9] = o.pre >> 8; b[10] = o.post & 0xff; b[11] = o.post >> 8;
    b[12] = o.isLeft; b[13] = o.fmask; b[14] = o.tmask; b[15] = 1; b[16] = 2;
    b[17] = o.savedPre & 0xff; b[18] = o.savedPre >> 8; b[19] = o.savedPost & 0xff; b[20] = o.savedPost >> 8;
    b[21] = 3; b[22] = o.other;
    return b;
};

describe('ScanLabService', () => {
    it('reads status for a hand with the hand encoded in the value id', async () => {
        const { usb, service } = makeService({ [`${SCANLAB_CHANNEL}:${0x10 | (1 << 3)}`]: statusBytes({ isLeft: 0, pre: 45, post: 60 }) });
        const st = await service.getStatus(1);
        expect(usb.customValueGet).toHaveBeenCalledWith(SCANLAB_CHANNEL, 0x18, 23);
        expect(st.reachable).toBe(true);
        expect(st.hwRevision).toBe(1);
        expect(st.effPrewaitUs).toBe(45);
        expect(st.effPostwaitUs).toBe(60);
        expect(st.isLeft).toBe(false);
        expect(st.otherHalfConnected).toBe(true);
    });

    it('reports an unreachable half when the firmware answers 0xFF', async () => {
        const { service } = makeService({ [`${SCANLAB_CHANNEL}:${0x10}`]: [0xff] });
        const st = await service.getStatus(0);
        expect(st.reachable).toBe(false);
    });

    it('probes a row: sets PROBE, reads both phases, derives polarity', async () => {
        // Row 1, left hand. Idle: all high (0b111111). Lit: column C (bit 2) went low.
        const on = new Array(23).fill(0);
        on[4] = 42; on[5] = 0;          // settle for col 2 = 42 us
        on[12 + 2] = 1;                 // one level change on col 2
        on[18] = 0b111111; on[19] = 0b111011; on[20] = 1;
        const off = new Array(23).fill(0);
        off[4] = 130;                   // recovery for col 2 = 130 us
        off[12 + 2] = 1; off[18] = 0b111111; off[19] = 0b111011; off[20] = 1;
        const { usb, service } = makeService({
            [`${SCANLAB_CHANNEL}:${0x10}`]: statusBytes({ fmask: 0b000100 }),
            [`${SCANLAB_CHANNEL}:${0x40 | 1}`]: on,
            [`${SCANLAB_CHANNEL}:${0x60 | 1}`]: off,
        });
        const row = await service.probeRow(0, 1);
        expect(usb.customValueSet).toHaveBeenCalledWith(SCANLAB_CHANNEL, 0x02, [0, 1]);
        expect(row.valid).toBe(true);
        const c = row.columns[2];
        expect(c.settleUs).toBe(42);
        expect(c.recoverUs).toBe(130);
        expect(c.activeDark).toBe(true);
        expect(c.expectedActiveDark).toBe(true);
        expect(row.columns[0].activeDark).toBe(false);
        expect(row.columns[0].expectedActiveDark).toBe(false);
    });

    it('runs a sweep step: little-endian args, polls to Done, sums mismatches', async () => {
        let polls = 0;
        const rowBytes = (m: number[]) => {
            const b = new Array(23).fill(0);
            m.forEach((v, c) => { b[2 * c] = v & 0xff; b[2 * c + 1] = v >> 8; });
            b[14] = SweepState.Done; b[15] = 1;
            return b;
        };
        const responses: Record<string, number[] | (() => number[])> = {
            [`${SCANLAB_CHANNEL}:${0x10}`]: () => statusBytes({ state: ++polls < 3 ? SweepState.Running : SweepState.Done, done: 200, target: 200 }),
        };
        for (let r = 0; r < 5; r++) responses[`${SCANLAB_CHANNEL}:${0x20 | r}`] = rowBytes(r === 2 ? [0, 0, 7, 0, 0, 0] : [0, 0, 0, 0, 0, 0]);
        const { usb, service } = makeService(responses);
        const step = await service.runSweepStep(0, 300, 200, 200);
        expect(usb.customValueSet).toHaveBeenCalledWith(SCANLAB_CHANNEL, 0x01, [0, 1, 44, 1, 200, 0, 200, 0]);
        expect(step.state).toBe(SweepState.Done);
        expect(step.totalMismatches).toBe(7);
        expect(step.rows[2].mismatches[2]).toBe(7);
        expect(polls).toBeGreaterThanOrEqual(3);
    });

    it('applies timing to the keyboard channel as two u16 values and saves', async () => {
        const { usb, service } = makeService();
        await service.applyTiming(300, 75);
        expect(usb.customValueSet).toHaveBeenNthCalledWith(1, 0, 13, [44, 1]);
        expect(usb.customValueSet).toHaveBeenNthCalledWith(2, 0, 14, [75, 0]);
        expect(usb.customValueSave).toHaveBeenCalledWith(0);
    });
});

describe('sweep analysis', () => {
    it('finds the tightest value that stayed clean from the generous end', () => {
        const steps = [
            { value: 100, totalMismatches: 0 },
            { value: 80, totalMismatches: 0 },
            { value: 60, totalMismatches: 0 },
            { value: 40, totalMismatches: 3 },
            { value: 20, totalMismatches: 0 }, // a lucky clean step below the knee does not count
        ];
        expect(lowestCleanValue(steps)).toBe(60);
        expect(suggestWithMargin(60)).toBe(90);
        expect(suggestWithMargin(42)).toBe(65);
    });

    it('returns null when nothing is clean', () => {
        expect(lowestCleanValue([{ value: 50, totalMismatches: 1 }])).toBeNull();
        expect(suggestWithMargin(null)).toBeNull();
    });
});
