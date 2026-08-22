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

function PillarRow({ label, value, tone }: { label: string; value: number | null; tone?: "wait" }) {
  return (
    <div className="grid grid-cols-[130px_1fr_36px] items-center gap-3">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <span className="h-2 overflow-hidden rounded" style={{ background: "var(--surface-3)" }}>
        <span
          className="block h-full rounded transition-[width] duration-500"
          style={{ width: `${value ?? 0}%`, background: tone === "wait" ? "var(--wait)" : "var(--accent)" }}
        />
      </span>
      <span className="tnum text-right text-[13px] font-semibold">{score(value)}</span>
    </div>
  );
}

export default function CompanyDrawer({ company, onClose }: { company: Company | null; onClose: () => void }) {
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
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[min(460px,94vw)] flex-col border-l border-border bg-surface shadow-drawer transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        {d && (
          <>
            <div className="relative border-b border-border px-6 py-5">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-border-2 bg-surface-2 text-ink-2 hover:text-ink"
              >
                ✕
              </button>
              <div className="pr-10 font-display text-[23px] font-medium leading-tight tracking-tight">
                {d.co}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <span className="tnum text-[13px] font-semibold text-accent-ink">{d.tk || "—"}</span>
                <span className="text-[12px] text-muted">{d.sec}</span>
                <span className="text-[10px] font-semibold tracking-wide text-muted">
                  {d.cf} CONFIDENCE · {d.yr ?? "—"}Y HISTORY
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-10 pt-5">
              <div className="mb-1.5 flex items-baseline gap-3.5">
                <span className="font-display text-[52px] font-medium leading-none tracking-tight">
                  {score(d.compounder_score)}
                </span>
                <span className="text-[14px] text-muted">/ 100 compounder</span>
                <span className="ml-auto">
                  <Pill rec={d.rec} />
                </span>
              </div>

              <SectionTitle>Pillar breakdown · sector-relative percentile</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {PILLARS.map(([lab, k]) => (
                  <PillarRow key={k} label={lab} value={d[k] as number | null} />
                ))}
                <div className="h-1" />
                <PillarRow label="Valuation" value={d.valuation_score} tone="wait" />
              </div>

              <SectionTitle>Business quality</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="ROIC (median)" value={pct(d.roic_median)} />
                <StatTile label="ROIC persistence" value={d.roic_persistence == null ? "—" : (d.roic_persistence * 100).toFixed(0) + "%"} />
                <StatTile label="Gross margin" value={pct(d.gross_margin_median)} />
                <StatTile label="Operating margin" value={pct(d.operating_margin)} />
                <StatTile label="ROIIC (5y)" value={num(d.roiic_5y)} />
                <StatTile label="Cash conversion" value={num(d.cash_conversion)} />
              </div>

              <SectionTitle>Growth &amp; returns</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Revenue CAGR 10y" value={pct(d.revenue_cagr_10y)} />
                <StatTile label="Earnings CAGR 10y" value={pct(d.earnings_cagr_10y)} />
                <StatTile label="FCF yield" value={pct(d.fcf_yield)} />
                <StatTile label="Total payout" value={pct(d.total_payout_ratio)} />
              </div>

              <SectionTitle>Valuation &amp; balance sheet</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Market cap" value={money(d.market_cap)} />
                <StatTile label="Price" value={d.price == null ? "—" : "$" + d.price.toFixed(2)} />
                <StatTile label="P / E" value={mult(d.pe)} />
                <StatTile label="P / FCF" value={mult(d.pfcf)} />
                <StatTile label="Net cash" value={money(d.net_cash)} tone={d.net_cash == null ? undefined : d.net_cash >= 0 ? "pos" : "neg"} />
                <StatTile label="Debt / equity" value={num(d.debt_to_equity)} />
              </div>

              <div className="mt-6 rounded-lg border border-border border-l-[3px] border-l-accent bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-ink-2">
                Compounder score ranks business quality within <b>{d.sec}</b> — it does not time the
                market. Valuation is a separate axis: the <b>{d.rec}</b> call combines quality with how
                attractively {d.tk || "the company"} is currently priced.
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
    <div className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  );
}
