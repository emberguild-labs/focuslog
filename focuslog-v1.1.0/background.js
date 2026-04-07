// background.js — FocusLog v1.1.0

let activeTabId = null;
let activeWindowId = null;
let lastSwitchTime = Date.now();
let currentDomain = null;

// ── Storage helper (local vs sync) ──────────────────────────────────────────
async function getStorage(keys) {
  const { useSync } = await chrome.storage.local.get(["useSync"]);
  const store = useSync ? chrome.storage.sync : chrome.storage.local;
  return new Promise(resolve => store.get(keys, resolve));
}

async function setStorage(data) {
  const { useSync } = await chrome.storage.local.get(["useSync"]);
  const store = useSync ? chrome.storage.sync : chrome.storage.local;
  return new Promise(resolve => store.set(data, resolve));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDomain(url) {
  try {
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) return null;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch { return null; }
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getHourKey() {
  return new Date().getHours(); // 0–23
}

// ── Time flushing ────────────────────────────────────────────────────────────
async function flushTime() {
  if (!currentDomain) return;
  const elapsed = Math.floor((Date.now() - lastSwitchTime) / 1000);
  if (elapsed <= 0) return;

  const today = getToday();
  const hour = getHourKey();
  const result = await getStorage(["siteData", "hourData", "goals", "watchlist"]);
  const siteData = result.siteData || {};
  const hourData = result.hourData || {};
  const goals = result.goals || {};
  const watchlist = result.watchlist || [];

  // Per-site per-day
  if (!siteData[today]) siteData[today] = {};
  if (!siteData[today][currentDomain]) siteData[today][currentDomain] = 0;
  siteData[today][currentDomain] += elapsed;

  // Per-hour aggregation (rolling 7-day, keyed by "YYYY-MM-DD:HH")
  const hourKey = `${today}:${String(hour).padStart(2,"0")}`;
  hourData[hourKey] = (hourData[hourKey] || 0) + elapsed;

  // Prune hourData older than 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  for (const k of Object.keys(hourData)) {
    const [dateStr] = k.split(":");
    if (new Date(dateStr) < cutoff) delete hourData[k];
  }

  await setStorage({ siteData, hourData });

  // ── Goal warnings ────────────────────────────────────────────────────────
  const domainTotal = siteData[today][currentDomain];
  const goalSecs = goals[currentDomain];
  if (goalSecs && domainTotal >= goalSecs) {
    const lastWarnKey = `warned_${today}_${currentDomain}`;
    const warnResult = await chrome.storage.local.get([lastWarnKey]);
    if (!warnResult[lastWarnKey]) {
      chrome.notifications.create(`goal_${currentDomain}`, {
        type: "basic",
        iconUrl: "icon48.png",
        title: "⚠ Daily Goal Reached",
        message: `You've hit your limit for ${currentDomain} today.`,
        priority: 1
      });
      await chrome.storage.local.set({ [lastWarnKey]: true });
    }
  }

  // ── Watchlist warnings (at 30 min, 1h, 2h) ──────────────────────────────
  if (watchlist.includes(currentDomain)) {
    const thresholds = [1800, 3600, 7200];
    for (const t of thresholds) {
      if (domainTotal >= t && domainTotal - elapsed < t) {
        const mins = t / 60;
        chrome.notifications.create(`watch_${currentDomain}_${t}`, {
          type: "basic",
          iconUrl: "icon48.png",
          title: "👁 Watchlist Alert",
          message: `You've spent ${mins >= 60 ? (mins/60)+"h" : mins+"m"} on ${currentDomain} today.`,
          priority: 1
        });
      }
    }
  }
}

// ── Tab switching ────────────────────────────────────────────────────────────
async function switchTo(tabId, windowId, url) {
  await flushTime();
  activeTabId = tabId;
  activeWindowId = windowId;
  currentDomain = getDomain(url);
  lastSwitchTime = Date.now();
}

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const tab = await chrome.tabs.get(tabId);
  await switchTo(tabId, windowId, tab.url || "");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    await switchTo(tabId, activeWindowId, changeInfo.url);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushTime();
    currentDomain = null;
    lastSwitchTime = Date.now();
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) await switchTo(tab.id, windowId, tab.url || "");
  }
});

// ── Alarms ───────────────────────────────────────────────────────────────────
chrome.alarms.create("flush", { periodInMinutes: 1/6 });
chrome.alarms.create("focusCheck", { periodInMinutes: 1/6 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "flush") {
    await flushTime();
    lastSwitchTime = Date.now();
  }
  if (alarm.name === "focusCheck") {
    await checkFocusExpiry();
  }
});

// ── Focus Mode ───────────────────────────────────────────────────────────────
async function checkFocusExpiry() {
  const result = await chrome.storage.local.get(["focusMode"]);
  const fm = result.focusMode;
  if (!fm || !fm.active) return;

  if (Date.now() >= fm.endsAt) {
    await disableFocusMode();
    chrome.notifications.create("focusDone", {
      type: "basic",
      iconUrl: "icon48.png",
      title: "✅ Focus Session Complete",
      message: `Great work! Your ${fm.durationMins}-minute focus session is over.`,
      priority: 2
    });
  }
}

async function enableFocusMode(durationMins, domains) {
  const endsAt = Date.now() + durationMins * 60 * 1000;
  await chrome.storage.local.set({
    focusMode: { active: true, durationMins, endsAt, domains }
  });
  await updateBlockRules(domains);
}

async function disableFocusMode() {
  await chrome.storage.local.set({
    focusMode: { active: false, durationMins: 0, endsAt: 0, domains: [] }
  });
  await updateBlockRules([]);
}

async function updateBlockRules(domains) {
  // Remove all existing dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  const addRules = domains.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}`
      }
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ["main_frame"]
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules
  });
}

// ── Message handler (from popup) ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_FOCUS") {
    enableFocusMode(msg.durationMins, msg.domains).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "STOP_FOCUS") {
    disableFocusMode().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "GET_FOCUS") {
    chrome.storage.local.get(["focusMode"], r => sendResponse(r.focusMode || { active: false }));
    return true;
  }
});

// ── Startup ──────────────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await switchTo(tab.id, tab.windowId, tab.url || "");
  // Re-apply block rules on startup in case focus mode was active
  const result = await chrome.storage.local.get(["focusMode"]);
  const fm = result.focusMode;
  if (fm && fm.active && Date.now() < fm.endsAt) {
    await updateBlockRules(fm.domains);
  } else if (fm && fm.active) {
    await disableFocusMode();
  }
});

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await switchTo(tab.id, tab.windowId, tab.url || "");
})();
