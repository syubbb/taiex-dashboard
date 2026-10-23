"""After-close job: resolve yesterday's prediction, predict the next session, refresh stock data."""
import csv
import io
import sys
import time

import numpy as np

from common import DATA, finmind, now_tw, read_json, taiex_history, write_json
from model import build_dataset, taiex_features, train_and_predict, bucket_stats

CSV_FIELDS = ["made_on", "target", "p_eod", "eod_at", "p_pre", "pre_at", "p_0930", "p_1100", "p_1300",
              "prev_close", "close", "ret_pct", "up", "hit_eod", "hit_pre", "brier_eod", "brier_pre"]


def next_trading_after(dates, d):
    for x in dates:
        if x > d:
            return x
    return None


def snapshot(points, hhmm):
    """Probability at the first intraday point at or after hh:mm."""
    for t, *_rest, p in points:
        if t >= hhmm:
            return p
    return None


def resolve(preds, taiex):
    by_date = {r["date"]: r for r in taiex}
    dates = [r["date"] for r in taiex]
    for row in preds:
        if row.get("up") is not None:
            continue
        tgt = next_trading_after(dates, row["made_on"])
        if not tgt:
            continue
        prev = by_date[row["made_on"]]["close"]
        close = by_date[tgt]["close"]
        up = 1 if close > prev else 0
        row.update({"target": tgt, "prev_close": prev, "close": close,
                    "ret_pct": round((close / prev - 1) * 100, 3), "up": up})
        for k in ("eod", "pre"):
            p = row.get(f"p_{k}")
            if p is not None:
                row[f"hit_{k}"] = 1 if (p >= 0.5) == (up == 1) else 0
                row[f"brier_{k}"] = round((p - up) ** 2, 4)
        intr = read_json(f"intraday/{tgt}.json")
        if intr:
            for hh in ("09:30", "11:00", "13:00"):
                row["p_" + hh.replace(":", "")] = snapshot(intr.get("points", []), hh)


def scorecard(preds):
    done = [r for r in preds if r.get("up") is not None]
    out = {"n": len(done)}
    if not done:
        return out
    ups = np.array([r["up"] for r in done])
    out["up_rate"] = float(ups.mean())
    for k in ("eod", "pre", "0930", "1100", "1300"):
        rows = [r for r in done if r.get(f"p_{k}") is not None]
        if not rows:
            continue
        p = np.array([r[f"p_{k}"] for r in rows])
        y = np.array([r["up"] for r in rows])
        out[k] = {"n": len(rows), "hit_rate": float(((p >= .5) == (y == 1)).mean()),
                  "brier": float(((p - y) ** 2).mean())}
    # baseline: always forecast the running up-rate of the log itself (known only after the fact, so it is generous)
    out["base_brier"] = float(((ups.mean() - ups) ** 2).mean())
    out["base_hit_rate"] = float(max(ups.mean(), 1 - ups.mean()))
    return out


CSV_HEADERS = {
    "made_on": "依據收盤日", "target": "預測交易日",
    "p_eod": "台股收盤後機率（未含美股）", "eod_at": "收盤後預測時間",
    "p_pre": "含隔夜美股機率", "pre_at": "含美股預測時間",
    "p_0930": "盤中09:30機率", "p_1100": "盤中11:00機率", "p_1300": "盤中13:00機率",
    "prev_close": "前一日收盤", "close": "當日收盤", "ret_pct": "漲跌幅%",
    "up": "實際收紅（1紅0黑）", "hit_eod": "收盤後預測對錯（1對0錯）", "hit_pre": "含美股預測對錯（1對0錯）",
    "brier_eod": "收盤後Brier（越低越準）", "brier_pre": "含美股Brier（越低越準）",
}


def _cell(k, v):
    if v is None:
        return ""
    if k.endswith("_at") and isinstance(v, str):
        return v.replace("T", " ")[:16]  # 2026-10-23 18:16
    return v


def write_csv(preds):
    """Chinese headers for people opening the sheet; column order is fixed so sheet formulas keep working."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([CSV_HEADERS[k] for k in CSV_FIELDS])
    for r in preds:
        w.writerow([_cell(k, r.get(k)) for k in CSV_FIELDS])
    (DATA / "predictions.csv").write_text(buf.getvalue(), encoding="utf-8")


# ---------- stocks ----------

def stock_payload(code, name, industry, since):
    px = finmind("TaiwanStockPrice", code, since)
    bars = [[r["date"], r["open"], r["max"], r["min"], r["close"], round(r["Trading_Volume"] / 1000)]
            for r in px if r.get("close")]
    div = finmind("TaiwanStockDividendResult", code, since)
    factors = [[r["date"], round(r["after_price"] / r["before_price"], 6)]
               for r in div if r.get("before_price") and r.get("after_price")]
    start_inst = bars[-130][0] if len(bars) > 130 else since
    inst_raw = finmind("TaiwanStockInstitutionalInvestorsBuySell", code, start_inst)
    inst = {}
    for r in inst_raw:
        d = inst.setdefault(r["date"], [0, 0, 0])
        net = (r.get("buy", 0) - r.get("sell", 0)) / 1000
        n = r["name"]
        if n.startswith("Foreign"):
            d[0] += net
        elif n == "Investment_Trust":
            d[1] += net
        elif n.startswith("Dealer"):
            d[2] += net
    inst_rows = [[k, round(v[0]), round(v[1]), round(v[2])] for k, v in sorted(inst.items())]
    y0 = int(bars[-1][0][:4]) - 4 if bars else 2022
    rev_raw = finmind("TaiwanStockMonthRevenue", code, f"{y0}-01-01")
    revm = {(r["revenue_year"], r["revenue_month"]): r["revenue"] for r in rev_raw}
    rev = []
    for (yy, mm), v in sorted(revm.items()):
        ly = revm.get((yy - 1, mm))
        pm = revm.get((yy, mm - 1) if mm > 1 else (yy - 1, 12))
        rev.append([f"{yy}-{mm:02d}", round(v / 1e8, 2),
                    round((v / ly - 1) * 100, 1) if ly else None,
                    round((v / pm - 1) * 100, 1) if pm else None])
    fin = finmind("TaiwanStockFinancialStatements", code, f"{y0}-01-01")
    eps = []
    for r in fin:
        if r.get("type") == "EPS":
            y, m = r["date"][:4], int(r["date"][5:7])
            eps.append([f"{y}Q{(m - 1) // 3 + 1}", r["value"]])
    eps.sort()
    return {"code": code, "name": name, "industry": industry, "updated": now_tw().isoformat(timespec="minutes"),
            "bars": bars, "factors": factors, "inst": inst_rows, "rev": rev[-36:], "eps": eps[-16:]}


def refresh_stocks():
    wl = read_json("watchlist.json", [])
    info = {r["stock_id"]: r for r in finmind("TaiwanStockInfo")}
    index = []
    since = "2014-01-01"
    for item in wl:
        code = item["code"]
        meta = info.get(code, {})
        name = item.get("name") or meta.get("stock_name", code)
        try:
            payload = stock_payload(code, name, meta.get("industry_category", ""), since)
            write_json(f"stocks/{code}.json", payload)
            last = payload["bars"][-1] if payload["bars"] else None
            prev = payload["bars"][-2] if len(payload["bars"]) > 1 else None
            index.append({"code": code, "name": name, "close": last[4] if last else None,
                          "chg_pct": round((last[4] / prev[4] - 1) * 100, 2) if last and prev else None})
            print("ok", code, name, len(payload["bars"]))
        except Exception as e:
            print("FAIL", code, e, file=sys.stderr)
        time.sleep(0.5)
    write_json("stocks/index.json", {"updated": now_tw().isoformat(timespec="minutes"), "items": index})


def main():
    taiex = taiex_history()
    write_json("taiex.json", [[r["date"], r["open"], r["high"], r["low"], r["close"], round(r["money"] / 1e8)]
                              for r in taiex])
    last = taiex[-1]["date"]
    print("TAIEX last date", last)

    preds = read_json("predictions.json", [])
    resolve(preds, taiex)

    feats = taiex_features(taiex)
    X, y, dates, names = build_dataset(feats)
    x_now = [feats[-1][n] for n in names]
    p, ev, coefs = train_and_predict(X, y, dates, names, x_now)
    r1 = np.array([row[0] for row in X])
    buckets = bucket_stats(r1, y, [-1, -.03, -.015, -.005, .005, .015, .03, 1],
                           ["跌 3% 以上", "跌 1.5–3%", "跌 0.5–1.5%", "平盤 ±0.5%", "漲 0.5–1.5%", "漲 1.5–3%", "漲 3% 以上"])
    write_json("model_eod.json", {"made_on": last, "p": p, "eval": ev, "drivers": coefs, "buckets_r1": buckets,
                                  "today_r1": float(feats[-1]["r1"]),
                                  "updated": now_tw().isoformat(timespec="minutes")}, compact=False)

    if not any(r["made_on"] == last for r in preds):
        preds.append({"made_on": last, "target": None, "p_eod": round(p, 4),
                      "eod_at": now_tw().isoformat(timespec="minutes")})
    write_json("predictions.json", preds, compact=False)
    write_json("scorecard.json", scorecard(preds), compact=False)
    write_csv(preds)

    if "--no-stocks" not in sys.argv:
        refresh_stocks()


if __name__ == "__main__":
    main()
