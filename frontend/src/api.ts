import type { CompaniesResponse } from "./types";

// In dev, Vite proxies /api -> localhost:8000 (see vite.config.ts).
// In prod, set VITE_API_BASE to the backend URL at build time.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  companies: () => get<CompaniesResponse>("/api/companies"),
  status: () => get<{ updated: string | null; count: number }>("/api/status"),
};
