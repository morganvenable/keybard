import { describe, expect, it } from "vitest";
import { clickDiagLines, eventText, readClickDiag, type Query } from "@/utils/click-diag";

// A fake board: one half (the USB, right half) with a two-finger tap, a right-button
// report and a host layer change; the other half doesn't answer.
function board(): Query {
    const ev = [
        { t: 1000, type: 6, p: [0x82, 0, 40, 20, 50, 12, 0] },
        { t: 1010, type: 5, p: [0, 1, 2, 40, 20, 60, 22] },
        { t: 1011, type: 7, p: [1, 2, 0, 80, 0, 0, 0] },
        { t: 1012, type: 8, p: [2, 0, 1, 0, 80, 0, 0] },
        { t: 1500, type: 10, p: [0, 0, 2, 0, 3, 0, 0] },
    ];
    const frames = [{ t: 990, type: 2, p: [0, 40, 20, 50, 60, 22, 30] }];
    return async (a) => {
        const r = new Uint8Array(31);
        r[0] = 0x2c; r[1] = 0xc1; r[2] = a[1]; r[3] = a[2];
        if (a[1] === 1) { r[4] = 0xff; return r; }
        if (a[2] === 0) {
            r[4] = 1;
            r[5] = ev.length; r[9] = 2000 & 0xff; r[10] = 2000 >> 8;
            r[15] = 1; r[27] = 3; r[29] = frames.length;
            return r;
        }
        const list = a[3] === 2 ? frames : ev;
        const seq = a[4] | (a[5] << 8);
        let n = 0;
        for (; n < 2 && seq - n >= 1; n++) {
            const e = list[seq - n - 1];
            const o = 5 + 12 * n;
            r[o] = e.t & 0xff; r[o + 1] = e.t >> 8; r[o + 4] = e.type;
            e.p.forEach((b, i) => (r[o + 5 + i] = b));
        }
        r[4] = n;
        return r;
    };
}

describe("click diagnostics", () => {
    it("reads the ring and shows the right click with the frames before it", async () => {
        const { halves, supported } = await readClickDiag(board());
        expect(supported).toBe(true);
        expect(halves).toHaveLength(1);
        expect(halves[0].events).toHaveLength(5);
        const lines = clickDiagLines(halves);
        expect(lines[0]).toMatch(/^Pad health, right half \(USB\): touchpad start attempts 1/);
        expect(lines[1]).toMatch(/Layer change: base -> 1; cause Keybard\/host/);
        expect(lines.some((l) => /TWO-FINGER TAP \(right click\)/.test(l))).toBe(true);
        expect(lines.some((l) => /MOUSE REPORT SENT: buttons right/.test(l))).toBe(true);
        expect(lines.some((l) => /pad frame .*2 finger\(s\)/.test(l))).toBe(true);
        expect(lines.some((l) => /WHILE TYPING/.test(l))).toBe(true);
    });

    it("says when the firmware doesn't know the request", async () => {
        const q: Query = async () => new Uint8Array(31);
        expect((await readClickDiag(q)).supported).toBe(false);
    });

    it("names Ctrl on a left click (a Mac's Control-click is a right click)", () => {
        expect(eventText({ seq: 1, t: 0, type: 8, p: [1, 0, 1, 0, 5, 0, 0] })).toMatch(/buttons left .*mods LCtrl/);
    });

    it("shows a touchpad report the firmware ignored, with its raw bytes", () => {
        const t = eventText({ seq: 1, t: 0, type: 14, p: [1, 0, 0, 3, 0, 0, 0] });
        expect(t).toMatch(/IGNORED \(not a real frame\): TWO-FINGER TAP \(right click\), scroll; 0 finger\(s\); raw cycle 0 ge0 00 ge1 03/);
        expect(eventText({ seq: 1, t: 0, type: 14, p: [0x85, 10, 0, 1, 3, 0, 0] })).toMatch(/chip was asleep, chip just woke/);
    });
});
