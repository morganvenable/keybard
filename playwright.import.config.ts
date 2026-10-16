// The layout import flow against a mocked byte-level board. It needs source
// modules to swap in the mock, so it runs on the Vite dev server instead of the
// built app the other UX flows use. Run: npm run test:ux:import
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.UX_IMPORT_PORT || 4473);
const BASE = "/keybard/";

export default defineConfig({
    testDir: "e2e",
    testMatch: /.*\.flow\.ts$/,
    outputDir: "e2e/.results-import",
    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    retries: 0,
    timeout: 90_000,
    expect: { timeout: 10_000 },
    reporter: [["list"]],
    use: {
        baseURL: `http://127.0.0.1:${PORT}${BASE}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
    webServer: {
        command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
        env: { VITE_BASE_PATH: BASE },
        url: `http://127.0.0.1:${PORT}${BASE}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
