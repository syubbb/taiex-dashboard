"""Collect the news items of every daily brief into one archive (newest first) for the paged timeline."""
from common import now_tw, read_json, write_json

MAX_ITEMS = 2000


def main():
    dates = read_json("briefs/index.json", [])
    items, seen = [], set()
    for d in sorted(dates, reverse=True):          # newest brief first
        b = read_json(f"briefs/{d}.json") or {}
        for n in reversed(b.get("news") or []):    # each brief lists news oldest -> newest
            key = (n.get("title") or "").strip()
            if not key or key in seen:
                continue
            seen.add(key)
            items.append({"brief": d, "time": n.get("time", ""), "dir": n.get("dir", "flat"), "title": key,
                          "detail": n.get("detail", ""), "who": n.get("who", "")})
    write_json("news.json", {"updated": now_tw().isoformat(timespec="minutes"), "count": len(items), "items": items[:MAX_ITEMS]})
    print(len(items), "news items")


if __name__ == "__main__":
    main()
