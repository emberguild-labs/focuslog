// popup.js — FocusLog v1.3.0

const COLORS = ["#00e5ff","#2ed573","#ffa502","#ff4757","#a29bfe","#fd79a8","#74b9ff","#55efc4"];
const CAT_PALETTE = ["#00e5ff","#2ed573","#ffa502","#ff4757","#a29bfe","#fd79a8","#74b9ff","#f9ca24","#6c5ce7","#e17055"];

function fmtT(s){if(s<60)return`${s}s`;const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;if(h>0)return`${h}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;return`${m}:${String(sc).padStart(2,"0")}`;}
function fmtTS(s){if(s<60)return`${s}s`;const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);if(h>0)return`${h}h ${m}m`;return`${m}m`;}
function getToday(){return new Date().toISOString().split("T")[0];}
function getLast7(){return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().split("T")[0];});}
function getDayLabel(ds){return["Su","Mo","Tu","We","Th","Fr","Sa"][new Date(ds+"T12:00:00").getDay()];}
function cleanDomain(v){return v.trim().toLowerCase().replace(/^www\./,"").replace(/^https?:\/\//,"").split("/")[0];}

async function getStore(keys){const r=await chrome.storage.local.get(["useSync"]);const s=r.useSync?chrome.storage.sync:chrome.storage.local;return new Promise(res=>s.get(keys,res));}
async function setStore(data){const r=await chrome.storage.local.get(["useSync"]);const s=r.useSync?chrome.storage.sync:chrome.storage.local;return new Promise(res=>s.set(data,res));}

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById("panel-"+btn.dataset.panel);
    panel.classList.add("active");
    if(btn.dataset.panel==="export") buildExportPreview();
    if(btn.dataset.panel==="cats") renderCats();
  });
});

// ── Init ───────────────────────────────────────────────────────────────────────
document.getElementById("dateDisplay").textContent = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}).toUpperCase();

async function init(){
  const ls = await chrome.storage.local.get(["useSync"]);
  const badge = document.getElementById("syncBadge");
  if(ls.useSync){badge.textContent="SYNC";badge.classList.add("on");}
  document.getElementById("syncToggle").checked=!!ls.useSync;

  const data = await getStore(["siteData","hourData","siteHourData","goals","watchlist","ignoreList","categories"]);
  const today = getToday();
  renderToday(data.siteData?.[today]||{}, data.goals||{}, data.watchlist||[], data.categories||[], data.siteHourData||{});
  renderWeek(data.siteData||{}, data.hourData||{});
  renderGoals(data.goals||{});
  renderTagList("watchTags", data.watchlist||[], "watchlist", "#ff4757");
  renderTagList("ignoreTags", data.ignoreList||[], "ignoreList", "#ffa502");
  initFocus();
}
init();

// ── TODAY ─────────────────────────────────────────────────────────────────────
function getDomainCategory(domain, categories){
  for(const cat of categories){
    if((cat.domains||[]).includes(domain)) return cat;
  }
  return null;
}

function renderToday(todayData, goals, watchlist, categories, siteHourData){
  const entries = Object.entries(todayData).sort((a,b)=>b[1]-a[1]);
  const total = entries.reduce((s,[,v])=>s+v,0);
  const maxT = entries[0]?.[1]||1;
  const today = getToday();

  document.getElementById("totalToday").textContent=fmtT(total);
  document.getElementById("siteCount").textContent=`${entries.length} site${entries.length!==1?"s":""}`;

  // Category breakdown bar
  const catBar = document.getElementById("catBar");
  catBar.innerHTML="";
  if(categories.length && total>0){
    const catTotals={};
    entries.forEach(([domain,secs])=>{
      const cat=getDomainCategory(domain,categories);
      const key=cat?cat.name:"Other";
      const color=cat?cat.color:"#555c72";
      catTotals[key]=(catTotals[key]||{secs:0,color}).secs+=secs, catTotals[key]={secs:(catTotals[key]?.secs||0)+secs,color};
    });
    // rebuild cleanly
    const catMap={};
    entries.forEach(([domain,secs])=>{
      const cat=getDomainCategory(domain,categories);
      const key=cat?cat.name:"Uncategorized";
      const color=cat?cat.color:"#333a4d";
      if(!catMap[key]) catMap[key]={secs:0,color};
      catMap[key].secs+=secs;
    });
    Object.entries(catMap).forEach(([name,{secs,color}])=>{
      const pct=(secs/total)*100;
      const seg=document.createElement("div");
      seg.style.cssText=`flex:${pct};background:${color};height:100%;min-width:3px;border-radius:2px;`;
      seg.title=`${name}: ${fmtTS(secs)}`;
      catBar.appendChild(seg);
    });
  }

  const list=document.getElementById("siteList");
  list.innerHTML="";
  if(!entries.length){list.innerHTML=`<div class="empty"><div class="empty-icon">📡</div>No data yet.<br>Browse a bit and come back!</div>`;return;}

  entries.forEach(([domain,secs],i)=>{
    const isWatched=watchlist.includes(domain);
    const goalSecs=goals[domain];
    const cat=getDomainCategory(domain,categories);
    const pct=Math.round((secs/maxT)*100);
    const color=cat?cat.color:(isWatched?"#ff4757":COLORS[i%COLORS.length]);

    // Per-site hour data for mini chart
    const hourBars=Array(24).fill(0);
    for(let h=0;h<24;h++){
      const k=`${domain}:::${today}:${String(h).padStart(2,"0")}`;
      hourBars[h]=siteHourData[k]||0;
    }
    const maxHour=Math.max(...hourBars,1);

    let pipHtml="";
    if(goalSecs){
      const cls=secs>=goalSecs?"over":secs>=goalSecs*.8?"near":"ok";
      pipHtml=`<div class="goal-pip ${cls}" title="${cls==="over"?"Over limit":cls==="near"?"Near limit":"Under limit"}"></div>`;
    }

    const catPill=cat?`<span class="cat-pill" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`:"";

    const miniChart=hourBars.some(v=>v>0)?`<div class="site-hour-chart">${hourBars.map(v=>`<div class="shc-bar" style="height:${Math.max(Math.round((v/maxHour)*100),v>0?8:2)}%;background:${color};opacity:${v>0?.8:.2}"></div>`).join("")}</div>`:"";

    const row=document.createElement("div");
    row.className="site-row";
    row.style.animationDelay=`${i*30}ms`;
    if(isWatched) row.style.borderColor="rgba(255,71,87,.3)";
    row.innerHTML=`
      <span class="site-rank">${i+1}</span>
      <div class="site-info">
        <div class="site-name" style="color:${isWatched?"#ff4757":"var(--text)"}">${isWatched?"⚠ ":""}${domain}</div>
        <div class="site-bar-wrap"><div class="site-bar" style="width:${pct}%;background:${color}"></div></div>
        ${miniChart}
        ${goalSecs?`<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted);margin-top:2px">${fmtTS(secs)} / ${fmtTS(goalSecs)}</div>`:""}
      </div>
      <div class="site-meta">${catPill}${pipHtml}<span class="site-time">${fmtT(secs)}</span></div>
    `;
    list.appendChild(row);
  });
}

document.getElementById("resetToday").addEventListener("click",async()=>{
  if(!confirm("Clear today's data?")) return;
  const data=await getStore(["siteData"]);
  const sd=data.siteData||{};
  delete sd[getToday()];
  await setStore({siteData:sd});
  renderToday({},{},{},{},{});
});

// ── WEEK ──────────────────────────────────────────────────────────────────────
function renderWeek(siteData,hourData){
  const days=getLast7(), today=getToday();
  const totals=days.map(d=>Object.values(siteData[d]||{}).reduce((s,v)=>s+v,0));
  const maxTotal=Math.max(...totals,1);

  const grid=document.getElementById("weekGrid");
  grid.innerHTML="";
  days.forEach((day,i)=>{
    const pct=Math.round((totals[i]/maxTotal)*100);
    const isToday=day===today;
    const cell=document.createElement("div");
    cell.className="day-cell"+(isToday?" today":"");
    cell.innerHTML=`<span class="day-label">${getDayLabel(day)}</span><div class="day-bar-wrap"><div class="day-bar" style="height:${Math.max(pct,2)}%;background:${isToday?"#00e5ff":"#2ed573"};opacity:${isToday?1:.6}"></div></div><span class="day-total">${totals[i]>0?fmtTS(totals[i]):"-"}</span>`;
    grid.appendChild(cell);
  });

  // Hour bars
  const hourTotals=Array(24).fill(0);
  days.forEach(d=>{for(let h=0;h<24;h++){const k=`${d}:${String(h).padStart(2,"0")}`;hourTotals[h]+=(hourData[k]||0);}});
  const maxH=Math.max(...hourTotals,1);
  const peakH=hourTotals.indexOf(Math.max(...hourTotals));
  const barsEl=document.getElementById("hourBars");
  barsEl.innerHTML="";
  for(let h=0;h<24;h++){
    const pct=Math.round((hourTotals[h]/maxH)*100);
    const isPeak=h===peakH&&hourTotals[h]>0;
    const color=isPeak?"#ff4757":h>=9&&h<=17?"#00e5ff":"#2ed573";
    const col=document.createElement("div");
    col.className="hour-col"+(isPeak?" peak":"");
    col.title=`${h}:00 — ${fmtTS(hourTotals[h])}`;
    col.innerHTML=`<div class="hour-bar" style="height:${Math.max(pct,2)}%;background:${color};color:${color}"></div><span class="hour-label">${h%3===0?h:""}</span>`;
    barsEl.appendChild(col);
  }

  // Week top sites
  const agg={};
  days.forEach(d=>{Object.entries(siteData[d]||{}).forEach(([dom,s])=>{agg[dom]=(agg[dom]||0)+s;});});
  const we=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const wmax=we[0]?.[1]||1;
  const wl=document.getElementById("weekSiteList");
  wl.innerHTML="";
  if(!we.length){wl.innerHTML=`<div class="empty"><div class="empty-icon">📊</div>No weekly data yet.</div>`;return;}
  we.forEach(([domain,secs],i)=>{
    const pct=Math.round((secs/wmax)*100);
    const row=document.createElement("div");
    row.className="site-row";
    row.style.animationDelay=`${i*30}ms`;
    row.innerHTML=`<span class="site-rank">${i+1}</span><div class="site-info"><div class="site-name">${domain}</div><div class="site-bar-wrap"><div class="site-bar" style="width:${pct}%;background:${COLORS[i%COLORS.length]}"></div></div></div><span class="site-time">${fmtTS(secs)}</span>`;
    wl.appendChild(row);
  });
}

// ── FOCUS ─────────────────────────────────────────────────────────────────────
let focusDomains=[], focusInterval=null;

function initFocus(){chrome.runtime.sendMessage({type:"GET_FOCUS"},updateFocusUI);}

function updateFocusUI(fm){
  const status=document.getElementById("focusStatus");
  const controls=document.getElementById("focusControls");
  const active=document.getElementById("focusActiveControls");
  const stopBtn=document.getElementById("stopFocusBtn");
  const badge=document.getElementById("hardModeBadge");
  const msgDisplay=document.getElementById("customMsgDisplay");
  if(fm&&fm.active){
    status.classList.add("active");
    status.querySelector(".focus-icon").textContent=fm.hardMode?"🔒":"🎯";
    document.getElementById("focusTitle").textContent=fm.hardMode?"Hard Mode Active":"Focus Mode Active";
    document.getElementById("focusSub").textContent=`Blocking ${fm.domains?.length||0} site(s)`;
    document.getElementById("focusBlockedList").textContent=fm.domains?.join(", ")||"";
    controls.style.display="none";
    active.style.display="block";
    if(fm.customMessage){msgDisplay.style.display="block";msgDisplay.textContent=`"${fm.customMessage}"`;}
    else{msgDisplay.style.display="none";}
    if(fm.hardMode){badge.style.display="block";stopBtn.style.opacity=".35";stopBtn.style.cursor="not-allowed";stopBtn.textContent="🔒 Hard Mode — No Early Exit";}
    else{badge.style.display="none";stopBtn.style.opacity="1";stopBtn.style.cursor="pointer";stopBtn.textContent="■ End Session Early";}
    startFocusCountdown(fm);
  } else {
    status.classList.remove("active");
    status.querySelector(".focus-icon").textContent="🎯";
    document.getElementById("focusTitle").textContent="Focus Mode Off";
    document.getElementById("focusSub").textContent="Block distracting sites for a set time";
    controls.style.display="block";
    active.style.display="none";
    if(focusInterval){clearInterval(focusInterval);focusInterval=null;}
  }
}

function startFocusCountdown(fm){
  if(focusInterval) clearInterval(focusInterval);
  function tick(){
    const remaining=Math.max(0,Math.floor((fm.endsAt-Date.now())/1000));
    const total=fm.durationMins*60;
    const pct=Math.min(100,Math.round(((total-remaining)/total)*100));
    const m=Math.floor(remaining/60),s=remaining%60;
    document.getElementById("focusTimerDisplay").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    document.getElementById("focusProgressFill").style.width=pct+"%";
    if(remaining===0){clearInterval(focusInterval);chrome.runtime.sendMessage({type:"GET_FOCUS"},updateFocusUI);}
  }
  tick(); focusInterval=setInterval(tick,1000);
}

document.getElementById("addFocusDomain").addEventListener("click",()=>{
  const input=document.getElementById("focusDomainInput");
  const d=cleanDomain(input.value);
  if(!d||focusDomains.includes(d)){input.value="";return;}
  focusDomains.push(d); input.value=""; renderFocusTags();
});
document.getElementById("focusDomainInput").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("addFocusDomain").click();});

function renderFocusTags(){
  const el=document.getElementById("focusDomainTags"); el.innerHTML="";
  focusDomains.forEach(d=>{
    const tag=document.createElement("div"); tag.className="tag";
    tag.innerHTML=`<span>${d}</span><button class="rm">✕</button>`;
    tag.querySelector(".rm").addEventListener("click",()=>{focusDomains=focusDomains.filter(x=>x!==d);renderFocusTags();});
    el.appendChild(tag);
  });
}

function doStartFocus(mins, domains, hardMode, customMessage){
  chrome.runtime.sendMessage({type:"START_FOCUS",durationMins:mins,domains,hardMode,customMessage},()=>{
    chrome.runtime.sendMessage({type:"GET_FOCUS"},updateFocusUI);
  });
}

document.getElementById("startFocusBtn").addEventListener("click",()=>{
  const mins=parseInt(document.getElementById("focusDuration").value)||25;
  const customMessage=document.getElementById("customMsgInput").value.trim();
  if(!focusDomains.length){alert("Add at least one site to block!");return;}
  const hardMode=document.getElementById("hardModeToggle").checked;
  if(hardMode){
    const m1=document.getElementById("modal1"); m1.style.display="flex";
    document.getElementById("modal1Cancel").onclick=()=>{m1.style.display="none";};
    document.getElementById("modal1Continue").onclick=()=>{
      m1.style.display="none";
      const m2=document.getElementById("modal2"); m2.style.display="flex";
      document.getElementById("modal2Duration").textContent=`${mins} minute${mins!==1?"s":""}`;
      document.getElementById("modal2Domains").textContent=focusDomains.join(", ");
      document.getElementById("modal2Cancel").onclick=()=>{m2.style.display="none";};
      document.getElementById("modal2Confirm").onclick=()=>{m2.style.display="none";doStartFocus(mins,focusDomains,true,customMessage);};
    };
  } else {
    doStartFocus(mins,focusDomains,false,customMessage);
  }
});

document.getElementById("stopFocusBtn").addEventListener("click",()=>{
  chrome.runtime.sendMessage({type:"GET_FOCUS"},(fm)=>{
    if(fm&&fm.hardMode){
      const btn=document.getElementById("stopFocusBtn");
      const orig=btn.textContent; btn.textContent="🔒 Hard Mode Active";
      setTimeout(()=>{btn.textContent=orig;},2000); return;
    }
    if(!confirm("End your focus session early?")) return;
    chrome.runtime.sendMessage({type:"STOP_FOCUS"},()=>updateFocusUI({active:false}));
  });
});

// ── GOALS ─────────────────────────────────────────────────────────────────────
async function renderGoals(goals){
  const list=document.getElementById("goalsList"); list.innerHTML="";
  const entries=Object.entries(goals);
  if(!entries.length){list.innerHTML=`<div class="empty"><div class="empty-icon">🎯</div>No goals set yet.</div>`;return;}
  entries.forEach(([domain,secs])=>{
    const row=document.createElement("div"); row.className="goal-row";
    row.innerHTML=`<span class="goal-domain">${domain}</span><span class="goal-limit">${fmtTS(secs)}/day</span><button class="btn ghost" style="padding:4px 8px;font-size:9px" data-d="${domain}">REMOVE</button>`;
    row.querySelector("button").addEventListener("click",async()=>{
      const data=await getStore(["goals"]); const g=data.goals||{}; delete g[domain]; await setStore({goals:g}); renderGoals(g);
    });
    list.appendChild(row);
  });
}

document.getElementById("addGoalBtn").addEventListener("click",async()=>{
  const d=cleanDomain(document.getElementById("goalDomain").value);
  const mins=parseInt(document.getElementById("goalMins").value)||30;
  if(!d) return;
  const data=await getStore(["goals"]); const goals=data.goals||{}; goals[d]=mins*60;
  await setStore({goals}); document.getElementById("goalDomain").value=""; document.getElementById("goalMins").value=""; renderGoals(goals);
});

// Generic tag list helper
async function renderTagList(elId, list, storeKey, color="#00e5ff"){
  const el=document.getElementById(elId); el.innerHTML="";
  if(!list.length){el.innerHTML=`<div style="font-size:11px;color:var(--muted);padding:4px 0">None yet.</div>`;return;}
  list.forEach(d=>{
    const tag=document.createElement("div"); tag.className="tag";
    tag.innerHTML=`<span style="color:${color}">${d}</span><button class="rm">✕</button>`;
    tag.querySelector(".rm").addEventListener("click",async()=>{
      const r=await getStore([storeKey]); const arr=(r[storeKey]||[]).filter(x=>x!==d);
      await setStore({[storeKey]:arr}); renderTagList(elId,arr,storeKey,color);
    });
    el.appendChild(tag);
  });
}

async function addToList(inputId, elId, storeKey, color){
  const input=document.getElementById(inputId); const d=cleanDomain(input.value); if(!d) return;
  const r=await getStore([storeKey]); const arr=r[storeKey]||[];
  if(!arr.includes(d)){arr.push(d);await setStore({[storeKey]:arr});}
  input.value=""; renderTagList(elId,arr,storeKey,color);
}

document.getElementById("addWatchBtn").addEventListener("click",()=>addToList("watchInput","watchTags","watchlist","#ff4757"));
document.getElementById("watchInput").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("addWatchBtn").click();});
document.getElementById("addIgnoreBtn").addEventListener("click",()=>addToList("ignoreInput","ignoreTags","ignoreList","#ffa502"));
document.getElementById("ignoreInput").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("addIgnoreBtn").click();});

// ── CATEGORIES ────────────────────────────────────────────────────────────────
async function renderCats(){
  const data=await getStore(["categories","siteData"]);
  const cats=data.categories||[];
  const today=getToday();
  const todayData=data.siteData?.[today]||{};
  const el=document.getElementById("catList"); el.innerHTML="";

  cats.forEach((cat,ci)=>{
    // Calculate total time for this category today
    const catSecs=(cat.domains||[]).reduce((sum,d)=>sum+(todayData[d]||0),0);

    const row=document.createElement("div"); row.className="cat-row";
    row.innerHTML=`
      <div class="cat-row-top">
        <div class="cat-color-dot" style="background:${cat.color}" data-ci="${ci}" title="Click to change color"></div>
        <div style="flex:1">
          <input class="fi" style="background:none;border:none;padding:0;font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--text);width:100%" value="${cat.name}" data-ci="${ci}" placeholder="Category name"/>
        </div>
        ${catSecs>0?`<span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted)">${fmtTS(catSecs)}</span>`:""}
        <button class="btn red" style="padding:3px 7px;font-size:9px" data-rm="${ci}">✕</button>
      </div>
      <div class="cat-domain-tags" id="catDomains_${ci}"></div>
      <div style="display:flex;gap:5px">
        <input class="fi" id="catDomainInput_${ci}" placeholder="add domain…" style="font-size:10px;padding:5px 8px"/>
        <button class="btn" style="padding:5px 9px;font-size:10px" data-adddom="${ci}">+</button>
      </div>
    `;
    el.appendChild(row);

    // Color cycling
    row.querySelector(".cat-color-dot").addEventListener("click",async()=>{
      const idx=CAT_PALETTE.indexOf(cat.color);
      cat.color=CAT_PALETTE[(idx+1)%CAT_PALETTE.length];
      const r=await getStore(["categories"]); const cs=r.categories||[]; cs[ci]=cat; await setStore({categories:cs}); renderCats();
    });

    // Name update
    row.querySelector(`input[data-ci="${ci}"]`).addEventListener("change",async(e)=>{
      const r=await getStore(["categories"]); const cs=r.categories||[]; cs[ci].name=e.target.value; await setStore({categories:cs});
    });

    // Remove category
    row.querySelector(`button[data-rm="${ci}"]`).addEventListener("click",async()=>{
      const r=await getStore(["categories"]); const cs=r.categories||[]; cs.splice(ci,1); await setStore({categories:cs}); renderCats();
    });

    // Add domain to category
    row.querySelector(`button[data-adddom="${ci}"]`).addEventListener("click",async()=>{
      const inp=document.getElementById(`catDomainInput_${ci}`);
      const d=cleanDomain(inp.value); if(!d){return;}
      const r=await getStore(["categories"]); const cs=r.categories||[];
      if(!cs[ci].domains) cs[ci].domains=[];
      if(!cs[ci].domains.includes(d)) cs[ci].domains.push(d);
      await setStore({categories:cs}); inp.value=""; renderCats();
    });
    document.getElementById(`catDomainInput_${ci}`).addEventListener("keydown",e=>{
      if(e.key==="Enter") row.querySelector(`button[data-adddom="${ci}"]`).click();
    });

    // Render domain tags
    const domEl=document.getElementById(`catDomains_${ci}`);
    (cat.domains||[]).forEach(d=>{
      const tag=document.createElement("div"); tag.className="cat-domain-tag";
      tag.style.borderColor=cat.color+"44"; tag.style.color=cat.color;
      tag.innerHTML=`<span>${d}</span><button class="rm">✕</button>`;
      tag.querySelector(".rm").addEventListener("click",async()=>{
        const r=await getStore(["categories"]); const cs=r.categories||[];
        cs[ci].domains=cs[ci].domains.filter(x=>x!==d); await setStore({categories:cs}); renderCats();
      });
      domEl.appendChild(tag);
    });
  });
}

document.getElementById("addCatBtn").addEventListener("click",async()=>{
  const r=await getStore(["categories"]); const cats=r.categories||[];
  cats.push({name:`Category ${cats.length+1}`,color:CAT_PALETTE[cats.length%CAT_PALETTE.length],domains:[]});
  await setStore({categories:cats}); renderCats();
});

// ── EXPORT ────────────────────────────────────────────────────────────────────
async function buildExportPreview(){
  const data=await getStore(["siteData"]);
  const siteData=data.siteData||{};
  const days=getLast7();
  const lines=["Date,Domain,Seconds,Time"];
  days.forEach(d=>{
    Object.entries(siteData[d]||{}).sort((a,b)=>b[1]-a[1]).forEach(([domain,secs])=>{
      lines.push(`${d},${domain},${secs},${fmtTS(secs)}`);
    });
  });
  const preview=document.getElementById("exportPreview");
  preview.textContent=lines.slice(0,20).join("\n")+(lines.length>20?`\n… +${lines.length-20} more rows`:"");
  return lines.join("\n");
}

document.getElementById("exportCsvBtn").addEventListener("click",async()=>{
  const csv=await buildExportPreview();
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`focuslog-${getToday()}.csv`; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("copySummaryBtn").addEventListener("click",async()=>{
  const data=await getStore(["siteData"]);
  const today=getToday();
  const todayData=data.siteData?.[today]||{};
  const entries=Object.entries(todayData).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((s,[,v])=>s+v,0);
  const lines=[`FocusLog Summary — ${today}`,`Total: ${fmtTS(total)} across ${entries.length} sites`,"",...entries.map(([d,s],i)=>`${i+1}. ${d} — ${fmtTS(s)}`)];
  await navigator.clipboard.writeText(lines.join("\n"));
  const btn=document.getElementById("copySummaryBtn");
  btn.textContent="✅ Copied!"; setTimeout(()=>{btn.textContent="📋 Copy Today's Summary";},2000);
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
document.getElementById("syncToggle").addEventListener("change",async(e)=>{
  const useSync=e.target.checked; await chrome.storage.local.set({useSync});
  const badge=document.getElementById("syncBadge");
  if(useSync){badge.textContent="SYNC";badge.classList.add("on");}else{badge.textContent="LOCAL";badge.classList.remove("on");}
});

document.getElementById("resetAll").addEventListener("click",async()=>{
  if(!confirm("Delete ALL FocusLog data? This cannot be undone.")) return;
  await chrome.storage.local.clear(); await chrome.storage.sync.clear(); location.reload();
});
