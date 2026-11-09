import { afterEach, describe, expect, it, vi } from "vitest";
import { hasAltGr, positionalLegends } from "@/lib/shiftedLegends";
import { INTERNATIONAL_SETTING, KEY_LEGENDS_ITEMS, PLACEHOLDER_LAYOUTS, keyLegendsItems, keyLegendsOptions, resolveKeyLegendsLayout } from "@/lib/keyLegendsSetting";
import { LAYOUTS } from "@/components/Keyboards/layouts";
import { applyModifiers, modifierOptions, pickerBinding, type Modifier, type ModifierSide } from "@/utils/modifierUtils";

describe("pickerBinding: one builder for a click and a drag", () => {
    const subsets: Modifier[][] = [[]];
    for (const m of modifierOptions) for (const s of [...subsets]) subsets.push([...s, m]);
    const sides: ModifierSide[] = ["left", "right"];
    const shifts: (ModifierSide | false)[] = [false, "left", "right"];

    it("matches the rules for every modifier combination, side and picker Shift", () => {
        for (const mods of subsets) for (const side of sides) for (const shifted of shifts) {
            const got = pickerBinding("KC_1", mods, side, shifted);
            const addShift = !!shifted && !mods.includes("Shift");
            const all: Modifier[] = addShift ? [...mods, "Shift"] : mods;
            const useSide = addShift && mods.length === 0 && shifted ? shifted : side;
            expect(got, `${mods} ${side} ${shifted}`).toBe(applyModifiers("KC_1", all, false, useSide));
        }
    });

    it("the picker's Shift alone is LSFT or RSFT by the side clicked; with other modifiers the row's side holds", () => {
        expect(pickerBinding("KC_1", [], "left", "left")).toBe("LSFT(KC_1)");
        expect(pickerBinding("KC_1", [], "left", "right")).toBe("RSFT(KC_1)");
        expect(pickerBinding("KC_1", ["Ctrl"], "left", "right")).toBe(applyModifiers("KC_1", ["Ctrl", "Shift"], false, "left"));
    });

    it("blank, transparent and plain modifier keys are never modified", () => {
        expect(pickerBinding("KC_NO", ["Shift"], "left", "left")).toBe("KC_NO");
        expect(pickerBinding("KC_TRNS", ["Ctrl"], "left", false)).toBe("KC_TRNS");
        expect(pickerBinding("KC_LSFT", ["Ctrl"], "left", "left")).toBe("KC_LSFT");
    });

    it("AltGr is Right Alt: RALT(key)", () => {
        expect(pickerBinding("KC_7", ["Alt"], "right", false)).toBe("RALT(KC_7)");
    });
});

describe("Key legends setting", () => {
    it("is stored by a layout id or auto; older values map to it; unknown ones fall back to US; nothing stored is Automatic", () => {
        expect(INTERNATIONAL_SETTING).toBe("international-keyboards");
        expect(resolveKeyLegendsLayout("german")).toBe("german");
        expect(resolveKeyLegendsLayout("german-qwertz")).toBe("german");
        expect(resolveKeyLegendsLayout("french-azerty")).toBe("french");
        expect(resolveKeyLegendsLayout("colemak")).toBe("us");
        expect(resolveKeyLegendsLayout("auto")).toBe("auto");
        expect(resolveKeyLegendsLayout(undefined)).toBe("auto");
    });

    it("offers Automatic first, then only layouts with their own key map", () => {
        expect(KEY_LEGENDS_ITEMS[0]).toEqual({ label: "Automatic", value: "auto" });
        const offered = KEY_LEGENDS_ITEMS.slice(1).map((i) => i.value);
        expect(offered).toEqual(Object.values(LAYOUTS).map((l) => l.value).filter((v) => !PLACEHOLDER_LAYOUTS.has(v)));
        for (const placeholder of ["japanese", "korean", "pt", "fr_mac"]) expect(offered).not.toContain(placeholder);
        // A placeholder someone chose before stays shown, so the select still names it.
        expect(keyLegendsItems("japanese").at(-1)).toEqual({ label: "Japanese", value: "japanese" });
        expect(keyLegendsItems("german")).toBe(KEY_LEGENDS_ITEMS);
    });

    it("picker selects name what Automatic shows, or short codes", () => {
        expect(keyLegendsOptions("auto", "german")[0]).toEqual({ label: "Automatic: German", value: "auto" });
        expect(keyLegendsOptions("auto", "german", true)[0]).toEqual({ label: "AUTO", value: "auto" });
    });
});

describe("macOS has no AltGr data", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("hasAltGr and the AltGr character are off on a Mac, on elsewhere", () => {
        expect(hasAltGr("german")).toBe(true);
        expect(positionalLegends("KC_7", "german")?.altgr).toBe("{");
        vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "Macintosh" });
        expect(hasAltGr("german")).toBe(false);
        expect(positionalLegends("KC_7", "german")?.altgr).toBeUndefined();
        vi.stubGlobal("navigator", { platform: "Win32", userAgentData: { platform: "Windows" } });
        expect(hasAltGr("german")).toBe(true);
    });
});
