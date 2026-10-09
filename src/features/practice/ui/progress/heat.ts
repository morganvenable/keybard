// N-9 heat faces (docs/practice/spec.md §5.0.2, D14, OD5): classes per heat level and the one-line scale
// each heatmap prints beside its title. Faces show heat only, never a layer color.
//
// - far / mid / near: red → orange → yellow on what still needs work, rising in luminance so the order
//   survives any color-vision deficiency; at target: the plain surface face with a check.
// - Usage: the single-hue blue ramp (themed tokens), never red.
// - No data: the locked look (dashed, transparent) with `—`.
// - Edges: `border-kb-gray-border` in light theme (kb-key-border equals the page there), kb-key-border in dark.
//
// OWNER_Q9 (a color-blind heat palette setting) is answered no, so there is one palette and no setting.
import type { HeatLevel, HeatMetric, UsageQuartiles } from "../../state/progressAggregates";
import { HEAT_THRESHOLDS } from "../../state/progressAggregates";
import type { SpeedUnit } from "../../state/settings";

const EDGE = "border border-kb-gray-border dark:border-kb-key-border";

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

/** The footer strip on a heat face: the face's own text color with a hairline of it above (no bg-black/30 tint). */
export const HEAT_FOOTER = "border-t border-current/25";

/** Printed value of a metric: speed in the unit (whole numbers on a key), shares as whole percents. */
export function heatValueText(metric: HeatMetric, value: { cpm: number | null; accuracy: number | null; errors: number | null; usage: number | null; reachMs?: number | null }, unit: SpeedUnit): string {
    switch (metric) {
        case "speed":
            if (value.reachMs != null) return `${Math.round(value.reachMs)} ms`;
            // Rounded down, like Accuracy, so a key just under target never prints the target.
            return value.cpm != null ? String(Math.floor(unit === "wpm" ? value.cpm / 5 : value.cpm)) : "—";
        case "accuracy":
            return value.accuracy != null ? `${Math.floor(value.accuracy * 100)}%` : "—";
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
