import { useSyncExternalStore } from "react";

/**
 * Theme helpers for the Appearance setting (Settings > General).
 *
 * The resolved theme is a single `dark` class on <html>, so it reaches body and
 * every Radix portal. The inline script in src/index.html applies the same rule
 * before first paint; ThemeSync keeps it in step with the setting afterwards.
 */

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_SETTING_NAME = "theme";

/** Default for profiles with no stored theme. Keep in sync with the src/index.html head script. */
export const DEFAULT_THEME_PREF: ThemePref = "light";

/** Dark page background. Must equal --kb-gray in .dark (src/index.css) and the src/index.html inline style. */
export const DARK_PAGE_BG = "#141517";

/** CSS value used when a colour is not readable on the dark page. */
export const KB_INK_VAR = "var(--kb-ink)";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function normalizeThemePref(value: unknown): ThemePref {
    return value === "system" || value === "light" || value === "dark" ? value : DEFAULT_THEME_PREF;
}

export function systemPrefersDark(): boolean {
    try {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
        return window.matchMedia(DARK_QUERY).matches;
    } catch {
        return false;
    }
}

export function resolveTheme(pref: unknown, prefersDark: boolean = systemPrefersDark()): ResolvedTheme {
    const normalized = normalizeThemePref(pref);
    if (normalized === "system") return prefersDark ? "dark" : "light";
    return normalized;
}

export function applyTheme(theme: ResolvedTheme, root: HTMLElement | undefined = typeof document !== "undefined" ? document.documentElement : undefined): void {
    if (!root) return;
    root.classList.toggle("dark", theme === "dark");
}

/**
 * Subscribe to OS colour-scheme changes. Returns an unsubscribe function.
 * A no-op when matchMedia is unavailable.
 */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    let mql: MediaQueryList;
    try {
        mql = window.matchMedia(DARK_QUERY);
    } catch {
        return () => {};
    }
    const handler = (e: MediaQueryListEvent) => onChange(e.matches);
    if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }
    // Older Safari
    mql.addListener?.(handler);
    return () => mql.removeListener?.(handler);
}

// ---------------------------------------------------------------------------
// useIsDark: tracks the `dark` class on <html>.
// ---------------------------------------------------------------------------

function isDarkNow(): boolean {
    return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function subscribeHtmlClass(callback: () => void): () => void {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
}

export function useIsDark(): boolean {
    return useSyncExternalStore(subscribeHtmlClass, isDarkNow, () => false);
}

// ---------------------------------------------------------------------------
// Contrast helpers (WCAG 2.x relative luminance).
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
    const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours, or NaN if either is not a hex colour. */
export function contrastRatio(a: string, b: string): number {
    const ca = parseHex(a);
    const cb = parseHex(b);
    if (!ca || !cb) return NaN;
    const la = relativeLuminance(ca);
    const lb = relativeLuminance(cb);
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * For text drawn directly on the dark page: returns `hex` when it reaches 4.5:1
 * against `bg`, otherwise the kb-ink token. Non-hex inputs are returned unchanged.
 * Only call this on dark-mode code paths; light mode must keep its original colours.
 */
export function readableOnDark(hex: string, bg: string = DARK_PAGE_BG): string {
    const ratio = contrastRatio(hex, bg);
    if (Number.isNaN(ratio)) return hex;
    return ratio >= 4.5 ? hex : KB_INK_VAR;
}
