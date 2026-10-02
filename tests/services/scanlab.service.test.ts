import { describe, it, expect, vi } from 'vitest';
import type { SvilUSB } from '../../src/services/usb.service';
import {
    ScanLabService,
    SCANLAB_CHANNEL,
    SweepState,
    lowestCleanValue,
    suggestWithMargin,
    expectedDutyPct,
    predictDutyPct,
    predictCurrentMa,
    DEFAULT_BASELINE_MA,
    DEFAULT_LIT_ROW_MA,
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

describe('ScanLabService power readout and pacing', () => {
    const powerBytes = () => {
        const b = new Array(23).fill(0);
        const put = (i: number, v: number) => { b[i] = v & 0xff; b[i + 1] = v >> 8; };
        put(0, 1000); put(2, 100); put(4, 2000);    // saved period, light idle period ms, light idle after ms
        put(6, 1002); put(8, 240);                  // measured frame, LED-on
        b[10] = 1; put(11, 1000); put(13, 45); put(15, 5); b[17] = 5;
        put(18, 600); put(20, 1000); b[22] = 0b01101;  // deep after s, deep period ms, host bootloader + pointer rest + RGB dim
        return b;
    };

    it('parses measured frame and LED-on times into duty and scan rate', async () => {
        const { usb, service } = makeService({ [`${SCANLAB_CHANNEL}:${0x11}`]: powerBytes() });
        const p = await service.getPower(0);
        expect(usb.customValueGet).toHaveBeenCalledWith(SCANLAB_CHANNEL, 0x11, 23);
        expect(p.reachable).toBe(true);
        expect(p.periodUs).toBe(1000);
        expect(p.idlePeriodMs).toBe(100);
        expect(p.idleAfterMs).toBe(2000);
        expect(p.deepAfterS).toBe(600);
        expect(p.deepPeriodMs).toBe(1000);
        expect(p.stage).toBe(1);
        expect(p.idleActive).toBe(true);
        expect(p.hostBootloader).toBe(true);
        expect(p.rebootArmed).toBe(false);
        expect(p.idle).toEqual({ pointerRest: true, rgbDim: true, cpuSleep: false });
        expect(p.measuredLedUs).toBe(240);
        expect(p.dutyPct).toBeCloseTo(23.95, 1);
        expect(p.scanHz).toBeCloseTo(998, 0);
        expect(p.effPrewaitUs).toBe(45);
        expect(p.rows).toBe(5);
    });

    it('applies pacing and both idle stages as five u16 keyboard-channel values and saves', async () => {
        const { usb, service } = makeService();
        await service.applyPacing(1000, { idlePeriodMs: 100, idleAfterMs: 2000, deepAfterS: 600, deepPeriodMs: 1000 });
        expect(usb.customValueSet).toHaveBeenNthCalledWith(1, 0, 20, [232, 3]);
        expect(usb.customValueSet).toHaveBeenNthCalledWith(2, 0, 21, [100, 0]);
        expect(usb.customValueSet).toHaveBeenNthCalledWith(3, 0, 22, [208, 7]);
        expect(usb.customValueSet).toHaveBeenNthCalledWith(4, 0, 23, [88, 2]);
        expect(usb.customValueSet).toHaveBeenNthCalledWith(5, 0, 24, [232, 3]);
        expect(usb.customValueSave).toHaveBeenCalledWith(0);
    });

    it('undoes the 16-bit wire cap on long idle periods using the stage and settings', () => {
        const { service } = makeService();
        const b = powerBytes();
        const put = (i: number, v: number) => { b[i] = v & 0xff; b[i + 1] = v >> 8; };
        put(6, 65535); put(11, 65535); b[10] = 2; put(20, 1000); // frame and eff period saturated, deep idle, deep period 1000 ms
        const p = service.parsePower(b);
        expect(p.frameCapped).toBe(true);
        expect(p.effectivePeriodTrueUs).toBe(1_000_000);
        expect(p.scanHz).toBeCloseTo(1, 3);
        expect(p.dutyPct).toBeCloseTo(0.024, 3);
        // light idle, 100 ms: the frame reading does not saturate, so it stays the measurement
        put(6, 60000); put(11, 60000); b[10] = 1; put(2, 100);
        const q = service.parsePower(b);
        expect(q.frameCapped).toBe(false);
        expect(q.effectivePeriodTrueUs).toBe(60000);
    });

    it('switches an idle power feature through its VIA id and saves', async () => {
        const { usb, service } = makeService();
        await service.setIdleFeature('cpuSleep', true);
        expect(usb.customValueSet).toHaveBeenCalledWith(0, 27, [1]);
        expect(usb.customValueSave).toHaveBeenCalledWith(0);
        await service.setIdleFeature('pointerRest', false);
        expect(usb.customValueSet).toHaveBeenCalledWith(0, 25, [0]);
    });

    it('reboots a half into the bootloader with the two-stage arm/go handshake', async () => {
        const { usb, service } = makeService();
        const sent: number[][] = [];
        (usb as unknown as { send: unknown }).send = vi.fn(async (_cmd: number, args: number[]) => {
            sent.push(args);
            const op = args[1];
            const r = new Uint8Array(23);
            if (op === 0x04) { r[0] = 0x34; r[1] = 0x12; r[2] = 1; }       // token 0x1234, supported
            if (op === 0x05) { r[0] = args[3] === 0x34 && args[4] === 0x12 ? 1 : 0; r[2] = 1; }
            return r;
        });
        await expect(service.rebootToBootloader(1)).resolves.toBe(true);
        expect(sent[0]).toEqual([SCANLAB_CHANNEL, 0x04, 1]);
        expect(sent[1]).toEqual([SCANLAB_CHANNEL, 0x05, 1, 0x34, 0x12]);
    });

    it('refuses to reboot when the firmware was built without host bootloader support', async () => {
        const { usb, service } = makeService();
        (usb as unknown as { send: unknown }).send = vi.fn(async () => new Uint8Array(23)); // [2] = 0: unsupported
        await expect(service.rebootToBootloader(0)).rejects.toThrow(/SVAL_HOST_BOOTLOADER/);
    });

    it('predicts duty from rows, pre-wait and period when nothing is measured', () => {
        expect(expectedDutyPct(5, 45, 1000)).toBeCloseTo(29, 0);
        expect(expectedDutyPct(5, 100, 1000)).toBeCloseTo(56.5, 1);
        expect(expectedDutyPct(5, 45, 8000)).toBeCloseTo(3.6, 1);
        expect(expectedDutyPct(5, 45, 0)).toBeNull();
        expect(expectedDutyPct(5, 500, 1000)).toBe(100);
    });

    it('prefers the measured LED-on time per frame for predictions', () => {
        const p = { rows: 5, effPrewaitUs: 45, measuredLedUs: 290 };
        expect(predictDutyPct(p, 1000)).toBeCloseTo(29, 0);
        expect(predictDutyPct(p, 2000)).toBeCloseTo(14.5, 1);
        expect(predictDutyPct(p, 0)).toBeNull();
        expect(predictDutyPct({ ...p, measuredLedUs: 0 }, 1000)).toBeCloseTo(29, 0); // falls back to the model
    });
});

describe('current model', () => {
    it('reproduces the measured points on the reference board', () => {
        const ma = (duty: number) => predictCurrentMa(DEFAULT_BASELINE_MA, DEFAULT_LIT_ROW_MA, duty)!;
        expect(ma(0.5)).toBeCloseTo(60.6, 0);   // measured 60
        expect(ma(15)).toBeCloseTo(76.5, 0);    // measured 80
        expect(ma(29)).toBeCloseTo(91.9, 0);    // measured 90
        expect(ma(58.5)).toBeCloseTo(124.4, 0); // measured 125
        expect(predictCurrentMa(60, 110, null)).toBeNull();
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
