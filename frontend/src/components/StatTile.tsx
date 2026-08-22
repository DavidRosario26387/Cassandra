// A single labeled metric. `tone` colors the value for directional figures
// (net cash, margins) where up/down carries meaning.
export default function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  hint?: string;
}) {
  const color = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-ink";
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-muted">
        {label}
        {hint && <span title={hint} className="cursor-help opacity-60">ⓘ</span>}
      </div>
      <div className={`tnum mt-1 text-[16px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}
