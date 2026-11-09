import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/contexts/KeyboardContext", () => ({
    useKeyboard: () => ({ isConnected: true, connect: vi.fn(), keyboard: { id: "kb" } }),
}));
vi.mock("@/services/keyboard.service", () => ({
    keyboardService: {
        hasPointingSensor: () => true,
        getPointingSensorSamples: vi.fn(async () => { reads.count++; return null; }),
    },
}));

import TrackballSensorDialog from "@/components/trackball-sensor/TrackballSensorDialog";
import { closeTrackballSensor, openTrackballSensor } from "@/components/trackball-sensor/trackball-open";
import { closeTouchpadTuning, openTouchpadTuning, useTouchpadTuningOpen } from "@/components/touchpad-tuning/tuning-open";

describe("Trackball sensor dialog", () => {
    beforeEach(() => { vi.useFakeTimers(); reads.count = 0; });
    afterEach(() => { closeTrackballSensor(); cleanup(); vi.useRealTimers(); });

    it("is a modal dialog that mounts the sensor view only while open", async () => {
        render(<div data-testid="settings-stays"><TrackballSensorDialog /></div>);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByTestId("trackball-panel")).toBeNull();
        act(() => openTrackballSensor());
        expect(screen.getByRole("dialog")).toBeTruthy();
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(reads.count).toBeGreaterThan(0);
        // The page behind it is untouched.
        expect(screen.getByTestId("settings-stays")).toBeTruthy();
    });

    it("stops polling the board on close", async () => {
        render(<TrackballSensorDialog />);
        act(() => openTrackballSensor());
        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        act(() => closeTrackballSensor());
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        const after = reads.count;
        await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
        expect(reads.count).toBe(after);
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});

describe("Opened from outside Settings", () => {
    afterEach(() => { closeTrackballSensor(); cleanup(); });

    it("any caller opens it over whatever panel is showing, and the panel is untouched on close", () => {
        const scroller = { current: null as HTMLDivElement | null };
        render(
            <>
                <div data-testid="other-panel" ref={(e) => { scroller.current = e; }} style={{ overflow: "auto", height: 50 }}>
                    <button onClick={openTrackballSensor}>Pointing Devices opener</button>
                    <div style={{ height: 500 }} />
                </div>
                <TrackballSensorDialog />
            </>,
        );
        scroller.current!.scrollTop = 120;
        act(() => { screen.getByText("Pointing Devices opener").click(); });
        expect(screen.getByRole("dialog")).toBeTruthy();
        act(() => closeTrackballSensor());
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.getByTestId("other-panel")).toBeTruthy();
        expect(scroller.current!.scrollTop).toBe(120);
    });
});

describe("Touchpad tuning open state (regression)", () => {
    it("opens and closes without touching anything else", () => {
        const Probe = () => <span data-testid="p">{String(useTouchpadTuningOpen())}</span>;
        render(<Probe />);
        act(() => openTouchpadTuning());
        expect(screen.getByTestId("p").textContent).toBe("true");
        act(() => closeTouchpadTuning());
        expect(screen.getByTestId("p").textContent).toBe("false");
    });
});
