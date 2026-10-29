// Flicker latch (Sval 0x3D) against the simulated board, and the tester's engine
// (src/lib/tester-engine.ts) that turns readings into what the frame loop draws.
import { describe, expect, it, vi } from "vitest";
import { blankBoard } from "@/dev/fake-board/board";
import { FakeSvalFirmware, FLAG3_FLICKER_LATCH } from "@/dev/fake-board/firmware";
import { CMD_SVIL_FLICKER_LATCH, hasFlickerLatch, parseFlickerCounts, parseFlickerRead, pressesFrom } from "@/services/flicker-latch";
import { TesterEngine } from "@/lib/tester-engine";

const L = 64;
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function bootstrap(fw: FakeSvalFirmware): number {
    for (;;) {
        const req = new Uint8Array(L);
        req[0] = 0xdd;
        for (let i = 0; i < 20; i++) req[5 + i] = (i * 31 + 7) & 0xff;
        const id = le32(fw.receive(req)!, 25);
        if (id !== 0) return id;
    }
}
function sval(fw: FakeSvalFirmware, id: number, payload: number[]): Uint8Array {
    const req = new Uint8Array(L);
    req[0] = 0xdd;
    req[1] = id & 0xff; req[2] = (id >>> 8) & 0xff; req[3] = (id >>> 16) & 0xff; req[4] = (id >>> 24) & 0xff;
    req[5] = 0xdf;
    req.set(payload, 6);
    return fw.receive(req)!.slice(6);
}

describe("FLICKER_LATCH on the simulated board", () => {
    it("is advertised in GET_INFO byte 20 bit 3, and needs 64-byte reports", () => {
        const fw = new FakeSvalFirmware(blankBoard());
        const id = bootstrap(fw);
        expect(sval(fw, id, [0x00])[19] & FLAG3_FLICKER_LATCH).toBe(FLAG3_FLICKER_LATCH);
        expect(hasFlickerLatch(0x0c, 64)).toBe(true);
        expect(hasFlickerLatch(0x0c, 32)).toBe(false);
        expect(hasFlickerLatch(0x04, 64)).toBe(false);
    });

    it("a one-scan bounce shows in the latch and the counts, and a read clears both", () => {
        const fw = new FakeSvalFirmware(blankBoard());
        const id = bootstrap(fw);
        fw.flicker(3, 4);
        const read = parseFlickerRead(sval(fw, id, [CMD_SVIL_FLICKER_LATCH, 0]))!;
        expect(read.halves).toBe(3);
        expect(read.raw[3]).toBe(0);
        expect(read.pressed[3]).toBe(1 << 4);
        expect(read.released[3]).toBe(1 << 4);
        expect(parseFlickerRead(sval(fw, id, [CMD_SVIL_FLICKER_LATCH, 0]))!.pressed[3]).toBe(0);
        const counts = parseFlickerCounts(sval(fw, id, [CMD_SVIL_FLICKER_LATCH, 1, 0]), 5, 6)!;
        expect(counts.changes[3 * 6 + 4]).toBe(2);
        expect(parseFlickerCounts(sval(fw, id, [CMD_SVIL_FLICKER_LATCH, 1, 0]), 5, 6)!.changes[3 * 6 + 4]).toBe(0);
    });

    it("presses from changes: odd changes are a press when the switch was up", () => {
        expect(pressesFrom(2, false)).toBe(1);
        expect(pressesFrom(3, false)).toBe(2);
        expect(pressesFrom(1, true)).toBe(0);
        expect(pressesFrom(3, true)).toBe(1);
    });
});

const later = () => new Promise((r) => setTimeout(r, 0));

describe("TesterEngine", () => {
    const source = { readLatch: null, readCounts: null, readMatrix: async () => [], mayRead: () => true };

    it("a latched press shows even when the switch is up again", () => {
        const e = new TesterEngine(10, 6, source);
        const v = e.version;
        e.applyLatch({ halves: 3, raw: new Uint8Array(10), pressed: Uint8Array.from([0, 0, 0, 1 << 4, 0, 0, 0, 0, 0, 0]), released: new Uint8Array(10) });
        expect(e.version).toBeGreaterThan(v);
        expect(e.current[3]).toBe(0);
        expect(e.latched[3]).toBe(1 << 4);
        expect(e.seen[3]).toBe(1 << 4);
    });

    it("nothing changed: the version stays, so the frame loop does nothing", () => {
        const e = new TesterEngine(10, 6, source);
        e.applyLatch({ halves: 3, raw: new Uint8Array(10), pressed: new Uint8Array(10), released: new Uint8Array(10) });
        const v = e.version;
        e.applyLatch({ halves: 3, raw: new Uint8Array(10), pressed: new Uint8Array(10), released: new Uint8Array(10) });
        expect(e.version).toBe(v);
    });

    it("a half that didn't answer keeps what it last showed", () => {
        const e = new TesterEngine(10, 6, source);
        e.applyLatch({ halves: 3, raw: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 1, 0, 0]), pressed: new Uint8Array(10), released: new Uint8Array(10) });
        e.applyLatch({ halves: 1, raw: new Uint8Array(10), pressed: new Uint8Array(10), released: new Uint8Array(10) });
        expect(e.current[7]).toBe(1);
    });

    it("counts presses per switch, and Reset counts clears them", () => {
        const e = new TesterEngine(10, 6, source);
        e.applyCounts({ half: 1, changes: Uint8Array.from({ length: 30 }, (_, i) => (i === 2 * 6 + 1 ? 6 : 0)) });
        expect(e.presses[(5 + 2) * 6 + 1]).toBe(3);
        const cv = e.countsVersion;
        e.resetCounts();
        expect(e.presses[(5 + 2) * 6 + 1]).toBe(0);
        expect(e.countsVersion).toBeGreaterThan(cv);
    });

    it("opening starts the counts at zero: the board's backlog is read once and thrown away; held keys still show", async () => {
        const fw = new FakeSvalFirmware(blankBoard());
        const id = bootstrap(fw);
        for (let i = 0; i < 40; i++) fw.flicker(3, 4); // collected while nobody read the latch
        fw.flicker(7, 1);
        fw.press(2, 2); // held now
        const e = new TesterEngine(10, 6, {
            // Each reply a task later, as on USB.
            readLatch: async () => { await later(); return parseFlickerRead(sval(fw, id, [CMD_SVIL_FLICKER_LATCH, 0])); },
            readCounts: async (half) => { await later(); return parseFlickerCounts(sval(fw, id, [CMD_SVIL_FLICKER_LATCH, 1, half]), 5, 6); },
            readMatrix: async () => [],
            mayRead: () => true,
        });
        e.presses[3 * 6 + 4] = 9; // left over from an earlier tester
        e.start();
        try {
            await vi.waitFor(() => expect(e.reads).toBeGreaterThan(3));
            await new Promise((r) => setTimeout(r, 150)); // past a counts read
            expect([...e.presses].every((n) => n === 0)).toBe(true);
            expect(e.current[2]).toBe(1 << 2);
            expect(e.seen[3]).toBe(0);
            expect(e.seen[7]).toBe(0);
            // A flicker after opening counts as usual.
            fw.flicker(3, 4);
            await vi.waitFor(() => expect(e.presses[3 * 6 + 4]).toBe(1), { timeout: 2000 });
        } finally {
            e.stop();
        }
    });
});
