import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOMOUSE_MASK_WRITE_DELAY_MS, AutoMouseLayersSetting } from "@/layout/SecondarySidebar/Panels/pointing/AutoMouseLayers";
import { AUTOMOUSE_LAYER_MASK_KEY, AUTOMOUSE_LAYERS_ONLY_KEY } from "@/utils/automouse-layers";
import type { KeyboardInfo } from "@/types/keyboard.types";

const keyboard = { layers: 16, svil_proto: 3 } as unknown as KeyboardInfo;
const pill = (layer: number) => document.querySelector(`[data-automouse-pills] [data-layer="${layer}"]`) as HTMLButtonElement;
const vals = (mode: number, mask: number) => new Map([[AUTOMOUSE_LAYERS_ONLY_KEY, mode], [AUTOMOUSE_LAYER_MASK_KEY, mask]]);

describe("AutoMouseLayersSetting", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("Everywhere: no pills, no Choose Layers, no dialog; Only on Selected Layers writes the mode", () => {
        const set = vi.fn();
        render(<AutoMouseLayersSetting keyboard={keyboard} values={vals(0, 0b10)} set={set} />);
        expect(document.querySelector("[data-automouse-pills]")).toBeNull();
        expect(screen.queryByRole("button", { name: /Choose Layers/ })).toBeNull();
        expect(document.querySelector("[data-automouse-dialog]")).toBeNull();
        fireEvent.click(screen.getByRole("radio", { name: "Only on Selected Layers" }));
        expect(set).toHaveBeenCalledWith(AUTOMOUSE_LAYERS_ONLY_KEY, 1);
        expect(set).toHaveBeenCalledTimes(1);
    });

    it("Only on Selected Layers: one pill button per layer but the mouse layer, aria-pressed for the off ones", () => {
        render(<AutoMouseLayersSetting keyboard={keyboard} values={vals(1, 0b1001)} set={vi.fn()} />);
        expect(document.querySelectorAll("[data-automouse-pills] button[data-layer]")).toHaveLength(15);
        expect(pill(15)).toBeNull();
        expect(pill(0).getAttribute("aria-pressed")).toBe("true");
        expect(pill(1).getAttribute("aria-pressed")).toBe("false");
        expect(screen.getByRole("button", { name: "Layer 3: Auto Mouse off" })).toBe(pill(3));
        expect(screen.getByRole("button", { name: "Layer 1: Auto Mouse on" })).toBe(pill(1));
    });

    it("each click toggles at once; a burst writes the final mask once", () => {
        const set = vi.fn();
        render(<AutoMouseLayersSetting keyboard={keyboard} values={vals(1, 0)} set={set} />);
        fireEvent.click(pill(1));
        expect(pill(1).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(pill(3));
        fireEvent.click(pill(5));
        fireEvent.click(pill(5));
        expect(pill(5).getAttribute("aria-pressed")).toBe("false");
        expect(set).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(AUTOMOUSE_MASK_WRITE_DELAY_MS); });
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(AUTOMOUSE_LAYER_MASK_KEY, 0b1010);
    });

    it("a click back to the board's mask writes nothing", () => {
        const set = vi.fn();
        render(<AutoMouseLayersSetting keyboard={keyboard} values={vals(1, 0b100)} set={set} />);
        fireEvent.click(pill(2));
        fireEvent.click(pill(2));
        act(() => { vi.advanceTimersByTime(AUTOMOUSE_MASK_WRITE_DELAY_MS * 2); });
        expect(set).not.toHaveBeenCalled();
    });

    it("leaving before the delay still writes the last click", () => {
        const set = vi.fn();
        const { unmount } = render(<AutoMouseLayersSetting keyboard={keyboard} values={vals(1, 0)} set={set} />);
        fireEvent.click(pill(4));
        unmount();
        expect(set).toHaveBeenCalledWith(AUTOMOUSE_LAYER_MASK_KEY, 0b10000);
    });

    it("Everywhere hides the pills and keeps the mask; back shows the same layers", () => {
        const set = vi.fn();
        const { rerender } = render(<AutoMouseLayersSetting keyboard={keyboard} values={vals(1, 0b110)} set={set} />);
        fireEvent.click(screen.getByRole("radio", { name: "Everywhere" }));
        expect(set).toHaveBeenCalledWith(AUTOMOUSE_LAYERS_ONLY_KEY, 0);
        rerender(<AutoMouseLayersSetting keyboard={keyboard} values={vals(0, 0b110)} set={set} />);
        expect(document.querySelector("[data-automouse-pills]")).toBeNull();
        expect(set).not.toHaveBeenCalledWith(AUTOMOUSE_LAYER_MASK_KEY, expect.anything());
        rerender(<AutoMouseLayersSetting keyboard={keyboard} values={vals(1, 0b110)} set={set} />);
        const offs = Array.from(document.querySelectorAll("[data-automouse-pills] [aria-pressed='true']")).map((e) => e.getAttribute("data-layer"));
        expect(offs).toEqual(["1", "2"]);
    });
});
