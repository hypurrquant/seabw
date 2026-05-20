import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? "3000";
const SERVER_PORT = process.env.PLAYWRIGHT_SERVER_PORT ?? "4000";
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
  webServer: [
    {
      command: `pnpm --filter @seabw/server start:dev`,
      url: `http://localhost:${SERVER_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: SERVER_PORT,
        DEFIPILOT_ENV: "demo",
        DEFIPILOT_DEFI_CLI: "off",
        DEFIPILOT_USE_FIXTURES: "true",
      },
    },
    {
      command: `pnpm --filter @seabw/web dev`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_E2E: "1",
        NEXT_PUBLIC_API_BASE_URL: `http://localhost:${SERVER_PORT}`,
        NEXT_PUBLIC_DEFAULT_CHAIN_ID: "8453",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
