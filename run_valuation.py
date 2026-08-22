"""
run_valuation.py
================
Joins prices (prices_cache.csv) onto the scored universe (compounder_scores.csv),
derives market cap from SEC share counts, computes valuation multiples/yields and
a sector-relative valuation score, and emits a final ranked table with a plain
BUY / WATCH / WAIT FOR PULLBACK recommendation.

Valuation never alters the compounder (quality) score - it's a second axis. A
company with no usable price is still shown, flagged 'REVIEW (no price)', never
dropped or penalised.
"""

import pandas as pd

import score as S
import valuation as V
from fetch_prices import primary_ticker

SCORES_CSV = r"C:\Users\admin\Desktop\cassandra\compounder_scores.csv"
PRICES_CSV = r"C:\Users\admin\Desktop\cassandra\prices_cache.csv"
OUTPUT_CSV = r"C:\Users\admin\Desktop\cassandra\compounder_final.csv"


def main():
    df = pd.read_csv(SCORES_CSV)
    prices = pd.read_csv(PRICES_CSV)
    prices = prices[prices.status == "ok"][["ticker", "price"]]

    df["ticker"] = df["tickers"].map(primary_ticker)
    df = df.merge(prices, on="ticker", how="left")
    priced = df.price.notna().sum()
    print(f"{len(df):,} companies; {priced:,} have a live price.")

    # ---- market cap from SEC shares, then multiples/yields ----
    df["market_cap"] = df.apply(lambda r: V.market_cap(r.price, r.latest_shares), axis=1)
    df["pe"] = df.apply(lambda r: V.price_to_earnings(r.market_cap, r.latest_net_income), axis=1)
    df["pfcf"] = df.apply(lambda r: V.price_to_fcf(r.market_cap, r.latest_fcf), axis=1)
    df["ps"] = df.apply(lambda r: V.price_to_sales(r.market_cap, r.latest_revenue), axis=1)
    df["pb"] = df.apply(lambda r: V.price_to_book(r.market_cap, r.latest_equity), axis=1)
    df["earnings_yield"] = df.apply(lambda r: V.earnings_yield(r.latest_net_income, r.market_cap), axis=1)
    df["fcf_yield"] = df.apply(lambda r: V.fcf_yield(r.latest_fcf, r.market_cap), axis=1)
    df["peg_like"] = df.apply(lambda r: V.peg_like(r.pe, r.earnings_cagr_10y), axis=1)

    # ---- valuation score (only among priced companies; sector-relative) ----
    priced_mask = df.market_cap.notna()
    sub = df[priced_mask]
    groups = sub["sector"]
    fy = S.percentile_rank(sub.fcf_yield, 1, groups=groups).fillna(50)      # higher yield = cheaper
    ey = S.percentile_rank(sub.earnings_yield, 1, groups=groups).fillna(50)
    peg = S.percentile_rank(sub.peg_like, -1, groups=groups).fillna(50)     # lower PEG = cheaper
    val = 0.5 * fy + 0.3 * ey + 0.2 * peg
    df.loc[priced_mask, "valuation_score"] = val

    # ---- recommendation from quality + valuation ----
    df["recommendation"] = df.apply(
        lambda r: V.recommendation(r.compounder_score, r.get("valuation_score")), axis=1
    )

    lead = [
        "company", "ticker", "sector", "recommendation",
        "compounder_score", "valuation_score", "data_confidence",
        "price", "market_cap", "pe", "pfcf", "fcf_yield",
        "quality_score", "growth_score",
        "capital_allocation_score", "financial_strength_score",
    ]
    rest = [c for c in df.columns if c not in lead]
    out = df[lead + rest].sort_values("compounder_score", ascending=False, na_position="last")
    out.to_csv(OUTPUT_CSV, index=False)
    print(f"-> {OUTPUT_CSV}")

    print("\nRecommendation mix:")
    print(out.recommendation.value_counts().to_string())

    pd.set_option("display.width", 220, "display.float_format", lambda x: f"{x:,.1f}")
    print("\n=== TOP 20 QUALITY, with valuation ===")
    show = ["company", "ticker", "recommendation", "compounder_score",
            "valuation_score", "pe", "pfcf", "market_cap"]
    v = out.copy()
    v["market_cap"] = (v["market_cap"] / 1e9).round(1)   # $B for display
    print(v[show].head(20).to_string(index=False))


if __name__ == "__main__":
    main()
