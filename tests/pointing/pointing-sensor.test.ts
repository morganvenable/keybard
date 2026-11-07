import { describe, expect, it, vi } from "vitest";
import { PointingSensorService, SENSOR_START_BACK_BINS } from "@/services/pointing-sensor.service";
import { parseSensorSamples, seqDiff, squalStats, type SensorBin, type SensorSamples } from "@/utils/pointing-sensor";

function reply(first: number, bins: number[][], head: number, flags = 0x01 | 0x02): Uint8Array {
    const r = new Uint8Array(26);
    r[0] = 0x39; r[1] = 1; r[2] = flags;
    r[3] = first & 0xff; r[4] = first >> 8; r[5] = bins.length;
    r[6] = head & 0xff; r[7] = head >> 8;
    bins.forEach((b, i) => r.set(b, 8 + i * 9));
    return r;
}

describe("parseSensorSamples", () => {
    it("reads flags, head and bins", () => {
        const r = parseSensorSamples(reply(0xfffe, [[20, 15, 25, 27, 95, 31, 0x94, 0x11, 0x85], [21, 1, 2, 3, 4, 5, 6, 0, 3]], 0x0001, 0x01 | 0x02 | 0x08 | 0x10))!;
        expect(r).toMatchObject({ present: true, is3389: true, more: true, right: true, head: 1, lost: false });
        expect(r.bins).toHaveLength(2);
        expect(r.bins[0]).toMatchObject({ seq: 0xfffe, squalMean: 20, squalMin: 15, squalMax: 25, rawSum: 27, rawMax: 95, rawMin: 31, shutter: 0x1194, moving: 5, lifted: true });
        expect(r.bins[1].seq).toBe(0xffff);
    });
    it("is null for no data, a wrong echo or a short reply", () => {
        const none = reply(0, [], 0); none[1] = 0;
        expect(parseSensorSamples(none)).toBeNull();
        const wrong = reply(0, [], 0); wrong[0] = 0x2d;
        expect(parseSensorSamples(wrong)).toBeNull();
        expect(parseSensorSamples(new Uint8Array(5))).toBeNull();
    });
    it("seqDiff wraps", () => {
        expect(seqDiff(2, 0xfffe)).toBe(4);
        expect(seqDiff(0xfffe, 2)).toBe(-4);
    });
});

const bin = (seq: number, mean: number, min = mean, max = mean): SensorBin => ({ seq, squalMean: mean, squalMin: min, squalMax: max, rawSum: 0, rawMax: 0, rawMin: 0, shutter: 0, moving: 0, lifted: false });

describe("squalStats", () => {
    it("averages, and takes extremes of single reads", () => {
        const s = squalStats([bin(1, 10, 8, 12), bin(2, 20, 15, 30)])!;
        expect(s).toMatchObject({ live: 20, avg: 15, min: 8, max: 30, bins: 2 });
    });
    it("limits the extremes after a reset", () => {
        const s = squalStats([bin(1, 10, 8, 12), bin(2, 20, 15, 30), bin(3, 18, 16, 19)], 3)!;
        expect(s).toMatchObject({ min: 16, max: 19, avg: 16 });
    });
    it("is null without bins", () => expect(squalStats([])).toBeNull());
});

describe("PointingSensorService", () => {
    it("starts near the head, keeps new bins once, and follows the cursor", async () => {
        vi.useFakeTimers();
        const head = 500;
        const cursors: number[] = [];
        const make = (seq: number): SensorBin => bin(seq, seq % 100);
        const deps = {
            read: async (hand: 0 | 1, cursor: number): Promise<SensorSamples | null> => {
                if (hand === 1) return null;
                cursors.push(cursor);
                const bins = cursor >= head - 1 ? [] : [make(cursor), make(cursor + 1)].filter((b) => b.seq < head);
                return { present: true, is3389: true, lost: false, more: cursor + 2 < head, right: false, head, bins };
            },
        };
        const svc = new PointingSensorService(deps);
        const stop = svc.start();
        await vi.advanceTimersByTimeAsync(150);
        stop();
        vi.useRealTimers();
        expect(cursors[0]).toBe(0xffff);
        expect(cursors[1]).toBe(head - SENSOR_START_BACK_BINS);
        const t = svc.trace(0);
        expect(t.bins.length).toBe(SENSOR_START_BACK_BINS);
        expect(t.bins[0].seq).toBe(head - SENSOR_START_BACK_BINS);
        expect(new Set(t.bins.map((b) => b.seq)).size).toBe(t.bins.length);
        expect(t.is3389).toBe(true);
        expect(svc.trace(1).seen).toBe(false);
        svc.resetExtremes();
        expect(svc.trace(0).resetSeq).toBe(head - 1);
    });
});
