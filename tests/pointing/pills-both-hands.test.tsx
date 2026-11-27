import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sniper and boost are the board's, not a hand's: their pills (and the sniper
// reticle) show steadily at both devices, and motion on one hand neither moves
// nor fades them. Velocity Scroll still follows the moving hand.

const live = vi.hoisted(() => ({ feed: null as unknown, sniper: false, boost: false }));
// What each device's overlay draws: the latest pill amounts and reticle amount per side.
const drawn = vi.hoisted(() => ({ pills: {} as Record<string, Record<string, number>>, reticle: {} as Record<string, number> }));

vi.mock("@/hooks/usePointingDevices", async (orig) => {
    const real = await orig<typeof import("@/hooks/usePointingDevices")>();
    return {
        ...real,
        usePointingKinds: () => ({ left: "trackball", right: "trackball" }),
        usePointingLive: () => ({ source: "board", feed: live.feed, sniper: live.sniper, boost: live.boost, factors: { sniperDivisor: 3, boostFactor: 2 } }),
    };
});
vi.mock("@/features/trainer/host-pointing", async (orig) => {
    const real = await orig<typeof import("@/features/trainer/host-pointing")>();
    return { ...real, notifyHostPointingLook: vi.fn() };
});
vi.mock("@/services/pointing-look.service", () => ({ useBalls: () => ({ left: "silver", right: "black" }), setBall: vi.fn() }));
vi.mock("@/features/pointing-demo", async (orig) => {
    const real = await orig<typeof import("@/features/pointing-demo")>();
    return { ...real, pointingDemo: () => null };
});
vi.mock("@/utils/pointing-geometry", async (orig) => {
    const real = await orig<typeof import("@/utils/pointing-geometry")>();
    return {
        ...real,
        placeDevice: (_k: unknown, side: "left" | "right") => ({ kind: "ball", side, cx: side === "left" ? 6 : 18, cy: 5, dU: 3.8, sizeU: 4.7, view: 1.24 }),
    };
});
vi.mock("@/components/pointing-viz/overlay-draw", async (orig) => {
    const real = await orig<typeof import("@/components/pointing-viz/overlay-draw")>();
    return {
        ...real,
        drawPills: (_ctx: unknown, pills: { kind: string; amount: number }[], o: { side: string }) => {
            drawn.pills[o.side] = Object.fromEntries(pills.map((p) => [p.kind, p.amount]));
        },
        drawReticle: (ctx: { side?: string }, _r: number, amount: number) => { drawn.reticle[ctx.side ?? "?"] = amount; },
    };
});

import { PointingLayer } from "@/components/pointing-viz/PointingLayer";
import { _setWebGLDisabledForTest } from "@/components/pointing-viz/webgl/renderer";
import { PointingOverlayLayer } from "@/features/trainer/PointingOverlayLayer";
import { ReportFeed } from "@/hooks/usePointingDevices";
import type { KeyboardInfo } from "@/types/keyboard.types";
import type { PointingMotionHalf, PointingMotionReport } from "@/utils/pointing-motion";

const still: PointingMotionHalf = { valid: true, scrolling: false, saturated: false, autoMouse: false, touchValid: false, fingers: 0, dx: 0, dy: 0, h: 0, v: 0, buttons: 0, touchX: 0, touchY: 0 } as PointingMotionHalf;
const report = (side: "left" | "right", modes: { sniper: boolean; boost: boolean }): PointingMotionReport => ({
    ...modes, autoMouseLayer: false, axisLockEnabled: false, naturalScroll: false, scrollKey: false, elapsedMs: 16, axisLock: "none",
    left: side === "left" ? { ...still, dx: 40, dy: -12 } : still,
    right: side === "right" ? { ...still, dx: 40, dy: -12 } : still,
} as PointingMotionReport);

// Frames run on fake timers; each overlay canvas gets a stub 2D context that names its side.
const frames = async (ms = 600) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
    drawn.pills = {}; drawn.reticle = {};
    _setWebGLDisabledForTest(true);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
        const side = this.dataset.pointingOverlay;
        if (!side) return null;
        const noop = () => {};
        return { side, setTransform: noop, clearRect: noop } as unknown as CanvasRenderingContext2D;
    } as never);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); _setWebGLDisabledForTest(false); });

const pillsOf = (side: "left" | "right") => document.querySelector(`[data-pointing-overlay=${side}]`)?.getAttribute("data-pills");

describe("Keybard's layout: sniper and boost at both trackballs", () => {
    const keyboard = { kbid: "abc", keymap: [] } as unknown as KeyboardInfo;
    const keys = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 22, y: 8, w: 1, h: 1 }];

    for (const [name, modes, label] of [
        ["boost", { sniper: false, boost: true }, "BOOST ×2"],
        ["sniper", { sniper: true, boost: false }, "SNIPER ×0.33"],
        ["both", { sniper: true, boost: true }, "SNIPER ×0.33 | BOOST ×2"],
    ] as const) {
        it(`${name}: both hands show the pills, and motion on one hand moves or fades neither`, async () => {
            const feed = new ReportFeed();
            Object.assign(live, { feed, ...modes });
            render(<PointingLayer keyboard={keyboard} keys={keys} unitPx={45} />);
            await frames();
            for (const side of ["left", "right"] as const) {
                expect(pillsOf(side)).toBe(label);
                expect(document.querySelector(`[data-pointing-device=${side}]`)?.getAttribute("data-pills")).toBe(label);
            }
            const settled = { ...drawn.pills };
            for (const side of ["left", "right"] as const) {
                expect(settled[side].sniper).toBe(modes.sniper ? 1 : 0);
                expect(settled[side].boost).toBe(modes.boost ? 1 : 0);
                expect(drawn.reticle[side]).toBe(modes.sniper ? 1 : 0);
            }
            // Alternate hands, as Morgan's two-ball use does: nothing moves or fades.
            for (const side of ["left", "right", "left", "right", "left"] as const) {
                act(() => { feed.push(report(side, modes), 16); });
                await frames(50);
                for (const s of ["left", "right"] as const) {
                    expect(pillsOf(s)).toBe(label);
                    expect(drawn.pills[s].sniper).toBe(modes.sniper ? 1 : 0);
                    expect(drawn.pills[s].boost).toBe(modes.boost ? 1 : 0);
                    expect(drawn.reticle[s]).toBe(modes.sniper ? 1 : 0);
                }
            }
        });
    }

    it("with neither on, no hand shows a pill", async () => {
        Object.assign(live, { feed: new ReportFeed(), sniper: false, boost: false });
        render(<PointingLayer keyboard={keyboard} keys={keys} unitPx={45} />);
        await frames();
        expect(pillsOf("left")).toBe("");
        expect(pillsOf("right")).toBe("");
    });
});

describe("Keybard Overlay: sniper and boost at both trackballs", () => {
    const keys = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 22, y: 8, w: 1, h: 1 }];
    for (const showPointing of [true, false]) {
        it(`${showPointing ? "devices shown" : "pills only"}: both hands keep the pills while one hand moves`, async () => {
            const feed = new ReportFeed();
            const modes = { sniper: true, boost: true };
            render(<PointingOverlayLayer keys={keys} pointing={{ left: "trackball", right: "trackball" }} config={{ showPointing, pointingPills: true }} feed={feed} modes={modes} factors={{ sniperDivisor: 3, boostFactor: 2 }} />);
            await frames();
            for (const side of ["left", "right", "right", "left"] as const) {
                act(() => { feed.push(report(side, modes), 16); });
                await frames(50);
                for (const s of ["left", "right"] as const) {
                    expect(pillsOf(s)).toBe("SNIPER ×0.33 | BOOST ×2");
                    expect(drawn.pills[s].sniper).toBe(1);
                    expect(drawn.pills[s].boost).toBe(1);
                }
            }
        });
    }
});
