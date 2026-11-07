import { describe, expect, it } from "vitest";
import { ballDiagLines, parseBallDiag } from "@/utils/ball-diag";

// reply[0] is the 0x2C echo; report byte i is reply[1 + i].
function reply(bytes: Record<number, number>): Uint8Array {
    const r = new Uint8Array(30);
    r[0] = 0x2c;
    r[1] = 0xa5;
    r[2] = 1;
    for (const [i, v] of Object.entries(bytes)) r[1 + Number(i)] = v;
    return r;
}

describe("trackball diagnostics", () => {
    it("rejects a reply from firmware without it", () => {
        expect(parseBallDiag(new Uint8Array([0x2c, 1, 0, 0]))).toBeNull();
    });

    it("reads the sub counters and the master's view", () => {
        const d = parseBallDiag(reply({ 2: 3, 3: 1, 4: 0x05, 5: 2, 6: 2, 7: 0x31, 8: 0xce, 9: 20, 11: 7, 13: 0xff, 14: 0xff, 15: 0x31, 16: 0xe2, 17: 14, 18: 0x22, 19: 2, 20: 9 }))!;
        expect(d.subValid && d.linkUp && !d.usbLeft).toBe(true);
        expect(d.subBoots).toBe(1);
        expect(d.subLinkHalfs).toBe(3);
        const text = ballDiagLines(d).join("\n");
        expect(text).toContain("Master (USB, right half): booted 1 time since");
        expect(text).toContain("Sub (left half): booted 1 time");
        expect(text).toContain("trackball started by the boot-time probe at 1.4 s");
        expect(text).toContain("one bad look (Inverse_Product_ID), then ok");
        expect(text).toContain("Last sub pointer movement the master received: never");
        expect(text).toContain("last reply 2.0 s ago");
    });

    it("says so when the sub has no counters", () => {
        const d = parseBallDiag(reply({ 2: 0 }))!;
        expect(ballDiagLines(d).join("\n")).toContain("no counters");
    });
});
