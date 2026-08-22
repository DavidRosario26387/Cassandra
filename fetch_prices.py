"""
fetch_prices.py
===============
Fetches recent share PRICE (the one thing SEC filings lack) for the investable
universe. Market cap and all valuation ratios are computed later by combining
price with our reliable SEC fundamentals - we take nothing but price from the
external source.

Design:
  - BULK requests: yf.download() pulls ~120 tickers per HTTP call, so all ~1,668
    tickers cost ~15 requests, not 1,668. This is what keeps us under the rate
    limit (per-ticker calls are what get throttled).
  - Swappable source: PRICE_SOURCE points at one function (ticker list -> prices).
    Dropping in Stooq/Tiingo later is a one-line change, not a rewrite.
  - Incremental cache (prices_cache.csv): resumable; re-runs skip tickers already
    priced today.
  - Per-chunk retries with backoff; a failed chunk never aborts the run.
  - Validation: price must be a positive number, else status != 'ok'.

Output: prices_cache.csv (ticker, price, status, fetch_date)
"""

import time
from datetime import date
import os

import pandas as pd
import yfinance as yf

SCORES_CSV = r"C:\Users\admin\Desktop\cassandra\compounder_scores.csv"
CACHE_CSV  = r"C:\Users\admin\Desktop\cassandra\prices_cache.csv"

CHUNK_SIZE = 120
CHUNK_RETRIES = 3
CHUNK_PAUSE = 1.0     # polite gap between chunks (seconds)


def primary_ticker(cell):
    """First ticker from a 'RMD|RSMDF' cell, normalized for Yahoo (BRK.B->BRK-B)."""
    if not isinstance(cell, str) or not cell.strip():
        return None
    t = cell.split("|")[0].strip().upper()
    return t.replace(".", "-") or None


# ============================================================
# PRICE SOURCE (swappable)  ticker list -> {ticker: price}
# ============================================================

def download_prices_yahoo(tickers):
    """
    Bulk-download the most recent close for a list of tickers via yf.download.
    Returns {ticker: price_float}. Missing/failed tickers are simply absent.
    """
    out = {}
    df = yf.download(
        tickers, period="5d", interval="1d",
        progress=False, auto_adjust=True, threads=True,
    )
    if df is None or df.empty:
        return out

    # Multi-ticker -> columns are a MultiIndex ('Close', ticker).
    # Single-ticker -> flat columns ('Close', ...).
    if isinstance(df.columns, pd.MultiIndex):
        close = df["Close"]
        for t in close.columns:
            s = close[t].dropna()
            if len(s):
                out[t] = float(s.iloc[-1])
    else:
        s = df["Close"].dropna()
        if len(s) and len(tickers) == 1:
            out[tickers[0]] = float(s.iloc[-1])
    return out


PRICE_SOURCE = download_prices_yahoo   # <- swap here for Stooq/Tiingo/etc.


# ============================================================
# CACHE
# ============================================================

def load_cache():
    if os.path.exists(CACHE_CSV):
        return pd.read_csv(CACHE_CSV).set_index("ticker").to_dict("index")
    return {}


def save_cache(cache):
    rows = [{"ticker": t, **v} for t, v in cache.items()]
    pd.DataFrame(rows).to_csv(CACHE_CSV, index=False)


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ============================================================
# MAIN
# ============================================================

def main():
    scored = pd.read_csv(SCORES_CSV)
    scored["ticker"] = scored["tickers"].map(primary_ticker)
    tickers = sorted(set(scored["ticker"].dropna()))
    print(f"{len(tickers):,} unique tickers to price.")

    cache = load_cache()
    today = date.today().isoformat()

    # Only fetch tickers not already priced OK today.
    todo = [t for t in tickers
            if not (cache.get(t, {}).get("status") == "ok"
                    and cache.get(t, {}).get("fetch_date") == today)]
    print(f"{len(todo):,} need fetching ({len(tickers) - len(todo):,} fresh in cache).")

    fetched = 0
    for ci, chunk in enumerate(_chunks(todo, CHUNK_SIZE), 1):
        prices = {}
        for attempt in range(CHUNK_RETRIES):
            try:
                prices = PRICE_SOURCE(chunk)
                if prices:
                    break
            except Exception as e:
                print(f"  chunk {ci} attempt {attempt+1} error: {type(e).__name__}")
            time.sleep(CHUNK_PAUSE * (attempt + 2))

        for t in chunk:
            p = prices.get(t)
            if p is not None and p > 0:
                cache[t] = {"price": p, "status": "ok", "fetch_date": today}
                fetched += 1
            else:
                cache[t] = {"price": None, "status": "missing", "fetch_date": today}

        save_cache(cache)
        print(f"  chunk {ci}: {len(chunk)} tickers, {fetched} priced so far")
        time.sleep(CHUNK_PAUSE)

    ok = sum(1 for v in cache.values() if v.get("status") == "ok")
    missing = sum(1 for v in cache.values() if v.get("status") == "missing")
    print(f"\nDone. priced ok={ok}  missing={missing}  -> {CACHE_CSV}")


if __name__ == "__main__":
    main()
