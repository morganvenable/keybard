// A11: layout sweep. For light and dark, NORMAL / MEDIUM / SMALL keys and
// four window widths (1440, 1280, 1024 and a phone), open every rail panel
// and check the layout rules: nothing in the side panel scrolls sideways,
// the toolbar and layer strip stay on one line or scroll, no clipped text,
// no single word wrapped alone, rail items not cut off or covered.
//
// Each combination measures once (beforeAll) and then asserts each rule in
// its own test, so a known problem in one rule does not hide the others.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { CANVAS_KEY } from "./fixtures";
import { byCheck, detailPanel, FINDING_IMG_DIR, KEY_SIZE_BUTTON, knownBug, layoutIssues, RAIL_PANELS, railItem, type LayoutIssue } from "./g1-helpers";

const WIDTHS = [
    { name: "1440", width: 1440, height: 844 },
    { name: "1280", width: 1280, height: 800 },
    { name: "1024", width: 1024, height: 768 },
    { name: "phone", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
const SIZES = ["normal", "medium", "small"] as const;

type Rule = "panel-overflow" | "toolbar" | "layer-strip" | "clipped-text" | "orphan-word" | "rail" | "controls" | "console";
const RULES: Rule[] = ["panel-overflow", "toolbar", "layer-strip", "clipped-text", "orphan-word", "rail", "controls", "console"];
const RULE_CHECKS: Record<Rule, string[]> = {
    "panel-overflow": ["panel-overflow"],
    toolbar: ["toolbar-one-line", "toolbar-clipped"],
    "layer-strip": ["layer-strip-one-line", "layer-strip-clipped"],
    "clipped-text": ["clipped-text"],
    "orphan-word": ["orphan-word"],
    rail: ["rail-cut-off", "rail-overlap"],
    controls: ["controls-overlap"],
    console: ["console"],
};

/**
 * Known app problems (findings), by rule and window. A rule listed here is
 * marked test.fail() for that window, so the suite documents the bug and
 * turns red when it is fixed (remove the entry then). UX_SHOW_KNOWN=1 runs
 * them as normal tests. The same problems show in both themes and at every
 * key size, so the map is by width only.
 */
const KNOWN: Partial<Record<Rule, Partial<Record<string, string>>>> = {
    // g1-07: at 800px tall or less the rail does not fit: About is cut in half and
    //        Settings is hidden below it, with no scroll cue.
    // g1-12: the build label (bottom left) is drawn over the rail's last item.
    rail: { "1440": "g1-12", "1280": "g1-07", "1024": "g1-07", phone: "g1-12" },
    // g1-08: at 1024 wide an open panel covers the whole toolbar and most of the keyboard.
    // g1-09: on a phone the toolbar and layer strip are cut off with no scroll cue.
    toolbar: { "1024": "g1-08", phone: "g1-09" },
    "layer-strip": { phone: "g1-09" },
    // g1-10: on a phone the Standard Keys picker is wider than the panel.
    "panel-overflow": { phone: "g1-10" },
    // g1-11: on a phone the Layouts panel cuts layer names off with an ellipsis.
    "clipped-text": { phone: "g1-11" },
    // g1-13: short descriptions leave one word alone on the last line (Settings, Quick Start).
    "orphan-word": { "1440": "g1-13", "1280": "g1-13", "1024": "g1-13", phone: "g1-13" },
    // g1-14: on a phone, with a tall panel open, the key size controls sit on the thumb keys.
    controls: { phone: "g1-14" },
};
function knownFinding(rule: Rule, width: string): string | null {
    return KNOWN[rule]?.[width] ?? null;
}

type Sweep = { issues: (LayoutIssue & { where: string })[]; errors: string[] };

async function sweep(browser: Browser, w: typeof WIDTHS[number], theme: string, size: string): Promise<Sweep> {
    const context = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page: Page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    const out: Sweep = { issues: [], errors };
    try {
        await page.goto(`./?demo&theme=${theme}`);
        await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
        await page.getByRole("button", { name: KEY_SIZE_BUTTON[size as keyof typeof KEY_SIZE_BUTTON] }).click();
        await page.waitForTimeout(300);
        const record = async (where: string) => {
            const found = await layoutIssues(page);
            for (const i of found) out.issues.push({ ...i, where });
            if (found.length) await page.screenshot({ path: `${FINDING_IMG_DIR}/sweep/${w.name}-${theme}-${size}-${where.replace(/\s+/g, "")}.png` });
        };
        await record("no panel");
        for (const name of RAIL_PANELS) {
            await railItem(page, name).click();
            await expect(detailPanel(page)).toBeVisible();
            await page.waitForTimeout(350);
            await record(name);
        }
        await page.screenshot({ path: `${FINDING_IMG_DIR}/sweep/${w.name}-${theme}-${size}.png` });
    } finally {
        await context.close();
    }
    return out;
}

for (const w of WIDTHS) {
    for (const theme of THEMES) {
        for (const size of SIZES) {
            test.describe(`A11 layout ${w.name} ${theme} ${size}`, () => {
                test.describe.configure({ mode: "default" });
                let result: Sweep;
                test.beforeAll(async ({ browser }) => {
                    test.setTimeout(120_000);
                    result = await sweep(browser, w, theme, size);
                });
                for (const rule of RULES) {
                    test(`${rule}`, async () => {
                        const id = knownFinding(rule, w.name);
                        if (id) knownBug(test, id);
                        if (rule === "console") {
                            expect(result.errors, "console errors while opening every panel").toEqual([]);
                            return;
                        }
                        const hits = result.issues.filter((i) => RULE_CHECKS[rule].includes(i.check));
                        const grouped: Record<string, Record<string, string[]>> = {};
                        for (const h of hits) (grouped[h.where] ??= {}), Object.assign(grouped[h.where], byCheck([...hits.filter((x) => x.where === h.where)]));
                        expect(grouped, `${rule} at ${w.name} ${theme} ${size}`).toEqual({});
                    });
                }
            });
        }
    }
}
