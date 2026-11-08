import React, { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { canvasMeasurer, planTileLabel, TILE_LABEL_LINE_HEIGHT, type TileLabelPlan, type TileSize } from "@/lib/tileLabel";

/* Web fonts load after the first paint: plans made before then measured a fallback font. */
let fontEpoch = 0;
const fontListeners = new Set<() => void>();
let fontsHooked = false;
function subscribeFonts(cb: () => void) {
    fontListeners.add(cb);
    if (!fontsHooked && typeof document !== "undefined" && document.fonts) {
        fontsHooked = true;
        const bump = () => { fontEpoch++; measurers.clear(); fontListeners.forEach((l) => l()); };
        document.fonts.addEventListener?.("loadingdone", bump);
        document.fonts.ready?.then(bump).catch(() => {});
    }
    return () => { fontListeners.delete(cb); };
}
const getFontEpoch = () => fontEpoch;

const measurers = new Map<string, ReturnType<typeof canvasMeasurer>>();
function measurerFor(family: string, weight: string, upper: boolean) {
    const key = `${family}|${weight}|${upper}`;
    let m = measurers.get(key);
    if (!m) { m = canvasMeasurer(family, weight, upper); measurers.set(key, m); }
    return m;
}

interface Box { w: number; h: number; family: string; weight: string; upper: boolean }

interface Props {
    /** The label as the tile would show it ("\n" and spaces separate words). */
    text: string;
    /** Curated short name, used only when the full name cannot fit. */
    shortText?: string;
    size: TileSize;
    nominalPx: number;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * A tile's center label, fitted to the tile (see src/lib/tileLabel.ts): it wraps only
 * between words, shrinks to the readable minimum, and only then takes a short name.
 * It measures its own box, so it fits whatever size the tile is drawn at.
 */
export function FittedLabel({ text, shortText, size, nominalPx, className, style }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState<Box | null>(null);
    const epoch = useSyncExternalStore(subscribeFonts, getFontEpoch, getFontEpoch);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const read = () => {
            const cs = getComputedStyle(el);
            const w = el.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
            const h = el.clientHeight - parseFloat(cs.paddingTop || "0") - parseFloat(cs.paddingBottom || "0");
            const next: Box = { w, h, family: cs.fontFamily || "sans-serif", weight: cs.fontWeight || "600", upper: cs.textTransform === "uppercase" };
            setBox((prev) => (prev && prev.w === next.w && prev.h === next.h && prev.family === next.family && prev.weight === next.weight && prev.upper === next.upper ? prev : next));
        };
        read();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const plan = useMemo<TileLabelPlan | null>(() => {
        if (!box || box.w <= 0 || box.h <= 0) return null;
        // Half a pixel of room is kept on each side for antialiasing.
        return planTileLabel(text, { widthPx: box.w - 1, heightPx: box.h }, {
            size,
            nominalPx,
            shortLabel: shortText,
            measure: measurerFor(box.family, box.weight, box.upper),
        });
        // epoch: re-plan once web fonts have loaded.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [box, text, shortText, size, nominalPx, epoch]);

    return (
        <div ref={ref} className={cn(className, "min-w-0 min-h-0")} style={{ ...style, fontSize: plan ? plan.fontPx : nominalPx }} data-tile-text="" data-tile-label={plan ? (plan.broken ? "broken" : plan.short ? "short" : "full") : undefined}>
            {plan ? (
                <span className="flex flex-col items-center" style={{ lineHeight: TILE_LABEL_LINE_HEIGHT }}>
                    {plan.lines.map((line, i) => (
                        <span key={i} className="whitespace-nowrap">{line}</span>
                    ))}
                </span>
            ) : (
                <span className="whitespace-pre-line">{text}</span>
            )}
        </div>
    );
}
