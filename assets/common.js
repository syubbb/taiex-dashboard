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
  return { REPO, DATA, getJSON, esc, dirCls, sign, pct, fmt, signed, points, todayTW, mode, labelTables };
})();
