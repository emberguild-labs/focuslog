// background.js — tracks only the ACTIVE, FOCUSED tab

let activeTabId = null;
let activeWindowId = null;
let lastSwitchTime = Date.now();
let currentDomain = null;

function getDomain(url) {
  try {
    if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) return null;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function flushTime() {
  if (!currentDomain) return;
  const elapsed = Math.floor((Date.now() - lastSwitchTime) / 1000);
  if (elapsed <= 0) return;

  const today = new Date().toISOString().split("T")[0];
  const result = await chrome.storage.local.get(["siteData"]);
  const siteData = result.siteData || {};

  if (!siteData[today]) siteData[today] = {};
  if (!siteData[today][currentDomain]) siteData[today][currentDomain] = 0;
  siteData[today][currentDomain] += elapsed;

  await chrome.storage.local.set({ siteData });
}

async function switchTo(tabId, windowId, url) {
  await flushTime();
  activeTabId = tabId;
  activeWindowId = windowId;
  currentDomain = getDomain(url);
  lastSwitchTime = Date.now();
}

// Tab activated (user clicks a different tab)
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const tab = await chrome.tabs.get(tabId);
  await switchTo(tabId, windowId, tab.url || "");
});

// Tab URL updated (user navigates in same tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    await switchTo(tabId, activeWindowId, changeInfo.url);
  }
});

// Window focus changed
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus entirely — flush and pause
    await flushTime();
    currentDomain = null;
    lastSwitchTime = Date.now();
  } else {
    // Switched to a different window — get its active tab
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      await switchTo(tab.id, windowId, tab.url || "");
    }
  }
});

// Periodic flush every 10 seconds via alarm to survive service worker suspension
chrome.alarms.create("flush", { periodInMinutes: 1/6 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "flush") {
    await flushTime();
    lastSwitchTime = Date.now(); // reset after flush so we don't double-count
  }
});

// On startup, find the currently active tab
chrome.runtime.onStartup.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await switchTo(tab.id, tab.windowId, tab.url || "");
});

// Also initialize immediately when service worker starts
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) await switchTo(tab.id, tab.windowId, tab.url || "");
})();
