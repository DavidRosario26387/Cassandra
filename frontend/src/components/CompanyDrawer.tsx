import { useEffect } from "react";
import type { Company } from "../types";
import { score, pct, mult, num, money } from "../lib/format";
import Pill from "./Pill";
import StatTile from "./StatTile";

const PILLARS: [string, keyof Company][] = [
  ["Quality", "quality_score"],
  ["Growth", "growth_score"],
  ["Durability", "durability_score"],
  ["Capital Allocation", "capital_allocation_score"],
  ["Financial Strength", "financial_strength_score"],
];

function PillarRow({ label, value, tone }: { label: string; value: number | null; tone?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="grid grid-cols-[132px_1fr_30px] items-center gap-3">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${v}%`, background: value == null ? "transparent" : tone ?? "var(--accent)" }}
        />
      </span>
      <span className="tnum text-right text-[12.5px] font-semibold text-ink">{score(value)}</span>
    </div>
  );
}

export default function CompanyDrawer({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const open = !!company;
  const d = company;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[min(480px,96vw)] flex-col border-l border-border bg-surface shadow-pop transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {d && (
          <>
            {/* quote header */}
            <div className="relative border-b border-border px-6 py-5">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md border border-border-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                ✕
              </button>
              <div className="pr-10">
                <div className="flex items-center gap-2">
                  <span className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px] font-bold text-accent-ink">
                    {d.tk || "—"}
                  </span>
                  <span className="text-[12px] text-muted">{d.sec}</span>
                </div>
                <h2 className="display mt-1.5 text-[20px] leading-tight text-ink">{d.co}</h2>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="tnum text-[40px] font-semibold leading-none text-ink">
                    {score(d.compounder_score)}
                  </span>
                  <span className="text-[13px] text-muted">/ 100</span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Pill rec={d.rec} />
                  <span className="text-[11px] text-muted">
                    {d.cf} confidence · {d.yr ?? "—"}y history
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-10 pt-5">
              <SectionTitle>Pillar breakdown · sector-relative percentile</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {PILLARS.map(([lab, k]) => (
                  <PillarRow key={k} label={lab} value={d[k] as number | null} />
                ))}
                <div className="my-1 border-t border-border" />
                <PillarRow label="Valuation" value={d.valuation_score} tone="var(--wait)" />
              </div>

              <SectionTitle>Business quality</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="ROIC (median)" value={pct(d.roic_median)} />
                <StatTile
                  label="ROIC persistence"
                  value={d.roic_persistence == null ? "—" : (d.roic_persistence * 100).toFixed(0) + "%"}
                />
                <StatTile label="Gross margin" value={pct(d.gross_margin_median)} />
                <StatTile label="Operating margin" value={pct(d.operating_margin)} />
                <StatTile label="ROIIC (5y)" value={num(d.roiic_5y)} />
                <StatTile label="Cash conversion" value={num(d.cash_conversion)} />
              </div>

              <SectionTitle>Growth &amp; returns</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Revenue CAGR 10y" value={pct(d.revenue_cagr_10y)} />
                <StatTile label="Earnings CAGR 10y" value={pct(d.earnings_cagr_10y)} />
                <StatTile label="FCF yield" value={pct(d.fcf_yield)} />
                <StatTile label="Total payout" value={pct(d.total_payout_ratio)} />
              </div>

              <SectionTitle>Valuation &amp; balance sheet</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Market cap" value={money(d.market_cap)} />
                <StatTile label="Price" value={d.price == null ? "—" : "$" + d.price.toFixed(2)} />
                <StatTile
                  label="P / E (FY)"
                  value={mult(d.pe)}
                  hint="Price ÷ last full fiscal-year GAAP net income — not trailing-twelve-months, so it will differ from Google/Yahoo (which use TTM diluted EPS)."
                />
                <StatTile
                  label="P / FCF (FY)"
                  value={mult(d.pfcf)}
                  hint="Price ÷ last full fiscal-year free cash flow (not TTM)."
                />
                <StatTile
                  label="Net cash"
                  value={money(d.net_cash)}
                  tone={d.net_cash == null ? undefined : d.net_cash >= 0 ? "pos" : "neg"}
                />
                <StatTile label="Debt / equity" value={num(d.debt_to_equity)} />
              </div>

              <div className="mt-6 rounded-lg border border-border bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-ink-2">
                The compounder score ranks business quality within <b className="text-ink">{d.sec}</b> —
                it does not time the market. Valuation is a separate axis: the{" "}
                <b className="text-ink">{d.rec}</b> call combines quality with how attractively{" "}
                {d.tk || "the company"} is currently priced.
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}
