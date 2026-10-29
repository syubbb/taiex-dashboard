(function () {
  const { getJSON, esc, pct, fmt, signed, sign, todayTW, DATA } = TX;
  const $ = (s) => document.querySelector(s);
  const csvUrl = DATA + "predictions.csv";
  $("#csv").href = csvUrl;
  $("#formula").textContent = `=IMPORTDATA("${csvUrl}")`;
  $("#copyBtn").onclick = async () => {
    try { await navigator.clipboard.writeText($("#formula").textContent); $("#copyBtn").textContent = "已複製"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("#formula")); getSelection().removeAllRanges(); getSelection().addRange(r); }
  };

  const tone = (p) => (p == null ? "" : p >= 0.5 ? "up" : "down");
  const bar = (p) => `<div class="bar" aria-hidden="true"><i style="width:${(p * 100).toFixed(1)}%"></i></div>`;

  function nowSection(pre, eod, live) {
    const today = todayTW();
    const intradayOn = live && live.date === today;
    const preOk = pre && eod && pre.made_on === eod.made_on;
    const cards = [];
    if (false) cards.push(`<div class="card"><h3>今天盤中收紅機率 · ${esc(live.time)}</h3><div class="big ${tone(live.p_up)}">${pct(live.p_up)}</div>${bar(live.p_up)}<p class="foot">加權 ${fmt(live.price, 2)}（<span class="${sign(live.ret_pct)}">${signed(live.ret_pct, 2)}%</span>）　資料：${esc(live.src)}</p></div>`);
    if (preOk) cards.push(`<div class="card"><h3>${intradayOn ? "今天開盤前預估" : "下一交易日上漲機率"} · 含隔夜美股</h3><div class="big ${tone(pre.p)}">${pct(pre.p)}</div>${bar(pre.p)}<p class="foot">${esc(pre.updated.replace("T", " "))} 更新　依 ${esc(pre.made_on)} 台股收盤，已納入美股至 ${esc(pre.us_last_session.sox)}（美東日期）</p></div>`);
    else if (eod) cards.push(`<div class="card"><h3>${intradayOn ? "今天開盤前預估" : "下一交易日上漲機率"} · 含隔夜美股</h3><div class="big">更新中</div><p class="foot">美股收盤後自動重算，通常 06:00 前完成${pre ? `；上一筆 ${esc(pre.updated.replace("T", " "))}` : ""}</p></div>`);
    if (eod) cards.push(`<div class="card"><h3>台股收盤後預估 · 尚未納入美股</h3><div class="big ${tone(eod.p)}">${pct(eod.p)}</div>${bar(eod.p)}<p class="foot">${esc(TX.usMarket().line)}</p></div>`);
    const main = intradayOn ? live.p_up : preOk ? pre.p : eod ? eod.p : null;
    if (main != null) $("#headline").textContent = intradayOn ? `今天收紅機率 ${pct(main)}` : `下一交易日上漲機率 ${pct(main)}`;
    $("#stamp").textContent = intradayOn ? `盤中 ${live.time} 更新`+((m)=>m>13*60+30?"（已收盤）":`，預計 ${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")} 下次更新`)(+live.time.slice(0,2)*60+ +live.time.slice(3,5)+5) : preOk ? `盤前 ${pre.updated.slice(11, 16)} 更新` : eod ? `收盤後 ${eod.updated.slice(5, 16).replace("T", " ")} 更新` : "";
    $("#now").innerHTML = cards.length ? `<div class="two">${cards.join("")}</div>` : '<p class="empty">第一次資料更新完成後會出現在這裡。</p>';
  }

  function intradaySection(day) {
    const box = $("#intraday");
    if (!day || !day.points || !day.points.length) { box.innerHTML = TX.intradayBlock(day, window.__live); return; }
    const mob = TX.mode() === "mobile";
    const W = mob ? 380 : 760, H = mob ? 240 : 260, L = 44, R = 14, T = 16, B = 34;
    const tmin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m - 540; };
    const X = (t) => L + (Math.min(Math.max(tmin(t), 0), 270) / 270) * (W - L - R);
    const Y = (p) => T + (1 - p) * (H - T - B);
    const pts = day.points;
    const line = pts.map((q) => `${X(q[0]).toFixed(1)},${Y(q[3]).toFixed(1)}`).join(" ");
    const ticks = mob ? ["09:00", "10:30", "12:00", "13:30"] : ["09:00", "10:00", "11:00", "12:00", "13:00", "13:30"];
    const last = pts[pts.length - 1];
    box.innerHTML = `<div class="sec-head"><h2>今天盤中機率走勢</h2><p>開盤前預估 ${pct(day.prior)}　近 20 日單日波動 ${(day.sigma * 100).toFixed(2)}%　資料：${esc(day.src || "")}</p></div>
      <div class="card"><div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="盤中收紅機率走勢">
        ${[0, .25, .5, .75, 1].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" ${v === .5 ? 'stroke-dasharray="4 4"' : ""}/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="var(--muted)" font-family="var(--mono)">${v * 100}%</text>`).join("")}
        ${ticks.map((t) => `<text x="${X(t)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--mono)">${t}</text>`).join("")}
        <polyline points="${line}" fill="none" stroke="var(--navy)" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="${X(last[0])}" cy="${Y(last[3])}" r="5" fill="${last[3] >= .5 ? "var(--up)" : "var(--down)"}"/>
        <text x="${Math.min(X(last[0]) + 8, W - 60)}" y="${Y(last[3]) - 8}" font-size="13" font-weight="700" fill="var(--ink)" font-family="var(--mono)">${pct(last[3])}</text>
      </svg></div>
      <div class="tbl" style="margin-top:12px"><table><thead><tr><th>時間</th><th>加權指數</th><th>漲跌</th><th>收紅機率</th></tr></thead><tbody>
      ${pts.slice(-8).reverse().map((q) => `<tr><td>${esc(q[0])}</td><td>${fmt(q[1], 2)}</td><td class="${sign(q[2])}">${signed(q[2], 2)}%</td><td class="${tone(q[3])}">${pct(q[3])}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="foot">算法：把剩下的交易時間當成隨機波動，用近 20 日波動率估計「從現在的漲跌，收盤時仍在平盤上方」的機率；開盤那一刻等於盤前預估，越接近收盤越收斂。</p></div>`;
  }

  function whySection(pre, eod) {
    const m = pre && eod && pre.made_on === eod.made_on ? pre : eod;
    if (!m) { $("#why").innerHTML = ""; return; }
    const ds = m.drivers.slice(0, 6);
    const maxc = Math.max(...ds.map((d) => Math.abs(d.coef * d.z)), 0.01);
    const isPct = (f) => !["vol20", "money20"].includes(f);
    const drv = ds.map((d) => {
      const c = d.coef * d.z, w = Math.abs(c) / maxc * 50;
      return `<div class="drv"><span>${esc(d.label)}</span><span class="track"><i style="left:${c >= 0 ? 50 : 50 - w}%;width:${w}%;background:${c >= 0 ? "var(--up)" : "var(--down)"}"></i></span><span class="num ${sign(d.value)}" style="text-align:right">${isPct(d.feature) ? signed(d.value * 100, 2) + "%" : fmt(d.value, 3)}</span></div>`;
    }).join("");
    const bk = (rows, title, cur) => `<div class="card"><h3>${title}</h3><div class="tbl"><table><thead><tr><th>情境</th><th>天數</th><th>隔天收紅比例</th></tr></thead><tbody>
      ${rows.map((r) => `<tr ${r.label === cur ? 'style="background:var(--amber-soft)"' : ""}><td>${esc(r.label)}${r.label === cur ? "（目前）" : ""}</td><td>${fmt(r.n)}</td><td class="${r.up >= .5 ? "up" : "down"}">${r.up == null ? "—" : pct(r.up, 1)}</td></tr>`).join("")}</tbody></table></div></div>`;
    const which = (v, rows) => { const e = [-1, -.03, -.015, -.005, .005, .015, .03, 1]; for (let i = 0; i < e.length - 1; i++) if (v >= e[i] && v < e[i + 1]) return rows[i].label; return null; };
    let tables = "";
    if (pre && pre.buckets_sox) tables += bk(pre.buckets_sox, "歷史相似情境：隔夜費半漲跌 → 台股隔天收紅比例", which(pre.overnight.sox, pre.buckets_sox));
    if (eod && eod.buckets_r1) tables += bk(eod.buckets_r1, "歷史相似情境：台股當日漲跌 → 隔天收紅比例", which(eod.today_r1, eod.buckets_r1));
    $("#why").innerHTML = `<div class="sec-head"><h2>這個機率怎麼來的</h2><p>邏輯迴歸模型，用 2005 年至今的加權指數${m === pre ? "與費半、台積電 ADR、那斯達克" : ""}訓練。紅色把機率往上推、綠色往下拉，長度代表影響大小；右邊是目前數值。</p></div>
      <div class="stack"><div class="card"><div class="drivers">${drv}</div></div><div class="two">${tables}</div></div>`;
  }

  function scoreSection(pre, eod, sc) {
    const bt = (m, name) => m ? `<tr><td>${name}</td><td>${fmt(m.eval.test_days)}</td><td><b>${pct(m.eval.hit_rate, 1)}</b></td><td>${pct(m.eval.base_hit_rate, 1)}</td><td><b>${m.eval.brier.toFixed(4)}</b></td><td>${m.eval.base_brier.toFixed(4)}</td></tr>` : "";
    const live = sc && sc.n ? ["pre", "eod", "0930", "1100", "1300"].filter((k) => sc[k]).map((k) => {
      const lab = { pre: "盤前（含美股）", eod: "台股收盤後（未含美股）", "0930": "盤中 09:30", "1100": "盤中 11:00", "1300": "盤中 13:00" }[k];
      return `<tr><td>${lab}</td><td>${fmt(sc[k].n)}</td><td><b>${pct(sc[k].hit_rate, 1)}</b></td><td>${pct(sc.base_hit_rate, 1)}</td><td><b>${sc[k].brier.toFixed(4)}</b></td><td>${sc.base_brier.toFixed(4)}</td></tr>`;
    }).join("") : "";
    const cal = pre ? pre.eval.calibration : eod ? eod.eval.calibration : [];
    $("#score").innerHTML = `<div class="sec-head"><h2>成績單</h2><p>命中率越高越好、Brier 分數越低越好。「基準」是什麼都不看、只用歷史漲跌比例去猜。</p></div>
      <div class="stack">
        <div class="card"><h3>實際紀錄（從上線第一天起，每天自動對答案）</h3>
          ${live ? `<div class="tbl"><table class="rt"><thead><tr><th>預測時點</th><th>天數</th><th>命中率</th><th>基準命中率</th><th>Brier</th><th>基準 Brier</th></tr></thead><tbody>${live}</tbody></table></div>` : '<p class="empty">還沒有對過答案的紀錄。第一筆會在下一個交易日收盤後出現；至少累積 60 天再判斷有沒有價值。</p>'}</div>
        <div class="card"><h3>歷史回測（用 2018 年以前的資料訓練，測試 2019 年至今）</h3>
          <div class="tbl"><table class="rt"><thead><tr><th>模型</th><th>測試天數</th><th>命中率</th><th>基準命中率</th><th>Brier</th><th>基準 Brier</th></tr></thead><tbody>${bt(pre, "盤前（含美股）")}${bt(eod, "台股收盤後（尚未納入美股）")}</tbody></table></div>
          <h3 style="margin-top:18px">校準：說幾成會漲，實際漲了幾成（盤前模型回測）</h3>
          <div class="tbl"><table><thead><tr><th>預測機率區間</th><th>天數</th><th>平均預測</th><th>實際收紅比例</th></tr></thead><tbody>
          ${cal.map((c) => `<tr><td>${esc(c.bin)}</td><td>${fmt(c.n)}</td><td>${pct(c.pred, 1)}</td><td>${pct(c.actual, 1)}</td></tr>`).join("")}</tbody></table></div>
          <p class="foot">回測是模型「沒看過」的年份，但仍可能比實際上線表現好；真正的依據是上面的實際紀錄。</p></div>
      </div>`;
  }

  function logSection(preds) {
    const rows = [...preds].reverse().slice(0, 60);
    const p = (v) => (v == null ? "—" : `<span class="${tone(v)}">${pct(v)}</span>`);
    const hit = (v) => (v == null ? "—" : v ? "✓" : "✗");
    $("#log").innerHTML = `<div class="sec-head"><h2>每日預測紀錄</h2><p>最近 60 筆，最新在上。完整紀錄請用下方 CSV 或 Google 試算表。</p></div>
      <div class="card"><div class="tbl"><table class="rt"><thead><tr><th>目標交易日</th><th>台股收盤後（未含美股）</th><th>含隔夜美股</th><th>09:30</th><th>11:00</th><th>13:00</th><th>實際漲跌</th><th>含美股預測對錯</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.target || "下一交易日")}<br><span class="foot">（依 ${esc(r.made_on)} 收盤）</span></td><td>${p(r.p_eod)}</td><td>${p(r.p_pre)}</td><td>${p(r.p_0930)}</td><td>${p(r.p_1100)}</td><td>${p(r.p_1300)}</td><td class="${sign(r.ret_pct)}">${r.ret_pct == null ? "待開獎" : signed(r.ret_pct, 2) + "%"}</td><td>${hit(r.hit_pre ?? r.hit_eod)}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }

  async function load() {
    const [pre, eod, live, preds, sc] = await Promise.all([
      getJSON("model_pre.json").catch(() => null), getJSON("model_eod.json").catch(() => null),
      getJSON("live.json").catch(() => null), getJSON("predictions.json").catch(() => []), getJSON("scorecard.json").catch(() => null)]);
    const day = await getJSON(`intraday/${todayTW()}.json`).catch(() => null);
    window.__live = live;
    nowSection(pre, eod, live); intradaySection(day); whySection(pre, eod); scoreSection(pre, eod, sc); logSection(preds || []);
    TX.labelTables();
  }
  load();
  setInterval(load, 60000);
})();
