/**
 * Dual-legend keys (prototype, owner review: ?legendStyle=stacked|corner|keycap).
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

export const LEGEND_STYLES = ["stacked", "corner", "keycap"] as const;
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

/**
 * The base and shifted legends of a plain key on this OS layout, or null when
 * the key keeps one legend: modified or special keycodes, keys whose shift is
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
    if (keyContents?.type) return null;
    const code = keycode.toUpperCase();
    if (!PLAIN_KEYCODE.test(code)) return null;
    if (code in US_SHIFT_ALIASES) return null; // already a shifted symbol (KC_QUES)
    // Numpad (KC_KP_*, KC_P1, KC_PDOT...) and KC_PSCR-style keys: never dual. KC_P is a letter.
    if (code.startsWith("KC_KP_") || code.startsWith("KC_P")) return null;
    const base = getLabelForKeycode(code, layoutId);
    const shifted = getLabelForKeycode(`LSFT(${code})`, layoutId);
    if (!base || !shifted) return null;
    if (base.length > 2 || shifted.length > 2) return null; // "Space", "enter", "backsp"
    if (base.toLocaleUpperCase() === shifted.toLocaleUpperCase()) return null; // letters, same symbol
    if (label && label !== base && label.toLocaleUpperCase() !== base.toLocaleUpperCase()) return null;
    return { base, shifted };
}

/**
 * Legend font size (px) per key size, the same for both legends. Keys are
 * 60 / 45 / 30 px (default / medium / small); the picker draws small keys,
 * zoomed to 24-30 px. Chosen so two lines stay inside the key with room for
 * the 1px border and the hover ring.
 */
export const DUAL_LEGEND_FONT_PX = {
    stacked: { default: 15, medium: 12, small: 10 },
    corner: { default: 15, medium: 12, small: 10 },
    keycap: { default: 15, medium: 12, small: 10 },
} as const satisfies Record<LegendStyle, Record<"default" | "medium" | "small", number>>;

/** Inset of the corner legends from the key edge (px), per key size. */
export const DUAL_LEGEND_INSET_PX = { default: 7, medium: 5, small: 2 } as const;
