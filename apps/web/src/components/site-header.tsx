import Link from "next/link";
import { LineChart, ShieldAlert } from "lucide-react";

// Global header — brand on the left, secondary nav on the right. Sits above
// the stage indicator on flow pages and is the only sticky bar; the indicator
// scrolls with content so the two never stack on top of each other.
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
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-[color:var(--color-fg-muted)] transition-colors hover:bg-[color:var(--color-panel-2)] hover:text-[color:var(--color-fg)]"
          >
            <LineChart size={14} strokeWidth={2} />
            <span className="hidden sm:inline">Portfolio</span>
          </Link>
          <Link
            href="/risks"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-[color:var(--color-fg-muted)] transition-colors hover:bg-[color:var(--color-panel-2)] hover:text-[color:var(--color-fg)]"
          >
            <ShieldAlert size={14} strokeWidth={2} />
            <span className="hidden sm:inline">Risks</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
