// Helpers for the group 2 (layout editor) UX flow tests.
import { expect, type Locator, type Page } from "@playwright/test";
import { CANVAS_KEY } from "./fixtures";
import * as fs from "fs";
import * as path from "path";

/** Where finding screenshots go (one per finding id). */
export const FINDINGS_DIR = "C:/Users/morga/Svalboard/review/img/ux";

/** A canvas key by its matrix position (row * cols + col, shown as "Matrix N" in the inspector). */
export function keyAt(page: Page, pos: number): Locator {
    return page.locator(`${CANVAS_KEY}[data-inspect-pos="${pos}"]`).first();
}

/** A canvas key by the keycode it carries. */
export function keyWith(page: Page, keycode: string): Locator {
    return page.locator(`${CANVAS_KEY}[data-keycode="${keycode}"]`);
}

/** Matrix positions of the demo's layer 0 keys used by these tests. */
export const POS = { esc: 22, a: 26, s: 20, q: 27, z: 24 } as const;

export async function openRail(page: Page, name: string): Promise<Locator> {
    await page.getByRole("button", { name, exact: true }).first().click();
    const panel = page.getByRole("complementary", { name });
    await expect(panel).toBeVisible();
    return panel;
}

/** The selected key is drawn red (the class is the only signal the user sees). */
export const SELECTED = /(^|\s)bg-red-500(\s|$)/;

export async function isSelected(key: Locator) {
    return SELECTED.test((await key.getAttribute("class")) || "");
}

/** Select a canvas key with a click, and confirm it shows as selected. */
export async function selectKey(page: Page, pos: number) {
    const key = keyAt(page, pos);
    if (!(await isSelected(key))) await key.click();
    await expect(key).toHaveClass(SELECTED);
    return key;
}

/** Click a key of the Standard Keys picker by its default label (for example "b"). */
export function pickerKey(panel: Locator, label: string): Locator {
    return panel.locator(`[data-picker-key="${label}"]`).first();
}

/** Every keycode of the canvas, in matrix order. */
export async function canvasKeycodes(page: Page): Promise<string[]> {
    return page.locator(CANVAS_KEY).evaluateAll((els) =>
        els
            .map((e) => [Number(e.getAttribute("data-inspect-pos")), e.getAttribute("data-keycode") || ""] as const)
            .sort((a, b) => a[0] - b[0])
            .map(([, k]) => k),
    );
}

/** Change a General setting through the Settings panel, the way a user does. */
export async function setSetting(page: Page, label: string, value: string) {
    const panel = await openRail(page, "Settings");
    const control = panel.getByRole("combobox", { name: label });
    if (await control.count()) {
        await control.selectOption({ label: value });
        return;
    }
    const group = panel.getByRole("group", { name: label });
    await group.getByRole("button", { name: value, exact: true }).click();
    await expect(group.getByRole("button", { name: value, exact: true })).toHaveAttribute("aria-pressed", "true");
}

export async function closePanel(page: Page) {
    const close = page.getByRole("button", { name: "Close details panel" });
    if (await close.count()) await close.first().click();
}

/** Save a screenshot for a finding (only the first time, so a rerun keeps the original). */
export async function shotFinding(page: Page, id: string, target?: Locator) {
    fs.mkdirSync(FINDINGS_DIR, { recursive: true });
    const file = path.join(FINDINGS_DIR, `${id}.png`);
    if (target) await target.screenshot({ path: file }).catch(() => page.screenshot({ path: file }));
    else await page.screenshot({ path: file });
}

// ---------------------------------------------------------------- layout checks

export type Problem = string;

/** Elements in `root` that stick out past its right edge, or a root that scrolls sideways. */
export async function sideOverflow(root: Locator): Promise<Problem[]> {
    return root.evaluate((rootEl) => {
        const out: string[] = [];
        const r = rootEl.getBoundingClientRect();
        if (rootEl.scrollWidth > rootEl.clientWidth + 1)
            out.push(`panel scrolls sideways (scrollWidth ${rootEl.scrollWidth} > ${rootEl.clientWidth})`);
        rootEl.querySelectorAll<HTMLElement>("*").forEach((el) => {
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height) return;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.position === "fixed") return;
            // Inside a container that scrolls on purpose: not an overflow of the panel.
            let p = el.parentElement;
            while (p && p !== rootEl) {
                const ox = getComputedStyle(p).overflowX;
                if (ox === "auto" || ox === "scroll") return;
                p = p.parentElement;
            }
            if (b.right > r.right + 1 || b.left < r.left - 1) {
                const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
                out.push(`"${name}" spans ${Math.round(b.left)}..${Math.round(b.right)}, panel ${Math.round(r.left)}..${Math.round(r.right)}`);
            }
        });
        return [...new Set(out)].slice(0, 15);
    });
}

/**
 * Text that is cut off: a text run whose box goes past an ancestor that hides
 * overflow (keycaps, buttons, labels). Ellipsis counts as cut off too.
 */
export async function clippedText(root: Locator): Promise<Problem[]> {
    return root.evaluate((rootEl) => {
        const out: string[] = [];
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
            const text = (n.textContent || "").trim();
            if (!text) continue;
            const parent = n.parentElement!;
            const pcs = getComputedStyle(parent);
            if (pcs.visibility === "hidden" || pcs.display === "none" || parent.closest("[aria-hidden='true'],.sr-only")) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            const t = range.getBoundingClientRect();
            if (!t.width || !t.height) continue;
            let a: HTMLElement | null = parent;
            while (a) {
                const cs = getComputedStyle(a);
                const hides = (v: string) => v === "hidden" || v === "clip";
                const ab = a.getBoundingClientRect();
                const cutX = hides(cs.overflowX) && (t.right > ab.right + 1.5 || t.left < ab.left - 1.5);
                const cutY = hides(cs.overflowY) && (t.bottom > ab.bottom + 1.5 || t.top < ab.top - 1.5);
                const scrollsX = (cs.overflowX === "auto" || cs.overflowX === "scroll");
                if (cutX || cutY) {
                    out.push(`"${text.slice(0, 30)}" cut ${cutX ? "sideways" : "at top/bottom"} (${Math.round(t.width)}x${Math.round(t.height)} in ${Math.round(ab.width)}x${Math.round(ab.height)})`);
                    break;
                }
                if (scrollsX || a === rootEl) break;
                a = a.parentElement;
            }
            if (pcs.textOverflow === "ellipsis" && parent.scrollWidth > parent.clientWidth + 1)
                out.push(`"${text.slice(0, 30)}" ends in an ellipsis`);
        }
        return [...new Set(out)].slice(0, 20);
    });
}

/** Short UI labels (buttons, keycaps, headings) where one word sits alone on its own line. */
export async function orphanWords(root: Locator, selector = "button, [data-keycap], h1, h2, h3, label, [role=menuitem]"): Promise<Problem[]> {
    return root.evaluate((rootEl, sel) => {
        const out: string[] = [];
        rootEl.querySelectorAll<HTMLElement>(sel).forEach((el) => {
            const text = (el.innerText || "").trim();
            if (!text || text.split(/\s+/).length < 2 || text.length > 60) return;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || el.closest(".sr-only,[aria-hidden='true']")) return;
            // Collect the line tops of each word.
            const tops: number[] = [];
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let n: Node | null;
            while ((n = walker.nextNode())) {
                const s = n.textContent || "";
                const re = /\S+/g;
                let m: RegExpExecArray | null;
                while ((m = re.exec(s))) {
                    const r = document.createRange();
                    r.setStart(n, m.index);
                    r.setEnd(n, m.index + m[0].length);
                    const b = r.getBoundingClientRect();
                    if (b.height) tops.push(Math.round(b.top));
                }
            }
            const lines = [...new Set(tops)];
            if (lines.length > 1 && el.innerText.includes(" ")) {
                const last = Math.max(...lines);
                const onLast = tops.filter((t) => t === last).length;
                if (onLast === 1) out.push(`"${text.replace(/\s+/g, " ")}" wraps, leaving one word alone`);
            }
        });
        return [...new Set(out)].slice(0, 15);
    }, selector);
}

/**
 * Controls that must sit on one line: all on the same line, and anything past
 * the window's right edge reachable by scrolling, with a visible cue.
 */
export async function lineProblems(items: Locator, label: string): Promise<Problem[]> {
    return items.evaluateAll((els, name) => {
        const out: string[] = [];
        const vw = document.documentElement.clientWidth;
        const kids = (els as HTMLElement[]).filter((k) => {
            const b = k.getBoundingClientRect();
            return b.width > 0 && b.height > 0 && getComputedStyle(k).visibility !== "hidden";
        });
        if (!kids.length) return [`${name}: not shown`];
        const mids = kids.map((k) => { const b = k.getBoundingClientRect(); return b.top + b.height / 2; });
        const spread = Math.max(...mids) - Math.min(...mids);
        if (spread > 10) out.push(`${name}: wraps onto more than one line (${Math.round(spread)}px apart)`);
        const cut = kids.filter((k) => k.getBoundingClientRect().right > vw + 1);
        if (cut.length) {
            let p: HTMLElement | null = cut[0].parentElement;
            let scrolls = false;
            while (p) {
                const ox = getComputedStyle(p).overflowX;
                if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 1) { scrolls = true; break; }
                p = p.parentElement;
            }
            const names = cut.map((k) => (k.getAttribute("aria-label") || k.textContent || "").trim()).slice(0, 8).join(", ");
            out.push(`${name}: ${cut.length} control(s) past the right edge of the window ${scrolls ? "(scrollable, no visible cue)" : "and not scrollable"}: ${names}`);
        }
        return out;
    }, label);
}
