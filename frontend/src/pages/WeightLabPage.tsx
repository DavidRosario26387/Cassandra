const PILLARS = [
  ["Quality", 25],
  ["Growth", 20],
  ["Durability", 20],
  ["Capital Allocation", 15],
  ["Financial Strength", 10],
] as const;

export default function WeightLabPage() {
  return (
    <div className="flex-1 overflow-auto px-8 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-[30px] font-medium tracking-tight">Weight Lab</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
          Tune the pillar weights and watch the entire universe re-rank live. The engine recomputes
          the composite from cached scores instantly — no waiting, no data fetch. This page is next
          on the build list; the default weights it will start from are shown below.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {PILLARS.map(([name, w]) => (
            <div key={name} className="grid grid-cols-[170px_1fr_44px] items-center gap-4">
              <span className="text-[13.5px] text-ink-2">{name}</span>
              <span className="h-2 overflow-hidden rounded" style={{ background: "var(--surface-3)" }}>
                <span className="block h-full rounded bg-accent" style={{ width: `${w * 4}%` }} />
              </span>
              <span className="tnum text-right text-[13px] font-semibold text-accent-ink">{w}%</span>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border border-l-[3px] border-l-accent bg-surface-2 px-5 py-4 text-[13px] leading-relaxed text-ink-2">
          Valuation stays a separate axis — it decides <b>when</b> to buy, not <b>whether</b> a company
          is a compounder — so it isn't part of these weights.
        </div>
      </div>
    </div>
  );
}
