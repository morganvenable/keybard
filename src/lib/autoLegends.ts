import { useSyncExternalStore } from "react";
import { LAYOUTS } from "@/components/Keyboards/layouts";

/**
 * Key legends: Automatic. The legends follow the keyboard layout the computer is using right now.
 *
 * Who knows the layout, best first:
 *  1. Keybard Overlay, which reads the layout of the window in front (Windows; Linux on X11).
 *  2. The browser's keyboard map (navigator.keyboard.getLayoutMap, Chromium only).
 *  3. Nobody: keys show English (US), and Settings says so.
 */
export const AUTO_LAYOUT = "auto";

/**
 * The layouts Automatic may pick: each one's base and Shift rows were checked against the
 * Windows layout tables (ToUnicodeEx on every key, both levels, and the AltGr level where a layout
 * has one). Arabic's Shift row is not right yet, and the placeholders that borrow another layout's
 * rows were not checked.
 */
export const AUTO_LAYOUT_IDS = ["us", "us_intl", "uk", "german", "french", "spanish", "italian", "br", "danish", "swiss", "russian"] as const;
const AUTO_SET = new Set<string>(AUTO_LAYOUT_IDS);
export const isAutoLayoutId = (id: unknown): id is string => typeof id === "string" && AUTO_SET.has(id);

/** What Keybard Overlay reports about the computer's layout (its snapshot's osLayout). */
export interface OsLayout {
    /** false: this computer doesn't tell apps its layout (macOS, Wayland). */
    available: boolean;
    /** The Keybard layout for it, or null when Keybard has no legends for it. */
    layoutId?: string | null;
    /** The computer's own name for the layout, such as "Japanese". */
    name?: string | null;
    /** Windows: the keyboard layout ID, such as 00000407. Linux: the xkb layout, such as de. */
    id?: string | null;
}

export interface KeyLegendsStatus {
    /** The layout the keys show. */
    layoutId: string;
    /** Where it came from: the Overlay, the browser, the user's choice, or nothing (US). */
    source: "overlay" | "browser" | "chosen" | "none";
    /** One plain sentence for Settings. Empty for a chosen layout. */
    text: string;
}

const label = (id: string) => LAYOUTS[id]?.label ?? id;

/**
 * The layout the keys show for a Key legends choice.
 * overlay: what a connected Keybard Overlay reports (undefined: none connected, or an older one).
 * browser: what the browser's keyboard map matched (undefined: not known; null: no layout matched).
 */
export function resolveKeyLegends(choice: string, overlay?: OsLayout | null, browser?: string | null): KeyLegendsStatus {
    if (choice !== AUTO_LAYOUT) {
        const layoutId = LAYOUTS[choice] ? choice : "us";
        const text = overlay && !overlay.available
            ? "Automatic doesn't work on this computer because it doesn't tell apps its keyboard layout."
            : "";
        return { layoutId, source: "chosen", text };
    }
    if (overlay?.available) {
        if (isAutoLayoutId(overlay.layoutId)) {
            return { layoutId: overlay.layoutId, source: "overlay", text: `Your computer is using ${label(overlay.layoutId)}, so keys show ${label(overlay.layoutId)}.` };
        }
        const name = overlay.name?.trim();
        return {
            layoutId: "us", source: "overlay",
            text: name
                ? `Keybard has no key legends for ${name} yet, so keys show English (US).`
                : "Keybard has no key legends for your computer's keyboard layout yet, so keys show English (US).",
        };
    }
    if (isAutoLayoutId(browser)) {
        return { layoutId: browser, source: "browser", text: `Your computer is using ${label(browser)}, so keys show ${label(browser)}.` };
    }
    if (browser === null) {
        return { layoutId: "us", source: "browser", text: "Keybard has no key legends for your computer's keyboard layout yet, so keys show English (US)." };
    }
    return {
        layoutId: "us", source: "none",
        text: "Keybard can't tell which keyboard layout your computer uses, so keys show English (US). Choose your layout to change that.",
    };
}

/** The layout Keybard Overlay's own page draws for its configured layoutId. */
export function overlayLayoutFor(configLayout: string | undefined, osLayout?: OsLayout | null): string {
    if (configLayout !== AUTO_LAYOUT) return configLayout && LAYOUTS[configLayout] ? configLayout : "us";
    return osLayout?.available && isAutoLayoutId(osLayout.layoutId) ? osLayout.layoutId : "us";
}

// ---- The browser's keyboard map ----

const ROW1 = ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"];
const ROW2 = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"];
const ROW3 = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"];
const ROW4 = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"];

const printable = (row: string | undefined, skipFirst: boolean) => {
    const tokens = (row ?? "").split(" ");
    return (skipFirst ? tokens.slice(1) : tokens).filter((t) => t && (t === "{cedilla}" || !/^\{.+\}$/.test(t)));
};

/** A layout's unshifted character per KeyboardEvent.code, from its LAYOUTS rows (the rows' key counts place the ISO keys). */
export function layoutCodeMap(layoutId: string): Record<string, string> {
    const rows = LAYOUTS[layoutId]?.default ?? [];
    const map: Record<string, string> = {};
    const put = (codes: string[], tokens: string[]) => codes.forEach((code, i) => { if (tokens[i] !== undefined) map[code] = tokens[i] === "{cedilla}" ? "ç" : tokens[i]; });
    put(ROW1, printable(rows[1], false));
    const r2 = printable(rows[2], true); put(r2.length === 13 ? [...ROW2, "Backslash"] : ROW2, r2);
    const r3 = printable(rows[3], true); put(r3.length === 12 ? [...ROW3, "Backslash"] : ROW3, r3);
    const r4 = printable(rows[4], true);
    put([...(r4.length >= 11 ? ["IntlBackslash"] : []), ...ROW4, ...(r4.length === 12 ? ["IntlRo"] : [])], r4);
    return map;
}

/** US-International types US's base characters, so the browser's map can't tell it from US: it reads as US. */
const BROWSER_LAYOUT_IDS = AUTO_LAYOUT_IDS.filter((id) => id !== "us_intl");

/**
 * The Automatic layout whose unshifted characters match the browser's keyboard map, or null when none does.
 * Each candidate is compared on its own keys; the best must be clearly best (one or two keys off at most,
 * such as a dead key the browser reports differently, and alone at its score).
 */
export function classifyLayoutMap(layoutMap: ReadonlyMap<string, string> | Record<string, string>): string | null {
    const get = (code: string) => (layoutMap instanceof Map ? layoutMap.get(code) : (layoutMap as Record<string, string>)[code]);
    const scores: [string, number][] = [];
    for (const id of BROWSER_LAYOUT_IDS) {
        let misses = 0, compared = 0;
        for (const [code, want] of Object.entries(layoutCodeMap(id))) {
            const got = get(code);
            if (got === undefined) continue;
            compared++;
            if (got.toLowerCase() !== want.toLowerCase()) misses++;
        }
        if (compared >= 30) scores.push([id, misses]);
    }
    scores.sort((a, b) => a[1] - b[1]);
    const [best, next] = scores;
    if (!best || best[1] > 2 || (next && next[1] === best[1])) return null;
    return best[0];
}

interface KeyboardWithMap { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> }

/** The browser's keyboard map, matched to a layout; undefined when the browser can't say (not Chromium, an iframe). */
export async function detectBrowserLayout(): Promise<string | null | undefined> {
    const keyboard = (typeof navigator !== "undefined" ? (navigator as Navigator & { keyboard?: KeyboardWithMap }).keyboard : undefined);
    if (!keyboard?.getLayoutMap) return undefined;
    try { return classifyLayoutMap(await keyboard.getLayoutMap()); } catch { return undefined; }
}

// ---- What a connected Keybard Overlay reports, shared by the settings sync and the layout settings ----

let overlayLayout: OsLayout | undefined;
const listeners = new Set<() => void>();
const same = (a?: OsLayout, b?: OsLayout) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Set by HostSettingsSync from the Overlay's state; undefined when no Overlay (or an older one) is connected. */
export function setOverlayLayout(value: OsLayout | null | undefined) {
    const next = value && typeof value === "object" && typeof value.available === "boolean" ? value : undefined;
    if (same(next, overlayLayout)) return;
    overlayLayout = next;
    listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => overlayLayout;
export function useOverlayLayout(): OsLayout | undefined {
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}
