// Group 3 layout sweep: every binding panel and editor (combos, tap dance,
// macros, overrides, alt-repeat, leaders) in light and dark, at NORMAL /
// MEDIUM / SMALL key sizes, at desktop and phone widths. Nothing may scroll
// sideways or poke out of the side panel, no text may be clipped, editor slot
// labels may not run into each other, and the key inspector card stays on screen.
import { test, expect, openDemo, editorHeading } from "./fixtures";
import type { Page } from "@playwright/test";
import { canvasKey, rail, sidePanel, overflowingElements, clippedText, KEY_SIZES, setKeySize, findingShot, cutOffKeys } from "./g3-helpers";

const PANELS = [
    { rail: "Tap Dance Keys", panel: "Tap Dance Keys" as string | RegExp, editRow: 0, heading: "Editing Tap Dance 0" },
    { rail: "Macro Keys", panel: "Macro Keys" as string | RegExp, editRow: 1, heading: "Editing Macro 1" },
    { rail: "Leaders", panel: /Leader/ as string | RegExp, editRow: 0, heading: "Editing Leader 0" },
    { rail: "Combos", panel: "Combos" as string | RegExp, editRow: 2, heading: "Editing Combo 2" },
    { rail: "Overrides", panel: "Overrides" as string | RegExp, editRow: 0, heading: "Editing Override 0" },
    { rail: "Alt-Repeat", panel: "Alt-Repeat" as string | RegExp, editRow: 0, heading: "Editing Alt-Repeat 0" },
];

/** Labels under the editor's slots that touch or overlap their neighbor on the same line. */
async function collidingSlotLabels(page: Page): Promise<string[]> {
    return page.locator(".binding-workspace [data-editor-bar-row]").first().evaluate((row) => {
        const labels = Array.from(row.querySelectorAll<HTMLElement>("[data-bar-slot] > span:last-child"))
            .map((e) => ({ t: e.textContent || "", r: e.getBoundingClientRect() }))
            .filter((x) => x.r.width > 0);
        const out: string[] = [];
        for (let i = 1; i < labels.length; i++) {
            const a = labels[i - 1], b = labels[i];
            if (Math.abs(a.r.top - b.r.top) > 3) continue;
            if (b.r.left - a.r.right < 2) out.push(`"${a.t}" | "${b.t}" gap ${Math.round(b.r.left - a.r.right)}px`);
        }
        return out;
    }).catch(() => []);
}

/** Control groups that wrap one item alone onto a line inside the editor (e.g. a lone GUI). */
async function loneWraps(page: Page): Promise<string[]> {
    return page.locator(".binding-workspace").first().evaluate((ed) => {
        const out: string[] = [];
        for (const box of Array.from(ed.querySelectorAll<HTMLElement>("*"))) {
            const cs = getComputedStyle(box);
            if (!(cs.display.includes("flex") && cs.flexWrap === "wrap") && !cs.display.includes("grid")) continue;
            const kids = (Array.from(box.children) as HTMLElement[]).filter((k) => k.getBoundingClientRect().width > 0 && k.tagName === "BUTTON");
            if (kids.length < 3) continue;
            const lines = new Map<number, HTMLElement[]>();
            for (const k of kids) {
                const t = Math.round(k.getBoundingClientRect().top / 4);
                lines.set(t, [...(lines.get(t) || []), k]);
            }
            if (lines.size < 2) continue;
            const last = [...lines.entries()].sort((a, b) => a[0] - b[0]).pop()![1];
            if (last.length === 1) out.push(`"${(last[0].textContent || "").trim()}" alone after ${kids.length - 1} siblings`);
        }
        return out;
    }).catch(() => []);
}

async function enableAltRepeat(page: Page) {
    await page.addInitScript(() => {
        try {
            const raw = localStorage.getItem("keyboard-settings");
            const cur = raw ? JSON.parse(raw) : {};
            localStorage.setItem("keyboard-settings", JSON.stringify({ ...cur, "show-alt-repeat": true }));
        } catch { /* storage blocked: Alt-Repeat stays hidden */ }
    });
}

const WIDTHS = [
    { name: "desktop 1440", width: 1440, height: 1000 },
    { name: "laptop 1024", width: 1024, height: 768 },
];

for (const theme of ["light", "dark"] as const) {
    for (const size of KEY_SIZES) {
        for (const w of WIDTHS) {
            test(`layout: ${theme}, ${size.name} keys, ${w.name}: binding panels and editors fit`, async ({ page }) => {
                test.setTimeout(120_000);
                await page.setViewportSize({ width: w.width, height: w.height });
                await enableAltRepeat(page);
                await openDemo(page, `demo=combos&theme=${theme}`);
                await setKeySize(page, size.button);
                const problems: string[] = [];
                for (const p of PANELS) {
                    const panel = page.getByRole("complementary", { name: p.panel });
                    const item = rail(page, p.rail);
                    if (!(await item.isVisible())) {
                        // A collapsed rail (phone width) still has the item by its name.
                        problems.push(`${p.rail}: rail item not visible`);
                        continue;
                    }
                    await item.click();
                    await expect(panel).toBeVisible();
                    for (const o of await overflowingElements(sidePanel(page))) problems.push(`${p.rail} panel: ${o}`);
                    for (const c of await clippedText(sidePanel(page))) problems.push(`${p.rail} panel clipped: ${c}`);

                    await panel.locator(`[data-binding-row="${p.editRow}"], [data-combo-row="${p.editRow}"]`).first().click({ position: { x: 14, y: 14 } });
                    await expect(editorHeading(page, p.heading)).toBeVisible();
                    await page.waitForTimeout(250);
                    for (const o of await overflowingElements(sidePanel(page))) problems.push(`${p.heading}: ${o}`);
                    for (const c of await clippedText(page.locator(".binding-workspace").first())) problems.push(`${p.heading} clipped: ${c}`);
                    for (const c of await collidingSlotLabels(page)) problems.push(`${p.heading} labels collide: ${c}`);
                    for (const k of await cutOffKeys(page)) problems.push(`${p.heading} picker: ${k}`);
                    const opts = page.locator(".binding-workspace [data-editor-bar-options]");
                    if (await opts.count()) {
                        await opts.click();
                        for (const o of await overflowingElements(sidePanel(page))) problems.push(`${p.heading} options: ${o}`);
                        for (const l of await loneWraps(page)) problems.push(`${p.heading} options wrap: ${l}`);
                    }
                    await page.getByRole("button", { name: "Go back" }).click();
                    await expect(editorHeading(page, p.heading)).toHaveCount(0);
                }
                // The key inspector card stays inside the window.
                const panelOpen = page.getByRole("complementary").first();
                if (await panelOpen.isVisible()) await page.getByRole("button", { name: "Close details panel" }).first().click().catch(() => {});
                await page.mouse.move(1, 1);
                await canvasKey(page, "F").hover();
                const card = page.locator('[data-key-inspector="card"], [data-key-inspector="strip"]').first();
                if (await card.isVisible()) {
                    const b = (await card.boundingBox())!;
                    if (b.x < 0 || b.x + b.width > w.width + 1 || b.y + b.height > w.height + 1) problems.push(`inspector card off screen: ${JSON.stringify(b)}`);
                }
                if (problems.length) {
                    test.info().annotations.push({ type: "layout", description: problems.join("\n") });
                    await findingShot(page, `g3-layout-${theme}-${size.name}-${w.width}`);
                }
                expect(problems, "layout problems").toEqual([]);
            });
        }
    }
}

// Phone width: the panel docks at the bottom and lists cards; the editors open
// from a card (or "Add new ...") and must fit the bottom panel too.
const PHONE_PANELS = [
    { rail: "Tap Dance Keys", panel: "Tap Dance Keys", card: /^Tap Dance 0$/, add: "Add new tap dance", heading: "Editing Tap Dance 0" },
    { rail: "Macro Keys", panel: "Macro Keys", card: null, add: "Add new macro", heading: "Editing Macro 2" },
    { rail: "Leaders", panel: /Leader/, card: null, add: "Add new leader", heading: "Editing Leader 0" },
    { rail: "Combos", panel: "Combos", card: /^Combo 2$/, add: "Add new combo", heading: "Editing Combo 2" },
    { rail: "Overrides", panel: "Overrides", card: null, add: "Add new override", heading: "Editing Override 0" },
    { rail: "Alt-Repeat", panel: "Alt-Repeat", card: null, add: "Add new alt-repeat", heading: "Editing Alt-Repeat 0" },
];

for (const theme of ["light", "dark"] as const) {
    for (const size of KEY_SIZES) {
        test(`layout: ${theme}, ${size.name} keys, phone 390: binding panels and editors fit`, async ({ page }) => {
            test.setTimeout(120_000);
            await page.setViewportSize({ width: 390, height: 844 });
            await enableAltRepeat(page);
            await openDemo(page, `demo=combos&theme=${theme}`);
            await setKeySize(page, size.button);
            const problems: string[] = [];
            const pageWide = async (where: string) => {
                const sw = await page.evaluate(() => document.documentElement.scrollWidth);
                if (sw > 391) problems.push(`${where}: page scrolls sideways (${sw}px)`);
            };
            for (const p of PHONE_PANELS) {
                await rail(page, p.rail).click();
                const panel = page.getByRole("complementary", { name: p.panel });
                await expect(panel).toBeVisible();
                for (const o of await overflowingElements(panel)) problems.push(`${p.rail} panel: ${o}`);
                for (const c of await clippedText(panel)) problems.push(`${p.rail} panel clipped: ${c}`);
                await pageWide(`${p.rail} panel`);
                if (p.card) await panel.getByText(p.card).first().click();
                else await panel.getByRole("button", { name: p.add }).click();
                await expect(editorHeading(page, p.heading)).toBeVisible();
                await page.waitForTimeout(250);
                const ed = page.locator(".binding-workspace").first();
                for (const o of await overflowingElements(ed, "[data-editor-slot] .absolute")) problems.push(`${p.heading}: ${o}`);
                for (const c of await clippedText(ed)) problems.push(`${p.heading} clipped: ${c}`);
                const eb = await ed.boundingBox();
                if (eb && (eb.x < -1 || eb.x + eb.width > 391)) problems.push(`${p.heading}: editor ${Math.round(eb.x)}..${Math.round(eb.x + eb.width)} outside 0..390`);
                await pageWide(p.heading);
                // (The key picker's width is checked on its own below.)
                await page.getByRole("button", { name: "Go back" }).click();
                await expect(editorHeading(page, p.heading)).toHaveCount(0);
            }
            if (problems.length) {
                test.info().annotations.push({ type: "layout", description: problems.join("\n") });
                await findingShot(page, `g3-layout-${theme}-${size.name}-390`);
            }
            expect(problems, "layout problems").toEqual([]);
        });
    }
}

for (const theme of ["light", "dark"] as const) {
    test(`layout: ${theme}, phone 390: the binding editor's key picker fits the width`, async ({ page }) => {
        // g3-14: at 390px the Standard Keys picker under a binding editor runs
        // past the right edge (F10-F12, -, =, Bksp, [, ], \, ; are cut or off
        // screen) inside an overflow-hidden box, so those keys cannot be picked.
        test.fail(true, "g3-14: the editor's key picker is cut off at phone width");
        await page.setViewportSize({ width: 390, height: 844 });
        await openDemo(page, `demo=combos&theme=${theme}`);
        await rail(page, "Combos").click();
        await page.getByRole("complementary", { name: "Combos" }).getByText(/^Combo 2$/).first().click();
        await expect(editorHeading(page, "Editing Combo 2")).toBeVisible();
        await page.waitForTimeout(500);
        const cut = await cutOffKeys(page);
        if (cut.length && theme === "dark") await findingShot(page, "g3-14");
        expect(cut, "picker keys cut off").toEqual([]);
    });
}
