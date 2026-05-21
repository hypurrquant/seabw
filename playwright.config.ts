import { defineConfig, devices } from "@playwright/test";

// E2E gate is out of scope for v1.2.2. This config keeps playwright loadable
// (so `npx playwright test --list` works) but assumes HQ + web are already
// running externally. See docs/phases/v1.2.2-production-readiness/dod.md.
const PORT = process.env.PLAYWRIGHT_PORT ?? "3000";
const HQ_PORT = process.env.PLAYWRIGHT_HQ_PORT ?? "3003";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "off",
  },
  // webServer omitted intentionally: e2e is currently a manual workflow.
  // To run locally: start HQ on :3003, then `pnpm --filter @seabw/web dev` on :3000,
  // then `pnpm exec playwright test`.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        extraHTTPHeaders: {
          "x-playwright-hq-port": HQ_PORT,
        },
      },
    },
  ],
});
