"""Up/down probability models for TAIEX.

eod model  : made after the close of day t, predicts P(close[t+1] > close[t]) from Taiwan data only.
pre model  : made before the open of day t+1, adds the US sessions that traded after Taiwan's close
             (Philadelphia Semiconductor index, TSMC ADR, Nasdaq), cumulative across Taiwan holidays.
Both are plain logistic regressions so every coefficient can be inspected. A walk-forward split
(train < 2019, test >= 2019) gives the out-of-sample hit rate and Brier score shown on the site,
next to the "always say it goes up with the historical frequency" baseline.
"""
import bisect
import math

import numpy as np
from sklearn.linear_model import LogisticRegression

EOD_FEATURES = ["r1", "r5", "gap20", "vol20", "money20"]
PRE_FEATURES = EOD_FEATURES + ["sox", "tsm", "ndx"]
FEATURE_LABELS = {
    "r1": "台股當日漲跌", "r5": "台股近 5 日漲跌", "gap20": "距 20 日均線", "vol20": "近 20 日波動",
    "money20": "成交值相對 20 日均量", "sox": "隔夜費半", "tsm": "隔夜台積電 ADR", "ndx": "隔夜那斯達克",
}
SPLIT = "2019-01-01"


def taiex_features(rows):
    """rows: list of dicts with date/close/money, sorted. Returns list of feature dicts (one per day)."""
    closes = np.array([r["close"] for r in rows], dtype=float)
    money = np.array([r.get("money") or 0 for r in rows], dtype=float)
    rets = np.concatenate([[np.nan], closes[1:] / closes[:-1] - 1])
    out = []
    for i, r in enumerate(rows):
        f = {"date": r["date"], "close": closes[i]}
        if i >= 21:
            f["r1"] = rets[i]
            f["r5"] = closes[i] / closes[i - 5] - 1
            f["gap20"] = closes[i] / closes[i - 19:i + 1].mean() - 1
            f["vol20"] = float(np.nanstd(rets[i - 19:i + 1]))
            m = money[i - 19:i + 1]
            f["money20"] = (money[i] / m.mean() - 1) if m.mean() > 0 else 0.0
        out.append(f)
    return out


def us_overnight(us_series, prev_tw_date, tw_date):
    """Cumulative return of a US series over sessions dated in [prev_tw_date, tw_date)."""
    dates = [d for d, _ in us_series]
    i_end = bisect.bisect_left(dates, tw_date) - 1       # last US date < tw_date
    i_start = bisect.bisect_left(dates, prev_tw_date) - 1  # last US date < prev_tw_date
    if i_end < 0 or i_start < 0 or i_end <= i_start:
        return 0.0
    return us_series[i_end][1] / us_series[i_start][1] - 1


def build_dataset(feats, us=None):
    """Rows usable for training: features at day i, target = up on day i+1."""
    X, y, dates = [], [], []
    names = PRE_FEATURES if us else EOD_FEATURES
    for i in range(len(feats) - 1):
        f, nxt = feats[i], feats[i + 1]
        if "r1" not in f:
            continue
        row = dict(f)
        if us:
            for k, s in us.items():
                row[k] = us_overnight(s, f["date"], nxt["date"])
        X.append([row[n] for n in names])
        y.append(1 if nxt["close"] > f["close"] else 0)
        dates.append(nxt["date"])
    return np.array(X, dtype=float), np.array(y), dates, names


def _fit(X, y):
    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd == 0] = 1
    m = LogisticRegression(C=1.0, max_iter=1000).fit((X - mu) / sd, y)
    return m, mu, sd


def _predict(model, mu, sd, X):
    return model.predict_proba((np.atleast_2d(X) - mu) / sd)[:, 1]


def evaluate(X, y, dates):
    tr = np.array([d < SPLIT for d in dates])
    te = ~tr
    m, mu, sd = _fit(X[tr], y[tr])
    p = _predict(m, mu, sd, X[te])
    base = y[tr].mean()
    yt = y[te]
    return {
        "test_from": SPLIT, "test_days": int(te.sum()),
        "hit_rate": float(((p >= 0.5) == (yt == 1)).mean()),
        "brier": float(((p - yt) ** 2).mean()),
        "base_rate": float(base),
        "base_hit_rate": float((yt == (1 if base >= 0.5 else 0)).mean()),
        "base_brier": float(((base - yt) ** 2).mean()),
        "calibration": calibration(p, yt),
    }


def calibration(p, y, edges=(0, .3, .4, .45, .5, .55, .6, .7, 1.01)):
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (p >= lo) & (p < hi)
        if mask.sum() == 0:
            continue
        out.append({"bin": f"{int(lo*100)}–{min(int(hi*100),100)}%", "n": int(mask.sum()),
                    "pred": float(p[mask].mean()), "actual": float(y[mask].mean())})
    return out


def train_and_predict(X, y, dates, names, x_now):
    ev = evaluate(X, y, dates)
    m, mu, sd = _fit(X, y)
    p = float(_predict(m, mu, sd, np.array(x_now, dtype=float))[0])
    coefs = sorted(
        [{"feature": n, "label": FEATURE_LABELS[n], "coef": float(c), "value": float(v),
          "z": float((v - mu[i]) / sd[i])}
         for i, (n, c, v) in enumerate(zip(names, m.coef_[0], x_now))],
        key=lambda d: -abs(d["coef"] * d["z"]))
    return p, ev, coefs


def bucket_stats(values, y, edges, labels):
    out = []
    for (lo, hi), lab in zip(zip(edges[:-1], edges[1:]), labels):
        mask = (values >= lo) & (values < hi)
        n = int(mask.sum())
        out.append({"label": lab, "n": n, "up": float(y[mask].mean()) if n else None})
    return out


def norm_cdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def norm_ppf(p):
    p = min(max(p, 1e-6), 1 - 1e-6)
    # Acklam's approximation
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549671010336652e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    pl = 0.02425
    if p < pl:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    if p > 1 - pl:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    q = p - 0.5
    r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


def intraday_prob(r_now, frac_left, sigma_day, p_prior):
    """P(close > previous close) during the session.

    Remaining move ~ Normal(mu*f, sigma^2*f) where f is the fraction of the session left.
    mu is set so that before the open (r=0, f=1) the answer equals the pre-market probability,
    so the curve starts at p_prior and converges to 0/1 as the close approaches.
    """
    f = max(frac_left, 1e-4)
    mu = sigma_day * norm_ppf(p_prior)
    return norm_cdf((r_now + mu * f) / (sigma_day * math.sqrt(f)))
