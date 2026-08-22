// A compact score bar: track + fill, length encodes the 0–100 value.
// Used inline in table rows and stat blocks. Color stays neutral-accent so
// semantic color (BUY/WATCH, up/down) reads elsewhere without competition.
export default function Meter({
  value,
  width = 56,
  height = 6,
  tone = "accent",
}: {
  value: number | null;
  width?: number | string;
  height?: number;
  tone?: "accent" | "wait" | "muted";
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const fill =
    tone === "wait" ? "var(--wait)" : tone === "muted" ? "var(--muted)" : "var(--accent)";
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-full align-middle"
      style={{ width, height, background: "var(--surface-3)" }}
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: `${v}%`, background: value == null ? "transparent" : fill }}
      />
    </span>
  );
}
