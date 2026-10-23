"""Pre-market job (before 09:00 Taipei): add overnight US moves and update the next-session probability."""
import numpy as np

from common import now_tw, read_json, taiex_history, write_json, yahoo_daily
from model import build_dataset, taiex_features, train_and_predict, bucket_stats, us_overnight
from eod import scorecard, write_csv


def load_taiex():
    cached = read_json("taiex.json")
    if cached:
        return [{"date": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "money": r[5] * 1e8}
                for r in cached]
    return taiex_history()


def main():
    taiex = load_taiex()
    us = {"sox": yahoo_daily("^SOX", "25y"), "tsm": yahoo_daily("TSM", "25y"), "ndx": yahoo_daily("^IXIC", "25y")}
    feats = taiex_features(taiex)
    X, y, dates, names = build_dataset(feats, us)

    today = now_tw().date().isoformat()
    last = feats[-1]
    overnight = {k: us_overnight(s, last["date"], today) for k, s in us.items()}
    x_now = [last[n] if n in last else overnight[n] for n in names]
    p, ev, coefs = train_and_predict(X, y, dates, names, x_now)

    sox_col = X[:, names.index("sox")]
    buckets = bucket_stats(sox_col, y, [-1, -.03, -.015, -.005, .005, .015, .03, 1],
                           ["費半跌 3% 以上", "跌 1.5–3%", "跌 0.5–1.5%", "平盤 ±0.5%", "漲 0.5–1.5%", "漲 1.5–3%", "費半漲 3% 以上"])
    us_last = {k: s[-1][0] for k, s in us.items()}
    write_json("model_pre.json", {
        "made_on": last["date"], "run_date": today, "p": p, "eval": ev, "drivers": coefs,
        "overnight": overnight, "us_last_session": us_last, "buckets_sox": buckets,
        "updated": now_tw().isoformat(timespec="minutes")}, compact=False)

    preds = read_json("predictions.json", [])
    row = next((r for r in preds if r["made_on"] == last["date"]), None)
    if row is None:
        row = {"made_on": last["date"], "target": None}
        preds.append(row)
    if row.get("up") is None:  # never touch a resolved row
        row["p_pre"] = round(p, 4)
        row["pre_at"] = now_tw().isoformat(timespec="minutes")
    write_json("predictions.json", preds, compact=False)
    write_json("scorecard.json", scorecard(preds), compact=False)
    write_csv(preds)
    print("pre p", p, overnight)


if __name__ == "__main__":
    main()
