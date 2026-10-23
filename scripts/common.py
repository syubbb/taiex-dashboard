"""Shared helpers for the data jobs: HTTP fetching, FinMind, Yahoo, JSON/CSV I/O."""
import json
import os
import time
import datetime as dt
from pathlib import Path

import requests

TZ = dt.timezone(dt.timedelta(hours=8))
DATA = Path(os.environ.get("DATA_DIR", "data-branch/data"))
UA = {"User-Agent": "Mozilla/5.0 (taiex-dashboard; +https://github.com/syubbb/taiex-dashboard)"}
FINMIND = "https://api.finmindtrade.com/api/v4/data"


def now_tw():
    return dt.datetime.now(TZ)


def http_json(url, params=None, tries=3, timeout=30):
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:  # network hiccup
            last = repr(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"fetch failed {url} {params}: {last}")


def finmind(dataset, data_id=None, start=None, end=None):
    params = {"dataset": dataset}
    if data_id:
        params["data_id"] = data_id
    if start:
        params["start_date"] = start
    if end:
        params["end_date"] = end
    token = os.environ.get("FINMIND_TOKEN")
    if token:
        params["token"] = token
    j = http_json(FINMIND, params)
    if j.get("status") != 200:
        raise RuntimeError(f"FinMind {dataset} {data_id}: {j.get('msg')}")
    return j.get("data", [])


def yahoo_daily(symbol, rng="15y"):
    """Daily closes from Yahoo chart API -> list of (date_str_us, close)."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{requests.utils.quote(symbol)}"
    j = http_json(url, {"range": rng, "interval": "1d"})
    res = j["chart"]["result"][0]
    ts = res["timestamp"]
    q = res["indicators"]["quote"][0]
    tz = dt.timezone(dt.timedelta(seconds=res["meta"].get("gmtoffset", 0)))
    out = []
    for t, c in zip(ts, q["close"]):
        if c is None:
            continue
        out.append((dt.datetime.fromtimestamp(t, tz).date().isoformat(), float(c)))
    # Yahoo can return today's partial bar twice; keep last per date
    d = {}
    for k, v in out:
        d[k] = v
    return sorted(d.items())


def read_json(path, default=None):
    p = DATA / path
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(path, obj, compact=True):
    p = DATA / path
    p.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    else:
        txt = json.dumps(obj, ensure_ascii=False, indent=1)
    p.write_text(txt, encoding="utf-8")


def taiex_history():
    rows = finmind("TaiwanStockPrice", "TAIEX", "2005-01-01")
    return [
        {"date": r["date"], "open": r["open"], "high": r["max"], "low": r["min"],
         "close": r["close"], "money": r.get("Trading_money", 0)}
        for r in rows if r.get("close")
    ]
