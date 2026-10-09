/**
 * Color roles (docs/practice/spec.md §5.0.1, §5.0.2): checks the token values in
 * src/index.css against the contrast the spec promises, in both themes.
 *
 * Tailwind copies these custom properties into the built CSS unchanged, so the
 * values read here are the values the browser paints.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(resolve(process.cwd(), "src/index.css"), "utf-8");

/** `--name: #hex;` pairs from the first block that opens with `selector {` at column 0. */
function block(selector: string): Record<string, string> {
    const start = CSS.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m"));
    if (start < 0) throw new Error(`no ${selector} block in index.css`);
    const body = CSS.slice(start, CSS.indexOf("\n}", start));
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2].toLowerCase();
    return out;
}

const theme = block("@theme inline");
const light = block(":root");
const dark = block(".dark");
const themes = { light, dark } as const;

function luminance(hex: string): number {
    let h = hex.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Themed token value (`--kb-x` in :root/.dark) or literal (`--color-kb-x` in @theme). */
function tok(t: Record<string, string>, name: string): string {
    const v = t[name] ?? theme[`color-${name}`];
    if (!v) throw new Error(`token ${name} has no hex value`);
    return v;
}

describe("color roles: tokens exist in both themes", () => {
    const THEMED = [
        "kb-select", "kb-select-tint", "kb-select-strip", "kb-pending", "kb-pressed", "kb-pressed-fg",
        "kb-use-1", "kb-use-2", "kb-use-3", "kb-use-4", "kb-use-1-fg", "kb-use-2-fg", "kb-use-3-fg", "kb-use-4-fg",
    ];
    it.each(THEMED)("%s is themed and mapped to a utility", (name) => {
        expect(light[name], `:root --${name}`).toMatch(/^#/);
        expect(dark[name], `.dark --${name}`).toMatch(/^#/);
        expect(CSS).toContain(`--color-${name}: var(--${name});`);
    });

    it("the literal role and heat tokens have one value", () => {
        expect(theme["color-kb-select-strong"]).toBe("#2b86bd");
        expect(theme["color-kb-heat-far"]).toBe("#d8304a");
        expect(theme["color-kb-heat-mid"]).toBe("#f07f00");
        expect(theme["color-kb-heat-near"]).toBe("#ffc222");
        expect(theme["color-kb-heat-ink"]).toBe("#111214");
    });

    it("brand and layer colors keep their values (OD6)", () => {
        expect(theme).toMatchObject({
            "color-kb-primary": "#099e7c",
            "color-kb-green": "#099e7c",
            "color-kb-blue": "#379cd7",
            "color-kb-purple": "#8672b5",
            "color-kb-orange": "#f89804",
            "color-kb-yellow": "#ffc222",
            "color-kb-red": "#d8304a",
            "color-kb-brown": "#b39369",
            "color-kb-magenta": "#b5508a",
        });
    });
});

describe.each(Object.entries(themes))("color roles: contrast in %s theme", (_name, t) => {
    const page = tok(t, "kb-gray");
    const surface = tok(t, "kb-surface");
    const ink = tok(t, "kb-ink");

    it("select ring is at least 3:1 against the page and the surface", () => {
        expect(contrast(tok(t, "kb-select"), page)).toBeGreaterThanOrEqual(3);
        expect(contrast(tok(t, "kb-select"), surface)).toBeGreaterThanOrEqual(3);
    });

    it("selected-key legends and strip text are at least 4.5:1", () => {
        expect(contrast(ink, tok(t, "kb-select-tint"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(ink, tok(t, "kb-select-strip"))).toBeGreaterThanOrEqual(4.5);
    });

    it("pending borders are at least 3:1 against the page and the surface", () => {
        // 4.48:1 on the light page: fine for a 2 px dashed border, not for text (§5.0.1).
        expect(contrast(tok(t, "kb-pending"), page)).toBeGreaterThanOrEqual(3);
        expect(contrast(tok(t, "kb-pending"), surface)).toBeGreaterThanOrEqual(3);
    });

    it("Matrix Tester states are pairwise at least 3:1", () => {
        const held = tok(t, "kb-select-strong");
        expect(contrast(held, "#ffffff")).toBeGreaterThanOrEqual(3);
        expect(contrast(held, "#000000")).toBeGreaterThanOrEqual(3);
    });

    it("Practice pressed legend is at least 4.5:1 on the pressed face", () => {
        expect(contrast(tok(t, "kb-pressed-fg"), tok(t, "kb-pressed"))).toBeGreaterThanOrEqual(4.5);
    });

    it("usage steps move away from the page and keep their text legible", () => {
        const steps = [1, 2, 3, 4].map((n) => tok(t, `kb-use-${n}`));
        const vsPage = steps.map((s) => contrast(s, page));
        for (let i = 1; i < vsPage.length; i++) expect(vsPage[i]).toBeGreaterThan(vsPage[i - 1]);
        [1, 2, 3, 4].forEach((n) =>
            expect(contrast(tok(t, `kb-use-${n}-fg`), tok(t, `kb-use-${n}`)), `use-${n}`).toBeGreaterThanOrEqual(4.5));
    });
});

describe("color roles: theme-specific pairs", () => {
    it("the dark 'was pressed' outline (kb-gray-border) is at least 3:1 on the dark page", () => {
        expect(contrast(dark["kb-gray-border"], dark["kb-gray"])).toBeGreaterThanOrEqual(3);
    });

    it("heat faces carry legible text and rise in luminance far → mid → near", () => {
        const far = theme["color-kb-heat-far"], mid = theme["color-kb-heat-mid"], near = theme["color-kb-heat-near"];
        const heatInk = theme["color-kb-heat-ink"];
        expect(contrast("#ffffff", far)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(heatInk, mid)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(heatInk, near)).toBeGreaterThanOrEqual(4.5);
        expect(luminance(far)).toBeLessThan(luminance(mid));
        expect(luminance(mid)).toBeLessThan(luminance(near));
    });
});
