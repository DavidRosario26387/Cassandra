import type { CompaniesResponse } from "./types";

// No backend: the data is a static JSON file served from the site root
// (frontend/public/dashboard.json -> /dashboard.json in the build). GitHub
// Actions regenerates and commits it weekly; Render redeploys on push.
//
// VITE_API_BASE stays supported so a real API can be dropped in later (AI,
// server-side scoring) without touching call sites — empty means same-origin.
const BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  companies: () => get<CompaniesResponse>("/dashboard.json"),
  status: () => get<{ updated: string | null; count: number }>("/status.json"),
};
