import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Notice } from "@/components/shared/Notice";
import { SegmentedControl, type SegmentedChangeSource } from "@/components/shared/SegmentedControl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { KeymapResolution } from "../keymap/resolver";
import type { StatusItem } from "../state/controller";
import { AVAILABLE_LESSON_TYPES, type SpeedUnit } from "../state/settings";
import type { LessonType } from "../types";
import { CharCap } from "./CharCap";
import { formatSpeed, LESSON_TYPE_LABELS, pathChips } from "./format";

// Type row and status slot (docs/practice/spec.md §5.2, N-1, N-4): the lesson type control and the
// current type's scope on the left; on the right a fixed-height slot that shows one banner or notice at
// a time, so the text card below never moves when one appears or goes.

interface TypeRowProps {
    type: LessonType;
    scope: string;
    onType: (type: LessonType, source: SegmentedChangeSource) => void;
    onScope: () => void;
    /** Enter on the type control moves focus to the typing surface (§5.2). */
    onEnter: () => void;
    status: ReactNode;
}

export function TypeRow({ type, scope, onType, onScope, onEnter, status }: TypeRowProps) {
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
        }
    };
    return (
        <div className="@container" data-practice-type-row>
            <div className="flex flex-col @min-[900px]:flex-row @min-[900px]:items-center gap-x-4">
                <div className="flex h-10 @min-[900px]:h-12 items-center gap-4 min-w-0">
                    {/* Only the type control sends Enter to the surface; Enter on the scope button opens the panel. */}
                    <div className="contents" onKeyDown={onKeyDown}>
                        <SegmentedControl
                            label="Lesson type"
                            size="md"
                            value={type}
                            onChange={onType}
                            options={AVAILABLE_LESSON_TYPES.map((value) => ({ value, label: LESSON_TYPE_LABELS[value] }))}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onScope}
                        className="text-sm text-muted-foreground hover:text-kb-ink whitespace-nowrap truncate rounded-sm cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        {scope} <span aria-hidden="true">›</span>
                    </button>
                </div>
                <div data-status-slot className="flex h-12 flex-1 min-w-0 items-center" aria-live="polite">
                    {status}
                </div>
            </div>
        </div>
    );
}

/** One line, truncated; the full text in a tooltip when the slot is narrower than the text (§5.2). */
function OneLine({ text, children, className }: { text: string; children?: ReactNode; className?: string }) {
    const ref = useRef<HTMLSpanElement | null>(null);
    const [truncated, setTruncated] = useState(false);
    useLayoutEffect(() => {
        const el = ref.current;
        if (el) setTruncated(el.scrollWidth > el.clientWidth);
    }, [text]);
    const line = <span ref={ref} tabIndex={truncated ? 0 : undefined} className={cn("block min-w-0 truncate", className)}>{children ?? text}</span>;
    if (!truncated) return line;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{line}</TooltipTrigger>
            <TooltipContent side="top">{text}</TooltipContent>
        </Tooltip>
    );
}

const BANNER = "rounded-xl px-3 py-2 bg-kb-surface shadow-lg border border-gray-200 dark:border-neutral-700 text-kb-ink";

interface StatusSlotItemProps {
    item: StatusItem | null;
    resolution: KeymapResolution | null;
    cols: number;
    unit: SpeedUnit;
    layerColorOf: (codePoint: number) => string;
}

/** The slot's content: nothing, a notice card or a floating-card banner. */
export function StatusSlotItem({ item, resolution, cols, unit, layerColorOf }: StatusSlotItemProps) {
    if (!item) return null;
    if (item.kind === "notice") {
        return (
            <Notice compact data-status={item.id} className="max-w-full min-w-0">
                <OneLine text={item.text} />
            </Notice>
        );
    }
    if (item.id === "new-key") {
        const path = resolution?.primary(item.codePoint);
        const chips = path ? pathChips(path, cols) : [];
        return (
            <div role="status" data-status={item.id} className={cn(BANNER, "flex items-center gap-2 max-w-full min-w-0 overflow-hidden motion-safe:animate-in motion-safe:fade-in-0")}>
                <CharCap codePoint={item.codePoint} layerColor={layerColorOf(item.codePoint)} variant="small" />
                <span className="font-semibold whitespace-nowrap">New key</span>
                {chips.map((chip) => <span key={chip} className="px-2 py-0.5 rounded-full bg-kb-gray-medium text-xs whitespace-nowrap">{chip}</span>)}
            </div>
        );
    }
    const title = item.id === "top-speed" ? "New top speed" : "Daily goal reached";
    const value = item.id === "top-speed" ? `${formatSpeed(item.speed, unit)} ${unit}` : `${item.minutes} min`;
    return (
        <div role="status" data-status={item.id} className={cn(BANNER, "flex items-center gap-2 max-w-full min-w-0 overflow-hidden motion-safe:animate-in motion-safe:fade-in-0")}>
            <OneLine text={`${title} ${value}`}>
                <span className="font-semibold">{title}</span>{" "}
                <span className="tabular-nums text-muted-foreground">{value}</span>
            </OneLine>
        </div>
    );
}

export default TypeRow;
