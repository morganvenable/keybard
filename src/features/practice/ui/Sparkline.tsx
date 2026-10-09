import type { SpeedUnit } from "../state/settings";
import { speedValue } from "./format";

// N-10 sparkline (docs/practice/spec.md §5.7): the last 30 samples as a kb-blue line, 240 × 48, with the
// target as a dotted kb-ink/40 line. Decorative: P5's stats grid carries the numbers.

export const SPARK_SAMPLES = 30;
const W = 240;
const H = 48;

interface SparklineProps {
    /** Speeds, CPM, oldest first; only the last 30 are drawn. */
    values: readonly number[];
    /** Target speed, CPM. */
    target: number;
    unit: SpeedUnit;
}

export function Sparkline({ values, target, unit }: SparklineProps) {
    const shown = values.slice(-SPARK_SAMPLES).map((v) => speedValue(v, unit));
    if (shown.length < 2) return null;
    const t = speedValue(target, unit);
    const max = Math.max(t, ...shown) * 1.1 || 1;
    const x = (i: number) => 2 + (i * (W - 4)) / (shown.length - 1);
    const y = (v: number) => H - 2 - (v / max) * (H - 4);
    const d = shown.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block max-w-full h-auto" data-practice-sparkline={shown.length}>
            <line x1={0} x2={W} y1={y(t)} y2={y(t)} className="stroke-kb-ink/40" strokeWidth={1} strokeDasharray="2 3" strokeLinecap="round" />
            <path d={d} fill="none" className="stroke-kb-blue" strokeWidth={2} strokeLinejoin="round" />
            <circle cx={x(shown.length - 1)} cy={y(shown[shown.length - 1])} r={3} className="fill-kb-blue" />
        </svg>
    );
}

export default Sparkline;
