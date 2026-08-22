export default function Meter({
  value,
  width = 52,
  tone = "accent",
}: {
  value: number | null;
  width?: number;
  tone?: "accent" | "wait";
}) {
  const v = value ?? 0;
  const fill = tone === "wait" ? "var(--wait)" : "var(--accent)";
  return (
    <span
      className="inline-block overflow-hidden rounded"
      style={{ width, height: 6, background: "var(--surface-3)" }}
    >
      <span
        className="block h-full rounded transition-[width] duration-500"
        style={{ width: `${v}%`, background: fill }}
      />
    </span>
  );
}
