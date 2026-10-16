// Helpers for the group 5 flows (views, pointing, overlay/host, review params).
import type { Page, Locator } from "@playwright/test";
import { test, expect } from "./fixtures";

/** Where finding screenshots go (outside the repo). */
export const FINDING_DIR = "C:/Users/morga/Svalboard/review/img/ux";

/** Save a screenshot for a finding, named by its id. */
export async function findingShot(page: Page, id: string) {
    await page.screenshot({ path: `${FINDING_DIR}/${id}.png` }).catch(() => undefined);
}

/** A toolbar button by its accessible name. */
export const tool = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** A rail item (the first match is the rail; the picker tabs repeat some names). */
export const rail = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).first();

/** The side panel. */
export const sidePanel = (page: Page) => page.locator("aside.detail-panel");

/** The layer each keyboard view shows, in display order. */
export async function viewLayers(page: Page): Promise<string[]> {
    return page.locator("[data-layer-drop-surface]").evaluateAll((es) => es.map((e) => e.getAttribute("data-layer-drop-surface") ?? ""));
}

/** A key size button: Normal, Medium, Small (the key-size Auto is the first Auto). */
export async function setKeySize(page: Page, size: "Normal" | "Medium" | "Small") {
    await page.getByRole("button", { name: new RegExp(`^${size}$`, "i") }).click();
}

/**
 * Elements in `selector` that are cut off: they extend past an ancestor that
 * clips them (overflow other than visible) and that ancestor cannot scroll to
 * show them, or they extend past the viewport while the page cannot scroll.
 * Returns a short description of each.
 */
export async function clippedElements(page: Page, selector: string): Promise<string[]> {
    return page.evaluate((sel) => {
        const out: string[] = [];
        const docScrollX = document.documentElement.scrollWidth > window.innerWidth + 1;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none") continue;
            const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
            let clipped = false;
            for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
                const cs = getComputedStyle(a);
                if (cs.overflowX === "visible") continue;
                const ar = a.getBoundingClientRect();
                const beyond = r.right > ar.right + 1 || r.left < ar.left - 1;
                if (!beyond) continue;
                const scrollable = (cs.overflowX === "auto" || cs.overflowX === "scroll") && a.scrollWidth > a.clientWidth + 1;
                if (!scrollable) clipped = true;
                break;
            }
            if (!clipped && !docScrollX && (r.right > window.innerWidth + 1 || r.left < -1)) clipped = true;
            if (clipped) out.push(`${name} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        }
        return out;
    }, selector);
}

/** Elements whose text overflows their own box (clipped or ellipsized text). */
export async function clippedText(page: Page, root: string): Promise<string[]> {
    return page.evaluate((rootSel) => {
        const out: string[] = [];
        const roots = Array.from(document.querySelectorAll<HTMLElement>(rootSel));
        for (const rootEl of roots) {
            for (const el of Array.from(rootEl.querySelectorAll<HTMLElement>("*"))) {
                if (!el.childNodes.length || el.children.length) continue;
                const text = el.textContent?.trim();
                if (!text) continue;
                const cs = getComputedStyle(el);
                if (cs.overflowX === "visible" && cs.textOverflow !== "ellipsis") continue;
                if (el.scrollWidth > el.clientWidth + 1) out.push(text.slice(0, 40));
            }
        }
        return out;
    }, root);
}

/** Things inside the side panel that stick out sideways or make it scroll sideways. */
export async function sidePanelOverflow(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>("aside.detail-panel");
        if (!panel || panel.classList.contains("hidden")) return [];
        const out: string[] = [];
        const pr = panel.getBoundingClientRect();
        // A combo editor placed beside the panel (half, dock, anchored, float) sits outside it on purpose.
        const placed = panel.getAttribute("data-combo-placement");
        const besidePanel = !!placed && placed !== "panel";
        for (const el of Array.from(panel.querySelectorAll<HTMLElement>("*"))) {
            if (besidePanel && el.closest("[aria-label='Binding editor']")) continue;
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) {
                out.push(`scrolls sideways: ${(el.className || el.tagName).toString().slice(0, 60)}`);
            }
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.right > pr.right + 1) {
                out.push(`sticks out: ${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40)} (${Math.round(r.right - pr.right)}px)`);
            }
        }
        return [...new Set(out)].slice(0, 12);
    });
}

/** Does box a overlap box b by more than `tol` px on both axes? */
export function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, tol = 2) {
    return a.x + a.width - tol > b.x && b.x + b.width - tol > a.x && a.y + a.height - tol > b.y && b.y + b.height - tol > a.y;
}

/** The canvas keys' boxes in the primary view. */
export async function canvasKeyBoxes(page: Page) {
    return page.locator("[data-keyboard-instance='primary'] [data-key-x]").evaluateAll((es) =>
        es.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, label: (e.textContent || "").trim() }; }));
}

/** Screenshot bytes of a locator, for "did it change" checks. */
export async function shot(loc: Locator): Promise<Buffer> {
    return loc.screenshot({ animations: "allow" });
}

/** A snapshot of localStorage, to check that review params save nothing. */
export async function storageSnapshot(page: Page): Promise<Record<string, string>> {
    return page.evaluate(() => {
        const o: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; o[k] = localStorage.getItem(k)!; }
        return o;
    });
}

export async function expectNoSidePanelOverflow(page: Page) {
    expect(await sidePanelOverflow(page), "side panel overflow").toEqual([]);
}

/**
 * Marks a test as documenting a known app problem (finding id). The test keeps
 * the expected behavior, so it fails until the app is fixed. G5_PROBE=1 runs
 * these as ordinary tests, to see the real failure.
 */
export function known(id: string, why: string) {
    test.fail(!process.env.G5_PROBE, `${id}: ${why}`);
}

/** A layer tab in a view's strip ("0" is named "0, default layer"). */
export function layerTab(scope: Page | Locator, n: number | "mouse") {
    return scope.getByRole("button", { name: new RegExp(`^${n}(, default layer)?$`) }).first();
}

/** The primary view's layer strip. */
export const primaryView = (page: Page) => page.locator("[data-keyboard-view-instance='primary']");
