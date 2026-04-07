# FocusLog — Chrome Distraction Tracker

A lightweight Chrome extension that tracks how long you spend on each website — but **only counts time when that tab is actually active**. If YouTube is open in a background tab, it doesn't count until you switch to it.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![No Server](https://img.shields.io/badge/Data-Local%20Only-brightgreen)
![Version](https://img.shields.io/badge/Version-1.1.0-cyan)

---

## Installation

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `focuslog` folder
5. Click the 🧩 puzzle piece in your toolbar and pin FocusLog

---

## Changelog

### v1.1.0 — Current

#### ✨ New Features

**Focus Mode**
- Start a timed focus session (e.g. 25 minutes) that hard-blocks any sites you choose
- Uses Chrome's `declarativeNetRequest` API — blocks at the network level before pages even load, not just a redirect
- Blocked pages show a custom lock screen (`blocked.html`) with a live countdown timer and progress bar
- End sessions early if needed, or let them expire automatically
- A notification fires when your session completes

**Daily Goals**
- Set a per-site daily time limit (e.g. 30 minutes for youtube.com)
- Colored indicator dots on the Today tab show your goal status at a glance: green (under), orange (near limit), red (over)
- A Chrome notification fires the first time you hit your limit each day

**Peak Hours Chart**
- A 24-column bar chart on the Week tab shows which hours of the day you spend the most time browsing (averaged over the last 7 days)
- Peak hour is highlighted in red; work hours (9am–5pm) shown in cyan; off-hours in green
- Hover over any bar to see the exact hour and total time

**Sync Storage**
- Toggle in Settings to switch between local storage (default) and Google sync storage
- Sync mode keeps your data across all your Chrome devices signed into the same Google account
- Note: Chrome sync has a 100KB limit — recommended for moderate usage only

**Watchlist Alerts**
- Sites on your watchlist now trigger automatic Chrome notifications at 30 minutes, 1 hour, and 2 hours
- Alerts fire in real time as you accumulate time on those sites

#### 🐛 Improvements
- Popup redesigned with 5 tabs: Today, Week, Focus, Goals, Settings
- Goals panel consolidates daily limits and watchlist management in one place
- Sync storage badge in header shows `LOCAL` or `SYNC` at a glance
- Tag-style UI for managing focus mode domains and watchlist entries

---

### v1.0.0 — Initial Release

#### Features

**Active-Tab Only Tracking**
- Time only accrues for the tab that is currently visible and in the focused window
- Automatically pauses when you switch to a different window, minimize Chrome, or leave the browser entirely
- Internal Chrome pages (`chrome://`, `chrome-extension://`, `about:`) are never tracked

**Today Tab**
- Ranked list of all sites visited today, sorted by time spent
- Horizontal progress bars showing relative time per site
- Total time and site count summary at the top
- "Clear Today's Data" button

**Week Tab**
- 7-day bar chart with daily totals
- Aggregated weekly top sites list

**Watchlist**
- Add sites to a watchlist to highlight them in red on the Today tab
- Visual indicator to draw attention to distracting sites

**Data Persistence**
- All data stored locally using `chrome.storage.local`
- Data flushes every 10 seconds via an alarm — survives Chrome closing unexpectedly

---

## File Structure

```
focuslog/
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker — tracking, focus mode, warnings
├── popup.html           # Extension popup UI
├── popup.js             # All popup rendering and interaction logic
├── blocked.html         # Shown when a site is blocked during focus mode
├── block_rules.json     # Static declarativeNetRequest rules (starts empty)
├── icon16.png
├── icon48.png
└── icon128.png
```

---

## How It Works

The background service worker listens for three Chrome events:

- `chrome.tabs.onActivated` — fires when you switch to a different tab
- `chrome.tabs.onUpdated` — fires when the URL changes in the current tab
- `chrome.windows.onFocusChanged` — fires when you switch windows or leave Chrome

On each event, it calculates elapsed time for the previous domain and writes it to storage, then resets the timer for the new domain. A repeating alarm flushes data every 10 seconds to survive service worker suspension.

Focus mode uses `chrome.declarativeNetRequest.updateDynamicRules()` to add network-level block rules that redirect blocked domains to `blocked.html`. Rules are cleared automatically when the session ends.

---

## Permissions

| Permission | Reason |
|---|---|
| `tabs` | Read the active tab's URL to determine the current domain |
| `storage` | Save tracking data, goals, and settings locally or via sync |
| `alarms` | Flush time data every 10 seconds; check focus session expiry |
| `notifications` | Fire alerts for goal limits, watchlist thresholds, and focus completion |
| `declarativeNetRequest` | Block sites at the network level during focus mode |
| `host_permissions: <all_urls>` | Required for declarativeNetRequest to apply rules to any domain |

---

## Privacy

All tracking data is stored locally using the Chrome Storage API (or optionally synced via your Google account in v1.1.0). No data is ever sent to any external server. No analytics. No telemetry.

---

## Built With

- Manifest V3 Chrome Extension APIs
- Vanilla JavaScript — no frameworks or dependencies
- [Syne](https://fonts.google.com/specimen/Syne) + [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) (Google Fonts)

---

## Roadmap

- [ ] CSV export for weekly data
- [ ] Categories (group sites into Work / Social / Entertainment)
- [ ] Per-hour breakdown per site
- [ ] Ignore list (sites never tracked)
- [ ] Custom block page message

---

## License

MIT
