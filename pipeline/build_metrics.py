"""
build_metrics.py
================
Reads master_financials.csv (raw SEC line items) and applies the pure functions
in metrics.py to produce:

  1. derived_annual.csv   -> one row per company-year with point-in-time ratios
                             (margins, ROIC, ROCE, ROE, net cash, coverage, ...)
  2. company_summary.csv  -> one row per company: latest-year snapshot + medians
                             + CAGRs (revenue/EPS/FCF/BVPS) + ROIIC.

The summary table is the object the scoring engine will rank on.
"""

import pandas as pd

import metrics as M

RAW_CSV     = r"C:\Users\admin\Desktop\cassandra\master_financials.csv"
ANNUAL_CSV  = r"C:\Users\admin\Desktop\cassandra\derived_annual.csv"
SUMMARY_CSV = r"C:\Users\admin\Desktop\cassandra\company_summary.csv"


# ============================================================
# PER-YEAR (point-in-time) DERIVED COLUMNS
# ============================================================

def add_annual_metrics(df):
    """Add point-in-time ratio columns, one value per company-year row."""

    def col(fn):
        """Apply a row-wise function returning None/float -> a Series."""
        return df.apply(fn, axis=1)

    df["fcf"] = col(lambda r: M.fcf(r.operating_cash_flow, r.capex))
    df["total_debt"] = col(lambda r: M.total_debt(r.short_term_debt, r.long_term_debt))
    df["capital_employed"] = col(lambda r: M.capital_employed(r.total_assets, r.current_liabilities))
    df["invested_capital"] = col(lambda r: M.invested_capital(r.total_assets, r.current_liabilities, r.cash))
    df["tax_rate"] = col(lambda r: M.effective_tax_rate(r.income_tax_expense, r.net_income))
    df["nopat"] = col(lambda r: M.nopat(r.operating_income, r.tax_rate))

    df["gross_margin"] = col(lambda r: M.gross_margin(r.gross_profit, r.revenue))
    df["operating_margin"] = col(lambda r: M.operating_margin(r.operating_income, r.revenue))
    df["net_margin"] = col(lambda r: M.net_margin(r.net_income, r.revenue))
    df["fcf_margin"] = col(lambda r: M.fcf_margin(r.fcf, r.revenue))

    df["roic"] = col(lambda r: M.roic(r.operating_income, r.tax_rate, r.invested_capital))
    df["roce"] = col(lambda r: M.roce(r.operating_income, r.capital_employed))
    df["roe"] = col(lambda r: M.roe(r.net_income, r.equity))

    df["net_cash"] = col(lambda r: M.net_cash(r.cash, r.total_debt))
    df["debt_to_equity"] = col(lambda r: M.debt_to_equity(r.total_debt, r.equity))
    df["interest_coverage"] = col(lambda r: M.interest_coverage(r.operating_income, r.interest_expense))
    df["cash_conversion"] = col(lambda r: M.cash_conversion(r.fcf, r.net_income))
    df["bvps"] = col(lambda r: M.bvps(r.equity, r.shares_outstanding))
    return df


# ============================================================
# PER-COMPANY (series) SUMMARY
# ============================================================

def _series(sub, field):
    """{year: value} for one company, dropping missing values."""
    return {int(y): v for y, v in zip(sub.year, sub[field]) if pd.notna(v)}


def summarize_company(sub):
    """Collapse one company's annual history into a single summary row."""
    sub = sub.sort_values("year")

    # Snapshot the latest year that actually has revenue. The most recent row is
    # often a cover-page-only stub (shares filed, financials not yet), which
    # would otherwise make every snapshot metric NaN.
    complete = sub[sub.revenue.notna()]
    latest = complete.iloc[-1] if len(complete) else sub.iloc[-1]

    def med(field):
        s = sub[field].dropna()
        return float(s.median()) if len(s) else None

    # ---- capital-allocation inputs ----
    # Denominator: cumulative net income over profitable years (avoids negatives
    # distorting payout ratios).
    ni_pos = sub.net_income[sub.net_income > 0].sum()
    buyback_sum = sub.stock_repurchases.fillna(0).sum()
    div_sum = sub.dividends_paid.fillna(0).sum()

    # Dilution: CAGR of diluted share count (negative = net buybacks = good).
    shares_series = _series(sub, "diluted_shares") or _series(sub, "shares_outstanding")

    # Earnings growth: prefer EPS CAGR, fall back to net-income CAGR when EPS
    # CAGR is undefined (negative earnings years break it).
    eps_cagr = M.series_cagr(_series(sub, "eps_diluted"), 10)
    ni_cagr = M.series_cagr(_series(sub, "net_income"), 10)
    earnings_cagr = eps_cagr if eps_cagr is not None else ni_cagr

    # Normalize whitespace (SEC names sometimes carry non-breaking spaces).
    company_name = " ".join(str(latest.company).split())

    row = {
        "cik": int(latest.cik),
        "company": company_name,
        "years_of_data": int(sub.revenue.notna().sum()),
        "latest_year": int(latest.year),

        # ---- latest-year snapshot (quality + strength) ----
        # ---- latest raw fundamentals (for valuation: market cap / these) ----
        "latest_revenue": latest.revenue,
        "latest_net_income": latest.net_income,
        "latest_fcf": latest.fcf,
        "latest_equity": latest.equity,
        # share count: prefer period-end shares, fall back to diluted weighted avg
        "latest_shares": latest.shares_outstanding if pd.notna(latest.shares_outstanding) else latest.diluted_shares,

        "roic": latest.roic,
        "roce": latest.roce,
        "roe": latest.roe,
        "gross_margin": latest.gross_margin,
        "operating_margin": latest.operating_margin,
        "fcf_margin": latest.fcf_margin,
        "net_cash": latest.net_cash,
        "debt_to_equity": latest.debt_to_equity,
        "interest_coverage": latest.interest_coverage,
        "cash_conversion": latest.cash_conversion,

        # ---- through-cycle medians (durability of the numbers) ----
        "roic_median": med("roic"),
        "operating_margin_median": med("operating_margin"),
        "fcf_margin_median": med("fcf_margin"),

        # ---- growth (10y CAGRs) ----
        "revenue_cagr_10y": M.series_cagr(_series(sub, "revenue"), 10),
        "eps_cagr_10y": eps_cagr,
        "earnings_cagr_10y": earnings_cagr,   # EPS CAGR, or NI CAGR fallback
        "fcf_cagr_10y": M.series_cagr(_series(sub, "fcf"), 10),
        "bvps_cagr_10y": M.series_cagr(_series(sub, "bvps"), 10),

        # ---- reinvestment quality ----
        "roiic_5y": M.roiic(_series(sub, "nopat"), _series(sub, "invested_capital"), 5),

        # ---- durability (the quantitative moat signature) ----
        "roic_persistence": M.persistence(_series(sub, "roic"), 0.15),          # sustained high returns
        "operating_margin_stability": M.stability(_series(sub, "operating_margin")),  # pricing power
        "gross_margin_median": med("gross_margin"),                              # brand / switching (level)
        "revenue_down_years": M.down_years_fraction(_series(sub, "revenue")),    # demand steadiness (lower better)
        "revenue_max_drawdown": M.max_drawdown(_series(sub, "revenue")),         # worst decline (0 best)

        # ---- capital allocation ----
        "shares_cagr_10y": M.series_cagr(shares_series, 10),   # lower = better
        "buyback_ratio": M.safe_div(buyback_sum, ni_pos),
        "dividend_ratio": M.safe_div(div_sum, ni_pos),
        "total_payout_ratio": M.safe_div(buyback_sum + div_sum, ni_pos),
    }
    return row


# ============================================================
# MAIN
# ============================================================

def main():
    print("Loading raw financials...")
    df = pd.read_csv(RAW_CSV)
    print(f"  {len(df):,} rows, {df.cik.nunique():,} companies")

    print("Computing per-year derived metrics...")
    df = add_annual_metrics(df)
    df.to_csv(ANNUAL_CSV, index=False)
    print(f"  -> {ANNUAL_CSV}")

    print("Building per-company summary...")
    rows = [summarize_company(sub) for _, sub in df.groupby("cik", sort=False)]
    summary_df = pd.DataFrame(rows)
    summary_df = summary_df.sort_values("roic_median", ascending=False, na_position="last")
    summary_df.to_csv(SUMMARY_CSV, index=False)
    print(f"  -> {SUMMARY_CSV}  ({len(summary_df):,} companies)")

    print("\nDone.")


if __name__ == "__main__":
    main()
