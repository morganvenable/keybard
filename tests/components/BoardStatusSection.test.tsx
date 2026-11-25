// Settings > About > Board status: shown only when the firmware has the status
// report; reads the board when it appears and on Refresh; Copy writes the
// report as plain text.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BoardStatusSection, { BOARD_STATUS_COPY_FAILED, BOARD_STATUS_READ_FAILED } from "../../src/layout/SecondarySidebar/Panels/settings/BoardStatusSection";
import { statusText, type BoardStatus } from "../../src/services/status-report";

const sample = (cpi: number): BoardStatus => ({
    build: "svalboard/either:sval @ x4.6.7", hostOs: 2, macMode: false,
    left: { scroll: false, cpi, autoMouse: true }, right: { scroll: true, cpi: 800, autoMouse: false },
    axisLock: false, naturalScroll: true, autoMouse: true, autoMouseTimeoutMs: 500,
    boostHeld: [0, 0, 0], boostToggled: [false, false, false], boostMult: 1,
    hwRevB: false, opticalDebounce: true, storageReset: false, writeFailed: false,
    prewaitUs: 90, postwaitUs: 90, periodUs: 0, idlePeriodMs: 0, idleAfterMs: 0, deepPeriodMs: 0, deepAfterS: 0,
    frameUs: 412, ledUs: 120, stage: 0, idleFlags: 0, deepMhz: 48, clockMhz: 125,
});

const mocks = vi.hoisted(() => ({
    keyboard: { feature_flags5: 0x02 } as { feature_flags5: number },
    connected: true,
    reads: 0,
    fail: false,
}));

vi.mock("@/contexts/KeyboardContext", () => ({ useKeyboard: () => ({ keyboard: mocks.keyboard, isConnected: mocks.connected }) }));
vi.mock("@/services/keyboard.service", () => ({
    keyboardService: {
        hasStatusReport: (kb: { feature_flags5?: number } | null) => ((kb?.feature_flags5 ?? 0) & 0x02) !== 0,
        readStatusReport: async () => {
            mocks.reads++;
            return mocks.fail ? null : sample(mocks.reads === 1 ? 1200 : 1600);
        },
    },
}));

beforeEach(() => {
    mocks.keyboard = { feature_flags5: 0x02 };
    mocks.connected = true;
    mocks.reads = 0;
    mocks.fail = false;
});

describe("BoardStatusSection", () => {
    it("is not shown on firmware without the command, or with no board", () => {
        mocks.keyboard = { feature_flags5: 0x01 };
        const { container, rerender } = render(<BoardStatusSection />);
        expect(container.innerHTML).toBe("");
        mocks.keyboard = { feature_flags5: 0x02 };
        mocks.connected = false;
        rerender(<BoardStatusSection />);
        expect(container.innerHTML).toBe("");
        expect(mocks.reads).toBe(0);
    });

    it("reads the board when shown, as grouped rows, and Refresh reads it again", async () => {
        render(<BoardStatusSection />);
        expect(await screen.findByText("1200")).toBeTruthy();
        expect(screen.getByRole("region", { name: "Pointing" })).toBeTruthy();
        expect(screen.getByText("Windows")).toBeTruthy();
        fireEvent.click(screen.getByTestId("board-status-refresh"));
        expect(await screen.findByText("1600")).toBeTruthy();
        expect(mocks.reads).toBe(2);
    });

    it("copies the report as plain text", async () => {
        const writeText = vi.fn(async () => {});
        Object.assign(navigator, { clipboard: { writeText } });
        render(<BoardStatusSection />);
        await screen.findByText("1200");
        fireEvent.click(screen.getByTestId("board-status-copy"));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(statusText(sample(1200))));
        expect(await screen.findByText("Copied")).toBeTruthy();
    });

    it("says when the copy or the read fails", async () => {
        Object.assign(navigator, { clipboard: { writeText: async () => { throw new Error("denied"); } } });
        render(<BoardStatusSection />);
        await screen.findByText("1200");
        fireEvent.click(screen.getByTestId("board-status-copy"));
        expect(await screen.findByText(BOARD_STATUS_COPY_FAILED)).toBeTruthy();
        mocks.fail = true;
        fireEvent.click(screen.getByTestId("board-status-refresh"));
        expect(await screen.findByText(BOARD_STATUS_READ_FAILED)).toBeTruthy();
        // The last good report stays.
        expect(screen.getByText("1200")).toBeTruthy();
    });
});
