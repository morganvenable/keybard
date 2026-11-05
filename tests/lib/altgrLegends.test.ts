import { describe, expect, it } from "vitest";
import { BUTTON_TO_KEYCODE_MAP, LAYOUT_KEY_MAPS, LAYOUTS } from "@/components/Keyboards/layouts";
import { altgrOnlyLegend, dualLegendFor, hasAltGr, planLegends, positionalLegends, DIAGONAL_INSET_PX, KEY_BAND_PX, DUAL_LEGEND_LINE_HEIGHT } from "@/lib/shiftedLegends";
import { altgrLegendsFromSearch, keyLegendsFromSearch } from "@/lib/deepLinks";
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

describe("dualLegendFor with AltGr Symbols", () => {
    const on = { shifted: true, altgr: true };
    const de = (kc: string, label = "", opts = on) => dualLegendFor(kc, label, undefined, "german", opts);

    it("digits get three legends", () => {
        expect(de("KC_2")).toEqual({ base: "2", shifted: "\"", altgr: "²" });
        expect(de("KC_7")).toEqual({ base: "7", shifted: "/", altgr: "{" });
        expect(de("KC_RBRACKET")).toEqual({ base: "+", shifted: "*", altgr: "~" });
    });

    it("letters get their base and AltGr legends, no shifted legend", () => {
        expect(de("KC_Q", "q")).toEqual({ base: "q", altgr: "@" });
        expect(de("KC_E", "e")).toEqual({ base: "e", altgr: "€" });
        expect(de("KC_M", "m")).toEqual({ base: "m", altgr: "µ" });
        expect(de("KC_MINUS", "ß")).toEqual({ base: "ß", altgr: "\\" });
        expect(de("KC_W", "w")).toBeNull(); // no AltGr character
    });

    it("French number-row keys read Shift's digit from the shift row, never the capital of the base", () => {
        const fr = (kc: string, label = "", opts = on) => dualLegendFor(kc, label, undefined, "french", opts);
        expect(fr("KC_9")).toEqual({ base: "ç", shifted: "9", altgr: "^" });
        expect(fr("KC_0")).toEqual({ base: "à", shifted: "0", altgr: "@" });
        expect(fr("KC_2")).toEqual({ base: "é", shifted: "2" }); // AltGr+é is a dead key: left out
        expect(fr("KC_7")).toEqual({ base: "è", shifted: "7" }); // AltGr+è is a dead key: left out
        // The layout draws these with the base letter in any case.
        expect(fr("KC_9", "Ç")).toEqual({ base: "ç", shifted: "9", altgr: "^" });
        expect(fr("KC_9", "9")).toBeNull(); // the picker with Shift on draws 9 alone
        // Shift off: the base and AltGr only, still no synthesized capital.
        expect(fr("KC_9", "", { shifted: false, altgr: true })).toEqual({ base: "ç", altgr: "^" });
        expect(de("KC_Q", "q")).toEqual({ base: "q", altgr: "@" }); // drawn as Q with @, no shifted legend
    });

    it("every shifted legend is the shift-row token at its own place, never an upper-cased base", () => {
        for (const id of ALTGR_LAYOUTS) {
            for (const kc of new Set([...Object.values(BUTTON_TO_KEYCODE_MAP), ...Object.values(LAYOUT_KEY_MAPS[id] ?? {})])) {
                const full = positionalLegends(kc, id);
                const d = dualLegendFor(kc, "", undefined, id, on);
                if (!d?.shifted) continue;
                expect(d.shifted, `${id} ${kc}`).toBe(full!.shifted);
                expect(d.shifted.toLocaleLowerCase(), `${id} ${kc}`).not.toBe(d.base.toLocaleLowerCase());
            }
        }
    });

    it("keys without an AltGr character keep what they had", () => {
        expect(de("KC_1")).toEqual({ base: "1", shifted: "!" });
        expect(de("KC_A")).toBeNull();
    });

    it("off: nothing changes", () => {
        expect(de("KC_2", "", { shifted: true, altgr: false })).toEqual({ base: "2", shifted: "\"" });
        expect(dualLegendFor("KC_2", "", undefined, "german")).toEqual({ base: "2", shifted: "\"" });
        expect(de("KC_Q", "q", { shifted: true, altgr: false })).toBeNull();
    });

    it("AltGr on with Shifted Key Symbols off: base and AltGr only", () => {
        expect(de("KC_2", "", { shifted: false, altgr: true })).toEqual({ base: "2", altgr: "²" });
        expect(de("KC_1", "", { shifted: false, altgr: true })).toBeNull();
        expect(de("KC_2", "", { shifted: false, altgr: false })).toBeNull();
    });

    it("layouts without AltGr data are unchanged", () => {
        expect(dualLegendFor("KC_2", "", undefined, "us", on)).toEqual({ base: "2", shifted: "@" });
        expect(dualLegendFor("KC_2", "", undefined, "uk", on)).toEqual({ base: "2", shifted: "\"" });
        expect(dualLegendFor("KC_Q", "q", undefined, "us", on)).toBeNull();
    });

    it("a key drawing something else (the picker with its Shift on) keeps one legend", () => {
        expect(de("KC_Q", "Q")).toBeNull();
        expect(de("KC_2", "\"")).toBeNull();
    });

    it("wrapped keys: modifiers, mod-taps and layer-taps get their base key's legends", () => {
        expect(dualLegendFor("LCTL_T(KC_2)", "2", { type: "modtap" } as never, "german", on)).toEqual({ base: "2", shifted: "\"", altgr: "²" });
        expect(dualLegendFor("LT1(KC_Q)", "q", { type: "layerhold" } as never, "german", on)).toEqual({ base: "q", altgr: "@" });
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
    const three = { base: "2", shifted: "\"", altgr: "²" };
    const letter = { base: "q", altgr: "@" };
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
