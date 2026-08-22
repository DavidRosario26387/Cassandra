"""
score.py
========
Pure scoring functions for the compounder engine.

Philosophy:
- We never score on RAW ratio values. A 308% ROIC (small-denominator artifact)
  and a 45% ROIC should both simply mean "top of the pack" - so every metric is
  converted to a PERCENTILE RANK (0-100) within the scored universe. Percentile
  ranking is naturally immune to the fat outlier tails we saw.
- "Lower is better" metrics (dilution, leverage) are ranked with direction=-1.
- Missing values get a neutral 50 (neither rewarded nor punished), so one absent
  data point doesn't nuke an otherwise-great company.
- A pillar score is the weighted average of its member-metric ranks. The overall
  Compounder Score is the weighted average of the available pillars, renormalised
  so the weights sum to 1 (Valuation and Durability aren't data-driven yet and
  are intentionally excluded for now).

Everything here is pandas-in / pandas-out but domain-agnostic: it knows nothing
about which metrics exist, only how to rank and combine whatever it's handed.
"""

import numpy as np
import pandas as pd


def percentile_rank(series, direction=1, groups=None, min_group=30):
    """
    Convert a numeric column to a 0-100 percentile rank.

    direction = +1  -> higher raw value ranks higher (ROIC, margins, growth)
    direction = -1  -> lower raw value ranks higher (dilution, leverage)

    If `groups` (a Series aligned to `series`) is given, ranking is done WITHIN
    each group (sector-relative), so a bank is compared to banks, not to
    software. Groups with fewer than `min_group` valued members fall back to the
    global rank, so a thin sector can't produce unstable percentiles.

    NaNs stay NaN here and are filled with a neutral 50 by score_pillar.
    """
    s = series.astype(float)
    if direction < 0:
        s = -s

    global_rank = s.rank(pct=True, method="average") * 100.0
    if groups is None:
        return global_rank

    out = pd.Series(np.nan, index=s.index, dtype=float)
    for _, idx in s.groupby(groups, observed=True).groups.items():
        sub = s.loc[idx]
        if sub.notna().sum() >= min_group:
            out.loc[idx] = sub.rank(pct=True, method="average") * 100.0
        else:
            out.loc[idx] = global_rank.loc[idx]
    return out


def score_pillar(df, specs, groups=None, neutral=50.0):
    """
    Compute a single pillar score (0-100) for every row in df.

    specs: list of (column_name, direction, weight) tuples.
    groups: optional Series for sector-relative ranking (passed to percentile_rank).
    Missing metric columns are skipped; missing values within a column get the
    neutral score so they neither help nor hurt.

    Returns a Series aligned to df.index.
    """
    total_w = 0.0
    acc = pd.Series(0.0, index=df.index)
    for column, direction, weight in specs:
        if column not in df.columns:
            continue
        ranks = percentile_rank(df[column], direction, groups=groups).fillna(neutral)
        acc = acc + ranks * weight
        total_w += weight
    if total_w == 0:
        return pd.Series(np.nan, index=df.index)
    return acc / total_w


def composite_score(df, pillar_weights):
    """
    Combine pillar-score columns into one overall score (0-100).

    pillar_weights: dict {pillar_column: weight}. Only pillars actually present
    (and non-NaN for a given row) contribute; weights are renormalised per row so
    a company missing an entire pillar is still scored fairly on the rest.
    """
    cols = [c for c in pillar_weights if c in df.columns]
    weights = np.array([pillar_weights[c] for c in cols], dtype=float)
    values = df[cols].to_numpy(dtype=float)          # rows x pillars

    mask = ~np.isnan(values)                          # which pillars each row has
    w = mask * weights                                # zero-weight the missing
    wsum = w.sum(axis=1)
    filled = np.where(mask, values, 0.0)
    total = (filled * w).sum(axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        out = np.where(wsum > 0, total / wsum, np.nan)
    return pd.Series(out, index=df.index)


# ============================================================
# PILLAR DEFINITIONS  (data-driven pillars only)
# ============================================================
# Each entry: (summary_column, direction, intra-pillar weight)

PILLAR_SPECS = {
    "quality_score": [
        ("roic_median", 1, 2.0),          # through-cycle, most important
        ("roiic_5y", 1, 1.5),             # incremental reinvestment return
        ("operating_margin", 1, 1.0),
        ("fcf_margin", 1, 1.0),
        ("gross_margin", 1, 0.5),
    ],
    "growth_score": [
        ("revenue_cagr_10y", 1, 1.5),
        ("earnings_cagr_10y", 1, 1.5),    # EPS CAGR w/ net-income fallback
        ("fcf_cagr_10y", 1, 1.0),
        ("bvps_cagr_10y", 1, 1.0),
    ],
    "durability_score": [
        ("roic_persistence", 1, 2.0),               # moat: high returns that didn't mean-revert
        ("operating_margin_stability", 1, 1.0),     # pricing power
        ("gross_margin_median", 1, 1.0),            # brand / switching costs (level)
        ("revenue_max_drawdown", 1, 1.0),           # sticky demand (0 = never fell; higher = better)
        ("roiic_5y", 1, 1.0),                       # runway: still reinvesting at high returns
    ],
    "capital_allocation_score": [
        ("shares_cagr_10y", -1, 1.5),     # dilution: fewer shares = better
        ("total_payout_ratio", 1, 1.0),   # returning cash to owners
        ("roiic_5y", 1, 1.0),             # reinvesting at high returns
    ],
    "financial_strength_score": [
        ("debt_to_equity", -1, 1.0),      # less leverage = better
        ("interest_coverage", 1, 1.0),
        ("cash_conversion", 1, 1.0),      # profit -> cash
    ],
}

# Roadmap weights (Quality 25 / Growth 20 / Durability 20 / CapAlloc 15 /
# FinStrength 10). Valuation (10) is a SEPARATE axis (it decides when to buy, not
# whether it's a compounder) and is intentionally excluded from this score.
# composite_score renormalises whatever is present, so these needn't sum to 1.
COMPOSITE_WEIGHTS = {
    "quality_score": 0.25,
    "growth_score": 0.20,
    "durability_score": 0.20,
    "capital_allocation_score": 0.15,
    "financial_strength_score": 0.10,
}


# ============================================================
# DATA-SUFFICIENCY GATE  (the anti-false-positive guard)
# ============================================================
# All metrics that feed any pillar. Used to measure how much we actually know
# about a company before we let it carry a confident-looking score.
SCORING_METRICS = sorted({
    col for specs in PILLAR_SPECS.values() for col, _, _ in specs
})

# Without these four, a compounder judgment is meaningless. If any is missing,
# the company is LOW confidence regardless of what else is present.
CORE_METRICS = ["roic_median", "operating_margin", "revenue_cagr_10y", "fcf_margin"]

CONF_HIGH_FRAC = 0.75   # fraction of SCORING_METRICS present
CONF_MED_FRAC = 0.55


def data_confidence(df):
    """
    Return (tier, present_count) Series.

    HIGH   : all core metrics present AND >= 75% of scoring metrics present
    MEDIUM : all core metrics present AND >= 55% of scoring metrics present
    LOW    : otherwise (missing a core metric, or too sparse) -> do NOT trust

    LOW-confidence companies must be quarantined, never shown as compounders:
    a high score built on a handful of metrics is exactly the false positive
    we're trying to avoid. Thresholds are fractional so adding pillars/metrics
    doesn't silently loosen the gate.
    """
    metric_cols = [c for c in SCORING_METRICS if c in df.columns]
    total = len(metric_cols)
    present = df[metric_cols].notna().sum(axis=1)
    core_ok = df[[c for c in CORE_METRICS if c in df.columns]].notna().all(axis=1)

    tier = pd.Series("LOW", index=df.index)
    tier[core_ok & (present >= CONF_MED_FRAC * total)] = "MEDIUM"
    tier[core_ok & (present >= CONF_HIGH_FRAC * total)] = "HIGH"
    return tier, present


def score_all(df, groups=None):
    """
    Given a universe DataFrame (one row per company, summary metrics as columns),
    add pillar scores, a data-confidence tier, and the overall compounder_score.

    `groups` (e.g. a sector Series) enables sector-relative ranking.
    The compounder_score is only emitted for HIGH/MEDIUM-confidence companies;
    LOW-confidence rows keep their pillar diagnostics but get a NaN score so they
    can never surface as false positives.

    Returned sorted best-first (LOW-confidence, NaN-score rows sort to the end).
    """
    out = df.copy()
    for pillar, specs in PILLAR_SPECS.items():
        out[pillar] = score_pillar(out, specs, groups=groups)

    tier, present = data_confidence(out)
    out["data_confidence"] = tier
    out["metrics_present"] = present
    out["metrics_total"] = len([c for c in SCORING_METRICS if c in out.columns])

    raw = composite_score(out, COMPOSITE_WEIGHTS)
    out["compounder_score"] = raw.where(tier != "LOW")  # gate out LOW confidence
    return out.sort_values("compounder_score", ascending=False, na_position="last")
