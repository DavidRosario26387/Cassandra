import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Company } from "../types";
import { useData } from "../store";
import { score, mult, money, pct, recShort } from "../lib/format";
import Pill from "../components/Pill";
import Meter from "../components/Meter";
import CompanyDrawer from "../components/CompanyDrawer";

type SortKey = keyof Company;
const PE_HINT =
  "Price ÷ last full fiscal-year GAAP net income (not trailing-twelve-months). Will differ from Google/Yahoo, which use TTM diluted EPS.";
const COLUMNS: { key: SortKey; label: string; left?: boolean; sortable?: boolean; title?: string }[] = [
  { key: "co", label: "Company", left: true },
  { key: "rec", label: "Call", left: true, sortable: true },
  { key: "compounder_score", label: "Score", sortable: true },
  { key: "quality_score", label: "Qual", sortable: true },
  { key: "growth_score", label: "Grow", sortable: true },
  { key: "durability_score", label: "Dur", sortable: true },
  { key: "capital_allocation_score", label: "Cap", sortable: true },
  { key: "financial_strength_score", label: "Fin", sortable: true },
  { key: "valuation_score", label: "Val", sortable: true },
  { key: "roic_median", label: "ROIC", sortable: true },
  { key: "pe", label: "P/E (FY)", sortable: true, title: PE_HINT },
  { key: "market_cap", label: "Mkt Cap", sortable: true },
];

const REC_FILTERS = ["BUY", "WATCH", "WAIT FOR PULLBACK", "PASS (quality)"];

export default function ScreenPage() {
  const { data, error, loading } = useData();
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState("");
  const [recs, setRecs] = useState<Set<string>>(new Set());
  const [sector, setSector] = useState("All");
  const [confs, setConfs] = useState<Set<string>>(new Set());
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState<SortKey>("compounder_score");
  const [dir, setDir] = useState<-1 | 1>(-1);
  const [selected, setSelected] = useState<Company | null>(null);

  // Deep link: /screen?co=TICKER opens that company's drawer.
  const coParam = params.get("co");
  useEffect(() => {
    if (!coParam || !data) return;
    const key = coParam.toLowerCase();
    const hit = data.companies.find(
      (c) => c.tk.toLowerCase() === key || c.co.toLowerCase() === key,
    );
    if (hit) setSelected(hit);
  }, [coParam, data]);

  function closeDrawer() {
    setSelected(null);
    if (params.has("co")) {
      params.delete("co");
      setParams(params, { replace: true });
    }
  }

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
    if (sort === k) setDir((x) => (x * -1) as -1 | 1);
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

  const activeFilters =
    (q ? 1 : 0) + recs.size + (sector !== "All" ? 1 : 0) + confs.size + (minScore > 0 ? 1 : 0);

  if (error)
    return (
      <div className="grid h-full place-items-center p-10 text-center text-muted">
        <div>
          <div className="mb-1 text-ink">Could not reach the API.</div>
          <div className="text-[13px]">{error}</div>
        </div>
      </div>
    );
  if (loading) return <div className="grid h-full place-items-center text-muted">Loading screen…</div>;

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="shrink-0 border-b border-border bg-surface px-4 py-2.5 md:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter table…"
            className="w-48 rounded-md border border-border-2 bg-surface-2 px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <div className="flex gap-1">
            {REC_FILTERS.map((r) => (
              <Chip key={r} active={recs.has(r)} onClick={() => toggle(setRecs, r)}>
                {recShort(r)}
              </Chip>
            ))}
          </div>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border border-border-2 bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
          >
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {["HIGH", "MEDIUM"].map((c) => (
              <Chip key={c} active={confs.has(c)} onClick={() => toggle(setConfs, c)}>
                {c}
              </Chip>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted">
            Min score
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(+e.target.value)}
              className="w-24"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="tnum w-6 text-right font-semibold text-accent-ink">{minScore}</span>
          </label>

          <div className="ml-auto flex items-center gap-3 text-[12.5px] text-muted">
            <span>
              <b className="tnum text-ink">{rows.length.toLocaleString()}</b> of{" "}
              <span className="tnum">{(data?.count ?? 0).toLocaleString()}</span>
            </span>
            {activeFilters > 0 && (
              <button onClick={reset} className="rounded-md border border-border-2 px-2 py-1 text-[12px] text-ink-2 hover:text-ink">
                Clear {activeFilters}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[940px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && clickSort(c.key)}
                  title={c.title}
                  className={`sticky top-0 z-[1] whitespace-nowrap border-b border-border bg-surface px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted ${
                    c.left ? "text-left" : "text-right"
                  } ${c.sortable ? "cursor-pointer select-none hover:text-ink" : ""} ${
                    sort === c.key ? "text-ink" : ""
                  }`}
                >
                  {c.label}
                  {sort === c.key && <span className="ml-1 text-accent">{dir < 0 ? "▾" : "▴"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr
                key={d.tk + i}
                onClick={() => setSelected(d)}
                className={`cursor-pointer ${
                  selected === d ? "bg-accent-soft" : "hover:bg-surface-2"
                }`}
              >
                <td className="whitespace-nowrap border-b border-border px-3 py-2 text-left">
                  <div className="flex max-w-[260px] flex-col">
                    <span className="truncate font-medium text-ink">{d.co}</span>
                    <span className="text-[11px] text-muted">
                      <span className="tnum font-semibold text-accent-ink">{d.tk || "—"}</span> · {d.sec}
                    </span>
                  </div>
                </td>
                <td className="border-b border-border px-3 py-2 text-left">
                  <Pill rec={d.rec} size="xs" />
                </td>
                <td className="border-b border-border px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <Meter value={d.compounder_score} width={40} />
                    <span className="tnum w-6 text-right font-semibold text-ink">
                      {score(d.compounder_score)}
                    </span>
                  </div>
                </td>
                <Num v={score(d.quality_score)} />
                <Num v={score(d.growth_score)} />
                <Num v={score(d.durability_score)} />
                <Num v={score(d.capital_allocation_score)} />
                <Num v={score(d.financial_strength_score)} />
                <Num v={score(d.valuation_score)} />
                <Num v={pct(d.roic_median, 0)} muted />
                <Num v={mult(d.pe)} muted />
                <Num v={money(d.market_cap)} muted />
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-16 text-center text-muted">No companies match these filters.</div>
        )}
      </div>

      <CompanyDrawer company={selected} onClose={closeDrawer} />
    </div>
  );
}

function Num({ v, muted }: { v: string; muted?: boolean }) {
  return (
    <td
      className={`tnum border-b border-border px-3 py-2 text-right ${
        muted ? "text-ink-2" : "font-medium text-ink"
      }`}
    >
      {v}
    </td>
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
      className={`rounded-md border px-2 py-1 text-[12px] font-medium transition-colors ${
        active
          ? "border-accent bg-accent text-white"
          : "border-border-2 bg-surface-2 text-ink-2 hover:border-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
