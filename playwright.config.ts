// UX flow tests: Playwright against the built app (vite preview), demo
// layouts only, no keyboard hardware. Run: npm run test:ux
// Flows that need a connected keyboard (*.board.e2e.ts) run against the Vite
// dev server instead, so e2e/board.ts can swap in a mocked board.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.UX_PORT || 4471);
const BOARD_PORT = Number(process.env.UX_BOARD_PORT || 4472);
const BASE = "/keybard/";

export default defineConfig({
    testDir: "e2e",
    outputDir: "e2e/.results",
    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    retries: 0,
    timeout: 45_000,
    expect: { timeout: 8_000 },
    reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]],
    use: {
        baseURL: `http://127.0.0.1:${PORT}${BASE}`,
        viewport: { width: 1440, height: 1000 },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "chromium", testMatch: /(?<!\.board)\.e2e\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
        { name: "board", testMatch: /\.board\.e2e\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, baseURL: `http://127.0.0.1:${BOARD_PORT}${BASE}` } },
    ],
    webServer: [{
        // Build once, then serve the built app. UX_SKIP_BUILD=1 reuses dist/.
        command: process.env.UX_SKIP_BUILD
            ? `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`
            : `npx vite build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
        env: { VITE_BASE_PATH: BASE },
        url: `http://127.0.0.1:${PORT}${BASE}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
    }, {
        // Source modules for the mocked board (e2e/board.ts).
        command: `npx vite --port ${BOARD_PORT} --strictPort --host 127.0.0.1`,
        env: { VITE_BASE_PATH: BASE },
        url: `http://127.0.0.1:${BOARD_PORT}${BASE}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    }],
});
