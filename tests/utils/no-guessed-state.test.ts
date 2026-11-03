// Board state Keybard shows is what it read, or less: never a stand-in value.
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { failureCopy } from "@/features/firmware/failures";
import { hostPointingEvent } from "@/features/trainer/host-pointing";
import { FragmentService } from "@/services/fragment.service";
import { POINTING_LIVE_MAX_MISSES, PointingLiveService } from "@/services/pointing-live.service";
import type { Failure } from "@/services/updater/flow";
import { manualHalves } from "@/services/updater/manual";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { boardLayerColor } from "@/utils/color-conversion";
import type { PointingMotionReport } from "@/utils/pointing-motion";
import { evaluateCondition, evaluateShowIf } from "@/utils/show-if-evaluator";

const text = (n: unknown) => (typeof n === "string" ? n : renderToStaticMarkup(n as ReactElement).replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'"));

describe("update failures with the hand unknown", () => {
    const f = (id: Failure["id"], hand?: 0 | 1) => ({ id, hand } as Failure);
    it("F11 names no half", () => {
        const c = failureCopy(f("F11"));
        expect(c.title).toBe("One half needs its firmware installed by hand");
        expect(text(c.body)).toBe("Plug the USB cable into one half's U port. It opens as a drive named RPI-RP2.");
        expect(text(failureCopy(f("F11", 0)).body)).toContain("the left half's U port");
    });
    it("F14 names no half", () => {
        expect(text(failureCopy(f("F14")).body)).toBe("If a drive named RPI-RP2 opened, one half needs its firmware installed by hand.");
        expect(text(failureCopy(f("F14", 1)).body)).toContain("the right half needs");
    });
});

describe("manual install halves", () => {
    it("has no first half when the usual one is unknown", () => {
        expect(manualHalves(undefined, null)).toEqual([0, 1]);
        expect(manualHalves(undefined, 1)).toEqual([0, 1]);
        expect(manualHalves(undefined, 0)).toEqual([1, 0]);
        expect(manualHalves(1, null)).toEqual([1]);
    });
});

describe("showIf with a value that wasn't read", () => {
    const values = new Map([["id_on", 1]]);
    it("is unknown, and hides the control", () => {
        expect(evaluateCondition("{id_missing} == 1", values)).toBeUndefined();
        expect(evaluateShowIf("{id_missing} == 1", values)).toBe(false);
        expect(evaluateShowIf("{id_missing} != 1", values)).toBe(false);
        expect(evaluateShowIf("{id_on} == 1", values)).toBe(true);
        expect(evaluateShowIf("", values)).toBe(true);
    });
});

describe("layer colors from the board", () => {
    it("are a preset only on an exact LED match", () => {
        expect(boardLayerColor(149, 255)).toBe("blue");
        expect(boardLayerColor(150, 255)).not.toBe("blue");
        expect(boardLayerColor(150, 255)).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

describe("clusters with nothing reported", () => {
    const kb = { fragments: { a: { id: 1 }, b: { id: 2 } } } as unknown as KeyboardInfo;
    const inst = { id: "left_index", fragment_options: [{ fragment: "a" }, { fragment: "b", default: true }] } as never;
    it("draw the default, and say it is the default", () => {
        const s = new FragmentService();
        expect(s.resolveFragmentWithSource(kb, 0, inst)).toEqual({ fragment: "b", source: "default" });
        expect(s.resolveFragment(kb, 0, inst)).toBe("b");
        const stored = { ...kb, fragmentState: { eepromSelections: new Map([[0, 0]]), hwDetection: new Map(), userSelections: new Map() } } as unknown as KeyboardInfo;
        expect(s.resolveFragmentWithSource(stored, 0, inst)).toEqual({ fragment: "a", source: "board" });
    });
});

describe("pointing pills when the board stops answering", () => {
    it("tells the page once the reads have failed POINTING_LIVE_MAX_MISSES times in a row", async () => {
        vi.useFakeTimers();
        try {
            const half = { dx: 0, dy: 0 };
            let answer: PointingMotionReport | null = { sniper: true, boost: false, left: half, right: half } as unknown as PointingMotionReport;
            const live = new PointingLiveService({ getPointingMotion: async () => answer, hasPointingMotion: () => true, now: () => 0 });
            const stale = vi.fn();
            const seen = vi.fn();
            live.subscribe(seen);
            live.subscribeStale(stale);
            live.setConnection({ rows: 1, cols: 1 } as KeyboardInfo, true, 1);
            const release = live.acquire();
            await vi.advanceTimersByTimeAsync(20);
            expect(seen).toHaveBeenCalled();
            expect(live.latest()?.sniper).toBe(true);
            answer = null;
            for (let i = 0; i < POINTING_LIVE_MAX_MISSES + 2; i++) await vi.advanceTimersByTimeAsync(1100);
            expect(stale).toHaveBeenCalledTimes(1);
            expect(live.latest()).toBeNull();
            release();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("Host pointing events", () => {
    it("draw no mode the Host didn't send", () => {
        const r = hostPointingEvent({ left: {}, right: {} })!;
        expect(r.sniper).toBe(false);
        expect(r.boost).toBe(false);
        expect(r.factors).toBeUndefined();
        expect(r.velocityScroll).toBeUndefined();
        expect(hostPointingEvent({ sniper: true, left: {}, right: {} })!.sniper).toBe(true);
    });
});
