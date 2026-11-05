/**
 * Dual-legend keys (prototype, owner review: ?legendStyle=stacked|diagonal|corner).
 *
 * A plain key whose shifted output is a different character (digits and
 * punctuation, never letters or special keys) also shows its shifted symbol,
 * like a printed keycap: `/` shows `?` on US English. The shifted symbol comes
 * from the International keyboards setting (LAYOUTS in Keyboards/layouts.ts,
 * which already holds every layout's shift row).
 *
 * Off unless the URL has the param. The value lives in the URL; the review
 * switcher (LegendStyleSwitcher) changes it in place with replaceState.
 */
import { useSyncExternalStore } from "react";
import { getLabelForKeycode, US_SHIFT_ALIASES } from "@/components/Keyboards/layouts";
import type { KeyContent } from "@/types/keyboard.types";

export const LEGEND_STYLES = ["stacked", "diagonal", "corner"] as const;
export type LegendStyle = typeof LEGEND_STYLES[number];
export const LEGEND_STYLE_PARAM = "legendStyle";

/** The style asked for in the URL; absent or unknown is null (one legend, as today). */
export function legendStyleFromSearch(search: string): LegendStyle | null {
    let value: string | null = null;
    try {
        value = new URLSearchParams(search).get(LEGEND_STYLE_PARAM);
    } catch {
        value = null;
    }
    const v = value?.trim().toLowerCase();
    return (LEGEND_STYLES as readonly string[]).includes(v ?? "") ? (v as LegendStyle) : null;
}

/** True when the URL names the param at all (the switcher shows only then). */
export function legendStyleParamPresent(search: string): boolean {
    try { return new URLSearchParams(search).has(LEGEND_STYLE_PARAM); } catch { return false; }
}

const listeners = new Set<() => void>();
const currentSearch = () => (typeof location === "undefined" ? "" : location.search);

/** Set the style in the URL (replaceState, no reload) and re-render every key. */
export function setLegendStyle(style: LegendStyle | "off") {
    if (typeof location === "undefined") return;
    const url = new URL(location.href);
    url.searchParams.set(LEGEND_STYLE_PARAM, style);
    history.replaceState(history.state, "", url);
    listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const onPop = () => listener();
    window.addEventListener("popstate", onPop);
    return () => { listeners.delete(listener); window.removeEventListener("popstate", onPop); };
}

/** The style in effect, live. */
export function useLegendStyle(): LegendStyle | null {
    const search = useSyncExternalStore(subscribe, currentSearch, () => "");
    return legendStyleFromSearch(search);
}

/** True when the param is in the URL (any value, "off" too). */
export function useLegendStyleParam(): boolean {
    const search = useSyncExternalStore(subscribe, currentSearch, () => "");
    return legendStyleParamPresent(search);
}

export interface DualLegend {
    base: string;
    shifted: string;
}

const PLAIN_KEYCODE = /^KC_[A-Z0-9_]+$/;
/** Key kinds that draw their base key in the middle, with a band above or below it. */
const WRAPPED_TYPES = new Set(["modmask", "modtap", "layerhold"]);

/**
 * The base and shifted legends of a plain key on this OS layout, or null when
 * the key keeps one legend: special keycodes, keys whose shift is
 * only the capital letter (or nothing), and keys the layout doesn't hold.
 * `label` is what the key would draw today; a key drawing something else
 * (the picker while Shift is on) keeps that one legend.
 */
export function dualLegendFor(
    keycode: string,
    label: string,
    keyContents: KeyContent | undefined,
    layoutId: string
): DualLegend | null {
    // A modifier (LCTL(KC_1)), mod-tap (LCTL_T(KC_2)) or layer-tap (LT1(KC_3)) draws its
    // base key in the middle; that key gets both legends too, between the key's bands. A
    // Shift-wrapped key already draws its shifted symbol ($ for LSFT(KC_4)) and keeps it.
    // Today such a key draws the first line of its base key's name, which for the digits is
    // the shifted symbol ("!" for LCTL(KC_1)); the two legends say which is which.
    let code = keycode.toUpperCase();
    let wrapped = false;
    if (keyContents?.type) {
        if (!WRAPPED_TYPES.has(keyContents.type)) return null;
        const m = /^([A-Z0-9_]+)\((KC_[A-Z0-9_]+)\)$/.exec(code);
        if (!m) return null;
        const wrapper = m[1];
        const shifted = (typeof keyContents.modids === "number" && (keyContents.modids & 0x0200) !== 0) ||
            (!/^LT\d/.test(wrapper) && wrapper.includes("S")) || /^(MEH|HYPR|ALL)(_T)?$/.test(wrapper);
        if (shifted) return null;
        code = m[2];
        wrapped = true;
    }
    if (!PLAIN_KEYCODE.test(code)) return null;
    if (code in US_SHIFT_ALIASES) return null; // already a shifted symbol (KC_QUES)
    // Numpad (KC_KP_*, KC_P1, KC_PDOT...) and KC_PSCR-style keys: never dual. KC_P is a letter.
    if (code.startsWith("KC_KP_") || code.startsWith("KC_P")) return null;
    const base = getLabelForKeycode(code, layoutId);
    const shifted = getLabelForKeycode(`LSFT(${code})`, layoutId);
    if (!base || !shifted) return null;
    if (base.length > 2 || shifted.length > 2) return null; // "Space", "enter", "backsp"
    if (base.toLocaleUpperCase() === shifted.toLocaleUpperCase()) return null; // letters, same symbol
    if (!wrapped && label && label !== base && label.toLocaleUpperCase() !== base.toLocaleUpperCase()) return null;
    return { base, shifted };
}

/**
 * Legend font size (px) per key size, the same for both legends. Keys are
 * 60 / 45 / 30 px (default / medium / small); the picker draws small keys,
 * zoomed to 24-30 px. A legend gets smaller only when its key's room can't
 * hold it whole (fitDualLegend).
 */
export const DUAL_LEGEND_FONT_PX = { default: 15, medium: 12, small: 10 } as const;

/**
 * Line height of a legend, in em. Inter's tallest legend ink runs from 1.00 em above the
 * baseline (Å) to 0.24 em below it (|), measured with canvas measureText at weight 600 over
 * every legend in LAYOUTS; its content area is 0.97 + 0.24 em. At 1.3 the line box holds
 * all of that, so a legend's box is its ink's box and fitting boxes fits glyphs. (At 1.0,
 * as before, the ink of | { } ( ) [ ] @ $ ran 0.1 em past the box on each side.)
 */
export const DUAL_LEGEND_LINE_HEIGHT = 1.3;

/** Band height (px) along a key's top or bottom (mod-tap, layer-tap, modifier), per key size. */
export const KEY_BAND_PX = { default: 18, medium: 14, small: 10 } as const;

/** Stacked: gap between the two lines (px), per key size. */
export const STACKED_GAP_PX = { default: 3, medium: 2, small: 1 } as const;

/** Corner: inset of the legends from the key edge (px), per key size. */
export const DUAL_LEGEND_INSET_PX = { default: 7, medium: 5, small: 2 } as const;

/**
 * Diagonal: shifted upper right, base lower left, pulled in from the corners toward the
 * middle. `x` is each legend's inset from its side, `y` from the top or bottom of the
 * room between the key's bands. On a key with a band the room is shorter than two lines,
 * so the legends overlap in height; they never overlap in width, since
 * 2x + the two glyphs' widths stays within the key (widest pair "@ 2" at 10px: 16px of 28).
 */
export const DIAGONAL_INSET_PX = {
    default: { x: 12, y: 8 },
    medium: { x: 8, y: 5 },
    small: { x: 4, y: 2 },
} as const;

export type KeySizeName = "default" | "medium" | "small";

/**
 * The legend size and vertical inset that keep both legends whole inside `roomPx`, the
 * height between the key's border and bands. Stacked needs two lines and a gap; diagonal
 * and corner put the legends side by side in height, so they need one line.
 * Sizes step down by 0.5 px.
 */
export function fitDualLegend(style: LegendStyle, size: KeySizeName, roomPx: number): { fontPx: number; insetY: number } {
    const base = DUAL_LEGEND_FONT_PX[size];
    const lines = style === "stacked" ? 2 : 1;
    const gap = style === "stacked" ? STACKED_GAP_PX[size] : 0;
    const fit = (roomPx - gap) / (lines * DUAL_LEGEND_LINE_HEIGHT);
    const fontPx = Math.max(1, Math.min(base, Math.floor(fit * 2) / 2));
    const wantY = style === "diagonal" ? DIAGONAL_INSET_PX[size].y : style === "corner" ? DUAL_LEGEND_INSET_PX[size] : 0;
    const insetY = Math.max(0, Math.min(wantY, (roomPx - fontPx * DUAL_LEGEND_LINE_HEIGHT) / 2));
    return { fontPx, insetY };
}
