/** Keybard's automatic sizing: choose the largest keys that fit both dimensions. */
export function fittingKeyVariant(width: number, height: number, widths: Record<"default" | "medium" | "small", number>, heights: Record<"default" | "medium" | "small", number>) {
    return (["default", "medium", "small"] as const).find(size => width >= widths[size] && height >= heights[size]) ?? "small";
}
