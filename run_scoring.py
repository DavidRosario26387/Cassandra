"""
run_scoring.py
==============
Reads company_summary.csv + company_metadata.csv, defines a clean scored
universe, applies score.py (sector-relative ranking + data-confidence gate),
and writes:

  compounder_scores.csv          -> HIGH/MEDIUM confidence, ranked best-first
  compounder_scores_quarantine.csv -> LOW confidence (kept for audit, never ranked)

Universe rules (each one an anti-false-positive guard):
  - is_listed          : a real ticker on a real exchange, entityType 'operating'
  - years_of_data >=10 : enough history for 10y CAGRs and through-cycle medians

Sector-relative ranking means a bank is scored against banks, so cross-sector
accounting differences don't create phantom winners or losers.
"""

import pandas as pd

import score as S

SUMMARY_CSV   = r"C:\Users\admin\Desktop\cassandra\company_summary.csv"
METADATA_CSV  = r"C:\Users\admin\Desktop\cassandra\company_metadata.csv"
SCORES_CSV    = r"C:\Users\admin\Desktop\cassandra\compounder_scores.csv"
QUARANTINE_CSV = r"C:\Users\admin\Desktop\cassandra\compounder_scores_quarantine.csv"

MIN_YEARS = 10


def main():
    summary = pd.read_csv(SUMMARY_CSV)
    meta = pd.read_csv(METADATA_CSV)[
        ["cik", "sector", "sic_desc", "tickers", "exchanges", "is_listed"]
    ]
    df = summary.merge(meta, on="cik", how="left")
    df["is_listed"] = df["is_listed"].fillna(0).astype(int)
    # Normalize whitespace in names (SEC filings carry non-breaking spaces etc.)
    df["company"] = df["company"].astype(str).map(lambda s: " ".join(s.split()))
    print(f"Loaded {len(df):,} companies.")

    # ---- define the clean universe ----
    universe = df[(df.is_listed == 1) & (df.years_of_data >= MIN_YEARS)].copy()
    print(f"Listed, >= {MIN_YEARS}y history: {len(universe):,} companies")

    # ---- score, sector-relative + confidence-gated ----
    scored = S.score_all(universe, groups=universe["sector"])

    lead = [
        "company", "cik", "tickers", "sector", "data_confidence",
        "metrics_present", "metrics_total", "compounder_score",
        "quality_score", "growth_score", "durability_score",
        "capital_allocation_score", "financial_strength_score",
    ]
    rest = [c for c in scored.columns if c not in lead]
    scored = scored[lead + rest]

    investable = scored[scored.data_confidence != "LOW"].copy()
    quarantine = scored[scored.data_confidence == "LOW"].copy()

    investable.to_csv(SCORES_CSV, index=False)
    quarantine.to_csv(QUARANTINE_CSV, index=False)

    print(f"\n  investable (HIGH/MED): {len(investable):,}  -> {SCORES_CSV}")
    print(f"  quarantined (LOW)    : {len(quarantine):,}  -> {QUARANTINE_CSV}")
    print(f"  confidence mix: {dict(investable.data_confidence.value_counts())}")

    pd.set_option("display.width", 200, "display.float_format", lambda x: f"{x:,.1f}")
    print("\n=== TOP 25 COMPOUNDERS (HIGH/MEDIUM confidence, sector-relative) ===")
    show = ["company", "tickers", "sector", "data_confidence", "compounder_score",
            "quality_score", "growth_score", "durability_score",
            "capital_allocation_score", "financial_strength_score"]
    print(investable[show].head(25).to_string(index=False))


if __name__ == "__main__":
    main()
