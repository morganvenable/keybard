// Group 1, area A: Manual (A12), Quick Start (A13), About (A14), and the rail
// items' panel titles.
import { test, expect, openDemo } from "./fixtures";
import { detailPanel, findingShot, knownBug, openRailPanel, RAIL_PANELS, railItem } from "./g1-helpers";

test.describe("A12 Manual", () => {
    test("the Manual rail item opens the published manual in a new tab", async ({ page, context }) => {
        await openDemo(page);
        const link = railItem(page, "Manual");
        await expect(link).toHaveAttribute("href", "/keybard/manual/");
        await expect(link).toHaveAttribute("target", "_blank");
        const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
        const response = await popup.waitForEvent("load").then(() => popup.request.get(popup.url()));
        expect(response.status()).toBe(200);
        await expect(popup).not.toHaveTitle(/404|not found/i);
        await expect(popup.locator("h1").first()).toContainText(/manual/i);
        // The editor stays as it was.
        await expect(page.locator("[data-keyboard-instance] [data-key-x]")).toHaveCount(52);
    });
});

test.describe("A13 Quick Start", () => {
    test("covers the main features", async ({ page }) => {
        await openDemo(page);
        await openRailPanel(page, "Quick Start");
        const panel = detailPanel(page);
        await expect(panel.getByRole("heading", { name: "Quick Start" })).toBeVisible();
        for (const text of ["Import", "Export", "Layouts", "Live updating", "Matrix Tester", "Show Multiple Layers", "Hide Transparent Layers", "3D View", "Hide All Transparent Keys"]) {
            await expect(panel).toContainText(text);
        }
    });

    test("every control it names exists under that name", async ({ page }) => {
        // g1-15: Quick Start says "Hide Thumb Keys" (the button is "Hide Thumbs") and
        // "Click the Info button in the bottom left corner" (there is no Info button).
        knownBug(test, "g1-15");
        await openDemo(page);
        await openRailPanel(page, "Quick Start");
        const panel = detailPanel(page);
        const named = (await panel.locator("li b").allInnerTexts()).map((t) => t.trim());
        // Product names, and controls that only show with a keyboard connected.
        const skip = new Set(["Keybard", "Svalboard", "Live updating", "Manual Changes", "Update", "Revert", "[SHORTCUT]"]);
        const missing: string[] = [];
        for (const name of named) {
            if (skip.has(name)) continue;
            // The exact name, or the start of one ("Export" for "Export Layout").
            const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
            const control = page.getByRole("button", { name: re }).or(page.getByRole("link", { name: re }));
            if ((await control.count()) === 0) missing.push(name);
        }
        await findingShot(page, "g1-15");
        expect(missing, "controls Quick Start names that are not on screen").toEqual([]);
    });

    test("reads cleanly: no typos or placeholder tags", async ({ page }) => {
        // g1-16: "tempoarilly", "copy, pasted", "when you are happy your new layout",
        // and a literal "[SHORTCUT]" tag.
        knownBug(test, "g1-16");
        await openDemo(page);
        await openRailPanel(page, "Quick Start");
        await findingShot(page, "g1-16");
        const text = await detailPanel(page).innerText();
        for (const bad of [/tempoarilly/, /copy, pasted/, /happy your new/, /\[SHORTCUT\]/]) {
            expect(text).not.toMatch(bad);
        }
    });
});

test.describe("A14 About", () => {
    test("explains that firmware details need a keyboard", async ({ page }) => {
        await openDemo(page);
        await openRailPanel(page, "About");
        const panel = detailPanel(page);
        await expect(panel.getByRole("heading", { name: "About" })).toBeVisible();
        await expect(panel.getByRole("heading", { name: "Keyboard firmware" })).toBeVisible();
        await expect(panel).toContainText("Connect a keyboard to see its firmware.");
        await expect(panel).toContainText(/Newest Svalboard firmware this Keybard knows: \S+/);
    });

    test("names this Keybard's release and build", async ({ page }) => {
        // g1-17: About says "Keybard version 1.0.0", a fixed number that matches no
        // release tag; the release and build (shown in the corner label) are not named.
        knownBug(test, "g1-17");
        await openDemo(page);
        await openRailPanel(page, "About");
        await findingShot(page, "g1-17");
        const panel = detailPanel(page);
        await expect(panel).not.toContainText("version 1.0.0");
        const sha = await page.evaluate(() => (typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "") as string).catch(() => "");
        const label = await page.locator("div[aria-hidden='true'].fixed").first().innerText().catch(() => "");
        const build = sha || label.split(" · ")[1] || "";
        expect(build).not.toBe("");
        await expect(panel).toContainText(build);
    });

    test("no panel says Viable", async ({ page }) => {
        await openDemo(page);
        for (const name of RAIL_PANELS) {
            await openRailPanel(page, name);
            await expect(detailPanel(page), `${name} panel`).not.toContainText(/viable/i);
        }
        await expect(page.locator("body")).not.toContainText(/viable/i);
    });
});

test.describe("rail titles", () => {
    test("each rail item opens a panel with the same title", async ({ page }) => {
        // g1-18 (F-leaders-title): the rail says "Leaders", the panel "Leader Sequences".
        knownBug(test, "g1-18");
        await openDemo(page);
        const mismatched: string[] = [];
        for (const name of RAIL_PANELS) {
            await openRailPanel(page, name);
            const heading = (await detailPanel(page).getByRole("heading", { level: 2 }).first().innerText()).trim();
            if (heading !== name) mismatched.push(`${name} -> ${heading}`);
            if (heading !== name) await findingShot(page, "g1-18");
        }
        expect(mismatched).toEqual([]);
    });
});

declare const __GIT_SHA__: string;
