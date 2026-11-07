import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useKeyboard } from "@/contexts/KeyboardContext";
import DescriptionBlock from "@/layout/SecondarySidebar/components/DescriptionBlock";
import { cn } from "@/lib/utils";
import { keyboardService } from "@/services/keyboard.service";
import { PointingSensorService, type HandTrace } from "@/services/pointing-sensor.service";
import { SENSOR_BIN_MS, seqDiff, squalStats, type SensorBin } from "@/utils/pointing-sensor";

const WINDOWS_S = [2, 10, 60] as const;
type Hand = 0 | 1;
const HANDS: Hand[] = [0, 1];
const HAND_NAMES = ["Left", "Right"] as const;
const HAND_STROKE = ["var(--kb-chart-left)", "var(--kb-chart-right)"] as const;
const mono = "font-mono tabular-nums";
const sectionTitle = "font-semibold text-lg text-kb-ink";

/** The newest bins covering the window. */
const windowBins = (t: HandTrace, seconds: number): SensorBin[] => t.bins.slice(-Math.round((seconds * 1000) / SENSOR_BIN_MS));

interface Line {
    hand: Hand;
    pick: (b: SensorBin) => number;
    dashed?: boolean;
}

interface ChartProps {
    title: string;
    unit?: string;
    testId: string;
    seconds: number;
    traces: HandTrace[];
    lines: Line[];
    /** A band between two values per bin, behind the lines (SQUAL lowest to highest read). */
    band?: { low: (b: SensorBin) => number; high: (b: SensorBin) => number };
    /** Floor for the top of the scale. */
    minTop: number;
    tall?: boolean;
}

/** Rounds a scale top up to 1, 2, 5 or 10 times a power of ten. */
export function niceTop(v: number): number {
    if (v <= 1) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
}

/** A hand-rolled SVG time plot: the newest bin at the right edge, the window to the left. */
function SensorChart({ title, unit, testId, seconds, traces, lines, band, minTop, tall }: ChartProps) {
    const W = 320, H = tall ? 120 : 76, L = 30, B = 14, T = 6, R = 4;
    const bins = traces.map((t) => windowBins(t, seconds));
    let top = minTop;
    for (const h of HANDS) {
        for (const b of bins[h]) {
            for (const l of lines) if (l.hand === h) top = Math.max(top, l.pick(b));
            if (band) top = Math.max(top, band.high(b));
        }
    }
    top = niceTop(top);
    const X = (hand: Hand, b: SensorBin) => {
        const newest = bins[hand][bins[hand].length - 1].seq;
        const age = (seqDiff(newest, b.seq) * SENSOR_BIN_MS) / 1000;
        return L + (1 - age / seconds) * (W - L - R);
    };
    const Y = (v: number) => H - B - (v / top) * (H - B - T);
    const latest = HANDS.map((h) => {
        const last = bins[h][bins[h].length - 1];
        const mine = lines.filter((l) => l.hand === h);
        return last && mine.length > 0 ? mine.map((l) => l.pick(last)).join("/") : "–";
    });
    return (
        <div className="flex flex-col gap-0.5" data-testid={testId}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold">{title}{unit ? <span className="text-muted-foreground font-normal"> {unit}</span> : null}</span>
                <span className={cn("flex gap-2", mono)}>
                    {HANDS.map((h) => <span key={h} style={{ color: HAND_STROKE[h] }}>{HAND_NAMES[h][0]} {latest[h]}</span>)}
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} over the last ${seconds} seconds`}>
                <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="currentColor" strokeOpacity="0.3" />
                <line x1={L} y1={T} x2={L} y2={H - B} stroke="currentColor" strokeOpacity="0.3" />
                <text x={L - 3} y={T + 7} fontSize="9" fill="currentColor" textAnchor="end">{top}</text>
                <text x={L - 3} y={H - B} fontSize="9" fill="currentColor" textAnchor="end">0</text>
                <text x={L} y={H - 3} fontSize="9" fill="currentColor">-{seconds} s</text>
                <text x={W - R} y={H - 3} fontSize="9" fill="currentColor" textAnchor="end">now</text>
                {band && HANDS.map((h) => {
                    const bs = bins[h];
                    if (bs.length < 2) return null;
                    const up = bs.map((b) => `${X(h, b)},${Y(band.high(b))}`);
                    const down = bs.map((b) => `${X(h, b)},${Y(band.low(b))}`).reverse();
                    return <polygon key={h} points={[...up, ...down].join(" ")} fill={HAND_STROKE[h]} fillOpacity="0.14" stroke="none" />;
                })}
                {lines.map((l, i) => {
                    const bs = bins[l.hand];
                    if (bs.length < 2) return null;
                    return <polyline key={i} points={bs.map((b) => `${X(l.hand, b)},${Y(l.pick(b))}`).join(" ")} fill="none" stroke={HAND_STROKE[l.hand]} strokeWidth="1.5" strokeDasharray={l.dashed ? "3 2" : undefined} />;
                })}
            </svg>
        </div>
    );
}

const sensorName = (t: HandTrace): string => {
    if (!t.seen) return t.stale ? "no trackball data" : "reading...";
    if (!t.present) return "no trackball sensor";
    return t.is3389 ? "PMW3389" : "PMW3360";
};

/**
 * Trackball characterization: how each hand's PMW sensor sees its surface. SQUAL is the
 * sensor's surface quality count. Reads POINTING_SENSOR (Sval 0x39) while this panel is
 * open; nothing is written to the keyboard.
 */
const TrackballPanel = () => {
    const { isConnected, connect, keyboard } = useKeyboard();
    const supported = isConnected && keyboardService.hasPointingSensor(keyboard);
    const service = useMemo(() => new PointingSensorService({
        read: (hand, cursor) => (keyboard ? keyboardService.getPointingSensorSamples(keyboard, hand, cursor) : Promise.resolve(null)),
    }), [keyboard]);
    useSyncExternalStore(service.subscribe, service.snapshot);
    const [seconds, setSeconds] = useState<number>(10);

    useEffect(() => {
        if (!supported) return;
        return service.start();
    }, [service, supported]);

    if (!isConnected) {
        return (
            <section className="h-full flex flex-col pt-2">
                <DescriptionBlock>
                    <button onClick={() => connect()} className="underline underline-offset-2 hover:text-foreground transition-all text-inherit">
                        Connect
                    </button>
                    {" a keyboard to characterize its trackballs."}
                </DescriptionBlock>
            </section>
        );
    }
    if (!supported) {
        return (
            <section className="h-full flex flex-col pt-2">
                <DescriptionBlock>This keyboard's firmware doesn't report trackball sensor data. Update the firmware to use this panel.</DescriptionBlock>
            </section>
        );
    }

    const traces = HANDS.map((h) => service.trace(h));
    const stats = traces.map((t) => squalStats(windowBins(t, seconds), t.resetSeq));
    const anyBins = traces.some((t) => t.bins.length > 0);

    return (
        <section className="h-full flex flex-col pt-2 overflow-y-auto" data-testid="trackball-panel">
            <DescriptionBlock>
                SQUAL is the sensor's count of surface features it can track. Watch it while the ball rests and while you roll it.
            </DescriptionBlock>
            <div className="flex flex-col gap-4 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1" role="group" aria-label="Window">
                        {WINDOWS_S.map((w) => (
                            <Button key={w} size="sm" variant={seconds === w ? "default" : "secondary"} onClick={() => setSeconds(w)} aria-pressed={seconds === w} data-testid={`window-${w}`}>
                                {w} s
                            </Button>
                        ))}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => service.resetExtremes()} data-testid="reset-extremes">Reset min/max</Button>
                </div>

                <div className="grid gap-2 grid-cols-2">
                    {HANDS.map((h) => {
                        const t = traces[h], s = stats[h];
                        const lifted = t.bins.length > 0 && t.bins[t.bins.length - 1].lifted;
                        return (
                            <div key={h} className="panel-layer-item p-2 rounded-md text-xs flex flex-col gap-0.5" data-testid={`sensor-${h}`}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-semibold text-sm" style={{ color: HAND_STROKE[h] }}>{HAND_NAMES[h]}</span>
                                    <span className="text-muted-foreground">{sensorName(t)}</span>
                                </div>
                                {s ? (
                                    <>
                                        <div className="flex items-baseline gap-1">
                                            <span className={cn("text-2xl font-semibold", mono)} data-testid={`squal-live-${h}`}>{s.live}</span>
                                            <span className="text-muted-foreground">SQUAL now</span>
                                        </div>
                                        <span className={mono}>average <b data-testid={`squal-avg-${h}`}>{s.avg.toFixed(1)}</b></span>
                                        <span className={mono}>min <b data-testid={`squal-min-${h}`}>{s.min}</b> · max <b data-testid={`squal-max-${h}`}>{s.max}</b></span>
                                        {lifted && <span className="text-muted-foreground">ball lifted</span>}
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">no samples yet</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-1">
                    <span className={sectionTitle}>SQUAL</span>
                    <SensorChart
                        title="Surface quality" testId="chart-squal" seconds={seconds} traces={traces} minTop={20} tall
                        lines={HANDS.map((h) => ({ hand: h, pick: (b: SensorBin) => b.squalMean }))}
                        band={{ low: (b) => b.squalMin, high: (b) => b.squalMax }}
                    />
                    <p className="text-[11px] text-muted-foreground">The line is the mean over each 50 ms; the shading runs from the lowest to the highest single read.</p>
                </div>

                <div className="flex flex-col gap-2">
                    <span className={sectionTitle}>Other sensor readings</span>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <SensorChart title="Shutter" unit="sensor units" testId="chart-shutter" seconds={seconds} traces={traces} minTop={10}
                            lines={HANDS.map((h) => ({ hand: h, pick: (b: SensorBin) => b.shutter }))} />
                        <SensorChart title="Raw data sum" testId="chart-rawsum" seconds={seconds} traces={traces} minTop={10}
                            lines={HANDS.map((h) => ({ hand: h, pick: (b: SensorBin) => b.rawSum }))} />
                        <SensorChart title="Raw max / min (dashed)" testId="chart-rawminmax" seconds={seconds} traces={traces} minTop={10}
                            lines={[...HANDS.map((h) => ({ hand: h, pick: (b: SensorBin) => b.rawMax })), ...HANDS.map((h) => ({ hand: h, pick: (b: SensorBin) => b.rawMin, dashed: true }))]} />
                        <SensorChart title="Reads with motion" unit="per 50 ms" testId="chart-motion" seconds={seconds} traces={traces} minTop={10}
                            lines={HANDS.map((h) => ({ hand: h, pick: (b: SensorBin) => b.moving }))} />
                    </div>
                </div>
                {!anyBins && <p className="text-xs text-muted-foreground" data-testid="trackball-waiting">Waiting for the keyboard's first samples. A half without a trackball sensor stays empty.</p>}
            </div>
        </section>
    );
};

export default TrackballPanel;
