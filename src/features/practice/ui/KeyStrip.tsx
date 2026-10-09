import { memo, useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { placeOf } from "../keymap/geometry";
import type { KeymapResolution } from "../keymap/resolver";
import { charReach, type EventStats, topConfusions } from "../state/eventStats";
import type { CharacterStats, StripKey } from "../state/progressView";
import type { SpeedUnit } from "../state/settings";
import { CharCap } from "./CharCap";
import { formatPercentDown, formatSpeedDown, placeName, spokenPlace, spokenSpeed } from "./format";
import { KeyPopover } from "./KeyPopover";
import { ConfidenceBar } from "./StatCell";

// Key strip (docs/practice/spec.md §5.2): the lesson alphabet in unlock order as 30 px caps, each a button
// that opens P5, with a 3 px confidence bar; included letters first, then the locked ones (dashed); the
// focused letter at the right end as a 45 px cap. Under 480 px only the included letters and a
// `+19 locked` count show.

interface KeyStripProps {
    keys: readonly StripKey[];
    stats: (codePoint: number) => CharacterStats;
    resolution: KeymapResolution | null;
    cols: number;
    unit: SpeedUnit;
    layerColorOf: (codePoint: number) => string;
    /** Unlocked by the last lesson: zooms in once. */
    justUnlocked: number | null;
    /** P5's Drill this key (§5.7). */
    onDrill?: (codePoint: number) => void;
    /** Whether Drill this key has something to drill for the character (not Space). */
    canDrill?: (codePoint: number) => boolean;
    /** Target speed, CPM (P5's sparkline). */
    targetSpeed?: number;
    /** Every lesson with the character was Keymap only (P5 Inferred only). */
    inferredOf?: (codePoint: number) => boolean;
    /** P5's Pressed instead and layer reach, read from the stored events the first time a popover opens. */
    loadEventStats?: () => Promise<EventStats>;
    /** Changes when the history does, so the events are read again. */
    eventsKey?: string;
    /** Layer color name of a layer (Pressed instead caps). */
    layerColorOfLayer?: (layer: number) => string;
}

const FOCUSED = "ring-2 ring-kb-ink ring-offset-2 ring-offset-kb-gray";
const SELECTED = "z-10 ring-2 ring-kb-select ring-offset-1 ring-offset-background";

export const KeyStrip = memo(function KeyStrip({ keys, stats, resolution, cols, unit, layerColorOf, justUnlocked, onDrill, canDrill, targetSpeed, inferredOf, loadEventStats, eventsKey, layerColorOfLayer }: KeyStripProps) {
    const [open, setOpen] = useState<number | null>(null);
    const [events, setEvents] = useState<{ key: string | undefined; stats: EventStats } | null>(null);
    const current = events && events.key === eventsKey ? events.stats : null;
    // Typing never waits on the store: the events are read only once a popover is open.
    useEffect(() => {
        if (open == null || current || !loadEventStats) return;
        let live = true;
        void loadEventStats().then((stats) => { if (live) setEvents({ key: eventsKey, stats }); });
        return () => { live = false; };
    }, [open, current, loadEventStats, eventsKey]);
    const focused = keys.find((k) => k.focused);
    const locked = keys.filter((k) => !k.included).length;
    const describe = (codePoint: number) => {
        const s = stats(codePoint);
        const path = resolution?.primary(codePoint) ?? null;
        const place = path ? placeOf(path.index, cols) : null;
        return {
            s,
            spoken: `${s.label}, ${spokenSpeed(s.speed, unit, true)}, ${s.accuracy != null ? `${formatPercentDown(s.accuracy)} percent` : "no accuracy yet"}, ${spokenPlace(place)}`,
            tip: `${s.label} · ${formatSpeedDown(s.speed, unit)} ${unit} · ${formatPercentDown(s.accuracy)}% · Layer ${path?.layer ?? "—"} · ${placeName(place)}`,
        };
    };
    return (
        <div className="@container flex items-center gap-4 min-w-0" data-practice-strip>
            <div role="list" aria-label="Lesson keys" className="flex flex-wrap items-end gap-1.5 min-w-0 flex-1">
                {keys.map(({ key, included }, i) => {
                    const codePoint = key.letter.codePoint;
                    const { s, spoken, tip } = describe(codePoint);
                    const look = !included ? "locked" : s.calibrated ? "included" : "uncalibrated";
                    const firstLocked = !included && (i === 0 || keys[i - 1].included);
                    return (
                        <div role="listitem" key={codePoint} className={cn("flex items-end gap-1.5", !included && "@max-[480px]:hidden")}>
                            {firstLocked && <span aria-hidden="true" className="mx-1 h-6 w-px self-center bg-kb-gray-border" />}
                            <Tooltip>
                                <KeyPopover
                                    open={open === codePoint}
                                    onOpenChange={(next) => setOpen((cur) => (next ? codePoint : cur === codePoint ? null : cur))}
                                    stats={s}
                                    resolution={resolution}
                                    cols={cols}
                                    unit={unit}
                                    layerColor={layerColorOf(codePoint)}
                                    inferred={inferredOf ? inferredOf(codePoint) : true}
                                    targetSpeed={targetSpeed}
                                    confusions={current ? topConfusions(current.get(codePoint)) : undefined}
                                    reachMs={current ? charReach(current.get(codePoint)) : null}
                                    layerColorOf={layerColorOfLayer}
                                    onDrill={onDrill && (canDrill?.(codePoint) ?? true) ? () => onDrill(codePoint) : undefined}
                                >
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label={spoken}
                                            data-strip-key={s.label}
                                            className="flex flex-col items-center gap-1 cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                                        >
                                            <CharCap
                                                codePoint={codePoint}
                                                layerColor={layerColorOf(codePoint)}
                                                look={look}
                                                className={cn(
                                                    key.isFocused && FOCUSED,
                                                    open === codePoint && SELECTED,
                                                    justUnlocked === codePoint && "motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in-0",
                                                )}
                                            />
                                            <ConfidenceBar thin value={included ? key.confidence : 0} className="w-[30px]" />
                                        </button>
                                    </TooltipTrigger>
                                </KeyPopover>
                                <TooltipContent side="top">{tip}</TooltipContent>
                            </Tooltip>
                        </div>
                    );
                })}
                {locked > 0 && <span className="hidden @max-[480px]:inline text-xs text-muted-foreground whitespace-nowrap self-center">+{locked} locked</span>}
            </div>
            {focused && (
                <div className="flex items-center gap-2 shrink-0" data-practice-focus>
                    <span className="text-xs text-muted-foreground">Focus</span>
                    <CharCap codePoint={focused.key.letter.codePoint} layerColor={layerColorOf(focused.key.letter.codePoint)} variant="medium" />
                </div>
            )}
        </div>
    );
});

export default KeyStrip;
