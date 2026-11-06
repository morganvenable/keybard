import { describe, expect, it } from "vitest";
import { BUTTON_TO_KEYCODE_MAP, LAYOUT_KEY_MAPS, LAYOUTS } from "@/components/Keyboards/layouts";
import { altgrOnlyLegend, dualLegendFor, hasAltGr, planLegends, positionalLegends, DIAGONAL_INSET_PX, DUAL_LEGEND_FONT_PX, KEY_BAND_PX, DUAL_LEGEND_LINE_HEIGHT } from "@/lib/shiftedLegends";
import { altgrLegendsFromSearch, keyLegendsFromSearch, pickerAltGrFromSearch } from "@/lib/deepLinks";
import { ALTGR_MODIFIERS, ALTGR_SIDE, applyModifiers } from "@/utils/modifierUtils";
import { shownPage, SETTINGS_PAGE } from "@/layout/SecondarySidebar/Panels/settings/layout";

const ALTGR_LAYOUTS = ["german", "french", "spanish", "italian", "br", "danish", "swiss"];

describe("AltGr data", () => {
    it("German has exactly the AltGr level Windows' German layout has", () => {
        // Read from KBDGR.DLL (ToUnicodeEx at Ctrl+Alt) and checked against the user's list.
        const want: Record<string, string> = {
            KC_2: "²", KC_3: "³", KC_7: "{", KC_8: "[", KC_9: "]", KC_0: "}", KC_MINUS: "\\",
            KC_Q: "@", KC_E: "€", KC_RBRACKET: "~", KC_NONUS_BSLASH: "|", KC_M: "µ",
        };
        const codes = new Set([...Object.values(BUTTON_TO_KEYCODE_MAP), ...Object.values(LAYOUT_KEY_MAPS.german)]);
        const got: Record<string, string> = {};
        for (const kc of codes) {
            const a = positionalLegends(kc, "german")?.altgr;
            if (a) got[kc] = a;
        }
        expect(got).toEqual(want);
    });

    it("spot checks on the other layouts", () => {
        expect(positionalLegends("KC_2", "spanish")?.altgr).toBe("@");
        expect(positionalLegends("KC_3", "spanish")?.altgr).toBe("#");
        expect(positionalLegends("KC_C", "br")?.altgr).toBe("₢");
        expect(positionalLegends("KC_LBRACKET", "spanish")?.altgr).toBe("[");
        expect(positionalLegends("KC_QUOTE", "spanish")?.altgr).toBe("{");
        expect(positionalLegends("KC_5", "italian")?.altgr).toBe("€");
        expect(positionalLegends("KC_4", "danish")?.altgr).toBe("$");
        expect(positionalLegends("KC_1", "swiss")?.altgr).toBe("¦");
        expect(positionalLegends("KC_4", "french")?.altgr).toBe("{");
        expect(positionalLegends("KC_RO", "br")?.altgr).toBe("°");
    });

    it("every altgr row lines up with its default row, one printable character per key", () => {
        for (const id of ALTGR_LAYOUTS) {
            const layout = LAYOUTS[id];
            expect(layout.altgr, id).toBeDefined();
            expect(layout.altgr!.length, id).toBe(layout.default.length);
            layout.altgr!.forEach((row, r) => {
                if (row === "") return;
                const tokens = row.split(" ");
                expect(tokens.length, `${id} row ${r}`).toBe(layout.default[r].split(" ").length);
                for (const tok of tokens) {
                    if (tok === "{none}") continue;
                    expect([...tok].length, `${id} ${tok}`).toBe(1);
                    expect(tok.codePointAt(0)!, `${id} ${tok}`).toBeGreaterThanOrEqual(0x20);
                }
            });
        }
    });

    it("hasAltGr: the layouts with a verified level, and not the rest", () => {
        for (const id of ALTGR_LAYOUTS) expect(hasAltGr(id), id).toBe(true);
        for (const id of ["us", "uk", "russian", "arabic", "zh_pinyin", "nope"]) expect(hasAltGr(id), id).toBe(false);
    });
});

describe("dualLegendFor with AltGr Symbols (the keycap grid)", () => {
    const on = { shifted: true, altgr: true };
    const de = (kc: string, label = "", opts = on) => dualLegendFor(kc, label, undefined, "german", opts);
    const fr = (kc: string, label = "", opts = on) => dualLegendFor(kc, label, undefined, "french", opts);

    it("digits get three legends: shifted top left, base bottom left, AltGr bottom right", () => {
        expect(de("KC_2")).toEqual({ base: "2", shifted: "\"", altgr: "²", grid: true });
        expect(de("KC_7")).toEqual({ base: "7", shifted: "/", altgr: "{", grid: true });
        expect(de("KC_RBRACKET")).toEqual({ base: "+", shifted: "*", altgr: "~", grid: true });
        expect(de("KC_MINUS", "ß")).toEqual({ base: "ß", shifted: "?", altgr: "\\", grid: true });
    });

    it("letters: the capital top left from the shift row, AltGr bottom right, no base", () => {
        expect(de("KC_Q", "q")).toEqual({ base: "q", shifted: "Q", altgr: "@", letter: true, grid: true });
        expect(de("KC_E", "e")).toEqual({ base: "e", shifted: "E", altgr: "€", letter: true, grid: true });
        expect(de("KC_M", "m")).toEqual({ base: "m", shifted: "M", altgr: "µ", letter: true, grid: true });
        // A letter with no AltGr character shows its capital alone, top left.
        expect(de("KC_W", "w")).toEqual({ base: "w", shifted: "W", letter: true, grid: true });
        expect(de("KC_A")).toEqual({ base: "a", shifted: "A", letter: true, grid: true });
    });

    it("keys without an AltGr character: shifted top left, base bottom left", () => {
        expect(de("KC_1")).toEqual({ base: "1", shifted: "!", grid: true });
    });

    it("off: the same grid without the AltGr legend and without letter capitals", () => {
        expect(de("KC_2", "", { shifted: true, altgr: false })).toEqual({ base: "2", shifted: "\"", grid: true });
        expect(dualLegendFor("KC_2", "", undefined, "german")).toEqual({ base: "2", shifted: "\"", grid: true });
        expect(de("KC_Q", "q", { shifted: true, altgr: false })).toBeNull();
        expect(de("KC_W", "w", { shifted: true, altgr: false })).toBeNull();
    });

    it("AltGr on with Shifted Key Symbols off: base and AltGr only", () => {
        const o = { shifted: false, altgr: true };
        expect(de("KC_2", "", o)).toEqual({ base: "2", altgr: "²", grid: true });
        expect(de("KC_1", "", o)).toBeNull();
        expect(de("KC_Q", "q", o)).toEqual({ base: "q", altgr: "@", grid: true });
        expect(de("KC_2", "", { shifted: false, altgr: false })).toBeNull();
    });

    it("every layout, US included, gets the grid; layouts without AltGr data have no third legend and no letter capitals", () => {
        expect(dualLegendFor("KC_2", "", undefined, "us", on)).toEqual({ base: "2", shifted: "@", grid: true });
        expect(dualLegendFor("KC_SLASH", "", undefined, "us")).toEqual({ base: "/", shifted: "?", grid: true });
        expect(dualLegendFor("KC_2", "", undefined, "uk", on)).toEqual({ base: "2", shifted: "\"", grid: true });
        expect(dualLegendFor("KC_Q", "q", undefined, "us", on)).toBeNull();
    });

    it("a key drawing something else (the picker with its Shift on) keeps one legend", () => {
        expect(de("KC_Q", "Q")).toBeNull();
        expect(de("KC_2", "\"")).toBeNull();
    });

    it("French number-row keys read Shift's digit from the shift row, never the capital of the base", () => {
        expect(fr("KC_9")).toEqual({ base: "ç", shifted: "9", altgr: "^", grid: true });
        expect(fr("KC_0")).toEqual({ base: "à", shifted: "0", altgr: "@", grid: true });
        expect(fr("KC_2")).toEqual({ base: "é", shifted: "2", grid: true }); // AltGr+é is a dead key: left out
        expect(fr("KC_7")).toEqual({ base: "è", shifted: "7", grid: true }); // AltGr+è is a dead key: left out
        expect(fr("KC_9", "Ç")).toEqual({ base: "ç", shifted: "9", altgr: "^", grid: true });
        expect(fr("KC_9", "9")).toBeNull(); // the picker with Shift on draws 9 alone
        expect(fr("KC_9", "", { shifted: false, altgr: true })).toEqual({ base: "ç", altgr: "^", grid: true });
    });

    it("every shifted legend is the shift-row token at its own place, never an upper-cased base", () => {
        for (const id of ALTGR_LAYOUTS) {
            for (const kc of new Set([...Object.values(BUTTON_TO_KEYCODE_MAP), ...Object.values(LAYOUT_KEY_MAPS[id] ?? {})])) {
                const full = positionalLegends(kc, id);
                const d = dualLegendFor(kc, "", undefined, id, on);
                if (!d?.shifted) continue;
                expect(d.shifted, `${id} ${kc}`).toBe(full!.shifted);
                if (!d.letter) expect(d.shifted.toLocaleLowerCase(), `${id} ${kc}`).not.toBe(d.base.toLocaleLowerCase());
            }
        }
    });

    it("wrapped keys: modifiers, mod-taps and layer-taps get their base key's legends", () => {
        expect(dualLegendFor("LCTL_T(KC_2)", "2", { type: "modtap" } as never, "german", on)).toEqual({ base: "2", shifted: "\"", altgr: "²", grid: true });
        expect(dualLegendFor("LT1(KC_Q)", "q", { type: "layerhold" } as never, "german", on)).toEqual({ base: "q", shifted: "Q", altgr: "@", letter: true, grid: true });
        // Shift and AltGr wrappers draw what they type: no extra legends.
        expect(dualLegendFor("LSFT(KC_2)", "\"", { type: "modmask", modids: 0x0200 } as never, "german", on)).toBeNull();
        expect(dualLegendFor("RALT(KC_2)", "2", { type: "modmask", modids: 0x1400 } as never, "german", on)).toBeNull();
        expect(dualLegendFor("RAG(KC_2)", "2", { type: "modmask", modids: 0x1800 | 0x1400 } as never, "german", on)).toBeNull();
    });
});

describe("altgrOnlyLegend", () => {
    const raltKey = { type: "modmask", modids: 0x1400 } as never;

    it("RALT(KC_2) types the AltGr character on German", () => {
        expect(altgrOnlyLegend("RALT(KC_2)", raltKey, "german")).toBe("²");
        expect(altgrOnlyLegend("ALGR(KC_8)", { type: "modmask" } as never, "german")).toBe("[");
        expect(altgrOnlyLegend("RALT(KC_Q)", raltKey, "german")).toBe("@");
    });

    it("nothing when the key types no AltGr character, or is not AltGr alone", () => {
        expect(altgrOnlyLegend("RALT(KC_A)", raltKey, "german")).toBeNull();
        expect(altgrOnlyLegend("RALT(KC_2)", raltKey, "us")).toBeNull();
        expect(altgrOnlyLegend("LCTL(KC_2)", { type: "modmask", modids: 0x0100 } as never, "german")).toBeNull();
        expect(altgrOnlyLegend("RCAG(KC_2)", { type: "modmask", modids: 0x1500 } as never, "german")).toBeNull();
        expect(altgrOnlyLegend("RALT(KC_2)", { type: "modmask", modids: 0x1600 } as never, "german")).toBeNull();
        expect(altgrOnlyLegend("RALT_T(KC_2)", { type: "modtap" } as never, "german")).toBeNull();
        expect(altgrOnlyLegend("KC_2", undefined, "german")).toBeNull();
    });
});

describe("planLegends: where three legends fit", () => {
    type Size = "default" | "medium" | "small";
    // Inner size of a 1u key: the key less its 1 px borders; room less the bands; width less the side insets.
    const room = (px: number, size: Size, bands = 0) => px - 2 - KEY_BAND_PX[size] * bands;
    const width = (px: number, size: Size) => px - 2 - 2 * DIAGONAL_INSET_PX[size].x;
    const three = { base: "2", shifted: "\"", altgr: "²", grid: true };
    const letter = { base: "q", altgr: "@", grid: true };
    const plan = (l: typeof three | typeof letter, size: Size, px: number, bands = 0, fold = false) =>
        planLegends(l, size, room(px, size, bands), width(px, size), fold);

    it("a plain key holds all three at the full size: 60, 45 and 30 px keys", () => {
        expect(plan(three, "default", 60)).toMatchObject({ fontPx: 15, droppedAltGr: false });
        expect(plan(three, "medium", 45)).toMatchObject({ fontPx: 12, droppedAltGr: false });
        expect(plan(three, "small", 30)).toMatchObject({ fontPx: 10, droppedAltGr: false });
        expect(plan(three, "small", 30)?.legend.altgr).toBe("²");
    });

    it("three legends never overlap: two lines fit the room and the bottom pair fits across", () => {
        for (const [size, px] of [["default", 60], ["medium", 45], ["small", 30]] as const) {
            const p = plan(three, size, px)!;
            expect(2 * p.fontPx * DUAL_LEGEND_LINE_HEIGHT + 2 * p.insetY).toBeLessThanOrEqual(room(px, size) + 1e-9);
            expect(2 * p.fontPx).toBeLessThanOrEqual(width(px, size) + 1e-9); // two 1 em glyphs side by side
        }
    });

    it("a key with a band keeps three only where two lines fit beside the band", () => {
        expect(plan(three, "default", 60, 1)).toMatchObject({ fontPx: 15, droppedAltGr: false }); // 40 px of room
        expect(plan(three, "medium", 45, 1)?.droppedAltGr).toBe(true); // 29 px: needs 31
        expect(plan(three, "small", 30, 1)?.droppedAltGr).toBe(true); // 18 px: needs 26
        expect(plan(three, "default", 60, 2)?.droppedAltGr).toBe(true); // both bands: 22 px
    });

    it("a dropped AltGr legend leaves the two-legend diagonal", () => {
        const p = plan(three, "small", 30, 1)!;
        expect(p.legend).toEqual({ base: "2", shifted: "\"" });
        expect(p.fontPx).toBe(10);
    });

    it("a combo fold takes the lower right corner: two legends at every size", () => {
        for (const [size, px] of [["default", 60], ["medium", 45], ["small", 30]] as const) {
            expect(plan(three, size, px, 0, true)).toMatchObject({ droppedAltGr: true, legend: { base: "2", shifted: "\"" } });
        }
    });

    it("a letter holds base and AltGr in one line, with a band too, but not under a fold", () => {
        expect(plan(letter, "small", 30)).toMatchObject({ fontPx: 10, droppedAltGr: false });
        expect(plan(letter, "small", 30, 1)).toMatchObject({ fontPx: 10, droppedAltGr: false });
        expect(plan(letter, "default", 60, 1)).toMatchObject({ fontPx: 15, droppedAltGr: false });
        expect(plan(letter, "small", 30, 0, true)).toBeNull();
    });

    it("without an AltGr legend it is the existing diagonal", () => {
        expect(plan({ base: "1", shifted: "!" } as never, "small", 30)).toMatchObject({ fontPx: 10, droppedAltGr: false });
    });
});

describe("the picker's AltGr button", () => {
    it("binds RALT(key), Right Alt, whatever the L/R side toggle says", () => {
        expect(applyModifiers("KC_Q", ALTGR_MODIFIERS, false, ALTGR_SIDE)).toBe("RALT(KC_Q)");
        expect(applyModifiers("KC_7", ALTGR_MODIFIERS, false, ALTGR_SIDE)).toBe("RALT(KC_7)");
    });

    it("a RALT(key) binding shows its AltGr character on an AltGr layout, nothing extra elsewhere", () => {
        const ralt = { type: "modmask", modids: 0x1400 } as never;
        expect(altgrOnlyLegend("RALT(KC_7)", ralt, "german")).toBe("{");
        expect(altgrOnlyLegend("RALT(KC_9)", ralt, "german")).toBe("]");
        expect(altgrOnlyLegend("RALT(KC_9)", ralt, "us")).toBeNull();
    });

    it("the button shows only for a layout with AltGr data", () => {
        expect(hasAltGr("german")).toBe(true);
        expect(hasAltGr("us")).toBe(false);
    });

    it("?pickerAltGr=on opens it", () => {
        expect(pickerAltGrFromSearch("?pickerAltGr=on")).toBe(true);
        expect(pickerAltGrFromSearch("?pickerAltGr=off")).toBe(false);
        expect(pickerAltGrFromSearch("")).toBe(false);
    });
});

describe("review links and the Settings row", () => {
    it("?keyLegends and ?altgrLegends", () => {
        expect(keyLegendsFromSearch("?keyLegends=German")).toBe("german");
        expect(keyLegendsFromSearch("?x=1")).toBeNull();
        expect(altgrLegendsFromSearch("?altgrLegends=on")).toBe(true);
        expect(altgrLegendsFromSearch("?altgrLegends=off")).toBe(false);
        expect(altgrLegendsFromSearch("?altgrLegends=maybe")).toBeNull();
        expect(altgrLegendsFromSearch("")).toBeNull();
    });

    it("the AltGr symbols row shows only with a layout that has AltGr data", () => {
        const has = (altgr: boolean | undefined) =>
            shownPage({ touchpad: true, debugConsole: true, altgr }, SETTINGS_PAGE)
                .some((s) => s.rows.some((r) => "setting" in r && r.setting === "altgr-legends"));
        expect(has(true)).toBe(true);
        expect(has(false)).toBe(false);
    });
});

describe("planLegends: the keycap grid", () => {
    type Size = "default" | "medium" | "small";
    const room = (px: number, size: Size, bands = 0) => px - 2 - KEY_BAND_PX[size] * bands;
    const width = (px: number, size: Size) => px - 2 - 2 * DIAGONAL_INSET_PX[size].x;
    const SIZES = [["default", 60], ["medium", 45], ["small", 30]] as const;
    const three = { base: "9", shifted: ")", altgr: "]", grid: true };
    const letterAltGr = { base: "q", shifted: "Q", altgr: "@", letter: true, grid: true };
    const letterAlone = { base: "w", shifted: "W", letter: true, grid: true };
    const two = { base: "2", shifted: "@", grid: true };
    const plan = (l: object, size: Size, px: number, bands = 0, fold = false) => planLegends(l as never, size, room(px, size, bands), width(px, size), fold);

    it("a plain key holds the grid at the full size on 60, 45 and 30 px keys, for every kind", () => {
        for (const [size, px] of SIZES) {
            for (const l of [three, letterAltGr, letterAlone, two]) {
                expect(plan(l, size, px), `${size} ${l.base}`).toMatchObject({ fontPx: DUAL_LEGEND_FONT_PX[size], grid: true, droppedAltGr: false });
            }
        }
    });

    it("a combo fold: digits and symbols fall back to the two-legend diagonal, a letter to one legend", () => {
        for (const [size, px] of SIZES) {
            expect(plan(three, size, px, 0, true)).toMatchObject({ grid: false, droppedAltGr: true, legend: { base: "9", shifted: ")" } });
            expect(plan(two, size, px, 0, true)).toMatchObject({ grid: false, legend: { base: "2", shifted: "@" } });
            expect(plan(letterAltGr, size, px, 0, true)).toBeNull();
            expect(plan(letterAlone, size, px, 0, true)).toBeNull();
        }
    });

    it("one band: the grid only where two lines fit beside it (60 px), else the diagonal", () => {
        expect(plan(three, "default", 60, 1)).toMatchObject({ grid: true });
        expect(plan(three, "medium", 45, 1)).toMatchObject({ grid: false, droppedAltGr: true });
        expect(plan(three, "small", 30, 1)).toMatchObject({ grid: false, droppedAltGr: true });
        expect(plan(two, "medium", 45, 1)).toMatchObject({ grid: false });
        expect(plan(two, "small", 30, 1)).toMatchObject({ grid: false });
    });

    it("a letter with a band: capital and AltGr fall back to base and AltGr on one line, a lone capital stays", () => {
        expect(plan(letterAltGr, "small", 30, 1)).toMatchObject({ grid: false, legend: { base: "q", altgr: "@" } });
        expect(plan(letterAltGr, "default", 60, 1)).toMatchObject({ grid: true });
        expect(plan(letterAlone, "small", 30, 1)).toMatchObject({ grid: true });
    });

    it("the diagonal is unchanged without the grid", () => {
        expect(plan({ base: "1", shifted: "!" }, "small", 30)).toMatchObject({ grid: false, fontPx: 10 });
    });
});
