import { describe, it, expect } from "vitest";
import { colorClasses, getColorByName } from "@/utils/colors";
import { contrastRatio, DARK_PAGE_BG, KB_INK_VAR } from "@/lib/theme";
import {
    DARK_INK_HEX,
    dark3DLabelColor,
    needsDarkIndicatorOutline,
    screenedBackdropHex,
} from "@/components/layer3DColors";

// Mirrors TEXT_CLASS_TO_HEX in src/components/Keyboard.tsx.
const TEXT_CLASS_TO_HEX: Record<string, string> = {
    "text-white": "#ffffff",
    "text-black": "#000000",
    "text-orange-800": "#9a3412",
    "text-gray-200": "#e5e7eb",
};

const resolve = (c: string) => (c === KB_INK_VAR ? DARK_INK_HEX : c);

/** Replicates the label-colour choice in Keyboard.tsx for the active (0.65) and inactive layer. */
function labelBase(layerName: string, active: boolean): string {
    const textClass = colorClasses[layerName].split(" ").find((c) => c.startsWith("text-"))!;
    const layerHex = getColorByName(layerName)?.hex || "#099e7c";
    if (active) return TEXT_CLASS_TO_HEX[textClass];
    if (textClass === "text-gray-200") return "#000000";
    if (textClass === "text-white") return layerHex;
    return TEXT_CLASS_TO_HEX[textClass];
}

describe("screenedBackdropHex", () => {
    it("leaves the page unchanged at zero opacity and for black", () => {
        expect(screenedBackdropHex("#ff0000", 0)).toBe(DARK_PAGE_BG);
        expect(screenedBackdropHex("#000000", 0.65)).toBe(DARK_PAGE_BG);
    });
    it("screens white at full opacity to white", () => {
        expect(screenedBackdropHex("#ffffff", 1)).toBe("#ffffff");
    });
});

describe("dark 3D layer label colour", () => {
    const layers = Object.keys(colorClasses);
    for (const opacity of [0.65, 0.25]) {
        for (const name of layers) {
            it(`${name} at ${opacity} keeps a passing label, else picks the most readable candidate`, () => {
                const layerHex = getColorByName(name)?.hex || "#099e7c";
                const backdrop = screenedBackdropHex(layerHex, opacity);
                const base = labelBase(name, opacity === 0.65);
                const chosen = resolve(dark3DLabelColor(base, backdrop));
                const chosenRatio = contrastRatio(chosen, backdrop);
                const best = Math.max(
                    contrastRatio(base, backdrop),
                    contrastRatio(DARK_INK_HEX, backdrop),
                    contrastRatio("#000000", backdrop),
                );
                if (contrastRatio(base, backdrop) >= 4.5) expect(chosen).toBe(base);
                else expect(chosenRatio).toBeCloseTo(best, 5);
                // Every layer colour meets WCAG AA at the default active and inactive opacities.
                expect(chosenRatio).toBeGreaterThanOrEqual(4.5);
            });
        }
    }

    it("keeps the original black label on white and light-grey active backdrops", () => {
        for (const name of ["white", "light-grey"]) {
            const backdrop = screenedBackdropHex(getColorByName(name)!.hex, 0.65);
            expect(dark3DLabelColor("#000000", backdrop)).toBe("#000000");
        }
    });

    it("uses black, not kb-ink, for the yellow active label (orange-800 fails there)", () => {
        const backdrop = screenedBackdropHex(getColorByName("yellow")!.hex, 0.65);
        expect(dark3DLabelColor("#9a3412", backdrop)).toBe("#000000");
    });

    it("uses kb-ink for dim inactive backdrops", () => {
        const backdrop = screenedBackdropHex(getColorByName("white")!.hex, 0.25);
        expect(dark3DLabelColor("#000000", backdrop)).toBe(KB_INK_VAR);
    });
});

describe("needsDarkIndicatorOutline", () => {
    it("flags near-page colours and passes bright ones", () => {
        expect(needsDarkIndicatorOutline("#000000")).toBe(true);
        expect(needsDarkIndicatorOutline("#202020")).toBe(true);
        expect(needsDarkIndicatorOutline("#ffffff")).toBe(false);
        expect(needsDarkIndicatorOutline("#not-hex")).toBe(false);
    });
});
