"""
extract_metadata.py
====================
Pulls company metadata (sector, tickers, exchange, entity type) from
submissions.zip for exactly the CIKs present in company_summary.csv.

We open each needed entry directly by name (the zip central directory makes this
O(1)), so this touches ~15k files, not the ~982k in the archive.

Output: company_metadata.csv  (cik, name, sic, sic_desc, sector, tickers,
exchanges, entity_type, is_listed).
"""

import csv
import json
import zipfile

import pandas as pd

SUBMISSIONS_ZIP = r"C:\Users\admin\Desktop\cassandra\submissions.zip"
SUMMARY_CSV     = r"C:\Users\admin\Desktop\cassandra\company_summary.csv"
OUTPUT_CSV      = r"C:\Users\admin\Desktop\cassandra\company_metadata.csv"


# ---- SIC major-group -> coarse sector, for sector-relative ranking ----
# Peers are compared within these buckets. Ranges follow the standard SIC
# division scheme, collapsed to buckets big enough for stable percentiles.
def sic_to_sector(sic):
    try:
        s = int(sic)
    except (ValueError, TypeError):
        return "Unknown"
    if 100 <= s <= 999:   return "Agriculture"
    if 1000 <= s <= 1499: return "Mining/Energy"
    if 1500 <= s <= 1799: return "Construction"
    if 2000 <= s <= 3999: return "Manufacturing"
    if 4000 <= s <= 4999: return "Transport/Utilities"
    if 5000 <= s <= 5199: return "Wholesale"
    if 5200 <= s <= 5999: return "Retail"
    if 6000 <= s <= 6799: return "Financials"
    if 7000 <= s <= 8999: return "Services"
    return "Other"


def main():
    ciks = pd.read_csv(SUMMARY_CSV, usecols=["cik"]).cik.astype(int).tolist()
    print(f"Fetching metadata for {len(ciks):,} companies...")

    z = zipfile.ZipFile(SUBMISSIONS_ZIP)
    available = set(z.namelist())

    found = missing = 0
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as out:
        w = csv.writer(out)
        w.writerow(["cik", "name", "sic", "sic_desc", "sector",
                    "tickers", "exchanges", "entity_type", "is_listed"])

        for cik in ciks:
            name = f"CIK{cik:010d}.json"
            if name not in available:
                missing += 1
                continue
            try:
                d = json.load(z.open(name))
            except Exception:
                missing += 1
                continue

            tickers = [t for t in (d.get("tickers") or []) if t]
            exchanges = [e for e in (d.get("exchanges") or []) if e]
            entity_type = d.get("entityType", "")
            # "Listed" = has a ticker on a real exchange and is an operating company.
            is_listed = bool(tickers and exchanges and entity_type == "operating")

            w.writerow([
                cik,
                d.get("name", ""),
                d.get("sic", ""),
                d.get("sicDescription", ""),
                sic_to_sector(d.get("sic")),
                "|".join(tickers),
                "|".join(exchanges),
                entity_type,
                int(is_listed),
            ])
            found += 1

    print(f"  found: {found:,}   missing: {missing:,}")
    print(f"-> {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
