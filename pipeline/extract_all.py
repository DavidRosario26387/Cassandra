import json
import zipfile
import csv
from datetime import date
from collections import defaultdict

# ============================================================
# CONFIG
# ============================================================

ZIP_PATH   = r"C:\Users\admin\Desktop\cassandra\companyfacts.zip"
OUTPUT_CSV = r"C:\Users\admin\Desktop\cassandra\master_financials.csv"

START_YEAR = 2009
MAX_YEAR   = 2026   # drop rows with garbage future fiscal-year dates

# Set to an int to test on the first N companies; None = all 20,266
MAX_COMPANIES = None

# Optional: restrict to specific CIKs (as ints). None = every company.
# e.g. {1045810, 814547, 900075}  -> NVIDIA, Fair Isaac, Copart
CIK_WHITELIST = None


# ============================================================
# METRIC -> POSSIBLE SEC XBRL TAGS   (priority order matters)
# For each year, the first tag in the list that reports that year wins,
# so multi-tag series (e.g. revenue pre/post ASC 606) get stitched together.
# ============================================================

METRICS = {
    # ---------------- INCOME STATEMENT ----------------
    "revenue": [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
    ],
    "gross_profit": ["GrossProfit"],
    "cost_of_revenue": [
        "CostOfGoodsAndServicesSold",
        "CostOfRevenue",
        "CostOfGoodsSold",
        "CostOfServices",
    ],
    "operating_income": ["OperatingIncomeLoss"],
    "net_income": ["NetIncomeLoss", "ProfitLoss"],
    "interest_expense": ["InterestExpenseNonOperating", "InterestExpense"],
    "income_tax_expense": ["IncomeTaxExpenseBenefit"],

    # ---------------- BALANCE SHEET ----------------
    "cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
    "current_assets": ["AssetsCurrent"],
    "total_assets": ["Assets"],
    "current_liabilities": ["LiabilitiesCurrent"],
    "total_liabilities": ["Liabilities"],
    "equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    "short_term_debt": [
        "ShortTermBorrowings",
        "ShortTermDebt",
        "LongTermDebtCurrent",
        "DebtCurrent",
    ],
    "long_term_debt": [
        "LongTermDebtNoncurrent",
        "LongTermDebt",
        "LongTermDebtAndCapitalLeaseObligations",
        "DebtInstrumentCarryingAmount",
        "DebtLongtermAndShorttermCombinedAmount",
    ],

    # ---------------- CASH FLOW ----------------
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    "capex": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
    ],
    "depreciation_amortization": [
        "DepreciationDepletionAndAmortization",
        "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
    ],

    # ---------------- CAPITAL ALLOCATION (added) ----------------
    "dividends_paid": [
        "PaymentsOfDividendsCommonStock",
        "PaymentsOfDividends",
        "Dividends",
    ],
    "stock_repurchases": [
        "PaymentsForRepurchaseOfCommonStock",
        "PaymentsForRepurchaseOfEquity",
    ],
    "acquisitions": [
        "PaymentsToAcquireBusinessesNetOfCashAcquired",
        "PaymentsToAcquireBusinessesAndInterestsInAffiliatesNetOfCashAcquired",
    ],

    # ---------------- PER SHARE ----------------
    "eps_diluted": ["EarningsPerShareDiluted"],
    "diluted_shares": ["WeightedAverageNumberOfDilutedSharesOutstanding"],
    "shares_outstanding": [
        "EntityCommonStockSharesOutstanding",
        "CommonStocksIncludingAdditionalPaidInCapitalMember",
    ],
}

COLUMN_ORDER = ["company", "cik", "year"] + list(METRICS.keys())


# ============================================================
# HELPERS
# ============================================================

def _d(s):
    try:
        return date(int(s[0:4]), int(s[5:7]), int(s[8:10]))
    except (ValueError, TypeError, IndexError):
        return None


def is_annual_fact(fact):
    """
    Keep only full-year annual-report facts.

    fp=='FY' + form 10-K is NOT sufficient: annual filings also tag their
    quarterly / 9-month comparative figures as fp=FY. So for DURATION facts
    (income statement, cash flow) we additionally require the period to span
    ~1 year (350-380 days). INSTANT balance-sheet facts have no 'start' and
    are kept as-is (they are fiscal year-end snapshots).
    """
    if fact.get("form") not in ("10-K", "20-F", "40-F"):
        return False
    if fact.get("fp") != "FY":
        return False

    start = fact.get("start")
    if start is None:
        return True  # instantaneous (balance-sheet) fact

    d0, d1 = _d(start), _d(fact.get("end"))
    if d0 is None or d1 is None:
        return False
    return 350 <= (d1 - d0).days <= 380


def get_fact_year(fact):
    end = fact.get("end")
    if not end:
        return None
    try:
        return int(end[:4])
    except (ValueError, TypeError):
        return None


def extract_metric(us_gaap, possible_tags):
    """
    Merge tags year-by-year. For each year the highest-priority tag that
    reports it wins; when a year has duplicate facts, keep the latest filed.
    Returns {year: value}.
    """
    result = {}                       # year -> chosen value
    winning_priority = {}             # year -> index of the tag that supplied it

    for priority, tag in enumerate(possible_tags):
        concept = us_gaap.get(tag)
        if not concept:
            continue

        facts_by_year = defaultdict(list)
        for facts in concept.get("units", {}).values():
            for fact in facts:
                if not is_annual_fact(fact):
                    continue
                year = get_fact_year(fact)
                if year is None or year < START_YEAR:
                    continue
                if "val" not in fact:
                    continue
                facts_by_year[year].append(fact)

        for year, records in facts_by_year.items():
            # a higher-priority tag already claimed this year -> skip
            if year in winning_priority and winning_priority[year] < priority:
                continue
            records.sort(key=lambda x: (x.get("filed", ""), x.get("end", "")))
            result[year] = records[-1]["val"]
            winning_priority[year] = priority

    return result


def process_company(data):
    """Yield one dict per company-year with all metric columns."""
    cik = data.get("cik")
    company = data.get("entityName")
    facts = data.get("facts", {})
    us_gaap = facts.get("us-gaap", {})
    if not us_gaap:
        return []

    # Merge in dei tags (e.g. EntityCommonStockSharesOutstanding lives there,
    # not under us-gaap). us-gaap wins on any name collision.
    concepts = dict(facts.get("dei", {}))
    concepts.update(us_gaap)
    us_gaap = concepts

    yearly = defaultdict(dict)
    for metric_name, tags in METRICS.items():
        for year, value in extract_metric(us_gaap, tags).items():
            yearly[year][metric_name] = value

    rows = []
    for year, values in sorted(yearly.items()):
        if not values:
            continue
        # Drop obviously bad fiscal years (garbage 'end' dates in filings).
        if year < START_YEAR or year > MAX_YEAR:
            continue
        # Derive gross profit when the company reports COGS but no GrossProfit line.
        if values.get("gross_profit") is None:
            rev, cogs = values.get("revenue"), values.get("cost_of_revenue")
            if rev is not None and cogs is not None:
                values["gross_profit"] = rev - cogs
        row = {"company": company, "cik": cik, "year": year}
        row.update(values)
        rows.append(row)
    return rows


# ============================================================
# MAIN — stream the zip, write long-format CSV
# ============================================================

def main():
    z = zipfile.ZipFile(ZIP_PATH)
    names = [n for n in z.namelist() if n.endswith(".json")]
    print(f"Zip contains {len(names)} company files.")

    processed = companies_with_data = total_rows = errors = 0

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as out:
        writer = csv.DictWriter(out, fieldnames=COLUMN_ORDER)
        writer.writeheader()

        for name in names:
            if MAX_COMPANIES is not None and processed >= MAX_COMPANIES:
                break

            if CIK_WHITELIST is not None:
                try:
                    cik_int = int(name.replace("CIK", "").replace(".json", ""))
                except ValueError:
                    continue
                if cik_int not in CIK_WHITELIST:
                    continue

            processed += 1
            try:
                with z.open(name) as f:
                    data = json.load(f)
            except Exception:
                errors += 1
                continue

            rows = process_company(data)
            if rows:
                companies_with_data += 1
                total_rows += len(rows)
                writer.writerows(rows)

            if processed % 500 == 0:
                print(f"  processed {processed}  |  rows so far {total_rows}")

    print("\n" + "=" * 60)
    print(f"Companies processed     : {processed}")
    print(f"  with usable data      : {companies_with_data}")
    print(f"  parse errors/stubs    : {errors}")
    print(f"Total company-year rows : {total_rows}")
    print(f"Saved -> {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
