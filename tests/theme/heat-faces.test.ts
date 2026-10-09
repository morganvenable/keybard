/**
 * Heat faces (docs/practice/spec.md §5.0.2, §12 M4): every face the heatmap, the Fingers grid and Thumbs
 * draw carries text at 4.5:1 or more in both themes, measured with the token values Tailwind copies into
 * the built CSS, and no face uses a layer color.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HEAT_FACE } from "@/features/practice/ui/progress/heat";

const CSS = readFileSync(resolve(process.cwd(), "src/index.css"), "utf-8");

function block(selector: string): Record<string, string> {
    const start = CSS.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m"));
    if (start < 0) throw new Error(`no ${selector} block in index.css`);
    const body = CSS.slice(start, CSS.indexOf("\n}", start));
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2].toLowerCase();
    return out;
}

const theme = block("@theme inline");
const themes = { light: block(":root"), dark: block(".dark") } as const;

function luminance(hex: string): number {
    let h = hex.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

/** A color utility's value: white, a themed token, or a literal token. */
function color(t: Record<string, string>, utility: string): string {
    if (utility === "white") return "#ffffff";
    const v = t[utility] ?? theme[`color-${utility}`];
    if (!v) throw new Error(`no value for ${utility}`);
    return v;
}

const classOf = (classes: string, prefix: "bg" | "text") => classes.split(/\s+/).find((c) => c.startsWith(`${prefix}-`) && !c.startsWith(`${prefix}-transparent`))?.slice(prefix.length + 1);

const LAYER_COLORS = /kb-(primary|green|blue|purple|orange|yellow|red|brown|magenta|light-grey)\b/;

describe("heat faces (§5.0.2)", () => {
    it("never use a layer color", () => {
        for (const classes of Object.values(HEAT_FACE)) expect(classes).not.toMatch(LAYER_COLORS);
    });

    describe.each(Object.entries(themes))("%s theme", (_name, t) => {
        it.each(Object.entries(HEAT_FACE).filter(([level]) => level !== "none"))("%s text is at least 4.5:1 on its face", (_level, classes) => {
            const bg = color(t, classOf(classes, "bg")!);
            const fg = color(t, classOf(classes, "text")!);
            expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
        });
    });

    it("far, mid and near rise in luminance, so their order survives any color vision", () => {
        const [far, mid, near] = ["kb-heat-far", "kb-heat-mid", "kb-heat-near"].map((n) => luminance(theme[`color-${n}`]));
        expect(far).toBeLessThan(mid);
        expect(mid).toBeLessThan(near);
    });
});
