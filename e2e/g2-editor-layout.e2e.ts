// Group 2, area B: layout checks for the layout editor's surfaces (the
// toolbar, the layer strip and badge, the canvas keycaps, the four key pickers,
// the layer menu and its dialogs) in light and dark, at NORMAL / MEDIUM / SMALL
// key sizes, at desktop widths and at a phone width.
// A combination listed in KNOWN documents a finding (g2-NN) with test.fail().
import { test, expect, openDemo } from "./fixtures";
import { openRail, closePanel, sideOverflow, clippedText, orphanWords, lineProblems, shotFinding } from "./g2-helpers";
import type { Page } from "@playwright/test";
import * as fs from "fs";

/** G2_DUMP=<file> appends every problem list as one JSON line (for triage). */
function dump(check: string, c: Combo, problems: string[]) {
    if (process.env.G2_DUMP && problems.length) fs.appendFileSync(process.env.G2_DUMP, JSON.stringify({ check, combo: tag(c), problems }) + "\n");
}

type Theme = "light" | "dark";
type Size = "Normal" | "medium" | "small";
type Combo = { theme: Theme; size: Size; width: number; height: number };

const combos: Combo[] = [];
for (const theme of ["light", "dark"] as Theme[]) {
    for (const width of [1440, 1024]) {
        for (const size of ["Normal", "medium", "small"] as Size[]) combos.push({ theme, size, width, height: 900 });
    }
    combos.push({ theme, size: "small", width: 390, height: 844 }); // phone
}
const tag = (c: Combo) => `${c.theme} ${c.size.toLowerCase()} ${c.width}px`;

/** Known findings: check name -> (combo -> finding id), filled in from the runs. */
const phone = (c: Combo) => c.width < 600;
const KNOWN: Record<string, (c: Combo) => string | undefined> = {
    // L CTRL / R CTRL keycaps wrap with one word alone, at every size.
    "picker:Standard Keys": (c) => (phone(c) ? "g2-18" : "g2-16"),
    "picker:Layer Keys": (c) => (phone(c) ? "g2-18" : undefined),
    // BROWSER..., LOCKING..., Repeat, Leader cut off; VOL +, MY PC wrap.
    "picker:Special Keys": (c) => (c.size === "Normal" ? undefined : "g2-14"),
    // Accel 0/1/2 cut at top and bottom.
    "picker:Mouse Keys": (c) => (phone(c) ? "g2-18" : c.size === "small" ? "g2-15" : undefined),
    // The layer strip runs past the window edge with no scroll cue.
    rows: (c) => (phone(c) ? "g2-18" : "g2-17"),
    // L SHIFT wraps on the canvas, leaving SHIFT alone.
    canvas: (c) => (c.size === "Normal" ? undefined : "g2-16"),
};

async function setup(page: Page, c: Combo) {
    await page.setViewportSize({ width: c.width, height: c.height });
    await openDemo(page, `demo&theme=${c.theme}`);
    await expect(page.locator("html")).toHaveClass(c.theme === "dark" ? /dark/ : /^(?!.*\bdark\b).*/);
    const size = page.getByRole("button", { name: c.size, exact: true });
    if (await size.isVisible().catch(() => false)) {
        await size.click();
        await expect(size).toHaveAttribute("aria-pressed", "true");
    }
}

function markKnown(check: string, c: Combo) {
    const id = KNOWN[check]?.(c);
    if (id) test.fail(true, `${id}: see the findings list`);
    return id;
}

const PICKERS = ["Standard Keys", "Layer Keys", "Special Keys", "Mouse Keys"];
const TOOLBAR = ["Connect", "Import Layout", "Export Layout", "Matrix Tester", "Show Multiple Layers", "3D View", "Hide Thumbs", "Hide All Transparent Keys", "Overview"];

for (const c of combos) {
    test.describe(`B layout ${tag(c)}`, () => {
        for (const picker of PICKERS) {
            test(`${picker} panel fits, no clipped text, no lone words`, async ({ page }) => {
                const id = markKnown(`picker:${picker}`, c);
                await setup(page, c);
                const panel = await openRail(page, picker);
                await page.waitForTimeout(250);
                const problems = [
                    ...(await sideOverflow(panel)).map((p) => `overflow: ${p}`),
                    ...(await clippedText(panel)).map((p) => `clipped: ${p}`),
                    ...(await orphanWords(panel)).map((p) => `wrap: ${p}`),
                ];
                if (problems.length && id) await shotFinding(page, `${id}-${c.theme}-${c.size}-${c.width}`.toLowerCase(), panel);
                dump(`picker:${picker}`, c, problems);
                expect(problems, `${picker} at ${tag(c)}`).toEqual([]);
            });
        }

        test("toolbar and layer strip stay on one line, panel closed and open", async ({ page }) => {
            const id = markKnown("rows", c);
            await setup(page, c);
            const canvas = page.getByRole("region", { name: "Keyboard canvas" });
            const toolbar = page.locator(TOOLBAR.map((n) => `button[aria-label="${n}"]`).join(", "));
            const strip = canvas.locator("[data-slot='context-menu-trigger'], button[aria-label='Reverse Layer Order'], button[aria-label='Hide Transparent Layers']");
            const problems: string[] = [];
            problems.push(...(await lineProblems(toolbar, "toolbar (panel closed)")));
            problems.push(...(await lineProblems(strip, "layer strip (panel closed)")));
            await openRail(page, "Standard Keys");
            await page.waitForTimeout(250);
            problems.push(...(await lineProblems(toolbar, "toolbar (panel open)")));
            problems.push(...(await lineProblems(strip, "layer strip (panel open)")));
            if (problems.length && id) await shotFinding(page, `${id}-${c.theme}-${c.size}-${c.width}`.toLowerCase());
            dump("rows", c, problems);
            expect(problems, tag(c)).toEqual([]);
        });

        test("canvas keycaps and the layer badge show their whole labels", async ({ page }) => {
            const id = markKnown("canvas", c);
            await setup(page, c);
            await closePanel(page);
            const canvas = page.getByRole("region", { name: "Keyboard canvas" });
            const problems = [
                ...(await clippedText(canvas)).map((p) => `clipped: ${p}`),
                ...(await orphanWords(canvas, "[data-keycap], button")).map((p) => `wrap: ${p}`),
            ];
            if (problems.length && id) await shotFinding(page, `${id}-${c.theme}-${c.size}-${c.width}`.toLowerCase(), canvas);
            dump("canvas", c, problems);
            expect(problems, tag(c)).toEqual([]);
        });

        test("layer menu, Save Layer and layer color dialogs fit", async ({ page }) => {
            const id = markKnown("dialogs", c);
            await setup(page, c);
            const problems: string[] = [];
            const vw = c.width;
            const within = async (name: string, l: import("@playwright/test").Locator) => {
                const b = (await l.boundingBox())!;
                if (b.x < -1 || b.x + b.width > vw + 1) problems.push(`${name} spans ${Math.round(b.x)}..${Math.round(b.x + b.width)} in a ${vw}px window`);
                problems.push(...(await clippedText(l)).map((p) => `${name} clipped: ${p}`));
                problems.push(...(await orphanWords(l)).map((p) => `${name} wrap: ${p}`));
            };
            await page.getByRole("button", { name: "Actions for layer 0" }).click();
            const menu = page.getByRole("menu");
            await expect(menu).toBeVisible();
            await within("layer menu", menu);
            await menu.getByRole("menuitem", { name: "Save Layer..." }).click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            await within("Save Layer dialog", dialog);
            await dialog.getByRole("button", { name: "Cancel" }).click();
            await expect(dialog).toBeHidden();
            await page.getByRole("button", { name: "Change color for layer 0" }).click();
            const colors = page.locator("[data-color-choice]").first().locator("..");
            await expect(colors).toBeVisible();
            await within("color list", colors);
            await page.getByRole("button", { name: "Custom layer color" }).click();
            await expect(dialog).toBeVisible();
            await within("Colors dialog", dialog);
            if (problems.length && id) await shotFinding(page, `${id}-${c.theme}-${c.size}-${c.width}`.toLowerCase());
            dump("dialogs", c, problems);
            expect(problems, tag(c)).toEqual([]);
        });
    });
}
