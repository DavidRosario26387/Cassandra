import json

# ============================================================
# CHANGE THIS PATH
# ============================================================
JSON_PATH = r"C:\\Users\\admin\\Desktop\\cassandra\\CIK0000029002.json"
# Example Windows:
# JSON_PATH = r"D:\SEC\companyfacts\CIK0000320193.json"


# ============================================================
# METRICS WE WANT
#
# Multiple tags are included because companies may use
# different XBRL tags for the same economic concept.
# ============================================================
METRICS = {
    "Revenue": [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
    ],

    "Gross Profit": [
        "GrossProfit",
    ],

    "Operating Income": [
        "OperatingIncomeLoss",
    ],

    "Net Income": [
        "NetIncomeLoss",
        "ProfitLoss",
    ],

    "Interest Expense": [
        "InterestExpenseNonOperating",
        "InterestExpense",
    ],

    "Income Tax Expense": [
        "IncomeTaxExpenseBenefit",
    ],

    "Cash": [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],

    "Current Assets": [
        "AssetsCurrent",
    ],

    "Total Assets": [
        "Assets",
    ],

    "Current Liabilities": [
        "LiabilitiesCurrent",
    ],

    "Total Liabilities": [
        "Liabilities",
    ],

    "Equity": [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],

    "Long Term Debt": [
        "LongTermDebt",
        "LongTermDebtCurrent",
    ],

    "Operating Cash Flow": [
        "NetCashProvidedByUsedInOperatingActivities",
    ],

    "Capex": [
        "PaymentsToAcquirePropertyPlantAndEquipment",
    ],

    "Diluted EPS": [
        "EarningsPerShareDiluted",
    ],

    "Diluted Shares": [
        "WeightedAverageNumberOfDilutedSharesOutstanding",
    ],

    "Shares Outstanding": [
        "CommonStocksIncludingAdditionalPaidInCapitalMember",
        "EntityCommonStockSharesOutstanding",
    ],

    "Dividends Paid": [
        "PaymentsOfDividends",
        "PaymentsOfDividendsCommonStock",
    ],

    "Share Repurchases": [
        "PaymentsForRepurchaseOfCommonStock",
        "StockRepurchasedAndRetiredDuringPeriodValue",
    ],
}


def get_annual_fact(concept):
    """
    Return the best annual 10-K value for a concept.

    We prefer:
    - form = 10-K
    - fp = FY
    - latest filed value for a given year
    """

    units = concept.get("units", {})

    all_facts = []

    # A concept may have units like USD, shares, USD/shares etc.
    for unit, facts in units.items():
        for fact in facts:
            if (
                fact.get("form") == "10-K"
                and fact.get("fp") == "FY"
            ):
                all_facts.append({
                    "unit": unit,
                    **fact
                })

    return all_facts


def main():

    # --------------------------------------------------------
    # LOAD JSON
    # --------------------------------------------------------
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("\n" + "=" * 70)
    print("COMPANY")
    print("=" * 70)
    print("CIK:", data.get("cik"))
    print("Company:", data.get("entityName"))

    facts = data.get("facts", {})
    us_gaap = facts.get("us-gaap", {})

    print("\n" + "=" * 70)
    print("FINANCIAL DATA")
    print("=" * 70)

    for metric_name, possible_tags in METRICS.items():

        found = False

        for tag in possible_tags:

            if tag not in us_gaap:
                continue

            concept = us_gaap[tag]
            annual_facts = get_annual_fact(concept)

            if not annual_facts:
                continue

            print(f"\n{metric_name}")
            print(f"SEC Tag Used: {tag}")
            print("-" * 50)

            # Sort by end date
            annual_facts.sort(
                key=lambda x: x.get("end", "")
            )

            for fact in annual_facts:
                print(
                    f"{fact.get('end')} | "
                    f"{fact.get('val')} | "
                    f"{fact.get('unit')}"
                )

            found = True
            break

        if not found:
            print(f"\n{metric_name}: NOT FOUND")


if __name__ == "__main__":
    main()