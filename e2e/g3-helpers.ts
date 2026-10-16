// Shared helpers for the group 3 flows (binding features: combos, tap dance,
// macros, overrides, alt-repeat, leaders, names, spotlight, inspector).
import { expect, type Locator, type Page } from "@playwright/test";
import { CANVAS_KEY } from "./fixtures";
import * as fs from "node:fs";
import * as path from "node:path";

/** Where finding screenshots go (outside the repo, for the review page). */
export const FINDING_DIR = "C:/Users/morga/Svalboard/review/img/ux";

/** A key on the layout canvas, by its accessible name ("Q", or "F: in 2 combos..."). */
export function canvasKey(page: Page, name: string): Locator {
    return page.locator(`${CANVAS_KEY}[aria-label="${name}"], ${CANVAS_KEY}[aria-label^="${name}: "]`).first();
}

/** A rail item (the left navigation). */
export function rail(page: Page, name: string): Locator {
    return page.getByRole("list").getByRole("button", { name, exact: true }).first();
}

/** The side panel (complementary landmark). */
export function sidePanel(page: Page): Locator {
    return page.locator("aside.detail-panel, aside[data-placement]").first();
}

/** The binding editor area (the editor bar or card). */
export function editor(page: Page): Locator {
    return page.locator(".binding-workspace").first();
}

/** True while a binding editor's spotlight is up. */
export async function spotlightOn(page: Page): Promise<boolean> {
    return page.evaluate(() => document.documentElement.hasAttribute("data-binding-spotlight"));
}

/** A picker key in the Standard Keys picker (not on the canvas). */
export function pickerKey(page: Page, label: string): Locator {
    return page.locator(`[data-keycap]:not([data-key-x])`).filter({ visible: true }).filter({ hasText: new RegExp(`^${escapeRe(label)}$`, "i") }).first();
}

export function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Open Settings > General and return the panel. */
export async function openSettings(page: Page, category = "General") {
    await rail(page, "Settings").click();
    const panel = page.getByRole("complementary", { name: /Settings/ });
    await expect(panel).toBeVisible();
    if (category !== "General") await panel.getByRole("button", { name: category }).first().click();
    return panel;
}

/** Choose a value in a Settings select by its label. */
export async function setSelectSetting(page: Page, label: string, optionLabel: string) {
    await openSettings(page);
    const sel = page.getByRole("combobox", { name: label, exact: true });
    await sel.scrollIntoViewIfNeeded();
    await sel.selectOption({ label: optionLabel });
}

/** Turn a Settings switch on or off. */
export async function setSwitchSetting(page: Page, label: string, on: boolean) {
    await openSettings(page);
    const sw = page.getByRole("switch", { name: label, exact: true });
    await sw.scrollIntoViewIfNeeded();
    const checked = (await sw.getAttribute("aria-checked")) === "true" || (await sw.getAttribute("data-state")) === "checked";
    if (checked !== on) await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", on ? "true" : "false");
}

/** Seed app settings in localStorage before the app starts. */
export async function seedSettings(page: Page, settings: Record<string, unknown>) {
    await page.addInitScript((s) => {
        try {
            if (sessionStorage.getItem("__g3_seeded")) return;
            sessionStorage.setItem("__g3_seeded", "1");
            const raw = localStorage.getItem("keyboard-settings");
            const cur = raw ? JSON.parse(raw) : {};
            localStorage.setItem("keyboard-settings", JSON.stringify({ ...cur, ...s }));
        } catch { /* ignore */ }
    }, settings);
}

/** Save a screenshot of a confirmed finding. */
export async function findingShot(page: Page, id: string) {
    fs.mkdirSync(FINDING_DIR, { recursive: true });
    await page.screenshot({ path: path.join(FINDING_DIR, `${id}.png`) });
}

/** Elements inside `root` whose content is wider than their box (sideways scroll or clipping). */
export async function overflowingElements(root: Locator, exclude = ""): Promise<string[]> {
    return root.evaluate((el, exclude) => {
        const out: string[] = [];
        const rootBox = el.getBoundingClientRect();
        const all = [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))] as HTMLElement[];
        for (const e of all) {
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            const r = e.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            if (e.closest("[aria-hidden='true'], svg, [data-editor-ghost]")) continue;
            if (exclude && e.closest(exclude)) continue;
            // Sideways scroll inside the panel.
            if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && e.scrollWidth > e.clientWidth + 1) {
                out.push(`scrolls sideways: ${describe(e)} (${e.scrollWidth} > ${e.clientWidth})`);
            }
            // Pokes out of the panel's right or left edge.
            if (r.right > rootBox.right + 1.5 || r.left < rootBox.left - 1.5) {
                out.push(`outside the panel: ${describe(e)} (${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(rootBox.left)}..${Math.round(rootBox.right)})`);
            }
        }
        return out.slice(0, 12);
        function describe(n: HTMLElement) {
            const t = (n.getAttribute("aria-label") || n.textContent || "").trim().slice(0, 40);
            return `<${n.tagName.toLowerCase()}${n.className && typeof n.className === "string" ? " ." + n.className.split(/\s+/).slice(0, 3).join(".") : ""}> "${t}"`;
        }
    }, exclude);
}

/** Text elements that are cut off (ellipsis aside) inside `root`. */
export async function clippedText(root: Locator): Promise<string[]> {
    return root.evaluate((el) => {
        const out: string[] = [];
        for (const e of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
            if (e.children.length) continue;
            const text = (e.textContent || "").trim();
            if (!text) continue;
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            if (e.closest("[aria-hidden='true'], [data-editor-ghost], .sr-only")) continue;
            // Intentional truncation (ellipsis) is allowed; hard clipping is not.
            if (cs.textOverflow === "ellipsis") continue;
            const clipX = e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== "visible";
            const clipY = e.scrollHeight > e.clientHeight + 2 && cs.overflowY !== "visible" && cs.overflowY !== "auto";
            if (clipX || clipY) out.push(`"${text.slice(0, 40)}" (${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight})`);
        }
        return out.slice(0, 12);
    });
}

/** The vertical lines a row's direct visible children occupy (1 = one line). */
export async function lineCount(row: Locator): Promise<number> {
    return row.evaluate((el) => {
        const tops = new Set<number>();
        for (const c of Array.from(el.children) as HTMLElement[]) {
            const r = c.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            tops.add(Math.round(r.top + r.height / 2));
        }
        // Merge centers within 8px of each other.
        const sorted = [...tops].sort((a, b) => a - b);
        let lines = 0, last = -1e9;
        for (const t of sorted) { if (t - last > 8) lines++; last = t; }
        return lines;
    });
}

export const KEY_SIZES = [
    { name: "NORMAL", button: "Normal" },
    { name: "MEDIUM", button: "medium" },
    { name: "SMALL", button: "small" },
] as const;

/** Pick a key size with the bottom-right controls. */
export async function setKeySize(page: Page, button: string) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("button", { name: button, exact: true })).toHaveAttribute("aria-pressed", "true");
}

/** Picker and editor keys (not the layout canvas) that are cut off: past the window edge or clipped by a parent. */
export async function cutOffKeys(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const out: string[] = [];
        const keys = Array.from(document.querySelectorAll<HTMLElement>("[data-keycap]")).filter((k) => !k.closest("[data-keyboard-instance]"));
        for (const k of keys) {
            const r = k.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const cs = getComputedStyle(k);
            if (cs.visibility === "hidden" || cs.display === "none") continue;
            if (r.bottom < 0 || r.top > window.innerHeight) continue; // scrolled out vertically is fine
            const label = (k.textContent || "").trim().slice(0, 12);
            if (r.right > window.innerWidth + 1 || r.left < -1) { out.push(`"${label}" past the window (${Math.round(r.left)}..${Math.round(r.right)} of ${window.innerWidth})`); continue; }
            for (let a = k.parentElement; a && a !== document.body; a = a.parentElement) {
                const ox = getComputedStyle(a).overflowX;
                if (ox === "visible") continue;
                const ar = a.getBoundingClientRect();
                if (r.right > ar.right + 1 || r.left < ar.left - 1) {
                    out.push(`"${label}" cut by <${a.tagName.toLowerCase()} overflow-x:${ox}> (${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(ar.left)}..${Math.round(ar.right)})`);
                }
                break;
            }
        }
        return out.slice(0, 10);
    });
}
