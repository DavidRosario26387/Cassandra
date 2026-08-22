export const score = (v: number | null) => (v == null ? "—" : v.toFixed(0));

export const pct = (v: number | null, d = 1) =>
  v == null ? "—" : (v * 100).toFixed(d) + "%";

export const mult = (v: number | null) => (v == null ? "—" : v.toFixed(1) + "×");

export const num = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));

export function money(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
  return "$" + v.toFixed(0);
}

const REC_CLASS: Record<string, string> = {
  BUY: "buy",
  WATCH: "watch",
  "WAIT FOR PULLBACK": "wait",
  "PASS (quality)": "pass",
  "REVIEW (no price)": "review",
};
export const recClass = (r: string) => REC_CLASS[r] ?? "pass";
export const recShort = (r: string) =>
  r === "WAIT FOR PULLBACK"
    ? "PULLBACK"
    : r === "PASS (quality)"
      ? "PASS"
      : r === "REVIEW (no price)"
        ? "REVIEW"
        : r;
