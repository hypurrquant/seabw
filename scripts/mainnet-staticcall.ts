/* eslint-disable no-console */
import { createPublicClient, http, type Chain, type Hex } from "viem";
import { base, bsc, mainnet, mantle } from "viem/chains";
import { defineChain } from "viem";
import {
  CHAINS,
  DEFI_CLI_CHAIN_IDS,
  rpcFor,
  type DefiCliChainId,
} from "@/config/chains";
import { swapQuote, runDefiJson, asCalldata } from "@/lib/defiCli";

const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [CHAINS[999].rpcDefault] } },
});

const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [CHAINS[143].rpcDefault] } },
});

const VIEM_CHAIN: Record<DefiCliChainId, Chain> = {
  [base.id]: base,
  [bsc.id]: bsc,
  [mantle.id]: mantle,
  [hyperEvm.id]: hyperEvm,
  [monad.id]: monad,
} as Record<DefiCliChainId, Chain>;

// A burn EOA — never funded, just used to anchor staticcalls.
export const PROBE_EOA = "0x000000000000000000000000000000000000dEaD" as const;

// Expected revert substrings that count as "calldata is well-formed but the
// account lacks balance/allowance" — these are PASS for the purposes of this
// test (we're verifying calldata shape, not signer state).
export const EXPECTED_REVERT_SUBSTRINGS = [
  "transfer amount exceeds balance",
  "insufficient allowance",
  "insufficient balance",
  "ERC20: transfer amount exceeds balance",
  "ERC20: insufficient allowance",
  "TRANSFER_FROM_FAILED",
  "STF",
  "TransferHelper",
];

export interface StaticcallScenario {
  chainId: DefiCliChainId;
  label: string;
  tokenIn: string;
  tokenOut: string;
  amountInWei: string;        // base units (USDC 6-dec: "100000000" = $100)
  provider?: "kyber" | "openocean" | "liquid" | "lifi" | "relay";
}

export interface StaticcallResult {
  chainId: number;
  label: string;
  status: "pass" | "expected-revert" | "fail" | "skipped";
  notes: string;
  txTo?: Hex;
  txDataPreview?: string;
}

export interface RpcReadScenario {
  chainId: DefiCliChainId;
  label: string;
}

// Pure-read connectivity check per chain. Proves the RPC + chain spec wire is
// alive end-to-end, independent of defi-cli aggregator coverage.
export async function runRpcRead(scenario: RpcReadScenario): Promise<StaticcallResult> {
  const base = { chainId: scenario.chainId, label: scenario.label };
  try {
    const client = publicClientFor(scenario.chainId);
    const block = await client.getBlockNumber();
    return {
      ...base,
      status: "pass",
      notes: `RPC alive · block #${block.toString()}`,
    };
  } catch (err) {
    return {
      ...base,
      status: "fail",
      notes: (err as Error).message.split("\n")[0].slice(0, 240),
    };
  }
}

export const DEFAULT_RPC_READ_SCENARIOS: RpcReadScenario[] = [
  { chainId: 8453, label: "Base · getBlockNumber" },
  { chainId: 56,   label: "BNB · getBlockNumber" },
  { chainId: 5000, label: "Mantle · getBlockNumber" },
  { chainId: 999,  label: "HyperEVM · getBlockNumber" },
  { chainId: 143,  label: "Monad · getBlockNumber" },
];

function publicClientFor(chainId: DefiCliChainId) {
  return createPublicClient({
    chain: VIEM_CHAIN[chainId],
    transport: http(rpcFor(chainId)),
  });
}

function isExpectedRevert(message: string): boolean {
  const lower = message.toLowerCase();
  return EXPECTED_REVERT_SUBSTRINGS.some((s) => lower.includes(s.toLowerCase()));
}

export async function runScenario(scenario: StaticcallScenario): Promise<StaticcallResult> {
  const base: Omit<StaticcallResult, "status" | "notes"> = {
    chainId: scenario.chainId,
    label: scenario.label,
  };

  // 1. Get a swap quote from defi-cli for the scenario.
  let calldata: { to: Hex; data: Hex; value: string };
  try {
    const quote = await swapQuote({
      chainId: scenario.chainId,
      tokenIn: scenario.tokenIn,
      tokenOut: scenario.tokenOut,
      amountInWei: scenario.amountInWei,
      fromAddress: PROBE_EOA,
      slippageBps: 100,
      provider: scenario.provider,
    });
    calldata = { to: quote.to, data: quote.data, value: quote.value };
  } catch (err) {
    return {
      ...base,
      status: "skipped",
      notes: `defi-cli quote failed: ${(err as Error).message.split("\n")[0]}`,
    };
  }

  // 2. Staticcall via viem public client.
  const client = publicClientFor(scenario.chainId);
  try {
    await client.call({
      account: PROBE_EOA,
      to: calldata.to,
      data: calldata.data,
      value: BigInt(calldata.value || "0"),
    });
    return {
      ...base,
      status: "pass",
      notes: "eth_call succeeded with no revert",
      txTo: calldata.to,
      txDataPreview: calldata.data.slice(0, 18),
    };
  } catch (err) {
    const message = (err as Error).message || String(err);
    if (isExpectedRevert(message)) {
      return {
        ...base,
        status: "expected-revert",
        notes: message.split("\n")[0].slice(0, 200),
        txTo: calldata.to,
        txDataPreview: calldata.data.slice(0, 18),
      };
    }
    return {
      ...base,
      status: "fail",
      notes: message.split("\n")[0].slice(0, 240),
      txTo: calldata.to,
      txDataPreview: calldata.data.slice(0, 18),
    };
  }
}

export async function ensureDefiCliStatusReachable(): Promise<boolean> {
  try {
    await runDefiJson(["status"], { timeoutMs: 10_000 });
    return true;
  } catch {
    return false;
  }
}

// All amounts in wei-equivalent (USDC = 6 decimals, so "100000000" = $100).
export const DEFAULT_SCENARIOS: StaticcallScenario[] = [
  { chainId: 8453, label: "Base · 100 USDC → WETH (lifi)",     tokenIn: "USDC", tokenOut: "WETH",  amountInWei: "100000000", provider: "lifi" },
  { chainId: 56,   label: "BNB · 100 USDC → WBNB (lifi)",       tokenIn: "USDC", tokenOut: "WBNB",  amountInWei: "100000000", provider: "lifi" },
  { chainId: 5000, label: "Mantle · 100 USDC → WMNT (lifi)",     tokenIn: "USDC", tokenOut: "WMNT",  amountInWei: "100000000", provider: "lifi" },
  { chainId: 999,  label: "HyperEVM · 100 USDC → HYPE (kyber)",  tokenIn: "USDC", tokenOut: "HYPE",  amountInWei: "100000000", provider: "kyber" },
  { chainId: 143,  label: "Monad · 100 USDC → WMON (kyber)",     tokenIn: "USDC", tokenOut: "WMON",  amountInWei: "100000000", provider: "kyber" },
];

// Stand-alone CLI entry: `pnpm exec tsx scripts/mainnet-staticcall.ts`
async function main() {
  const ok = await ensureDefiCliStatusReachable();
  if (!ok) {
    console.error("defi-cli is unreachable; aborting mainnet staticcall sweep.");
    process.exit(2);
  }
  console.log(`Running ${DEFAULT_SCENARIOS.length} scenarios via probe ${PROBE_EOA}\n`);
  const rows: StaticcallResult[] = [];
  for (const s of DEFAULT_SCENARIOS) {
    if (!(DEFI_CLI_CHAIN_IDS as readonly number[]).includes(s.chainId)) continue;
    const r = await runScenario(s);
    rows.push(r);
    const icon = r.status === "pass" ? "✅" : r.status === "expected-revert" ? "🟡" : r.status === "skipped" ? "⏭️ " : "❌";
    console.log(`${icon}  ${r.label.padEnd(36)}  ${r.status.padEnd(16)}  ${r.notes}`);
  }
  const fails = rows.filter((r) => r.status === "fail").length;
  process.exit(fails === 0 ? 0 : 1);
}

if (import.meta.url.endsWith("/mainnet-staticcall.ts") && process.argv[1]?.endsWith("mainnet-staticcall.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
