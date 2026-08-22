"""
valuation.py
============
Pure valuation functions. Valuation does NOT change a company's quality rank -
per the roadmap it only tells us WHEN a great business is attractively priced.

Market cap is derived, never taken from the price vendor:
    market_cap = price * shares_outstanding   (shares from SEC)

All ratios then divide market cap by a reliable SEC fundamental. Yields (the
inverse) are used for scoring because they behave well when earnings are small
or negative, where P/E explodes or flips sign.
"""

import math

from metrics import _ok, safe_div


def market_cap(price, shares):
    if not _ok(price) or not _ok(shares) or price <= 0 or shares <= 0:
        return None
    return price * shares


# ---- multiples (for display) ----
def price_to_earnings(mcap, net_income):
    pe = safe_div(mcap, net_income)
    return pe if (pe is not None and pe > 0) else None   # negative P/E is meaningless


def price_to_fcf(mcap, fcf):
    pfcf = safe_div(mcap, fcf)
    return pfcf if (pfcf is not None and pfcf > 0) else None


def price_to_sales(mcap, revenue):
    return safe_div(mcap, revenue)


def price_to_book(mcap, equity):
    pb = safe_div(mcap, equity)
    return pb if (pb is not None and pb > 0) else None


# ---- yields (for scoring; robust to small/negative denominators) ----
def earnings_yield(net_income, mcap):
    return safe_div(net_income, mcap)


def fcf_yield(fcf, mcap):
    return safe_div(fcf, mcap)


# ---- growth-adjusted value (a compounder-aware PEG-style check) ----
def peg_like(pe, growth_rate):
    """
    P/E divided by growth (in %). <1 cheap, >2.5 rich - the classic PEG idea,
    but computed from our own P/E and CAGR. None if either input is unusable.
    """
    if not _ok(pe) or not _ok(growth_rate) or growth_rate <= 0:
        return None
    return pe / (growth_rate * 100.0)


def recommendation(quality_score, valuation_score):
    """
    Combine business quality with how cheap it is into a plain-English call.
    Quality decides IF it's a candidate; valuation decides the ACTION.

    Only quality businesses (score >= 65) get a buy/wait call; weaker ones are
    'PASS' regardless of price - a cheap poor business is not the goal.
    """
    if not _ok(quality_score):
        return "NO DATA"
    if quality_score < 65:
        return "PASS (quality)"
    if not _ok(valuation_score):
        return "REVIEW (no price)"
    if valuation_score >= 60:
        return "BUY"
    if valuation_score >= 35:
        return "WATCH"
    return "WAIT FOR PULLBACK"
