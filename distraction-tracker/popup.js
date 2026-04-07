// popup.js

const COLORS = [
  "#00e5ff", "#2ed573", "#ffa502", "#ff4757",
  "#a29bfe", "#fd79a8", "#74b9ff", "#55efc4"
];

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimeShort(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function getDayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return ["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()];
}

// ---- Tab switching ----
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
  });
});

// ---- Date display ----
const dateEl = document.getElementById("dateDisplay");
const now = new Date();
dateEl.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();

// ---- Load & render ----
chrome.storage.local.get(["siteData", "watchlist"], (result) => {
  const siteData = result.siteData || {};
  const watchlist = result.watchlist || [];
  const today = getToday();
  const todayData = siteData[today] || {};

  renderToday(todayData, watchlist);
  renderWeek(siteData);
  renderWatchlist(watchlist);
});

function renderToday(todayData, watchlist) {
  const entries = Object.entries(todayData).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const maxTime = entries[0]?.[1] || 1;

  document.getElementById("totalToday").textContent = formatTime(total);
  document.getElementById("siteCount").textContent = `${entries.length} site${entries.length !== 1 ? "s" : ""}`;

  const list = document.getElementById("siteList");
  list.innerHTML = "";

  if (entries.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📡</div>No data yet.<br>Browse a bit and come back!</div>`;
    return;
  }

  entries.forEach(([domain, seconds], i) => {
    const isWatched = watchlist.includes(domain);
    const color = isWatched ? "#ff4757" : COLORS[i % COLORS.length];
    const pct = Math.round((seconds / maxTime) * 100);

    const row = document.createElement("div");
    row.className = "site-row";
    row.style.animationDelay = `${i * 40}ms`;
    if (isWatched) row.style.borderColor = "rgba(255,71,87,0.35)";

    row.innerHTML = `
      <span class="site-rank">${i + 1}</span>
      <div class="site-info">
        <div class="site-name" title="${domain}">${isWatched ? "⚠ " : ""}${domain}</div>
        <div class="site-bar-wrap">
          <div class="site-bar" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>
      <span class="site-time">${formatTime(seconds)}</span>
    `;
    list.appendChild(row);
  });
}

function renderWeek(siteData) {
  const days = getLast7Days();
  const today = getToday();
  const totals = days.map(d => {
    const data = siteData[d] || {};
    return Object.values(data).reduce((s, v) => s + v, 0);
  });
  const maxTotal = Math.max(...totals, 1);

  const grid = document.getElementById("weekGrid");
  grid.innerHTML = "";
  days.forEach((day, i) => {
    const pct = Math.round((totals[i] / maxTotal) * 100);
    const isToday = day === today;
    const color = isToday ? "#00e5ff" : "#2ed573";

    const cell = document.createElement("div");
    cell.className = "day-cell" + (isToday ? " today" : "");
    cell.innerHTML = `
      <span class="day-label">${getDayLabel(day)}</span>
      <div class="day-bar-wrap">
        <div class="day-bar" style="height:${Math.max(pct, 2)}%; background:${color}; opacity:${isToday ? 1 : 0.6};"></div>
      </div>
      <span class="day-total">${totals[i] > 0 ? formatTimeShort(totals[i]) : "-"}</span>
    `;
    grid.appendChild(cell);
  });

  // Aggregate all sites for the week
  const weekAggregate = {};
  days.forEach(d => {
    const data = siteData[d] || {};
    Object.entries(data).forEach(([domain, secs]) => {
      weekAggregate[domain] = (weekAggregate[domain] || 0) + secs;
    });
  });

  const weekEntries = Object.entries(weekAggregate).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const weekMax = weekEntries[0]?.[1] || 1;
  const weekList = document.getElementById("weekSiteList");
  weekList.innerHTML = "";

  if (weekEntries.length === 0) {
    weekList.innerHTML = `<div class="empty"><div class="empty-icon">📊</div>No weekly data yet.</div>`;
    return;
  }

  weekEntries.forEach(([domain, seconds], i) => {
    const color = COLORS[i % COLORS.length];
    const pct = Math.round((seconds / weekMax) * 100);
    const row = document.createElement("div");
    row.className = "site-row";
    row.style.animationDelay = `${i * 40}ms`;
    row.innerHTML = `
      <span class="site-rank">${i + 1}</span>
      <div class="site-info">
        <div class="site-name">${domain}</div>
        <div class="site-bar-wrap">
          <div class="site-bar" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>
      <span class="site-time">${formatTimeShort(seconds)}</span>
    `;
    weekList.appendChild(row);
  });
}

function renderWatchlist(watchlist) {
  const list = document.getElementById("blockedList");
  list.innerHTML = "";

  if (watchlist.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div>No sites on watchlist yet.</div>`;
    return;
  }

  watchlist.forEach(domain => {
    const row = document.createElement("div");
    row.className = "blocked-row";
    row.innerHTML = `
      <span class="blocked-domain">${domain}</span>
      <button class="remove-btn" data-domain="${domain}">✕</button>
    `;
    row.querySelector(".remove-btn").addEventListener("click", () => removeFromWatchlist(domain));
    list.appendChild(row);
  });
}

function removeFromWatchlist(domain) {
  chrome.storage.local.get(["watchlist"], (result) => {
    const watchlist = (result.watchlist || []).filter(d => d !== domain);
    chrome.storage.local.set({ watchlist }, () => renderWatchlist(watchlist));
  });
}

document.getElementById("addBlockBtn").addEventListener("click", () => {
  const input = document.getElementById("blockInput");
  let domain = input.value.trim().toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "").split("/")[0];
  if (!domain) return;

  chrome.storage.local.get(["watchlist"], (result) => {
    const watchlist = result.watchlist || [];
    if (!watchlist.includes(domain)) {
      watchlist.push(domain);
      chrome.storage.local.set({ watchlist }, () => renderWatchlist(watchlist));
    }
    input.value = "";
  });
});

document.getElementById("blockInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addBlockBtn").click();
});

document.getElementById("resetToday").addEventListener("click", () => {
  if (!confirm("Clear all of today's tracking data?")) return;
  const today = getToday();
  chrome.storage.local.get(["siteData"], (result) => {
    const siteData = result.siteData || {};
    delete siteData[today];
    chrome.storage.local.set({ siteData }, () => {
      renderToday({}, []);
    });
  });
});
