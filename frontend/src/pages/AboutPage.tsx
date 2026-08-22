const PILLARS = [
  ["Quality", "ROIC, ROIIC, and margins — how much cash the business earns on the capital it uses."],
  ["Growth", "10-year revenue, earnings, FCF and book-value CAGRs."],
  ["Durability", "The moat, measured: high returns and stable margins that didn't mean-revert."],
  ["Capital Allocation", "Dilution, buybacks, dividends, and reinvestment quality."],
  ["Financial Strength", "Leverage, interest coverage, and cash conversion."],
];

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-auto px-8 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-[30px] font-medium tracking-tight">Method</h1>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-ink-2">
          Every score traces back to a reported SEC line item. Fundamentals come from EDGAR company
          facts; only share price comes from a market feed. Nothing is estimated by vibe.
        </p>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Five quality pillars
        </h2>
        <div className="mt-3 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {PILLARS.map(([name, desc]) => (
            <div key={name} className="px-5 py-4">
              <div className="font-medium">{name}</div>
              <div className="mt-1 text-[13px] leading-relaxed text-ink-2">{desc}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted">
          How the score is built
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-[13.5px] leading-relaxed text-ink-2">
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
