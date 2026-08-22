"""
metrics.py
==========
Pure financial-metric functions for the compounder engine.

Design rules:
- Every function takes plain numbers (or None/NaN for "missing") and returns a
  float, or None when it cannot be computed. Nothing here reads files or knows
  about pandas, so each function is trivially unit-testable.
- Division is always guarded: a missing or zero denominator yields None, never
  a crash or an inf.

Two groups:
  1. Point-in-time  -> one company-year (scalars in, scalar out)
  2. Series         -> a multi-year history (dict {year: value} in, scalar out)
"""

import math
import statistics

# ============================================================
# LOW-LEVEL HELPERS
# ============================================================

def _ok(x):
    """True if x is a usable number (not None, not NaN)."""
    return x is not None and not (isinstance(x, float) and math.isnan(x))


def safe_div(a, b):
    """a / b, or None if either side is missing or b == 0."""
    if not _ok(a) or not _ok(b) or b == 0:
        return None
    return a / b


def _nz(x):
    """Treat a missing value as 0.0 (used for debt: 'not reported' ~ 'none')."""
    return x if _ok(x) else 0.0


# ============================================================
# 1. POINT-IN-TIME METRICS  (single company-year)
# ============================================================

def fcf(operating_cash_flow, capex):
    """
    Free cash flow = operating cash flow - capex.
    NOTE: capex here is PaymentsToAcquirePropertyPlantAndEquipment, already a
    positive cash *outflow* in SEC data, so we subtract it.
    """
    if not _ok(operating_cash_flow) or not _ok(capex):
        return None
    return operating_cash_flow - capex


def gross_margin(gross_profit, revenue):
    return safe_div(gross_profit, revenue)


def operating_margin(operating_income, revenue):
    return safe_div(operating_income, revenue)


def net_margin(net_income, revenue):
    return safe_div(net_income, revenue)


def fcf_margin(free_cash_flow, revenue):
    return safe_div(free_cash_flow, revenue)


def effective_tax_rate(income_tax_expense, net_income):
    """
    Effective rate = tax / pretax, where pretax = net_income + tax.
    Clamped to [0, 0.5]; falls back to 21% (US statutory) when the reported
    numbers are nonsensical (e.g. tax benefit in a loss year).
    """
    if not _ok(income_tax_expense) or not _ok(net_income):
        return 0.21
    pretax = net_income + income_tax_expense
    rate = safe_div(income_tax_expense, pretax)
    if rate is None or rate < 0 or rate > 0.5:
        return 0.21
    return rate


def nopat(operating_income, tax_rate):
    """Net operating profit after tax = EBIT * (1 - tax rate)."""
    if not _ok(operating_income) or not _ok(tax_rate):
        return None
    return operating_income * (1 - tax_rate)


def capital_employed(total_assets, current_liabilities):
    """Capital employed = total assets - current liabilities (for ROCE)."""
    if not _ok(total_assets) or not _ok(current_liabilities):
        return None
    return total_assets - current_liabilities


def invested_capital(total_assets, current_liabilities, cash):
    """
    Invested capital = total assets - current liabilities - cash.
    Debt-tag independent (uses high-coverage fields) and strips excess cash,
    which is what a compounder's reinvestment base should exclude.
    """
    ce = capital_employed(total_assets, current_liabilities)
    if ce is None or not _ok(cash):
        return None
    return ce - cash


def roic(operating_income, tax_rate, inv_capital):
    """Return on invested capital = NOPAT / invested capital."""
    return safe_div(nopat(operating_income, tax_rate), inv_capital)


def roce(operating_income, cap_employed):
    """Return on capital employed = EBIT / capital employed."""
    return safe_div(operating_income, cap_employed)


def roe(net_income, equity):
    return safe_div(net_income, equity)


def total_debt(short_term_debt, long_term_debt):
    """Short + long debt. Missing legs count as 0 (assume 'not reported' = none)."""
    if not _ok(short_term_debt) and not _ok(long_term_debt):
        return None  # nothing reported at all -> genuinely unknown
    return _nz(short_term_debt) + _nz(long_term_debt)


def net_cash(cash, debt):
    """Net cash = cash - total debt (negative = net debt)."""
    if not _ok(cash) or not _ok(debt):
        return None
    return cash - debt


def debt_to_equity(debt, equity):
    return safe_div(debt, equity)


def interest_coverage(operating_income, interest_expense):
    """EBIT / interest expense. High or None => effectively unlevered."""
    return safe_div(operating_income, interest_expense)


def cash_conversion(free_cash_flow, net_income):
    """FCF / net income: how much reported profit turns into cash."""
    return safe_div(free_cash_flow, net_income)


def bvps(equity, shares_outstanding):
    """Book value per share."""
    return safe_div(equity, shares_outstanding)


# ============================================================
# 2. SERIES METRICS  (multi-year history)
# ============================================================

def cagr(begin, end, years):
    """
    Compound annual growth rate between two points `years` apart.
    Returns None if either endpoint is missing, non-positive, or years <= 0.
    (Sign flips make CAGR meaningless, so negative/zero starts return None.)
    """
    if not _ok(begin) or not _ok(end) or years <= 0:
        return None
    if begin <= 0 or end <= 0:
        return None
    return (end / begin) ** (1.0 / years) - 1.0


def _series_endpoints(values_by_year, window):
    """
    Given {year: value}, pick the most recent year with data as the end point
    and the year `window` back (or the earliest available >= that) as the start.
    Returns (begin_val, end_val, span_years) or (None, None, None).
    """
    valid = {y: v for y, v in values_by_year.items() if _ok(v)}
    if len(valid) < 2:
        return None, None, None
    end_year = max(valid)
    target = end_year - window
    candidates = [y for y in valid if y <= target] or [min(valid)]
    begin_year = max(candidates)  # closest year at/under the target
    span = end_year - begin_year
    if span <= 0:
        return None, None, None
    return valid[begin_year], valid[end_year], span


def series_cagr(values_by_year, window=10):
    """CAGR of a {year: value} series over ~`window` years, using real endpoints."""
    begin, end, span = _series_endpoints(values_by_year, window)
    return cagr(begin, end, span)


# ============================================================
# 3. DURABILITY / PERSISTENCE  (the quantitative moat signature)
# ============================================================
# A moat shows up as high returns and stable margins that DON'T mean-revert.
# These read a {year: value} series and return a bounded, comparable number.

def _clean_values(values_by_year, min_years):
    vals = [v for v in values_by_year.values() if _ok(v)]
    return vals if len(vals) >= min_years else None


def persistence(values_by_year, threshold, min_years=5):
    """
    Fraction of available years the metric held at/above `threshold`.
    e.g. persistence(roic_series, 0.15) = share of years ROIC stayed above 15%.
    1.0 = never lost it (a durable moat); low = returns were competed away.
    """
    vals = _clean_values(values_by_year, min_years)
    if vals is None:
        return None
    return sum(1 for v in vals if v >= threshold) / len(vals)


def stability(values_by_year, min_years=5):
    """
    Stability = 1 / (1 + coefficient of variation). Range (0, 1].
    ~1 means the metric barely moved year to year (pricing power / recurring
    demand); low means it swung around. Undefined if the mean is ~0.
    """
    vals = _clean_values(values_by_year, min_years)
    if vals is None:
        return None
    mean = statistics.fmean(vals)
    if abs(mean) < 1e-12:
        return None
    sd = statistics.pstdev(vals)
    cv = sd / abs(mean)
    return 1.0 / (1.0 + cv)


def down_years_fraction(values_by_year, min_years=5):
    """Fraction of year-over-year steps where the value FELL. Lower = steadier."""
    items = sorted((y, v) for y, v in values_by_year.items() if _ok(v))
    if len(items) < min_years:
        return None
    downs = sum(1 for i in range(1, len(items)) if items[i][1] < items[i - 1][1])
    return downs / (len(items) - 1)


def max_drawdown(values_by_year, min_years=5):
    """
    Worst peak-to-trough decline across the series (<= 0; 0 = never fell below a
    prior peak). For revenue, a shallow drawdown signals sticky, durable demand.
    """
    items = [v for _, v in sorted(values_by_year.items()) if _ok(v)]
    if len(items) < min_years:
        return None
    peak = items[0]
    mdd = 0.0
    for v in items:
        peak = max(peak, v)
        if peak > 0:
            mdd = min(mdd, (v - peak) / peak)
    return mdd


def roiic(nopat_by_year, invested_capital_by_year, window=5):
    """
    Return on incremental invested capital over `window` years:

        ROIIC = (NOPAT_end - NOPAT_begin) / (IC_{end-1} - IC_{begin-1})

    i.e. how much extra after-tax profit each extra dollar of invested capital
    produced. Capital is lagged one year (this year's profit comes from last
    year's capital). Returns None if the capital change is ~0 or data is thin.
    """
    npv = {y: v for y, v in nopat_by_year.items() if _ok(v)}
    icv = {y: v for y, v in invested_capital_by_year.items() if _ok(v)}
    if len(npv) < 2 or len(icv) < 2:
        return None

    end_year = max(npv)
    target = end_year - window
    begins = [y for y in npv if y <= target] or [min(npv)]
    begin_year = max(begins)
    if end_year - begin_year <= 0:
        return None

    # capital lagged by one year
    ic_end = icv.get(end_year - 1)
    ic_begin = icv.get(begin_year - 1)
    if not _ok(ic_end) or not _ok(ic_begin):
        return None

    delta_nopat = npv[end_year] - npv[begin_year]
    delta_ic = ic_end - ic_begin
    if abs(delta_ic) < 1e-9:
        return None
    return delta_nopat / delta_ic
