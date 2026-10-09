import { useId, type ReactNode } from "react";
import { Popover } from "radix-ui";

import { PILL_INK } from "@/components/shared/pills";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KeymapResolution } from "../keymap/resolver";
import type { Confusion } from "../state/eventStats";
import type { CharacterStats } from "../state/progressView";
import type { SpeedUnit } from "../state/settings";
import type { ErrorClass } from "../types";
import { timeToSpeed } from "../vendor/keybr/result/index.ts";
import { CharCap } from "./CharCap";
import { alternativeText, charLabel, formatPercentDown, formatSpeedDown, pathChips } from "./format";
import { Sparkline } from "./Sparkline";
import { ConfidenceBar, StatCell } from "./StatCell";

// P5 Key detail popover (docs/practice/spec.md §5.7): the header (cap, character, path chips,
// alternatives, Delayed output), the stats grid, the sparkline of the last 30 samples, Pressed instead
// (the top 3 confusions with their class), Layer reach (live, layered characters), the No samples /
// Inferred only states and the Drill this key action. The aggregate variant (GroupDetails: a Fingers or
// Thumbs cell, a Layers row, a heatmap key that types no practiced character) has the group's name and
// characters in its header, aggregate stats, no Pressed instead, and Drill this group.

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

/** §6.6 class names as P5 prints them. */
export const ERROR_CLASS_TEXT: Record<ErrorClass, string> = {
    "wrong-layer": "wrong layer",
    "wrong-direction": "wrong direction",
    "wrong-finger": "wrong finger",
    "wrong-hand": "wrong hand",
    "wrong-shift": "wrong shift",
    unknown: "not on the keymap",
};

/** A character's per-lesson speeds (CPM) for its sparkline, oldest first. */
export function sampleSpeeds(stats: CharacterStats): number[] {
    return stats.keyStats.samples.filter((s) => s.timeToType > 0).map((s) => timeToSpeed(s.timeToType));
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
    /** Target speed, CPM: the sparkline's dotted line. */
    targetSpeed?: number;
    /** Pressed instead (§5.7), most frequent first; undefined while the events load. */
    confusions?: readonly Confusion[];
    /** Live layer reach, ms (§5.7), or null. */
    reachMs?: number | null;
    /** Layer color of a confusion's cap. */
    layerColorOf?: (layer: number) => string;
}

export function KeyDetails({ stats, resolution, cols, unit, layerColor, inferred, onDrill, targetSpeed, confusions, reachMs, layerColorOf }: KeyDetailsProps) {
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
                    <StatCell label="Speed" value={formatSpeedDown(stats.speed, unit)} unit={unitLabel} />
                    <StatCell label="Best" value={formatSpeedDown(stats.best, unit)} unit={unitLabel} />
                    <StatCell label="Accuracy" value={formatPercentDown(stats.accuracy)} unit="%" />
                    <StatCell label="Samples" value={stats.samples} />
                    <div className="flex flex-col gap-2">
                        <span className="text-xs text-muted-foreground">Confidence</span>
                        <ConfidenceBar value={stats.confidence} />
                        <span className="text-xs tabular-nums text-muted-foreground">{formatPercentDown(stats.confidence)} %</span>
                    </div>
                    <StatCell label="To target" value={stats.remainingLessons != null ? `≈ ${stats.remainingLessons}` : "—"} unit={stats.remainingLessons != null ? (stats.remainingLessons === 1 ? "lesson" : "lessons") : undefined} />
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">No samples yet</p>
            )}
            {hasData && targetSpeed != null && <Sparkline values={sampleSpeeds(stats)} target={targetSpeed} unit={unit} />}
            {hasData && confusions && confusions.length > 0 && (
                <PressedInstead confusions={confusions} layerColorOf={layerColorOf ?? (() => layerColor)} showInferred={!inferred && confusions.every((c) => c.inferred)} />
            )}
            {hasData && !inferred && reachMs != null && primary && primary.prereqs.length > 0 && (
                <div className="flex items-center justify-between text-sm" data-layer-reach>
                    <span>Layer reach</span>
                    <span className="tabular-nums">{Math.round(reachMs)} ms</span>
                </div>
            )}
            {onDrill && primary && (
                <div className="flex justify-end">
                    <button type="button" className={PILL_INK} onClick={onDrill} data-drill-this-key>Drill this key</button>
                </div>
            )}
        </div>
    );
}

function PressedInstead({ confusions, layerColorOf, showInferred }: { confusions: readonly Confusion[]; layerColorOf: (layer: number) => string; showInferred: boolean }) {
    return (
        <div className="flex flex-col gap-1.5" data-pressed-instead>
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Pressed instead</span>
                {showInferred && <InferredChip />}
            </div>
            {confusions.map((c) => (
                <div key={`${c.typed}|${c.errorClass}`} className="flex items-center gap-2.5 text-sm" data-confusion={charLabel(c.typed)}>
                    <CharCap codePoint={c.typed} layerColor={layerColorOf(Math.max(0, c.layer))} />
                    <span className="tabular-nums">× {c.count}</span>
                    {c.errorClass && <span className="text-muted-foreground">{ERROR_CLASS_TEXT[c.errorClass]}</span>}
                </div>
            ))}
        </div>
    );
}

/** The aggregate variant's numbers (§5.7): a Fingers or Thumbs cell, a Layers row. */
export interface GroupStats {
    /** "L-middle · N". */
    name: string;
    /** Characters of the group (header chips). */
    chars: readonly number[];
    /** CPM, or null. */
    speed: number | null;
    best: number | null;
    accuracy: number | null;
    /** Hits in scope. */
    samples: number;
    confidence: number | null;
    /** Per-lesson speeds, CPM, oldest first. */
    series: readonly number[];
    /** The Speed shown is layer reach, ms (a layer-hold thumb, live). */
    reachMs?: number | null;
}

interface GroupDetailsProps {
    group: GroupStats;
    unit: SpeedUnit;
    targetSpeed: number;
    /** A glyph before the name (the direction glyph of a Fingers cell). */
    glyph?: ReactNode;
    inferred: boolean;
    /** Drill this group; absent when it has fewer than 3 characters to drill. */
    onDrill?: () => void;
}

/** Header chips shown before `+ n`. */
const GROUP_CHIPS = 16;

export function GroupDetails({ group, unit, targetSpeed, glyph, inferred, onDrill }: GroupDetailsProps) {
    const unitLabel = unit === "wpm" ? "wpm" : "cpm";
    const hasData = group.samples > 0 || group.reachMs != null;
    return (
        <div className="flex flex-col gap-4" data-group-details={group.name}>
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    {glyph}
                    <span className="text-[22px] font-semibold leading-none">{group.name}</span>
                    {inferred && hasData && <InferredChip />}
                </div>
                {group.chars.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {group.chars.slice(0, GROUP_CHIPS).map((c) => <span key={c} className={CHIP}>{charLabel(c)}</span>)}
                        {group.chars.length > GROUP_CHIPS && <span className={CHIP}>+ {group.chars.length - GROUP_CHIPS}</span>}
                    </div>
                )}
            </div>
            {hasData ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {group.reachMs != null
                        ? <StatCell label="Layer reach" value={Math.round(group.reachMs)} unit="ms" />
                        : <StatCell label="Speed" value={formatSpeedDown(group.speed, unit)} unit={unitLabel} />}
                    <StatCell label="Best" value={formatSpeedDown(group.best, unit)} unit={unitLabel} />
                    <StatCell label="Accuracy" value={formatPercentDown(group.accuracy)} unit="%" />
                    <StatCell label="Samples" value={group.samples.toLocaleString("en-US")} />
                    <div className="flex flex-col gap-2">
                        <span className="text-xs text-muted-foreground">Confidence</span>
                        <ConfidenceBar value={group.confidence} />
                        <span className="text-xs tabular-nums text-muted-foreground">{formatPercentDown(group.confidence)} %</span>
                    </div>
                    <StatCell label="To target" value="—" />
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">No samples yet</p>
            )}
            {hasData && <Sparkline values={group.series} target={targetSpeed} unit={unit} />}
            {onDrill && (
                <div className="flex justify-end">
                    <button type="button" className={PILL_INK} onClick={onDrill} data-drill-this-group>Drill this group</button>
                </div>
            )}
        </div>
    );
}

interface GroupPopoverProps extends GroupDetailsProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}

/** P5's aggregate variant on a portaled popover, anchored to its opener. */
export function GroupPopover({ open, onOpenChange, children, onDrill, ...details }: GroupPopoverProps) {
    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger asChild>{children}</Popover.Trigger>
            <Popover.Portal>
                <Popover.Content aria-label={details.group.name} side="bottom" align="start" sideOffset={8} collisionPadding={12} className={POPOVER_CLASSES}>
                    <GroupDetails {...details} onDrill={onDrill && (() => { onOpenChange(false); onDrill(); })} />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
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
