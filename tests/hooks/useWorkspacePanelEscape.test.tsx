import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { shouldPanelHandleEscape, useWorkspacePanelEscape } from "@/hooks/useWorkspacePanelEscape";

// Esc in the Practice and Overlay panels (docs/practice/spec.md §4.1 "Close, focus and Esc", §9.9).

beforeAll(() => {
    // Radix Select measures and captures the pointer; jsdom has neither.
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => undefined;
    Element.prototype.scrollIntoView ??= () => undefined;
});

afterEach(() => vi.unstubAllGlobals());

function Panel({ onClose }: { onClose: () => void }) {
    const onKeyDown = useWorkspacePanelEscape(onClose);
    return (
        <aside tabIndex={-1} aria-label="Overlay" onKeyDown={onKeyDown}>
            <Select defaultValue="outline">
                <SelectTrigger aria-label="Preset"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="outline">Outline only</SelectItem>
                    <SelectItem value="solid">Solid</SelectItem>
                </SelectContent>
            </Select>
            <input aria-label="Hex" defaultValue="#dce5ec" />
            <input aria-label="Opacity" type="range" defaultValue={50} />
            <button type="button">Reset</button>
        </aside>
    );
}

describe("useWorkspacePanelEscape", () => {
    it("closes the panel from the panel root and from plain controls", () => {
        const onClose = vi.fn();
        render(<Panel onClose={onClose} />);
        fireEvent.keyDown(screen.getByRole("complementary", { name: "Overlay" }), { key: "Escape" });
        fireEvent.keyDown(screen.getByRole("button", { name: "Reset" }), { key: "Escape" });
        fireEvent.keyDown(screen.getByRole("slider", { name: "Opacity" }), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it("ignores other keys and text being edited", () => {
        const onClose = vi.fn();
        render(<Panel onClose={onClose} />);
        fireEvent.keyDown(screen.getByRole("button", { name: "Reset" }), { key: "Enter" });
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Hex" }), { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();
    });

    it("one Esc on an open select closes only the select; a second closes the panel", async () => {
        vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
        const onClose = vi.fn();
        render(<Panel onClose={onClose} />);
        const trigger = screen.getByRole("combobox", { name: "Preset" });
        trigger.focus();
        await act(async () => { fireEvent.keyDown(trigger, { key: "ArrowDown" }); });
        const option = await screen.findByRole("option", { name: "Solid" });
        // Focus is in the portaled list, which React still bubbles to the panel's onKeyDown.
        expect(screen.getByRole("listbox")).toContainElement(document.activeElement as HTMLElement);
        expect(option).toBeInTheDocument();

        await act(async () => { fireEvent.keyDown(document.activeElement!, { key: "Escape" }); });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

        fireEvent.keyDown(document.activeElement && document.activeElement !== document.body ? document.activeElement : trigger, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe("shouldPanelHandleEscape", () => {
    const event = (target: EventTarget | null, init: { key?: string; defaultPrevented?: boolean } = {}) =>
        ({ key: init.key ?? "Escape", defaultPrevented: init.defaultPrevented ?? false, target });

    it("yields when a layer already handled Esc", () => {
        expect(shouldPanelHandleEscape(event(document.body, { defaultPrevented: true }))).toBe(false);
    });

    it("yields inside open lists, popovers, dialogs and menus, and on an open trigger", () => {
        for (const role of ["listbox", "dialog", "alertdialog", "menu"]) {
            const layer = document.createElement("div");
            layer.setAttribute("role", role);
            const inner = layer.appendChild(document.createElement("button"));
            expect(shouldPanelHandleEscape(event(inner))).toBe(false);
        }
        const trigger = document.createElement("button");
        trigger.setAttribute("role", "combobox");
        trigger.setAttribute("aria-expanded", "true");
        expect(shouldPanelHandleEscape(event(trigger))).toBe(false);
        trigger.setAttribute("aria-expanded", "false");
        expect(shouldPanelHandleEscape(event(trigger))).toBe(true);
    });

    it("still closes from inside an expanded accordion (data-state=open is not a layer)", () => {
        const section = document.createElement("div");
        section.dataset.state = "open";
        const button = section.appendChild(document.createElement("button"));
        expect(shouldPanelHandleEscape(event(button))).toBe(true);
    });

    it("lets read-only and non-text inputs close the panel", () => {
        const readOnly = document.createElement("input");
        readOnly.readOnly = true;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        const area = document.createElement("textarea");
        expect(shouldPanelHandleEscape(event(readOnly))).toBe(true);
        expect(shouldPanelHandleEscape(event(checkbox))).toBe(true);
        expect(shouldPanelHandleEscape(event(area))).toBe(false);
    });
});
