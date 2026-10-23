// Stock detail panel: K-line (daily/weekly/monthly, adjusted or raw), institutional flows, revenue, EPS.
window.StockPanel = (function () {
  const { getJSON, esc, fmt, signed, sign } = TX;
  let chart = null, ro = null;

  function adjust(bars, factors) {
    // Backward adjustment: every bar before an ex-rights date is multiplied by that date's factor.
    const fs = [...factors].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    let m = 1, k = 0;
    const out = new Array(bars.length);
    for (let i = bars.length - 1; i >= 0; i--) {
      const b = bars[i];
      while (k < fs.length && b[0] < fs[k][0]) { m *= fs[k][1]; k++; }
      out[i] = [b[0], b[1] * m, b[2] * m, b[3] * m, b[4] * m, b[5]];
    }
    return out;
  }

  function resample(bars, period) {
    if (period === "D") return bars;
    const key = (d) => {
      if (period === "M") return d.slice(0, 7);
      const dt = new Date(d + "T00:00:00Z");
      const day = (dt.getUTCDay() + 6) % 7; // Monday = 0
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    };
    const out = [];
    let cur = null, ck = null;
    for (const b of bars) {
      const k = key(b[0]);
      if (k !== ck) { if (cur) out.push(cur); cur = [b[0], b[1], b[2], b[3], b[4], b[5]]; ck = k; }
      else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; cur[5] += b[5]; }
    }
    if (cur) out.push(cur);
    return out;
  }

  function ma(bars, n) {
    const out = []; let s = 0;
    for (let i = 0; i < bars.length; i++) {
      s += bars[i][4]; if (i >= n) s -= bars[i - n][4];
      if (i >= n - 1) out.push({ time: bars[i][0], value: +(s / n).toFixed(2) });
    }
    return out;
  }

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function draw(el, data, state, legend) {
    if (chart) { chart.remove(); chart = null; }
    if (ro) { ro.disconnect(); ro = null; }
    let bars = state.adj ? adjust(data.bars, data.factors) : data.bars;
    bars = resample(bars, state.period);
    const up = css("--up"), down = css("--down");
    chart = LightweightCharts.createChart(el, {
      autoSize: true,
      layout: { background: { color: css("--paper") }, textColor: css("--muted"), fontFamily: "IBM Plex Mono, monospace" },
      grid: { vertLines: { color: css("--line") }, horzLines: { color: css("--line") } },
      rightPriceScale: { borderColor: css("--line") },
      timeScale: { borderColor: css("--line") },
      crosshair: { mode: 0 },
      localization: { locale: "zh-TW" },
    });
    const lastPx = bars.length ? bars[bars.length - 1][4] : 100;
    const prec = lastPx >= 1000 ? 0 : lastPx >= 100 ? 1 : 2;
    const candle = chart.addCandlestickSeries({ priceFormat: { type: "price", precision: prec, minMove: 1 / 10 ** prec }, upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
    candle.setData(bars.map((b) => ({ time: b[0], open: +b[1].toFixed(2), high: +b[2].toFixed(2), low: +b[3].toFixed(2), close: +b[4].toFixed(2) })));
    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(bars.map((b, i) => ({ time: b[0], value: b[5], color: (i && b[4] < bars[i - 1][4]) ? down + "66" : up + "66" })));
    const lines = [[5, "#d08c1c"], [20, "#5b7cc4"], [60, "#9a5cb4"]];
    lines.forEach(([n, c]) => chart.addLineSeries({ color: c, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(ma(bars, n)));
    // visible range
    const spans = { "3M": 92, "6M": 183, "1Y": 366, "3Y": 1096, "5Y": 1827 };
    if (state.range !== "ALL" && bars.length) {
      const end = new Date(bars[bars.length - 1][0]);
      const start = new Date(end - spans[state.range] * 864e5).toISOString().slice(0, 10);
      chart.timeScale().setVisibleRange({ from: start, to: bars[bars.length - 1][0] });
    } else chart.timeScale().fitContent();
    const last = bars[bars.length - 1];
    const show = (b, prev) => {
      if (!b) return;
      const chg = prev ? b[4] - prev[4] : 0;
      legend.innerHTML = `<span>${esc(b[0])}</span><span>開 ${fmt(b[1], 2)}</span><span>高 ${fmt(b[2], 2)}</span><span>低 ${fmt(b[3], 2)}</span><span class="${sign(chg)}">收 ${fmt(b[4], 2)}（${signed(chg, 2)}）</span><span>量 ${fmt(b[5])} 張</span><span style="color:#d08c1c">MA5</span><span style="color:#5b7cc4">MA20</span><span style="color:#9a5cb4">MA60</span>`;
    };
    show(last, bars[bars.length - 2]);
    const idx = new Map(bars.map((b, i) => [b[0], i]));
    chart.subscribeCrosshairMove((p) => {
      if (!p.time) return show(last, bars[bars.length - 2]);
      const i = idx.get(typeof p.time === "string" ? p.time : `${p.time.year}-${String(p.time.month).padStart(2, "0")}-${String(p.time.day).padStart(2, "0")}`);
      if (i != null) show(bars[i], bars[i - 1]);
    });
  }

  function seg(name, opts, cur) {
    return `<div class="seg" role="group" aria-label="${name}">${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${v === cur}">${l}</button>`).join("")}</div>`;
  }

  function instTable(inst) {
    const rows = inst.slice(-10).reverse();
    const sum = (n, k) => inst.slice(-n).reduce((s, r) => s + r[k], 0);
    const cell = (v) => `<td class="${sign(v)}">${signed(v)}</td>`;
    return `<div class="tbl"><table><thead><tr><th>日期</th><th>外資</th><th>投信</th><th>自營商</th><th>合計</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r[0].slice(5))}</td>${cell(r[1])}${cell(r[2])}${cell(r[3])}${cell(r[1] + r[2] + r[3])}</tr>`).join("")}
      <tr><td>近 5 日</td>${cell(sum(5, 1))}${cell(sum(5, 2))}${cell(sum(5, 3))}${cell(sum(5, 1) + sum(5, 2) + sum(5, 3))}</tr>
      <tr><td>近 20 日</td>${cell(sum(20, 1))}${cell(sum(20, 2))}${cell(sum(20, 3))}${cell(sum(20, 1) + sum(20, 2) + sum(20, 3))}</tr>
      </tbody></table></div><p class="foot">單位：張。正數為買超（紅）、負數為賣超（綠）。</p>`;
  }

  function revTable(rev) {
    const rows = rev.slice(-12).reverse();
    const cell = (v) => `<td class="${sign(v)}">${v == null ? "—" : signed(v, 1) + "%"}</td>`;
    return `<div class="tbl"><table><thead><tr><th>月份</th><th>營收（億元）</th><th>年增</th><th>月增</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${fmt(r[1], 2)}</td>${cell(r[2])}${cell(r[3])}</tr>`).join("")}</tbody></table></div>`;
  }

  function epsTable(eps, close) {
    const rows = eps.slice(-8).reverse();
    const ttm = eps.slice(-4).reduce((s, r) => s + r[1], 0);
    const pe = eps.length >= 4 && ttm > 0 ? close / ttm : null;
    return `<div class="kpis"><span>近四季 EPS <b>${fmt(ttm, 2)}</b> 元</span><span>本益比 <b>${pe ? fmt(pe, 1) + " 倍" : "—"}</b></span></div>
      <div class="tbl"><table><thead><tr><th>季度</th><th>EPS（元）</th><th>年增</th></tr></thead><tbody>
      ${rows.map((r) => { const ly = eps.find((x) => x[0] === (+r[0].slice(0, 4) - 1) + r[0].slice(4)); const g = ly && ly[1] ? (r[1] / ly[1] - 1) * 100 : null; return `<tr><td>${esc(r[0])}</td><td>${fmt(r[1], 2)}</td><td class="${sign(g)}">${g == null ? "—" : signed(g, 1) + "%"}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }

  async function open(host, code, name) {
    host.innerHTML = `<div class="panel"><div class="panel-h"><b>${esc(name)}</b><span class="num">${esc(code)}</span><button type="button" class="x">收起</button></div><p class="empty">正在載入 K 線與財報資料…</p></div>`;
    host.querySelector(".x").onclick = () => close(host);
    let data;
    try { data = await getJSON(`stocks/${code}.json`); }
    catch (e) {
      host.querySelector(".empty").textContent = "這檔股票的資料還沒抓到。每天 16:05 收盤後會更新觀察名單上的股票，新加入的股票隔天才會有資料。";
      return;
    }
    const last = data.bars[data.bars.length - 1], prev = data.bars[data.bars.length - 2];
    const chg = last[4] - prev[4];
    const state = { period: "D", adj: true, range: "1Y" };
    host.innerHTML = `<div class="panel">
      <div class="panel-h"><b>${esc(data.name)}</b><span class="num">${esc(code)}</span><span class="foot">${esc(data.industry || "")}</span>
        <span class="num ${sign(chg)}" style="font-size:18px">${fmt(last[4], 2)}　${signed(chg, 2)}（${signed(chg / prev[4] * 100, 2)}%）</span>
        <button type="button" class="x">收起</button></div>
      <div class="ctrls">${seg("period", [["D", "日K"], ["W", "週K"], ["M", "月K"]], "D")}${seg("adj", [["1", "還原"], ["0", "原始"]], "1")}${seg("range", [["3M", "3月"], ["6M", "6月"], ["1Y", "1年"], ["3Y", "3年"], ["5Y", "5年"], ["ALL", "全部"]], "1Y")}</div>
      <div class="kleg"></div>
      <div class="kchart"></div>
      <p class="foot">還原：把除權息造成的價格缺口補回，看長期真實漲幅。資料自 2014 年起，${esc(data.bars[data.bars.length - 1][0])} 收盤更新。</p>
      <div class="two">
        <div><h3>三大法人買賣超</h3>${instTable(data.inst)}</div>
        <div class="stack" style="gap:24px"><div><h3>獲利（EPS）</h3>${epsTable(data.eps, last[4])}</div></div>
      </div>
      <div><h3>月營收</h3>${revTable(data.rev)}</div>
    </div>`;
    host.querySelector(".x").onclick = () => close(host);
    const el = host.querySelector(".kchart"), legend = host.querySelector(".kleg");
    const redraw = () => draw(el, data, state, legend);
    host.querySelector(".ctrls").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.period) state.period = b.dataset.period;
      if (b.dataset.adj) state.adj = b.dataset.adj === "1";
      if (b.dataset.range) state.range = b.dataset.range;
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      redraw();
    });
    redraw();
    host.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function close(host) {
    if (chart) { chart.remove(); chart = null; }
    host.innerHTML = "";
    document.querySelectorAll('.stk[aria-expanded="true"]').forEach((b) => b.setAttribute("aria-expanded", "false"));
  }

  return { open, close };
})();
