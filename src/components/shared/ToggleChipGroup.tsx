import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// N-2 ToggleChipGroup (docs/practice/spec.md §5.0.3): a multi-select row of chips in the path-chip shape,
// each a button with aria-pressed (Drill Directions: C N S E W, plus 2S on 6-key clusters). Off chips
// sit on bg-kb-gray-medium, on chips take the ink role (bg-kb-active).
//
// It lives in src/components/shared, not src/components/ui, so the theme guard scans it.

export interface ToggleChipOption<T extends string> {
    value: T;
    label: ReactNode;
    /** Accessible name when the label is short or not plain text ("North"). */
    ariaLabel?: string;
}

interface ToggleChipGroupProps<T extends string> {
    options: readonly ToggleChipOption<T>[];
    value: readonly T[];
    onChange: (value: T[]) => void;
    /** Accessible name of the group (the row title it sits beside). */
    label: string;
    className?: string;
}

export function ToggleChipGroup<T extends string>({ options, value, onChange, label, className }: ToggleChipGroupProps<T>) {
    const toggle = (option: T) => {
        const on = value.includes(option);
        // Keep the options' order, whatever order the chips were pressed in.
        onChange(options.map((o) => o.value).filter((v) => (v === option ? !on : value.includes(v))));
    };
    return (
        <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-1.5", className)}>
            {options.map((option) => {
                const on = value.includes(option.value);
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={on}
                        aria-label={option.ariaLabel}
                        onClick={() => toggle(option.value)}
                        className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                            on ? "bg-kb-active text-kb-active-fg hover:bg-kb-active/80" : "bg-kb-gray-medium text-kb-ink hover:bg-muted",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default ToggleChipGroup;
