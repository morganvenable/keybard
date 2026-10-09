import type { ReactNode } from "react";

import { charReach, topConfusions } from "../../state/eventStats";
import { emptyCharacterStats } from "../../state/progressView";
import { MIN_DRILL_SCOPE } from "../../lessons/scope";
import { GroupPopover, type GroupStats, KeyPopover } from "../KeyPopover";
import type { ProgressP5 } from "./p5";

// The two P5 openers of the Progress page (docs/practice/spec.md §5.7, §5.8): a character (heatmap keys,
// Characters rows) and a group (Fingers and Thumbs cells, Layers rows, heatmap keys typing no
// character). While a popover is open its opener takes the select role.

export const OPENER_SELECTED = "z-10 ring-2 ring-kb-select ring-offset-1 ring-offset-background";

interface CharOpenerProps {
    p5: ProgressP5;
    codePoint: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}

export function CharOpener({ p5, codePoint, open, onOpenChange, children }: CharOpenerProps) {
    const stats = p5.characters.get(codePoint) ?? emptyCharacterStats(codePoint, p5.resolution.primary(codePoint));
    const events = p5.events?.get(codePoint);
    return (
        <KeyPopover
            open={open}
            onOpenChange={onOpenChange}
            stats={stats}
            resolution={p5.resolution}
            cols={p5.cols}
            unit={p5.unit}
            layerColor={p5.charColor(codePoint)}
            inferred={p5.inferredChars.has(codePoint)}
            targetSpeed={p5.targetSpeed}
            confusions={p5.events ? topConfusions(events) : undefined}
            reachMs={charReach(events)}
            layerColorOf={p5.layerColor}
            onDrill={p5.canDrillKey(codePoint) ? () => p5.onDrillKey(codePoint) : undefined}
        >
            {children}
        </KeyPopover>
    );
}

interface GroupOpenerProps {
    p5: ProgressP5;
    group: GroupStats;
    glyph?: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}

export function GroupOpener({ p5, group, glyph, open, onOpenChange, children }: GroupOpenerProps) {
    const canDrill = p5.drillable(group.chars) >= MIN_DRILL_SCOPE;
    return (
        <GroupPopover
            open={open}
            onOpenChange={onOpenChange}
            group={group}
            unit={p5.unit}
            targetSpeed={p5.targetSpeed}
            glyph={glyph}
            inferred={p5.inferred}
            onDrill={canDrill ? () => p5.onDrillGroup(group.chars, group.name) : undefined}
        >
            {children}
        </GroupPopover>
    );
}
