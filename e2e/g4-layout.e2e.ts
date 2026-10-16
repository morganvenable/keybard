// Group 4 layout checks: the file and layout surfaces (Layouts panel, Settings
// categories, QMK Settings, Export / Import review / Print dialogs) in light and
// dark, at Normal / Medium / Small key sizes, at desktop and phone widths.
// Nothing in the side panel scrolls sideways, no text is clipped, rows that
// should be one line stay one line, and dialogs fit the window.
import { test, expect, openDemo } from "./fixtures";
import { overflowingChildren, clippedText, scrollBoxOf, shot, ROOT } from "./g4-helpers";
import type { Page, Locator } from "@playwright/test";
import path from "node:path";

const THEMES = ["light", "dark"] as const;
const SIZES = ["Normal", "medium", "small"] as const;
const WIDTHS = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "laptop", width: 1024, height: 768 },
    { name: "phone", width: 390, height: 844 },
] as const;

async function setKeySize(page: Page, size: string) {
    const btn = page.getByRole("button", { name: new RegExp(`^${size}$`, "i") }).first();
    if (await btn.isVisible()) {
        await btn.click();
        await expect(btn).toHaveAttribute("aria-pressed", "true");
    }
}

/** Problems inside one surface, labeled by where they were found. */
async function problemsIn(where: string, box: Locator): Promise<string[]> {
    const out: string[] = [];
    for (const p of await overflowingChildren(box)) out.push(`${where}: overflow ${p}`);
    for (const p of await clippedText(box)) out.push(`${where}: clipped ${p}`);
    return out;
}

/** Elements of `row` that sit on a different line from the first one. */
async function wrapsOf(where: string, row: Locator): Promise<string[]> {
    const tops = await row.evaluate((el) => [...el.children].filter((c) => (c as HTMLElement).offsetParent).map((c) => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2)));
    const spread = Math.max(...tops) - Math.min(...tops);
    return spread > 12 ? [`${where}: row wraps (${tops.join(",")})`] : [];
}

async function dialogFits(where: string, page: Page): Promise<string[]> {
    const d = page.getByRole("dialog").last();
    const r = (await d.boundingBox())!;
    const vp = page.viewportSize()!;
    const out: string[] = [];
    if (r.x < 0 || r.x + r.width > vp.width + 1) out.push(`${where}: dialog wider than the window (${Math.round(r.x)}..${Math.round(r.x + r.width)} of ${vp.width})`);
    out.push(...(await problemsIn(where, d)));
    return out;
}

for (const theme of THEMES) {
    for (const size of SIZES) {
        for (const w of WIDTHS) {
            test(`layout: files and layouts surfaces, ${theme}, ${size}, ${w.name} ${w.width}px`, async ({ page }) => {
                // g4-16: at phone width the Layouts library cuts layer titles with an ellipsis.
                test.fail(w.name === "phone", "g4-16: Layouts layer titles truncated at 390 px");
                await page.setViewportSize({ width: w.width, height: w.height });
                await openDemo(page, `demo&theme=${theme}`);
                if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
                await setKeySize(page, size);
                const problems: string[] = [];

                // Layouts panel.
                await page.getByRole("button", { name: "Layouts", exact: true }).click();
                const search = page.getByRole("textbox", { name: "Search layouts" });
                await expect(search).toBeVisible();
                await expect(page.getByRole("button", { name: "Enlarge Dvorak preview" })).toBeAttached({ timeout: 15_000 });
                const layouts = scrollBoxOf(search);
                problems.push(...(await problemsIn("Layouts", layouts)));
                problems.push(...(await wrapsOf("Layouts search + Import", search.locator("xpath=ancestor::div[contains(@class,'flex-wrap')][1]"))));

                // Settings categories.
                await page.getByRole("button", { name: "Settings", exact: true }).click();
                for (const cat of ["General", "Fragments", "Backups", "Developer"]) {
                    const b = page.getByRole("button", { name: cat, exact: true });
                    await b.click();
                    await expect(b).toHaveAttribute("aria-pressed", "true");
                    problems.push(...(await problemsIn(`Settings ${cat}`, scrollBoxOf(b))));
                }
                problems.push(...(await wrapsOf("Settings categories", page.getByRole("button", { name: "General", exact: true }).locator(".."))));

                // QMK Settings.
                await page.getByRole("button", { name: "General", exact: true }).click();
                await page.getByRole("button", { name: "QMK Settings..." }).click();
                const qmk = page.getByText("Configure firmware behavior. Changes follow your update mode.");
                await expect(qmk).toBeVisible();
                problems.push(...(await problemsIn("QMK Settings", scrollBoxOf(qmk))));
                // Close the panel the way a user would before using the toolbar
                // (at narrow widths the panel floats over the toolbar).
                await page.locator("aside[aria-label='QMK Settings']").getByRole("button", { name: /close/i }).first().click();
                await expect(qmk).toBeHidden();

                // Export dialog.
                const exportBtn = page.getByRole("button", { name: "Export Layout" });
                if (await exportBtn.isVisible()) {
                    await exportBtn.click();
                    await expect(page.getByRole("dialog")).toBeVisible();
                    problems.push(...(await dialogFits("Export dialog", page)));
                    await page.keyboard.press("Escape");
                    await expect(page.getByRole("dialog")).toBeHidden();
                } else {
                    problems.push("toolbar: Export Layout is not visible at this width");
                }

                // Import review dialog.
                const importBtn = page.getByRole("button", { name: "Import Layout" });
                if (await importBtn.isVisible()) {
                    const chooser = page.waitForEvent("filechooser");
                    await importBtn.click();
                    await (await chooser).setFiles(path.resolve(ROOT, "src/default-layouts/sval-alt-alphas.svil"));
                    await expect(page.getByRole("dialog", { name: "Review layout import" })).toBeVisible();
                    problems.push(...(await dialogFits("Import review", page)));
                    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
                } else {
                    problems.push("toolbar: Import Layout is not visible at this width");
                }

                // Print dialog.
                await page.getByRole("button", { name: "Settings", exact: true }).click();
                await page.getByRole("button", { name: "General", exact: true }).click();
                await page.getByRole("button", { name: "Print Layers..." }).click();
                await expect(page.getByRole("dialog")).toBeVisible();
                problems.push(...(await dialogFits("Print dialog", page)));
                await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

                if (problems.length) {
                    console.log("PROBLEMS", theme, size, w.name, JSON.stringify(problems, null, 1));
                }
                expect(problems).toEqual([]);
            });
        }
    }
}

// g4-15: with any side panel open at 1440 px, the layer strip runs past the right
// edge: 13, 14, mouse and Reverse Layer Order are cut off. The row scrolls
// sideways, but nothing shows that it does (no scrollbar, no fade, no arrow).
test("layout: with a side panel open the layer strip shows every layer or a scroll cue", async ({ page }) => {
    test.fail(true, "g4-15: layer strip clipped with no scroll cue when a panel is open");
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await page.getByRole("button", { name: "Layouts", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Search layouts" })).toBeVisible();
    const mouse = page.getByRole("button", { name: "mouse", exact: true }).first();
    const strip = mouse.locator("xpath=ancestor::*[contains(@class,'overflow-x-auto')][1]");
    const s = await strip.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, bar: (el as HTMLElement).offsetHeight - el.clientHeight, right: el.getBoundingClientRect().right }));
    await shot(page, "g4-15");
    const allVisible = s.sw <= s.cw + 1;
    expect(allVisible || s.bar > 0, `strip scrollWidth ${s.sw} > ${s.cw}, scrollbar height ${s.bar}`).toBe(true);
});

// g4-16: at 390 px the Layouts library cuts layer titles ("Home-row numbers
// (default NavNAS)", "Left-hand tenkey + right-hand nav") with an ellipsis.
test("layout: Layouts layer titles are readable at phone width", async ({ page }) => {
    test.fail(true, "g4-16: Layouts layer titles truncated at 390 px");
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);
    await page.getByRole("button", { name: "Layouts", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search layouts" });
    await expect(page.getByRole("button", { name: /Enlarge Home-row numbers/ })).toBeAttached({ timeout: 15_000 });
    await page.getByText("Home-row numbers (default NavNAS)").scrollIntoViewIfNeeded();
    await shot(page, "g4-16");
    expect(await clippedText(scrollBoxOf(search))).toEqual([]);
});
