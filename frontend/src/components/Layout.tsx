import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toggleTheme, isDark } from "../lib/theme";
import { useData } from "../store";
import type { Company } from "../types";
import { score } from "../lib/format";
import Pill from "./Pill";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/screen", label: "Screen", end: false },
  { to: "/lab", label: "Weight Lab", end: false },
  { to: "/about", label: "Method", end: false },
];

export default function Layout() {
  const [dark, setDark] = useState(isDark());
  const { data } = useData();

  const updated = data?.updated ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="z-20 flex h-14 shrink-0 items-center gap-5 border-b border-border bg-surface px-4 md:px-6">
        {/* brand */}
        <NavLink to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="display hidden text-[15px] leading-none text-ink sm:block">
            Compounder<span className="text-muted"> Engine</span>
          </span>
        </NavLink>

        {/* primary nav */}
        <nav className="flex items-center gap-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <GlobalSearch companies={data?.companies ?? []} />
          {updated && (
            <div className="hidden items-center gap-1.5 text-[11.5px] text-muted lg:flex">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--pos)" }} />
              <span className="tnum">
                {new Date(updated).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
          <button
            onClick={() => setDark(toggleTheme())}
            aria-label="Toggle theme"
            className="grid h-8 w-8 place-items-center rounded-md border border-border-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {dark ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function GlobalSearch({ companies }: { companies: Company[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  const matches = useMemo(() => {
    const ql = q.toLowerCase().trim();
    if (!ql) return [];
    return companies
      .filter((c) => c.co.toLowerCase().includes(ql) || c.tk.toLowerCase().includes(ql))
      .slice(0, 7);
  }, [q, companies]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(c: Company) {
    setQ("");
    setOpen(false);
    nav(`/screen?co=${encodeURIComponent(c.tk || c.co)}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border border-border-2 bg-surface-2 px-2.5 py-1.5">
        <SearchIcon />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, matches.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter" && matches[active]) go(matches[active]);
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search company or ticker…"
          className="w-36 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted md:w-52"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
          {matches.map((c, i) => (
            <button
              key={c.tk + i}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(c)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                i === active ? "bg-surface-2" : ""
              }`}
            >
              <span className="tnum w-12 shrink-0 text-[12px] font-semibold text-accent-ink">
                {c.tk || "—"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{c.co}</span>
              <span className="tnum text-[12px] font-semibold text-ink-2">
                {score(c.compounder_score)}
              </span>
              <Pill rec={c.rec} size="xs" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect width="26" height="26" rx="7" fill="var(--accent)" />
      <path
        d="M7 16.5L11 11.5L14.5 14.5L19 8.5"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="var(--muted)" strokeWidth="1.5" />
      <path d="M11 11l3.5 3.5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
