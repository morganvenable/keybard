import { describe, expect, it } from "vitest";
import { planTileLabel, readableKeyLabel, tileLabelWords, TILE_LABEL_MIN_PX, type MeasureText } from "@/lib/tileLabel";

// Every character is 0.6 em wide.
const measure: MeasureText = (t, px) => Array.from(t).length * px * 0.6;
const small = { widthPx: 24, heightPx: 28 };
const normal = { widthPx: 60, heightPx: 58 };

describe("planTileLabel", () => {
    it("keeps a label that fits at its normal size", () => {
        const plan = planTileLabel("Cut", small, { size: "small", nominalPx: 10, measure });
        expect(plan).toEqual({ lines: ["Cut"], fontPx: 10, short: false, broken: false });
    });

    it("wraps only between words", () => {
        const plan = planTileLabel("Media Next", normal, { size: "default", nominalPx: 9.6, measure });
        expect(plan.lines).toEqual(["Media Next"]);
        const plan2 = planTileLabel("Media\nNext", { widthPx: 35, heightPx: 41 }, { size: "medium", nominalPx: 9.6, measure });
        expect(plan2.lines).toEqual(["Media", "Next"]);
        expect(plan2.short).toBe(false);
    });

    it("shrinks a long word before anything else", () => {
        const plan = planTileLabel("Repeat", small, { size: "small", nominalPx: 9.6, measure });
        expect(plan.lines).toEqual(["Repeat"]);
        expect(plan.fontPx).toBeLessThan(9.6);
        expect(plan.fontPx).toBeGreaterThanOrEqual(TILE_LABEL_MIN_PX.small);
        expect(measure("Repeat", plan.fontPx)).toBeLessThanOrEqual(24);
    });

    it("may break after a hyphen or slash", () => {
        expect(tileLabelWords("Auto-shift On/Off").map((w) => w.text)).toEqual(["Auto-", "shift", "On/", "Off"]);
        const plan = planTileLabel("Auto-shift", { widthPx: 24, heightPx: 28 }, { size: "small", nominalPx: 9.6, measure });
        expect(plan.lines).toEqual(["Auto-", "shift"]);
    });

    it("uses the short name only when the full name cannot fit", () => {
        const fits = planTileLabel("Browser Back", normal, { size: "default", nominalPx: 9.6, measure, shortLabel: "Back" });
        expect(fits.short).toBe(false);
        const tight = planTileLabel("Browser Back", small, { size: "small", nominalPx: 9.6, measure, shortLabel: "Back" });
        expect(tight.short).toBe(true);
        expect(tight.lines).toEqual(["Back"]);
    });

    it("breaks a word only as the last resort, and says so", () => {
        const plan = planTileLabel("Supercalifragilistic", small, { size: "small", nominalPx: 10, measure });
        expect(plan.broken).toBe(true);
        expect(plan.fontPx).toBe(TILE_LABEL_MIN_PX.small);
    });

    it("respects the room for lines", () => {
        // Two lines need 2 x 1.1 x size of height: 20px holds two lines at 9px, not at 10.
        const plan = planTileLabel("A B", { widthPx: 8, heightPx: 20 }, { size: "small", nominalPx: 10, measure });
        expect(plan).toEqual({ lines: ["A", "B"], fontPx: 9, short: false, broken: false });
    });
});

describe("readableKeyLabel", () => {
    it("replaces raw keycode names with the readable name", () => {
        expect(readableKeyLabel("QK_MAGIC_TOGGLE_NKRO", "NKRO Toggle")).toBe("NKRO Toggle");
        expect(readableKeyLabel("KC_MS_BTN6", "Mouse 6")).toBe("Mouse 6");
        expect(readableKeyLabel("Bright.\nUp", "Bright. Up")).toBe("Bright.\nUp");
        expect(readableKeyLabel(undefined, "Leader")).toBe("Leader");
    });
});
