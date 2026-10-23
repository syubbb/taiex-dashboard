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
  return { REPO, DATA, getJSON, esc, dirCls, sign, pct, fmt, signed, points, todayTW };
})();
