// What the Progress page's P5 openers share (docs/practice/spec.md §5.7, §5.8): the period's character
// stats and events, the Inferred rules and the Drill actions. Built once by ProgressPage.
import type { KeymapResolution } from "../../keymap/resolver";
import type { EventStats } from "../../state/eventStats";
import type { KeyGroup } from "../../state/progressAggregates";
import { groupSeries } from "../../state/progressAggregates";
import type { CharacterStats } from "../../state/progressView";
import type { SpeedUnit } from "../../state/settings";
import type { StoredResult } from "../../store/db";
import type { GroupStats } from "../KeyPopover";

export interface ProgressP5 {
    resolution: KeymapResolution;
    cols: number;
    unit: SpeedUnit;
    /** CPM. */
    targetSpeed: number;
    records: readonly StoredResult[];
    /** The period's character stats by code point (the Characters table's rows). */
    characters: ReadonlyMap<number, CharacterStats>;
    /** Pressed instead and layer reach; null while the events load. */
    events: EventStats | null;
    /** Characters whose every lesson in the period was Keymap only. */
    inferredChars: ReadonlySet<number>;
    /** More than half of the period's hits were inferred (section titles, aggregates). */
    inferred: boolean;
    /** Layer color name of a layer (caps in Pressed instead, layer dots). */
    layerColor: (layer: number) => string;
    /** Layer color name of a character's primary path (P5's header cap). */
    charColor: (codePoint: number) => string;
    onDrillKey: (codePoint: number) => void;
    canDrillKey: (codePoint: number) => boolean;
    onDrillGroup: (codePoints: readonly number[], name: string) => void;
    /** How many of these characters Drill can drill (Drill this group needs 3). */
    drillable: (codePoints: readonly number[]) => number;
}

/**
 * The aggregate P5 numbers of a key group (a Fingers or Thumbs cell, a heatmap key). `layer` limits the
 * sparkline and Best to presses on one layer, matching totals taken for that layer.
 */
export function groupStats(group: KeyGroup, records: readonly StoredResult[], layer?: number): GroupStats {
    const series = groupSeries(records, group.indices, layer);
    return {
        name: group.name,
        chars: group.chars,
        speed: group.values.cpm,
        best: series.length ? Math.max(...series) : null,
        accuracy: group.values.accuracy,
        samples: group.totals.h,
        confidence: group.values.speed,
        series,
        reachMs: group.values.reachMs,
    };
}
