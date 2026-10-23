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
    return { dst, open, close, state, text, short, line, season: dst ? "夏令時間" : "冬令時間", summerFrom: nthSun(2, 2), winterFrom: nthSun(10, 1) };
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
  return { REPO, DATA, getJSON, esc, dirCls, sign, pct, fmt, signed, points, todayTW, mode, labelTables, usMarket };
})();
