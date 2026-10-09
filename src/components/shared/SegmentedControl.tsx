import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// N-1 SegmentedControl (docs/practice/spec.md §5.0.3): an n-way single choice with OnOffToggle's track
// and segment look, for choices whose labels aren't ON and OFF (Guided · Drill · Words · Custom,
// WPM · CPM, Both · Left · Right, Light · Dark · Busy). A radiogroup with one tab stop; the arrow keys,
// Home and End move the choice, as for native radio buttons.
//
// It lives in src/components/shared, not src/components/ui, so the theme guard scans it.

export interface SegmentedOption<T extends string> {
    value: T;
    label: ReactNode;
    /** Accessible name when the label isn't plain text. */
    ariaLabel?: string;
    disabled?: boolean;
}

/** How the choice was made: Practice returns focus to the typing surface after a pointer choice only. */
export type SegmentedChangeSource = "pointer" | "keyboard";

interface SegmentedControlProps<T extends string> {
    options: readonly SegmentedOption<T>[];
    value: T;
    onChange: (value: T, source: SegmentedChangeSource) => void;
    /** Accessible name of the group (the row title it sits beside). */
    label: string;
    /** sm in setting rows; md for the lesson type on the page. */
    size?: "sm" | "md";
    /** Segments share the full width (narrow layouts). */
    fullWidth?: boolean;
    disabled?: boolean;
    className?: string;
}

const SEGMENT_SIZE = {
    sm: "px-3 py-1 text-[10px]",
    md: "px-4 py-1.5 text-xs",
} as const;

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    label,
    size = "sm",
    fullWidth = false,
    disabled = false,
    className,
}: SegmentedControlProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const enabled = (index: number) => !disabled && !options[index]?.disabled;
    const selectedIndex = options.findIndex((option) => option.value === value);
    // One tab stop: the selected segment, or the first enabled one when nothing matches.
    const tabStop = selectedIndex >= 0 && enabled(selectedIndex) ? selectedIndex : options.findIndex((_, i) => enabled(i));

    const choose = (index: number, source: SegmentedChangeSource) => {
        if (!enabled(index)) return;
        if (source === "keyboard") refs.current[index]?.focus();
        if (options[index].value !== value) onChange(options[index].value, source);
    };

    const step = (from: number, direction: 1 | -1): number => {
        for (let n = 1; n <= options.length; n++) {
            const index = (from + direction * n + options.length) % options.length;
            if (enabled(index)) return index;
        }
        return from;
    };

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next: number | null = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = step(index, 1);
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = step(index, -1);
        else if (event.key === "Home") next = step(-1 + options.length, 1);
        else if (event.key === "End") next = step(0, -1);
        if (next === null) return;
        event.preventDefault();
        choose(next, "keyboard");
    };

    return (
        <div
            role="radiogroup"
            aria-label={label}
            aria-disabled={disabled || undefined}
            className={cn(
                "flex flex-row items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-0.5 border border-gray-200 dark:border-neutral-500",
                fullWidth ? "w-full" : "w-fit",
                className,
            )}
        >
            {options.map((option, index) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        ref={(node) => { refs.current[index] = node; }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={option.ariaLabel}
                        aria-disabled={!enabled(index) || undefined}
                        tabIndex={index === tabStop ? 0 : -1}
                        onClick={() => choose(index, "pointer")}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 uppercase tracking-wide rounded-full transition-all font-bold whitespace-nowrap",
                            SEGMENT_SIZE[size],
                            fullWidth && "flex-1 text-center",
                            selected
                                ? "bg-kb-active text-kb-active-fg shadow-sm"
                                : "text-gray-500 hover:text-kb-ink dark:text-neutral-400 dark:hover:text-kb-ink",
                            !enabled(index) && "opacity-50 cursor-not-allowed hover:text-gray-500 dark:hover:text-neutral-400",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default SegmentedControl;
