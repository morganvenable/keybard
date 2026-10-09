import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl, type SegmentedChangeSource } from "@/components/shared/SegmentedControl";

// N-1 SegmentedControl (docs/practice/spec.md §5.0.3).

type LessonType = "guided" | "drill" | "words" | "custom";
const OPTIONS = [
    { value: "guided", label: "Guided" },
    { value: "drill", label: "Drill" },
    { value: "words", label: "Words", disabled: true },
    { value: "custom", label: "Custom" },
] as const;

function Harness({ onChange, size }: { onChange?: (value: LessonType, source: SegmentedChangeSource) => void; size?: "sm" | "md" }) {
    const [value, setValue] = useState<LessonType>("guided");
    return (
        <SegmentedControl
            label="Lesson type"
            options={OPTIONS}
            value={value}
            size={size}
            onChange={(next, source) => { setValue(next); onChange?.(next, source); }}
        />
    );
}

const radio = (name: string) => screen.getByRole("radio", { name });

describe("SegmentedControl", () => {
    it("is a named radiogroup with one checked segment and one tab stop", () => {
        render(<Harness />);
        expect(screen.getByRole("radiogroup", { name: "Lesson type" })).toBeInTheDocument();
        expect(radio("Guided")).toHaveAttribute("aria-checked", "true");
        expect(radio("Drill")).toHaveAttribute("aria-checked", "false");
        expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    });

    it("reports a click as a pointer choice and marks the new segment", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(radio("Drill"));
        expect(onChange).toHaveBeenCalledWith("drill", "pointer");
        expect(radio("Drill")).toHaveAttribute("aria-checked", "true");
        expect(radio("Drill")).toHaveClass("bg-kb-active", "text-kb-active-fg");
        expect(radio("Guided")).not.toHaveClass("bg-kb-active");
        expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
    });

    it("does not report a click on the current segment", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(radio("Guided"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("moves with the arrow keys, skipping disabled segments and wrapping, and keeps focus", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        radio("Guided").focus();
        fireEvent.keyDown(radio("Guided"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("drill", "keyboard");
        expect(document.activeElement).toBe(radio("Drill"));
        fireEvent.keyDown(radio("Drill"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith("custom", "keyboard");
        fireEvent.keyDown(radio("Custom"), { key: "ArrowDown" });
        expect(onChange).toHaveBeenLastCalledWith("guided", "keyboard");
        fireEvent.keyDown(radio("Guided"), { key: "ArrowLeft" });
        expect(onChange).toHaveBeenLastCalledWith("custom", "keyboard");
        fireEvent.keyDown(radio("Custom"), { key: "Home" });
        expect(onChange).toHaveBeenLastCalledWith("guided", "keyboard");
        fireEvent.keyDown(radio("Guided"), { key: "End" });
        expect(onChange).toHaveBeenLastCalledWith("custom", "keyboard");
        expect(document.activeElement).toBe(radio("Custom"));
    });

    it("ignores clicks on a disabled segment", () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(radio("Words"));
        expect(onChange).not.toHaveBeenCalled();
        expect(radio("Words")).toHaveAttribute("aria-disabled", "true");
    });

    it("uses OnOffToggle's track and the sm or md segment size", () => {
        const { rerender } = render(<Harness />);
        expect(screen.getByRole("radiogroup")).toHaveClass("bg-gray-100", "dark:bg-neutral-800", "rounded-full", "border");
        expect(radio("Guided")).toHaveClass("px-3", "py-1", "text-[10px]");
        rerender(<Harness size="md" />);
        expect(radio("Guided")).toHaveClass("px-4", "py-1.5", "text-xs");
    });
});
