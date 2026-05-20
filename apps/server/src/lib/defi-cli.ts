import { spawn } from "node:child_process";
import { defiCliKey } from "@seabw/core";
import {
  DefiCliQuoteSchema,
  PriceResponseSchema,
  YieldScanSchema,
} from "@seabw/core";
import { assertToolAllowed } from "../domains/plan/internal/tools";

export interface DefiCliOptions {
  bin?: string;
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

export class DefiCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "DefiCliError";
  }
}

export function defiCliBin(): string {
  return process.env.DEFI_CLI_BIN ?? "defi";
}

export async function runDefiJson(
  args: string[],
  opts: DefiCliOptions = {},
): Promise<unknown> {
  const bin = opts.bin ?? defiCliBin();
  const timeoutMs = opts.timeoutMs ?? 25_000;
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...args, "--json"], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new DefiCliError(`defi-cli timed out after ${timeoutMs}ms`, -1, stderr));
    }, timeoutMs);
    opts.signal?.addEventListener("abort", () => {
      child.kill("SIGTERM");
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new DefiCliError(`defi-cli failed to spawn: ${err.message}`, -1, stderr));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new DefiCliError(`defi-cli exited with code ${code}: ${stderr.trim()}`, code ?? -1, stderr));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(
          new DefiCliError(
            `defi-cli returned non-JSON output: ${(err as Error).message}`,
            0,
            stderr,
          ),
        );
      }
    });
  });
}

function chainArg(chainId: number): string[] {
  const key = defiCliKey(chainId);
  return key ? ["--chain", key] : [];
}

export interface DefiCliCalldata {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
}

// Loose typing — defi-cli responses vary by command. We narrow at call sites.
export interface YieldScanRow {
  protocol: string;
  chain: string;
  symbol?: string;
  pair?: string;
  apr?: number;
  apy?: number;
  tvl_usd?: number;
}

export interface PriceRow {
  symbol: string;
  price_usd?: number;
  source?: string;
}

export interface SwapQuote {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  amount_out?: string;
  price_impact_pct?: number;
  slippage_pct?: number;
  gas_estimate_usd?: number;
  aggregator?: string;
}

const HEX_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_DATA_RE = /^0x[a-fA-F0-9]*$/;

function ensureHex(value: unknown, kind: "to" | "data"): `0x${string}` {
  if (typeof value !== "string") {
    throw new DefiCliError(`defi-cli ${kind} not a hex string`, 0, "");
  }
  const re = kind === "to" ? HEX_ADDR_RE : HEX_DATA_RE;
  if (!re.test(value)) {
    throw new DefiCliError(`defi-cli ${kind} not valid hex: ${value}`, 0, "");
  }
  return value as `0x${string}`;
}

export function asCalldata(raw: unknown): DefiCliCalldata {
  const parsed = DefiCliQuoteSchema.parse(raw);
  if (parsed.error) {
    throw new DefiCliError(`defi-cli reported error: ${parsed.error}`, 0, "");
  }
  const source =
    parsed.tx ??
    parsed.calldata ??
    (parsed.details && parsed.details.to && parsed.details.data
      ? { to: parsed.details.to, data: parsed.details.data, value: String(parsed.details.value ?? "0") }
      : parsed.to && parsed.data
        ? { to: parsed.to, data: parsed.data, value: String(parsed.value ?? "0") }
        : null);
  if (!source) {
    throw new DefiCliError("defi-cli quote did not include calldata", 0, "");
  }
  return {
    to: ensureHex(source.to, "to"),
    data: ensureHex(source.data, "data"),
    value: String(source.value ?? "0"),
  };
}

export async function yieldScan(
  chainId: number,
  opts?: { kind?: "lending" | "lp" | "all"; minApr?: number; signal?: AbortSignal },
): Promise<YieldScanRow[]> {
  assertToolAllowed("defi.yield.scan");
  const args = ["yield", "scan", ...chainArg(chainId)];
  if (opts?.kind && opts.kind !== "all") args.push("--kind", opts.kind);
  if (opts?.minApr !== undefined) args.push("--min-apr", String(opts.minApr));
  const raw = await runDefiJson(args, { signal: opts?.signal });
  return YieldScanSchema.parse(raw);
}

export async function price(
  symbol: string,
  chainId?: number,
  signal?: AbortSignal,
): Promise<number | undefined> {
  assertToolAllowed("defi.price");
  const args = ["price", "--symbol", symbol];
  if (chainId) args.push(...chainArg(chainId));
  const raw = await runDefiJson(args, { signal });
  const parsed = PriceResponseSchema.parse(raw);
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  return row?.price_usd;
}

export async function swapQuote(params: {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: string;        // base-units; e.g. "1000000" = 1 USDC (6-dec)
  fromAddress?: string;       // optional, defi-cli accepts dry-run without
  slippageBps?: number;
  provider?: "kyber" | "openocean" | "liquid" | "lifi" | "relay";
  signal?: AbortSignal;
}): Promise<SwapQuote> {
  assertToolAllowed("defi.swap.quote");
  // defi-cli surface: `defi --chain <chain> swap --from <token> --to <token>
  // --amount <wei> [--provider <name>] [--slippage <bps>]`
  // Note the --amount is in token base units, not decimal.
  const args = [
    ...chainArg(params.chainId),
    "swap",
    "--from",
    params.tokenIn,
    "--to",
    params.tokenOut,
    "--amount",
    params.amountInWei,
  ];
  if (params.provider) args.push("--provider", params.provider);
  if (params.slippageBps !== undefined) args.push("--slippage", String(params.slippageBps));
  const env = params.fromAddress
    ? ({ DEFI_WALLET_ADDRESS: params.fromAddress } as unknown as NodeJS.ProcessEnv)
    : undefined;
  const raw = await runDefiJson(args, { signal: params.signal, env });
  const cd = asCalldata(raw);
  const parsed = DefiCliQuoteSchema.parse(raw);
  return {
    to: cd.to,
    data: cd.data,
    value: cd.value,
    amount_out: parsed.amount_out,
    price_impact_pct: parsed.price_impact_pct,
    slippage_pct: parsed.slippage_pct,
    gas_estimate_usd: parsed.gas_estimate_usd,
    aggregator: parsed.aggregator ?? parsed.provider,
  };
}

export function isDefiCliAvailable(): boolean {
  // Cheap synchronous-ish check is impossible; this flag lets callers gate
  // behind a build-time toggle when we know the binary isn't installed in
  // the runtime environment (e.g. judging container).
  return process.env.DEFIPILOT_DEFI_CLI === "off" ? false : true;
}

export function isFixtureMode(): boolean {
  return (
    process.env.DEFIPILOT_USE_FIXTURES === "true" ||
    process.env.DEFIPILOT_DEFI_CLI === "off"
  );
}

// --- Portfolio queries -----------------------------------------------------

export interface PortfolioToken {
  symbol: string;
  balance: string;
  value_usd: string | null;
}

export interface PortfolioLendingPosition {
  protocol: string;
  collateral_usd: string;
  debt_usd: string;
  health_factor: string | null;
}

export interface PortfolioShowResponse {
  address: string;
  chain: string;
  native_price_usd: string;
  native_balance: string;
  native_value_usd: string;
  total_value_usd: string;
  token_balances: PortfolioToken[];
  lending_positions: PortfolioLendingPosition[];
}

export interface LpPosition {
  protocol: string;
  type: string;
  token_id?: string;
  token0?: string;
  token1?: string;
  liquidity?: string;
  tickLower?: number;
  tickUpper?: number;
  bin_id?: number;
}

export async function portfolioShow(
  chainId: number,
  address: string,
  signal?: AbortSignal,
): Promise<PortfolioShowResponse> {
  assertToolAllowed("defi.portfolio");
  const args = [...chainArg(chainId), "portfolio", "show", "--address", address];
  const raw = (await runDefiJson(args, { signal })) as PortfolioShowResponse;
  return raw;
}

export async function lpPositions(
  chainId: number,
  address: string,
  signal?: AbortSignal,
): Promise<LpPosition[]> {
  assertToolAllowed("defi.lp.discover");
  const args = [...chainArg(chainId), "lp", "positions", "--address", address];
  const raw = (await runDefiJson(args, { signal })) as LpPosition[];
  return Array.isArray(raw) ? raw : [];
}
