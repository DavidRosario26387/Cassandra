/** @type {import('tailwindcss').Config} */
// Colors resolve to CSS variables (src/index.css) so light/dark share one
// source of truth. `bg-surface`, `text-ink`, `text-buy`, etc. all map here.
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
        pos: "var(--pos)",
        neg: "var(--neg)",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      borderRadius: {
        lg: "8px",
        xl: "10px",
        "2xl": "14px",
      },
    },
  },
  plugins: [],
};
