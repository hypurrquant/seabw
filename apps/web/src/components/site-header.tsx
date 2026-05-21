import Link from "next/link";
import { WalletBadge } from "./wallet-badge";

// Global header — brand on the left, wallet badge on the right.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3 md:px-10">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold tracking-tight text-[color:var(--color-fg)] transition-colors group-hover:text-[color:var(--color-accent)]">
            DefiPilot
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-fg-muted)] sm:inline">
            robo-advisor
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <WalletBadge />
        </nav>
      </div>
    </header>
  );
}
