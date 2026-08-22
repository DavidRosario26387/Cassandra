import { recClass, recShort } from "../lib/format";

const STYLES: Record<string, string> = {
  buy: "bg-buy/10 text-buy",
  watch: "bg-watch/10 text-watch",
  wait: "bg-wait/10 text-wait",
  pass: "bg-pass/10 text-pass",
  review: "bg-review/10 text-review",
};
const DOT: Record<string, string> = {
  buy: "bg-buy",
  watch: "bg-watch",
  wait: "bg-wait",
  pass: "bg-pass",
  review: "bg-review",
};

export default function Pill({ rec }: { rec: string }) {
  const c = recClass(rec);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STYLES[c]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[c]}`} />
      {recShort(rec)}
    </span>
  );
}
