import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AutoMouseLayersDialog, AutoMouseLayersSetting } from "@/layout/SecondarySidebar/Panels/pointing/AutoMouseLayers";
import { AUTOMOUSE_LAYER_MASK_KEY, AUTOMOUSE_LAYERS_ONLY_KEY } from "@/utils/automouse-layers";
import type { KeyboardInfo } from "@/types/keyboard.types";

const keyboard = { layers: 16, svil_proto: 3 } as unknown as KeyboardInfo;
const pill = (layer: number) => document.querySelector(`[data-automouse-dialog] [data-layer="${layer}"], [data-automouse-pills] [data-layer="${layer}"]`) as HTMLButtonElement;

describe("AutoMouseLayersDialog", () => {
    it("shows one pill per layer but the mouse layer, marks the off ones, and returns the mask on Done", () => {
        const onDone = vi.fn();
        render(<AutoMouseLayersDialog open keyboard={keyboard} mask={0b100} onDone={onDone} onCancel={() => {}} />);
        expect(document.querySelectorAll("[data-layer]")).toHaveLength(15);
        expect(pill(15)).toBeNull();
        expect(pill(2).getAttribute("aria-pressed")).toBe("true");
        expect(pill(1).getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(pill(1));
        fireEvent.click(pill(2));
        fireEvent.click(pill(14));
        expect(screen.getByText("Auto Mouse is off on 2 layers.")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(onDone).toHaveBeenCalledWith(0b10 | (1 << 14));
    });
    it("Cancel returns nothing", () => {
        const onDone = vi.fn();
        const onCancel = vi.fn();
        render(<AutoMouseLayersDialog open keyboard={keyboard} mask={0} onDone={onDone} onCancel={onCancel} />);
        fireEvent.click(pill(3));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancel).toHaveBeenCalled();
        expect(onDone).not.toHaveBeenCalled();
    });
});

describe("AutoMouseLayersSetting", () => {
    const choose = () => document.querySelector("[data-automouse-choose]") as HTMLButtonElement;
    it("Everywhere: Choose Layers on the same row, disabled, no pill line; Only on Selected Layers writes the mode", () => {
        const set = vi.fn();
        render(<AutoMouseLayersSetting keyboard={keyboard} values={new Map([[AUTOMOUSE_LAYERS_ONLY_KEY, 0], [AUTOMOUSE_LAYER_MASK_KEY, 0]])} set={set} />);
        expect(document.querySelector("[data-row='Auto Mouse Layer']")?.contains(choose())).toBe(true);
        expect(choose().disabled).toBe(true);
        expect(document.querySelector("[data-automouse-summary]")).toBeNull();
        expect(screen.queryByText("Off on Layers")).toBeNull();
        fireEvent.click(screen.getByRole("radio", { name: "Only on Selected Layers" }));
        expect(set).toHaveBeenCalledWith(AUTOMOUSE_LAYERS_ONLY_KEY, 1);
    });
    it("Only on Selected Layers: the pill line marks the off layers and the picked mask is written once", () => {
        const set = vi.fn();
        render(<AutoMouseLayersSetting keyboard={keyboard} values={new Map([[AUTOMOUSE_LAYERS_ONLY_KEY, 1], [AUTOMOUSE_LAYER_MASK_KEY, 0b1001]])} set={set} />);
        const summary = document.querySelector("[data-automouse-summary]") as HTMLElement;
        expect(summary.querySelectorAll("[data-layer]")).toHaveLength(15);
        expect(Array.from(summary.querySelectorAll("[data-off='1']")).map((e) => e.getAttribute("data-layer"))).toEqual(["0", "3"]);
        expect(choose().disabled).toBe(false);
        fireEvent.click(choose());
        fireEvent.click(pill(5));
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(AUTOMOUSE_LAYER_MASK_KEY, 0b101001);
    });
    it("clicking the pill line opens the picker", () => {
        render(<AutoMouseLayersSetting keyboard={keyboard} values={new Map([[AUTOMOUSE_LAYERS_ONLY_KEY, 1], [AUTOMOUSE_LAYER_MASK_KEY, 0]])} set={vi.fn()} />);
        fireEvent.click(document.querySelector("[data-automouse-summary]") as HTMLElement);
        expect(document.querySelector("[data-automouse-dialog]")).not.toBeNull();
    });
});
