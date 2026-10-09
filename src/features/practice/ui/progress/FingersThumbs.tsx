import { type Dispatch, Fragment, type SetStateAction, useState } from "react";

import { keyService } from "@/services/key.service";
import { getLabelForKeycode } from "@/components/Keyboards/layouts";
import { cn } from "@/lib/utils";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { layerAction, resolveBinding, shiftRole, type KeymapResolution } from "../../keymap/resolver";
import type { FingerRow, FingersGrid, HeatMetric, KeyGroup, ThumbRow, UsageQuartiles } from "../../state/progressAggregates";
import { FINGER_COLUMNS, heatLevel, metricValue } from "../../state/progressAggregates";
import type { SpeedUnit } from "../../state/settings";
import { charLabel, layerName } from "../format";
import { HeatValue } from "./Heatmap";
import { HEAT_FACE, heatValueText, METRIC_LABELS } from "./heat";
import { GroupOpener, OPENER_SELECTED } from "./openers";
import { groupStats, type ProgressP5 } from "./p5";

// G1 Fingers grid and Thumbs (docs/practice/spec.md §5.8 items 4–5, N-12): heat-face cells for every
// finger × direction and thumb key, over every layer, following the Keyboard metric. Each row label of
// the grid carries its direction glyph (always visible, E is screen-right); a hand gap separates the
// halves; a Finger totals row closes it. Thumb cells say what the key did in practice and, for a layer
// key held more than tapped, show its layer reach in ms. Every cell with a group opens P5's aggregate.

const GLYPH_CELLS = ["", "N", "", "W", "C", "E", "", "S", ""] as const;

/** N-12 direction glyph: the cluster as a 3 × 3 grid of 10 px outlined squares, this direction in ink. */
export function DirectionGlyph({ direction, className }: { direction: FingerRow; className?: string }) {
    const on = direction === "2S" ? "S" : direction;
    return (
        <span aria-hidden="true" className={cn("inline-grid grid-cols-3 gap-px shrink-0", className)} data-direction-glyph={direction}>
            {GLYPH_CELLS.map((cell, i) => (
                <span key={i} className={cn("size-2.5 rounded-[2px]", !cell ? "invisible" : cell === on ? "bg-kb-ink" : "border border-kb-gray-border",
                    direction === "2S" && cell === "S" && "ring-1 ring-kb-ink ring-offset-1 ring-offset-background")} />
            ))}
        </span>
    );
}

const DIRECTION_WORDS: Record<FingerRow, string> = { C: "center", N: "north", S: "south", E: "east", W: "west", "2S": "double south" };

function cellName(group: KeyGroup, metric: HeatMetric, unit: SpeedUnit, level: string): string {
    const value = metricValue(group.values, metric) == null ? "no samples" : `${METRIC_LABELS[metric]} ${heatValueText(metric, group.values, unit)}`;
    return `${group.name.replace(" · ", " ")}, ${value}${level === "target" ? ", at target" : ""}`;
}

interface CellProps {
    group: KeyGroup | null;
    metric: HeatMetric;
    quartiles: UsageQuartiles;
    p5: ProgressP5;
    open: string | null;
    setOpen: Dispatch<SetStateAction<string | null>>;
    glyph?: FingerRow;
    className?: string;
}

/** One heat cell (64 × 40 in the grid) that opens P5's aggregate. */
function HeatCell({ group, metric, quartiles, p5, open, setOpen, glyph, className }: CellProps) {
    if (!group) return <span aria-hidden="true" />;
    const value = metricValue(group.values, metric);
    const level = heatLevel(metric, value, quartiles);
    const text = level === "none" ? "—" : heatValueText(metric, group.values, p5.unit);
    return (
        <GroupOpener p5={p5} group={groupStats(group, p5.records)} glyph={glyph ? <DirectionGlyph direction={glyph} /> : undefined}
            open={open === group.name} onOpenChange={(next) => setOpen((cur) => (next ? group.name : cur === group.name ? null : cur))}>
            <button type="button" aria-label={cellName(group, metric, p5.unit, level)} data-heat-cell={group.name} data-heat-level={level}
                className={cn("flex items-center justify-center rounded-md text-sm font-semibold cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                    HEAT_FACE[level], open === group.name && OPENER_SELECTED, className)}>
                <HeatValue level={level} text={text} />
            </button>
        </GroupOpener>
    );
}

interface FingersProps {
    grid: FingersGrid;
    metric: HeatMetric;
    quartiles: UsageQuartiles;
    p5: ProgressP5;
}

export function FingersGridView({ grid, metric, quartiles, p5 }: FingersProps) {
    const [open, setOpen] = useState<string | null>(null);
    const columns = "grid-cols-[72px_repeat(4,64px)_20px_repeat(4,64px)]";
    const cell = (group: KeyGroup | null, row?: FingerRow, key?: string) => (
        <HeatCell key={key} group={group} metric={metric} quartiles={quartiles} p5={p5} open={open} setOpen={setOpen} glyph={row} className="h-10 w-16" />
    );
    return (
        <div className="w-full min-w-0 overflow-x-auto" data-practice-fingers>
            <div className={cn("grid w-max gap-1.5 items-center", columns)}>
                <span />
                {FINGER_COLUMNS.map((col, i) => (
                    <Fragment key={col.name}>
                        {i === 4 && <span />}
                        <span className="text-center text-xs text-muted-foreground">{col.name}</span>
                    </Fragment>
                ))}
                {grid.rows.map((row, r) => (
                    <Fragment key={row}>
                        <span className="flex items-center gap-1.5" aria-label={DIRECTION_WORDS[row]}>
                            <DirectionGlyph direction={row} />
                            <span className="text-xs font-semibold text-muted-foreground">{row}</span>
                        </span>
                        {grid.cells[r].map((group, c) => (
                            <Fragment key={c}>
                                {c === 4 && <span aria-hidden="true" />}
                                {cell(group, row)}
                            </Fragment>
                        ))}
                    </Fragment>
                ))}
                <span className="text-xs font-semibold text-kb-ink">Finger</span>
                {grid.totals.map((group, c) => (
                    <Fragment key={group.name}>
                        {c === 4 && <span aria-hidden="true" />}
                        {cell(group)}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}

/** What a thumb key did in practice (§5.8 Thumbs): `Space`, `Shift`, `Layer 1`, `Layer 1 · Enter`. */
export function thumbAction(board: Pick<KeyboardInfo, "keymap" | "cosmetic">, resolution: KeymapResolution, index: number, defaultLayer: number, layoutId: string): string {
    const keymap = board.keymap ?? [];
    const { code } = resolveBinding(keymap, index, (1 << defaultLayer) >>> 0);
    const name = keyService.stringify(code);
    const label = (keycode: string) => {
        const char = /^KC_(SPACE|SPC)$/.test(keycode) ? " " : /^KC_(ENTER|ENT)$/.test(keycode) ? "\n" : /^KC_TAB$/.test(keycode) ? "\t" : null;
        if (char) return charLabel(char.codePointAt(0)!);
        return getLabelForKeycode(keycode, layoutId) || keycode.replace(/^KC_/, "");
    };
    const action = layerAction(name);
    if (action) {
        const layer = layerName(board, action.toLayer);
        if (action.kind === "oneshot") return `${layer} · one-shot`;
        const tap = action.tapHold ? /^LT\d+\((.*)\)$/.exec(name)?.[1] ?? /^LT\(\d+,\s*(.*)\)$/.exec(name)?.[1] : null;
        return tap ? `${layer} · ${label(tap)}` : layer;
    }
    if (shiftRole(name)) return "Shift";
    const typed = resolution.charAt(index, defaultLayer, "n");
    if (typed != null) return charLabel(typed);
    if (name === "KC_NO" || name === "KC_TRNS" || !name) return "—";
    return label(name);
}

interface ThumbsProps {
    rows: { left: ThumbRow[]; right: ThumbRow[] };
    metric: HeatMetric;
    quartiles: UsageQuartiles;
    p5: ProgressP5;
    actionOf: (index: number) => string;
}

export function ThumbsView({ rows, metric, quartiles, p5, actionOf }: ThumbsProps) {
    const [open, setOpen] = useState<string | null>(null);
    const column = (title: string, list: ThumbRow[]) => (
        <div className="flex flex-col gap-1.5 min-w-0" data-thumb-column={title}>
            <span className="text-xs font-semibold text-muted-foreground">{title}</span>
            {list.map((row) => (
                <div key={row.key} className="grid grid-cols-[28px_minmax(0,1fr)_96px] items-center gap-2.5 text-sm" data-thumb={row.group.name}>
                    <span className="text-xs font-semibold text-muted-foreground">{row.key}</span>
                    <span className="truncate text-kb-ink">{actionOf(row.index)}</span>
                    <HeatCell group={row.group} metric={metric} quartiles={quartiles} p5={p5} open={open} setOpen={setOpen} className="h-8 w-24" />
                </div>
            ))}
        </div>
    );
    return (
        <div className="@container">
            <div className="grid grid-cols-1 @min-[560px]:grid-cols-2 gap-x-12 gap-y-4 max-w-[720px]" data-practice-thumbs>
                {column("Left thumb", rows.left)}
                {column("Right thumb", rows.right)}
            </div>
        </div>
    );
}
