// The simulated board's scan timing and auto mouse timeout, against
// svalboard/qmk feat/timing-us-only (sval_timing.c, svalboard.c).
import { describe, expect, it } from "vitest";
import { blankBoard } from "@/dev/fake-board/board";
import { FakeSvalFirmware } from "@/dev/fake-board/firmware";
import { FakeSvalboardDevice } from "@/dev/fake-board/device";
import { DEFINITION } from "@/dev/fake-board/definition";

const L = 32;
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function bootstrap(fw: FakeSvalFirmware): number {
    for (;;) {
        const req = new Uint8Array(L);
        req[0] = 0xdd;
        for (let i = 0; i < 20; i++) req[5 + i] = (i * 41 + 7) & 0xff;
        const id = le32(fw.receive(req)!, 25);
        if (id !== 0) return id;
    }
}

function via(fw: FakeSvalFirmware, id: number, payload: number[]): Uint8Array {
    const req = new Uint8Array(L);
    req[0] = 0xdd;
    req[1] = id & 0xff; req[2] = (id >>> 8) & 0xff; req[3] = (id >>> 16) & 0xff; req[4] = (id >>> 24) & 0xff;
    req[5] = 0xfe;
    req.set(payload, 6);
    return fw.receive(req)!.slice(6);
}

const get = (fw: FakeSvalFirmware, id: number, vid: number, two = false) => {
    const r = via(fw, id, [0x08, 0, vid]);
    return two ? r[3] | (r[4] << 8) : r[3];
};
const set = (fw: FakeSvalFirmware, id: number, vid: number, v: number) => via(fw, id, [0x07, 0, vid, v & 0xff, (v >> 8) & 0xff]);

function boardFrom(turbo: number, pre: number, post: number) {
    const state = blankBoard();
    state.custom[9 * 2] = turbo;
    state.custom[13 * 2] = pre & 0xff; state.custom[13 * 2 + 1] = pre >> 8;
    state.custom[14 * 2] = post & 0xff; state.custom[14 * 2 + 1] = post >> 8;
    state.custom[5 * 2] = 3;
    return state;
}

describe("scan timing in µs only", () => {
    it("fills a 0 wait in from the turbo table at boot, from each turbo index", () => {
        const table = [90, 60, 45, 30, 25, 20, 15];
        table.forEach((us, turbo) => {
            const fw = new FakeSvalFirmware(boardFrom(turbo, 0, 0));
            const id = bootstrap(fw);
            expect([get(fw, id, 13, true), get(fw, id, 14, true)]).toEqual([us, us]);
            expect(get(fw, id, 9)).toBe(turbo);
        });
    });

    it("keeps explicit waits, and mixes as the old firmware ran", () => {
        let fw = new FakeSvalFirmware(boardFrom(6, 45, 5));
        let id = bootstrap(fw);
        expect([get(fw, id, 13, true), get(fw, id, 14, true), get(fw, id, 9)]).toEqual([45, 5, 0xff]);
        fw = new FakeSvalFirmware(boardFrom(6, 200, 0));
        id = bootstrap(fw);
        expect([get(fw, id, 13, true), get(fw, id, 14, true)]).toEqual([200, 15]);
    });

    it("id_turbo_scan writes both waits; a 0 wait write stores 90", () => {
        const fw = new FakeSvalFirmware(boardFrom(0, 90, 90));
        const id = bootstrap(fw);
        set(fw, id, 9, 4);
        expect([get(fw, id, 13, true), get(fw, id, 14, true), get(fw, id, 9)]).toEqual([25, 25, 4]);
        set(fw, id, 9, 7);
        expect(get(fw, id, 13, true)).toBe(25);
        set(fw, id, 13, 0);
        expect(get(fw, id, 13, true)).toBe(90);
    });

    it("older firmware keeps the turbo setting and 0 waits", () => {
        const fw = new FakeSvalFirmware(boardFrom(6, 0, 0), { timingUsOnly: false });
        const id = bootstrap(fw);
        expect([get(fw, id, 13, true), get(fw, id, 14, true), get(fw, id, 9)]).toEqual([0, 0, 6]);
    });

    it("?fakeBoard=turbo6 starts as a board that ran turbo 6 and lands on 15 / 15", () => {
        const device = new FakeSvalboardDevice({ seedTurbo: 6, persist: false });
        const id = bootstrap(device.firmware);
        expect([get(device.firmware, id, 13, true), get(device.firmware, id, 14, true)]).toEqual([15, 15]);
    });
});

describe("auto mouse timeout in ms", () => {
    it("clamps to 100-2000 ms, rounds to 10 ms, and keeps the old choice nearest", () => {
        const fw = new FakeSvalFirmware(boardFrom(0, 90, 90));
        const id = bootstrap(fw);
        expect(get(fw, id, 49, true)).toBe(500);
        for (const [ms, want, choice] of [[50, 100, 0], [1234, 1230, 4], [2000, 2000, 4], [2500, 2000, 4], [360, 360, 2]]) {
            set(fw, id, 49, ms);
            expect([get(fw, id, 49, true), get(fw, id, 5)]).toEqual([want, choice]);
        }
    });

    it("no timeout keeps the ms value; the old choice sets it", () => {
        const fw = new FakeSvalFirmware(boardFrom(0, 90, 90));
        const id = bootstrap(fw);
        set(fw, id, 49, 1500);
        set(fw, id, 50, 1);
        expect([get(fw, id, 50), get(fw, id, 5), get(fw, id, 49, true)]).toEqual([1, 5, 1500]);
        set(fw, id, 50, 0);
        expect([get(fw, id, 50), get(fw, id, 49, true)]).toEqual([0, 1500]);
        set(fw, id, 5, 1);
        expect(get(fw, id, 49, true)).toBe(300);
    });

    it("the definition offers ms entry up to 2000 and no turbo preset", () => {
        const text = JSON.stringify(DEFINITION);
        expect(text).toContain('"id_automouse_timeout_ms",0,49');
        expect(text).toContain("[100,2000,10]");
        expect(text).toContain('"id_automouse_no_timeout",0,50');
        expect(text).not.toContain("id_turbo_scan");
    });
});
