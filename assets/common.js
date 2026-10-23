// Shared helpers. Data lives on the `data` branch and is read straight from raw.githubusercontent.com,
// so the 5-minute intraday commits show up without rebuilding the site.
window.TX = (function () {
  const REPO = "syubbb/taiex-dashboard";
  const DATA = `https://raw.githubusercontent.com/${REPO}/data/data/`;
  const bust = () => Math.floor(Date.now() / 60000); // new URL each minute, beats the CDN cache
  async function getJSON(path) {
    const r = await fetch(DATA + path + "?t=" + bust());
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dirCls = (d) => (d === "up" ? "up" : d === "down" ? "down" : "flat");
  const sign = (v) => (v > 0 ? "up" : v < 0 ? "down" : "flat");
  const pct = (p, d = 0) => (p == null ? "—" : (p * 100).toFixed(d) + "%");
  const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("zh-TW", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const signed = (n, d = 0) => (n == null ? "—" : (n > 0 ? "+" : "") + fmt(n, d));
  // Split prose into readable bullet points: arrays pass through, strings split on full stops / semicolons.
  const points = (v) => Array.isArray(v) ? v : String(v || "").split(/(?<=[。；])/).map((s) => s.replace(/[；]$/, "。").trim()).filter(Boolean);
  const todayTW = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  // US regular session (09:30–16:00 New York) expressed in Taipei time; DST is read from the New York time zone itself.
  function usMarket(now = new Date()) {
    const ny = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" })
      .formatToParts(now).reduce((o, p) => ((o[p.type] = p.value), o), {});
    const dst = ny.timeZoneName === "EDT";
    const open = dst ? "21:30" : "22:30", close = dst ? "04:00" : "05:00";
    const mins = (+ny.hour % 24) * 60 + +ny.minute;
    const weekday = !["Sat", "Sun"].includes(ny.weekday);
    let state, text;
    if (weekday && mins >= 570 && mins < 960) { state = "open"; text = `美股交易中，台北時間 ${close} 收盤`; }
    else if (weekday && mins < 570) { state = "pre"; text = `美股尚未開盤，台北時間今晚 ${open} 開盤`; }
    else { state = "closed"; text = ny.weekday === "Fri" || !weekday ? `美股已收盤，下次開盤是台北時間週一晚上 ${open}` : `美股已收盤，台北時間今晚 ${open} 再開盤`; }
    // DST switch dates for this year: 2nd Sunday of March, 1st Sunday of November
    const y = now.getFullYear();
    const nthSun = (m, n) => { const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7 + 1; return `${m + 1}/${first + 7 * (n - 1)}`; };
    const short = state === "open" ? "交易中" : state === "pre" ? `今晚 ${open} 開盤` : text.includes("週一") ? `週一 ${open} 開盤` : `今晚 ${open} 開盤`;
    const line = `美股 ${open}–${close}（${dst ? "夏令" : "冬令"}）｜${short}`;
    return { dst, open, close, state, text, short, line, short, line, season: dst ? "夏令時間" : "冬令時間", summerFrom: nthSun(2, 2), winterFrom: nthSun(10, 1) };
  }
  // "今天盤中收紅機率" block: always shown; before the open it says when updates start.
  function intradayBlock(day, live) {
    const today = todayTW();
    const nowTW = new Date(Date.now() + 8 * 3600e3);
    const hm = nowTW.getUTCHours() * 60 + nowTW.getUTCMinutes();
    const isToday = day && day.date === today && day.points && day.points.length;
    const head = `<div class="sec-head"><h2>今天盤中收紅機率</h2><p>台股 09:00–13:30 每 5 分鐘更新：以現在的漲跌，收盤仍高於昨天收盤的機率</p></div>`;
    if (!isToday) {
      const wd = nowTW.getUTCDay();
      const msg = wd === 0 || wd === 6 ? "今天週末休市，下個交易日 09:00 開盤後開始更新。"
        : hm < 540 ? "09:00 開盤後開始更新，第一筆約在 09:05 出現。"
        : hm < 815 ? "等待第一筆資料（排程偶爾會晚幾分鐘）。若一直沒有，可能今天休市。"
        : "今天沒有盤中資料（休市或尚未上線）。";
      const last = live && live.date !== today ? `<p class="foot" style="margin:8px 0 0">上一個交易日 ${esc(live.date)} ${esc(live.time)}：收紅機率 ${pct(live.p_up)}，加權 ${fmt(live.price, 2)}（${signed(live.ret_pct, 2)}%）</p>` : "";
      return head + `<div class="card"><p style="margin:0"><b>${msg}</b></p>${last}</div>`;
    }
    const pts = day.points, last = pts[pts.length - 1];
    const W = 340, H = 120, L = 6, R = 6, T = 8, B = 18;
    const tmin = (t) => { const [h, m] = t.split(":").map(Number); return Math.min(Math.max(h * 60 + m - 540, 0), 270); };
    const X = (t) => L + tmin(t) / 270 * (W - L - R), Y = (p) => T + (1 - p) * (H - T - B);
    const line = pts.map((q) => `${X(q[0]).toFixed(1)},${Y(q[3]).toFixed(1)}`).join(" ");
    const closed = hm >= 810;
    const cls = last[3] >= 0.5 ? "up" : "down";
    return head + `<div class="card intra">
      <div class="intra-top"><div><div class="big ${cls}">${pct(last[3])}</div><div class="foot">${closed ? "收盤" : esc(last[0]) + " 更新"}　開盤前預估 ${pct(day.prior)}</div></div>
        <div class="intra-ix"><div class="num" style="font-size:20px">${fmt(last[1], 2)}</div><div class="num ${sign(last[2])}">${signed(last[2], 2)}%</div><div class="foot">${esc(day.src || "")}</div></div></div>
      <svg viewBox="0 0 ${W} ${H}" class="spark" role="img" aria-label="今天收紅機率走勢">
        <line x1="${L}" x2="${W - R}" y1="${Y(.5)}" y2="${Y(.5)}" stroke="var(--line)" stroke-dasharray="4 4"/>
        <text x="${W - R}" y="${Y(.5) - 4}" text-anchor="end" font-size="10" fill="var(--muted)">50%</text>
        ${["09:00", "11:15", "13:30"].map((t, i) => `<text x="${X(t)}" y="${H - 4}" text-anchor="${["start", "middle", "end"][i]}" font-size="10" fill="var(--muted)" font-family="var(--mono)">${t}</text>`).join("")}
        <polyline points="${line}" fill="none" stroke="var(--navy)" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${X(last[0])}" cy="${Y(last[3])}" r="4" fill="var(--${cls})"/></svg>
      <div class="intra-list">${pts.slice(-6).reverse().map((q) => `<span><span class="num">${esc(q[0])}</span> <b class="${q[3] >= .5 ? "up" : "down"}">${pct(q[3])}</b> <span class="num ${sign(q[2])}">${signed(q[2], 2)}%</span></span>`).join("")}</div>
    </div>`;
  }
  const mode = () => document.documentElement.dataset.mode || "desktop";
  // Give every cell of a .rt table its column name, so phones can show rows as labelled cards.
  function labelTables(root = document) {
    root.querySelectorAll("table.rt").forEach((t) => {
      const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
      t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i] && !td.dataset.l) td.dataset.l = heads[i]; }));
    });
  }
  function initModeSwitch() {
    const nav = document.querySelector(".topnav");
    if (!nav) return;
    const box = document.createElement("span");
    box.className = "modes"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "顯示模式");
    box.innerHTML = [["mobile", "手機"], ["desktop", "網頁"]].map(([k, l]) => `<button type="button" data-mode="${k}" aria-pressed="${mode() === k}">${l}</button>`).join("");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.dataset.mode === mode()) return;
      try { localStorage.setItem("viewMode", b.dataset.mode); } catch (err) {}
      location.reload();
    });
    nav.appendChild(box);
  }
  document.addEventListener("DOMContentLoaded", () => { initModeSwitch(); labelTables(); });
  return { REPO, DATA, getJSON, esc, dirCls, sign, pct, fmt, signed, points, todayTW, mode, labelTables, usMarket, intradayBlock };
})();
