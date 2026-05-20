"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/state/app-state";
import type { YieldProduct } from "@/types/yield-product";
import { Button, Card, Pill } from "@/components/ui";
import { chainName, CHAINS } from "@/config/chains";
import { formatPct, formatUsd, cn } from "@/lib/utils";
import { ProductDetail } from "@/components/product-detail";
import { BasketBar } from "@/components/basket-bar";

type SortKey = "apr" | "tvl" | "audits" | "age";

const KIND_LABEL: Record<string, string> = {
  lending: "Lending",
  lp: "LP",
  farm: "Farm",
  vault: "Vault",
};

const KIND_COLOR: Record<string, string> = {
  lending: "text-[color:var(--color-conservative)]",
  lp: "text-[color:var(--color-balanced)]",
  farm: "text-[color:var(--color-aggressive)]",
  vault: "text-[color:var(--color-accent-2)]",
};

interface Filters {
  chainIds: Set<number>;
  kinds: Set<string>;
  minTvl: number;
  minApr: number;
  auditedOnly: boolean;
  search: string;
}

const ALL_TVLS = [0, 10_000_000, 30_000_000, 100_000_000];
const ALL_APRS = [0, 5, 15, 30];

export function Marketplace() {
  const { state, dispatch } = useApp();
  const tier = state.tier?.tier ?? "balanced";
  const [products, setProducts] = useState<YieldProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>("apr");
  const [filters, setFilters] = useState<Filters>({
    chainIds: new Set(),
    kinds: new Set(),
    minTvl: 0,
    minApr: 0,
    auditedOnly: tier !== "degen",
    search: "",
  });
  const [detail, setDetail] = useState<YieldProduct | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/marketplace/yields?tier=${tier}`)
      .then((r) => r.json())
      .then((d: { products?: YieldProduct[]; error?: string }) => {
        if (cancelled) return;
        if (d.error || !d.products) {
          setError(d.error ?? "Failed to load catalog");
          setProducts([]);
          return;
        }
        setProducts(d.products);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setProducts([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [tier]);

  const visible = useMemo(() => {
    if (!products) return [];
    let list = products;
    if (filters.chainIds.size > 0) list = list.filter((p) => filters.chainIds.has(p.chainId));
    if (filters.kinds.size > 0) list = list.filter((p) => filters.kinds.has(p.kind));
    if (filters.minTvl > 0) list = list.filter((p) => p.tvlUsd >= filters.minTvl);
    if (filters.minApr > 0) list = list.filter((p) => p.apr.totalPct >= filters.minApr);
    if (filters.auditedOnly) list = list.filter((p) => p.auditCount > 0);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.protocolName.toLowerCase().includes(q) ||
          p.protocolSlug.toLowerCase().includes(q) ||
          p.poolLabel.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "apr") return b.apr.totalPct - a.apr.totalPct;
      if (sort === "tvl") return b.tvlUsd - a.tvlUsd;
      if (sort === "audits") return b.auditCount - a.auditCount;
      return b.ageDays - a.ageDays;
    });
    return sorted;
  }, [products, filters, sort]);

  const toggleChain = (id: number) => {
    setFilters((prev) => {
      const next = new Set(prev.chainIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, chainIds: next };
    });
  };
  const toggleKind = (k: string) => {
    setFilters((prev) => {
      const next = new Set(prev.kinds);
      next.has(k) ? next.delete(k) : next.add(k);
      return { ...prev, kinds: next };
    });
  };

  const chainIdsInCatalog = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.chainId))),
    [products],
  );
  const kindsInCatalog = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.kind))),
    [products],
  );

  const basketIds = useMemo(
    () => new Set(state.basket.map((b) => b.productId)),
    [state.basket],
  );

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-7xl flex-col px-6 py-6 pb-32">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Pill>Marketplace · {tier}</Pill>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Compare yields, build a basket</h1>
          <p className="text-sm text-[color:var(--color-fg-muted)]">
            Only pools allowed for your tier are listed. APR is estimated, not
            guaranteed. Pools with wide 7-day variance carry a ribbon badge.
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="ghost" onClick={() => dispatch({ type: "GOTO", stage: "tier-result" })}>
            ← Tier
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "GOTO", stage: "intent" })}>
            Switch to AI mode
          </Button>
        </div>
      </header>

      {/* Mobile-only filter toggle — the facet sidebar is long, so on phones it
          collapses behind this button instead of pushing all pools below the
          fold. Always-visible sidebar returns at lg. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((v) => !v)}
        className="mb-3 inline-flex items-center justify-between gap-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-4 py-2.5 text-sm lg:hidden"
        aria-expanded={filtersOpen}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={15} strokeWidth={2} />
          Filters
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={cn("transition-transform", filtersOpen && "rotate-180")}
        />
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className={cn("flex-col gap-4 lg:flex", filtersOpen ? "flex" : "hidden")}>
          <Card title="Search" variant="panel">
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Protocol or pool…"
              className="panel-2 w-full rounded-md p-2 text-sm focus-ring focus:outline-none"
            />
          </Card>
          <Card title="Chain" variant="panel">
            <div className="flex flex-col gap-1">
              {chainIdsInCatalog.map((id) => (
                <label key={id} className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.chainIds.has(id)}
                      onChange={() => toggleChain(id)}
                    />
                    {chainName(id)}
                  </span>
                  <span className="text-[color:var(--color-fg-muted)]">
                    {products?.filter((p) => p.chainId === id).length}
                  </span>
                </label>
              ))}
            </div>
          </Card>
          <Card title="Type" variant="panel">
            <div className="flex flex-col gap-1">
              {kindsInCatalog.map((k) => (
                <label key={k} className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.kinds.has(k)}
                      onChange={() => toggleKind(k)}
                    />
                    <span className={KIND_COLOR[k] ?? ""}>{KIND_LABEL[k] ?? k}</span>
                  </span>
                  <span className="text-[color:var(--color-fg-muted)]">
                    {products?.filter((p) => p.kind === k).length}
                  </span>
                </label>
              ))}
            </div>
          </Card>
          <Card title="Min TVL" variant="panel">
            <div className="flex flex-col gap-1">
              {ALL_TVLS.map((t) => (
                <label key={t} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="tvl"
                    checked={filters.minTvl === t}
                    onChange={() => setFilters({ ...filters, minTvl: t })}
                  />
                  {t === 0 ? "Any" : `≥ ${formatUsd(t)}`}
                </label>
              ))}
            </div>
          </Card>
          <Card title="Min APR" variant="panel">
            <div className="flex flex-col gap-1">
              {ALL_APRS.map((t) => (
                <label key={t} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="apr"
                    checked={filters.minApr === t}
                    onChange={() => setFilters({ ...filters, minApr: t })}
                  />
                  {t === 0 ? "Any" : `≥ ${t}%`}
                </label>
              ))}
            </div>
          </Card>
          <Card title="Audit" variant="panel">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={filters.auditedOnly}
                onChange={() => setFilters({ ...filters, auditedOnly: !filters.auditedOnly })}
              />
              Named auditor only
            </label>
          </Card>
        </aside>

        <section className="flex flex-col">
          <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--color-fg-muted)]">
            <div>{loading ? "Loading…" : `${visible.length} pools`}</div>
            <div className="flex items-center gap-2">
              <span>Sort:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="panel-2 rounded-md px-2 py-1 text-xs"
              >
                <option value="apr">Highest APR</option>
                <option value="tvl">Highest TVL</option>
                <option value="audits">Most audits</option>
                <option value="age">Oldest</option>
              </select>
            </div>
          </div>
          {error && (
            <div className="panel-2 border-[color:var(--color-danger)]/40 p-3 text-sm text-[color:var(--color-danger)]">
              {error}
            </div>
          )}
          <div className="panel divide-y divide-[color:var(--color-border)]">
            {/* Desktop column header — hidden on mobile where each pool is a
                vertical card with an inline metric strip instead. */}
            <div className="hidden grid-cols-[1fr_70px_90px_90px_60px_120px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)] md:grid">
              <div>Pool</div>
              <div className="text-right">APR</div>
              <div className="text-right">TVL</div>
              <div className="text-right">Audits</div>
              <div className="text-right">Risk</div>
              <div className="text-right">Action</div>
            </div>
            {loading && visible.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[1fr_70px_90px_90px_60px_120px] md:items-center md:gap-2"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="skeleton h-3 w-[68%]" />
                    <div className="skeleton h-2.5 w-[35%] opacity-70" />
                  </div>
                  <div className="skeleton h-3 w-12 md:justify-self-end" />
                  <div className="skeleton h-3 w-16 md:justify-self-end" />
                  <div className="skeleton h-3 w-8 md:justify-self-end" />
                  <div className="skeleton h-3 w-10 md:justify-self-end" />
                  <div className="skeleton h-7 w-20 rounded-md md:justify-self-end" />
                </div>
              ))}
            {visible.map((p) => {
              const inBasket = basketIds.has(p.id);
              const wide = p.apr.varianceBps && p.apr.varianceBps > 400;
              const ActionBtn = inBasket ? (
                <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "BASKET_REMOVE", productId: p.id })}>
                  Remove
                </Button>
              ) : (
                <Button size="sm" onClick={() => dispatch({ type: "BASKET_ADD", productId: p.id, amountUsd: state.totalDepositUsd / Math.max(1, state.basket.length + 1) })}>
                  Add
                </Button>
              );
              return (
                <div
                  key={p.id}
                  className={cn(
                    "px-4 py-3 text-sm hover:bg-[color:var(--color-panel-2)]/40",
                    "flex flex-col gap-3 md:grid md:grid-cols-[1fr_70px_90px_90px_60px_120px] md:items-center md:gap-2",
                    inBasket && "bg-[color:var(--color-panel-2)]/30",
                  )}
                >
                  <button onClick={() => setDetail(p)} className="text-left">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn("text-[10px] uppercase", KIND_COLOR[p.kind])}>
                        {KIND_LABEL[p.kind]}
                      </span>
                      <span className="font-medium">{p.protocolName}</span>
                      <span className="text-[color:var(--color-fg-muted)]">· {p.poolLabel}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[color:var(--color-fg-muted)]">
                      {chainName(p.chainId)} · age {p.ageDays}d
                    </div>
                  </button>

                  {/* Mobile inline metric strip + action — hidden on md+. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs md:hidden">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <MobileMetric label="APR">
                        <span className="font-medium">{formatPct(p.apr.totalPct, 1)}</span>
                        {wide && (
                          <span className="ml-1 text-[10px] text-[color:var(--color-warning)]">
                            ±{Math.round(p.apr.varianceBps! / 100)}%
                          </span>
                        )}
                      </MobileMetric>
                      <MobileMetric label="TVL">{formatUsd(p.tvlUsd)}</MobileMetric>
                      <MobileMetric label="Audits">{p.auditCount}</MobileMetric>
                      <MobileMetric label="Risk">
                        {p.risks.length === 0 ? <Pill tone="ok">safe</Pill> : p.risks.length}
                      </MobileMetric>
                    </div>
                    {ActionBtn}
                  </div>

                  {/* Desktop cells — hidden on mobile, become grid columns ≥ md. */}
                  <div className="hidden text-right md:block">
                    <div className="font-medium">{formatPct(p.apr.totalPct, 1)}</div>
                    {wide && <div className="text-[9px] text-[color:var(--color-warning)]">±{Math.round(p.apr.varianceBps! / 100)}%</div>}
                  </div>
                  <div className="hidden text-right text-xs md:block">{formatUsd(p.tvlUsd)}</div>
                  <div className="hidden text-right text-xs md:block">{p.auditCount}</div>
                  <div className="hidden text-right text-xs md:block">
                    {p.risks.length === 0 ? <Pill tone="ok">safe</Pill> : <span>{p.risks.length}</span>}
                  </div>
                  <div className="hidden text-right md:block">{ActionBtn}</div>
                </div>
              );
            })}
            {!loading && visible.length === 0 && (
              <div className="p-6 text-center text-sm text-[color:var(--color-fg-muted)]">
                No pools match these filters. Loosen the audit/TVL gates or add another chain.
              </div>
            )}
          </div>
        </section>
      </div>

      {detail && (
        <ProductDetail
          product={detail}
          onClose={() => setDetail(null)}
          inBasket={basketIds.has(detail.id)}
        />
      )}

      <BasketBar />
    </main>
  );
}

function MobileMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-muted)]">
        {label}
      </span>
      <span>{children}</span>
    </span>
  );
}

// keep reference for tree-shake protection
export const _CHAIN_NAMES = Object.values(CHAINS).map((c) => c.name);
