"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Check } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import type {
  ExecutionResult,
  PipelinePlan,
  PlanStep,
  StepStatus,
} from "@/types";
import { chainName, CHAINS } from "@/config/chains";
import { cn, formatUsd, shortHash, truncateAddress } from "@/lib/utils";
import { useApp } from "@/state/app-state";

const ACTION_LABEL: Record<PlanStep["kind"], string> = {
  swap: "Swap",
  bridge: "Bridge",
  "lend.supply": "Supply",
  "lend.withdraw": "Withdraw",
  "lp.add": "Add LP",
  "lp.remove": "Remove LP",
  "lp.stake": "Stake LP",
  "lp.claim": "Claim",
};

interface Props {
  plan: PipelinePlan;
  onClose: () => void;
  onComplete: () => void;
}

interface StepRuntimeState {
  status: StepStatus;
  txHash?: `0x${string}`;
  error?: string;
}

const COOLDOWN_SECONDS = 5;
const FIRST_RUN_KEY = "defipilot:firstRunDone";

export function SignFlow({ plan, onClose, onComplete }: Props) {
  const { dispatch } = useApp();
  const { address, chainId, status: accountStatus } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const [cursor, setCursor] = useState(0);
  const [runtime, setRuntime] = useState<Record<string, StepRuntimeState>>(() =>
    Object.fromEntries(plan.steps.map((s) => [s.id, { status: "pending" as StepStatus }])),
  );
  const [cooldown, setCooldown] = useState<number>(() =>
    typeof window !== "undefined" && window.localStorage.getItem(FIRST_RUN_KEY) === "true"
      ? 0
      : COOLDOWN_SECONDS,
  );
  const current: PlanStep | undefined = plan.steps[cursor];
  const isLast = cursor === plan.steps.length - 1;
  const balance = useBalance({ address, chainId: current?.chainId });

  // Wagmi receipt polling for the in-flight tx
  const watching = runtime[current?.id ?? ""]?.txHash;
  const receipt = useWaitForTransactionReceipt({
    hash: watching,
    chainId: current?.chainId,
    query: { enabled: Boolean(watching) },
  });

  const allDone = useMemo(
    () =>
      plan.steps.every(
        (s) =>
          runtime[s.id]?.status === "confirmed" ||
          runtime[s.id]?.status === "skipped",
      ),
    [plan.steps, runtime],
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Disconnect mid-plan → bounce to connect-wallet stage
  useEffect(() => {
    if (accountStatus === "disconnected") {
      onClose();
      dispatch({
        type: "ERROR",
        message:
          "Wallet disconnected. Reconnect to continue — any already-broadcast steps are visible on-chain.",
      });
      dispatch({ type: "GOTO", stage: "connect-wallet" });
    }
  }, [accountStatus, onClose, dispatch]);

  const saveExecution = useCallback(
    (next: Record<string, StepRuntimeState>, finished: boolean) => {
      const exec: ExecutionResult = {
        planId: plan.planId,
        perStep: plan.steps.map((s) => ({
          stepId: s.id,
          status: next[s.id]?.status ?? "pending",
          txHash: next[s.id]?.txHash,
          error: next[s.id]?.error,
        })),
        finishedAt: finished ? new Date().toISOString() : undefined,
      };
      dispatch({ type: "SET_EXECUTION", execution: exec });
    },
    [dispatch, plan.planId, plan.steps],
  );

  // When the receipt resolves, flip status to confirmed (or failed)
  useEffect(() => {
    if (!watching || !current) return;
    if (receipt.isSuccess) {
      setRuntime((prev) => {
        const next = {
          ...prev,
          [current.id]: { ...prev[current.id], status: "confirmed" as StepStatus },
        };
        saveExecution(next, isLast);
        if (isLast) setTimeout(onComplete, 800);
        else setTimeout(() => setCursor((c) => c + 1), 800);
        return next;
      });
    }
    if (receipt.isError) {
      setRuntime((prev) => {
        const next = {
          ...prev,
          [current.id]: {
            ...prev[current.id],
            status: "failed" as StepStatus,
            error: receipt.error?.message ?? "Transaction reverted on-chain.",
          },
        };
        saveExecution(next, false);
        return next;
      });
    }
  }, [
    receipt.isSuccess,
    receipt.isError,
    receipt.error,
    watching,
    current,
    isLast,
    onComplete,
    saveExecution,
  ]);

  const sign = async () => {
    if (!address || !current) return;
    if (cooldown > 0) return;
    // §8.6 / §8.3 — server-side runtime check on every sign. The server
    // looks up its canonical copy of the plan; client-supplied metadata is
    // ignored. If the server's canonical calldata for this step differs from
    // what the client thinks, we trust the server.
    let canonicalCalldata = current.calldata;
    try {
      const pre = await fetch("/api/precheck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: plan.planId,
          stepId: current.id,
          signerAddress: address,
        }),
      });
      if (!pre.ok) {
        const data = (await pre.json().catch(() => ({}))) as { reason?: string; ruleId?: string };
        setRuntime((prev) => ({
          ...prev,
          [current.id]: {
            status: "failed",
            error: data.reason ?? `Precheck failed (${data.ruleId ?? pre.status}).`,
          },
        }));
        return;
      }
      const data = (await pre.json()) as { canonicalCalldata?: typeof current.calldata };
      if (data.canonicalCalldata) canonicalCalldata = data.canonicalCalldata;
    } catch (err) {
      setRuntime((prev) => ({
        ...prev,
        [current.id]: { status: "failed", error: `Precheck network error: ${(err as Error).message}` },
      }));
      return;
    }
    try {
      if (chainId !== current.chainId) {
        await switchChainAsync({ chainId: current.chainId });
      }
      const value = BigInt(canonicalCalldata.value || "0");
      const data =
        canonicalCalldata.data === "0x"
          ? undefined
          : (canonicalCalldata.data as `0x${string}`);
      const to = canonicalCalldata.to as `0x${string}`;
      if (!data || to === "0x0000000000000000000000000000000000000000") {
        const next = {
          ...runtime,
          [current.id]: {
            status: "confirmed" as StepStatus,
            txHash: `0x${"d".repeat(64)}` as `0x${string}`,
          },
        };
        setRuntime(next);
        saveExecution(next, isLast);
        window.localStorage.setItem(FIRST_RUN_KEY, "true");
        if (isLast) onComplete();
        else setCursor((c) => c + 1);
        return;
      }
      const hash = await sendTransactionAsync({ to, data, value });
      const next = {
        ...runtime,
        [current.id]: { status: "broadcasted" as StepStatus, txHash: hash },
      };
      setRuntime(next);
      saveExecution(next, false);
      window.localStorage.setItem(FIRST_RUN_KEY, "true");
    } catch (err) {
      const message = (err as Error).message ?? "Wallet rejected the request.";
      setRuntime((prev) => ({
        ...prev,
        [current.id]: { status: "failed", error: message },
      }));
    }
  };

  const skip = () => {
    if (!current) return;
    setRuntime((prev) => ({
      ...prev,
      [current.id]: { ...prev[current.id], status: "skipped" },
    }));
    if (isLast) onComplete();
    else setCursor((c) => c + 1);
  };

  const abortRemaining = () => {
    setRuntime((prev) => {
      const next = { ...prev };
      for (let i = cursor; i < plan.steps.length; i++) {
        const s = plan.steps[i];
        if (next[s.id]?.status === "pending") {
          next[s.id] = { ...next[s.id], status: "skipped" };
        }
      }
      saveExecution(next, true);
      return next;
    });
    onComplete();
  };

  if (!current) return null;
  const chainOk = chainId === current.chainId;
  const planAgeMs = Date.now() - new Date(plan.createdAt).getTime();
  // Matches MAX_PLAN_AGE_MS in /api/precheck; the server enforces, this is UX.
  const drift = planAgeMs > 5 * 60_000 ? Math.round(planAgeMs / 1000) : 0;

  // Gas cap warning (§8.3 gas.cap). Native USD per chain — values are
  // intentionally conservative; replace with an oracle for production.
  const NATIVE_USD: Record<number, number> = {
    1: 3200,     // ETH
    8453: 3200,  // Base ETH
    84532: 3200, // Base Sepolia ETH
    56: 700,     // BNB
    5000: 0.8,   // MNT
    999: 12,     // HYPE
    143: 1,      // MON
  };
  const gasUsd = current.expected.feeUsd;
  const nativePrice = NATIVE_USD[current.chainId] ?? 1;
  const requiredGasWei = BigInt(Math.ceil((gasUsd / nativePrice) * 1e18));
  const balanceWei = balance.data?.value ?? 0n;
  // Per §8.3: gas <= balance * 0.7  →  balance * 7 >= required * 10
  const gasInsufficient = balanceWei > 0n && balanceWei * 7n < requiredGasWei * 10n;

  const currentStatus = runtime[current.id]?.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[color:var(--color-fg)]/20 p-4 backdrop-blur-sm">
      <Card className="my-auto w-full max-w-xl" title="Sign & execute">
        {/* Step rail — where you are across the whole pipeline. */}
        <ol className="flex items-center gap-1.5">
          {plan.steps.map((s, i) => {
            const st = runtime[s.id]?.status ?? "pending";
            const isCurrent = i === cursor;
            const done = st === "confirmed";
            const failed = st === "failed";
            const skipped = st === "skipped";
            return (
              <li key={s.id} className="flex flex-1 items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors",
                    isCurrent && "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white",
                    done && !isCurrent && "border-[color:var(--color-success)] bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
                    failed && !isCurrent && "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)]",
                    skipped && !isCurrent && "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)] line-through",
                    !isCurrent && !done && !failed && !skipped && "border-[color:var(--color-border)] text-[color:var(--color-fg-muted)]",
                  )}
                  title={`${ACTION_LABEL[s.kind]} · ${chainName(s.chainId)} · ${st}`}
                >
                  {done ? <Check size={12} strokeWidth={2.5} /> : i + 1}
                </span>
                {i < plan.steps.length - 1 && (
                  <span
                    className={cn(
                      "h-px flex-1",
                      done ? "bg-[color:var(--color-success)]/45" : "bg-[color:var(--color-border)]",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div className="text-xs text-[color:var(--color-fg-muted)]">
          Step {cursor + 1} of {plan.steps.length} · {ACTION_LABEL[current.kind]} on {chainName(current.chainId)}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill>{chainName(current.chainId)}</Pill>
          <Pill tone="warn">slippage cap {current.expected.slippagePct.toFixed(2)}%</Pill>
          {current.risks.map((r) => (
            <Pill key={r} tone="warn">
              {r}
            </Pill>
          ))}
        </div>
        <div className="panel-2 p-3 text-sm">
          <Row label="Action" value={`${current.kind} via ${current.protocol}`} />
          <Row label="To" value={truncateAddress(current.calldata.to)} />
          <Row
            label="In"
            value={current.expected.inputs.map((t) => `${t.amount} ${t.token}`).join(" + ") || "—"}
          />
          <Row
            label="Out"
            value={current.expected.outputs.map((t) => `${t.amount} ${t.token}`).join(" + ") || "—"}
          />
          <Row label="Est. fee" value={formatUsd(gasUsd)} />
          <Row
            label="Deadline"
            value={
              (current.params as { deadline?: number }).deadline
                ? new Date(
                    Number((current.params as { deadline?: number }).deadline) * 1000,
                  ).toLocaleTimeString()
                : "—"
            }
          />
        </div>

        {!chainOk && (
          <div className="panel-2 border-[color:var(--color-warning)]/40 text-xs text-[color:var(--color-warning)] p-3">
            Wallet is on {chainName(chainId ?? 0)}, this step needs {chainName(current.chainId)}.
            We&apos;ll request a network switch.
          </div>
        )}

        {drift > 0 && (
          <div className="panel-2 border-[color:var(--color-warning)]/40 text-xs text-[color:var(--color-warning)] p-3">
            Prices may have moved since this plan was built ({drift}s ago).
            Server precheck will refuse a stale plan; rebuild from Plan Review to refresh calldata.
          </div>
        )}

        {gasInsufficient && (
          <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-3">
            Native balance is below the 70% gas headroom rule (§8.3 gas.cap). Top up
            {" "}{CHAINS[current.chainId]?.nativeSymbol ?? "the native token"} before signing.
          </div>
        )}

        {currentStatus === "failed" && (
          <div className="panel-2 border-[color:var(--color-danger)]/40 text-xs text-[color:var(--color-danger)] p-3">
            {runtime[current.id]?.error}
            <div className="mt-2 text-[color:var(--color-fg-muted)]">
              Recovery: review the step, or skip to halt and leave prior on-chain results in place.
            </div>
          </div>
        )}

        {watching && (
          <div className="text-xs text-[color:var(--color-fg-muted)]">
            <a
              href={CHAINS[current.chainId]?.explorerTxUrl(watching) ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {shortHash(watching)}
            </a>{" · "}
            {receipt.isLoading
              ? "waiting for confirmation"
              : receipt.isSuccess
                ? "confirmed"
                : receipt.isError
                  ? "failed"
                  : currentStatus}
          </div>
        )}

        {cooldown > 0 && (
          <p className="text-[11px] text-[color:var(--color-fg-muted)]">
            A short safety pause before your first signature — read the step above
            while it counts down.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onClose} className="sm:flex-none">
            Cancel
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={skip} className="flex-1 sm:flex-none">
              Skip step
            </Button>
            <Button variant="secondary" onClick={abortRemaining} className="flex-1 sm:flex-none">
              Stop here
            </Button>
            <Button
              onClick={sign}
              className="flex-1 sm:flex-none"
              disabled={
                cooldown > 0 ||
                currentStatus === "broadcasted" ||
                currentStatus === "confirmed"
              }
            >
              {cooldown > 0
                ? `Sign in ${cooldown}s…`
                : currentStatus === "broadcasted"
                  ? "Confirming…"
                  : currentStatus === "confirmed"
                    ? "Confirmed"
                    : !chainOk
                      ? `Switch to ${chainName(current.chainId)} & sign`
                      : "Sign"}
            </Button>
          </div>
        </div>

        {allDone && (
          <Button onClick={onComplete} className="w-full">
            See portfolio
          </Button>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[color:var(--color-fg-muted)]">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}

export type _PlanStep = PlanStep;
