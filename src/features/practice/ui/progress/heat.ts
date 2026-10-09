// N-9 heat faces (docs/practice/spec.md §5.0.2, D14, OD5): classes per heat level and the one-line scale
// each heatmap prints beside its title. Faces show heat only, never a layer color.
//
// - far / mid / near: red → orange → yellow on what still needs work, rising in luminance so the order
//   survives any color-vision deficiency; at target: the plain surface face with a check.
// - Usage: the single-hue blue ramp (themed tokens), never red.
// - No data: the locked look (dashed, transparent) with `—`.
// - Edges: `border-kb-gray-border` in light theme (kb-key-border equals the page there), kb-key-border in dark.
import { OWNER_Q9_COLORBLIND_HEAT_SETTING } from "@/constants/owner-decisions";
import type { KeyContent } from "@/types/keyboard.types";
import { getKeyDisplayText } from "@/utils/key-display";
import type { HeatLevel, HeatMetric, UsageQuartiles } from "../../state/progressAggregates";
import { HEAT_THRESHOLDS } from "../../state/progressAggregates";
import type { SpeedUnit } from "../../state/settings";
import { formatPercentDown, formatSpeedDown } from "../format";

const EDGE = "border border-kb-gray-border dark:border-kb-key-border";

/**
 * OWNER_Q9: offer a color-blind heat palette (§5.0.2 item 4). Answered no for v1, so there is one palette
 * (HEAT_FACE) and the Progress panel shows no Heat colors row.
 *
 * TODO(practice): Q9 yes → a `heatPalette: 'standard' | 'color-blind'` setting; a second token set beside
 * kb-heat-* in src/index.css (viridis-style: #440154 with white text, #21918c and #fde725 with black text,
 * light and dark); a HEAT_FACE_COLOR_BLIND map chosen here by the setting; and the panel's
 * "Heat colors: Standard · Color-blind" SegmentedControl (ProgressPanel.tsx, HeatColorsRow). Nothing else
 * changes: levels, thresholds, printed values and checks stay.
 */
export const COLOR_BLIND_HEAT_SETTING = OWNER_Q9_COLORBLIND_HEAT_SETTING;

/** Face classes (background, text, border) per level. */
export const HEAT_FACE: Record<HeatLevel, string> = {
    far: `bg-kb-heat-far text-white ${EDGE}`,
    mid: `bg-kb-heat-mid text-kb-heat-ink ${EDGE}`,
    near: `bg-kb-heat-near text-kb-heat-ink ${EDGE}`,
    target: `bg-kb-surface text-kb-ink ${EDGE}`,
    "use-1": `bg-kb-use-1 text-kb-use-1-fg ${EDGE}`,
    "use-2": `bg-kb-use-2 text-kb-use-2-fg ${EDGE}`,
    "use-3": `bg-kb-use-3 text-kb-use-3-fg ${EDGE}`,
    "use-4": `bg-kb-use-4 text-kb-use-4-fg ${EDGE}`,
    none: "bg-transparent border border-dashed border-kb-gray-border text-muted-foreground",
};

/**
 * A heat face's legend as plain text, for a key that types no character: §5.0.2 heat faces have no header
 * strip and no tinted bottom strip, so Key.tsx's keycode rendering (MO/LT header, modifier badge) is not
 * used. A layer key reads `MO 1`; any other key its center label, or its top label when that is empty.
 */
export function heatLegend(keycode: string, label: string, keyContents: KeyContent | undefined, layoutId: string): string {
    if (keyContents?.type === "layer") {
        const target = keyContents.top?.split("(")[1]?.replace(")", "") ?? "";
        return [keyContents.layertext, target].filter(Boolean).join(" ");
    }
    const { displayLabel, topLabel } = getKeyDisplayText(keycode, label, keyContents, false, layoutId);
    return displayLabel || topLabel;
}

/** The footer strip on a heat face: the face's own text color with a hairline of it above (no bg-black/30 tint). */
export const HEAT_FOOTER = "border-t border-current/25";

/**
 * Key.tsx's header strip on a heat face (only an icon strip, such as a mouse key's, can still appear): no
 * tint, and the face's own text color (important, since Key.tsx appends `text-white` after this class).
 */
export const HEAT_HEADER = "bg-transparent text-current!";

/** Printed value of a metric: speed in the unit (whole numbers on a key), shares as whole percents. */
export function heatValueText(metric: HeatMetric, value: { cpm: number | null; accuracy: number | null; errors: number | null; usage: number | null; reachMs?: number | null }, unit: SpeedUnit): string {
    switch (metric) {
        case "speed":
            if (value.reachMs != null) return `${Math.round(value.reachMs)} ms`;
            // Rounded down with the Characters table's formatter, so a key just under target never prints the
            // target and its value is the table's with the decimal dropped.
            return formatSpeedDown(value.cpm, unit, 0);
        case "accuracy":
            return value.accuracy != null ? `${formatPercentDown(value.accuracy)}%` : "—";
        case "errors":
            // Rounded up, so a key over the 2% target never prints 2%.
            return value.errors != null ? `${Math.ceil(value.errors * 100 - 1e-9)}%` : "—";
        case "usage":
            if (value.usage == null) return "—";
            return value.usage * 100 >= 1 ? `${Math.round(value.usage * 100)}%` : `${(value.usage * 100).toFixed(1)}%`;
    }
}

export interface ScaleStep {
    level: HeatLevel;
    text: string;
}

const pct = (v: number) => {
    const p = v * 100;
    return Number.isInteger(p) ? `${p}%` : `${p.toFixed(1)}%`;
};

/**
 * The scale line (§5.8): each face with its printed thresholds, for example
 * `< 18 · 18–26 · 26–35 · ✓ ≥ 35 wpm`. Speed prints its thresholds in the unit from the target speed.
 */
export function heatScale(metric: HeatMetric, { targetSpeed, unit, quartiles }: { targetSpeed: number; unit: SpeedUnit; quartiles: UsageQuartiles }): ScaleStep[] {
    switch (metric) {
        case "speed": {
            // Whole numbers in the unit, as the keys print them.
            const whole = (cpm: number) => String(Math.round(unit === "wpm" ? cpm / 5 : cpm));
            const [a, b] = HEAT_THRESHOLDS.speed.map((c) => whole(targetSpeed * c));
            const t = whole(targetSpeed);
            return [
                { level: "far", text: `< ${a}` }, { level: "mid", text: `${a}–${b}` },
                { level: "near", text: `${b}–${t}` }, { level: "target", text: `≥ ${t} ${unit}` },
            ];
        }
        case "accuracy": {
            const [a, b, c] = HEAT_THRESHOLDS.accuracy.map(pct);
            return [{ level: "far", text: `< ${a}` }, { level: "mid", text: `${a}–${b}` }, { level: "near", text: `${b}–${c}` }, { level: "target", text: `≥ ${c}` }];
        }
        case "errors": {
            const [a, b, c] = HEAT_THRESHOLDS.errors.map(pct);
            return [{ level: "far", text: `> ${a}` }, { level: "mid", text: `${b}–${a}` }, { level: "near", text: `${c}–${b}` }, { level: "target", text: `≤ ${c}` }];
        }
        case "usage": {
            const [a, b, c] = quartiles.map(pct);
            return [
                { level: "use-1", text: `< ${a}` }, { level: "use-2", text: `${a}–${b}` },
                { level: "use-3", text: `${b}–${c}` }, { level: "use-4", text: `≥ ${c} of keystrokes` },
            ];
        }
    }
}

export const METRIC_LABELS: Record<HeatMetric, string> = { speed: "Speed", accuracy: "Accuracy", errors: "Errors", usage: "Usage" };
