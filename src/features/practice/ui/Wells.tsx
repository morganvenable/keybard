import type { ReactNode } from "react";
import { Eye, EyeOff, EyeClosed, Keyboard, RotateCcw } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Hints } from "../state/settings";

// Empty and error wells (docs/practice/spec.md §5.3) and the floating tool buttons (§5.2), in Keybard's
// existing idioms: the dashed connect well (ConnectKeyboard) and Matrix Tester's floating buttons.

export const WELL = "p-10 w-full max-w-xl mx-auto rounded-md border-dashed border-1 border-gray-300 dark:border-neutral-600 flex flex-col items-center gap-4 text-center";

export function Well({ title, children, label }: { title: string; children?: ReactNode; label?: string }) {
    return (
        <section aria-label={label ?? title} className={WELL} data-practice-well={title}>
            <h2 className="text-base font-semibold text-kb-ink">{title}</h2>
            {children && <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>}
        </section>
    );
}

const TOOL = "w-12 h-12 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 bg-kb-surface shadow-lg flex items-center justify-center text-kb-ink transition-colors border border-gray-200 dark:border-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const HINT_NEXT: Record<Hints, Hints> = { "next-cluster": "next", next: "off", off: "next-cluster" };
const HINT_LABEL: Record<Hints, string> = { "next-cluster": "Hints: next key and cluster", next: "Hints: next key", off: "Hints: off" };

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button type="button" aria-label={label} className={TOOL} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
}

interface FloatingToolsProps {
    hints: Hints;
    onHints: (hints: Hints) => void;
    onRestart: () => void;
    /** Only when the board is hidden at narrow widths. */
    onBoard?: () => void;
    boardShown?: boolean;
    className?: string;
}

/** Restart lesson, Hints (cycles next key + cluster → next key → off) and, when hidden, Board. */
export function FloatingTools({ hints, onHints, onRestart, onBoard, boardShown, className }: FloatingToolsProps) {
    const HintIcon = hints === "off" ? EyeOff : hints === "next" ? EyeClosed : Eye;
    return (
        <div className={cn("flex gap-2", className)} data-practice-tools>
            {onBoard && (
                <Tool label={boardShown ? "Hide board" : "Show board"} onClick={onBoard}><Keyboard aria-hidden="true" className="h-5 w-5" /></Tool>
            )}
            <Tool label="Restart lesson" onClick={onRestart}><RotateCcw aria-hidden="true" className="h-5 w-5" /></Tool>
            <Tool label={HINT_LABEL[hints]} onClick={() => onHints(HINT_NEXT[hints])}><HintIcon aria-hidden="true" className="h-5 w-5" /></Tool>
        </div>
    );
}
