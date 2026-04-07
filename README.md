# FocusLog — Chrome Distraction Tracker

A lightweight Chrome extension that tracks how long you spend on each website — but **only counts time when that tab is actually active**. If YouTube is open in a background tab, it doesn't count until you switch to it.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![No Server](https://img.shields.io/badge/Data-Local%20Only-brightgreen)

---

## Features

- **Active-tab only tracking** — pauses automatically when you switch tabs, windows, or leave Chrome entirely
- **Today tab** — ranked list of every site you've visited today with a time bar and total
- **Week tab** — 7-day bar chart overview + weekly top sites aggregated
- **Watchlist** — flag sites like `youtube.com` to highlight them in red on the Today tab
- **Fully local** — all data is stored in `chrome.storage.local`, nothing ever leaves your device
- Flushes data every 10 seconds via an alarm so nothing is lost if Chrome closes

---

## Screenshots

> *(Add screenshots of the popup here)*

---

## Installation

### Load Unpacked (Developer Mode)

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the `distraction-tracker` folder
6. Click the 🧩 puzzle piece in your toolbar and pin FocusLog

### Chrome Web Store

> Not yet published. Coming soon.

---

## File Structure

```
distraction-tracker/
├── manifest.json      # Extension config (Manifest V3)
├── background.js      # Service worker — handles all tab/window tracking
├── popup.html         # Extension popup UI
├── popup.js           # Popup rendering and storage reads
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

On each event, it calculates elapsed time for the previous domain and adds it to `chrome.storage.local`, then resets the timer for the new domain. A repeating alarm flushes accumulated time every 10 seconds to survive service worker suspension.

Internal Chrome pages (`chrome://`, `chrome-extension://`, `about:`) are ignored.

---

## Permissions Used

| Permission | Reason |
|---|---|
| `tabs` | Read the URL of the active tab to determine the domain |
| `storage` | Save tracking data and watchlist locally |
| `alarms` | Periodically flush time data every 10 seconds |

---

## Privacy

All data is stored locally using the Chrome Storage API. No data is sent to any server, no analytics, no tracking of any kind outside your own browser.

---

## Built With

- Manifest V3 Chrome Extension APIs
- Vanilla JavaScript (no frameworks)
- [Syne](https://fonts.google.com/specimen/Syne) + [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) (Google Fonts)

---

## License

MIT
