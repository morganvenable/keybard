import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Notice card (docs/practice/spec.md §5.0 "Notices and banners"): one line, the EditingTargetStatus
// look. "notice" is amber text on the surface (warnings, an available update); "error" is the red role
// (an error the user can act on). An optional action sits at the end of the line.
//
// `compact` is the same card with px-3 py-2 for Practice's status slot (N-4): the slot is h-12, and a
// p-3 card with a 20 px line is 46 px tall, which leaves no room for its shadow. Its text never wraps
// (the slot truncates it and shows the full text in a tooltip).

const TONE = {
    notice: "border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300",
    error: "border-red-200 dark:border-red-900 text-red-700 dark:text-red-400",
} as const;

interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "role"> {
    tone?: keyof typeof TONE;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
    compact?: boolean;
}

export function Notice({ tone = "notice", children, action, className, compact = false, ...rest }: NoticeProps) {
    return (
        <div
            {...rest}
            role={tone === "error" ? "alert" : "status"}
            className={cn(
                "flex items-center gap-3 rounded-md border bg-kb-surface text-sm shadow-sm",
                compact ? "flex-nowrap px-3 py-2" : "flex-wrap p-3",
                TONE[tone],
                className,
            )}
        >
            <span className={cn("min-w-0 flex-1", !compact && "[overflow-wrap:anywhere]")}>{children}</span>
            {action}
        </div>
    );
}

export default Notice;
