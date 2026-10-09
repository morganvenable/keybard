import { useId, type ReactNode } from "react";
import { Popover } from "radix-ui";

import { PILL_INK } from "@/components/shared/pills";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KeymapResolution } from "../keymap/resolver";
import type { CharacterStats } from "../state/progressView";
import type { SpeedUnit } from "../state/settings";
import { CharCap } from "./CharCap";
import { alternativeText, formatPercent, formatSpeed, pathChips } from "./format";
import { ConfidenceBar, StatCell } from "./StatCell";

// P5 Key detail popover (docs/practice/spec.md §5.7): the header (cap, character, path chips,
// alternatives, Delayed output), the stats grid, the No samples / Inferred states and, from M3, the
// Drill this key action.
// TODO(practice): M4 adds the sparkline, Pressed instead, Layer reach and the aggregate variant.

/**
 * The §5.0 popover idiom (LayerNameBadge's classes) with p-4 instead of p-2: LayerNameBadge's p-2 frames
 * menu rows that bring their own padding, while P4 and P5 hold headings, label/value rows and a stats
 * grid set straight on the card, which p-2 would put 8 px from the rounded-3xl edge.
 */
export const POPOVER_CLASSES = "z-[80] w-80 max-w-[calc(100vw-24px)] bg-kb-popover rounded-3xl p-4 shadow-xl border border-gray-200 dark:border-neutral-700 text-kb-ink";

const CHIP = "px-2 py-0.5 rounded-full bg-kb-gray-medium text-xs whitespace-nowrap";

/** N-13 Inferred chip: a focusable button whose reason is in its tooltip (and aria-describedby). */
export function InferredChip() {
    const id = useId();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button type="button" aria-describedby={id} className="px-2.5 py-0.5 rounded-full border border-kb-gray-border text-xs font-medium text-muted-foreground cursor-help focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    Inferred
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" id={id}>Over half of these samples come from the keymap, not the board</TooltipContent>
        </Tooltip>
    );
}

interface KeyDetailsProps {
    stats: CharacterStats;
    resolution: KeymapResolution | null;
    cols: number;
    unit: SpeedUnit;
    layerColor: string;
    /** Every sample is inferred (Keymap only). */
    inferred: boolean;
    /** Drill this key (§5.7): Drill on the character and its cluster; absent when it can't be drilled. */
    onDrill?: () => void;
}

export function KeyDetails({ stats, resolution, cols, unit, layerColor, inferred, onDrill }: KeyDetailsProps) {
    const paths = resolution?.pathsOf(stats.codePoint) ?? [];
    const primary = paths[0] ?? stats.path;
    const alternatives = primary ? paths.slice(1).map((p) => alternativeText(p, primary, cols)).filter(Boolean) : [];
    const hasData = stats.samples > 0;
    const unitLabel = unit === "wpm" ? "wpm" : "cpm";
    return (
        <div className="flex flex-col gap-4" data-key-details={stats.codePoint}>
            <div className="flex items-start gap-3">
                <CharCap codePoint={stats.codePoint} layerColor={layerColor} variant="medium" />
                <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[22px] font-semibold leading-none">{stats.label === " " ? "Space" : stats.label}</span>
                        {inferred && hasData && <InferredChip />}
                    </div>
                    {primary ? (
                        <div className="flex flex-wrap gap-1">
                            {pathChips(primary, cols).map((chip) => <span key={chip} className={CHIP}>{chip}</span>)}
                            {primary.delayed && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button type="button" className={`${CHIP} cursor-help focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}>Delayed output</button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Types on release, so its time includes the hold</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">Not on this keymap</span>
                    )}
                    {alternatives.map((text) => <span key={text} className="text-xs text-muted-foreground">{text}</span>)}
                </div>
            </div>
            {hasData ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <StatCell label="Speed" value={formatSpeed(stats.speed, unit)} unit={unitLabel} />
                    <StatCell label="Best" value={formatSpeed(stats.best, unit)} unit={unitLabel} />
                    <StatCell label="Accuracy" value={formatPercent(stats.accuracy)} unit="%" />
                    <StatCell label="Samples" value={stats.samples} />
                    <div className="flex flex-col gap-2">
                        <span className="text-xs text-muted-foreground">Confidence</span>
                        <ConfidenceBar value={stats.confidence} />
                        <span className="text-xs tabular-nums text-muted-foreground">{formatPercent(stats.confidence)} %</span>
                    </div>
                    <StatCell label="To target" value={stats.remainingLessons != null ? `≈ ${stats.remainingLessons}` : "—"} unit={stats.remainingLessons != null ? (stats.remainingLessons === 1 ? "lesson" : "lessons") : undefined} />
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">No samples yet</p>
            )}
            {onDrill && primary && (
                <div className="flex justify-end">
                    <button type="button" className={PILL_INK} onClick={onDrill} data-drill-this-key>Drill this key</button>
                </div>
            )}
        </div>
    );
}

interface KeyPopoverProps extends KeyDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}

/** P5 on a portaled Radix popover, anchored to the element that opened it (its trigger). */
export function KeyPopover({ open, onOpenChange, children, onDrill, ...details }: KeyPopoverProps) {
    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>{children}</Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    aria-label={`Key ${details.stats.label}`}
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    className={POPOVER_CLASSES}
                >
                    <KeyDetails {...details} onDrill={onDrill && (() => { onOpenChange(false); onDrill(); })} />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

export default KeyPopover;
