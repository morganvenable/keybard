// Helpers for the group 4 flows (files and layouts).
import { expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const SHOTS = "C:/Users/morga/Svalboard/review/img/ux";

/** Replace the browser's save dialog with a stub that records what was saved. */
export async function stubSavePicker(page: Page, mode: "save" | "cancel" = "save") {
    await page.addInitScript((m) => {
        const w = window as any;
        w.__saved = [];
        w.showSaveFilePicker = async (opts: any) => {
            if (m === "cancel") throw new DOMException("The user aborted a request.", "AbortError");
            const parts: string[] = [];
            return {
                createWritable: async () => ({
                    write: async (b: any) => { parts.push(typeof b === "string" ? b : await b.text()); },
                    close: async () => { w.__saved.push({ name: opts?.suggestedName, content: parts.join("") }); },
                }),
            };
        };
    }, mode);
}

export async function savedFiles(page: Page): Promise<{ name: string; content: string }[]> {
    return page.evaluate(() => (window as any).__saved ?? []);
}

/** Open a rail item (Layouts, Settings, ...) by its visible name. */
export async function openRail(page: Page, name: string) {
    const item = page.getByRole("button", { name, exact: true }).first();
    await item.click();
}

/** Settings > a category (General / Fragments / Backups / Developer). */
export async function openSettings(page: Page, category?: string) {
    await openRail(page, "Settings");
    if (category) await page.getByRole("button", { name: category, exact: true }).click();
}

/** Save a screenshot for a finding. */
export async function shot(page: Page, id: string) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });
}

/** Write a temporary file for an upload and return its path. */
export function tmpFile(name: string, content: string): string {
    const dir = path.join(process.env.TEMP || "/tmp", "keybard-g4-uploads");
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${name}`);
    fs.writeFileSync(p, content);
    return p;
}

/** Elements inside `root` whose content is wider than their box (sideways scroll or clipping). */
export async function overflowingChildren(root: Locator): Promise<string[]> {
    return root.evaluate((el) => {
        const out: string[] = [];
        const box = el.getBoundingClientRect();
        if (el.scrollWidth > el.clientWidth + 1) out.push(`root scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
        el.querySelectorAll<HTMLElement>("*").forEach((c) => {
            const r = c.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const style = getComputedStyle(c);
            if (style.position === "fixed") return;
            if (r.right > box.right + 2 || r.left < box.left - 2) {
                out.push(`${c.tagName.toLowerCase()}.${(c.className || "").toString().slice(0, 40)} "${(c.textContent || "").trim().slice(0, 30)}" x ${Math.round(r.left)}-${Math.round(r.right)} vs ${Math.round(box.left)}-${Math.round(box.right)}`);
            }
        });
        return out.slice(0, 10);
    });
}

/** Text elements whose text is cut off (ellipsis or overflow hidden with text wider than the box). */
export async function clippedText(root: Locator): Promise<string[]> {
    return root.evaluate((el) => {
        const out: string[] = [];
        el.querySelectorAll<HTMLElement>("span,p,button,label,h1,h2,h3,div").forEach((c) => {
            if (!c.childNodes.length || ![...c.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) return;
            const r = c.getBoundingClientRect();
            if (r.width <= 2 || c.closest(".sr-only")) return;
            const s = getComputedStyle(c);
            if ((s.overflowX === "hidden" || s.textOverflow === "ellipsis") && c.scrollWidth > c.clientWidth + 1) {
                out.push(`"${(c.textContent || "").trim().slice(0, 40)}" ${c.scrollWidth}>${c.clientWidth}`);
            }
        });
        return out.slice(0, 10);
    });
}

export { expect };

/** The worktree root (the specs run as ES modules, so there is no __dirname). */
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

/** The side panel's scroll box: the nearest ancestor of `inner` that scrolls vertically. */
export function scrollBoxOf(inner: Locator): Locator {
    return inner.locator("xpath=ancestor::*[contains(@class,'overflow-y-auto') or contains(@class,'overflow-auto')][1]");
}
