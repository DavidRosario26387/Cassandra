import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { toggleTheme, isDark } from "../lib/theme";
import { api } from "../api";

const NAV = [
  { to: "/", label: "Screen", end: true, icon: "▦" },
  { to: "/lab", label: "Weight Lab", end: false, icon: "◈" },
  { to: "/about", label: "Method", end: false, icon: "◇" },
];

export default function Layout() {
  const [dark, setDark] = useState(isDark());
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    api
      .status()
      .then((s) => setUpdated(s.updated))
      .catch(() => setUpdated(null));
  }, []);

  return (
    <div className="grid h-screen grid-cols-[232px_1fr] overflow-hidden">
      <aside className="flex flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-6 py-6">
          <div className="font-display text-[22px] font-medium leading-none tracking-tight">
            Compounder
            <br />
            Engine
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">
            Quality compounder screen
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                  isActive
                    ? "bg-accent-soft font-medium text-accent-ink"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`
              }
            >
              <span className="text-[15px] opacity-70">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-border px-6 py-4">
          <button
            onClick={() => setDark(toggleTheme())}
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-[13px] text-ink-2 hover:text-ink"
          >
            <span>{dark ? "Dark" : "Light"} theme</span>
            <span>{dark ? "☾" : "☀"}</span>
          </button>
          <div className="text-[10.5px] leading-relaxed text-muted">
            {updated ? (
              <>
                Data updated
                <br />
                <span className="tnum text-ink-2">
                  {new Date(updated).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            ) : (
              "Connecting to API…"
            )}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
