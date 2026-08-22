import { recClass, recShort } from "../lib/format";

// Recommendation badge. Uses color-mix for a correct soft tint of the token
// color — Tailwind's `/10` opacity can't apply to a var() color, which is why
// the old pills rendered solid.
const VAR: Record<string, string> = {
  buy: "--buy",
  watch: "--watch",
  wait: "--wait",
  pass: "--pass",
  review: "--review",
};

export default function Pill({ rec, size = "sm" }: { rec: string; size?: "sm" | "xs" }) {
  const c = recClass(rec);
  const v = `var(${VAR[c] ?? "--pass"})`;
  const pad = size === "xs" ? "px-2 py-[3px] text-[10.5px]" : "px-2.5 py-[3px] text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-semibold ${pad}`}
      style={{
        color: v,
        background: `color-mix(in srgb, ${v} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${v} 22%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v }} />
      {recShort(rec)}
    </span>
  );
}
