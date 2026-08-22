/** @type {import('tailwindcss').Config} */
// Colors are driven by CSS variables (see src/index.css) so light/dark are one
// source of truth. Tailwind classes like `bg-surface` resolve to the token.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        muted: "var(--muted)",
        border: "var(--border)",
        "border-2": "var(--border-2)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        buy: "var(--buy)",
        watch: "var(--watch)",
        wait: "var(--wait)",
        pass: "var(--pass)",
        review: "var(--review)",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(17,24,32,.05), 0 8px 28px rgba(17,24,32,.08)",
        drawer: "-12px 0 40px rgba(17,24,32,.16)",
      },
      borderRadius: { xl: "10px" },
    },
  },
  plugins: [],
};
