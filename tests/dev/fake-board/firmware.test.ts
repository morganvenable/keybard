// The simulated Svalboard's replies, byte for byte against the firmware source
// (svalboard/qmk modules/svalboard/core/sval.c, client_wrapper.c, quantum/via.c).
import { describe, expect, it } from "vitest";
import { blankBoard, LABEL_SIZE, MACRO_BUFFER_SIZE, MACRO_BUFFER_SIZE_NO_COMBO_LABELS } from "@/dev/fake-board/board";
import { FakeSvalFirmware, KEYBOARD_UID, validLabel } from "@/dev/fake-board/firmware";
import { DEFINITION, DEFINITION_BYTES } from "@/dev/fake-board/definition";

const L = 32;
const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const LE16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

function firmware(options: { comboLabels?: boolean; now?: () => number } = {}) {
    return new FakeSvalFirmware(blankBoard(), options);
}

/** Bootstrap a client ID (asking again for the ID 0 the firmware can hand out). */
function bootstrap(fw: FakeSvalFirmware): number {
    for (;;) {
        const req = new Uint8Array(L);
        req[0] = 0xdd;
        for (let i = 0; i < 20; i++) req[5 + i] = (i * 37 + 11) & 0xff;
        const reply = fw.receive(req)!;
        expect(Array.from(reply.slice(0, 25))).toEqual(Array.from(req.slice(0, 25))); // nonce echoed
        expect(reply[29] | (reply[30] << 8)).toBe(120); // TTL
        const id = le32(reply, 25);
        if (id !== 0) return id;
    }
}

function wrapped(id: number, protocol: number, payload: number[]): Uint8Array {
    const req = new Uint8Array(L);
    req[0] = 0xdd;
    req[1] = id & 0xff; req[2] = (id >>> 8) & 0xff; req[3] = (id >>> 16) & 0xff; req[4] = (id >>> 24) & 0xff;
    req[5] = protocol;
    req.set(payload.slice(0, L - 6), 6);
    return req;
}

/** A Sval command's reply as Keybard's sendSvil returns it: the wrapper stripped, the command echo first. */
function sval(fw: FakeSvalFirmware, id: number, cmd: number, args: number[] = []): Uint8Array {
    const reply = fw.receive(wrapped(id, 0xdf, [cmd, ...args]))!;
    expect(reply[0]).toBe(0xdd);
    expect(le32(reply, 1)).toBe(id);
    expect(reply[5]).toBe(0xdf);
    return reply.slice(6);
}

function via(fw: FakeSvalFirmware, id: number, payload: number[]): Uint8Array {
    const reply = fw.receive(wrapped(id, 0xfe, payload))!;
    expect(reply[5]).toBe(0xfe);
    return reply.slice(6);
}

function label(text: string): number[] {
    const bytes = Array.from(new TextEncoder().encode(text));
    while (bytes.length < LABEL_SIZE) bytes.push(0);
    return bytes;
}

describe("client-ID wrapper", () => {
    it("rejects an unknown ID with an error frame", () => {
        const fw = firmware();
        const reply = fw.receive(wrapped(0x12345678, 0xdf, [0x00]))!;
        // The ID's time part (0x1234 * 65.536 s) is in the future: age wraps past the TTL
        expect(Array.from(reply.slice(0, 7))).toEqual([0xdd, 0x78, 0x56, 0x34, 0x12, 0xff, 0x01]);
        expect(reply.slice(7).every((b) => b === 0)).toBe(true);
    });

    it("lets an ID expire after the TTL, in 65.536 s steps of the board's timer", () => {
        let t = 0;
        const fw = firmware({ now: () => t });
        const id = bootstrap(fw);
        t = 2 * 65536 - 1; // age 65536 ms: still valid
        expect(sval(fw, id, 0x00)[0]).toBe(0x00);
        t = 2 * 65536; // age 131072 ms >= 120000
        const reply = fw.receive(wrapped(id, 0xdf, [0x00]))!;
        expect(reply[5]).toBe(0xff);
        expect(reply[6]).toBe(0x01);
    });

    it("answers an unknown protocol byte with error 3", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        const reply = fw.receive(wrapped(id, 0x42, [0x00]))!;
        expect([reply[5], reply[6]]).toEqual([0xff, 0x03]);
    });

    it("ignores unwrapped Sval and answers unwrapped VIA", () => {
        const fw = firmware();
        const req = new Uint8Array(L);
        req[0] = 0xdf;
        expect(fw.receive(req)).toBeNull();
        req[0] = 0x01;
        expect(Array.from(fw.receive(req)!.slice(0, 3))).toEqual([0x01, 0x00, 0x0d]);
    });
});

describe("GET_INFO", () => {
    it("reports protocol 3, the Svalboard UID, keycodes 0.0.9 and combo labels", () => {
        const fw = firmware();
        const info = sval(fw, bootstrap(fw), 0x00);
        expect(info[0]).toBe(0x00);
        expect(le32(info, 1)).toBe(3);
        expect(Array.from(info.slice(5, 13))).toEqual(KEYBOARD_UID);
        expect(info[13] & 0x08).toBe(0x08); // leader
        expect(info[13] & 0x40).toBe(0x40); // default layer state
        expect(Array.from(info.slice(14, 17))).toEqual([0, 0, 9]);
        expect(info[17]).toBe(0); // storage flags
        expect(info[18]).toBe(0x8f); // flags2: default layer set, pointing hw, modifiers, motion, combo labels
    });

    it("clears flags2 bit 7 on firmware without combo names", () => {
        const fw = firmware({ comboLabels: false });
        const info = sval(fw, bootstrap(fw), 0x00);
        expect(info[18] & 0x80).toBe(0);
        expect(info[18]).toBe(0x0f);
    });

    it("reports and clears the storage-reset flag", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        fw.state.storageFlags = 1;
        expect(sval(fw, id, 0x00)[17]).toBe(1);
        sval(fw, id, 0x2a);
        expect(sval(fw, id, 0x00)[17]).toBe(0);
    });
});

describe("combos", () => {
    const entry = [...LE16(0x0009), ...LE16(0x0007), 0, 0, 0, 0, ...LE16(0x0029), ...LE16(0x8000 | 40)];

    it("round-trips a combo through SET and GET", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        const set = sval(fw, id, 0x04, [...LE16(5), ...entry]);
        expect([set[0], set[1]]).toEqual([0x04, 0x00]);
        const get = sval(fw, id, 0x03, LE16(5));
        expect(get[0]).toBe(0x03);
        expect([get[1], get[2]]).toEqual(LE16(5));
        expect(Array.from(get.slice(3, 15))).toEqual(entry);
    });

    it("finds it with TABLE_SCAN and ends the scan after it", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        sval(fw, id, 0x04, [...LE16(200), ...entry]);
        const first = sval(fw, id, 0x21, [1, ...LE16(0)]);
        expect([first[0], first[1], first[2]]).toEqual([0x21, 1, 1]);
        expect(first[3] | (first[4] << 8)).toBe(200);
        expect(Array.from(first.slice(5, 17))).toEqual(entry);
        const next = sval(fw, id, 0x21, [1, ...LE16(201)]);
        expect(next[2]).toBe(0); // found = 0
        expect(next[3] | (next[4] << 8)).toBe(256); // the scan stopped at the table's end
    });

    it("refuses an index past the table with status 1", () => {
        const fw = firmware();
        const resp = sval(fw, bootstrap(fw), 0x04, [...LE16(256), ...entry]);
        expect(resp[1]).toBe(1);
    });

    it("reads an unused slot and a slot past the table as zeros", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        expect(sval(fw, id, 0x03, LE16(9)).slice(3, 15).every((b) => b === 0)).toBe(true);
        expect(sval(fw, id, 0x03, LE16(300)).slice(3, 15).every((b) => b === 0)).toBe(true);
    });
});

describe("tap dances", () => {
    it("start with the default term but count as unused until a key is set", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        const get = sval(fw, id, 0x01, LE16(0));
        expect(get[11] | (get[12] << 8)).toBe(200);
        expect(sval(fw, id, 0x21, [0, ...LE16(0)])[2]).toBe(0);
    });
});

describe("labels", () => {
    for (const [type, name] of [[0, "layer"], [1, "tap dance"], [2, "macro"], [3, "combo"]] as const) {
        it(`sets, gets and clears a ${name} label (type ${type})`, () => {
            const fw = firmware();
            const id = bootstrap(fw);
            const set = sval(fw, id, 0x1c, [type, ...LE16(3), ...label("Größe ✓")]);
            expect([set[0], set[1]]).toEqual([0x1c, 0]);
            const get = sval(fw, id, 0x1b, [type, ...LE16(0)]);
            // [cmd][type][found][index:2][label:16]
            expect([get[0], get[1], get[2], get[3], get[4]]).toEqual([0x1b, type, 1, 3, 0]);
            expect(new TextDecoder().decode(get.slice(5, 21)).replace(/\0+$/, "")).toBe("Größe ✓");
            const after = sval(fw, id, 0x1b, [type, ...LE16(4)]);
            expect(after[2]).toBe(0);
            const clear = sval(fw, id, 0x1d, [type, ...LE16(3)]);
            expect([clear[0], clear[1]]).toEqual([0x1d, 0]);
            expect(sval(fw, id, 0x1b, [type, ...LE16(0)])[2]).toBe(0);
        });
    }

    it("refuses an index out of range with status 2 and bad UTF-8 with status 3", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        expect(sval(fw, id, 0x1c, [0, ...LE16(16), ...label("x")])[1]).toBe(2); // 16 layers
        expect(sval(fw, id, 0x1c, [3, ...LE16(256), ...label("x")])[1]).toBe(2); // 256 combos
        const bad = label("ab");
        bad[1] = 0x0a; // a control character
        expect(sval(fw, id, 0x1c, [1, ...LE16(0), ...bad])[1]).toBe(3);
        expect(sval(fw, id, 0x1d, [2, ...LE16(256)])[1]).toBe(2);
    });

    it("treats combo labels as an invalid type on firmware without them", () => {
        const fw = firmware({ comboLabels: false });
        const id = bootstrap(fw);
        // GET of an unknown type: the command byte comes back as sval_cmd_error
        expect(sval(fw, id, 0x1b, [3, ...LE16(0)])[0]).toBe(0xff);
        expect(sval(fw, id, 0x1c, [3, ...LE16(0), ...label("Esc")])[1]).toBe(1);
        expect(sval(fw, id, 0x1d, [3, ...LE16(0)])[1]).toBe(1);
        // the other types still work
        expect(sval(fw, id, 0x1c, [2, ...LE16(0), ...label("Hi")])[1]).toBe(0);
    });

    it("validates UTF-8 the way the firmware does", () => {
        const enc = (s: string) => Uint8Array.from(label(s));
        expect(validLabel(enc("Tab\tstop"))).toBe(true);
        expect(validLabel(Uint8Array.from([0x41, 0, 0x42, ...new Array(13).fill(0)]))).toBe(false); // text after a NUL
        expect(validLabel(Uint8Array.from([0xc0, 0x80, ...new Array(14).fill(0)]))).toBe(false); // overlong
        expect(validLabel(Uint8Array.from([0xed, 0xa0, 0x80, ...new Array(13).fill(0)]))).toBe(false); // surrogate
        expect(validLabel(Uint8Array.from([...new Array(15).fill(0x41), 0xc3]))).toBe(false); // truncated
    });
});

describe("VIA through the wrapper", () => {
    it("answers the protocol version and layer count", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        expect(Array.from(via(fw, id, [0x01]).slice(0, 3))).toEqual([0x01, 0x00, 0x0d]);
        expect(Array.from(via(fw, id, [0x11]).slice(0, 2))).toEqual([0x11, 16]);
        expect(Array.from(via(fw, id, [0x0c]).slice(0, 3))).toEqual([0x0c, 0, 1]); // 256 macros
    });

    it("clamps keymap buffer reads to the room left by the wrapper", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        fw.state.keymap.set([0x00, 0x04, 0x00, 0x05]);
        const reply = via(fw, id, [0x12, 0, 0, 30]); // asks for 30 bytes, gets 22
        expect(Array.from(reply.slice(0, 8))).toEqual([0x12, 0, 0, 30, 0x00, 0x04, 0x00, 0x05]);
        expect(reply.length).toBe(26);
    });

    it("writes keycodes with set_buffer and set_keycode", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        via(fw, id, [0x13, 0, 2, 2, 0x00, 0x29]);
        expect(Array.from(via(fw, id, [0x04, 0, 0, 1]).slice(4, 6))).toEqual([0x00, 0x29]);
        via(fw, id, [0x05, 1, 2, 3, 0x12, 0x34]);
        expect(Array.from(via(fw, id, [0x04, 1, 2, 3]).slice(4, 6))).toEqual([0x12, 0x34]);
    });

    it("answers an unknown command as unhandled", () => {
        const fw = firmware();
        expect(via(fw, bootstrap(fw), [0xee, 0x01])[0]).toBe(0xff);
    });

    it("reads and writes layer colors and DPI as channel-0 custom values", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        expect(Array.from(via(fw, id, [0x08, 0, 32]).slice(0, 5))).toEqual([0x08, 0, 32, 0x55, 0xff]);
        via(fw, id, [0x07, 0, 33, 10, 20]);
        expect(Array.from(via(fw, id, [0x08, 0, 33]).slice(3, 5))).toEqual([10, 20]);
        via(fw, id, [0x07, 0, 0, 99]); // not a DPI choice: ignored
        expect(via(fw, id, [0x08, 0, 0])[3]).toBe(3);
    });
});

describe("macro buffer (Sval v3)", () => {
    it("reports the buffer size by firmware", () => {
        const fw = firmware();
        const old = firmware({ comboLabels: false });
        expect(le32(sval(fw, bootstrap(fw), 0x1e), 1)).toBe(MACRO_BUFFER_SIZE);
        expect(le32(sval(old, bootstrap(old), 0x1e), 1)).toBe(MACRO_BUFFER_SIZE_NO_COMBO_LABELS);
    });

    it("round-trips bytes and refuses a count past the report", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        const set = sval(fw, id, 0x20, [10, 0, 0, 0, 3, 0x41, 0x42, 0]);
        expect(set[1]).toBe(0);
        const get = sval(fw, id, 0x1f, [10, 0, 0, 0, 3]);
        expect(Array.from(get.slice(0, 9))).toEqual([0x1f, 10, 0, 0, 0, 3, 0x41, 0x42, 0]);
        const tooMany = sval(fw, id, 0x1f, [0, 0, 0, 0, 21]); // room is 20 at 32-byte reports
        expect(tooMany[5]).toBe(0);
    });
});

describe("keyboard definition", () => {
    it("sends the compressed definition in chunks of at most 22 bytes", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        const size = le32(sval(fw, id, 0x0d), 1);
        expect(size).toBe(DEFINITION_BYTES.length);
        const out: number[] = [];
        while (out.length < size) {
            const chunk = sval(fw, id, 0x0e, [...LE16(out.length), 30]);
            expect(chunk[3]).toBeLessThanOrEqual(22);
            out.push(...chunk.slice(4, 4 + chunk[3]));
        }
        expect(Uint8Array.from(out)).toEqual(DEFINITION_BYTES);
        expect(sval(fw, id, 0x0e, [...LE16(size), 22])[3]).toBe(0);
        expect(DEFINITION.name).toBe("Svalboard");
        expect(DEFINITION.matrix).toEqual({ rows: 10, cols: 6 });
    });
});

describe("other Sval commands", () => {
    it("answers QMK settings query, get and set", () => {
        const fw = firmware();
        const id = bootstrap(fw);
        const query = sval(fw, id, 0x10, LE16(0));
        expect(query[1] | (query[2] << 8)).toBe(1);
        const term = sval(fw, id, 0x11, LE16(7));
        expect([term[1], term[2] | (term[3] << 8)]).toEqual([0, 200]);
        expect(sval(fw, id, 0x12, [...LE16(7), ...LE16(180), 0, 0])[1]).toBe(0);
        expect(sval(fw, id, 0x11, LE16(7))[2]).toBe(180);
        expect(sval(fw, id, 0x11, LE16(3))[1]).toBe(0xff); // auto shift isn't on this build
    });

    it("reports both halves with no pointing module", () => {
        const fw = firmware();
        const hw = sval(fw, bootstrap(fw), 0x2c);
        expect(Array.from(hw.slice(0, 12))).toEqual([0x2c, 1, 0x09, 0, 3, 0, 0, 0x0b, 0, 3, 0, 0]);
    });

    it("answers an unknown command with sval_cmd_error", () => {
        const fw = firmware();
        expect(sval(fw, bootstrap(fw), 0x33)[0]).toBe(0xff);
    });
});
