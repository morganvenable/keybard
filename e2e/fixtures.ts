// Shared fixture for the UX flow tests. Every test fails on a console error
// or an uncaught page error, unless the test lists it as expected.
import { test as base, expect, type Locator, type Page } from "@playwright/test";

type Fixtures = {
    /** Console errors and page errors seen so far in this test. */
    consoleErrors: string[];
    /** Patterns for errors a test expects (for example a bad file it imports on purpose). */
    allowConsoleError: (pattern: RegExp) => void;
};

export const test = base.extend<Fixtures>({
    consoleErrors: async ({ page }, use) => {
        const errors: string[] = [];
        page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
        });
        page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
        await use(errors);
    },
    allowConsoleError: [
        async ({ consoleErrors }, use, testInfo) => {
            const allowed: RegExp[] = [];
            await use((p) => { allowed.push(p); });
            const unexpected = consoleErrors.filter((e) => !allowed.some((p) => p.test(e)));
            if (testInfo.status === testInfo.expectedStatus && unexpected.length) {
                expect(unexpected, "console errors during the flow").toEqual([]);
            }
        },
        { auto: true },
    ],
});

export { expect };

/** A key on the layout canvas (not the picker). */
export const CANVAS_KEY = "[data-keyboard-instance] [data-key-x]";

/** Open the app the way a review link does, with the demo layout loaded. */
export async function openDemo(page: Page, params = "demo") {
    await page.goto(`./?${params}`);
    await expect(page.locator(CANVAS_KEY).first()).toBeVisible({ timeout: 20_000 });
}

/**
 * A binding editor's title. Most editors show "Editing <Kind> N" as a heading;
 * the combo editor in the side panel shows the combo's name (or "Combo N") with
 * an in-place rename, so for a combo either form counts. Only an open
 * editor's header counts (it has the editor's back button).
 */
export function editorHeading(scope: Page | Locator, name: string): Locator {
    const heading = scope.getByRole("heading", { name });
    const m = /^Editing Combo (\d+)$/.exec(name);
    if (!m) return heading;
    const title = scope.locator("div:has(> [data-binding-editor-back]) > [data-combo-editor-title]").filter({ hasText: new RegExp(`Combo ${m[1]}(?!\d)`), visible: true });
    return heading.or(title).filter({ visible: true }).first();
}
