"""Intraday job (every 5 minutes, 09:00–13:35 Taipei): current index and P(close above yesterday)."""
import datetime as dt
import sys

import numpy as np

from common import http_json, now_tw, read_json, write_json
from model import intraday_prob

OPEN, CLOSE = dt.time(9, 0), dt.time(13, 30)
SESSION_MIN = 270


def quote_twse():
    j = http_json("https://mis.twse.com.tw/stock/api/getStockInfo.jsp",
                  {"ex_ch": "tse_t00.tw", "json": "1", "delay": "0"}, tries=2, timeout=15)
    m = j["msgArray"][0]
    price = float(m["z"]) if m.get("z") not in (None, "-", "") else None
    return {"date": m["d"], "time": m["t"][:5], "price": price, "prev": float(m["y"]), "src": "證交所即時"}


def quote_yahoo():
    j = http_json("https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII", {"range": "1d", "interval": "1m"})
    res = j["chart"]["result"][0]
    meta = res["meta"]
    tz = dt.timezone(dt.timedelta(seconds=meta.get("gmtoffset", 28800)))
    t = dt.datetime.fromtimestamp(meta["regularMarketTime"], tz)
    return {"date": t.strftime("%Y%m%d"), "time": t.strftime("%H:%M"), "price": float(meta["regularMarketPrice"]),
            "prev": float(meta.get("chartPreviousClose") or meta.get("previousClose")), "src": "Yahoo（可能延遲）"}


def main():
    now = now_tw()
    today = now.date().isoformat()
    q, errors = None, []
    for fn in (quote_twse, quote_yahoo):
        try:
            q = fn()
            if q["price"]:
                break
        except Exception as e:
            errors.append(f"{fn.__name__}: {e}"[:300])
    status = {"run_at": now.isoformat(timespec="minutes"), "errors": errors,
              "src": q["src"] if q else None, "quote_date": q["date"] if q else None}
    if not q or not q["price"]:
        write_json("status/intraday.json", {**status, "result": "抓不到報價"}); return
    qdate = f"{q['date'][:4]}-{q['date'][4:6]}-{q['date'][6:]}"
    if qdate != today:
        write_json("status/intraday.json", {**status, "result": f"今天休市（最新報價日 {qdate}）"}); return

    taiex = read_json("taiex.json", [])
    closes = np.array([r[4] for r in taiex[-21:]], dtype=float)
    sigma = float(np.std(closes[1:] / closes[:-1] - 1)) if len(closes) > 5 else 0.012

    preds = read_json("predictions.json", [])
    open_row = next((r for r in reversed(preds) if r.get("up") is None), None)
    prior = (open_row or {}).get("p_pre") or (open_row or {}).get("p_eod") or 0.5

    hh, mm = map(int, q["time"].split(":"))
    t = dt.time(hh, mm)
    if t < OPEN:
        return
    mins_left = max(0, (CLOSE.hour * 60 + CLOSE.minute) - (hh * 60 + mm))
    r = q["price"] / q["prev"] - 1
    p = intraday_prob(r, mins_left / SESSION_MIN, sigma, prior)

    path = f"intraday/{today}.json"
    day = read_json(path) or {"date": today, "prev_close": q["prev"], "prior": prior, "sigma": sigma,
                              "made_on": (open_row or {}).get("made_on"), "points": []}
    if not day["points"] or day["points"][-1][0] != q["time"]:
        day["points"].append([q["time"], round(q["price"], 2), round(r * 100, 3), round(p, 4)])
    day["src"] = q["src"]
    write_json(path, day)
    write_json("live.json", {"date": today, "time": q["time"], "price": q["price"], "prev_close": q["prev"],
                             "ret_pct": round(r * 100, 2), "p_up": round(p, 4), "prior": prior, "src": q["src"],
                             "updated": now.isoformat(timespec="minutes")})
    write_json("status/intraday.json", {**status, "result": "已更新", "time": q["time"], "p": round(p, 4)})
    print(q, p)


if __name__ == "__main__":
    main()
