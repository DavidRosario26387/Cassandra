import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../store";
import type { Company } from "../types";
import { score, pct, mult } from "../lib/format";
import Card from "../components/Card";
import Meter from "../components/Meter";
import Pill from "../components/Pill";
import { Histogram, HBars } from "../components/charts";

const TONE: Record<string, string> = {
  BUY: "var(--buy)",
  WATCH: "var(--watch)",
  "WAIT FOR PULLBACK": "var(--wait)",
  "PASS (quality)": "var(--pass)",
};

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function OverviewPage() {
  const { data, error, loading } = useData();
  const nav = useNavigate();
  const open = (c: Company) => nav(`/screen?co=${encodeURIComponent(c.tk || c.co)}`);

  const d = useMemo(() => {
    const rows = data?.companies ?? [];
    const scored = rows.filter((r) => r.compounder_score != null);
    const scores = scored.map((r) => r.compounder_score as number);

    const byScore = [...scored].sort((a, b) => (b.compounder_score ?? 0) - (a.compounder_score ?? 0));
    const byQuality = [...rows]
      .filter((r) => r.quality_score != null)
      .sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
    const value = rows
      .filter((r) => r.rec === "BUY" && r.valuation_score != null)
      .sort((a, b) => (b.valuation_score ?? 0) - (a.valuation_score ?? 0));

    // median compounder score per sector, sectors with enough names
    const bySec = new Map<string, number[]>();
    for (const r of scored) {
      if (!bySec.has(r.sec)) bySec.set(r.sec, []);
      bySec.get(r.sec)!.push(r.compounder_score as number);
    }
    const sectors = [...bySec.entries()]
      .filter(([, v]) => v.length >= 8)
      .map(([label, v]) => ({ label, value: Math.round(median(v)), right: `${Math.round(median(v))}`, n: v.length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      total: data?.count ?? 0,
      counts: data?.counts ?? {},
      medianScore: Math.round(median(scores)),
      sectorCount: bySec.size,
      scores,
      top: byScore.slice(0, 8),
      quality: byQuality.slice(0, 6),
      value: value.slice(0, 6),
      sectors,
    };
  }, [data]);

  if (error)
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <div className="mb-1 font-semibold text-ink">Could not reach the API.</div>
          <div className="text-[13px] text-muted">{error}</div>
          <div className="mt-3 text-[12px] text-muted">
            Set <code className="rounded bg-surface-2 px-1">VITE_API_BASE</code> to your backend URL.
          </div>
        </div>
      </div>
    );
  if (loading)
    return <div className="grid h-full place-items-center text-muted">Loading the universe…</div>;

  const recSplit = ["BUY", "WATCH", "WAIT FOR PULLBACK", "PASS (quality)"]
    .map((k) => ({ label: k, value: d.counts[k] ?? 0, tone: TONE[k] }))
    .filter((x) => x.value > 0);

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-8">
      {/* heading */}
      <div className="mb-5">
        <h1 className="display text-[22px] text-ink">Market overview</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          {d.total.toLocaleString()} US-listed companies scored on six pillars of business quality,
          overlaid with live valuation.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Kpi label="Universe" value={d.total.toLocaleString()} sub="scored companies" />
        <Kpi label="Buy" value={String(d.counts["BUY"] ?? 0)} sub="quality + value" tone="var(--buy)" />
        <Kpi label="Watch" value={String(d.counts["WATCH"] ?? 0)} sub="great, not cheap" tone="var(--watch)" />
        <Kpi label="Median score" value={String(d.medianScore)} sub="composite / 100" />
        <Kpi label="Sectors" value={String(d.sectorCount)} sub="peer groups" className="col-span-2 md:col-span-1" />
      </div>

      {/* main grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* top compounders — spans 2 */}
        <Card
          title="Top compounders"
          subtitle="Highest composite score across the universe"
          right={<LinkAll onClick={() => nav("/screen")} />}
          className="lg:col-span-2"
          bodyClass="p-2"
        >
          <RankList rows={d.top} onOpen={open} metric="score" />
        </Card>

        {/* distribution + rec split */}
        <div className="flex flex-col gap-4">
          <Card title="Score distribution" subtitle={`Median ${d.medianScore}`}>
            <Histogram values={d.scores} highlight={d.medianScore} />
          </Card>
          <Card title="Recommendations" bodyClass="px-4 py-4">
            <StackBar segments={recSplit} total={d.total} />
            <div className="mt-3">
              <HBars
                data={recSplit.map((r) => ({ label: shortRec(r.label), value: r.value, tone: r.tone }))}
                labelWidth={92}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* secondary grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Best value"
          subtitle="BUY-rated, ranked by valuation score"
          bodyClass="p-2"
        >
          <RankList rows={d.value} onOpen={open} metric="pe" />
        </Card>
        <Card title="Highest quality" subtitle="Top ROIC & margin franchises" bodyClass="p-2">
          <RankList rows={d.quality} onOpen={open} metric="roic" />
        </Card>
        <Card title="Sector strength" subtitle="Median composite score by sector">
          <HBars data={d.sectors} max={100} />
        </Card>
      </div>
    </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function Kpi({
  label,
  value,
  sub,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface px-4 py-3 shadow-card ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        {tone && <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />}
        {label}
      </div>
      <div className="tnum mt-1 text-[26px] font-semibold leading-none text-ink" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

function RankList({
  rows,
  onOpen,
  metric,
}: {
  rows: Company[];
  onOpen: (c: Company) => void;
  metric: "score" | "pe" | "roic";
}) {
  if (!rows.length)
    return <div className="px-3 py-6 text-center text-[13px] text-muted">No companies.</div>;
  return (
    <ol className="flex flex-col">
      {rows.map((c, i) => (
        <li key={c.tk + i}>
          <button
            onClick={() => onOpen(c)}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <span className="tnum w-4 shrink-0 text-right text-[12px] text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{c.co}</span>
              <span className="tnum text-[11.5px] font-semibold text-accent-ink">{c.tk || "—"}</span>
              <span className="text-[11.5px] text-muted"> · {c.sec}</span>
            </span>
            <MetricCell c={c} metric={metric} />
            <span className="hidden sm:block">
              <Pill rec={c.rec} size="xs" />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function MetricCell({ c, metric }: { c: Company; metric: "score" | "pe" | "roic" }) {
  if (metric === "pe")
    return (
      <span
        className="tnum w-16 shrink-0 text-right text-[13px] font-semibold text-ink"
        title="Price ÷ last full fiscal-year GAAP net income (not TTM)"
      >
        {mult(c.pe)}
        <span className="block text-[10px] font-normal text-muted">P/E (FY)</span>
      </span>
    );
  if (metric === "roic")
    return (
      <span className="tnum w-16 shrink-0 text-right text-[13px] font-semibold text-ink">
        {pct(c.roic_median, 0)}
        <span className="block text-[10px] font-normal text-muted">ROIC</span>
      </span>
    );
  return (
    <span className="flex shrink-0 items-center gap-2">
      <Meter value={c.compounder_score} width={44} />
      <span className="tnum w-6 text-right text-[13px] font-semibold text-ink">
        {score(c.compounder_score)}
      </span>
    </span>
  );
}

function StackBar({ segments, total }: { segments: { label: string; value: number; tone: string }[]; total: number }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      {segments.map((s) => (
        <span
          key={s.label}
          title={`${s.label}: ${s.value}`}
          style={{ width: `${(s.value / (total || 1)) * 100}%`, background: s.tone }}
        />
      ))}
    </div>
  );
}

function LinkAll({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[12px] font-medium text-accent-ink hover:underline">
      View all →
    </button>
  );
}

function shortRec(r: string) {
  return r === "WAIT FOR PULLBACK" ? "Pullback" : r === "PASS (quality)" ? "Pass" : r === "BUY" ? "Buy" : "Watch";
}
