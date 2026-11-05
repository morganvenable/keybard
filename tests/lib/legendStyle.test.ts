import { describe, expect, it } from "vitest";
import { dualLegendFor, legendStyleFromSearch } from "@/lib/legendStyle";
import { LAYOUTS } from "@/components/Keyboards/layouts";

describe("legendStyleFromSearch", () => {
    it("reads the three styles and nothing else", () => {
        expect(legendStyleFromSearch("?legendStyle=stacked")).toBe("stacked");
        expect(legendStyleFromSearch("?legendStyle=Corner")).toBe("corner");
        expect(legendStyleFromSearch("?legendStyle=keycap")).toBe("keycap");
        expect(legendStyleFromSearch("?legendStyle=off")).toBeNull();
        expect(legendStyleFromSearch("")).toBeNull();
    });
});

describe("dualLegendFor", () => {
    const us = (kc: string, label = "") => dualLegendFor(kc, label, undefined, "us");

    it("gives / its ? on US English (ticket 0668)", () => {
        expect(us("KC_SLASH", "/")).toEqual({ base: "/", shifted: "?" });
    });

    it("covers digits and punctuation on US English", () => {
        expect(us("KC_1")).toEqual({ base: "1", shifted: "!" });
        expect(us("KC_GRAVE")).toEqual({ base: "`", shifted: "~" });
        expect(us("KC_QUOTE")).toEqual({ base: "'", shifted: "\"" });
        expect(us("KC_BSLASH")).toEqual({ base: "\\", shifted: "|" });
    });

    it("never letters, special keys, numpad or shifted aliases", () => {
        for (const kc of ["KC_A", "KC_P", "KC_SPACE", "KC_ENTER", "KC_TAB", "KC_KP_1", "KC_P1", "KC_QUES", "KC_ESCAPE", "KC_F1", "KC_LSHIFT"]) {
            expect(us(kc), kc).toBeNull();
        }
    });

    it("never modified or special-type keys", () => {
        expect(dualLegendFor("LSFT(KC_SLASH)", "?", undefined, "us")).toBeNull();
        expect(dualLegendFor("KC_SLASH", "/", { type: "modtap" } as never, "us")).toBeNull();
    });

    it("follows the International keyboards layout", () => {
        expect(dualLegendFor("KC_3", "3", undefined, "uk")).toEqual({ base: "3", shifted: "£" });
        expect(dualLegendFor("KC_7", "7", undefined, "german")).toEqual({ base: "7", shifted: "/" });
        expect(dualLegendFor("KC_Y", "z", undefined, "german")).toBeNull();
    });

    it("keeps one legend when the key draws something else (the picker with Shift on)", () => {
        expect(dualLegendFor("KC_3", "£", undefined, "uk")).toBeNull();
    });

    it("every layout: shifted legends are short and never a letter's capital", () => {
        for (const id of Object.keys(LAYOUTS)) {
            for (const kc of ["KC_1", "KC_2", "KC_MINUS", "KC_EQUAL", "KC_SLASH", "KC_A", "KC_Q"]) {
                const d = dualLegendFor(kc, "", undefined, id);
                if (d) {
                    expect(d.base.length).toBeLessThanOrEqual(2);
                    expect(d.base.toLocaleUpperCase()).not.toBe(d.shifted.toLocaleUpperCase());
                }
            }
        }
    });
});
