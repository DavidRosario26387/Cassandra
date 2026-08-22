import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CompaniesResponse } from "./types";
import { api } from "./api";

// Fetch the universe once and share it across every page + the drawer, instead
// of each page hitting /api/companies on its own.
interface Store {
  data: CompaniesResponse | null;
  error: string | null;
  loading: boolean;
}

const Ctx = createContext<Store>({ data: null, error: null, loading: true });

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CompaniesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .companies()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Ctx.Provider value={{ data, error, loading: !data && !error }}>{children}</Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
