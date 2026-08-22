import { useEffect, useMemo, useState } from "react";
import type { Company, CompaniesResponse } from "../types";
import { api } from "../api";
import { score, mult, money, recShort } from "../lib/format";
import Pill from "../components/Pill";
import Meter from "../components/Meter";
import CompanyDrawer from "../components/CompanyDrawer";

type SortKey = keyof Company;
const COLUMNS: { key: SortKey; label: string; left?: boolean; sortable?: boolean }[] = [
  { key: "co", label: "Company", left: true },
  { key: "rec", label: "Call", left: true, sortable: true },
  { key: "compounder_score", label: "Score", sortable: true },
  { key: "quality_score", label: "Qual", sortable: true },
  { key: "growth_score", label: "Grow", sortable: true },
  { key: "durability_score", label: "Dur", sortable: true },
  { key: "capital_allocation_score", label: "Cap", sortable: true },
  { key: "financial_strength_score", label: "Fin", sortable: true },
  { key: "valuation_score", label: "Val", sortable: true },
  { key: "pe", label: "P/E", sortable: true },
  { key: "market_cap", label: "Mkt Cap", sortable: true },
];

const REC_FILTERS = ["BUY", "WATCH", "WAIT FOR PULLBACK", "PASS (quality)"];

export default function ScreenPage() {
  const [data, setData] = useState<CompaniesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [recs, setRecs] = useState<Set<string>>(new Set());
  const [sector, setSector] = useState("All");
  const [confs, setConfs] = useState<Set<string>>(new Set());
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<SortKey>("compounder_score");
  const [dir, setDir] = useState<-1 | 1>(-1);
  const [selected, setSelected] = useState<Company | null>(null);

  useEffect(() => {
    api.companies().then(setData).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const sectors = useMemo(
    () => ["All", ...[...new Set((data?.companies ?? []).map((d) => d.sec))].sort()],
    [data],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const ql = q.toLowerCase().trim();
    let r = data.companies.filter((d) => {
      if (ql && !(d.co.toLowerCase().includes(ql) || d.tk.toLowerCase().includes(ql))) return false;
      if (recs.size && !recs.has(d.rec)) return false;
      if (sector !== "All" && d.sec !== sector) return false;
      if (confs.size && !confs.has(d.cf)) return false;
      if (minScore > 0 && (d.compounder_score == null || d.compounder_score < minScore)) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      if (sort === "co") return dir * a.co.localeCompare(b.co);
      const x = a[sort] as number | null;
      const y = b[sort] as number | null;
      if (x == null) return 1;
      if (y == null) return -1;
      return dir * ((x as number) - (y as number));
    });
    return r;
  }, [data, q, recs, sector, confs, minScore, sort, dir]);

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) {
    setter((prev) => {
      const n = new Set(prev);
      n.has(v) ? n.delete(v) : n.add(v);
      return n;
    });
  }
  function clickSort(k: SortKey) {
    if (sort === k) setDir((d) => (d * -1) as -1 | 1);
    else {
      setSort(k);
      setDir(-1);
    }
  }
  function reset() {
    setQ("");
    setRecs(new Set());
    setSector("All");
    setConfs(new Set());
    setMinScore(0);
  }

  if (error)
    return (
      <div className="grid flex-1 place-items-center p-10 text-center text-muted">
        <div>
          <div className="mb-2 text-ink">Could not reach the API.</div>
          <div className="text-[13px]">{error}</div>
          <div className="mt-3 text-[12px]">Set <code>VITE_API_BASE</code> to your backend URL.</div>
        </div>
      </div>
    );
  if (!data)
    return <div className="grid flex-1 place-items-center text-muted">Loading screen…</div>;

  const buy = data.counts["BUY"] ?? 0;
  const watch = data.counts["WATCH"] ?? 0;

  return (
    <>
      {/* summary strip */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-4">
        <Tile label="Universe" value={String(data.count)} />
        <Tile label="Sectors" value={String(sectors.length - 1)} />
        <Tile label="Buy" value={String(buy)} tone="buy" />
        <Tile label="Watch" value={String(watch)} tone="watch" />
        <div className="ml-auto text-[13px] text-ink-2">
          <b className="tnum text-ink">{rows.length}</b> shown
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company or ticker…"
          className="w-56 rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <div className="flex gap-1.5">
          {REC_FILTERS.map((r) => (
            <Chip key={r} active={recs.has(r)} onClick={() => toggle(setRecs, r)}>
              {recShort(r)}
            </Chip>
          ))}
        </div>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-accent"
        >
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {["HIGH", "MEDIUM"].map((c) => (
            <Chip key={c} active={confs.has(c)} onClick={() => toggle(setConfs, c)}>
              {c}
            </Chip>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px] text-ink-2">
          Min score
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(+e.target.value)}
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="tnum w-6 text-right font-semibold text-accent-ink">{minScore}</span>
        </label>
        <button
          onClick={reset}
          className="rounded-lg border border-border-2 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink"
        >
          Reset
        </button>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && clickSort(c.key)}
                  className={`sticky top-0 z-[1] whitespace-nowrap border-b border-border-2 bg-surface px-3.5 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted ${
                    c.left ? "text-left" : "text-right"
                  } ${c.sortable ? "cursor-pointer hover:text-ink" : ""}`}
                >
                  {c.label}
                  {sort === c.key && <span className="ml-1 text-accent">{dir < 0 ? "▼" : "▲"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr
                key={d.tk + i}
                onClick={() => setSelected(d)}
                className={`cursor-pointer ${selected === d ? "bg-accent-soft" : "hover:bg-surface-2"}`}
              >
                <td className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left">
                  <div className="flex max-w-[240px] flex-col">
                    <span className="truncate font-medium">{d.co}</span>
                    <span className="text-[11px] text-muted">
                      <span className="tnum font-semibold text-accent-ink">{d.tk || "—"}</span> · {d.sec}
                    </span>
                  </div>
                </td>
                <td className="border-b border-border px-3.5 py-2.5 text-left">
                  <Pill rec={d.rec} />
                </td>
                <td className="border-b border-border px-3.5 py-2.5">
                  <div className="flex items-center justify-end gap-2.5">
                    <span className="tnum text-[14px] font-semibold">{score(d.compounder_score)}</span>
                    <Meter value={d.compounder_score} />
                  </div>
                </td>
                <Num v={score(d.quality_score)} />
                <Num v={score(d.growth_score)} />
                <Num v={score(d.durability_score)} />
                <Num v={score(d.capital_allocation_score)} />
                <Num v={score(d.financial_strength_score)} />
                <Num v={score(d.valuation_score)} />
                <Num v={mult(d.pe)} />
                <Num v={money(d.market_cap)} />
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-16 text-center text-muted">No companies match these filters.</div>
        )}
      </div>

      <CompanyDrawer company={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function Num({ v }: { v: string }) {
  return <td className="tnum border-b border-border px-3.5 py-2.5 text-right">{v}</td>;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "buy" | "watch" }) {
  const color = tone === "buy" ? "text-buy" : tone === "watch" ? "text-watch" : "text-ink";
  const strip = tone === "buy" ? "bg-buy" : tone === "watch" ? "bg-watch" : "bg-accent";
  return (
    <div className="relative rounded-xl border border-border bg-surface-2 px-3.5 py-2 pl-4">
      <span className={`absolute bottom-2 left-0 top-2 w-[3px] rounded ${strip}`} />
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`tnum text-[20px] font-medium leading-tight ${color}`}>{value}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-border-2 bg-surface-2 text-ink-2 hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}
