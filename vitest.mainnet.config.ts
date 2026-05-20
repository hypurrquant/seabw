import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate config for the slow, network-touching mainnet staticcall suite.
// Runs only `pnpm test:mainnet` (long timeouts, no coverage).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/mainnet-staticcall.test.ts"],
    setupFiles: ["./vitest.mainnet.setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: "verbose",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
