const PILLARS = [
  ["Quality", "ROIC, ROIIC, and margins — how much cash the business earns on the capital it uses."],
  ["Growth", "10-year revenue, earnings, FCF and book-value CAGRs."],
  ["Durability", "The moat, measured: high returns and stable margins that didn't mean-revert."],
  ["Capital Allocation", "Dilution, buybacks, dividends, and reinvestment quality."],
  ["Financial Strength", "Leverage, interest coverage, and cash conversion."],
];

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="display text-[24px] text-ink">Method</h1>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-ink-2">
          Every score traces back to a reported SEC line item. Fundamentals come from EDGAR company
          facts; only share price comes from a market feed. Nothing is estimated by vibe.
        </p>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Five quality pillars
        </h2>
        <div className="mt-3 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {PILLARS.map(([name, desc]) => (
            <div key={name} className="px-5 py-4">
              <div className="font-semibold text-ink">{name}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-ink-2">{desc}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wide text-muted">
          How the score is built
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
          <li>
            <b className="text-ink">Sector-relative.</b> Each metric is a percentile rank within the
            company's sector — a bank is judged against banks.
          </li>
          <li>
            <b className="text-ink">Confidence-gated.</b> Companies we lack data on are quarantined,
            never scored. No confident number is built on missing inputs.
          </li>
          <li>
            <b className="text-ink">Valuation is separate.</b> It decides when a great business is
            attractively priced — not whether it's great.
          </li>
        </ul>
      </div>
    </div>
  );
}
