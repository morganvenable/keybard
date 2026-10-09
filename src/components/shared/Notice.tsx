import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Notice card (docs/practice/spec.md §5.0 "Notices and banners"): one line, the EditingTargetStatus
// look. "notice" is amber text on the surface (warnings, an available update); "error" is the red role
// (an error the user can act on). An optional action sits at the end of the line.

const TONE = {
    notice: "border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300",
    error: "border-red-200 dark:border-red-900 text-red-700 dark:text-red-400",
} as const;

interface NoticeProps {
    tone?: keyof typeof TONE;
    children: ReactNode;
    action?: ReactNode;
    className?: string;
}

export function Notice({ tone = "notice", children, action, className }: NoticeProps) {
    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            className={cn("flex flex-wrap items-center gap-3 rounded-md border bg-kb-surface p-3 text-sm shadow-sm", TONE[tone], className)}
        >
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
            {action}
        </div>
    );
}

export default Notice;
