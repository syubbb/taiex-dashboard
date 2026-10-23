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
    if (live && live.date === todayTW()) {
      cells.push(`<div><div class="l">今天盤中收紅機率（${esc(live.time)}）</div><div class="v ${live.p_up >= .5 ? "up" : "down"}">${pct(live.p_up)}</div><div class="s">加權 ${fmt(live.price, 2)}　<span class="${sign(live.ret_pct)}">${signed(live.ret_pct, 2)}%</span>　開盤前預估 ${pct(live.prior)}</div></div>`);
    }
    if (pNext) cells.push(`<div><div class="l">${live && live.date === todayTW() ? "今天開盤前的預估" : "下一交易日上漲機率（含隔夜美股）"}</div><div class="v ${pNext.p >= .5 ? "up" : "down"}">${pct(pNext.p)}</div><div class="s">${esc(pre.updated.replace("T", " ").slice(5, 16))} 更新　隔夜費半 <span class="${sign(pre.overnight.sox)}">${signed(pre.overnight.sox * 100, 2)}%</span></div></div>`);
    if (eod) cells.push(`<div><div class="l">收盤後預估（只看台股）</div><div class="v ${eod.p >= .5 ? "up" : "down"}">${pct(eod.p)}</div><div class="s">依 ${esc(eod.made_on)} 收盤計算</div></div>`);
    if (!cells.length) { box.innerHTML = `<div><div class="l">漲跌機率</div><div class="s">第一次資料更新完成後會出現在這裡。</div></div>`; return; }
    cells.push(`<div><div class="l">準不準？</div><div class="s" style="margin:6px 0 8px">每一筆預測都留紀錄、隔天對答案。</div><a href="predict.html">看漲跌機率與成績單 →</a></div>`);
    box.innerHTML = cells.join("");
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

  function renderSectors(b) {
    const box = $("#sectors");
    const S = b.sectors;
    if (!S) { box.hidden = true; return; }
    const cats = [["hot", "主流族群"], ["cool", "降溫族群"], ["rise", "近期可能轉好"]];
    if (!S[tab]) tab = "hot";
    const blk = (title, v) => { const ps = points(v); return ps.length ? `<div class="blk"><h4>${title}</h4><ul>${ps.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""; };
    const chip = (s) => {
      const px = prices[s.code];
      return `<button type="button" class="stk ${s.best ? "best" : ""}" data-code="${esc(s.code)}" data-name="${esc(s.name)}" aria-expanded="false">
        <span class="top"><b>${esc(s.name)}</b><code>${esc(s.code)}</code>${s.best ? '<span class="badge">較看好</span>' : ""}${px && px.close != null ? `<span class="px ${sign(px.chg_pct)}">${fmt(px.close, 2)} ${signed(px.chg_pct, 2)}%</span>` : ""}</span>
        <p>${esc(s.note)}</p></button>`;
    };
    const grp = (g, i) => `
      <article class="grp">
        <div class="grp-h"><b>${esc(g.name)}</b><span class="tr ${dirCls(g.dir)}">${esc(g.trend)}</span></div>
        <div class="blocks">${blk("為什麼", g.why)}${blk("未來走勢", g.outlook)}${blk("誰比較好", g.best)}${blk("要小心", g.risk)}</div>
        <div><h3>代表股　<span class="hint">點股票看 K 線、法人、營收與 EPS</span></h3><div class="stocks">${(g.stocks || []).map(chip).join("")}</div></div>
        <div class="panel-host" id="ph-${i}"></div>
      </article>`;
    box.hidden = false;
    box.innerHTML = `
      <div class="sec-head"><h2>族群地圖</h2><p>${esc(S.asOf || "")}</p></div>
      <div class="tabs" role="tablist">${cats.map(([k, l]) => `<button type="button" role="tab" data-k="${k}" aria-selected="${tab === k}">${l}<span class="n">${(S[k] || []).length}</span></button>`).join("")}</div>
      <div class="grps">${(S[tab] || []).map(grp).join("") || '<p class="empty">這一類目前沒有族群。</p>'}</div>`;
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
    const t = e.target.closest("button[data-k]");
    if (t) { tab = t.dataset.k; try { localStorage.setItem("sectorTab", tab); } catch (err) {} renderSectors(brief); return; }
    const s = e.target.closest(".stk");
    if (s) {
      const host = s.closest(".grp").querySelector(".panel-host");
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
