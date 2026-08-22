export default function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-buy" : tone === "neg" ? "text-[#c0523b]" : "text-ink";
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`tnum mt-0.5 text-[17px] font-medium ${color}`}>{value}</div>
    </div>
  );
}
