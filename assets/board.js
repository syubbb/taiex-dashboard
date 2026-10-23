// Main board: probability strip, today's brief, what changed, sector map with clickable stocks.
(function () {
  const { getJSON, esc, dirCls, pct, fmt, signed, sign, points, todayTW } = TX;
  const $ = (s) => document.querySelector(s);
  let briefIndex = [], brief = null, tab = "hot", prices = {};
  try { tab = localStorage.getItem("sectorTab") || "hot"; } catch (e) {}

  async function renderProb() {
    const box = $("#prob");
    const [live, pre, eod] = await Promise.all([
      getJSON("live.json").catch(() => null), getJSON("model_pre.json").catch(() => null), getJSON("model_eod.json").catch(() => null)]);
    const cells = [];
    const pNext = pre && eod && pre.made_on === eod.made_on ? pre : null;
    if (pNext) cells.push(`<div><div class="l">${live && live.date === todayTW() ? "今天開盤前預估（含隔夜美股）" : "下一交易日上漲機率（含隔夜美股）"}</div><div class="v ${pNext.p >= .5 ? "up" : "down"}">${pct(pNext.p)}</div><div class="s">已納入美股至 ${esc(pre.us_last_session.sox.slice(5))}（美東）　隔夜費半 <span class="${sign(pre.overnight.sox)}">${signed(pre.overnight.sox * 100, 2)}%</span></div></div>`);
    if (eod) cells.push(`<div><div class="l">台股收盤後預估（尚未納入美股）</div><div class="v ${eod.p >= .5 ? "up" : "down"}">${pct(eod.p)}</div><div class="s">${esc(TX.usMarket().line)}</div></div>`);
    if (!cells.length) { box.innerHTML = `<div><div class="l">漲跌機率</div><div class="s">第一次資料更新完成後會出現在這裡。</div></div>`; return; }
    cells.push(`<div><div class="l">準不準？</div><div class="s" style="margin:6px 0 8px">每一筆預測都留紀錄、隔天對答案。</div><a href="predict.html">看漲跌機率與成績單 →</a></div>`);
    box.innerHTML = cells.join("");
    const day = await getJSON(`intraday/${todayTW()}.json`).catch(() => null);
    $("#intra").innerHTML = TX.intradayBlock(day, live);
  }

  function renderBrief(b) {
    const st = b.stance || {};
    const tone = st.tone === "bull" ? "bull" : st.tone === "bear" ? "bear" : "";
    const days = (b.days || []).map((d) => `<div class="day ${esc(d.k || "")}"><b>${esc(d.d)}</b><span>${esc(d.w)}</span><span>${esc(d.t)}</span></div>`).join("");
    const mets = (b.metrics || []).map((m) => `<div class="metric"><div class="l">${esc(m.label)}</div><div class="v ${m.dir === "down" ? "down" : m.dir === "up" ? "up" : ""}">${esc(m.value)}</div><div class="c ${dirCls(m.dir)}">${esc(m.chg || "")}</div>${m.sub ? `<div class="s">${esc(m.sub)}</div>` : ""}</div>`).join("");
    const lv = b.levels || {};
    const list = (a) => (a || []).map(esc).join("<br>");
    $("#brief").innerHTML = `
      <div class="stack">
        <div class="meta"><span class="tag">${esc(b.session || "盤前 · 09:00 前")}</span><span>${esc(b.dateLabel || b.date)}</span><span>${esc(b.asOf || "")}</span></div>
        <h1>${esc(b.headline)}</h1>
        <p class="lede">${esc(b.lede)}</p>
        <div class="card stance">
          <div class="stance-head"><div><span class="stance-word ${tone}">${esc(st.label || "觀察")}</span><span class="stance-h">${esc(st.horizon || "")}</span></div><span class="stance-note">${esc(st.note || "")}</span></div>
          <div class="days">${days}</div>
        </div>
        <div class="metrics">${mets}</div>
        <div class="two">
          <div class="card"><h3>關鍵價位</h3><div class="levels">
            <div class="lv"><span class="k r">壓力</span><span>${list(lv.resistance)}</span></div>
            <div class="lv"><span class="k s">支撐</span><span>${list(lv.support)}</span></div></div></div>
          <div class="card"><h3>今天盯這幾件事</h3><ol class="check">${(b.checklist || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ol></div>
        </div>
      </div>`;
  }

  function renderChanges(b) {
    const box = $("#changes");
    const cmp = b.compare || {}, news = b.news || [], rc = b.recap, log = b.changelog || [];
    if (!(cmp.rows || []).length && !news.length && !rc && !log.length) { box.hidden = true; return; }
    const imp = (d) => (d === "up" ? "利多" : d === "down" ? "利空" : "中性");
    const rows = (cmp.rows || []).map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.before)}</td><td class="${dirCls(r.dir)}">${esc(r.after)}</td><td class="${dirCls(r.dir)}">${esc(r.chg || "")}</td></tr>`).join("");
    const nws = news.map((n) => `<div class="nw"><time>${esc(n.time)}</time><span class="pill ${dirCls(n.dir)}">${imp(n.dir)}</span><div class="t">${esc(n.title)}</div><div class="d">${esc(n.detail)}</div>${n.who ? `<div class="w">影響族群：${esc(n.who)}</div>` : ""}</div>`).join("");
    let recap = "";
    if (rc) {
      const nums = (rc.numbers || []).map((n) => `<span>${esc(n.label)} <b class="${dirCls(n.dir)}">${esc(n.value)}</b></span>`).join("");
      recap = `<div class="card"><h3>${esc(rc.title || "盤勢回顧")}</h3>${nums ? `<div class="recap-num">${nums}</div>` : ""}<ul class="plain">${(rc.points || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`;
    }
    const logHtml = log.length ? `<div class="card"><h3>這次更新做了什麼</h3><ul class="plain">${log.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : "";
    const srcs = b.sources || [];
    box.hidden = false;
    box.innerHTML = `
      <div class="sec-head"><h2>上次更新後發生什麼</h2><p>${esc(cmp.window || "")}</p></div>
      <div class="stack">
        ${rows ? `<div class="card" style="overflow-x:auto"><table class="cmp"><thead><tr><th>指標</th><th>${esc(cmp.beforeLabel || "上次")}</th><th>${esc(cmp.afterLabel || "這次")}</th><th>變化</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
        ${nws ? `<div class="card"><h3>新聞時間線</h3><div class="news">${nws}</div></div>` : ""}
        ${recap || logHtml ? `<div class="two">${recap}${logHtml}</div>` : ""}
        ${srcs.length ? `<details class="src"><summary>資料來源（${srcs.length}）</summary><ul>${srcs.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("")}</ul></details>` : ""}
      </div>`;
  }

  // Each bullet gets a category chip so a reader can tell a demand driver from a flow or a valuation point at a glance.
  const WHY_TAGS = [["籌碼", /外資|投信|自營|買超|賣超|融資|提款|籌碼|連續大買|掃貨/],
    ["漲價", /漲價|報價|盤價|合約價|調漲|價格從|價格上/], ["競爭", /長鑫|競爭|對手|轉單/], ["需求", /需求|訂單|拉貨|出貨|產能|擴產|缺貨|供不應求|稼動率|放量|量產|部署|採購|建置/],
    ["獲利", /EPS|獲利|營收|毛利|淨利/], ["評價", /目標價|本益比|評價|估值|漲太多|漲多/], ["事件", /宣布|公布|峰會|財報|法說|選舉|公投|延後|延到|傳出/]];
  const OUT_TAGS = [["觀察點", /訊號|轉折|觀察|確認|要等|等量|看量|是加碼|觀察點/], ["短線", /短線|近期|先跌|先看/], ["中長期", /中期|長線|數季|年|季/]];
  const tagOf = (t, rules, dflt) => { const it = typeof t === "object" && t ? t : null; if (it && it.tag) return it.tag; for (const [k, re] of rules) if (re.test(t)) return k; return dflt; };
  const textOf = (t) => (typeof t === "object" && t ? t.text : t);
  const STATUS = { hot: ["主流", "up"], cool: ["降溫", "down"], rise: ["可能轉好", "amber"] };

  let openKey = null, innerTab = "why";
  try { openKey = localStorage.getItem("sectorOpen"); innerTab = localStorage.getItem("sectorInner") || "why"; } catch (e) {}

  function renderSectors(b) {
    const box = $("#sectors");
    const S = b.sectors;
    if (!S) { box.hidden = true; return; }
    const cats = ["hot", "cool", "rise"];
    const list = (v) => (Array.isArray(v) ? v : points(v));
    const item = (chip, body) => `<li><span class="tg">${esc(chip)}</span>${esc(body)}</li>`;
    const panes = {
      why: ["原因", (g) => list(g.why).map((t) => item(tagOf(t, WHY_TAGS, "說明"), textOf(t)))],
      out: ["走勢", (g) => list(g.outlook).map((t) => item(tagOf(t, OUT_TAGS, "走勢"), textOf(t)))],
      best: ["誰較好", (g) => list(g.best).map((t) => { const x = textOf(t); const m = x.match(/^([^：:]{1,8})[：:](.+)$/); return m ? item(m[1], m[2].trim()) : item("建議", x); })],
      risk: ["風險", (g) => list(g.risk).map((t) => item("風險", textOf(t)))],
      stk: ["個股", null],
    };
    const chip = (s) => {
      const px = prices[s.code];
      return `<button type="button" class="stk ${s.best ? "best" : ""}" data-code="${esc(s.code)}" data-name="${esc(s.name)}" aria-expanded="false">
        <span class="top"><b>${esc(s.name)}</b><code>${esc(s.code)}</code>${s.best ? '<span class="badge">較看好</span>' : ""}${px && px.close != null ? `<span class="px ${sign(px.chg_pct)}">${fmt(px.close, 2)} ${signed(px.chg_pct, 2)}%</span>` : ""}</span>
        <p>${esc(s.note)}</p></button>`;
    };
    const detail = (g) => {
      const tabs = Object.entries(panes).map(([k, [l]]) => `<button type="button" data-inner="${k}" aria-pressed="${innerTab === k}">${l}</button>`).join("");
      const body = innerTab === "stk"
        ? `<div class="stocks">${(g.stocks || []).map(chip).join("")}</div><p class="hint" style="margin:6px 0 0">點股票看 K 線、法人、營收與 EPS</p><div class="panel-host"></div>`
        : `<ul class="cmpt">${panes[innerTab][1](g).join("") || '<li class="empty">沒有資料</li>'}</ul>`;
      return `<div class="sd"><p class="sd-trend ${dirCls(g.dir)}">${esc(g.trend)}</p><div class="seg sd-tabs" role="group">${tabs}</div>${body}</div>`;
    };
    const rows = cats.map((k) => (S[k] || []).map((g, i) => {
      const key = `${k}:${i}`, [l, c] = STATUS[k], open = key === openKey;
      const bn = (g.stocks || []).filter((s) => s.best).map((s) => s.name).join("、");
      return `<div class="sr ${open ? "open" : ""}"><button type="button" class="sr-h" data-open="${key}" aria-expanded="${open}">
          <span class="st ${c}">${l}</span><span class="sr-n">${esc(g.name)}</span><span class="sr-b">${bn ? "較看好 " + esc(bn) : ""}</span><span class="sr-x" aria-hidden="true">${open ? "－" : "＋"}</span></button>
        ${open ? detail(g) : ""}</div>`;
    }).join("")).join("");
    box.hidden = false;
    box.innerHTML = `<div class="card sm"><div class="sm-h"><h2>族群地圖</h2><span class="foot">${esc(S.asOf || "")}</span></div>${rows}</div>`;
  }

  function renderArchive() {
    const ar = $("#archive");
    if (briefIndex.length < 2) { ar.hidden = true; return; }
    ar.hidden = false;
    ar.innerHTML = `<label for="pick" class="foot">看過去的盤前：</label> <select id="pick">${briefIndex.map((d) => `<option value="${d}" ${brief && d === brief.date ? "selected" : ""}>${d}</option>`).join("")}</select>`;
  }

  async function load(date) {
    brief = await getJSON(`briefs/${date}.json`);
    renderBrief(brief); renderChanges(brief); renderSectors(brief); renderArchive();
  }

  $("#sectors").addEventListener("click", (e) => {
    const o = e.target.closest("button[data-open]");
    if (o) { openKey = openKey === o.dataset.open ? null : o.dataset.open; try { localStorage.setItem("sectorOpen", openKey || ""); } catch (err) {} renderSectors(brief); return; }
    const t = e.target.closest("button[data-inner]");
    if (t) { innerTab = t.dataset.inner; try { localStorage.setItem("sectorInner", innerTab); } catch (err) {} renderSectors(brief); return; }
    const s = e.target.closest(".stk");
    if (s) {
      const host = s.closest(".sd").querySelector(".panel-host");
      const wasOpen = s.getAttribute("aria-expanded") === "true";
      document.querySelectorAll(".panel-host").forEach((h) => { if (h.innerHTML) StockPanel.close(h); });
      if (!wasOpen) { s.setAttribute("aria-expanded", "true"); StockPanel.open(host, s.dataset.code, s.dataset.name); }
    }
  });
  $("#archive").addEventListener("change", (e) => { if (e.target.id === "pick") load(e.target.value); });

  (async function boot() {
    renderProb().catch(() => {});
    setInterval(() => renderProb().catch(() => {}), 60000);
    try { const idx = await getJSON("stocks/index.json"); (idx.items || []).forEach((x) => (prices[x.code] = x)); } catch (e) {}
    try {
      briefIndex = await getJSON("briefs/index.json");
      if (!briefIndex.length) throw new Error("empty");
      await load(briefIndex[0]);
    } catch (e) {
      $("#brief").innerHTML = '<p class="empty">還沒有盤前建議。交易日早上 08:20 會自動寫入。</p>';
    }
  })();
})();
