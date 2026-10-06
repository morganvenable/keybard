import { contrastRatio, DARK_PAGE_BG, KB_INK_VAR } from "@/lib/theme";

/**
 * Dark-mode colour helpers for the 3D layer view (Keyboard.tsx).
 *
 * In dark mode the layer backdrop is drawn with mix-blend-mode: screen over the dark
 * page, and the 3D layer label sits inside that backdrop's top-left corner. Contrast
 * must therefore be measured against the composited backdrop, not the bare page.
 * None of this runs in light mode.
 */

/** Must equal --kb-ink in .dark (src/index.css). */
export const DARK_INK_HEX = "#f1f2f2";

function parse(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const h = m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
    return "#" + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
}

/**
 * Colour of a layer backdrop `rgba(layerHex, alpha)` drawn with mix-blend-mode: screen
 * over `pageHex`: Cr = (1 - a) * Cb + a * screen(Cs, Cb), screen = Cs + Cb - Cs * Cb.
 * Returns the page colour when either input is not a 6-digit hex.
 */
export function screenedBackdropHex(layerHex: string, alpha: number, pageHex: string = DARK_PAGE_BG): string {
    const s = parse(layerHex);
    const b = parse(pageHex);
    if (!b) return pageHex;
    if (!s) return pageHex;
    const a = Math.min(1, Math.max(0, alpha));
    const out = s.map((cs, i) => {
        const S = cs / 255;
        const B = b[i] / 255;
        const screen = S + B - S * B;
        return ((1 - a) * B + a * screen) * 255;
    }) as [number, number, number];
    return toHex(out);
}

/**
 * Text colour for the 3D layer label in dark mode. Keeps `labelHex` when it reaches
 * 4.5:1 against the composited backdrop. Otherwise returns whichever of `labelHex`,
 * kb-ink (returned as the CSS var) and black has the highest contrast: bright active
 * backdrops (white, light-grey, yellow, orange) need black, dim ones need kb-ink.
 */
export function dark3DLabelColor(labelHex: string, backdropHex: string): string {
    const original = contrastRatio(labelHex, backdropHex);
    if (Number.isNaN(original)) return labelHex;
    if (original >= 4.5) return labelHex;
    const candidates: Array<[string, number]> = [
        [labelHex, original],
        [KB_INK_VAR, contrastRatio(DARK_INK_HEX, backdropHex)],
        ["#000000", contrastRatio("#000000", backdropHex)],
    ];
    return candidates.reduce((best, c) => (c[1] > best[1] ? c : best))[0];
}

/**
 * True when a non-text indicator (status ring / dot) of colour `hex` falls below the
 * WCAG 3:1 non-text contrast against `bgHex`, so dark mode should add a separating outline.
 */
export function needsDarkIndicatorOutline(hex: string, bgHex: string = DARK_PAGE_BG): boolean {
    const ratio = contrastRatio(hex, bgHex);
    return !Number.isNaN(ratio) && ratio < 3;
}
