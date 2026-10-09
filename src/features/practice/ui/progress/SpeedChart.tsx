import { useRef, useState, type MouseEvent } from "react";

import type { ChartPoint } from "../../state/progressView";
import type { SpeedUnit } from "../../state/settings";
import { useSettledWidth } from "../boardFit";
import { formatDate, formatDateTime, formatSpeed, lessonTypeLabel, speedValue } from "../format";

// N-10 Speed chart (docs/practice/spec.md §5.8): speed in the selected unit as a solid kb-blue line on
// the left axis, accuracy as a dashed kb-purple line on the right axis, the target as a dotted ink line.
// Lines differ in stroke as well as hue, and each is labeled at its right end in ink, led by a sample
// of its stroke. Hover shows a rule and the point's values; keyboard users get them in the table. The
// SVG draws at the measured width (at least 320 px) and scales down through its viewBox when its
// container is narrower, so the right-end labels are never clipped.

const HEIGHT = 240;
const M = { left: 44, right: 132, top: 12, bottom: 28 };

interface SpeedChartProps {
    points: readonly ChartPoint[];
    unit: SpeedUnit;
    /** Target speed, CPM. */
    target: number;
    axis: "lessons" | "days";
}

function niceMax(value: number): number {
    if (value <= 0) return 10;
    const step = 10 ** Math.floor(Math.log10(value));
    return Math.ceil(value / step) * step;
}

export function SpeedChart({ points, unit, target, axis }: SpeedChartProps) {
    const box = useRef<HTMLDivElement | null>(null);
    const width = Math.max(320, useSettledWidth(box, 120) || 640);
    const [hover, setHover] = useState<number | null>(null);
    const plotW = width - M.left - M.right;
    const plotH = HEIGHT - M.top - M.bottom;
    const speeds = points.map((p) => speedValue(p.speed, unit));
    const targetValue = speedValue(target, unit);
    const yMax = niceMax(Math.max(targetValue, ...speeds) * 1.1);
    const accMin = Math.max(0, Math.floor((Math.min(1, ...points.map((p) => p.accuracy)) * 100 - 5) / 5) * 5);
    const xOf = (i: number) => M.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const ySpeed = (v: number) => M.top + plotH - (v / yMax) * plotH;
    const yAcc = (a: number) => M.top + plotH - ((a * 100 - accMin) / (100 - accMin || 1)) * plotH;
    const path = (ys: number[]) => ys.map((y, i) => `${i ? "L" : "M"}${xOf(i).toFixed(1)},${y.toFixed(1)}`).join(" ");
    const speedPath = path(speeds.map(ySpeed));
    const accPath = path(points.map((p) => yAcc(p.accuracy)));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
    const lastSpeedY = speeds.length ? ySpeed(speeds[speeds.length - 1]) : 0;
    const lastAccY = points.length ? yAcc(points[points.length - 1].accuracy) : 0;
    // Keep the two right-end labels apart.
    const [speedLabelY, accLabelY] = Math.abs(lastSpeedY - lastAccY) < 14
        ? (lastSpeedY < lastAccY ? [lastSpeedY - 7, lastAccY + 7] : [lastSpeedY + 7, lastAccY - 7])
        : [lastSpeedY, lastAccY];
    const unitLabel = unit;

    // Drawn width over logical width: below 1 when the viewBox scales the chart down.
    const shown = box.current?.clientWidth || width;
    const scale = Math.min(1, shown / width);

    const onMove = (event: MouseEvent<SVGSVGElement>) => {
        if (!points.length) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) * (rect.width > 0 ? width / rect.width : 1);
        const i = points.length <= 1 ? 0 : Math.round(((x - M.left) / plotW) * (points.length - 1));
        setHover(Math.max(0, Math.min(points.length - 1, i)));
    };
    const hovered = hover != null ? points[hover] : null;
    const xLabel = (i: number) => (axis === "lessons" ? String(points[i].x) : formatDate(points[i].ts));
    const xTicks = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];

    return (
        <div ref={box} className="relative w-full" data-practice-speed-chart>
            <svg
                width={width}
                height={HEIGHT}
                viewBox={`0 0 ${width} ${HEIGHT}`}
                role="img"
                aria-label={`Speed and accuracy over ${points.length} ${axis === "lessons" ? "lessons" : "days"}`}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                className="block max-w-full h-auto"
            >
                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={M.left} x2={M.left + plotW} y1={ySpeed(t)} y2={ySpeed(t)} className="stroke-border" strokeWidth={1} />
                        <text x={M.left - 8} y={ySpeed(t)} dy="0.32em" textAnchor="end" className="text-xs fill-muted-foreground">{t}</text>
                    </g>
                ))}
                {[accMin, 100].map((a) => (
                    <text key={a} x={M.left + plotW + 6} y={yAcc(a / 100)} dy="0.32em" className="text-xs fill-muted-foreground">{a}%</text>
                ))}
                {xTicks.map((i) => (
                    <text key={i} x={xOf(i)} y={HEIGHT - 8} textAnchor="middle" className="text-xs fill-muted-foreground">{xLabel(i)}</text>
                ))}
                <line x1={M.left} x2={M.left + plotW} y1={ySpeed(targetValue)} y2={ySpeed(targetValue)} className="stroke-kb-ink/40" strokeWidth={1.5} strokeDasharray="2 3" data-chart-line="target" />
                <text x={M.left + 4} y={ySpeed(targetValue) - 6} className="text-xs fill-muted-foreground">Target {formatSpeed(target, unit)}</text>
                {points.length > 1 ? (
                    <>
                        <path d={accPath} fill="none" className="stroke-kb-purple" strokeWidth={2} strokeDasharray="6 4" data-chart-line="accuracy" />
                        <path d={speedPath} fill="none" className="stroke-kb-blue" strokeWidth={2.5} data-chart-line="speed" />
                    </>
                ) : points.length === 1 ? (
                    <>
                        <circle cx={xOf(0)} cy={lastAccY} r={3.5} className="fill-kb-purple" data-chart-line="accuracy" />
                        <circle cx={xOf(0)} cy={lastSpeedY} r={4} className="fill-kb-blue" data-chart-line="speed" />
                    </>
                ) : null}
                {points.length > 0 && (
                    <>
                        <g transform={`translate(${M.left + plotW + 46}, ${speedLabelY})`}>
                            <line x1={0} x2={16} y1={0} y2={0} className="stroke-kb-blue" strokeWidth={2.5} />
                            <text x={20} dy="0.32em" className="text-xs font-medium fill-kb-ink">Speed</text>
                        </g>
                        <g transform={`translate(${M.left + plotW + 46}, ${accLabelY})`}>
                            <line x1={0} x2={16} y1={0} y2={0} className="stroke-kb-purple" strokeWidth={2} strokeDasharray="6 4" />
                            <text x={20} dy="0.32em" className="text-xs font-medium fill-kb-ink">Accuracy</text>
                        </g>
                    </>
                )}
                {hovered && (
                    <line x1={xOf(hover!)} x2={xOf(hover!)} y1={M.top} y2={M.top + plotH} className="stroke-kb-ink/40" strokeWidth={1} />
                )}
            </svg>
            {hovered && (
                <div
                    role="presentation"
                    className="pointer-events-none absolute top-2 z-10 rounded-md border border-kb-gray-border bg-kb-surface px-3 py-2 text-xs text-kb-ink shadow-lg whitespace-nowrap"
                    style={{ left: Math.max(0, Math.min((xOf(hover!) + 8) * scale, shown - 180)) }}
                >
                    <div className="font-medium">{axis === "lessons" ? formatDateTime(hovered.ts) : `${formatDate(hovered.ts)} · ${hovered.count} ${hovered.count === 1 ? "lesson" : "lessons"}`}</div>
                    <div className="tabular-nums">{formatSpeed(hovered.speed, unit)} {unitLabel} · {(hovered.accuracy * 100).toFixed(1)}%{hovered.type ? ` · ${lessonTypeLabel(hovered.type)}` : ""}</div>
                </div>
            )}
        </div>
    );
}

export default SpeedChart;
