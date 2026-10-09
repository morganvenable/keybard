import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ColorField } from "@/components/shared/ColorField";
import { COLOR_FIELD_SWATCHES, HEX_COLOR } from "@/components/shared/color-swatches";

// N-15 Color field (docs/practice/spec.md §5.0.3): swatch trigger, portaled popover with brand swatches,
// white and black, a validated hex input and "More colors…" into Keybard's own picker.

beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

function Harness({ initial = "#dce5ec", onChange = vi.fn() }: { initial?: string; onChange?: (hex: string) => void }) {
    const [value, setValue] = useState(initial);
    return <ColorField label="Outline" value={value} onChange={(hex) => { setValue(hex); onChange(hex); }} />;
}

const open = () => fireEvent.click(screen.getByRole("button", { name: /^Outline color, / }));

describe("ColorField", () => {
    it("shows the color as a swatch whose name carries the hex", () => {
        render(<Harness />);
        const trigger = screen.getByRole("button", { name: "Outline color, #dce5ec" });
        expect(trigger).toHaveStyle({ backgroundColor: "#dce5ec" });
        // A permanent hairline, because the default Outline only colors vanish on the panel.
        expect(trigger.className).toContain("ring-1");
        expect(trigger.className).toContain("ring-kb-ink/50");
        expect(document.querySelector('input[type="color"]')).toBeNull();
    });

    it("offers the brand swatches plus white and black, each named with its hex, and marks the current one", () => {
        render(<Harness initial="#099e7c" />);
        open();
        const popover = screen.getByRole("dialog", { name: "Outline color" });
        const swatches = within(popover).getAllByRole("button", { pressed: undefined }).filter((b) => b.hasAttribute("aria-pressed"));
        expect(swatches).toHaveLength(COLOR_FIELD_SWATCHES.length);
        expect(within(popover).getByRole("button", { name: "Brand green, #099e7c" })).toHaveAttribute("aria-pressed", "true");
        expect(within(popover).getByRole("button", { name: "White, #ffffff" })).toHaveAttribute("aria-pressed", "false");
        expect(within(popover).getByRole("button", { name: "Black, #000000" })).toBeInTheDocument();
        for (const swatch of COLOR_FIELD_SWATCHES) expect(swatch.hex).toMatch(HEX_COLOR);
        // Display names are American English, whatever the layer color keys say.
        expect(within(popover).getByRole("button", { name: "Brand gray, #85929b" })).toBeInTheDocument();
        expect(within(popover).getByRole("button", { name: "Brand light gray, #d8d8d8" })).toBeInTheDocument();
        expect(COLOR_FIELD_SWATCHES.some((swatch) => /grey/i.test(swatch.name))).toBe(false);
    });

    it("picks a swatch and closes", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        open();
        fireEvent.click(screen.getByRole("button", { name: "Brand blue, #379cd7" }));
        expect(onChange).toHaveBeenCalledWith("#379cd7");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.getByRole("button", { name: "Outline color, #379cd7" })).toBeInTheDocument();
    });

    it("accepts only #rrggbb from the hex input and says how to fix it", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        open();
        const input = screen.getByRole("textbox", { name: "Outline color hex" });
        expect(input).toHaveValue("#dce5ec");
        expect(input).not.toHaveAttribute("aria-invalid");

        fireEvent.change(input, { target: { value: "#dce5e" } });
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText("Use #rrggbb")).toBeInTheDocument();
        expect(input).toHaveAccessibleDescription("Use #rrggbb");
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: "#ABCDEF" } });
        expect(onChange).toHaveBeenCalledWith("#abcdef");
        expect(input).not.toHaveAttribute("aria-invalid");
        expect(screen.queryByText("Use #rrggbb")).toBeNull();
    });

    it("opens Keybard's picker for More colors…, with no LED target", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        open();
        fireEvent.click(screen.getByRole("button", { name: /More colors/ }));
        const dialog = screen.getByRole("dialog", { name: "Outline color" });
        expect(within(dialog).queryByRole("button", { name: /LED color/ })).toBeNull();
        expect(within(dialog).getByRole("slider", { name: "Hue" })).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0]).toMatch(HEX_COLOR);
    });
});
