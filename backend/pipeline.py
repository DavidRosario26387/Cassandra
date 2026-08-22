"""
pipeline.py  -  the weekly recompute (no SEC)
=============================================
Runs scoring -> prices -> valuation over the *static* SEC-derived fundamentals
(company_summary.csv, company_metadata.csv) that ship with the backend. The only
live input is share price, so a weekly run keeps valuations and BUY/WATCH calls
current without ever touching EDGAR.

Outputs into DATA_DIR:
  compounder_final.csv   - full result (audit / download)
  dashboard.json         - compact payload the frontend/API serve
  status.json            - last run timestamp + summary counts

Paths are resolved relative to this file (DATA_DIR overridable via env), so it
runs identically on Windows locally and Linux on Render.
"""

import os
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

import score as S
import valuation as V

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))

SUMMARY_CSV  = DATA_DIR / "company_summary.csv"
METADATA_CSV = DATA_DIR / "company_metadata.csv"
FINAL_CSV    = DATA_DIR / "compounder_final.csv"
DASHBOARD_JSON = DATA_DIR / "dashboard.json"
STATUS_JSON  = DATA_DIR / "status.json"

MIN_YEARS = 10
CHUNK_SIZE = 120

# Compact fields the frontend needs (keep payload small).
NUM_FIELDS = {
    "compounder_score": 1, "quality_score": 1, "growth_score": 1, "durability_score": 1,
    "capital_allocation_score": 1, "financial_strength_score": 1, "valuation_score": 1,
    "price": 2, "pe": 1, "pfcf": 1, "fcf_yield": 4, "roic_median": 3, "roic_persistence": 2,
    "revenue_cagr_10y": 3, "earnings_cagr_10y": 3, "roiic_5y": 2, "gross_margin_median": 3,
    "operating_margin": 3, "net_cash": 0, "debt_to_equity": 2, "total_payout_ratio": 2,
    "market_cap": 0, "interest_coverage": 1, "cash_conversion": 2,
}


def primary_ticker(cell):
    if not isinstance(cell, str) or not cell.strip():
        return None
    return cell.split("|")[0].strip().upper().replace(".", "-") or None


# ---------------- price source (swappable) ----------------
def fetch_prices(tickers):
    """Bulk price fetch via yfinance. {ticker: price}. Failures simply absent."""
    import yfinance as yf
    out = {}
    for i in range(0, len(tickers), CHUNK_SIZE):
        chunk = tickers[i:i + CHUNK_SIZE]
        for attempt in range(3):
            try:
                df = yf.download(chunk, period="5d", interval="1d",
                                 progress=False, auto_adjust=True, threads=True)
                if df is None or df.empty:
                    raise RuntimeError("empty")
                if isinstance(df.columns, pd.MultiIndex):
                    close = df["Close"]
                    for t in close.columns:
                        s = close[t].dropna()
                        if len(s):
                            out[t] = float(s.iloc[-1])
                elif len(chunk) == 1:
                    s = df["Close"].dropna()
                    if len(s):
                        out[chunk[0]] = float(s.iloc[-1])
                break
            except Exception:
                time.sleep(1.5 * (attempt + 1))
        time.sleep(1.0)
    return out


# ---------------- the run ----------------
def run_pipeline(log=print):
    log("Loading fundamentals...")
    summary = pd.read_csv(SUMMARY_CSV)
    meta = pd.read_csv(METADATA_CSV)[
        ["cik", "sector", "sic_desc", "tickers", "exchanges", "is_listed"]
    ]
    df = summary.merge(meta, on="cik", how="left")
    df["is_listed"] = df["is_listed"].fillna(0).astype(int)
    df["company"] = df["company"].astype(str).map(lambda s: " ".join(s.split()))

    universe = df[(df.is_listed == 1) & (df.years_of_data >= MIN_YEARS)].copy()
    log(f"Universe: {len(universe):,} listed companies")

    scored = S.score_all(universe, groups=universe["sector"])
    investable = scored[scored.data_confidence != "LOW"].copy()
    log(f"Investable (HIGH/MED confidence): {len(investable):,}")

    # ---- prices ----
    investable["ticker"] = investable["tickers"].map(primary_ticker)
    tickers = sorted(set(investable["ticker"].dropna()))
    log(f"Fetching prices for {len(tickers):,} tickers...")
    prices = fetch_prices(tickers)
    log(f"Priced {len(prices):,} tickers")
    investable["price"] = investable["ticker"].map(prices)

    # ---- valuation ----
    inv = investable
    inv["market_cap"] = inv.apply(lambda r: V.market_cap(r.price, r.latest_shares), axis=1)
    inv["pe"] = inv.apply(lambda r: V.price_to_earnings(r.market_cap, r.latest_net_income), axis=1)
    inv["pfcf"] = inv.apply(lambda r: V.price_to_fcf(r.market_cap, r.latest_fcf), axis=1)
    inv["ps"] = inv.apply(lambda r: V.price_to_sales(r.market_cap, r.latest_revenue), axis=1)
    inv["pb"] = inv.apply(lambda r: V.price_to_book(r.market_cap, r.latest_equity), axis=1)
    inv["earnings_yield"] = inv.apply(lambda r: V.earnings_yield(r.latest_net_income, r.market_cap), axis=1)
    inv["fcf_yield"] = inv.apply(lambda r: V.fcf_yield(r.latest_fcf, r.market_cap), axis=1)
    inv["peg_like"] = inv.apply(lambda r: V.peg_like(r.pe, r.earnings_cagr_10y), axis=1)

    priced = inv.market_cap.notna()
    sub = inv[priced]
    g = sub["sector"]
    fy = S.percentile_rank(sub.fcf_yield, 1, groups=g).fillna(50)
    ey = S.percentile_rank(sub.earnings_yield, 1, groups=g).fillna(50)
    peg = S.percentile_rank(sub.peg_like, -1, groups=g).fillna(50)
    inv.loc[priced, "valuation_score"] = 0.5 * fy + 0.3 * ey + 0.2 * peg
    inv["recommendation"] = inv.apply(
        lambda r: V.recommendation(r.compounder_score, r.get("valuation_score")), axis=1
    )

    out = inv.sort_values("compounder_score", ascending=False, na_position="last")
    out.to_csv(FINAL_CSV, index=False)

    # ---- compact JSON payload ----
    def r(x, n):
        return None if pd.isna(x) else round(float(x), n)
    records = []
    for _, row in out.iterrows():
        d = {"co": row["company"], "tk": row.get("ticker") or "", "sec": row["sector"],
             "rec": row["recommendation"], "cf": row["data_confidence"],
             "yr": int(row["years_of_data"]) if pd.notna(row["years_of_data"]) else None}
        for c, n in NUM_FIELDS.items():
            d[c] = r(row[c], n) if c in row else None
        records.append(d)

    now = datetime.now(timezone.utc).isoformat()
    counts = out.recommendation.value_counts().to_dict()
    payload = {"updated": now, "count": len(records),
               "counts": {k: int(v) for k, v in counts.items()}, "companies": records}
    DASHBOARD_JSON.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    STATUS_JSON.write_text(json.dumps(
        {"updated": now, "count": len(records), "priced": int(priced.sum()),
         "counts": {k: int(v) for k, v in counts.items()}}, indent=2), encoding="utf-8")

    log(f"Done. {len(records):,} companies, {int(priced.sum()):,} priced. Updated {now}")
    return payload


if __name__ == "__main__":
    run_pipeline()
