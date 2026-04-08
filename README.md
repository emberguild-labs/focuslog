# FocusLog — Chrome Distraction Tracker

A lightweight Chrome extension that tracks how long you spend on each website — but **only counts time when that tab is actually active**. If YouTube is open in a background tab, it doesn't count until you switch to it.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![No Server](https://img.shields.io/badge/Data-Local%20Only-brightgreen)
![Version](https://img.shields.io/badge/Version-1.3.1-cyan)

---

## Installation

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the `focuslog` folder
5. Click the puzzle piece in your toolbar and pin FocusLog

---

## Version Comparison

| Feature | v1.0.0 | v1.1.0 | v1.2.0 | v1.3.0 |
|---|---|---|---|---|
| Active-tab only tracking | ✅ | ✅ | ✅ | ✅ |
| Today tab (ranked site list) | ✅ | ✅ | ✅ | ✅ |
| Week tab (7-day bar chart) | ✅ | ✅ | ✅ | ✅ |
| Watchlist (highlight sites in red) | ✅ | ✅ | ✅ | ✅ |
| Data stored locally | ✅ | ✅ | ✅ | ✅ |
| Focus Mode (hard site blocking) | ❌ | ✅ | ✅ | ✅ |
| Custom block page with countdown | ❌ | ✅ | ✅ | ✅ |
| Daily time goals per site | ❌ | ✅ | ✅ | ✅ |
| Goal progress indicators | ❌ | ✅ | ✅ | ✅ |
| Peak hours chart (24h) | ❌ | ✅ | ✅ | ✅ |
| Watchlist notifications (30m/1h/2h) | ❌ | ✅ | ✅ | ✅ |
| Goal limit notifications | ❌ | ✅ | ✅ | ✅ |
| Google sync storage option | ❌ | ✅ | ✅ | ✅ |
| Focus session completion notification | ❌ | ✅ | ✅ | ✅ |
| Hard Mode (no early exit) | ❌ | ❌ | ✅ | ✅ |
| Hard Mode double-confirmation modals | ❌ | ❌ | ✅ | ✅ |
| Hard Mode warning on blocked page | ❌ | ❌ | ✅ | ✅ |
| **CSV export (weekly data)** | ❌ | ❌ | ❌ | ✅ |
| **Copy today's summary to clipboard** | ❌ | ❌ | ❌ | ✅ |
| **Categories (group sites by type)** | ❌ | ❌ | ❌ | ✅ |
| **Category breakdown bar on Today tab** | ❌ | ❌ | ❌ | ✅ |
| **Per-site hourly breakdown mini-chart** | ❌ | ❌ | ❌ | ✅ |
| **Ignore list (sites never tracked)** | ❌ | ❌ | ❌ | ✅ |
| **Custom block page message** | ❌ | ❌ | ❌ | ✅ |
| Popup tabs | 3 | 5 | 5 | 7 |

---

## Changelog

### v1.3.1 — Current

#### 🐛 Bug Fixes
- Fixed tab buttons overlapping on the Categories and Export tabs — tabs now scroll horizontally with a proper minimum width instead of squishing together

---

### v1.3.0

**CSV Export**
Export the last 7 days as a `.csv` file (Date, Domain, Seconds, Time columns). A live 20-row preview is shown in the popup. Also includes a one-click "Copy Today's Summary" button for plain-text clipboard output.

**Categories**
Create named, color-coded categories and assign domains to them. The Today tab shows a proportional category breakdown bar across the top, plus a small colored label pill on each site row. Click a category's color dot to cycle through palette options.

**Per-Site Hourly Breakdown**
Every site row on the Today tab now includes a 24-bar mini chart showing which hours of the day you visited that site — dimmed for zero-activity hours, highlighted for active ones.

**Ignore List**
Add domains that should never be tracked. Time spent on ignored sites is silently discarded and never appears in Today, Week, exports, or goal tracking. Managed in the Goals tab.

**Custom Block Page Message**
Optionally enter a personal message when starting a focus session. It displays on the blocked page and in the active session panel — useful for self-reminders like "Finish the essay first."

---

### v1.2.0
Hard Mode focus sessions with double-confirmation modals. Once active, the stop button is disabled for the full session duration. The background service worker enforces it server-side too.

### v1.1.0
Focus Mode (network-level blocking), daily goals with notifications, peak hours chart, Google sync storage, watchlist alerts at 30m/1h/2h.

### v1.0.0
Active-tab only tracking, Today tab, Week tab, Watchlist, local data persistence.

---

## File Structure

```
focuslog/
├── manifest.json        # Extension config (Manifest V3)
├── background.js        # Service worker — tracking, focus, warnings
├── popup.html           # Extension popup UI (7 tabs)
├── popup.js             # All popup logic
├── blocked.html         # Shown when a site is blocked in focus mode
├── block_rules.json     # Static declarativeNetRequest rules (starts empty)
├── icon16.png
├── icon48.png
└── icon128.png
```

---

## Permissions

| Permission | Reason |
|---|---|
| `tabs` | Read the active tab's URL |
| `storage` | Save all tracking data and settings |
| `alarms` | Flush time every 10s; check focus expiry |
| `notifications` | Goal limits, watchlist thresholds, focus completion |
| `declarativeNetRequest` | Block sites at the network level during focus mode |
| `host_permissions: <all_urls>` | Required for declarativeNetRequest to apply to any domain |

---

## Privacy

All data is stored locally via the Chrome Storage API (or optionally synced via your Google account). No data is ever sent to any external server. No analytics. No telemetry.

---

## Built With

- Manifest V3 Chrome Extension APIs
- Vanilla JavaScript — no frameworks
- [Syne](https://fonts.google.com/specimen/Syne) + [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) (Google Fonts)

---

## Roadmap

- [ ] **Streaks** — track consecutive days you stayed under a site's goal limit
- [ ] **Focus session history** — log of past sessions with duration, blocked sites, and hard mode status
- [ ] **Ambient badge counter** — show total browsing time today on the extension icon badge
- [ ] **Productivity score** — a daily score based on category time ratios (Work vs Social vs Entertainment)
- [ ] **Scheduled focus** — automatically start a focus session at a set time each day
- [ ] **Mobile data viewer** — export data in a format compatible with a simple mobile viewer

---

## License

MIT
