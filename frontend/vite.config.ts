import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pure static app. Data is served as /dashboard.json from the public/ folder
// (dev and prod alike) — no backend, so no dev proxy needed.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
