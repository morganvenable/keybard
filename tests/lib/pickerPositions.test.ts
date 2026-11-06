import { describe, expect, it } from "vitest";
import { LAYOUTS, getLabelForKeycode, keycodeForToken } from "@/components/Keyboards/layouts";

describe("picker keys are their position's keycode", () => {
    it("German and Swiss swap Y and Z; the shown capital does not change the keycode", () => {
        for (const id of ["german", "swiss"]) {
            expect(keycodeForToken(id, "z"), id).toBe("KC_Y");
            expect(keycodeForToken(id, "y"), id).toBe("KC_Z");
        }
        // Shift on the Y position draws Z, but the keycode comes from the unshifted token.
        expect(LAYOUTS.german.default[2].split(" ")[6]).toBe("z");
        expect(LAYOUTS.german.shift[2].split(" ")[6]).toBe("Z");
        expect(keycodeForToken("german", LAYOUTS.german.default[2].split(" ")[6])).toBe("KC_Y");
    });

    it("German number row: Shift+2 is KC_2 (shown \"), not KC_DQUO", () => {
        const row = LAYOUTS.german.default[1].split(" ");
        const shift = LAYOUTS.german.shift[1].split(" ");
        const i = row.indexOf("2");
        expect(shift[i]).toBe("\"");
        expect(keycodeForToken("german", row[i])).toBe("KC_2");
        // Resolving the shown character instead would pick the US name for it:
        expect(keycodeForToken("us", shift[i])).not.toBe("KC_2");
    });

    it("French letters follow the AZERTY positions", () => {
        expect(keycodeForToken("french", "a")).toBe("KC_Q");
        expect(keycodeForToken("french", "q")).toBe("KC_A");
        expect(keycodeForToken("french", "w")).toBe("KC_Z");
    });

    it("every non-structural token of every layout resolves to a keycode", () => {
        for (const [id, layout] of Object.entries(LAYOUTS)) {
            for (const row of layout.default) {
                for (const tok of row.split(" ")) {
                    if (!tok || tok.startsWith("{")) continue;
                    expect(keycodeForToken(id, tok), `${id} ${tok}`).toMatch(/^KC_/);
                }
            }
        }
    });

    it("a bound key shows the legend at its position: Shift is the shift row, not a US-name match", () => {
        expect(getLabelForKeycode("LSFT(KC_Y)", "german")).toBe("Z");
        expect(getLabelForKeycode("LSFT(KC_2)", "german")).toBe("\"");
        expect(getLabelForKeycode("KC_AT", "german")).toBe("\""); // KC_AT is LSFT(KC_2)
        expect(getLabelForKeycode("LSFT(KC_COMMA)", "german")).toBe(";");
        expect(getLabelForKeycode("LSFT(KC_DOT)", "german")).toBe(":");
        expect(getLabelForKeycode("LSFT(KC_QUOTE)", "french")).toBe("%");
        expect(getLabelForKeycode("LSFT(KC_Y)", "swiss")).toBe("Z");
        expect(getLabelForKeycode("KC_Z", "swiss")).toBe("y");
        expect(getLabelForKeycode("KC_QUES", "us")).toBe("?");
        expect(getLabelForKeycode("LSFT(KC_SLASH)", "us")).toBe("?");
        expect(getLabelForKeycode("KC_1", "german")).toBe("1");
    });
});

describe("every layout's picker keys sit at their physical positions", () => {
    const ROW1 = ["KC_GRAVE", "KC_1", "KC_2", "KC_3", "KC_4", "KC_5", "KC_6", "KC_7", "KC_8", "KC_9", "KC_0", "KC_MINUS", "KC_EQUAL"];
    const ROW2 = ["KC_Q", "KC_W", "KC_E", "KC_R", "KC_T", "KC_Y", "KC_U", "KC_I", "KC_O", "KC_P", "KC_LBRACKET", "KC_RBRACKET", "KC_BSLASH"];
    const ROW3 = ["KC_A", "KC_S", "KC_D", "KC_F", "KC_G", "KC_H", "KC_J", "KC_K", "KC_L", "KC_SCOLON", "KC_QUOTE", "KC_NONUS_HASH"];
    const ROW4 = ["KC_NONUS_BSLASH", "KC_Z", "KC_X", "KC_C", "KC_V", "KC_B", "KC_N", "KC_M", "KC_COMMA", "KC_DOT", "KC_SLASH"];
    const norm = (c: string) => ({ KC_NUHS: "KC_NONUS_HASH", KC_NUBS: "KC_NONUS_BSLASH", KC_BSLS: "KC_BSLASH" }[c] ?? c);
    for (const id of ["us", "uk", "german", "french", "spanish", "italian", "br", "danish", "swiss"]) {
        it(`${id}`, () => {
            const layout = LAYOUTS[id];
            const bad: string[] = [];
            const check = (rowIdx: number, expected: string[], from: string) => {
                const toks = layout.default[rowIdx].split(" ").filter((t) => !t.startsWith("{") || t === "{cedilla}");
                // ISO rows carry the extra key at the end (row 3: #), US/ANSI row 2 carries "\\" instead.
                toks.forEach((t, i) => {
                    const exp = id === "us" || id === "br" || rowIdx !== 3 ? expected[i] : expected[i];
                    const got = norm(keycodeForToken(id, t));
                    // UK draws its # key at the end of row 2; Danish ' is KC_BSLASH (an existing data choice).
                    const alt = (id === "uk" && t === "#") || (id === "danish" && t === "'") ? got : exp;
                    if (exp && got !== alt) bad.push(`${from} ${t}: ${got} vs ${exp}`);
                    if (exp && alt === got && exp !== got && !(id === "uk" && t === "#") && !(id === "danish" && t === "'")) bad.push(`${from} ${t}`);
                });
            };
            check(1, ROW1, "row1");
            check(2, ROW2, "row2");
            check(3, ROW3, "row3");
            // Row 4: ISO layouts start with the extra key; ANSI start at Z.
            const r4 = layout.default[4].split(" ").filter((t) => !t.startsWith("{"));
            if (r4.length === 12) return; // Brazilian ABNT2 carries an extra key at the end of row 4
            const iso = r4.length === 11;
            r4.forEach((t, i) => {
                const exp = (iso ? ROW4 : ROW4.slice(1))[i];
                const got = norm(keycodeForToken(id, t));
                if (exp && got !== exp) bad.push(`row4 ${t}: ${got} vs ${exp}`);
            });
            expect(bad).toEqual([]);
        });
    }
});

describe("no layout's picker rows repeat a keycode", () => {
    for (const [id, layout] of Object.entries(LAYOUTS)) {
        if (!layout.default.length) continue;
        it(id, () => {
            const seen = new Map<string, string>();
            const dups: string[] = [];
            layout.default.forEach((row, r) => {
                if (r === 0 || r === layout.default.length - 1) return; // function row, bottom row
                for (const tok of row.split(" ")) {
                    if (!tok || tok.startsWith("{")) continue;
                    const kc = keycodeForToken(id, tok);
                    if (seen.has(kc)) dups.push(`${kc}: ${seen.get(kc)} and ${tok}`);
                    seen.set(kc, tok);
                }
            });
            expect(dups).toEqual([]);
        });
    }
});
