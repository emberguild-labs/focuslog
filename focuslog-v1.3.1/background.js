// background.js — FocusLog v1.3.0

let activeTabId = null;
let activeWindowId = null;
let lastSwitchTime = Date.now();
let currentDomain = null;

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

function getDomain(url) {
  try {
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) return null;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch { return null; }
}

function getToday() { return new Date().toISOString().split("T")[0]; }
function getHour() { return new Date().getHours(); }

// ── Time flushing ────────────────────────────────────────────────────────────
async function flushTime() {
  if (!currentDomain) return;
  const elapsed = Math.floor((Date.now() - lastSwitchTime) / 1000);
  if (elapsed <= 0) return;

  const today = getToday();
  const hour = getHour();
  const result = await getStorage(["siteData", "hourData", "siteHourData", "goals", "watchlist", "ignoreList"]);
  const siteData = result.siteData || {};
  const hourData = result.hourData || {};
  const siteHourData = result.siteHourData || {};
  const goals = result.goals || {};
  const watchlist = result.watchlist || [];
  const ignoreList = result.ignoreList || [];

  // Skip ignored domains entirely
  if (ignoreList.includes(currentDomain)) {
    lastSwitchTime = Date.now();
    return;
  }

  // Per-site per-day
  if (!siteData[today]) siteData[today] = {};
  siteData[today][currentDomain] = (siteData[today][currentDomain] || 0) + elapsed;

  // Aggregate per-hour (rolling 7-day)
  const hk = `${today}:${String(hour).padStart(2,"0")}`;
  hourData[hk] = (hourData[hk] || 0) + elapsed;

  // Per-site per-hour breakdown
  const shk = `${currentDomain}:::${today}:${String(hour).padStart(2,"0")}`;
  siteHourData[shk] = (siteHourData[shk] || 0) + elapsed;

  // Prune old data
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  for (const k of Object.keys(hourData)) {
    if (new Date(k.split(":")[0]) < cutoff) delete hourData[k];
  }
  for (const k of Object.keys(siteHourData)) {
    const dateStr = k.split(":::")[1]?.split(":")[0];
    if (dateStr && new Date(dateStr) < cutoff) delete siteHourData[k];
  }

  await setStorage({ siteData, hourData, siteHourData });

  // Goal warnings
  const domainTotal = siteData[today][currentDomain];
  const goalSecs = goals[currentDomain];
  if (goalSecs && domainTotal >= goalSecs) {
    const wk = `warned_${today}_${currentDomain}`;
    const wr = await chrome.storage.local.get([wk]);
    if (!wr[wk]) {
      chrome.notifications.create(`goal_${Date.now()}`, {
        type: "basic", iconUrl: "icon48.png",
        title: "⚠ Daily Goal Reached",
        message: `You've hit your limit for ${currentDomain} today.`,
        priority: 1
      });
      await chrome.storage.local.set({ [wk]: true });
    }
  }

  // Watchlist warnings
  if (watchlist.includes(currentDomain)) {
    for (const t of [1800, 3600, 7200]) {
      if (domainTotal >= t && domainTotal - elapsed < t) {
        const label = t >= 3600 ? `${t/3600}h` : `${t/60}m`;
        chrome.notifications.create(`watch_${currentDomain}_${t}`, {
          type: "basic", iconUrl: "icon48.png",
          title: "👁 Watchlist Alert",
          message: `You've spent ${label} on ${currentDomain} today.`,
          priority: 1
        });
      }
    }
  }
}

// ── Tab switching ────────────────────────────────────────────────────────────
async function switchTo(tabId, windowId, url) {
  await flushTime();
  activeTabId = tabId; activeWindowId = windowId;
  currentDomain = getDomain(url);
  lastSwitchTime = Date.now();
}

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const tab = await chrome.tabs.get(tabId);
  await switchTo(tabId, windowId, tab.url || "");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.url) await switchTo(tabId, activeWindowId, changeInfo.url);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushTime(); currentDomain = null; lastSwitchTime = Date.now();
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) await switchTo(tab.id, windowId, tab.url || "");
  }
});

// ── Alarms ───────────────────────────────────────────────────────────────────
chrome.alarms.create("flush", { periodInMinutes: 1/6 });
chrome.alarms.create("focusCheck", { periodInMinutes: 1/6 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "flush") { await flushTime(); lastSwitchTime = Date.now(); }
  if (alarm.name === "focusCheck") await checkFocusExpiry();
});

// ── Focus Mode ───────────────────────────────────────────────────────────────
async function checkFocusExpiry() {
  const { focusMode: fm } = await chrome.storage.local.get(["focusMode"]);
  if (!fm?.active) return;
  if (Date.now() >= fm.endsAt) {
    await disableFocusMode();
    chrome.notifications.create("focusDone", {
      type: "basic", iconUrl: "icon48.png",
      title: "✅ Focus Session Complete",
      message: `Great work! Your ${fm.durationMins}-minute focus session is over.`,
      priority: 2
    });
  }
}

async function enableFocusMode(durationMins, domains, hardMode = false, customMessage = "") {
  const endsAt = Date.now() + durationMins * 60 * 1000;
  await chrome.storage.local.set({ focusMode: { active: true, durationMins, endsAt, domains, hardMode, customMessage } });
  await updateBlockRules(domains);
}

async function disableFocusMode() {
  await chrome.storage.local.set({ focusMode: { active: false, durationMins: 0, endsAt: 0, domains: [], customMessage: "" } });
  await updateBlockRules([]);
}

async function updateBlockRules(domains) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  const addRules = domains.map((domain, i) => ({
    id: i + 1, priority: 1,
    action: { type: "redirect", redirect: { extensionPath: `/blocked.html?domain=${encodeURIComponent(domain)}` } },
    condition: { urlFilter: `||${domain}`, resourceTypes: ["main_frame"] }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
}

// ── Messages ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_FOCUS") {
    enableFocusMode(msg.durationMins, msg.domains, msg.hardMode || false, msg.customMessage || "")
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "STOP_FOCUS") {
    chrome.storage.local.get(["focusMode"], (r) => {
      if (r.focusMode?.active && r.focusMode?.hardMode) {
        sendResponse({ ok: false, blocked: true });
      } else {
        disableFocusMode().then(() => sendResponse({ ok: true }));
      }
    });
    return true;
  }
  if (msg.type === "GET_FOCUS") {
    chrome.storage.local.get(["focusMode"], r => sendResponse(r.focusMode || { active: false }));
    return true;
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await switchTo(tab.id, tab.windowId, tab.url || "");
  const { focusMode: fm } = await chrome.storage.local.get(["focusMode"]);
  if (fm?.active && Date.now() < fm.endsAt) await updateBlockRules(fm.domains);
  else if (fm?.active) await disableFocusMode();
});

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await switchTo(tab.id, tab.windowId, tab.url || "");
})();
