import json
from collections import defaultdict
import pandas as pd

# ============================================================
# CONFIG
# ============================================================

JSON_PATH = r"C:\\Users\\admin\\Desktop\\cassandra\\CIK0000102037.json"

OUTPUT_CSV = r"company_annual_financials.csv"

START_YEAR = 2009


# ============================================================
# METRIC -> POSSIBLE SEC XBRL TAGS
#
# Order matters: first available tag is preferred.
# ============================================================

METRICS = {
    # ---------------- INCOME STATEMENT ----------------
    "revenue": [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
    ],

    "gross_profit": [
        "GrossProfit",
    ],

    "operating_income": [
        "OperatingIncomeLoss",
    ],

    "net_income": [
        "NetIncomeLoss",
        "ProfitLoss",
    ],

    "interest_expense": [
        "InterestExpenseNonOperating",
        "InterestExpense",
    ],

    "income_tax_expense": [
        "IncomeTaxExpenseBenefit",
    ],

    # ---------------- BALANCE SHEET ----------------
    "cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],

    "current_assets": [
        "AssetsCurrent",
    ],

    "total_assets": [
        "Assets",
    ],

    "current_liabilities": [
        "LiabilitiesCurrent",
    ],

    "total_liabilities": [
        "Liabilities",
    ],

    "equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],

    "short_term_debt": [
        "ShortTermBorrowings",
        "ShortTermDebt",
        "LongTermDebtCurrent",
    ],

    "long_term_debt": [
        "LongTermDebtNoncurrent",
        "LongTermDebt",
    ],

    # ---------------- CASH FLOW ----------------
    "operating_cash_flow": [
        "NetCashProvidedByUsedInOperatingActivities",
    ],

    "capex": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
    ],

    "depreciation_amortization": [
        "DepreciationDepletionAndAmortization",
        "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
    ],

    # ---------------- PER SHARE ----------------
    "eps_diluted": [
        "EarningsPerShareDiluted",
    ],

    "diluted_shares": [
        "WeightedAverageNumberOfDilutedSharesOutstanding",
    ],

    "shares_outstanding": [
        "EntityCommonStockSharesOutstanding",
        "CommonStocksIncludingAdditionalPaidInCapitalMember",
    ],
}


# ============================================================
# HELPER: DETERMINE IF FACT IS AN ANNUAL RECORD
# ============================================================

def is_annual_fact(fact):
    """
    Keep annual facts only.

    Rules:
    1. Prefer 10-K / 20-F / 40-F
    2. For duration facts, period should be roughly one year.
    3. Instantaneous balance-sheet facts have no 'start'.
    """

    form = fact.get("form", "")
    fp = fact.get("fp", "")

    if form not in ("10-K", "20-F", "40-F"):
        return False

    # SEC annual filing marker
    if fp == "FY":
        return True

    return False


# ============================================================
# HELPER: GET YEAR FROM FINANCIAL PERIOD
# ============================================================

def get_fact_year(fact):
    """
    For duration records use END year.
    For instant records also use END year.

    Example:
    start = 2023-01-01
    end   = 2023-12-31
    -> 2023
    """

    end = fact.get("end")

    if not end:
        return None

    try:
        return int(end[:4])
    except (ValueError, TypeError):
        return None


# ============================================================
# EXTRACT ONE METRIC
# ============================================================

def extract_metric(us_gaap, possible_tags):
    """
    Try each possible SEC tag.

    Returns:
        {year: value}
    """

    for tag in possible_tags:

        if tag not in us_gaap:
            continue

        concept = us_gaap[tag]
        units = concept.get("units", {})

        # Store all possible facts by year
        facts_by_year = defaultdict(list)

        for unit_name, facts in units.items():

            for fact in facts:

                if not is_annual_fact(fact):
                    continue

                year = get_fact_year(fact)

                if year is None or year < START_YEAR:
                    continue

                if "val" not in fact:
                    continue

                facts_by_year[year].append({
                    "value": fact["val"],
                    "filed": fact.get("filed", ""),
                    "end": fact.get("end", ""),
                    "accn": fact.get("accn", ""),
                    "unit": unit_name,
                })

        if not facts_by_year:
            continue

        # Resolve duplicates:
        # Keep latest filed version for each financial year.
        result = {}

        for year, records in facts_by_year.items():

            records.sort(
                key=lambda x: (
                    x["filed"],
                    x["end"]
                )
            )

            best = records[-1]

            result[year] = best["value"]

        # We found a usable preferred tag
        return result, tag

    # Nothing found
    return {}, None


# ============================================================
# MAIN
# ============================================================

def main():

    print("Loading JSON...")

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    cik = data.get("cik")
    company = data.get("entityName")

    print(f"Company : {company}")
    print(f"CIK     : {cik}")

    us_gaap = data.get("facts", {}).get("us-gaap", {})

    # Final structure:
    # {
    #   2024: {"revenue": ..., "net_income": ...},
    #   2023: {...}
    # }
    yearly_data = defaultdict(dict)

    # Company identifiers
    for year in range(START_YEAR, 2100):
        yearly_data[year]["cik"] = cik
        yearly_data[year]["company"] = company

    print("\nExtracting metrics...\n")

    for metric_name, possible_tags in METRICS.items():

        values, tag_used = extract_metric(
            us_gaap,
            possible_tags
        )

        if tag_used:
            print(
                f"[FOUND] {metric_name:<30} "
                f"-> {tag_used} "
                f"({len(values)} years)"
            )
        else:
            print(
                f"[MISSING] {metric_name:<28}"
            )

        for year, value in values.items():
            yearly_data[year][metric_name] = value

    # --------------------------------------------------------
    # CONVERT TO DATAFRAME
    # --------------------------------------------------------

    rows = []

    for year, values in yearly_data.items():

        # Don't include future empty years
        if not any(
            key in values
            for key in METRICS.keys()
        ):
            continue

        row = {
            "year": year,
            **values
        }

        rows.append(row)

    df = pd.DataFrame(rows)

    # Put columns in sensible order
    column_order = [
        "company",
        "cik",
        "year",

        "revenue",
        "gross_profit",
        "operating_income",
        "net_income",
        "interest_expense",
        "income_tax_expense",

        "cash",
        "current_assets",
        "total_assets",
        "current_liabilities",
        "total_liabilities",
        "equity",
        "short_term_debt",
        "long_term_debt",

        "operating_cash_flow",
        "capex",
        "depreciation_amortization",

        "eps_diluted",
        "diluted_shares",
        "shares_outstanding",
    ]

    # Keep only columns that exist
    column_order = [
        col for col in column_order
        if col in df.columns
    ]

    df = df[column_order]

    # Sort oldest -> newest
    df = df.sort_values("year")

    # --------------------------------------------------------
    # OUTPUT
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("FINAL DATA")
    print("=" * 70)

    print(df.to_string(index=False))

    df.to_csv(OUTPUT_CSV, index=False)

    print("\nSaved to:")
    print(OUTPUT_CSV)

    print(f"\nTotal rows: {len(df)}")


if __name__ == "__main__":
    main()