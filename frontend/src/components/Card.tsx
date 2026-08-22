import type { ReactNode } from "react";

// The one card primitive every panel is built from: hairline border, subtle
// elevation, optional header row with a title and a right-aligned action slot.
export default function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClass = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-xl border border-border bg-surface shadow-card ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
            )}
            {subtitle && <p className="truncate text-[11.5px] text-muted">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={`min-w-0 flex-1 ${bodyClass || "p-4"}`}>{children}</div>
    </section>
  );
}
