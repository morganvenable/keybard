import { ChevronRight, ExternalLink } from "lucide-react";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";

import { Slider } from "@/components/ui/slider";
import { KEYBARD_SOURCE_URL, KEYBR_SOURCE_URL, SVALBR_URL } from "@/constants/license";
import { cn } from "@/lib/utils";
import { POPOVER_CLASSES } from "./KeyPopover";

// Setting rows for the Lesson and Progress panels (docs/practice/spec.md §5.5, §5.9), in the Settings
// panel's row idiom: a title (and a value line), the control at the right.

export function GroupLabel({ children, id }: { children: ReactNode; id?: string }) {
    return <h3 id={id} className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">{children}</h3>;
}

export function Row({ title, value, children, className, titleId }: { title: ReactNode; value?: ReactNode; children?: ReactNode; className?: string; titleId?: string }) {
    return (
        <div className={cn("flex flex-row flex-wrap items-center justify-between p-3 gap-3 panel-layer-item", className)}>
            <div className="flex flex-col items-start gap-1 flex-1 basis-40 min-w-0">
                <span id={titleId} className="text-md text-left">{title}</span>
                {value && <span className="text-xs text-muted-foreground">{value}</span>}
            </div>
            {children}
        </div>
    );
}

export function SliderRow({ title, display, value, min, max, step = 1, onChange }: { title: string; display: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
    return (
        <div className="flex flex-col gap-3 p-3 panel-layer-item">
            <div className="flex items-center justify-between gap-3">
                <span className="text-md text-left">{title}</span>
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">{display}</span>
            </div>
            <Slider aria-label={title} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
        </div>
    );
}

/** A clickable row with a value and `›` (OS layout, Custom text). */
export function ClickRow({ title, value, onClick }: { title: string; value?: ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full flex-row items-center justify-between p-3 gap-3 panel-layer-item text-left cursor-pointer hover:bg-muted/60 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            <span className="text-md">{title}</span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
                <span className="truncate">{value}</span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </span>
        </button>
    );
}

/**
 * About row (§1.5, §5.5): the attribution keybr.com's license asks for. Opens a popover with the two
 * source links and the license line.
 */
export function AboutRow() {
    const link = "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm underline underline-offset-4 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="flex w-full flex-row items-center justify-between p-3 gap-3 panel-layer-item text-left cursor-pointer hover:bg-muted/60 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <span className="text-md">Based on keybr.com and River's svalbr</span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content aria-label="Based on keybr.com" side="top" align="start" sideOffset={8} collisionPadding={12} className={cn(POPOVER_CLASSES, "flex flex-col gap-1")}>
                    <h2 className="px-3 pb-1 text-base font-semibold">Based on keybr.com</h2>
                    <a className={link} href={KEYBR_SOURCE_URL} target="_blank" rel="noreferrer">keybr.com source<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a>
                    <a className={link} href={SVALBR_URL} target="_blank" rel="noreferrer">svalbr by River<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a>
                    <p className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span>Practice is licensed AGPL-3.0</span>
                        <a className="underline underline-offset-4" href={KEYBARD_SOURCE_URL} target="_blank" rel="noreferrer">Source</a>
                    </p>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

/** Panel footer (§5.5 panel states): Saving… while a slider change waits, or the storage error. */
export function PanelFooter({ saving, error }: { saving: boolean; error: boolean }) {
    if (!saving && !error) return null;
    return (
        <div role="status" className={cn("px-3 pt-3 text-xs", error ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
            {error ? "Settings couldn't be saved" : "Saving…"}
        </div>
    );
}
