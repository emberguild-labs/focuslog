// popup.js — FocusLog v1.1.0

const COLORS = ["#00e5ff","#2ed573","#ffa502","#ff4757","#a29bfe","#fd79a8","#74b9ff","#55efc4"];

function formatTime(s) {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
function formatTimeShort(s) {
  if (s < 60) return `${s}s`;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function getToday() { return new Date().toISOString().split("T")[0]; }
function getLast7() {
  return Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i));
    return d.toISOString().split("T")[0];
  });
}
function getDayLabel(ds) {
  return ["Su","Mo","Tu","We","Th","Fr","Sa"][new Date(ds+"T12:00:00").getDay()];
}

// ── Storage helper ─────────────────────────────────────────────────────────
async function getStore(keys) {
  const r = await chrome.storage.local.get(["useSync"]);
  const store = r.useSync ? chrome.storage.sync : chrome.storage.local;
  return new Promise(res => store.get(keys, res));
}
async function setStore(data) {
  const r = await chrome.storage.local.get(["useSync"]);
  const store = r.useSync ? chrome.storage.sync : chrome.storage.local;
  return new Promise(res => store.set(data, res));
}

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-"+btn.dataset.panel).classList.add("active");
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
document.getElementById("dateDisplay").textContent =
  new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}).toUpperCase();

async function init() {
  const r = await chrome.storage.local.get(["useSync"]);
  const syncBadge = document.getElementById("syncBadge");
  if (r.useSync) { syncBadge.textContent="SYNC"; syncBadge.classList.add("on"); }
  document.getElementById("syncToggle").checked = !!r.useSync;

  const data = await getStore(["siteData","hourData","goals","watchlist"]);
  const siteData = data.siteData||{};
  const hourData = data.hourData||{};
  const goals = data.goals||{};
  const watchlist = data.watchlist||[];
  const today = getToday();

  renderToday(siteData[today]||{}, goals, watchlist);
  renderWeek(siteData, hourData);
  renderGoals(goals);
  renderWatchTags(watchlist);
  initFocus();
}

init();

// ── TODAY ──────────────────────────────────────────────────────────────────
function renderToday(todayData, goals, watchlist) {
  const entries = Object.entries(todayData).sort((a,b)=>b[1]-a[1]);
  const total = entries.reduce((s,[,v])=>s+v,0);
  const maxT = entries[0]?.[1]||1;
  document.getElementById("totalToday").textContent = formatTime(total);
  document.getElementById("siteCount").textContent = `${entries.length} site${entries.length!==1?"s":""}`;

  const list = document.getElementById("siteList");
  list.innerHTML = "";
  if (!entries.length) {
    list.innerHTML=`<div class="empty"><div class="empty-icon">📡</div>No data yet.<br>Browse a bit and come back!</div>`;
    return;
  }
  entries.forEach(([domain, secs], i) => {
    const isWatched = watchlist.includes(domain);
    const goalSecs = goals[domain];
    const pct = Math.round((secs/maxT)*100);
    const color = isWatched ? "#ff4757" : COLORS[i%COLORS.length];

    let pipHtml = "";
    if (goalSecs) {
      const over = secs >= goalSecs;
      const near = secs >= goalSecs * 0.8;
      pipHtml = `<div class="goal-pip ${over?"over":near?"":"ok"}" title="${over?"Over limit":near?"Near limit":"Under limit"}"></div>`;
    }

    const row = document.createElement("div");
    row.className = "site-row";
    row.style.animationDelay = `${i*35}ms`;
    if (isWatched) row.style.borderColor="rgba(255,71,87,.3)";
    row.innerHTML = `
      <span class="site-rank">${i+1}</span>
      <div class="site-info">
        <div class="site-name" style="color:${isWatched?"#ff4757":"var(--text)"}">${isWatched?"⚠ ":""}${domain}</div>
        <div class="site-bar-wrap"><div class="site-bar" style="width:${pct}%;background:${color}"></div></div>
        ${goalSecs?`<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:3px">${formatTimeShort(secs)} / ${formatTimeShort(goalSecs)}</div>`:""}
      </div>
      <div class="site-meta">${pipHtml}<span class="site-time">${formatTime(secs)}</span></div>
    `;
    list.appendChild(row);
  });
}

document.getElementById("resetToday").addEventListener("click", async () => {
  if (!confirm("Clear today's tracking data?")) return;
  const data = await getStore(["siteData"]);
  const siteData = data.siteData||{};
  delete siteData[getToday()];
  await setStore({siteData});
  renderToday({},{},{});
  document.getElementById("totalToday").textContent="0:00";
  document.getElementById("siteCount").textContent="0 sites";
});

// ── WEEK ───────────────────────────────────────────────────────────────────
function renderWeek(siteData, hourData) {
  const days = getLast7();
  const today = getToday();
  const totals = days.map(d=>Object.values(siteData[d]||{}).reduce((s,v)=>s+v,0));
  const maxTotal = Math.max(...totals,1);

  // Day grid
  const grid = document.getElementById("weekGrid");
  grid.innerHTML="";
  days.forEach((day,i)=>{
    const pct = Math.round((totals[i]/maxTotal)*100);
    const isToday = day===today;
    const color = isToday?"#00e5ff":"#2ed573";
    const cell=document.createElement("div");
    cell.className="day-cell"+(isToday?" today":"");
    cell.innerHTML=`
      <span class="day-label">${getDayLabel(day)}</span>
      <div class="day-bar-wrap"><div class="day-bar" style="height:${Math.max(pct,2)}%;background:${color};opacity:${isToday?1:.6}"></div></div>
      <span class="day-total">${totals[i]>0?formatTimeShort(totals[i]):"-"}</span>
    `;
    grid.appendChild(cell);
  });

  // Hour bars (aggregate last 7 days by hour)
  const hourTotals = Array(24).fill(0);
  days.forEach(d=>{
    for(let h=0;h<24;h++){
      const key=`${d}:${String(h).padStart(2,"0")}`;
      hourTotals[h]+=(hourData[key]||0);
    }
  });
  const maxHour = Math.max(...hourTotals,1);
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));

  const barsEl = document.getElementById("hourBars");
  barsEl.innerHTML="";
  // Show only every other hour label to avoid crowding
  for(let h=0;h<24;h++){
    const pct=Math.round((hourTotals[h]/maxHour)*100);
    const isPeak=h===peakHour && hourTotals[h]>0;
    const color = isPeak?"#ff4757":h>=9&&h<=17?"#00e5ff":"#2ed573";
    const col=document.createElement("div");
    col.className="hour-col"+(isPeak?" peak":"");
    col.title=`${h}:00 — ${formatTimeShort(hourTotals[h])}`;
    col.innerHTML=`
      <div class="hour-bar" style="height:${Math.max(pct,2)}%;background:${color};color:${color}"></div>
      <span class="hour-label">${h%3===0?h:""}</span>
    `;
    barsEl.appendChild(col);
  }

  // Weekly top sites
  const agg={};
  days.forEach(d=>{ Object.entries(siteData[d]||{}).forEach(([dom,s])=>{ agg[dom]=(agg[dom]||0)+s; }); });
  const weekEntries=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const weekMax=weekEntries[0]?.[1]||1;
  const weekList=document.getElementById("weekSiteList");
  weekList.innerHTML="";
  if(!weekEntries.length){
    weekList.innerHTML=`<div class="empty"><div class="empty-icon">📊</div>No weekly data yet.</div>`;
    return;
  }
  weekEntries.forEach(([domain,secs],i)=>{
    const pct=Math.round((secs/weekMax)*100);
    const color=COLORS[i%COLORS.length];
    const row=document.createElement("div");
    row.className="site-row";
    row.style.animationDelay=`${i*35}ms`;
    row.innerHTML=`
      <span class="site-rank">${i+1}</span>
      <div class="site-info">
        <div class="site-name">${domain}</div>
        <div class="site-bar-wrap"><div class="site-bar" style="width:${pct}%;background:${color}"></div></div>
      </div>
      <span class="site-time">${formatTimeShort(secs)}</span>
    `;
    weekList.appendChild(row);
  });
}

// ── FOCUS MODE ─────────────────────────────────────────────────────────────
let focusDomains = [];
let focusInterval = null;

function initFocus() {
  chrome.runtime.sendMessage({type:"GET_FOCUS"}, (fm) => {
    updateFocusUI(fm);
  });
}

function updateFocusUI(fm) {
  const status = document.getElementById("focusStatus");
  const controls = document.getElementById("focusControls");
  const activeControls = document.getElementById("focusActiveControls");
  const stopBtn = document.getElementById("stopFocusBtn");
  const hardBadge = document.getElementById("hardModeBadge");

  if (fm && fm.active) {
    status.classList.add("active");
    status.querySelector(".focus-icon").textContent = fm.hardMode ? "🔒" : "🎯";
    document.getElementById("focusTitle").textContent = fm.hardMode ? "Hard Mode Active" : "Focus Mode Active";
    document.getElementById("focusSub").textContent = `Blocking ${fm.domains?.length||0} site(s)`;
    document.getElementById("focusBlockedList").textContent = fm.domains?.join(", ")||"";
    controls.style.display = "none";
    activeControls.style.display = "block";

    if (fm.hardMode) {
      hardBadge.style.display = "block";
      stopBtn.style.opacity = "0.35";
      stopBtn.style.cursor = "not-allowed";
      stopBtn.textContent = "🔒 Hard Mode — No Early Exit";
    } else {
      hardBadge.style.display = "none";
      stopBtn.style.opacity = "1";
      stopBtn.style.cursor = "pointer";
      stopBtn.textContent = "■ End Session Early";
    }

    startFocusCountdown(fm);
  } else {
    status.classList.remove("active");
    status.querySelector(".focus-icon").textContent = "🎯";
    document.getElementById("focusTitle").textContent = "Focus Mode Off";
    document.getElementById("focusSub").textContent = "Block distracting sites for a set time";
    controls.style.display = "block";
    activeControls.style.display = "none";
    if (focusInterval) { clearInterval(focusInterval); focusInterval=null; }
  }
}

function startFocusCountdown(fm) {
  if (focusInterval) clearInterval(focusInterval);
  function tick() {
    const remaining = Math.max(0, Math.floor((fm.endsAt - Date.now())/1000));
    const total = fm.durationMins*60;
    const elapsed = total-remaining;
    const pct = Math.min(100, Math.round((elapsed/total)*100));
    const m=Math.floor(remaining/60), s=remaining%60;
    document.getElementById("focusTimerDisplay").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    document.getElementById("focusProgressFill").style.width=pct+"%";
    if (remaining===0) {
      clearInterval(focusInterval);
      chrome.runtime.sendMessage({type:"GET_FOCUS"}, updateFocusUI);
    }
  }
  tick();
  focusInterval = setInterval(tick, 1000);
}

// Add domain to focus list
document.getElementById("addFocusDomain").addEventListener("click", () => {
  const input = document.getElementById("focusDomainInput");
  let d = input.value.trim().toLowerCase().replace(/^www\./,"").replace(/^https?:\/\//,"").split("/")[0];
  if (!d || focusDomains.includes(d)) { input.value=""; return; }
  focusDomains.push(d);
  input.value="";
  renderFocusTags();
});
document.getElementById("focusDomainInput").addEventListener("keydown",e=>{
  if(e.key==="Enter") document.getElementById("addFocusDomain").click();
});

function renderFocusTags() {
  const el = document.getElementById("focusDomainTags");
  el.innerHTML="";
  focusDomains.forEach(d=>{
    const tag=document.createElement("div");
    tag.className="tag";
    tag.innerHTML=`<span>${d}</span><button class="rm" data-d="${d}">✕</button>`;
    tag.querySelector(".rm").addEventListener("click",()=>{
      focusDomains=focusDomains.filter(x=>x!==d);
      renderFocusTags();
    });
    el.appendChild(tag);
  });
}

document.getElementById("startFocusBtn").addEventListener("click", () => {
  const mins = parseInt(document.getElementById("focusDuration").value)||25;
  if (!focusDomains.length) { alert("Add at least one site to block!"); return; }
  const hardMode = document.getElementById("hardModeToggle").checked;

  if (hardMode) {
    // Show modal 1
    const m1 = document.getElementById("modal1");
    m1.style.display = "flex";
    document.getElementById("modal1Cancel").onclick = () => { m1.style.display = "none"; };
    document.getElementById("modal1Continue").onclick = () => {
      m1.style.display = "none";
      // Show modal 2
      const m2 = document.getElementById("modal2");
      document.getElementById("modal2Duration").textContent = `${mins} minute${mins!==1?"s":""}`;
      document.getElementById("modal2Domains").textContent = focusDomains.join(", ");
      m2.style.display = "flex";
      document.getElementById("modal2Cancel").onclick = () => { m2.style.display = "none"; };
      document.getElementById("modal2Confirm").onclick = () => {
        m2.style.display = "none";
        chrome.runtime.sendMessage({type:"START_FOCUS", durationMins:mins, domains:focusDomains, hardMode:true}, ()=>{
          chrome.runtime.sendMessage({type:"GET_FOCUS"}, updateFocusUI);
        });
      };
    };
  } else {
    chrome.runtime.sendMessage({type:"START_FOCUS", durationMins:mins, domains:focusDomains, hardMode:false}, ()=>{
      chrome.runtime.sendMessage({type:"GET_FOCUS"}, updateFocusUI);
    });
  }
});

document.getElementById("stopFocusBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({type:"GET_FOCUS"}, (fm) => {
    if (fm && fm.hardMode) {
      // Hard mode — can't stop, shake the button instead
      const btn = document.getElementById("stopFocusBtn");
      btn.textContent = "🔒 Hard Mode — No Early Exit";
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      setTimeout(() => {
        btn.textContent = "■ End Session Early";
        btn.style.opacity = "0.5";
      }, 2500);
      return;
    }
    if (!confirm("End your focus session early?")) return;
    chrome.runtime.sendMessage({type:"STOP_FOCUS"}, ()=>{
      updateFocusUI({active:false});
    });
  });
});

// ── GOALS ──────────────────────────────────────────────────────────────────
async function renderGoals(goals) {
  const list=document.getElementById("goalsList");
  list.innerHTML="";
  const entries=Object.entries(goals);
  if(!entries.length){
    list.innerHTML=`<div class="empty"><div class="empty-icon">🎯</div>No goals set yet.</div>`;
    return;
  }
  entries.forEach(([domain,secs])=>{
    const row=document.createElement("div");
    row.className="goal-row";
    row.innerHTML=`
      <span class="goal-domain">${domain}</span>
      <span class="goal-limit">${formatTimeShort(secs)}/day</span>
      <button class="btn ghost" style="padding:4px 8px;font-size:9px" data-d="${domain}">REMOVE</button>
    `;
    row.querySelector("button").addEventListener("click", async ()=>{
      const data=await getStore(["goals"]);
      const g=data.goals||{};
      delete g[domain];
      await setStore({goals:g});
      renderGoals(g);
    });
    list.appendChild(row);
  });
}

document.getElementById("addGoalBtn").addEventListener("click", async ()=>{
  let d=document.getElementById("goalDomain").value.trim().toLowerCase().replace(/^www\./,"").replace(/^https?:\/\//,"").split("/")[0];
  const mins=parseInt(document.getElementById("goalMins").value)||30;
  if(!d) return;
  const data=await getStore(["goals"]);
  const goals=data.goals||{};
  goals[d]=mins*60;
  await setStore({goals});
  document.getElementById("goalDomain").value="";
  document.getElementById("goalMins").value="";
  renderGoals(goals);
});

// Watchlist
async function renderWatchTags(watchlist) {
  const el=document.getElementById("watchTags");
  el.innerHTML="";
  watchlist.forEach(d=>{
    const tag=document.createElement("div");
    tag.className="tag";
    tag.innerHTML=`<span style="color:#ff4757">${d}</span><button class="rm" data-d="${d}">✕</button>`;
    tag.querySelector(".rm").addEventListener("click", async ()=>{
      const r=await getStore(["watchlist"]);
      const wl=(r.watchlist||[]).filter(x=>x!==d);
      await setStore({watchlist:wl});
      renderWatchTags(wl);
    });
    el.appendChild(tag);
  });
}

document.getElementById("addWatchBtn").addEventListener("click", async ()=>{
  let d=document.getElementById("watchInput").value.trim().toLowerCase().replace(/^www\./,"").replace(/^https?:\/\//,"").split("/")[0];
  if(!d) return;
  const r=await getStore(["watchlist"]);
  const wl=r.watchlist||[];
  if(!wl.includes(d)) { wl.push(d); await setStore({watchlist:wl}); }
  document.getElementById("watchInput").value="";
  renderWatchTags(wl);
});
document.getElementById("watchInput").addEventListener("keydown",e=>{ if(e.key==="Enter") document.getElementById("addWatchBtn").click(); });

// ── SETTINGS ───────────────────────────────────────────────────────────────
document.getElementById("syncToggle").addEventListener("change", async (e) => {
  const useSync = e.target.checked;
  await chrome.storage.local.set({useSync});
  const badge=document.getElementById("syncBadge");
  if(useSync){ badge.textContent="SYNC"; badge.classList.add("on"); }
  else { badge.textContent="LOCAL"; badge.classList.remove("on"); }
});

document.getElementById("resetAll").addEventListener("click", async ()=>{
  if(!confirm("Delete ALL FocusLog data? This cannot be undone.")) return;
  await chrome.storage.local.clear();
  await chrome.storage.sync.clear();
  location.reload();
});
