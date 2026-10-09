import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// N-3 StatCell (docs/practice/spec.md §5.0.3, §5.2 "Metrics row"): a label, a large value with its unit
// on the same line, and an optional delta led by ▲ or ▼. The glyph carries the direction; deltas are
// never colored (kb-primary and kb-red measure under 4.5:1 at 12 px on the page).

interface StatCellProps {
    label: string;
    value: ReactNode;
    unit?: ReactNode;
    /** Signed change; 0 or null shows nothing. */
    delta?: number | null;
    /** How the delta prints (without its sign). */
    formatDelta?: (abs: number) => string;
    /** Something drawn before the value (the Today ring). */
    lead?: ReactNode;
    /** Grayed placeholder while loading. */
    skeleton?: boolean;
    /** Animates the delta in when a lesson completes. */
    fresh?: boolean;
    className?: string;
}

export function StatCell({ label, value, unit, delta, formatDelta = (v) => v.toFixed(1), lead, skeleton = false, fresh = false, className }: StatCellProps) {
    if (skeleton) {
        return (
            <div className={cn("flex flex-col gap-2", className)} data-stat-skeleton>
                <span className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
                <span className="h-7 w-24 rounded bg-muted motion-safe:animate-pulse" />
            </div>
        );
    }
    const shown = delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.05;
    return (
        <div className={cn("flex flex-col gap-1 min-w-0", className)} data-stat={label}>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="flex items-center gap-2 min-w-0">
                {lead}
                <span className="text-[28px] font-semibold leading-none tabular-nums whitespace-nowrap text-kb-ink">
                    {value}
                    {unit != null && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
                </span>
            </span>
            <span className={cn("h-4 text-xs font-medium text-kb-ink tabular-nums", fresh && shown && "motion-safe:animate-in motion-safe:fade-in-0")}>
                {shown ? `${delta! > 0 ? "▲" : "▼"} ${formatDelta(Math.abs(delta!))}` : ""}
            </span>
        </div>
    );
}

/** N-11 Today ring: progress toward the daily goal, kb-primary on a muted track. */
export function TodayRing({ fraction }: { fraction: number }) {
    const r = 15;
    const c = 2 * Math.PI * r;
    const f = Math.max(0, Math.min(1, fraction));
    return (
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
            {f > 0 && (
                <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-kb-primary"
                    strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 18 18)" />
            )}
        </svg>
    );
}

/** N-8 confidence bar: ink fill on a muted track, min(confidence, 1) wide. */
export function ConfidenceBar({ value, thin = false, className }: { value: number | null; thin?: boolean; className?: string }) {
    const width = Math.max(0, Math.min(1, value ?? 0)) * 100;
    return (
        <span aria-hidden="true" className={cn("block w-full overflow-hidden rounded-full bg-muted", thin ? "h-[3px]" : "h-1.5", className)}>
            <span className="block h-full bg-kb-ink" style={{ width: `${width}%` }} />
        </span>
    );
}

export default StatCell;
