import { useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Key } from "@/components/Key";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { cn } from "@/lib/utils";
import type { KeyboardInfo } from "@/types/keyboard.types";
import { placeOf } from "../../keymap/geometry";
import type { HeatKey, HeatLevel, HeatMetric, PhysicalTotals, UsageQuartiles } from "../../state/progressAggregates";
import { emptyTotals, HEAT_METRICS, heatLevel, metricValue } from "../../state/progressAggregates";
import type { SpeedUnit } from "../../state/settings";
import { fitBoard, useSettledWidth } from "../boardFit";
import { boardView } from "../boardModel";
import { charLabel, layerColorHex, layerName, placeName, spokenPlace } from "../format";
import { LAYER_DIVIDER, LAYER_PILL, LAYER_PILL_OFF, LAYER_PILL_ON } from "../layerPill";
import { HEAT_FACE, HEAT_FOOTER, heatScale, heatValueText, METRIC_LABELS } from "./heat";
import { CharOpener, GroupOpener, OPENER_SELECTED } from "./openers";
import { groupStats, type ProgressP5 } from "./p5";

// G1 Keyboard heatmap (docs/practice/spec.md §5.0.2, §5.8 item 3): Key.tsx caps with heat faces (never a
// layer color), the legend for the chosen layer in the center, no header strip and the value in the footer
// strip, led by a check at target. The board is never scaled below 1.0: below its width it scrolls inside
// its own overflow-x-auto, so footer values never drop under 10 px. Above it: the metric control, the
// LayerSelector divider and the layer pills (the only layer color in the section); beside the title, the
// one-line scale. Every key that types a character, or has samples, is a button that opens P5.

/** A heat value's level for the shown metric. */
export function keyLevel(key: Pick<HeatKey, "values" | "noData">, metric: HeatMetric, quartiles: UsageQuartiles): HeatLevel {
    return key.noData ? "none" : heatLevel(metric, metricValue(key.values, metric), quartiles);
}

/** The value and, at target, the check, as a heat face's footer carries them. */
export function HeatValue({ level, text }: { level: HeatLevel; text: string }) {
    return (
        <span className="inline-flex items-center gap-0.5 tabular-nums" data-heat-value>
            {level === "target" && <Check aria-hidden="true" className="size-2.5 shrink-0" strokeWidth={3} data-heat-check />}
            {text}
        </span>
    );
}

/** The scale line (§5.8): small swatches with their printed thresholds, then the no-data swatch. */
export function HeatScale({ metric, targetSpeed, unit, quartiles }: { metric: HeatMetric; targetSpeed: number; unit: SpeedUnit; quartiles: UsageQuartiles }) {
    const steps = heatScale(metric, { targetSpeed, unit, quartiles });
    const swatch = "inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px]";
    return (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground" data-heat-scale={metric}>
            {steps.map((step, i) => (
                <span key={step.level} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span aria-hidden="true" className={cn(swatch, HEAT_FACE[step.level])}>
                        {step.level === "target" && <Check className="size-2.5" strokeWidth={3} />}
                    </span>
                    <span className="tabular-nums">{step.text}</span>
                </span>
            ))}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn(swatch, HEAT_FACE.none)} />
                <span>no data</span>
            </span>
        </span>
    );
}

/** The metric control, the divider and the layer pills (§5.8). */
export function HeatToolbar({ metric, onMetric, layers, layer, onLayer, board }: {
    metric: HeatMetric;
    onMetric: (metric: HeatMetric) => void;
    layers: readonly number[];
    layer: number;
    onLayer: (layer: number) => void;
    board: Pick<KeyboardInfo, "cosmetic"> | null | undefined;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3" data-heat-toolbar>
            <SegmentedControl label="Heatmap metric" value={metric} onChange={onMetric} options={HEAT_METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }))} />
            {layers.length > 0 && <span aria-hidden="true" className={LAYER_DIVIDER} />}
            <div role="group" aria-label="Heatmap layer" className="flex flex-wrap items-center gap-2">
                {layers.map((l) => (
                    <button key={l} type="button" aria-pressed={l === layer} onClick={() => onLayer(l)} className={cn(LAYER_PILL, l === layer ? LAYER_PILL_ON : LAYER_PILL_OFF)}>
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: layerColorHex(board, l) }} />
                        {layerName(board, l)}
                    </button>
                ))}
            </div>
        </div>
    );
}

interface HeatmapBoardProps {
    board: KeyboardInfo;
    layoutId: string;
    defaultLayer: number;
    layer: number;
    keys: readonly HeatKey[];
    metric: HeatMetric;
    quartiles: UsageQuartiles;
    /** The period's physical totals (P5 for a key that types no character). */
    physical: PhysicalTotals;
    p5: ProgressP5;
}

const spokenMetric = (metric: HeatMetric, key: HeatKey, unit: SpeedUnit): string => {
    const v = key.values;
    switch (metric) {
        case "speed":
            return v.cpm != null ? `${heatValueText("speed", v, unit)} ${unit === "wpm" ? "words" : "characters"} per minute` : "no speed yet";
        case "accuracy":
            return v.accuracy != null ? `${heatValueText("accuracy", v, unit).replace("%", " percent")} accuracy` : "no accuracy yet";
        case "errors":
            return v.errors != null ? `${heatValueText("errors", v, unit).replace("%", " percent")} errors` : "no errors measured";
        case "usage":
            return v.usage != null ? `${heatValueText("usage", v, unit).replace("%", " percent")} of keystrokes` : "not used";
    }
};

export function HeatmapBoard({ board, layoutId, defaultLayer, layer, keys, metric, quartiles, physical, p5 }: HeatmapBoardProps) {
    const box = useRef<HTMLDivElement | null>(null);
    const width = useSettledWidth(box);
    const [open, setOpen] = useState<number | null>(null);
    const empty = useMemo(() => new Set<number>(), []);
    // The legends and positions the Lessons board would draw for this layer.
    const view = useMemo(() => boardView({
        keyboard: board, resolution: p5.resolution, layoutId, defaultLayer, displayedLayer: layer,
        included: empty, locked: empty, next: null, hints: "off", legends: true,
    }), [board, p5.resolution, layoutId, defaultLayer, layer, empty]);
    const fit = fitBoard(width, view.width, { allowScale: false });
    const byIndex = useMemo(() => new Map(keys.map((k) => [k.index, k])), [keys]);
    const { unit, variant } = fit;
    return (
        <div ref={box} className="w-full min-w-0 overflow-x-auto" data-practice-heatmap data-layer={layer} data-variant={variant}>
            <div className="relative mx-auto" style={{ width: view.width * unit, height: view.height * unit }}>
                {view.keys.map((vk) => {
                    const key = byIndex.get(vk.index);
                    if (!key) return null;
                    const level = keyLevel(key, metric, quartiles);
                    const char = key.char;
                    const label = char != null ? charLabel(char) : vk.label;
                    const value = level === "none" ? "" : heatValueText(metric, key.values, p5.unit);
                    const face = (
                        <Key
                            isRelative
                            x={0} y={0} w={vk.w} h={vk.h} row={vk.row} col={vk.col}
                            keycode={char != null ? "" : vk.keycode}
                            label={label}
                            keyContents={char != null ? { type: "text", str: label } : vk.keyContents}
                            forceLabel={char != null}
                            layerColor="white"
                            variant={variant}
                            disableHover disableDrag disableTooltip
                            className={cn("normal-case cursor-[inherit]", HEAT_FACE[level])}
                            footer={value ? <HeatValue level={level} text={value} /> : undefined}
                            footerClassName={HEAT_FOOTER}
                            data-heat-key={vk.index}
                            data-heat-level={level}
                        />
                    );
                    const style = { left: vk.x * unit, top: vk.y * unit, width: vk.w * unit, height: vk.h * unit };
                    const place = placeOf(vk.index, p5.cols);
                    // Keys with nothing to show in P5 (modifiers, navigation with no samples) are not buttons.
                    if (char == null && key.noData) return <div key={vk.index} aria-hidden="true" className="absolute" style={style}>{face}</div>;
                    const name = `${char != null ? charLabel(char) : placeName(place)}, ${level === "none" ? "no samples" : spokenMetric(metric, key, p5.unit)}, ${spokenPlace(place)}${level === "target" ? ", at target" : ""}`;
                    const button = (
                        <button type="button" aria-label={name}
                            className={cn("absolute block cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", open === vk.index && OPENER_SELECTED)}
                            style={style}>
                            {face}
                        </button>
                    );
                    const onOpenChange = (next: boolean) => setOpen((cur) => (next ? vk.index : cur === vk.index ? null : cur));
                    if (char != null) {
                        return <CharOpener key={vk.index} p5={p5} codePoint={char} open={open === vk.index} onOpenChange={onOpenChange}>{button}</CharOpener>;
                    }
                    // A key that types no tracked character (Space, Enter): its own samples on this layer, as a group of one.
                    const group = { name: placeName(place), indices: [vk.index], totals: physical.byKeyLayer.get(`${vk.index}@${layer}`) ?? emptyTotals(), values: key.values, chars: [] as number[] };
                    return (
                        <GroupOpener key={vk.index} p5={p5} group={groupStats(group, p5.records)} open={open === vk.index} onOpenChange={onOpenChange}>
                            {button}
                        </GroupOpener>
                    );
                })}
            </div>
        </div>
    );
}
