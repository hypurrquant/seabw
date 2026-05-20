import { defineConfig, devices } from "@playwright/test";

// Production-bundle E2E: serves the actual `next build` output via `next start`,
// which is what ships. Catches differences between dev (Turbopack) and prod
// (compiled bundle) like missing env-time branches, route handler caching,
// or static-prerender side effects.

const PORT = process.env.PLAYWRIGHT_PORT ?? "3035";
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
  },
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_E2E: "1",
      DEFIPILOT_ENV: "demo",
      DEFIPILOT_DEFI_CLI: "off",
      DEFIPILOT_USE_FIXTURES: "true",
      NEXT_PUBLIC_DEFAULT_CHAIN_ID: "8453",
    },
  },
  projects: [
    {
      name: "chromium-prod",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
