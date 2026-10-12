import { fittingKeyVariant } from "@/lib/keyboardSizing";
import { useEffect, useRef, useState, type RefObject } from "react";

// Board size rule (spec §5.1): the largest Key.tsx variant whose board fits the container less 32 px;
// below the small board, scale it down to 0.6; below that, hide it behind the floating Board button.

export type KeyVariant = "default" | "medium" | "small";

export const UNIT_PX: Record<KeyVariant, number> = { default: 60, medium: 45, small: 30 };
const GUTTER = 32;
export const MIN_BOARD_SCALE = 0.6;

export interface BoardFit {
    variant: KeyVariant;
    unit: number;
    /** 1 unless the small board is scaled down. */
    scale: number;
    /** Too narrow even at the smallest scale. */
    hidden: boolean;
}

export function fitBoard(containerWidth: number, boardUnits: number, { allowScale = true, height = Infinity, boardHeight = 0 }: { allowScale?: boolean; height?: number; boardHeight?: number } = {}): BoardFit {
    // Not measured yet (first render, or no layout engine): the medium board.
    if (!(containerWidth > 0)) return { variant: "medium", unit: UNIT_PX.medium, scale: 1, hidden: false };
    const widths = { default: boardUnits * 60 + GUTTER, medium: boardUnits * 45 + GUTTER, small: boardUnits * 30 + GUTTER };
    const heights = { default: boardHeight * 60, medium: boardHeight * 45, small: boardHeight * 30 };
    const variant = fittingKeyVariant(containerWidth, height, widths, heights);
    if (widths[variant] <= containerWidth && heights[variant] <= height) return { variant, unit: UNIT_PX[variant], scale: 1, hidden: false };
    if (!allowScale) return { variant: "small", unit: UNIT_PX.small, scale: 1, hidden: false };
    const scale = Math.min((containerWidth - GUTTER) / (boardUnits * UNIT_PX.small), boardHeight > 0 ? height / (boardHeight * UNIT_PX.small) : Infinity);
    if (scale >= MIN_BOARD_SCALE) return { variant: "small", unit: UNIT_PX.small, scale, hidden: false };
    return { variant: "small", unit: UNIT_PX.small, scale: MIN_BOARD_SCALE, hidden: true };
}

/** An element's content width: clientWidth less its horizontal padding (the page frame's px-6, §5.1). */
export function contentWidth(el: HTMLElement): number {
    const style = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
    const padding = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
    return Math.max(0, el.clientWidth - padding);
}

/**
 * The content width of an element (contentWidth), re-read after the panel's 320 ms margin transition settles rather than
 * on every frame of it (§5.1 "Panel effect on size").
 */
export function useSettledWidth(ref: RefObject<HTMLElement | null>, settleMs = 340): number {
    const [width, setWidth] = useState(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setWidth(contentWidth(el));
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setWidth(contentWidth(el)), settleMs);
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (timer.current) clearTimeout(timer.current);
        };
    }, [ref, settleMs]);
    return width;
}

/** Measure the board's remaining viewport space without making its own size part of the budget. */
export function useBoardHeight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
    const [height, setHeight] = useState(Infinity);
    useEffect(() => {
        const frame = ref.current;
        if (!enabled || !frame) return;
        const measure = () => {
            const slot = frame.querySelector<HTMLElement>("[data-board-slot]");
            if (!slot) return;
            const style = getComputedStyle(frame);
            const gap = parseFloat(style.rowGap) || 0;
            let footer = parseFloat(style.paddingBottom) || 0;
            for (let next = slot.nextElementSibling; next; next = next.nextElementSibling) {
                if (getComputedStyle(next).position !== "absolute") footer += next.getBoundingClientRect().height + gap;
            }
            // Keep the minimum readable board on short/mobile screens; allow normal page scrolling.
            setHeight(Math.max(150, window.innerHeight - (slot.getBoundingClientRect().top + window.scrollY) - footer));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(frame);
        Array.from(frame.children).forEach(child => observer.observe(child));
        window.addEventListener("resize", measure);
        return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
    });
    return enabled ? height : Infinity;
}
