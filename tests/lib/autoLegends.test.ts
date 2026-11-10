import { describe, expect, it, vi, afterEach } from "vitest";
import { AUTO_LAYOUT_IDS, classifyLayoutMap, matchLayoutMap, detectBrowserLayout, layoutCodeMap, overlayLayoutFor, resolveKeyLegends } from "@/lib/autoLegends";

describe("Key legends: Automatic resolves to a layout", () => {
    it("a chosen layout is used as it is", () => {
        expect(resolveKeyLegends("german")).toEqual({ layoutId: "german", source: "chosen", text: "" });
        expect(resolveKeyLegends("nonsense").layoutId).toBe("us");
    });

    it("a chosen layout says why when the Overlay can't read this computer's layout", () => {
        expect(resolveKeyLegends("uk", { available: false }).text).toMatch(/doesn't tell apps its keyboard layout/);
    });

    it("the Overlay's reading comes first", () => {
        const s = resolveKeyLegends("auto", { available: true, layoutId: "german", name: "German" }, "french");
        expect(s).toMatchObject({ layoutId: "german", source: "overlay" });
        expect(s.text).toBe("Your computer is using German, so keys show German.");
    });

    it("a layout Keybard has no legends for shows US and names it", () => {
        const s = resolveKeyLegends("auto", { available: true, layoutId: null, name: "Japanese", id: "00000411" });
        expect(s).toMatchObject({ layoutId: "us", source: "overlay" });
        expect(s.text).toBe("Keybard has no key legends for Japanese yet, so keys show English (US).");
        expect(resolveKeyLegends("auto", { available: true, layoutId: null }).text).toMatch(/your computer's keyboard layout yet/);
        // Arabic has a map but its Shift row isn't verified: Automatic never picks it.
        expect(resolveKeyLegends("auto", { available: true, layoutId: "arabic" }).layoutId).toBe("us");
    });

    it("without the Overlay, the browser's keyboard map", () => {
        expect(resolveKeyLegends("auto", undefined, "french")).toMatchObject({ layoutId: "french", source: "browser" });
        expect(resolveKeyLegends("auto", { available: false }, "uk")).toMatchObject({ layoutId: "uk", source: "browser" });
        expect(resolveKeyLegends("auto", undefined, null)).toMatchObject({ layoutId: "us", source: "browser" });
    });

    it("when nothing can tell, US, and it says so plainly", () => {
        const s = resolveKeyLegends("auto");
        expect(s).toMatchObject({ layoutId: "us", source: "none" });
        expect(s.text).toBe("Keybard can't tell which keyboard layout your computer uses, so keys show English (US). Choose your layout to change that.");
    });
});

describe("Keybard Overlay's page", () => {
    it("draws its configured layout, or for auto the one it reads (US when unknown or unavailable)", () => {
        expect(overlayLayoutFor("german", { available: true, layoutId: "french" })).toBe("german");
        expect(overlayLayoutFor("auto", { available: true, layoutId: "french" })).toBe("french");
        expect(overlayLayoutFor("auto", { available: true, layoutId: null })).toBe("us");
        expect(overlayLayoutFor("auto", { available: false })).toBe("us");
        expect(overlayLayoutFor("auto")).toBe("us");
        expect(overlayLayoutFor(undefined)).toBe("us");
    });
});

/** A browser keyboard map for a layout: its own unshifted characters, with some keys changed. */
const mapFor = (id: string, change: Record<string, string> = {}) => new Map(Object.entries({ ...layoutCodeMap(id), ...change }));

describe("the browser's keyboard map", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("places every row of every Automatic layout", () => {
        for (const id of AUTO_LAYOUT_IDS) expect(Object.keys(layoutCodeMap(id)).length).toBeGreaterThanOrEqual(46);
        expect(layoutCodeMap("german")).toMatchObject({ KeyY: "z", KeyZ: "y", Semicolon: "ö", IntlBackslash: "<" });
        expect(layoutCodeMap("uk")).toMatchObject({ Backslash: "#", IntlBackslash: "\\" });
        expect(layoutCodeMap("french")).toMatchObject({ KeyQ: "a", Digit9: "ç" });
    });

    it("matches each Automatic layout to itself", () => {
        // US-International types US's base characters: the browser's map reads it as US.
        for (const id of AUTO_LAYOUT_IDS) expect(classifyLayoutMap(mapFor(id))).toBe(id === "us_intl" ? "us" : id);
    });

    it("tells US from UK by the keys they differ on", () => {
        expect(classifyLayoutMap(mapFor("us", { IntlBackslash: "\\" }))).toBe("us");
        expect(classifyLayoutMap(mapFor("uk"))).toBe("uk");
    });

    it("allows a key or two reported differently, such as a dead key", () => {
        expect(classifyLayoutMap(mapFor("german", { Backquote: "̂", Equal: "́" }))).toBe("german");
    });

    it("is unsure, and doesn't pick, when two layouts come close (Mac British reads almost like US)", () => {
        const macBritish = mapFor("uk", { Backslash: "\\", IntlBackslash: "§", Backquote: "§" });
        expect(matchLayoutMap(macBritish, false)).toEqual({ unsure: ["us", "uk"] });
        expect(classifyLayoutMap(macBritish)).toBeNull();
        const s = resolveKeyLegends("auto", undefined, { unsure: ["us", "uk"] });
        expect(s).toMatchObject({ layoutId: "us", source: "browser" });
        expect(s.text).toBe("Keybard can't be sure your computer uses English (US) or English (UK), so keys show English (US). Choose your layout to change that.");
    });

    it("on a Mac, trusts only an exact match", () => {
        expect(matchLayoutMap(mapFor("german"), true)).toBe("german");
        expect(matchLayoutMap(mapFor("german", { Backquote: "̂" }), true)).toEqual({ unsure: ["german"] });
        expect(matchLayoutMap(mapFor("german", { Backquote: "̂" }), false)).toBe("german");
        expect(resolveKeyLegends("auto", undefined, { unsure: ["german"] }).text).toBe("Keybard can't be sure your computer uses German, so keys show English (US). Choose your layout to change that.");
        // A layout chosen by hand is unaffected.
        expect(resolveKeyLegends("german", undefined, { unsure: ["us", "uk"] })).toMatchObject({ layoutId: "german", source: "chosen" });
    });

    it("matches nothing for a layout Keybard has no legends for, or a short map", () => {
        const dvorak = mapFor("us", { KeyQ: "'", KeyW: ",", KeyE: ".", KeyR: "p", KeyT: "y", KeyS: "o", KeyD: "e", KeyF: "u", KeyZ: ";" });
        expect(classifyLayoutMap(dvorak)).toBeNull();
        expect(classifyLayoutMap({ KeyA: "a" })).toBeNull();
    });

    it("is read from navigator.keyboard where the browser has it, and undefined where it doesn't", async () => {
        vi.stubGlobal("navigator", { keyboard: { getLayoutMap: async () => mapFor("danish") } });
        expect(await detectBrowserLayout()).toBe("danish");
        vi.stubGlobal("navigator", { keyboard: { getLayoutMap: async () => { throw new Error("not allowed in a frame"); } } });
        expect(await detectBrowserLayout()).toBeUndefined();
        vi.stubGlobal("navigator", {});
        expect(await detectBrowserLayout()).toBeUndefined();
    });
});
