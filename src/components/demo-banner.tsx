"use client";

export function DemoBanner() {
  const env = process.env.NEXT_PUBLIC_DEFIPILOT_ENV ?? "demo";
  if (env === "prod") return null;
  return (
    <div className="w-full bg-[color:var(--color-warning)]/10 border-b border-[color:var(--color-warning)]/40 text-[color:var(--color-warning)] text-xs px-4 py-2 text-center">
      DEMO — funds are fake. Run on testnet or forked mainnet.
    </div>
  );
}
