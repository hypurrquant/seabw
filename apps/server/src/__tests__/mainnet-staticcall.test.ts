/* eslint-disable no-console */
import { beforeAll, describe, expect, test } from "vitest";
import {
  DEFAULT_RPC_READ_SCENARIOS,
  DEFAULT_SCENARIOS,
  ensureDefiCliStatusReachable,
  runRpcRead,
  runScenario,
  type StaticcallResult,
} from "../../scripts/mainnet-staticcall";

let defiCliAvailable = false;

beforeAll(async () => {
  defiCliAvailable = await ensureDefiCliStatusReachable();
});

describe("mainnet RPC connectivity (clean pass)", () => {
  for (const scenario of DEFAULT_RPC_READ_SCENARIOS) {
    test(scenario.label, async () => {
      const r: StaticcallResult = await runRpcRead(scenario);
      console.log(`[mainnet:rpc] ${scenario.label}: ${r.status} (${r.notes})`);
      expect(r.status).toBe("pass");
    });
  }
});

describe("mainnet swap-quote staticcall sweep", () => {
  for (const scenario of DEFAULT_SCENARIOS) {
    test(scenario.label, async () => {
      if (!defiCliAvailable) {
        console.warn(`[mainnet:swap] defi-cli unavailable — skipping ${scenario.label}`);
        return;
      }
      const r: StaticcallResult = await runScenario(scenario);
      console.log(`[mainnet:swap] ${scenario.label}: ${r.status} (${r.notes})`);
      expect(["pass", "expected-revert", "skipped"]).toContain(r.status);
    });
  }
});
