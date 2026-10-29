// useTypingPause: on while the tester is open and in front of you, renewed,
// and off the moment the window loses focus or the tab is hidden.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTypingPause } from "@/hooks/useTypingPause";
import { keyboardService } from "@/services/keyboard.service";
import { TYPING_PAUSE_OFF, TYPING_PAUSE_ON, TYPING_PAUSE_RENEW_MS } from "@/services/typing-pause";

describe("useTypingPause", () => {
    let ops: number[];

    beforeEach(() => {
        vi.useFakeTimers();
        ops = [];
        vi.spyOn(keyboardService, "typingPause").mockImplementation(async (op: number) => {
            ops.push(op);
            return null;
        });
        vi.spyOn(document, "hasFocus").mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("sends on at once and renews it", () => {
        renderHook(() => useTypingPause(true));
        expect(ops).toEqual([TYPING_PAUSE_ON]);
        act(() => { vi.advanceTimersByTime(TYPING_PAUSE_RENEW_MS * 3); });
        expect(ops.filter((op) => op === TYPING_PAUSE_ON).length).toBeGreaterThanOrEqual(4);
        expect(ops).not.toContain(TYPING_PAUSE_OFF);
    });

    it("blur sends off immediately and stops renewing; focus turns it back on", () => {
        renderHook(() => useTypingPause(true));
        ops.length = 0;
        act(() => { window.dispatchEvent(new Event("blur")); });
        expect(ops).toEqual([TYPING_PAUSE_OFF]);
        act(() => { vi.advanceTimersByTime(TYPING_PAUSE_RENEW_MS * 4); });
        expect(ops).toEqual([TYPING_PAUSE_OFF]); // no renew while unfocused
        act(() => { window.dispatchEvent(new Event("focus")); });
        expect(ops).toEqual([TYPING_PAUSE_OFF, TYPING_PAUSE_ON]);
    });

    it("a hidden tab sends off", () => {
        renderHook(() => useTypingPause(true));
        ops.length = 0;
        const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        act(() => { document.dispatchEvent(new Event("visibilitychange")); });
        expect(ops).toEqual([TYPING_PAUSE_OFF]);
        act(() => { vi.advanceTimersByTime(TYPING_PAUSE_RENEW_MS * 2); });
        expect(ops).toEqual([TYPING_PAUSE_OFF]);
        visibility.mockReturnValue("visible");
        act(() => { document.dispatchEvent(new Event("visibilitychange")); });
        expect(ops.at(-1)).toBe(TYPING_PAUSE_ON);
    });

    it("closing sends off; inactive sends nothing", () => {
        const { unmount } = renderHook(() => useTypingPause(true));
        unmount();
        expect(ops.at(-1)).toBe(TYPING_PAUSE_OFF);
        ops.length = 0;
        renderHook(() => useTypingPause(false));
        act(() => { vi.advanceTimersByTime(2000); });
        expect(ops).toEqual([]);
    });
});
