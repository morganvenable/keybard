// Group 5, area E (pointing): the pointing demo, per-hand review params, the
// ball menu and its saved look, the ball sliders in Settings, and the Pointing
// Devices panel. Flows E7-E11.
import type { Page } from "@playwright/test";
import { test, expect, openDemo } from "./fixtures";
import {
    rail, sidePanel, canvasKeyBoxes, overlaps, shot, findingShot, known, expectNoSidePanelOverflow, clippedElements,
} from "./g5-helpers";

const device = (page: Page, side: "left" | "right") => page.locator(`canvas[data-pointing-device='${side}']`);
const overlayCanvas = (page: Page, side: "left" | "right") => page.locator(`canvas[data-pointing-overlay='${side}']`);

/** Right-click a trackball until its menu shows (the menu hooks up once the page settles). */
async function openBallMenu(page: Page, side: "left" | "right" = "right") {
    const menu = page.getByRole("menu", { name: side === "left" ? "Left ball" : "Right ball" });
    await expect(async () => {
        await device(page, side).click({ button: "right" });
        await expect(menu).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    return menu;
}

/** The ball's drawn radius, from the canvas clip-path circle(Rpx ...). */
async function ballRadius(page: Page, side: "left" | "right") {
    const clip = await device(page, side).evaluate((e) => (e as HTMLElement).style.clipPath);
    return Number(/circle\(([\d.]+)px/.exec(clip)?.[1] ?? NaN);
}

/** Opaque pixels drawn on a 2D overlay canvas (mode labels, finger marks). */
async function overlayInk(page: Page, side: "left" | "right") {
    return overlayCanvas(page, side).evaluate((c) => {
        const cv = c as HTMLCanvasElement;
        const ctx = cv.getContext("2d");
        if (!ctx) return -1;
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
        return n;
    });
}

test.describe("E7 ?demo=pointing", () => {
    for (const theme of ["light", "dark"] as const) {
        test(`left touchpad and right trackball draw beside the keys (${theme})`, async ({ page }) => {
            await openDemo(page, `demo=pointing&theme=${theme}`);
            await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*\bdark\b).*$/);
            await expect(page.locator("canvas")).toHaveCount(4);
            await expect(device(page, "left")).toHaveAttribute("data-pointing-kind", "pad");
            await expect(device(page, "left")).toHaveAccessibleName("Left touchpad");
            await expect(device(page, "right")).toHaveAttribute("data-pointing-kind", "ball");
            await expect(device(page, "right")).toHaveAccessibleName(/^Right trackball, /);
            // Both are on screen, the ball is round (its box is square) and neither covers a key.
            const keys = await canvasKeyBoxes(page);
            for (const side of ["left", "right"] as const) {
                const box = await device(page, side).boundingBox();
                expect(box, `${side} device box`).not.toBeNull();
                expect(box!.x).toBeGreaterThanOrEqual(0);
                expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
                // The pad's canvas carries a few px of shadow; the ball is the clipped circle.
                const r = side === "right" ? await ballRadius(page, side) : 0;
                const cx = box!.x + box!.width / 2, cy = box!.y + box!.height / 2;
                const covered = keys.filter((k) => {
                    if (!r) return overlaps(box!, k, 8);
                    const nx = Math.max(k.x, Math.min(cx, k.x + k.width)), ny = Math.max(k.y, Math.min(cy, k.y + k.height));
                    return Math.hypot(cx - nx, cy - ny) < r - 2;
                }).map((k) => k.label);
                expect(covered, `${side} device covers keys`).toEqual([]);
            }
            const ball = (await device(page, "right").boundingBox())!;
            expect(Math.abs(ball.width - ball.height)).toBeLessThan(2);
            // The pad is on the left half of the layout, the ball on the right half.
            const pad = (await device(page, "left").boundingBox())!;
            expect(pad.x + pad.width / 2).toBeLessThan(ball.x + ball.width / 2);
        });
    }

    test("scripted motion moves the devices; motion=0 holds them still", async ({ page }) => {
        await openDemo(page, "demo=pointing");
        await page.waitForTimeout(500);
        const a = await shot(device(page, "right"));
        await page.waitForTimeout(900);
        const b = await shot(device(page, "right"));
        const padA = await overlayInk(page, "left");
        expect(a.equals(b), "the ball should roll in the demo").toBe(false);
        expect(padA).toBeGreaterThanOrEqual(0);

        await openDemo(page, "demo=pointing&motion=0");
        await page.waitForTimeout(800);
        const c = await shot(device(page, "right"));
        await page.waitForTimeout(900);
        const d = await shot(device(page, "right"));
        expect(c.equals(d), "the ball should not move with motion=0").toBe(true);
    });

    test("a 52 mm ball draws larger than a 44 mm ball (true proportions)", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0&ball=silver");
        const r44 = await ballRadius(page, "right");
        await openDemo(page, "demo=pointing&motion=0&ball=pearl_blue");
        const r52 = await ballRadius(page, "right");
        expect(r44).toBeGreaterThan(10);
        expect(r52 / r44).toBeGreaterThan(1.12);
        expect(r52 / r44).toBeLessThan(1.24);
    });
});

test.describe("E8 per-hand review params", () => {
    test("left=trackball&right=none: one ball on the left, nothing on the right", async ({ page }) => {
        await openDemo(page, "demo=pointing&left=trackball&right=none&motion=0");
        await expect(device(page, "left")).toHaveAttribute("data-pointing-kind", "ball");
        await expect(device(page, "right")).toHaveCount(0);
        await expect(page.locator("canvas")).toHaveCount(2);
    });

    test("left=touchpad&right=touchpad draws two pads", async ({ page }) => {
        await openDemo(page, "demo=pointing&left=touchpad&right=touchpad&motion=0");
        await expect(device(page, "left")).toHaveAttribute("data-pointing-kind", "pad");
        await expect(device(page, "right")).toHaveAttribute("data-pointing-kind", "pad");
    });

    test("sniper and boost show on the moving hand and nowhere without them", async ({ page }) => {
        await openDemo(page, "demo=pointing&left=trackball&right=none&motion=0&hand=left");
        await page.waitForTimeout(600);
        const plain = await overlayInk(page, "left");
        await openDemo(page, "demo=pointing&left=trackball&right=none&motion=0&sniper=1&boost=1&hand=left");
        await page.waitForTimeout(600);
        const modes = await overlayInk(page, "left");
        // The SNIPER and BOOST pills add ink to the overlay.
        expect(modes).toBeGreaterThan(plain + 500);
    });

    test("motion=0 on the pointing demo keeps the touchpad finger still", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0");
        await page.waitForTimeout(600);
        const a = await shot(overlayCanvas(page, "left"));
        await page.waitForTimeout(800);
        const b = await shot(overlayCanvas(page, "left"));
        expect(a.equals(b)).toBe(true);
    });
});

test.describe("E9 ball menu", () => {
    test("right-click the ball, pick another, and it stays after a reload", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0");
        await expect(device(page, "right")).toHaveAttribute("data-ball", "silver");
        let menu = await openBallMenu(page);
        await expect(menu.getByRole("menuitemradio", { name: /Silver sparkle/ })).toHaveAttribute("aria-checked", "true");
        // Arrow keys move, Escape closes without a change.
        await expect(menu.getByRole("menuitemradio", { name: /Silver sparkle/ })).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(menu.getByRole("menuitemradio", { name: /Glossy red/ })).toBeFocused();
        await page.keyboard.press("End");
        await expect(menu.getByRole("menuitemradio", { name: /Pearl black/ })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
        await expect(device(page, "right")).toHaveAttribute("data-ball", "silver");
        // Pick Pearl blue.
        menu = await openBallMenu(page);
        await page.getByRole("menuitemradio", { name: /Pearl blue/ }).click();
        await expect(page.getByRole("menu")).toBeHidden();
        await expect(device(page, "right")).toHaveAttribute("data-ball", "pearl_blue");
        await expect(device(page, "right")).toHaveAccessibleName("Right trackball, Pearl blue");
        await page.reload();
        await expect(device(page, "right")).toHaveAttribute("data-ball", "pearl_blue", { timeout: 20_000 });
    });

    test("?ball= shows a ball for one load and does not replace the saved one", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0");
        await openBallMenu(page);
        await page.getByRole("menuitemradio", { name: /Glossy red/ }).click();
        await expect(device(page, "right")).toHaveAttribute("data-ball", "red");
        await openDemo(page, "demo=pointing&motion=0&ball=pearl_white");
        await expect(device(page, "right")).toHaveAttribute("data-ball", "pearl_white");
        await openDemo(page, "demo=pointing&motion=0");
        await expect(device(page, "right")).toHaveAttribute("data-ball", "red");
    });

    test("the menu is labeled with each ball's name and size", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0");
        const items = (await openBallMenu(page)).getByRole("menuitemradio");
        await expect(items).toHaveCount(7);
        const texts = await items.allInnerTexts();
        for (const t of texts) expect(t.replace(/\s+/g, " ").trim()).toMatch(/^[A-Z][a-z]+ [a-z]+ \d+ mm$/);
        // Every item stays inside the window.
        expect(await clippedElements(page, "[data-ball-menu] [role=menuitemradio]")).toEqual([]);
        await page.keyboard.press("Escape");
    });
});

test.describe("E10 ball sliders in Settings > General", () => {
    test("gloss, sparkle and lightness redraw the ball at once and persist", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0");
        await rail(page, "Settings").click();
        const panel = sidePanel(page);
        await expect(panel.getByRole("heading", { name: "Settings" })).toBeVisible();
        const sliders = {
            "Ball Gloss": panel.getByRole("slider", { name: "Ball Gloss" }),
            "Sparkle Density": panel.getByRole("slider", { name: "Sparkle Density" }),
            "Ball Lightness": panel.getByRole("slider", { name: "Ball Lightness" }),
        };
        for (const s of Object.values(sliders)) await expect(s).toBeVisible();
        const ball = device(page, "right");
        let before = await shot(ball);
        for (const [name, s] of Object.entries(sliders)) {
            await s.focus();
            await page.keyboard.press("End");
            await expect(s, name).toHaveAttribute("aria-valuenow", "1");
            await page.waitForTimeout(400);
            const after = await shot(ball);
            expect(after.equals(before), `${name} should change the ball`).toBe(false);
            before = after;
        }
        await expectNoSidePanelOverflow(page);
        await page.reload();
        await expect(device(page, "right")).toBeVisible({ timeout: 20_000 });
        await rail(page, "Settings").click();
        for (const [name, s] of Object.entries(sliders)) await expect(s, `${name} after reload`).toHaveAttribute("aria-valuenow", "1");
    });
});

test.describe("E11 Pointing Devices panel", () => {
    test("without a board it offers Connect and fits the side panel", async ({ page }) => {
        await openDemo(page);
        await rail(page, "Pointing Devices").click();
        const panel = sidePanel(page);
        await expect(panel.getByRole("heading", { name: "Pointing Devices" })).toBeVisible();
        await expect(panel).toContainText("keyboard to view pointing devices settings.");
        await expect(panel.getByRole("button", { name: "Connect" })).toBeVisible();
        await expectNoSidePanelOverflow(page);
    });

    // g5-07: with the pointing demo the trackball is drawn, but the Pointing Devices
    // panel still only says "Connect"; the Ball choice is reachable only by a
    // right-click or through Settings > Fragments.
    test("with the pointing demo the panel offers the drawn devices' settings (the Ball choice)", async ({ page }) => {
        known("g5-07", "Pointing Devices panel shows only 'Connect' while the demo draws a trackball");
        await openDemo(page, "demo=pointing&motion=0");
        await rail(page, "Pointing Devices").click();
        const panel = sidePanel(page);
        await expect(panel.getByRole("heading", { name: "Pointing Devices" })).toBeVisible();
        await expectNoSidePanelOverflow(page);
        const ballChoice = panel.locator("[data-pointing-ball-picker]");
        if (!(await ballChoice.count())) await findingShot(page, "g5-07");
        await expect(ballChoice.first()).toBeVisible({ timeout: 2_000 });
    });

    test("?panel=fragments shows the Ball choice, which changes the ball", async ({ page }) => {
        await openDemo(page, "demo=pointing&motion=0&panel=fragments");
        const picker = sidePanel(page).locator("[data-pointing-ball-picker='right']");
        await expect(picker).toBeVisible();
        await expectNoSidePanelOverflow(page);
        await picker.getByRole("radio", { name: "Pearl purple, 52 mm" }).click();
        await expect(picker.getByRole("radio", { name: "Pearl purple, 52 mm" })).toHaveAttribute("aria-checked", "true");
        await expect(device(page, "right")).toHaveAttribute("data-ball", "pearl_purple");
    });
});
