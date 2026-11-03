import { describe, expect, it } from "vitest";

import { FakeSvalFirmware } from "@/dev/fake-board/firmware";
import { seedBoard } from "@/dev/fake-board/seed";
import { PtpPrototypeService } from "@/services/ptp-prototype.service";
import {
    availableOptions, MODE_OPTIONS, parseProtoReply, protoGetPayload, protoRebootPayload, protoSetPayload, SURFACE_OPTIONS,
    surfacePending, SUPPORT_SCALING, SUPPORT_TAKEOVER,
} from "@/utils/ptp-prototype";

function reply(fill: (r: Uint8Array) => void): Uint8Array {
    const r = new Uint8Array(64);
    r[0] = 0xdd;
    r[5] = 0xfc;
    r[6] = 0xc2;
    fill(r);
    return r;
}

describe("ptp prototype encoder", () => {
    it("builds get, set and reboot payloads (after the protocol byte)", () => {
        expect(protoGetPayload()).toEqual([0x42, 3, 0]);
        expect(protoSetPayload({ scroll: 1, sniper: 2, boost: 1, surface: 1 })).toEqual([0x42, 3, 1, 1, 2, 1, 1]);
        expect(protoRebootPayload()).toEqual([0x42, 5]);
    });
});

describe("ptp prototype parser", () => {
    it("reads the block when flags bit 4 is set", () => {
        const parsed = parseProtoReply(reply((r) => {
            r[7] = 0; r[8] = 3; r[9] = 0x10;
            r.set([1, 1, 2, 0, 1, 0, 0x0f, 0x99], 56);
        }));
        expect(parsed).toEqual({
            status: 0, owner: 3, flags: 0x10,
            state: { version: 1, scroll: 1, sniper: 2, boost: 0, surface: 1, surfaceActive: 0, supported: 0x0f },
        });
        expect(surfacePending(parsed!.state!)).toBe(true);
    });

    it("has no block when bit 4 is clear, the version is 0, or the report is 32 bytes", () => {
        expect(parseProtoReply(reply((r) => { r[9] = 0x00; r[56] = 1; }))!.state).toBeNull();
        expect(parseProtoReply(reply((r) => { r[9] = 0x10; r[56] = 0; }))!.state).toBeNull();
        expect(parseProtoReply(reply((r) => { r[9] = 0x10; }).subarray(0, 32))!.state).toBeNull();
    });

    it("refuses anything but a 0xFC / 0xC2 reply", () => {
        expect(parseProtoReply(reply((r) => { r[5] = 0xff; }))).toBeNull();
        expect(parseProtoReply(reply((r) => { r[6] = 0x42; }))).toBeNull();
    });

    it("keeps only supported options, plus the one in use", () => {
        expect(availableOptions(MODE_OPTIONS, SUPPORT_TAKEOVER, 0).map((o) => o.label)).toEqual(["Off", "Takeover"]);
        expect(availableOptions(MODE_OPTIONS, SUPPORT_SCALING, 1).map((o) => o.label)).toEqual(["Off", "Takeover", "Scaling"]);
        expect(availableOptions(SURFACE_OPTIONS, 0, 0).map((o) => o.label)).toEqual(["Standard"]);
    });
});

/** The service against the simulated firmware, through a minimal wrapper transport. */
function harness(devProto: boolean, reportLength = 64) {
    const fw = new FakeSvalFirmware(seedBoard(), { devProto });
    const id = 0x12340001;
    const transport = {
        async sendDev(payload: number[]) {
            const report = new Uint8Array(reportLength);
            report[0] = 0xdd;
            report[1] = id & 0xff; report[2] = (id >> 8) & 0xff; report[3] = (id >> 16) & 0xff; report[4] = (id >>> 24) & 0xff;
            report[5] = 0xfc;
            report.set(payload.slice(0, reportLength - 6), 6);
            // Accept any id: the harness skips the bootstrap.
            (fw as unknown as { validId: () => boolean }).validId = () => true;
            const out = fw.receive(report)!;
            if (out[5] === 0xff) throw new Error("wrapper error");
            return out;
        },
    };
    return { fw, service: new PtpPrototypeService(transport) };
}

describe("ptp prototype service with the simulated firmware", () => {
    it("is unsupported on release firmware (wrapper error frame)", async () => {
        expect(await harness(false).service.get()).toBeNull();
    });

    it("is unsupported on 32-byte reports (no room for the block)", async () => {
        expect(await harness(true, 32).service.get()).toBeNull();
    });

    it("reads back, sets all four, and refuses unsupported values without changing anything", async () => {
        const { fw, service } = harness(true);
        expect(await service.get()).toMatchObject({ scroll: 0, sniper: 0, boost: 0, surface: 0, surfaceActive: 0, supported: 0x0f });
        const set = await service.set({ scroll: 0, sniper: 2, boost: 0, surface: 0 });
        expect(set).toMatchObject({ ok: true, state: { sniper: 2 } });
        expect(fw.protoRequests.at(-1)).toEqual([3, 1, 0, 2, 0, 0]);
        fw.protoSupported = 0x03;
        const refused = await service.set({ scroll: 0, sniper: 2, boost: 2, surface: 0 });
        expect(refused.ok).toBe(false);
        expect(refused.state).toMatchObject({ sniper: 2, boost: 0 });
    });

    it("stores the surface for the next boot", async () => {
        const { fw, service } = harness(true);
        const set = await service.set({ scroll: 0, sniper: 0, boost: 0, surface: 1 });
        expect(set.state).toMatchObject({ surface: 1, surfaceActive: 0 });
        fw.protoBoot();
        expect(await service.get()).toMatchObject({ surface: 1, surfaceActive: 1 });
    });
});
