# 台股盤前看板

網站：https://syubbb.github.io/taiex-dashboard/

- `main` 分支：網站（index.html、predict.html、assets/）與資料程式（scripts/、.github/workflows/）。
- `data` 分支：所有資料，網站直接讀 raw.githubusercontent.com。
  - `data/briefs/`：每日盤前建議（Claude 排程寫入）
  - `data/watchlist.json`：觀察名單（個股 K 線、法人、營收、EPS 會抓這些）
  - `data/stocks/`：個股資料；`data/taiex.json`：加權指數日線
  - `data/predictions.json` / `predictions.csv`：每日漲跌機率紀錄（只新增、不改寫）
  - `data/intraday/`：盤中每 5 分鐘的收紅機率
- 資料來源：FinMind（台股）、證交所即時行情、Yahoo Finance（美股）。可在 Settings → Secrets 加入 `FINMIND_TOKEN` 提高抓取額度。
