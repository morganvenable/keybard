// Faster uploads: the CHUNK window and BEGIN reuse, against the mock board in virtual time.
// A board on firmware from before them (fastUpload false) must get exactly today's upload:
// one CHUNK per round trip, no burst, no BEGIN flags, the image sent to each half.
import { beforeEach, describe, expect, it } from "vitest";

import type { FirmwareReleasePin } from "@/constants/firmware-releases";
import { UpdaterClient } from "@/services/updater/client";
import { planInstall } from "@/services/updater/checks";
import { fakeSetup, fixtureOneImage, fixtureRelease, type FixtureRelease } from "@/services/updater/fake-host";
import type { Fault } from "@/services/updater/fake-board";
import { memoryFlowStore, UpdateFlow } from "@/services/updater/flow";
import {
    CHUNK_PIECE_MAX, HAND_LEFT, HAND_RIGHT, Op, State, Status, UPLOAD_CHUNK_WINDOW, UPLOAD_REUSE_STAGED, beginArgs, decodeInfo0, encodeInfo0,
} from "@/services/updater/protocol";
import { ReplyTimeoutError, VirtualClock, type UpdaterRequest } from "@/services/updater/transport";
import { chooseUploader, stopAndWait, windowed } from "@/services/updater/upload";
import type { UpdaterClient } from "@/services/updater/client";

const L = HAND_LEFT;
const R = HAND_RIGHT;
let clock: VirtualClock;
let v3: FixtureRelease;
let v4: FixtureRelease;
let one: FixtureRelease;

beforeEach(async () => {
    clock = new VirtualClock();
    v3 ??= await fixtureRelease("v3", 3000);
    v4 ??= await fixtureRelease("v4", 4000);
    one ??= await fixtureOneImage("x4", 4100);
});

const pin = (r: FixtureRelease): FirmwareReleasePin => ({
    tag: r.tag, kind: r.tag.startsWith("v") ? "v" : "x", fwVersion: r.fwVersion, updaterProtocol: 4,
    file: { uf2: `svalboard_sval_${r.tag}.uf2`, sha256: r.files[L].sha256, size: r.files[L].bytes.length },
    notesUrl: "",
});

async function run(o: { fast: boolean; release?: FixtureRelease; faults?: Fault[]; cancelAt?: string; reflashOldAfterPlan?: boolean }) {
    const release = o.release ?? one;
    const { board, host } = fakeSetup({ clock, running: v3, half: { fastUpload: o.fast }, faults: o.faults });
    const begins: number[][] = [];
    const request = board.request.bind(board);
    board.request = async (op, hand, args) => {
        if (op === Op.BEGIN) begins.push(Array.from(args ?? []));
        return request(op, hand, args);
    };
    let burstChunks = 0;
    const many = board.requestMany.bind(board);
    board.requestMany = async (reqs: UpdaterRequest[], inFlight?: number) => { burstChunks += reqs.length; return many(reqs, inFlight); };
    const p = await planInstall(new UpdaterClient(board), { kind: "release", release: pin(release), files: release.files }, { clock, releases: [pin(v3), pin(release)] });
    if ("id" in p) throw new Error(`plan failed: ${p.id}`);
    // The sheet stays open while the board goes back to firmware without the faster upload.
    if (o.reflashOldAfterPlan) for (const h of [L, R] as const) board.halves[h].cfg.fastUpload = false;
    const flow = UpdateFlow.create(host, memoryFlowStore(), { plan: p, afterwards: "restore", backup: { fileName: "Kip.svil", svil: "{}" } });
    if (o.cancelAt) flow.subscribe((s) => { if (s.step === o.cancelAt && s.rows.some((r) => r.progress && r.progress > 0.3)) flow.cancel(); });
    const state = await flow.run();
    const chunks = board.requests.filter((r) => r.op === Op.CHUNK).length;
    return { board, state, begins, chunks, burstChunks, release };
}

const pieces = (r: FixtureRelease) => Math.ceil(r.files[L].image.length / CHUNK_PIECE_MAX);

describe("an older board (no upload flags)", () => {
    it("gets today's upload: one CHUNK per round trip, no BEGIN flags, the image sent to each half", async () => {
        const { state, board, begins, chunks, burstChunks } = await run({ fast: false });
        expect(state.phase).toBe("result");
        expect(board.bursts).toBe(0);
        expect(burstChunks).toBe(0);
        expect(begins.every((a) => a.length === 4)).toBe(true);
        expect(chunks).toBe(2 * pieces(one));
        expect(state.upload).toEqual({ uploadFlags: 0, chunkWindow: 1 });
        expect(board.blockErases).toBe(0);
        expect(state.measurements.send_left_window).toBe(1);
        expect(state.measurements.send_right_window).toBe(1);
        expect(state.measurements.reused_right).toBeUndefined();
        expect(state.result?.tags).toEqual({ [L]: "x4", [R]: "x4" });
    });
});

describe("a board with the CHUNK window and BEGIN reuse", () => {
    it("one image for both halves: sent once, in windows; the half with USB installs the image it relayed", async () => {
        const { state, board, begins, chunks, burstChunks } = await run({ fast: true });
        expect(state.phase).toBe("result");
        expect(state.result?.tags).toEqual({ [L]: "x4", [R]: "x4" });
        expect(chunks).toBe(pieces(one));
        expect(burstChunks).toBe(pieces(one));
        expect(board.bursts).toBe(Math.ceil(pieces(one) / 64)); // 4 windows of 16 per call, sliding
        expect(begins).toHaveLength(2);
        expect(begins.every((a) => a.length === 5 && a[4] === 3)).toBe(true); // reuse and block erase
        expect(board.blockErases).toBe(2);
        expect(state.measurements.send_left_window).toBe(16);
        expect(state.measurements.reused_right).toBe(1);
        expect(state.measurements.send_right_ms).toBe(0);
        const steps = (state.timeline ?? []).map((t) => t.step);
        expect(steps).toContain("other-send");
        expect(steps).not.toContain("self-send");
        expect(steps.indexOf("self-verify")).toBeGreaterThan(steps.indexOf("self-erase"));
        expect(state.approvalsAsked).toBe(1);
    });

    it("per-hand files (two manifests): the half with USB is sent its own image, in windows", async () => {
        const { state, chunks } = await run({ fast: true, release: v4 });
        expect(state.phase).toBe("result");
        expect(chunks).toBe(2 * pieces(v4));
        expect(state.measurements.reused_right).toBeUndefined();
        expect(state.measurements.send_right_window).toBe(16);
    });

    it("a CHUNK the board never got: the rest of its window is OUT_OF_ORDER, and the upload goes on from the board's offset", async () => {
        const at = 40 * CHUNK_PIECE_MAX;
        const { state, chunks } = await run({ fast: true, faults: [{ kind: "chunk-lost", at }] });
        expect(state.phase).toBe("result");
        expect(chunks).toBeGreaterThan(pieces(one));
        expect(chunks).toBeLessThan(pieces(one) + 64);
    });

    it("a changed CHUNK: END's SHA-512 refuses the image and nothing is installed on either half", async () => {
        const { state, board } = await run({ fast: true, faults: [{ kind: "chunk-corrupt", at: 3 * CHUNK_PIECE_MAX }] });
        expect(state.phase).toBe("failed");
        expect(state.failure?.id).toBe("F5");
        expect(state.committed).toEqual([]);
        expect(board.halves[L].cfg.tag).toBe("v3");
        expect(board.halves[R].cfg.tag).toBe("v3");
    });

    it("Cancel while the image is being sent: the board is told to ABORT and nothing is installed", async () => {
        const { state, board } = await run({ fast: true, cancelAt: "other-send" });
        expect(state.phase).toBe("cancelled");
        expect(board.requests.some((r) => r.op === Op.ABORT)).toBe(true);
        expect(board.halves[L].cfg.tag).toBe("v3");
        expect(board.halves[R].cfg.tag).toBe("v3");
    });

    it("unplugged halfway through the upload: stops with nothing installed", async () => {
        const { state, board } = await run({ fast: true, faults: [{ kind: "unplug", at: "other-send" }] });
        expect(state.phase).toBe("failed");
        expect(state.committed).toEqual([]);
        expect(board.halves[L].cfg.tag).toBe("v3");
        expect(board.halves[R].cfg.tag).toBe("v3");
    });

    it("a block erase that outlasts the reply timeout: STATUS is asked again and the update goes on", async () => {
        const { state } = await run({ fast: true, faults: [{ kind: "erase-stall", replies: 3 }] });
        expect(state.phase).toBe("result");
        expect(state.result?.tags).toEqual({ [L]: "x4", [R]: "x4" });
    });

    it("a board that stops answering while it erases: stops with nothing installed", async () => {
        const { state, board } = await run({ fast: true, faults: [{ kind: "erase-stall", replies: 4 }] });
        expect(state.phase).toBe("failed");
        expect(state.committed).toEqual([]);
        expect(board.halves[L].cfg.tag).toBe("v3");
        expect(board.halves[R].cfg.tag).toBe("v3");
    });

    it("a board reflashed to older firmware while the sheet was open: today's upload, no burst, no BEGIN flags", async () => {
        const { state, board, begins, burstChunks } = await run({ fast: true, reflashOldAfterPlan: true });
        expect(state.phase).toBe("result");
        expect(board.bursts).toBe(0);
        expect(burstChunks).toBe(0);
        expect(begins.every((a) => a.length === 4)).toBe(true);
        expect(state.upload).toEqual({ uploadFlags: 0, chunkWindow: 1 });
    });

    it("never takes a burst it didn't advertise", async () => {
        const { board } = fakeSetup({ clock, running: v3 });
        await expect(board.requestMany([{ op: Op.CHUNK, hand: L, args: [0, 0, 0, 1, 0] }])).rejects.toThrow(/CHUNK window/);
    });
});

describe("choosing the uploader", () => {
    const caps = { uploadFlags: UPLOAD_CHUNK_WINDOW | UPLOAD_REUSE_STAGED, chunkWindow: 16 };
    it("stop-and-wait for a board without the window, or a link without bursts", () => {
        expect(chooseUploader(undefined, true)).toBe(stopAndWait);
        expect(chooseUploader({ uploadFlags: 0, chunkWindow: 1 }, true)).toBe(stopAndWait);
        expect(chooseUploader({ uploadFlags: UPLOAD_REUSE_STAGED, chunkWindow: 16 }, true)).toBe(stopAndWait);
        expect(chooseUploader(caps, false)).toBe(stopAndWait);
    });
    it("the board's window when both take it", () => {
        expect(chooseUploader(caps, true).name).toBe("window-16");
    });
});

describe("the windowed uploader's resync", () => {
    // A stub board: takes every CHUNK in order, but the replies to the first burst are lost and
    // the STATUS asked after it times out `statusTimeouts` times before it answers.
    function stub(statusTimeouts: number, lostBursts = 1) {
        let staged = 0;
        let burstsLost = lostBursts;
        let left = statusTimeouts;
        const client = {
            async chunks(_hand: number, pieces: Array<[number, Uint8Array]>) {
                const replies = pieces.map(([o, b]) => { if (o === staged) staged += b.length; return { status: Status.OK, next: staged }; });
                if (burstsLost-- > 0) throw new ReplyTimeoutError(Op.CHUNK);
                return replies;
            },
            async status() {
                if (left-- > 0) throw new ReplyTimeoutError(Op.STATUS);
                return { state: State.RECEIVING, staged, lastError: 0 };
            },
        };
        return { client: client as unknown as UpdaterClient, staged: () => staged };
    }
    const image = new Uint8Array(5000).map((_, i) => i & 0xff);
    const job = (client: UpdaterClient) => ({ client, hand: L, image, from: 0, onProgress: () => {}, checkCancel: () => {} });

    it("a STATUS that times out after a lost burst counts against the same budget, and the upload goes on", async () => {
        const s = stub(2);
        await windowed(16).upload(job(s.client));
        expect(s.staged()).toBe(image.length);
    });

    it("past the budget, it stops", async () => {
        const s = stub(10, 10);
        await expect(windowed(16).upload(job(s.client))).rejects.toBeInstanceOf(ReplyTimeoutError);
    });
});

describe("the protocol bytes", () => {
    const base = { status: Status.OK, state: 0, protocol: 4, slotBase: 0x800000, slotSize: 0x160000, maxImage: 0x160000, pointingId: 5, hand: R, fwVersion: 28, storageFormat: 2, securityEpoch: 0, flags: 0x81, lastError: 0, chunkMax: 50, manifestMax: 52, reportBytes: 64 };
    it("an older build's INFO reads no upload flags and a window of 1", () => {
        const i = decodeInfo0({ status: 0, rsp: encodeInfo0(base) });
        expect(i.uploadFlags).toBe(0);
        expect(i.chunkWindow).toBe(1);
    });
    it("a newer build's INFO reads its flags and window", () => {
        const i = decodeInfo0({ status: 0, rsp: encodeInfo0({ ...base, uploadFlags: 3, chunkWindow: 16 }) });
        expect(i.uploadFlags).toBe(3);
        expect(i.chunkWindow).toBe(16);
    });
    it("BEGIN carries the flags byte only when asked", () => {
        expect(beginArgs(0x01020304)).toEqual([4, 3, 2, 1]);
        expect(beginArgs(0x01020304, 1)).toEqual([4, 3, 2, 1, 1]);
    });
});
