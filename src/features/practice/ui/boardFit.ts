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

export function fitBoard(containerWidth: number, boardUnits: number, { allowScale = true }: { allowScale?: boolean } = {}): BoardFit {
    // Not measured yet (first render, or no layout engine): the medium board.
    if (!(containerWidth > 0)) return { variant: "medium", unit: UNIT_PX.medium, scale: 1, hidden: false };
    for (const variant of ["default", "medium", "small"] as const) {
        if (boardUnits * UNIT_PX[variant] + GUTTER <= containerWidth) return { variant, unit: UNIT_PX[variant], scale: 1, hidden: false };
    }
    if (!allowScale) return { variant: "small", unit: UNIT_PX.small, scale: 1, hidden: false };
    const scale = (containerWidth - GUTTER) / (boardUnits * UNIT_PX.small);
    if (scale >= MIN_BOARD_SCALE) return { variant: "small", unit: UNIT_PX.small, scale, hidden: false };
    return { variant: "small", unit: UNIT_PX.small, scale: MIN_BOARD_SCALE, hidden: true };
}

/**
 * The width of an element, re-read after the panel's 320 ms margin transition settles rather than
 * on every frame of it (§5.1 "Panel effect on size").
 */
export function useSettledWidth(ref: RefObject<HTMLElement | null>, settleMs = 340): number {
    const [width, setWidth] = useState(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setWidth(el.clientWidth);
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setWidth(el.clientWidth), settleMs);
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (timer.current) clearTimeout(timer.current);
        };
    }, [ref, settleMs]);
    return width;
}
