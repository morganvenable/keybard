import { useEffect, useRef } from "react";

import { formatMm, TOUCH_EV, type PadTouchBlock, type TouchOutcome } from "@/utils/touchpad-tuning";

export interface PadTiming {
    deadZone: number; // 0.01 mm
    tapMs: number;
    holdMs: number;
    holdOn: boolean;
    width: number; // 0.01 mm
    height: number;
}

interface PadViewProps {
    side: "left" | "right";
    /** The pad's latest block, and when it was read (performance.now()). */
    block: PadTouchBlock;
    readAt: number;
    /** Events of the touch now, or of the last one. */
    touchEvents: number;
    /** Where that touch has been, 0.01 mm. */
    trail: { x: number; y: number }[];
    timing: PadTiming;
    outcomes: TouchOutcome[];
    /** "ring": a timer ring around the dead zone in the close-up; "bar": a timeline under the pad. */
    timer: "ring" | "bar";
}

/** The close-up's size on screen, CSS px. */
const CLOSE_PX = 168;

/** An arc from fraction a to b of a full circle, clockwise from the top. */
function arc(cx: number, cy: number, r: number, a: number, b: number): string {
    const p = (f: number) => [cx + r * Math.sin(2 * Math.PI * f), cy - r * Math.cos(2 * Math.PI * f)];
    if (b <= a) return "";
    if (b - a >= 0.9999) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
    const [x1, y1] = p(a), [x2, y2] = p(b);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${b - a > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
}

const KIND_TONE: Record<TouchOutcome["kind"], string> = {
    tap: "text-kb-touch-tap", right: "text-kb-touch-tap", hold: "text-kb-touch-hold", canceled: "text-kb-touch-cancel",
    late: "text-muted-foreground", short: "text-muted-foreground", moved: "text-muted-foreground", scroll: "text-muted-foreground",
};

function markOf(events: number): { text: string; tone: string; cancel: boolean } | null {
    if (events & TOUCH_EV.twoTap) return { text: "Right click", tone: "var(--kb-touch-tap)", cancel: false };
    if (events & TOUCH_EV.hold) return { text: "Hold", tone: "var(--kb-touch-hold)", cancel: false };
    if (events & TOUCH_EV.tap) return { text: "Tap", tone: "var(--kb-touch-tap)", cancel: false };
    if (events & TOUCH_EV.drift) return { text: "Canceled", tone: "var(--kb-touch-cancel)", cancel: true };
    return null;
}

/**
 * One pad: at its true size, with the finger and where it touched down, and a
 * close-up of the touch-down point. The close-up shows the dead zone, the path
 * the finger took, how long it has been down against the tap window and the
 * hold threshold, and a mark when a tap or a hold fires or the touch leaves
 * the dead zone in time to cancel them. Redraws per frame only while a finger
 * is down, and only the timer.
 */
export function PadView({ side, block, readAt, touchEvents, trail, timing, outcomes, timer }: PadViewProps) {
    const progressRef = useRef<SVGPathElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const msRef = useRef<HTMLSpanElement>(null);
    const total = timing.tapMs + (timing.holdOn ? timing.holdMs : 0);
    const barSpan = Math.max(total * 1.25, timing.tapMs + 200);
    const { down } = block;
    const dz = Math.max(timing.deadZone, 10);
    // The close-up: the dead zone takes half its width, with the ring outside it.
    const half = dz * 2;
    const ringR = dz * 1.45, ringW = dz * 0.16;
    const cx = block.downX, cy = block.downY;

    useEffect(() => {
        const draw = (ms: number) => {
            if (progressRef.current) progressRef.current.setAttribute("d", arc(cx, cy, ringR, 0, Math.min(1, ms / total)));
            if (cursorRef.current) cursorRef.current.style.left = `${Math.min(100, (ms / barSpan) * 100)}%`;
            if (msRef.current) msRef.current.textContent = `${Math.round(ms)} ms`;
        };
        if (!down) { draw(block.ms); return; }
        let frame = 0;
        const tick = () => {
            const ms = block.ms + (performance.now() - readAt);
            draw(ms);
            // Past the bar's end nothing more can happen to this touch: stop redrawing.
            if (ms < barSpan) frame = requestAnimationFrame(tick);
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [down, block.ms, readAt, cx, cy, ringR, total, barSpan]);

    const label = side === "left" ? "Left pad" : "Right pad";
    const shown = block.valid && (block.down || block.ms > 0);
    const mark = shown ? markOf(touchEvents) : null;
    const zoneTone = block.outside ? "var(--kb-touch-cancel)" : "var(--kb-touch-zone)";
    const path = trail.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
    const mmWide = (2 * half) / 100;
    const zoom = Math.round(CLOSE_PX / (mmWide * 3.7795));

    return (
        <section aria-label={label} data-pad={side} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <h4 className="text-sm font-semibold text-kb-ink">{label}</h4>
                {block.valid && (
                    <span className="text-xs tabular-nums text-muted-foreground" data-pad-readout>
                        {block.down ? "down " : shown ? "last touch " : ""}<span ref={msRef} className={shown ? "" : "sr-only"} />
                        {shown && <> · moved {formatMm(block.farthest)} of {formatMm(timing.deadZone)}</>}
                    </span>
                )}
            </div>
            {!block.valid ? (
                <p className="text-xs text-muted-foreground" data-pad-absent>No touchpad on this hand, or it isn't answering.</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-start gap-3">
                        <svg
                            role="img"
                            aria-label={`${label} at true size, ${block.down ? `${block.fingers} finger${block.fingers === 1 ? "" : "s"} down` : "no finger"}`}
                            viewBox={`0 0 ${timing.width} ${timing.height}`}
                            style={{ width: `${timing.width / 100}mm`, height: `${timing.height / 100}mm` }}
                            className="block shrink-0"
                            data-pad-svg
                        >
                            <rect x={20} y={20} width={timing.width - 40} height={timing.height - 40} rx={300} fill="var(--kb-touch-pad)" stroke="var(--kb-touch-edge)" strokeWidth={40} />
                            {shown && (
                                <g data-touch={block.down ? "down" : "up"}>
                                    <path d={path} fill="none" stroke="var(--kb-touch-zone)" strokeWidth={30} />
                                    <circle cx={cx} cy={cy} r={90} fill="none" stroke={zoneTone} strokeWidth={30} />
                                    {block.down && <circle cx={block.x} cy={block.y} r={260} fill="var(--kb-touch-finger)" fillOpacity={0.2} data-finger />}
                                    {block.down && <circle cx={block.x} cy={block.y} r={70} fill="var(--kb-touch-finger)" />}
                                    {mark && <text x={Math.min(block.x + 200, timing.width - 1300)} y={Math.max(block.y - 200, 330)} fontSize={280} fontWeight={600} fill={mark.tone} data-mark={mark.text}>{mark.text}</text>}
                                </g>
                            )}
                        </svg>
                        <figure className="m-0 flex shrink-0 flex-col gap-0.5">
                            <svg
                                role="img"
                                aria-label={`${label} close-up of the dead zone, ${zoom} times`}
                                viewBox={`${cx - half} ${cy - half} ${2 * half} ${2 * half}`}
                                width={CLOSE_PX}
                                height={CLOSE_PX}
                                className="block overflow-hidden rounded-md border border-kb-gray-border"
                                style={{ background: "var(--kb-touch-pad)" }}
                                data-close-up
                            >
                                {shown ? (
                                    <>
                                        <circle cx={cx} cy={cy} r={dz} fill="none" stroke={zoneTone} strokeWidth={dz * 0.06} data-dead-zone />
                                        {timer === "ring" && (
                                            <g data-timer-ring>
                                                <path d={arc(cx, cy, ringR, 0, timing.tapMs / total)} fill="none" stroke="var(--kb-touch-tap)" strokeOpacity={0.4} strokeWidth={ringW} />
                                                {timing.holdOn && <path d={arc(cx, cy, ringR, timing.tapMs / total, 1)} fill="none" stroke="var(--kb-touch-hold)" strokeOpacity={0.4} strokeWidth={ringW} />}
                                                <path ref={progressRef} fill="none" stroke="var(--kb-touch-finger)" strokeWidth={ringW * 0.45} />
                                            </g>
                                        )}
                                        <path d={path} fill="none" stroke="var(--kb-touch-finger)" strokeWidth={dz * 0.04} strokeLinejoin="round" data-path />
                                        <circle cx={cx} cy={cy} r={dz * 0.05} fill="var(--kb-touch-zone)" />
                                        {block.down && <circle cx={block.x} cy={block.y} r={dz * 0.11} fill="var(--kb-touch-finger)" />}
                                        {mark?.cancel && (() => {
                                            const out = trail.find((p) => Math.hypot(p.x - cx, p.y - cy) > timing.deadZone) ?? { x: block.x, y: block.y };
                                            const k = dz * 0.14;
                                            return <path d={`M ${out.x - k} ${out.y - k} L ${out.x + k} ${out.y + k} M ${out.x + k} ${out.y - k} L ${out.x - k} ${out.y + k}`} stroke="var(--kb-touch-cancel)" strokeWidth={dz * 0.07} data-cancel-point />;
                                        })()}
                                        {mark && !mark.cancel && <circle cx={block.x} cy={block.y} r={dz * 0.16} fill="none" stroke={mark.tone} strokeWidth={dz * 0.07} />}
                                    </>
                                ) : (
                                    <circle cx={cx} cy={cy} r={dz} fill="none" stroke="var(--kb-touch-edge)" strokeWidth={dz * 0.04} />
                                )}
                            </svg>
                            <figcaption className="text-xs text-muted-foreground">Close-up, {zoom}× · dead zone {formatMm(timing.deadZone)}</figcaption>
                        </figure>
                    </div>
                    {timer === "bar" && (
                        <div className="relative h-3 w-full max-w-[22rem] overflow-hidden rounded-sm border border-kb-gray-border" data-timer-bar
                            aria-label={`Tap within ${timing.tapMs} ms${timing.holdOn ? `, hold at ${total} ms` : ""}`} role="img">
                            <div className="absolute inset-y-0 left-0 bg-kb-touch-tap/40" style={{ width: `${(timing.tapMs / barSpan) * 100}%` }} />
                            {timing.holdOn && <div className="absolute inset-y-0 bg-kb-touch-hold/40" style={{ left: `${(timing.tapMs / barSpan) * 100}%`, width: `${(timing.holdMs / barSpan) * 100}%` }} />}
                            {shown && <div ref={cursorRef} className="absolute inset-y-0 w-0.5 bg-kb-ink" />}
                        </div>
                    )}
                    {timer === "bar" && (
                        <div className="flex max-w-[22rem] justify-between text-[11px] tabular-nums text-muted-foreground">
                            <span>tap until {timing.tapMs} ms</span>{timing.holdOn && <span>hold at {total} ms</span>}
                        </div>
                    )}
                    {block.os && <p className="text-xs text-muted-foreground" data-pad-os>The computer has this pad as a touchpad now: these are the chip's decisions, but the computer's own touchpad settings make the clicks.</p>}
                    <ol className="flex flex-col gap-0.5 text-xs" aria-label={`${label}: last touches`} data-outcomes>
                        {outcomes.length === 0 && <li className="text-muted-foreground">Touch the pad: each touch shows here, with why it clicked or didn't.</li>}
                        {outcomes.map((o, i) => <li key={outcomes.length - i} className={KIND_TONE[o.kind]} data-outcome={o.kind}>{o.text}</li>)}
                    </ol>
                </>
            )}
        </section>
    );
}
