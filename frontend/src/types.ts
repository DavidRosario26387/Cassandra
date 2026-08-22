export interface Company {
  co: string;               // company name
  tk: string;               // ticker
  sec: string;              // sector
  rec: string;              // recommendation
  cf: string;               // data confidence (HIGH/MEDIUM)
  yr: number | null;        // years of data
  compounder_score: number | null;
  quality_score: number | null;
  growth_score: number | null;
  durability_score: number | null;
  capital_allocation_score: number | null;
  financial_strength_score: number | null;
  valuation_score: number | null;
  price: number | null;
  pe: number | null;
  pfcf: number | null;
  fcf_yield: number | null;
  roic_median: number | null;
  roic_persistence: number | null;
  revenue_cagr_10y: number | null;
  earnings_cagr_10y: number | null;
  roiic_5y: number | null;
  gross_margin_median: number | null;
  operating_margin: number | null;
  net_cash: number | null;
  debt_to_equity: number | null;
  total_payout_ratio: number | null;
  market_cap: number | null;
  interest_coverage: number | null;
  cash_conversion: number | null;
}

export interface CompaniesResponse {
  updated: string;
  count: number;
  counts: Record<string, number>;
  companies: Company[];
}

export type PillarKey =
  | "quality_score"
  | "growth_score"
  | "durability_score"
  | "capital_allocation_score"
  | "financial_strength_score";
