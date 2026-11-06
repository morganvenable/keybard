import { describe, expect, it } from "vitest";
import { DUAL_LEGEND_LINE_HEIGHT, dualLegendFor, fitDualLegend, wrapperHasShift } from "@/lib/shiftedLegends";
import { BUTTON_TO_KEYCODE_MAP, KEY_DISPLAY_OVERRIDES, LAYOUT_KEY_MAPS, LAYOUTS } from "@/components/Keyboards/layouts";
import { getKeyDisplayText } from "@/utils/key-display";

describe("dualLegendFor", () => {
    const us = (kc: string, label = "") => dualLegendFor(kc, label, undefined, "us");

    it("gives / its ? on US English", () => {
        expect(us("KC_SLASH", "/")).toMatchObject({ base: "/", shifted: "?" });
    });

    it("covers digits and punctuation on US English", () => {
        expect(us("KC_1")).toMatchObject({ base: "1", shifted: "!" });
        expect(us("KC_GRAVE")).toMatchObject({ base: "`", shifted: "~" });
        expect(us("KC_QUOTE")).toMatchObject({ base: "'", shifted: "\"" });
        expect(us("KC_BSLASH")).toMatchObject({ base: "\\", shifted: "|" });
    });

    it("never letters, special keys, numpad or shifted aliases", () => {
        for (const kc of ["KC_A", "KC_P", "KC_SPACE", "KC_ENTER", "KC_TAB", "KC_KP_1", "KC_P1", "KC_QUES", "KC_ESCAPE", "KC_F1", "KC_LSHIFT"]) {
            expect(us(kc), kc).toBeNull();
        }
    });

    it("modifier, mod-tap and layer-tap keys show both legends of their base key", () => {
        expect(dualLegendFor("LCTL(KC_1)", "1", { type: "modmask", modids: 0x0100 } as never, "us")).toMatchObject({ base: "1", shifted: "!" });
        expect(dualLegendFor("LCTL_T(KC_2)", "2", { type: "modtap" } as never, "us")).toMatchObject({ base: "2", shifted: "@" });
        expect(dualLegendFor("LT1(KC_3)", "3", { type: "layerhold" } as never, "us")).toMatchObject({ base: "3", shifted: "#" });
        // AltGr types a third symbol on many layouts: one legend.
        expect(dualLegendFor("RALT(KC_2)", "2", { type: "modmask" } as never, "de")).toBeNull();
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
        expect(dualLegendFor("KC_3", "3", undefined, "uk")).toMatchObject({ base: "3", shifted: "£" });
        expect(dualLegendFor("KC_7", "7", undefined, "german")).toMatchObject({ base: "7", shifted: "/" });
        expect(dualLegendFor("KC_Y", "z", undefined, "german")).toBeNull();
    });

    it("keeps one legend when the key draws something else (the picker with its Shift on)", () => {
        expect(dualLegendFor("KC_3", "£", undefined, "uk")).toBeNull();
    });

    it("every layout: each key's shifted legend is the shift-row token at its own place", () => {
        let checked = 0;
        for (const [id, layout] of Object.entries(LAYOUTS)) {
            const keyMap = LAYOUT_KEY_MAPS[id] || {};
            layout.default.forEach((row, r) => {
                const shiftRow = layout.shift[r].split(" ");
                row.split(" ").forEach((token, i) => {
                    const kc = keyMap[token] || keyMap[token.toLowerCase()] || BUTTON_TO_KEYCODE_MAP[token] || BUTTON_TO_KEYCODE_MAP[token.toLowerCase()];
                    if (!kc) return;
                    // The first place a keycode appears is the one the legends come from.
                    const first = layout.default.flatMap(rr => rr.split(" ")).find(t =>
                        (keyMap[t] || keyMap[t.toLowerCase()] || BUTTON_TO_KEYCODE_MAP[t] || BUTTON_TO_KEYCODE_MAP[t.toLowerCase()]) === kc);
                    if (first !== token) return;
                    const d = dualLegendFor(kc, "", undefined, id);
                    if (!d) return;
                    checked++;
                    expect(d.shifted, `${id} ${kc}`).toBe(KEY_DISPLAY_OVERRIDES[shiftRow[i]] || shiftRow[i].replace("{", "").replace("}", ""));
                    expect([...d.base].length, `${id} ${kc}`).toBeLessThanOrEqual(2);
                });
            });
        }
        expect(checked).toBeGreaterThan(100);
    });

    it("every layout: letters in any script keep one legend", () => {
        for (const id of Object.keys(LAYOUTS)) {
            for (const kc of Object.values(BUTTON_TO_KEYCODE_MAP)) {
                const d = dualLegendFor(kc, "", undefined, id);
                if (d) {
                    if (/\p{L}/u.test(d.base)) expect(d.shifted, `${id} ${kc}`).toMatch(/^[0-9]$/); // a number-row key with a letter base (French é è ç à)
                    expect(d.shifted, `${id} ${kc}`).not.toMatch(/\p{L}/u);
                }
            }
        }
        expect(dualLegendFor("KC_A", "", undefined, "arabic")).toBeNull();
        expect(dualLegendFor("KC_B", "", undefined, "arabic")).toBeNull();
    });

    it("every two-legend key is the keycap grid: shifted top left, base bottom left", () => {
        expect(dualLegendFor("KC_2", "", undefined, "us")).toEqual({ base: "2", shifted: "@", grid: true });
        expect(dualLegendFor("KC_9", "", undefined, "french")).toEqual({ base: "ç", shifted: "9", grid: true });
    });

    it("French number-row keys with a letter base read their shifted digit from the shift row", () => {
        const fr = (kc: string) => dualLegendFor(kc, "", undefined, "french");
        expect(fr("KC_2")).toMatchObject({ base: "é", shifted: "2" });
        expect(fr("KC_7")).toMatchObject({ base: "è", shifted: "7" });
        expect(fr("KC_9")).toMatchObject({ base: "ç", shifted: "9" });
        expect(fr("KC_0")).toMatchObject({ base: "à", shifted: "0" });
        // Letters stay single: Shift only capitalizes them.
        expect(fr("KC_A")).toBeNull();
        expect(dualLegendFor("KC_Q", "", undefined, "german")).toBeNull();
    });

    it("non-US layouts pair keys by position (French, Danish)", () => {
        expect(dualLegendFor("KC_DOT", "", undefined, "french")).toMatchObject({ base: ":", shifted: "/" });
        expect(dualLegendFor("KC_SLASH", "", undefined, "french")).toMatchObject({ base: "!", shifted: "§" });
        expect(dualLegendFor("KC_MINUS", "", undefined, "danish")).toMatchObject({ base: "+", shifted: "?" });
        expect(dualLegendFor("KC_SLASH", "", undefined, "danish")).toMatchObject({ base: "-", shifted: "_" });
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

    it("fits both legends side by side in the key's width", () => {
        // Two one-character legends on a 1u small key (28 px inner, 4 px insets): 10 px fits.
        expect(fitDualLegend("small", 18, 20, 2).fontPx).toBe(10);
        // Three characters in that width step down.
        expect(fitDualLegend("small", 18, 20, 3).fontPx).toBeLessThanOrEqual(20 / 3);
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

    it("JIS keys draw their unshifted legend", () => {
        expect(text("LCTL(KC_JYEN)", { type: "modmask", modids: 0x0100, str: "|\n\u00a5", top: "LCTL" })).toBe("\u00a5");
        expect(text("LCTL(KC_RO)", { type: "modmask", modids: 0x0100, str: "_\n\\", top: "LCTL" })).toBe("\\");
    });

    it("two-word names and mouse buttons are unchanged", () => {
        expect(text("LCTL(KC_CAPSLOCK)", { type: "modmask", modids: 0x0100, str: "Caps\nLock", top: "LCTL" })).toBe("Caps");
        expect(text("LT1(KC_PGUP)", { type: "layerhold", str: "Page\nUp" })).toBe("Page");
        expect(text("LT1(KC_BTN1)", { type: "layerhold", str: "Mouse\n1" })).toBe("Mouse 1");
    });
});
