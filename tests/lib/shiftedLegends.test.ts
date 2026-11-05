import { describe, expect, it } from "vitest";
import { DUAL_LEGEND_LINE_HEIGHT, dualLegendFor, fitDualLegend, wrapperHasShift } from "@/lib/shiftedLegends";
import { LAYOUTS } from "@/components/Keyboards/layouts";
import { getKeyDisplayText } from "@/utils/key-display";

describe("dualLegendFor", () => {
    const us = (kc: string, label = "") => dualLegendFor(kc, label, undefined, "us");

    it("gives / its ? on US English", () => {
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

    it("modifier, mod-tap and layer-tap keys show both legends of their base key", () => {
        expect(dualLegendFor("LCTL(KC_1)", "1", { type: "modmask", modids: 0x0100 } as never, "us")).toEqual({ base: "1", shifted: "!" });
        expect(dualLegendFor("LCTL_T(KC_2)", "2", { type: "modtap" } as never, "us")).toEqual({ base: "2", shifted: "@" });
        expect(dualLegendFor("LT1(KC_3)", "3", { type: "layerhold" } as never, "us")).toEqual({ base: "3", shifted: "#" });
    });

    it("a key holding Shift keeps the shifted symbol it types", () => {
        expect(dualLegendFor("LSFT(KC_4)", "$", { type: "modmask", modids: 0x0200 } as never, "us")).toBeNull();
        expect(dualLegendFor("LSFT_T(KC_4)", "$", { type: "modtap" } as never, "us")).toBeNull();
        expect(dualLegendFor("C_S(KC_4)", "$", { type: "modmask" } as never, "us")).toBeNull();
        expect(dualLegendFor("MEH_T(KC_4)", "$", { type: "modtap" } as never, "us")).toBeNull();
        expect(dualLegendFor("LSFT(KC_SLASH)", "?", undefined, "us")).toBeNull();
    });

    it("tap dances, macros, layer keys and one-shots keep one legend", () => {
        for (const type of ["tapdance", "macro", "layer", "OSM", "user"]) {
            expect(dualLegendFor("KC_1", "1", { type } as never, "us"), type).toBeNull();
        }
    });

    it("follows the International keyboards layout", () => {
        expect(dualLegendFor("KC_3", "3", undefined, "uk")).toEqual({ base: "3", shifted: "£" });
        expect(dualLegendFor("KC_7", "7", undefined, "german")).toEqual({ base: "7", shifted: "/" });
        expect(dualLegendFor("KC_Y", "z", undefined, "german")).toBeNull();
    });

    it("keeps one legend when the key draws something else (the picker with its Shift on)", () => {
        expect(dualLegendFor("KC_3", "£", undefined, "uk")).toBeNull();
    });

    it("every layout: legends are short and never a letter's capital", () => {
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

describe("wrapperHasShift", () => {
    it("reads Shift from the wrapper or the modifier bits", () => {
        expect(wrapperHasShift("LSFT")).toBe(true);
        expect(wrapperHasShift("RSFT_T")).toBe(true);
        expect(wrapperHasShift("SGUI")).toBe(true);
        expect(wrapperHasShift("HYPR_T")).toBe(true);
        expect(wrapperHasShift("LCTL")).toBe(false);
        expect(wrapperHasShift("LT1")).toBe(false);
        expect(wrapperHasShift("LCTL", 0x0300)).toBe(true);
    });
});

describe("fitDualLegend", () => {
    it("keeps the full size where the room holds a line", () => {
        expect(fitDualLegend("default", 58).fontPx).toBe(15);
        expect(fitDualLegend("medium", 29).fontPx).toBe(12);
        expect(fitDualLegend("small", 18).fontPx).toBe(10);
    });

    it("keeps one line inside the room", () => {
        for (const size of ["default", "medium", "small"] as const) {
            for (const room of [8, 18, 29, 40, 58]) {
                const { fontPx, insetY } = fitDualLegend(size, room);
                expect(fontPx * DUAL_LEGEND_LINE_HEIGHT + 2 * insetY).toBeLessThanOrEqual(room + 1e-9);
            }
        }
    });
});

describe("wrapped keys draw their base key's legend", () => {
    const text = (keycode: string, keyContents: object, layout = "us") =>
        getKeyDisplayText(keycode, "", keyContents as never, false, layout).displayLabel;

    it("a non-Shift modifier on a digit draws the digit, not its shifted symbol", () => {
        expect(text("LCTL(KC_1)", { type: "modmask", modids: 0x0100, str: "!\n1", top: "LCTL" })).toBe("1");
    });

    it("a mod-tap and a layer-tap on a digit draw the digit", () => {
        expect(text("LCTL_T(KC_2)", { type: "modtap", str: "@\n2", top: "LCTL_T" })).toBe("2");
        expect(text("LT1(KC_3)", { type: "layerhold", str: "#\n3" })).toBe("3");
    });

    it("Shift still draws the shifted symbol", () => {
        expect(text("LSFT(KC_4)", { type: "modmask", modids: 0x0200, str: "$\n4", top: "LSFT" })).toBe("$");
    });

    it("two-word names and mouse buttons are unchanged", () => {
        expect(text("LCTL(KC_CAPSLOCK)", { type: "modmask", modids: 0x0100, str: "Caps\nLock", top: "LCTL" })).toBe("Caps");
        expect(text("LT1(KC_PGUP)", { type: "layerhold", str: "Page\nUp" })).toBe("Page");
        expect(text("LT1(KC_BTN1)", { type: "layerhold", str: "Mouse\n1" })).toBe("Mouse 1");
    });
});
