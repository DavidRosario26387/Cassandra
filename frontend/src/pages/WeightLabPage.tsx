const PILLARS = [
  ["Quality", 25],
  ["Growth", 20],
  ["Durability", 20],
  ["Capital Allocation", 15],
  ["Financial Strength", 10],
] as const;

export default function WeightLabPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="display text-[24px] text-ink">Weight Lab</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
          Tune the pillar weights and watch the entire universe re-rank live. The engine recomputes
          the composite from cached scores instantly — no data fetch. This page is next on the build
          list; the default weights it starts from are shown below.
        </p>

        <div className="mt-8 flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-card">
          {PILLARS.map(([name, w]) => (
            <div key={name} className="grid grid-cols-[170px_1fr_44px] items-center gap-4">
              <span className="text-[13.5px] text-ink-2">{name}</span>
              <span className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                <span className="block h-full rounded-full bg-accent" style={{ width: `${w * 4}%` }} />
              </span>
              <span className="tnum text-right text-[13px] font-semibold text-accent-ink">{w}%</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface-2 px-5 py-4 text-[13px] leading-relaxed text-ink-2">
          Valuation stays a separate axis — it decides <b className="text-ink">when</b> to buy, not{" "}
          <b className="text-ink">whether</b> a company is a compounder — so it isn't part of these
          weights.
        </div>
      </div>
    </div>
  );
}
