import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ThemeSync from "@/components/ThemeSync";
import { SettingsProvider, SETTINGS, SETTINGS_CATEGORIES, useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import {
    DARK_PAGE_BG,
    DEFAULT_THEME_PREF,
    KB_INK_VAR,
    applyTheme,
    contrastRatio,
    normalizeThemePref,
    readableOnDark,
    resolveTheme,
    systemPrefersDark,
} from "@/lib/theme";
import { layerColors } from "@/utils/colors";
import type { SettingsContextType } from "@/types/settings.types";

// Vitest runs from the repo root (vite.config.ts lives there).
const readSrc = (rel: string) => readFileSync(resolve(process.cwd(), "src", rel), "utf-8");

type Listener = (e: { matches: boolean }) => void;

function installMatchMedia(initialDark: boolean) {
    const listeners = new Set<Listener>();
    const state = { dark: initialDark };
    const mql = {
        get matches() {
            return state.dark;
        },
        media: "(prefers-color-scheme: dark)",
        addEventListener: (_: string, l: Listener) => listeners.add(l),
        removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    };
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: vi.fn(() => mql),
    });
    return {
        listeners,
        set(dark: boolean) {
            state.dark = dark;
            listeners.forEach((l) => l({ matches: dark }));
        },
    };
}

function removeMatchMedia() {
    // jsdom does not implement matchMedia; make sure no stub leaks between tests.
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
}

beforeEach(() => {
    document.documentElement.classList.remove("dark");
    window.localStorage.clear();
    removeMatchMedia();
});

afterEach(() => {
    document.documentElement.classList.remove("dark");
    removeMatchMedia();
});

describe("theme preference helpers", () => {
    it("normalizes unknown values to the branch default (light)", () => {
        expect(DEFAULT_THEME_PREF).toBe("light");
        expect(normalizeThemePref(undefined)).toBe("light");
        expect(normalizeThemePref("purple")).toBe("light");
        expect(normalizeThemePref(true)).toBe("light");
        expect(normalizeThemePref("dark")).toBe("dark");
        expect(normalizeThemePref("system")).toBe("system");
    });

    it("resolves explicit preferences regardless of the OS", () => {
        expect(resolveTheme("light", true)).toBe("light");
        expect(resolveTheme("dark", false)).toBe("dark");
        expect(resolveTheme(undefined, true)).toBe("light");
    });

    it("resolves system to light when matchMedia is unavailable", () => {
        expect(typeof window.matchMedia).toBe("undefined");
        expect(systemPrefersDark()).toBe(false);
        expect(resolveTheme("system")).toBe("light");
    });

    it("resolves system from matchMedia when available", () => {
        installMatchMedia(true);
        expect(systemPrefersDark()).toBe(true);
        expect(resolveTheme("system")).toBe("dark");
        installMatchMedia(false);
        expect(resolveTheme("system")).toBe("light");
    });

    it("applyTheme toggles only the dark class on <html>", () => {
        const root = document.documentElement;
        root.classList.add("keep-me");
        applyTheme("dark");
        expect(root.classList.contains("dark")).toBe(true);
        applyTheme("dark");
        expect(root.className.split(/\s+/).filter((c) => c === "dark")).toHaveLength(1);
        applyTheme("light");
        expect(root.classList.contains("dark")).toBe(false);
        expect(root.classList.contains("keep-me")).toBe(true);
        root.classList.remove("keep-me");
    });
});

describe("index.html / index.css consistency", () => {
    const css = readSrc("index.css");
    const html = readSrc("index.html");

    const block = (selector: string) => {
        const start = css.indexOf(`\n${selector} {`);
        expect(start).toBeGreaterThanOrEqual(0);
        return css.slice(start, css.indexOf("\n}", start));
    };
    const varIn = (body: string, name: string) => {
        const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(body);
        return m?.[1].trim().toLowerCase();
    };

    it("dark page background in the no-flash style equals --kb-gray in .dark", () => {
        const darkGray = varIn(block(".dark"), "kb-gray");
        expect(darkGray).toBe(DARK_PAGE_BG);
        const style = /<style>([^<]*)<\/style>/.exec(html)?.[1] ?? "";
        expect(style).toMatch(/html\.dark\s*\{[^}]*background-color:\s*#141517/i);
        expect(style.toLowerCase()).toContain(`background-color:${darkGray}`);
    });

    it("light token values equal the literals they replace", () => {
        const root = block(":root");
        expect(varIn(root, "kb-gray")).toBe("#f1f2f2");
        expect(varIn(root, "kb-key-border")).toBe("#f1f2f2");
        expect(varIn(root, "kb-gray-medium")).toBe("#eaeae9");
        expect(varIn(root, "kb-gray-border")).toBe("#a7a9ac");
        expect(varIn(root, "kb-surface")).toBe("#ffffff");
        expect(varIn(root, "kb-ink")).toBe("#000000");
        expect(varIn(root, "kb-active")).toBe("#000000");
        expect(varIn(root, "kb-active-fg")).toBe("#ffffff");
        expect(varIn(root, "kb-popover")).toBe("#eeeeee");
    });

    it("no-flash script and style sit right after <meta charset>, before any stylesheet", () => {
        const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
        const charset = head.indexOf("<meta charset");
        const script = head.indexOf("<script>");
        const style = head.indexOf("<style>");
        const firstLink = head.indexOf("<link");
        expect(charset).toBeGreaterThanOrEqual(0);
        expect(script).toBeGreaterThan(charset);
        expect(style).toBeGreaterThan(script);
        expect(firstLink).toBeGreaterThan(style);
    });

    describe("head script", () => {
        const scriptSrc = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
        const runHeadScript = () => new Function(scriptSrc)();

        it("defaults to light with no stored settings", () => {
            runHeadScript();
            expect(document.documentElement.classList.contains("dark")).toBe(false);
        });

        it("applies dark from the stored settings (unreplaced namespace placeholder)", () => {
            window.localStorage.setItem("keyboard-settings", JSON.stringify({ theme: "dark" }));
            runHeadScript();
            expect(document.documentElement.classList.contains("dark")).toBe(true);
        });

        it("follows the OS for system and survives missing matchMedia or bad JSON", () => {
            window.localStorage.setItem("keyboard-settings", JSON.stringify({ theme: "system" }));
            runHeadScript();
            expect(document.documentElement.classList.contains("dark")).toBe(false);
            installMatchMedia(true);
            runHeadScript();
            expect(document.documentElement.classList.contains("dark")).toBe(true);
            document.documentElement.classList.remove("dark");
            window.localStorage.setItem("keyboard-settings", "{not json");
            expect(runHeadScript).not.toThrow();
            expect(document.documentElement.classList.contains("dark")).toBe(false);
        });
    });
});

describe("readableOnDark", () => {
    // 11 layer colours plus the black and sidebar key colours = 13.
    const LAYER_HEXES = [...layerColors.map((c) => c.hex), "#000000", "#3E3E3E"];
    const TEXT_HEXES = ["#ffffff", "#000000", "#9a3412", "#e5e7eb"];

    it("covers all 13 layer hexes", () => {
        expect(new Set(LAYER_HEXES.map((h) => h.toLowerCase())).size).toBe(13);
    });

    it.each([...LAYER_HEXES, ...TEXT_HEXES])("%s is readable on the dark page after mapping", (hex) => {
        const out = readableOnDark(hex);
        if (out === KB_INK_VAR) {
            expect(contrastRatio(hex, DARK_PAGE_BG)).toBeLessThan(4.5);
        } else {
            expect(out).toBe(hex);
            expect(contrastRatio(hex, DARK_PAGE_BG)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("substitutes kb-ink for black and keeps white", () => {
        expect(readableOnDark("#000000")).toBe(KB_INK_VAR);
        expect(readableOnDark("#3E3E3E")).toBe(KB_INK_VAR);
        expect(readableOnDark("#ffffff")).toBe("#ffffff");
        // kb-ink itself (#f1f2f2) is readable on the page.
        expect(contrastRatio("#f1f2f2", DARK_PAGE_BG)).toBeGreaterThanOrEqual(4.5);
    });

    it("passes non-hex values through and computes known ratios", () => {
        expect(readableOnDark("currentColor")).toBe("currentColor");
        expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
        expect(contrastRatio("#fff", "#fff")).toBeCloseTo(1, 5);
    });
});

describe("Appearance setting and ThemeSync", () => {
    it("is the first General setting, a System/Light/Dark select defaulting to light", () => {
        const general = SETTINGS_CATEGORIES.find((c) => c.name === "general");
        expect(general?.settings[0]).toBe("theme");
        const def = SETTINGS.find((s) => s.name === "theme");
        expect(def?.label).toBe("Appearance");
        expect(def?.type).toBe("select");
        expect(def?.defaultValue).toBe("light");
        expect(def?.items?.map((i) => i.value)).toEqual(["system", "light", "dark"]);
    });

    function renderWithProvider() {
        const ref: { current: SettingsContextType | null } = { current: null };
        function Capture() {
            const ctx = useSettings();
            useEffect(() => {
                ref.current = ctx;
            });
            return null;
        }
        render(createElement(SettingsProvider, null, createElement(ThemeSync), createElement(Capture)));
        return ref;
    }

    it("applies the stored theme after load and resetSettings restores light", async () => {
        window.localStorage.setItem("keyboard-settings", JSON.stringify({ theme: "dark" }));
        const ctx = renderWithProvider();
        await waitFor(() => expect(ctx.current?.isLoaded).toBe(true));
        await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));

        act(() => ctx.current!.resetSettings());
        await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
        expect(ctx.current!.getSetting("theme")).toBe("light");
    });

    it("follows OS changes live while the preference is system", async () => {
        const media = installMatchMedia(false);
        const ctx = renderWithProvider();
        await waitFor(() => expect(ctx.current?.isLoaded).toBe(true));

        act(() => ctx.current!.updateSetting("theme", "system"));
        await waitFor(() => expect(media.listeners.size).toBe(1));
        expect(document.documentElement.classList.contains("dark")).toBe(false);

        act(() => media.set(true));
        expect(document.documentElement.classList.contains("dark")).toBe(true);

        act(() => ctx.current!.updateSetting("theme", "light"));
        await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false));
        expect(media.listeners.size).toBe(0);
        // Persisted inside the existing keyboard-settings JSON.
        expect(JSON.parse(window.localStorage.getItem("keyboard-settings") ?? "{}").theme).toBe("light");
    });
});

describe("tailwind-merge with the new kb-* colour names", () => {
    it("treats kb tokens as colours, not sizes", () => {
        expect(cn("bg-white", "bg-kb-surface")).toBe("bg-kb-surface");
        expect(cn("text-black", "text-kb-ink")).toBe("text-kb-ink");
        expect(cn("text-sm", "text-kb-ink")).toBe("text-sm text-kb-ink");
        expect(cn("text-kb-ink", "text-sm")).toBe("text-kb-ink text-sm");
        expect(cn("bg-kb-active text-kb-active-fg", "text-xs")).toBe("bg-kb-active text-kb-active-fg text-xs");
        expect(cn("border-2", "border-kb-key-border")).toBe("border-2 border-kb-key-border");
        expect(cn("bg-kb-gray-medium", "bg-kb-popover")).toBe("bg-kb-popover");
    });
});
