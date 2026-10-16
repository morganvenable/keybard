// Shared fixture for the UX flow tests. Every test fails on a console error
// or an uncaught page error, unless the test lists it as expected.
import { test as base, expect, type Page } from "@playwright/test";

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
