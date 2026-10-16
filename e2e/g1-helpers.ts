// Shared helpers for the group 1 (app shell) UX flow specs.
import { expect, type Locator, type Page } from "@playwright/test";
import { CANVAS_KEY } from "./fixtures";

/** Where finding screenshots go (outside the repo). */
export const FINDING_IMG_DIR = "C:/Users/morga/Svalboard/review/img/ux";

/** Rail items that open a side panel, in rail order (Overlay opens a dialog, Manual a page). */
export const RAIL_PANELS = [
    "Standard Keys", "Pointing Devices", "Special Keys", "Layer Keys", "Mouse Keys",
    "Tap Dance Keys", "Macro Keys", "Leaders", "Combos", "Overrides", "Layouts",
    "Quick Start", "About", "Settings",
] as const;

/** Every rail item, in order. */
export const RAIL_ITEMS = [
    ...RAIL_PANELS.slice(0, 11), "Overlay", "Quick Start", "Manual", "About", "Settings",
] as const;

/** The navigation rail (the primary sidebar). */
export function rail(page: Page): Locator {
    return page.locator('[data-sidebar="sidebar"]').first();
}

/** A rail item by its label. */
export function railItem(page: Page, name: string): Locator {
    return rail(page).getByRole(name === "Manual" ? "link" : "button", { name, exact: true });
}

/** The side (or bottom) detail panel. */
export function detailPanel(page: Page): Locator {
    return page.locator("aside.detail-panel");
}

/** Open a rail panel and wait for it to be shown. */
export async function openRailPanel(page: Page, name: string) {
    // A second click on the active rail item closes its panel, so only click when needed.
    const panel = detailPanel(page);
    const shown = await panel.isVisible() && (await panel.getAttribute("aria-label")) === name;
    if (!shown) await railItem(page, name).click();
    await expect(detailPanel(page)).toBeVisible();
    await page.waitForTimeout(350); // let the slide-in transition settle before measuring
}

/** The key-size buttons: their accessible names as rendered. */
export const KEY_SIZE_BUTTON: Record<"normal" | "medium" | "small", RegExp> = {
    normal: /^normal$/i,
    medium: /^medium$/i,
    small: /^small$/i,
};

/** The key-size Auto button (the first of the two "Auto" buttons). */
export function keySizeAuto(page: Page): Locator {
    return page.getByRole("button", { name: "Auto", exact: true }).first();
}

/** The panel-mode Auto button (the second "Auto" button). */
export function layoutModeAuto(page: Page): Locator {
    return page.getByRole("button", { name: "Auto", exact: true }).nth(1);
}

/** Width of the first canvas key, in CSS pixels. */
export async function canvasKeyWidth(page: Page): Promise<number> {
    const box = await page.locator(CANVAS_KEY).first().boundingBox();
    return box ? Math.round(box.width) : 0;
}

/** Save a screenshot for a finding. */
export async function findingShot(page: Page, id: string) {
    await page.screenshot({ path: `${FINDING_IMG_DIR}/${id}.png` });
}

export type LayoutIssue = { check: string; detail: string };

/**
 * Measures the page for the layout rules: nothing in the side panel scrolls
 * or sticks out sideways; the toolbar and layer strip stay on one line and
 * are either fully shown or scroll; no clipped text; no short label wraps a
 * single word onto its own line; rail items are not cut off or covered.
 */
export async function layoutIssues(page: Page): Promise<LayoutIssue[]> {
    return page.evaluate(() => {
        const issues: { check: string; detail: string }[] = [];
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const visible = (el: Element) => {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return false;
            const cs = getComputedStyle(el);
            return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
        };
        const name = (el: Element) => {
            const he = el as HTMLElement;
            const label = el.getAttribute("aria-label") || (he.innerText || "").trim().replace(/\s+/g, " ");
            return `${el.tagName.toLowerCase()}${label ? ` "${label.slice(0, 40)}"` : ""}`;
        };
        /** The visible box of an element after every clipping ancestor and the viewport. */
        const clipBox = (el: Element) => {
            let left = 0, top = 0, right = vw, bottom = vh;
            for (let a = el.parentElement; a; a = a.parentElement) {
                const cs = getComputedStyle(a);
                const r = a.getBoundingClientRect();
                if (cs.overflowX !== "visible") { left = Math.max(left, r.left); right = Math.min(right, r.right); }
                if (cs.overflowY !== "visible") { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
                if (cs.position === "fixed") break;
            }
            return { left, top, right, bottom };
        };
        /** The horizontally scrolling ancestor that lets the user reach el, if any. */
        const horizontalScroller = (el: Element): HTMLElement | null => {
            for (let a = el.parentElement; a; a = a.parentElement) {
                const cs = getComputedStyle(a);
                if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && a.scrollWidth > a.clientWidth + 1) return a;
            }
            return null;
        };
        /**
         * A phone has overlay scrollbars, so a row that scrolls needs its own cue
         * (a fade or mask at the edge, or an arrow). Desktop browsers show a scrollbar.
         */
        const hasScrollCue = (s: HTMLElement) => {
            if (vw > 600) return true;
            for (const el of [s, s.parentElement]) {
                if (!el) continue;
                const cs = getComputedStyle(el);
                if ((cs.maskImage && cs.maskImage !== "none") || ((cs as unknown as Record<string, string>).webkitMaskImage ?? "none") !== "none") return true;
                for (const pseudo of ["::before", "::after"]) {
                    const ps = getComputedStyle(el, pseudo);
                    if (ps.content !== "none" && /gradient/.test(ps.backgroundImage)) return true;
                }
            }
            return false;
        };

        // 1. Side panel: nothing scrolls sideways or sticks out.
        const panel = document.querySelector("aside.detail-panel");
        if (panel && visible(panel)) {
            const pr = panel.getBoundingClientRect();
            if (pr.right > vw + 1) issues.push({ check: "panel-overflow", detail: `the panel itself ends at ${Math.round(pr.right)} past the ${vw}px viewport` });
            for (const el of Array.from(panel.querySelectorAll("*"))) {
                if (!visible(el)) continue;
                if (el.closest("[data-editor-ghost]")) continue;
                const cs = getComputedStyle(el);
                if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) {
                    issues.push({ check: "panel-overflow", detail: `${name(el)} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})` });
                }
                const r = el.getBoundingClientRect();
                if (r.right > pr.right + 1 || r.left < pr.left - 1) {
                    // Only count the outermost offender.
                    const parent = el.parentElement?.getBoundingClientRect();
                    if (parent && (parent.right > pr.right + 1 || parent.left < pr.left - 1)) continue;
                    issues.push({ check: "panel-overflow", detail: `${name(el)} sticks out of the panel (${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(pr.left)}..${Math.round(pr.right)})` });
                }
            }
        }

        // 2. Toolbar and layer strip: one line, and either fully shown or scrollable.
        const firstButton = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => !b.closest("aside.detail-panel, [data-sidebar]") && (b.getAttribute("aria-label") || b.textContent || "").trim() === label);
        const rows: [string, string[]][] = [
            ["toolbar", ["Connect", "Import Layout", "Export Layout", "Matrix Tester", "Show Multiple Layers", "3D View", "Hide Thumbs", "Hide All Transparent Keys", "Overview"]],
            ["layer-strip", ["Hide Transparent Layers", ...Array.from({ length: 15 }, (_, i) => String(i)), "mouse", "Reverse Layer Order"]],
        ];
        const canvas = document.querySelector('[aria-label="Keyboard canvas"]');
        for (const [row, labels] of rows) {
            const buttons = labels.map((l) => {
                if (row === "layer-strip" && canvas) {
                    return Array.from(canvas.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === l);
                }
                return firstButton(l);
            }).filter((b): b is HTMLButtonElement => !!b && visible(b));
            if (!buttons.length) continue;
            const tops = buttons.map((b) => Math.round(b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2));
            if (Math.max(...tops) - Math.min(...tops) > 6) issues.push({ check: `${row}-one-line`, detail: `${row} wraps onto ${new Set(tops).size} lines` });
            const covered = panel && visible(panel) ? panel.getBoundingClientRect() : null;
            for (const b of buttons) {
                const r = b.getBoundingClientRect();
                const c = clipBox(b);
                const cut = r.left < c.left - 1 || r.right > c.right + 1;
                const under = covered && r.right > covered.left && r.left < covered.right && r.bottom > covered.top && r.top < covered.bottom;
                if (!cut && !under) continue;
                const scroller = horizontalScroller(b);
                if (!scroller) {
                    issues.push({ check: `${row}-clipped`, detail: `${name(b)} is ${under ? "under the side panel" : "cut off"} and the row does not scroll` });
                } else if (!hasScrollCue(scroller)) {
                    issues.push({ check: `${row}-clipped`, detail: `${name(b)} is ${under ? "under the side panel" : "cut off"}; the row scrolls but shows no scroll cue on a phone` });
                }
            }
        }

        // 3. Clipped text and 4. a single word wrapped onto its own line.
        const scopes = [panel, document.querySelector('[data-sidebar="sidebar"]'), canvas?.parentElement ?? null].filter((s): s is Element => !!s && visible(s));
        const seen = new Set<Element>();
        for (const scope of scopes) {
            for (const el of Array.from(scope.querySelectorAll("*"))) {
                if (seen.has(el) || !visible(el)) continue;
                seen.add(el);
                const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
                if (!own.length) continue;
                if (el.closest("[data-keyboard-instance], [data-key-x], [aria-hidden='true'], .sr-only")) continue;
                const cs = getComputedStyle(el);
                const he = el as HTMLElement;
                if (cs.overflowX !== "visible" && he.scrollWidth > he.clientWidth + 1) {
                    issues.push({ check: "clipped-text", detail: `${name(el)} is cut off${cs.textOverflow === "ellipsis" ? " with an ellipsis" : ""} (${he.scrollWidth} > ${he.clientWidth})` });
                }
                // A short label, heading or description that wraps must not leave one word alone.
                if (el.closest("[data-keycap]")) continue;
                const full = (he.innerText || "").trim();
                if (full.length > 80 || full.includes("\n") || !/\s/.test(full)) continue;
                if (Array.from(el.children).some((c) => !getComputedStyle(c).display.startsWith("inline"))) continue;
                const lines = new Map<number, number>();
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                    const t = node.textContent!;
                    const re = /\S+/g;
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(t))) {
                        const range = document.createRange();
                        range.setStart(node, m.index);
                        range.setEnd(node, m.index + m[0].length);
                        const rect = range.getClientRects()[0];
                        if (!rect || rect.width < 1) continue;
                        const top = Math.round(rect.top / 4) * 4;
                        lines.set(top, (lines.get(top) ?? 0) + 1);
                    }
                }
                if (lines.size > 1) {
                    const last = Math.max(...lines.keys());
                    if (lines.get(last) === 1) issues.push({ check: "orphan-word", detail: `"${full.slice(0, 70)}" leaves one word alone on its last line` });
                }
            }
        }

        // 6. The key size / layout controls never sit on top of keys on the canvas.
        const autoSize = document.querySelector('button[title="Auto size based on window"]');
        const controls = autoSize?.parentElement?.parentElement;
        if (controls && visible(controls)) {
            const c = controls.getBoundingClientRect();
            const hit = Array.from(document.querySelectorAll("[data-keyboard-instance] [data-key-x]")).filter((k) => {
                const r = k.getBoundingClientRect();
                return visible(k) && r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom;
            });
            if (hit.length) issues.push({ check: "controls-overlap", detail: `the key size controls cover ${hit.length} canvas keys` });
        }

        // 5. Rail items: not cut off, not covered by the build label.
        const railEl = document.querySelector('[data-sidebar="sidebar"]');
        const badge = Array.from(document.querySelectorAll("div[aria-hidden='true']")).find((d) => getComputedStyle(d).position === "fixed" && /·/.test(d.textContent || ""));
        const badgeRect = badge && visible(badge) ? badge.getBoundingClientRect() : null;
        if (railEl) {
            for (const item of Array.from(railEl.querySelectorAll("li button, li a"))) {
                if (!visible(item)) continue;
                const r = item.getBoundingClientRect();
                const c = clipBox(item);
                if (r.bottom > c.bottom + 1 || r.top < c.top - 1 || r.bottom > vh + 1) {
                    issues.push({ check: "rail-cut-off", detail: `${name(item)} is cut off (${Math.round(r.top)}..${Math.round(r.bottom)}, visible ${Math.round(c.top)}..${Math.round(Math.min(c.bottom, vh))})` });
                }
                if (badgeRect && r.bottom > badgeRect.top && r.top < badgeRect.bottom && r.right > badgeRect.left && r.left < badgeRect.right) {
                    issues.push({ check: "rail-overlap", detail: `${name(item)} overlaps the build label` });
                }
            }
        }
        return issues;
    });
}

/** Group issues by check for a readable assertion message. */
export function byCheck(issues: LayoutIssue[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const i of issues) (out[i.check] ??= []).includes(i.detail) || out[i.check].push(i.detail);
    return out;
}

/**
 * Marks the current test as documenting a known app problem (finding id).
 * The test is expected to fail until the app is fixed. UX_SHOW_KNOWN=1 runs
 * it as a normal test, to see the failure itself.
 */
export function knownBug(t: { fail: (condition: boolean, description: string) => void }, id: string) {
    t.fail(!process.env.UX_SHOW_KNOWN, `known finding ${id}`);
}
