// App rules (Sval 0x40, 0x41): app IDs, the record, chunked reads and writes against the
// simulated board at both report lengths, statuses, and the .svil and import paths.
// svalboard/qmk keyboards/svalboard/docs/protocol.md, "App rules".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankBoard } from "@/dev/fake-board/board";
import { FakeSvalFirmware, FLAG5_APP_RULES } from "@/dev/fake-board/firmware";
import {
    APP_RULES_BEGIN, APP_RULES_COMMIT, APP_RULES_INFO, APP_RULES_READ, APP_RULES_RECORD_BYTES, APP_RULES_WRITE, AppRulesError,
    CMD_SVIL_APP_FOREGROUND, CMD_SVIL_APP_RULES, appId, appIdHex, appRulesFromSvil, appRulesToSvil, chunkSize, cycleMask,
    hasAppRules, maskState, parseRecord, readAppForeground, readAppRules, readAppRulesInfo, sameRules, serializeRecord,
    truncateUtf8, writeAppRules, type AppRulesLink,
} from "@/services/app-rules";
import { SvilUSB } from "@/services/usb.service";
import { importService } from "@/services/import.service";
import { prepareImport } from "@/services/import-preflight";
import type { AppRule, KeyboardInfo } from "@/types/keyboard.types";
import { APP_RULE_KEYS_STORAGE, appKeyFor, rememberAppKey } from "@/utils/app-rule-keys";

const le32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** A link to the simulated board through the client wrapper, with reports of `reportLength` bytes. */
function fakeLink(reportLength: number, fw = new FakeSvalFirmware(blankBoard())) {
    let id = 0;
    for (let seed = 1; !id; seed++) {
        const req = new Uint8Array(reportLength);
        req[0] = 0xdd;
        for (let i = 0; i < 20; i++) req[5 + i] = (i * 37 + seed) & 0xff;
        id = le32(fw.receive(req)!, 25);
    }
    const sent: number[][] = [];
    const link: AppRulesLink = {
        reportLength,
        async sendSvil(cmd, args) {
            const payload = [cmd, ...args];
            if (6 + payload.length > reportLength) throw new Error(`request of ${payload.length} bytes does not fit a ${reportLength}-byte report`);
            sent.push(payload);
            const req = new Uint8Array(reportLength);
            req[0] = 0xdd;
            req[1] = id & 0xff; req[2] = (id >>> 8) & 0xff; req[3] = (id >>> 16) & 0xff; req[4] = id >>> 24;
            req[5] = 0xdf;
            req.set(payload, 6);
            const reply = fw.receive(req)!;
            if (reply[5] === 0xff) throw new Error(`wrapper error ${reply[6]}`);
            return reply.slice(6);
        },
    };
    return { fw, link, sent };
}

const rule = (over: Partial<AppRule> = {}): AppRule => ({ appId: appId("notepad.exe"), defaultLayer: null, frontLayer: null, onMask: 0, offMask: 0, flags: 0, label: "notepad.exe", ...over });

describe("app IDs", () => {
    it("match the protocol's test values", () => {
        expect(appId("notepad.exe")).toBe(0xb884a32c);
        expect(appId("Notepad.EXE")).toBe(0xb884a32c);
        expect(appId("chrome.exe")).toBe(0xfc0c788d);
        expect(appId("com.apple.Safari")).toBe(0xece537f6);
        expect(appId("firefox")).toBe(0xf4d4d03a);
    });

    it("drop spaces and tabs at the ends, lower ASCII only; empty is 0", () => {
        expect(appId(" \tnotepad.exe\t ")).toBe(0xb884a32c);
        expect(appId("")).toBe(0);
        expect(appId(" \t ")).toBe(0);
        // Non-ASCII letters keep their case.
        expect(appId("É.exe")).not.toBe(appId("é.exe"));
        expect(appIdHex(0xb884a32c)).toBe("B884A32C");
    });

    it("labels cut at 13 UTF-8 bytes, never inside a character", () => {
        expect(truncateUtf8("com.apple.Safari")).toBe("com.apple.Saf");
        expect(truncateUtf8("ééééééé")).toBe("éééééé"); // 12 bytes; a 7th would make 14
        expect(truncateUtf8("short")).toBe("short");
    });
});

describe("the record", () => {
    it("round trips the header and rules", () => {
        const rules = [rule({ defaultLayer: 2, frontLayer: 5, onMask: 0b1010, offMask: 0x4001, label: "Notepad" }), rule({ appId: appId("firefox"), label: "ééééééé" })];
        const bytes = serializeRecord(rules);
        expect(bytes.length).toBe(4 + 2 * 24);
        expect(Array.from(bytes.subarray(0, 4))).toEqual([1, 2, 0, 0]);
        expect(Array.from(bytes.subarray(4, 8))).toEqual([0x2c, 0xa3, 0x84, 0xb8]);
        expect(bytes[4 + 4]).toBe(2);
        expect(bytes[4 + 24 + 4]).toBe(0xff); // no default layer
        const back = parseRecord(bytes);
        expect(back[0]).toEqual({ ...rules[0] });
        expect(back[1].label).toBe("éééééé");
        expect(sameRules(back, rules)).toBe(true); // compared as the board stores them: the label cut alike
        expect(sameRules(back, parseRecord(serializeRecord(back)))).toBe(true);
    });

    it("a record never stored has no rules; another format or too many rules is refused", () => {
        expect(parseRecord(new Uint8Array(APP_RULES_RECORD_BYTES))).toEqual([]);
        expect(() => parseRecord(Uint8Array.from([2, 0, 0, 0]))).toThrow(/format 2/);
        expect(() => parseRecord(Uint8Array.from([1, 65, 0, 0]))).toThrow(/65 rules/);
        expect(() => serializeRecord(Array.from({ length: 65 }, () => rule()))).toThrow(/at most 64/);
    });
});

describe("layer pills", () => {
    it("cycle neutral, on, off, neutral; off wins", () => {
        let r = rule();
        expect(maskState(r, 3)).toBe("neutral");
        r = cycleMask(r, 3);
        expect([maskState(r, 3), r.onMask, r.offMask]).toEqual(["on", 8, 0]);
        r = cycleMask(r, 3);
        expect([maskState(r, 3), r.onMask, r.offMask]).toEqual(["off", 0, 8]);
        r = cycleMask(r, 3);
        expect([maskState(r, 3), r.onMask, r.offMask]).toEqual(["neutral", 0, 0]);
        expect(maskState({ onMask: 1, offMask: 1 }, 0)).toBe("off");
        expect(cycleMask(r, 16)).toBe(r);
        expect(cycleMask(r, 15)).toBe(r); // the auto mouse layer is never masked
    });

    it("never sends the auto mouse layer's mask bits, from any source", () => {
        const bytes = serializeRecord([rule({ onMask: 0xffff, offMask: 0x8001 })]);
        expect([bytes[4 + 6] | (bytes[4 + 7] << 8), bytes[4 + 8] | (bytes[4 + 9] << 8)]).toEqual([0x7fff, 0x0001]);
        const raw = serializeRecord([rule()]);
        raw[4 + 7] = 0x80;
        expect(parseRecord(raw)[0].onMask).toBe(0);
        expect(appRulesFromSvil([{ app_id: 5, on_mask: 0x8003 }])![0].onMask).toBe(3);
    });
});

describe("requests against the simulated board", () => {
    it("the command numbers match SvilUSB", () => {
        expect(SvilUSB.CMD_SVIL_APP_FOREGROUND).toBe(CMD_SVIL_APP_FOREGROUND);
        expect(SvilUSB.CMD_SVIL_APP_RULES).toBe(CMD_SVIL_APP_RULES);
    });

    it("feature bit: GET_INFO byte 22 bit 0 on firmware with app rules only", async () => {
        expect(hasAppRules(FLAG5_APP_RULES)).toBe(true);
        expect(hasAppRules(0x02)).toBe(false);
        expect(hasAppRules(undefined)).toBe(false);
        for (const appRules of [true, false]) {
            const { link } = fakeLink(64, new FakeSvalFirmware(blankBoard(), { appRules }));
            const info = await link.sendSvil(0x00, [], { uint8: true });
            // After the command echo: byte 22 of GET_INFO counting the 0xDF prefix.
            expect(hasAppRules(info[21])).toBe(appRules);
        }
    });

    it("INFO describes the record", async () => {
        const { link } = fakeLink(64);
        expect(await readAppRulesInfo(link)).toEqual({ format: 1, max: 64, ruleBytes: 24, count: 0, recordBytes: 1540, chunk: 48, layers: 16 });
        expect((await readAppRules(link)).rules).toEqual([]);
    });

    it.each([[64, 48], [32, 20]])("writes and reads back in chunks with %i-byte reports (%i bytes each)", async (length, chunk) => {
        const { fw, link, sent } = fakeLink(length);
        expect(chunkSize(link)).toBe(chunk);
        const rules = [rule({ defaultLayer: 1, frontLayer: 3, onMask: 0b100, offMask: 0b10, label: "Notepad" }), rule({ appId: appId("firefox"), label: "firefox" }), rule({ appId: appId("com.apple.Safari"), label: "Safari" })];
        expect(await writeAppRules(link, rules)).toBe(3);
        const writes = sent.filter((p) => p[1] === APP_RULES_WRITE);
        expect(writes.length).toBe(Math.ceil((4 + 3 * 24) / chunk));
        expect(writes.every((p) => p[4] <= chunk)).toBe(true);
        expect(fw.appRulesOps[0]).toBe(APP_RULES_BEGIN);
        expect(fw.appRulesOps.at(-1)).toBe(APP_RULES_COMMIT);
        expect(Array.from(fw.state.appRules.subarray(0, 4))).toEqual([1, 3, 0, 0]);
        sent.length = 0;
        const { rules: back } = await readAppRules(link);
        expect(back).toEqual(rules);
        expect(sent[0]).toEqual([CMD_SVIL_APP_RULES, APP_RULES_INFO]);
        expect(sent.filter((p) => p[1] === APP_RULES_READ).length).toBe(Math.ceil((4 + 3 * 24) / chunk));
    });

    it("a full list of 64 round trips over 32-byte reports; a shorter list zeroes the rest", async () => {
        const { fw, link } = fakeLink(32);
        const rules = Array.from({ length: 64 }, (_, i) => rule({ appId: appId(`app${i}.exe`), label: `app${i}`, onMask: (i * 511) & 0x7fff, defaultLayer: i % 16 }));
        await writeAppRules(link, rules);
        expect((await readAppRules(link)).rules).toEqual(rules);
        await writeAppRules(link, rules.slice(0, 1));
        expect(fw.state.appRules.subarray(4 + 24).every((b) => b === 0)).toBe(true);
        expect((await readAppRules(link)).rules).toEqual(rules.slice(0, 1));
    });

    it("STATUS names the rule that applies to the app in front", async () => {
        const { fw, link } = fakeLink(64);
        await writeAppRules(link, [rule({ appId: appId("firefox") }), rule({ frontLayer: 4, onMask: 2 })]);
        expect((await readAppForeground(link)).rule).toBeNull();
        const id = appId("notepad.exe");
        await link.sendSvil(CMD_SVIL_APP_FOREGROUND, [1, id & 0xff, (id >>> 8) & 0xff, (id >>> 16) & 0xff, id >>> 24, 0], { uint8: true });
        expect(fw.appForeground).toBe(id);
        expect(await readAppForeground(link)).toMatchObject({ appId: id, rule: 1, frontLayer: 4, onMask: 2, flags: 1 });
    });

    it("firmware without the command (0xFF echo) throws, and so does a nonzero status", async () => {
        const { link } = fakeLink(64, new FakeSvalFirmware(blankBoard(), { appRules: false }));
        await expect(readAppRules(link)).rejects.toThrow(/doesn't know command 0x41/);
        const refused = (op: number, status: number): AppRulesLink => ({
            reportLength: 64,
            sendSvil: async (cmd, args) => (args[0] === op ? Uint8Array.from([cmd, op, status, 0]) : Uint8Array.from([cmd, args[0], 0, 0])),
        });
        await expect(writeAppRules(refused(APP_RULES_COMMIT, 5), [rule()])).rejects.toMatchObject({ name: "AppRulesError", status: 5 });
        await expect(writeAppRules(refused(APP_RULES_COMMIT, 4), [rule()])).rejects.toThrow(/invalid/);
        await expect(writeAppRules(refused(APP_RULES_BEGIN, 2), [rule()])).rejects.toBeInstanceOf(AppRulesError);
        await expect(readAppRulesInfo(refused(APP_RULES_INFO, 3))).rejects.toThrow(/too short/);
    });

    it("COMMIT of an edit copy that isn't format 1 changes nothing (status 4)", async () => {
        const { fw, link } = fakeLink(64);
        await writeAppRules(link, [rule()]);
        const before = fw.state.appRules.slice();
        await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_BEGIN], { uint8: true });
        await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_WRITE, 0, 0, 4, 2, 1, 0, 0], { uint8: true });
        const reply = await link.sendSvil(CMD_SVIL_APP_RULES, [APP_RULES_COMMIT], { uint8: true });
        expect(reply[2]).toBe(4);
        expect(fw.state.appRules).toEqual(before);
    });

    it("the simulated board keeps the rules across a reload", async () => {
        const { serializeBoard, deserializeBoard } = await import("@/dev/fake-board/board");
        const { fw, link } = fakeLink(64);
        await writeAppRules(link, [rule({ label: "kept" })]);
        const again = deserializeBoard(serializeBoard(fw.state))!;
        expect(parseRecord(again.appRules)[0].label).toBe("kept");
    });
});

describe("app keys this browser remembers", () => {
    beforeEach(() => localStorage.removeItem(APP_RULE_KEYS_STORAGE));
    it("maps an ID back to the key as typed", () => {
        expect(appKeyFor(appId("notepad.exe"))).toBeUndefined();
        rememberAppKey("  Notepad.exe ");
        expect(appKeyFor(appId("notepad.exe"))).toBe("Notepad.exe");
        expect(appKeyFor(0)).toBeUndefined();
    });
});

describe("layout files and import", () => {
    afterEach(() => vi.restoreAllMocks());

    it(".svil keeps the key with the rule; a key in the file gives the ID", () => {
        const rules = [rule({ key: "notepad.exe", onMask: 3 }), rule({ appId: 0x1234, label: "Old" })];
        const svil = appRulesToSvil(rules);
        expect(svil[0]).toMatchObject({ app_id: 0xb884a32c, key: "notepad.exe", on_mask: 3, default_layer: null });
        expect(svil[1].key).toBeUndefined();
        const back = appRulesFromSvil(JSON.parse(JSON.stringify(svil)))!;
        expect(sameRules(back, rules)).toBe(true);
        expect(appRulesFromSvil([{ key: "firefox", app_id: 1, default_layer: 300, on_mask: 0x1ffff }])![0])
            .toMatchObject({ appId: appId("firefox"), defaultLayer: null, onMask: 0x7fff, label: "firefox" });
        expect(appRulesFromSvil(undefined)).toBeNull();
        expect(appRulesFromSvil(Array.from({ length: 70 }, () => ({ app_id: 5 })))!.length).toBe(64);
    });

    const board = (over: Partial<KeyboardInfo> = {}): KeyboardInfo => ({ rows: 1, cols: 1, layers: 1, keymap: [[4]], feature_flags5: 1, app_rules: [], ...over });

    it("the preflight takes the file's rules on a board that has them, and says so on one that doesn't", () => {
        const file = board({ app_rules: [rule()] });
        expect(prepareImport(file, board()).keyboard.app_rules).toEqual([rule()]);
        const without = prepareImport(file, board({ feature_flags5: 0, app_rules: undefined }));
        expect(without.keyboard.app_rules).toBeUndefined();
        expect(without.unavailable).toContain("App rules");
    });

    it("import writes the whole list once when it differs, and not at all when it doesn't", async () => {
        const { fw, link } = fakeLink(64);
        const queued: string[] = [];
        const cbs: Array<() => Promise<void>> = [];
        const enqueue = async (desc: string, cb: () => Promise<void>) => { queued.push(desc); cbs.push(cb); };
        const services = { keyboardService: { saveSvil: vi.fn() }, appRulesLink: link, labelService: {} };
        await importService.syncWithKeyboard(board({ app_rules: [rule()] }), board(), enqueue, services);
        expect(queued).toContain("Update app rules");
        await cbs[queued.indexOf("Update app rules")]();
        expect(parseRecord(fw.state.appRules)).toEqual([rule()]);
        queued.length = 0;
        await importService.syncWithKeyboard(board({ app_rules: [rule()] }), board({ app_rules: [rule()] }), enqueue, services);
        expect(queued).not.toContain("Update app rules");
    });
});
