// A custom value the board didn't answer for shows "Not read", never 0 or Off, and can still be written.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomUIControl } from "@/components/CustomUI/controls/CustomUIControl";
import type { CustomUIMenuItem } from "@/types/keyboard.types";

// Radix's slider measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const none = new Map<string, number>();

describe("custom controls whose value wasn't read", () => {
    it("toggle: neither side pressed, says Not read, and either side writes", () => {
        const onValueChange = vi.fn();
        render(<CustomUIControl item={{ label: "Scroll", type: "toggle", content: ["id_scroll", 0, 1] } as CustomUIMenuItem} values={none} onValueChange={onValueChange} />);
        expect(screen.getByText("Not read")).toBeTruthy();
        expect(screen.getByRole("button", { name: "ON" }).getAttribute("aria-pressed")).toBe("false");
        expect(screen.getByRole("button", { name: "OFF" }).getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(screen.getByRole("button", { name: "OFF" }));
        expect(onValueChange).toHaveBeenCalledWith("id_scroll", 0);
    });

    it("range: an empty box that says Not read, and a typed value writes", () => {
        const onValueChange = vi.fn();
        render(<CustomUIControl item={{ label: "Speed", type: "range", options: [0, 100], content: ["id_speed", 0, 2] } as CustomUIMenuItem} values={none} onValueChange={onValueChange} />);
        const box = screen.getByRole("spinbutton", { name: "Speed" }) as HTMLInputElement;
        expect(box.value).toBe("");
        expect(box.placeholder).toBe("Not read");
        expect(screen.getByText("Not read")).toBeTruthy();
        fireEvent.change(box, { target: { value: "0" } });
        fireEvent.blur(box);
        expect(onValueChange).toHaveBeenCalledWith("id_speed", 0);
    });

    it("dropdown: nothing selected, the placeholder says Not read", () => {
        render(<CustomUIControl item={{ label: "DPI", type: "dropdown", options: ["400", "800"], content: ["id_dpi", 0, 3] } as CustomUIMenuItem} values={none} onValueChange={vi.fn()} />);
        expect(screen.getByRole("combobox", { name: "DPI" }).textContent).toBe("Not read");
    });

    it("dropdown: a value outside the options is shown as itself, not as the last option", () => {
        render(<CustomUIControl item={{ label: "DPI", type: "dropdown", options: ["400", "800"], content: ["id_dpi", 0, 3] } as CustomUIMenuItem} values={new Map([["id_dpi", 7]])} onValueChange={vi.fn()} />);
        expect(screen.getByRole("combobox", { name: "DPI" }).textContent).toBe("Value 7");
    });

    it("scan rate: Not read is selected until a rate is chosen", () => {
        const onValueChange = vi.fn();
        render(<CustomUIControl item={{ label: "Key scan rate", type: "range", options: [0, 20000], content: ["id_scan_period_us", 0, 5] } as CustomUIMenuItem} values={none} onValueChange={onValueChange} />);
        const select = screen.getByRole("combobox", { name: "Key scan rate" }) as HTMLSelectElement;
        expect(select.value).toBe("");
        expect(select.selectedOptions[0].textContent).toBe("Not read");
        fireEvent.change(select, { target: { value: "1000" } });
        expect(onValueChange).toHaveBeenCalledWith("id_scan_period_us", 1000);
    });

    it("a read value shows as itself", () => {
        render(<CustomUIControl item={{ label: "Scroll", type: "toggle", content: ["id_scroll", 0, 1] } as CustomUIMenuItem} values={new Map([["id_scroll", 0]])} onValueChange={vi.fn()} />);
        expect(screen.queryByText("Not read")).toBeNull();
        expect(screen.getByRole("button", { name: "OFF" }).getAttribute("aria-pressed")).toBe("true");
    });
});
