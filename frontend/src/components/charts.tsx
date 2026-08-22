// Lightweight, dependency-free charts built from flex/SVG. Everything here is
// cross-sectional (distributions, group breakdowns) since the compact API
// payload is one row per company, not a time series.

// ---- Histogram: distribution of a numeric field across the universe --------
export function Histogram({
  values,
  bins = 10,
  min = 0,
  max = 100,
  height = 84,
  highlight,
}: {
  values: number[];
  bins?: number;
  min?: number;
  max?: number;
  height?: number;
  highlight?: number; // draw a marker line at this value (e.g. the median)
}) {
  const counts = new Array(bins).fill(0);
  const span = max - min || 1;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue;
    let i = Math.floor(((v - min) / span) * bins);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;
    counts[i] += 1;
  }
  const peak = Math.max(1, ...counts);
  const hlBin =
    highlight == null ? -1 : Math.min(bins - 1, Math.max(0, Math.floor(((highlight - min) / span) * bins)));

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {counts.map((c, i) => (
          <div key={i} className="group flex flex-1 flex-col justify-end" title={`${c} companies`}>
            <div
              className="w-full rounded-t-[3px] transition-colors"
              style={{
                height: `${Math.max(2, (c / peak) * 100)}%`,
                background: i === hlBin ? "var(--accent)" : "var(--surface-3)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span className="tnum">{min}</span>
        <span className="tnum">{Math.round((min + max) / 2)}</span>
        <span className="tnum">{max}</span>
      </div>
    </div>
  );
}

// ---- Horizontal labeled bars: sector counts, pillar scores, etc. -----------
export type HBar = { label: string; value: number; right?: string; tone?: string };

export function HBars({
  data,
  max,
  barColor = "var(--accent)",
  labelWidth = 116,
}: {
  data: HBar[];
  max?: number;
  barColor?: string;
  labelWidth?: number;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span
            className="shrink-0 truncate text-[12px] text-ink-2"
            style={{ width: labelWidth }}
            title={d.label}
          >
            {d.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(d.value / top) * 100}%`, background: d.tone ?? barColor }}
            />
          </span>
          <span className="tnum w-14 shrink-0 text-right text-[12px] font-medium text-ink">
            {d.right ?? d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
