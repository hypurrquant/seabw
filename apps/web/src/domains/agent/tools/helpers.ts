/**
 * Boundary helpers for AI JSON → typed params conversion.
 * Shared by compose-pipeline/resolver.ts and calculate-*.ts tools.
 */

type Err = { error: string };
function err(msg: string): Err { return { error: msg }; }
export function isErr(v: unknown): v is Err { return typeof v === 'object' && v !== null && 'error' in v; }

export function str(p: Record<string, unknown>, f: string): string | Err {
  const v = p[f]; return typeof v === 'string' && v.length > 0 ? v : err(`Missing ${f}`);
}
export function addr(p: Record<string, unknown>, f: string): `0x${string}` | Err {
  const v = p[f]; if (typeof v !== 'string') return err(`Missing ${f}`);
  const a = v.toLowerCase();
  if (a.startsWith('0x') && a.length === 42) return `0x${a.slice(2)}`;
  return err(`Invalid address ${f}`);
}
export function num(p: Record<string, unknown>, f: string): number | Err {
  const v = p[f]; if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = Number(v); if (!isNaN(n)) return n; }
  return err(`Missing/invalid ${f}`);
}
export function bi(p: Record<string, unknown>, f: string): bigint | Err {
  const v = p[f]; if (typeof v === 'bigint') return v;
  if (typeof v === 'string') {
    if (!/^-?\d+$/.test(v)) return err(`Invalid bigint ${f}: ${v}`);
    return BigInt(v);
  }
  if (typeof v === 'number') return BigInt(v);
  return err(`Missing ${f}`);
}
export function optNum(p: Record<string, unknown>, f: string, def: number): number {
  const v = p[f]; return typeof v === 'number' ? v : def;
}

// ── Server result type guards ──────────────────────────────────────

/** Narrow unknown → number, or return Err */
export function numResult(v: unknown, label: string): number | Err {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = Number(v); if (!isNaN(n)) return n; }
  return err(`Expected number for ${label}, got ${typeof v}`);
}

/** Narrow unknown → boolean, or return Err */
export function boolResult(v: unknown, label: string): boolean | Err {
  if (typeof v === 'boolean') return v;
  return err(`Expected boolean for ${label}, got ${typeof v}`);
}

type CoeffResult = { c0: number; c1: number; case: string };
/** Narrow unknown → CoeffResult, or return Err */
export function coeffResult(v: unknown): CoeffResult | Err {
  if (typeof v !== 'object' || v === null) return err('calcCoefficients: expected object result');
  if (!('c0' in v) || typeof v.c0 !== 'number') return err('calcCoefficients: c0 must be number');
  if (!('c1' in v) || typeof v.c1 !== 'number') return err('calcCoefficients: c1 must be number');
  if (!('case' in v) || typeof v.case !== 'string') return err('calcCoefficients: case must be string');
  return { c0: v.c0, c1: v.c1, case: v.case };
}

type TickRangeResult = { tickLower: number; tickUpper: number };
/** Narrow unknown → TickRangeResult, or return Err */
export function tickRangeResult(v: unknown): TickRangeResult | Err {
  if (typeof v !== 'object' || v === null) return err('tickRange: expected object result');
  if (!('tickLower' in v) || typeof v.tickLower !== 'number') return err('tickRange: tickLower must be number');
  if (!('tickUpper' in v) || typeof v.tickUpper !== 'number') return err('tickRange: tickUpper must be number');
  return { tickLower: v.tickLower, tickUpper: v.tickUpper };
}

type AmountsResult = { amount0: string; amount1: string };
/** Narrow unknown → AmountsResult, or return Err */
export function amountsResult(v: unknown): AmountsResult | Err {
  if (typeof v !== 'object' || v === null) return err('amounts: expected object result');
  if (!('amount0' in v) || typeof v.amount0 !== 'string') return err('amounts: amount0 must be string');
  if (!('amount1' in v) || typeof v.amount1 !== 'string') return err('amounts: amount1 must be string');
  return { amount0: v.amount0, amount1: v.amount1 };
}

type SwapDirectionResult = { fromToken: string; amountIn: string };
/** Narrow unknown → SwapDirectionResult | null, or return Err */
export function swapDirectionResult(v: unknown): SwapDirectionResult | null | Err {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object') return err('swapDirection: expected object or null');
  if (!('fromToken' in v) || typeof v.fromToken !== 'string') return err('swapDirection: fromToken must be string');
  if (!('amountIn' in v) || typeof v.amountIn !== 'string') return err('swapDirection: amountIn must be string');
  return { fromToken: v.fromToken, amountIn: v.amountIn };
}

type DepositSnapshotResult = {
  maxDeposit: { amount0: string; amount1: string; cappedBy: string };
  disabledSide: string | null;
  zapPlan: { kind: string; direction: string | null; amountIn: string | null };
};
/** Narrow unknown → DepositSnapshotResult, or return Err */
export function depositSnapshotResult(v: unknown): DepositSnapshotResult | Err {
  if (typeof v !== 'object' || v === null) return err('depositSnapshot: expected object result');
  if (!('maxDeposit' in v) || typeof v.maxDeposit !== 'object' || v.maxDeposit === null) return err('depositSnapshot: maxDeposit must be object');
  const md = v.maxDeposit;
  if (!('amount0' in md) || typeof md.amount0 !== 'string') return err('depositSnapshot: maxDeposit.amount0 must be string');
  if (!('amount1' in md) || typeof md.amount1 !== 'string') return err('depositSnapshot: maxDeposit.amount1 must be string');
  if (!('cappedBy' in md) || typeof md.cappedBy !== 'string') return err('depositSnapshot: maxDeposit.cappedBy must be string');
  if (!('disabledSide' in v)) return err('depositSnapshot: disabledSide field missing');
  if (v.disabledSide !== null && typeof v.disabledSide !== 'string') return err('depositSnapshot: disabledSide must be string or null');
  if (!('zapPlan' in v) || typeof v.zapPlan !== 'object' || v.zapPlan === null) return err('depositSnapshot: zapPlan must be object');
  const zp = v.zapPlan;
  if (!('kind' in zp) || typeof zp.kind !== 'string') return err('depositSnapshot: zapPlan.kind must be string');
  return {
    maxDeposit: { amount0: md.amount0, amount1: md.amount1, cappedBy: md.cappedBy },
    disabledSide: typeof v.disabledSide === 'string' ? v.disabledSide : null,
    zapPlan: {
      kind: zp.kind,
      direction: 'direction' in zp && typeof zp.direction === 'string' ? zp.direction : null,
      amountIn: 'amountIn' in zp && typeof zp.amountIn === 'string' ? zp.amountIn : null,
    },
  };
}

/** Narrow string → `0x${string}`, or return Err */
export function addrFromString(s: string, label: string): `0x${string}` | Err {
  const a = s.toLowerCase();
  if (a.startsWith('0x') && a.length === 42) {
    // Safe: a is exactly 42 chars starting with '0x', matching the `0x${string}` template
    const addr: `0x${string}` = `0x${a.slice(2)}`;
    return addr;
  }
  return err(`Invalid address for ${label}: ${s}`);
}
