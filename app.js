'use strict';
/* WA Legislation — production engine. Reuses the proven byte-faithful corpus
   (app/data, build-asserted verbatim). Renders the D2 vivid-tile design.
   Routing · lazy per-Act load · offline full-text · PWA. Statute h is injected
   unchanged; defined-term marks + xrefs are non-destructive wrappers. */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const NS='wal-';
const ls={get(k,d){try{const v=localStorage.getItem(NS+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
          set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v))}catch(e){}}};
const DATA='./data/';

let REG, SRC={}, PAL10=[], SEARCH=[], DEFS=[], TOPICS={doms:[],topics:[]}, STUDY=null, FTEXT=null, SCAF={}, OFF={types:[],offences:[]};
const actCache={};
let curAct=null, curSec=null, sbMode=ls.get('sbMode','acts'), loadingFT=false, curPrev=null, curNext=null;
/* accordion / browse state (in-memory; reader auto-expands its act) */
let accAct=null;                 // open Act id in the sidebar (single-open)
let accParts=new Set();          // open tree-node keys "aid#i" (multi-open)
let accDoms=new Set();           // open Topic domains
let accOff=new Set();            // open Offence groups
let offView=ls.get('offView','type'); // offence library view: type | act | az
let _keepDrawer=false;           // keep the mobile drawer open across an in-drawer expand / mode-switch

/* ---------- icons ---------- */
const SVG={
 home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>',
 browse:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
 study:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
 saved:'<path d="M12 21s-7-4.4-9.5-8.5C.9 9.6 2.3 5.8 5.5 5.2 8 4.7 10.3 6.2 12 8.6c1.7-2.4 4-3.9 6.5-3.4 3.2.6 4.6 4.4 3 7.3C19 16.6 12 21 12 21Z"/>',
 activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
 alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
 droplet:'<path d="M12 2.7s5.5 5.6 5.5 9.8a5.5 5.5 0 1 1-11 0C6.5 8.3 12 2.7 12 2.7Z"/>',
 box:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
 mask:'<path d="M4 5h16v7a8 8 0 0 1-16 0Z"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M9 15c1 1 5 1 6 0"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m17 5 2 2"/><path d="m14 8 2 2"/>',
 link:'<path d="M9 12h6"/><path d="M10 8H7a4 4 0 0 0 0 8h3"/><path d="M14 8h3a4 4 0 0 1 0 8h-3"/>',
 scale:'<path d="M12 4v16"/><path d="M7 8h10"/><path d="m7 8-3 6a3 3 0 0 0 6 0Z"/><path d="m17 8-3 6a3 3 0 0 0 6 0Z"/><path d="M6 20h12"/>',
 car:'<path d="M5 13 6.6 8h10.8L19 13"/><path d="M4 17v-3.5L5 13h14l1 .5V17h-2"/><path d="M8 17H4"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
 file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M19.5 20a5.5 5.5 0 0 0-3-5"/>',
 book:'<path d="M5 4h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 19.5Z"/><path d="M5 17.5h14"/>',
 play:'<path d="M8 5v14l11-7Z"/>',chev:'<path d="m9 6 6 6-6 6"/>',back:'<path d="m15 6-6 6 6 6"/>',
 heart:'<path d="M12 21s-7-4.4-9.5-8.5C.9 9.6 2.3 5.8 5.5 5.2 8 4.7 10.3 6.2 12 8.6c1.7-2.4 4-3.9 6.5-3.4 3.2.6 4.6 4.4 3 7.3C19 16.6 12 21 12 21Z"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
 list:'<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',gavel:'<path d="m14 11-7 7-3-3 7-7"/><path d="m18 7-4-4"/><path d="m14 3-4 4 4 4 4-4Z"/><path d="m5 21 4-4"/><path d="M19 21h-8"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'};
function ic(n,stroke='#fff'){return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SVG[n]||SVG.box}</svg>`}
const TOPIC_ICON={};
function iconFor(name){const n=(name||'').toLowerCase();const map=[['homicid|murder|manslaughter|kill','activity'],['assault|gbh|grievous|bodily harm|wound|strangulat','shield'],['sexual|indecent|rape|pornograph','mask'],['drug|cannabis|methyl|traffick','droplet'],['steal|theft|property|receiv','box'],['burglar|invasion|trespass','home'],['robber','alert'],['fraud|forgery|dishonest|deception|bribery|corrupt','file'],['search|warrant|seiz|powers','search'],['arrest|custody|detain','link'],['bail','scale'],['sentenc|penalt|confiscat','scale'],['evidence|disclosure|court','book'],['traffic|driv|vehicle|road','car'],['weapon|firearm','shield'],['child|young|famil|juvenile|infant','users'],['threat|blackmail|stalk|intimidat|harass','alert'],['kidnap|libert|deprivation|abduct|detention','link'],['restrain|violence','shield'],['public order|riot|affray|disorder|justice','alert'],['surveillance|covert|intercept','key'],['damage|arson','alert']];for(const[re,k] of map){if(new RegExp(re).test(n))return k}return 'box'}
function topicIcon(t){return TOPIC_ICON[t.id]||iconFor(t.name)}

/* ---------- data ---------- */
async function jget(f){const r=await fetch(DATA+f);if(!r.ok)throw new Error('Could not load '+f);return r.json()}
async function loadAct(id){if(actCache[id])return actCache[id];const d=await jget(id+'.json');d._byId={};d.sections.forEach(s=>d._byId[s.id]=s);actCache[id]=d;return d}
const hue=a=>(SRC[a]||{}).hue||'#94a3b8';
const ink=a=>(SRC[a]||{}).ink||'#475569';
const tsh=a=>`color-mix(in srgb, ${hue(a)} 55%, transparent)`;
const tileBg=hex=>`linear-gradient(157deg, color-mix(in srgb,${hex} 92%,#fff), color-mix(in srgb,${hex} 86%,#000))`;
const ud=s=>((s.u||s.unit)==='s'?'s ':'')+(s.num!=null?s.num:s.n);
const acts=()=>REG.sources.filter(s=>s.cat==='act');
const defsOf=a=>DEFS.filter(d=>d.a===a);

/* ---------- boot ---------- */
async function boot(){
  document.documentElement.dataset.theme = ls.get('theme', matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  try{
    REG=await jget('registry.json');
    REG.sources.forEach(s=>SRC[s.id]=s);
    PAL10=['blue','teal','orange','purple','indigo','pink','gold','cyan','emerald','brown'].map(f=>REG.palette[f]);
    const [sj,dj,tj,scf,off]=await Promise.all([jget('search.json'),jget('defs.json'),jget('topics.json'),jget('scaffolds.json').catch(()=>({})),jget('offences.json').catch(()=>({types:[],offences:[]}))]);
    SEARCH=sj; TOPICS=tj; SCAF=scf||{}; OFF=off&&off.offences?off:{types:[],offences:[]}; DEFS=dj.acts.flatMap(a=>a.terms.map(t=>({t:t.t,a:a.a,s:t.s,num:t.num,sc:t.sc,d:t.d})));
    paintChrome();
    addEventListener('hashchange',route);
    if(!location.hash) location.hash='#/home';
    route();
    prefetchIdle();
  }catch(e){ $('#main').innerHTML=`<div class="boot">Couldn’t load the statute library.<br><small>${esc(e.message)}</small></div>`; console.error(e); }
}
function prefetchIdle(){
  const idle=window.requestIdleCallback||(f=>setTimeout(f,80));
  const ids=REG.sources.map(s=>s.id);let i=0;
  const step=()=>{ if(i>=ids.length)return; const id=ids[i++]; (actCache[id]?Promise.resolve():loadAct(id).catch(()=>{})).then(()=>idle(step)); };
  idle(step);
}

/* ---------- chrome ---------- */
function paintChrome(){
  $$('.dock .ic').forEach(e=>e.innerHTML=ic(e.dataset.i,'currentColor'));
  $$('[data-route]').forEach(el=>el.addEventListener('click',ev=>{ev.preventDefault();navigate(el.dataset.route)}));
  $$('.sb-switch button').forEach(b=>b.addEventListener('click',()=>sbSwitch(b.dataset.mode)));
  const sbc=$('#sbCollapse'); if(sbc)sbc.onclick=()=>{innerWidth<861?closeDrawer():document.body.classList.toggle('sb-collapsed')};
  $('#menuBtn').onclick=menuTap; $('#sbScrim').onclick=closeDrawer;
  const sk=$('#skip'); if(sk)sk.onclick=()=>{const m=$('#main'); if(m){m.setAttribute('tabindex','-1'); m.focus(); m.scrollIntoView();}};
  $('#searchBtn').onclick=()=>navigate('/search'); $('#sizeBtn').onclick=cycleSize; $('#themeBtn').onclick=toggleTheme; paintThemeBtn();
  applySize();
  addEventListener('keydown',e=>{
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName||'')||e.target.isContentEditable;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();navigate('/search')}
    else if(e.key==='Escape'){hideTerm();closeDrawer()}
    else if(typing){return}
    else if(e.key==='/'){e.preventDefault();navigate('/search')}
    else if(e.key==='['&&curPrev){e.preventDefault();navigate(curPrev)}
    else if(e.key===']'&&curNext){e.preventDefault();navigate(curNext)}
    else if(e.key.toLowerCase()==='t'){toggleTheme()}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('dfn')&&!e.target.closest('#pop'))hideTerm();});
  $('#sbBody').addEventListener('click',sbBodyClick);
  if(!accDoms.size) TOPICS.doms.forEach((_,i)=>accDoms.add(i)); // topics expanded by default
  renderSidebar();
}
function navigate(h){ if(location.hash==='#'+h){route();} else location.hash='#'+h; }
/* which sidebar browse-mode each route segment implies */
const SEG_MODE={browse:'acts',a:'acts',s:'acts',topics:'topics',topic:'topics',offences:'offences',offence:'offences',defs:'terms'};
const PAGE_TITLE={browse:'Acts & codes',offences:'Offences',topics:'Topics',defs:'Defined terms',search:'Search',study:'Study',saved:'Saved',recents:'Recents',drugs:'Drug quantity matrix'};
function route(){
  const h=(location.hash||'#/home').slice(1);
  const p=h.split('/').filter(Boolean);
  $('#pop').classList.remove('on');
  if(_keepDrawer){_keepDrawer=false;}else{closeDrawer();}
  const seg=p[0]||'home';
  if(SEG_MODE[seg]) sbMode=SEG_MODE[seg];
  if(SEG_MODE[seg]&&innerWidth>=861) document.body.classList.remove('sb-collapsed'); // picking a mode always reveals the panel
  $$('.di').forEach(d=>{
    const onMode=d.dataset.mode && SEG_MODE[seg] && d.dataset.mode===sbMode;
    const onRoute=!d.dataset.mode && d.dataset.route==='/'+seg;
    const on=!!(onMode||onRoute); d.classList.toggle('on', on);
    if(on)d.setAttribute('aria-current','page'); else d.removeAttribute('aria-current');
  });
  document.title = PAGE_TITLE[seg] ? PAGE_TITLE[seg]+' · WA Legislation' : 'WA Legislation';
  renderSidebar();
  const m=$('#main'); m.scrollTop=0; window.scrollTo(0,0);
  if(seg==='s')      return openSec(p[1],p[2]);
  if(seg==='a')      return renderActPage(p[1]);
  if(seg==='topic')  return renderTopicPage(p[1]);
  if(seg==='topics') return renderBrowse('topics');
  if(seg==='browse') return renderBrowse('acts');
  if(seg==='offences')return renderOffences(p[1],p[2]);
  if(seg==='search') return renderSearch(decodeURIComponent(p.slice(1).join('/')||''));
  if(seg==='study')  return p[1]==='drill'?renderDrill():p[1]==='quiz'?renderQuiz():p[1]==='scen'?renderScenarios():renderStudy();
  if(seg==='saved')  return renderSaved();
  if(seg==='defs')   return renderDefs();
  if(seg==='drugs')  return renderDrugMatrix();
  if(seg==='recents')return renderRecents();
  renderHome();
}

/* ---------- HOME ---------- */
function renderHome(){
  const legend=PAL10.map(h=>`<i style="background:${h}"></i>`).join('');
  const tops=TOPICS.topics.slice(0,10).map((t,i)=>{const hx=PAL10[i%10];
    return `<a class="tile" href="#/topic/${t.id}" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(topicIcon(t))}</span><span class="lb">${esc(t.name)}</span></a>`}).join('');
  const ac=acts().slice(0,10).map(a=>`<a class="tile" href="#/a/${a.id}" style="background:${tileBg(a.hue)};--tsh:color-mix(in srgb,${a.hue} 55%,transparent)"><span class="chip"><span class="mono">${esc(a.abbr)}</span></span><span class="lb">${esc(a.short)}</span></a>`).join('');
  const study=[['Recall drill','weakest-first','activity','#797efe','/study/drill'],['Section quiz','test yourself','alert','#fc8f66','/study/quiz'],['Scenarios','worked','file','#3dcfae','/study/scen'],['Drug matrix','MDA','droplet','#fec846','/drugs']]
    .map(([n,d,i,h,r])=>`<a class="tile" href="#${r}" style="background:${tileBg(h)};--tsh:color-mix(in srgb,${h} 55%,transparent)"><span class="chip">${ic(i)}</span><span class="lb">${n}<small>${d}</small></span></a>`).join('');
  const last=ls.get('last',null);
  const cont=last?`<a class="cont" href="#/s/${last.a}/${last.id}" style="background:${tileBg(hue(last.a))};--tsh:color-mix(in srgb,${hue(last.a)} 55%,transparent)"><span class="big">${esc(last.num)}</span><div class="meta"><div class="tag">${esc(SRC[last.a].short)} · ${esc(last.disp)}</div><div class="tt">${esc(last.t)}</div><div class="ex">${esc(last.p||'')}</div></div><span class="play">${ic('play')}</span></a>`
    :`<a class="cont" href="#/s/cc/cc-279" style="background:${tileBg(hue('cc'))};--tsh:color-mix(in srgb,${hue('cc')} 55%,transparent)"><span class="big">279</span><div class="meta"><div class="tag">Criminal Code · s 279</div><div class="tt">Murder</div><div class="ex">Start with the homicide spine, or jump anywhere with search.</div></div><span class="play">${ic('play')}</span></a>`;
  $('#main').innerHTML=`
    <div class="legend fade">${legend}</div>
    <h1 class="h-title fade">Verbatim WA law,<br>in your pocket.</h1>
    <a class="sfield fade" href="#/search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Search ${REG.counts.provisions.toLocaleString()} provisions… <span class="kbd">⌘K</span></a>
    <div class="row-h"><h2>Jump back in</h2></div>
    <div class="tilegrid fade">${cont}</div>
    <div class="row-h"><h2>Topics</h2><a class="more" href="#/topics">All ${TOPICS.topics.length}</a></div>
    <div class="tilegrid fade">${tops}</div>
    <div class="row-h"><h2>Acts &amp; Codes</h2><a class="more" href="#/browse">All ${REG.counts.acts}</a></div>
    <div class="tilegrid fade">${ac}</div>
    <div class="row-h"><h2>Study</h2></div>
    <div class="tilegrid fade">${study}</div>`;
}

/* ---------- BROWSE ---------- */
function renderBrowse(mode){
  const seg=`<div class="seg"><a class="${mode==='topics'?'on':''}" href="#/topics">Topics</a><a class="${mode==='acts'?'on':''}" href="#/browse">Acts</a></div>`;
  let body='';
  if(mode==='topics'){
    body=TOPICS.doms.map((d,i)=>{const ts=TOPICS.topics.filter(t=>t.dom===i);if(!ts.length)return'';
      return `<div class="row-h" style="margin-top:24px"><h2 style="font-size:1rem">${esc(d)}</h2></div><div class="tilegrid">`+
        ts.map((t,j)=>{const hx=PAL10[(i*3+j)%10];return `<a class="tile" href="#/topic/${t.id}" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(topicIcon(t))}</span><span class="lb">${esc(t.name)}</span></a>`}).join('')+`</div>`}).join('');
  } else {
    const grp=(label,cat)=>{const xs=REG.sources.filter(s=>s.cat===cat);if(!xs.length)return'';
      return `<div class="row-h" style="margin-top:22px"><h2 style="font-size:1rem">${label}</h2><span class="more" style="color:var(--ink-4)">${xs.length}</span></div><div class="tilegrid">`+
        xs.map(a=>`<a class="tile" href="#/a/${a.id}" style="background:${tileBg(a.hue)};--tsh:color-mix(in srgb,${a.hue} 55%,transparent)"><span class="chip"><span class="mono">${esc(a.abbr)}</span></span><span class="lb">${esc(a.short)}</span></a>`).join('')+`</div>`};
    body=grp('Acts &amp; Codes','act')+grp('Doctrine &amp; manuals','doc')+grp('Reference library','ref');
  }
  $('#main').innerHTML=`<h1 class="h-title fade" style="margin-bottom:4px">Browse</h1>${seg}<div class="fade">${body}</div>`;
}

/* ---------- OFFENCE LIBRARY (main page) ---------- */
function offMain(o){return `<a class="s-item" href="#/s/${o.a}/${o.id}"><span class="sn" style="background:${ink(o.a)}">${esc(o.num?('s '+o.num):'·')}</span><span class="stx">${esc(o.t)}</span><span class="smeta">${esc(SRC[o.a].abbr)}</span></a>`}
function offListHtml(list,title){return `<div class="cite-h" style="margin:14px 0 10px">${esc(title)} · ${list.length}</div><div class="s-res" style="margin-top:0">`+list.map(offMain).join('')+`</div>`}
function renderOffences(view,key){
  view=view||'home';
  const seg=`<div class="seg"><a class="${view==='home'||view==='t'?'on':''}" href="#/offences">By type</a><a class="${view==='act'||view==='a'?'on':''}" href="#/offences/act">By act</a><a class="${view==='az'?'on':''}" href="#/offences/az">A–Z</a></div>`;
  let body='';
  if(view==='t'&&key){const ty=OFF.types.find(x=>x.id===key);const list=OFF.offences.filter(o=>o.type===key);
    body=`<a class="r-back fade" href="#/offences">${ic('back','currentColor')} All types</a>`+offListHtml(list,ty?ty.label:'Offences');
  } else if(view==='a'&&key){const list=OFF.offences.filter(o=>o.a===key);
    body=`<a class="r-back fade" href="#/offences/act">${ic('back','currentColor')} By act</a>`+offListHtml(list,SRC[key]?SRC[key].short:'Offences');
  } else if(view==='act'){
    body=acts().filter(a=>OFF.offences.some(o=>o.a===a.id)).map(a=>{const n=OFF.offences.filter(o=>o.a===a.id).length;
      return `<a class="arow" href="#/offences/a/${a.id}"><span class="badge" style="background:${tileBg(a.hue)};--tsh:${tsh(a.id)}"><span class="mono" style="font-family:var(--mono);font-size:12px">${esc(a.abbr)}</span></span><div><div class="nm">${esc(a.short)}</div><div class="me">${n} offence${n>1?'s':''}</div></div><span class="ch">${ic('chev','currentColor')}</span></a>`}).join('');
  } else if(view==='az'){
    const byL={};OFF.offences.forEach(o=>{const L=(o.t[0]||'#').toUpperCase();(byL[L]=byL[L]||[]).push(o)});
    body=Object.keys(byL).sort().map(L=>`<div class="cite-h" style="margin:18px 0 10px">${L}</div><div class="s-res" style="margin-top:0">`+byL[L].map(offMain).join('')+`</div>`).join('');
  } else {
    body=`<div class="tilegrid fade">`+OFF.types.map((ty,i)=>{const hx=PAL10[i%10];
      return `<a class="tile" href="#/offences/t/${ty.id}" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(ty.icon)}</span><span class="lb">${esc(ty.label)}<small>${ty.n} offence${ty.n>1?'s':''}</small></span></a>`}).join('')+`</div>`;
  }
  $('#main').innerHTML=`<h1 class="h-title fade" style="margin-bottom:4px">Offences</h1><p class="sub-note fade">${OFF.offences.length} named offences across the Acts — grouped by type, by Act, or A–Z. Tap any to read it verbatim with its memorise card.</p>${seg}<div class="fade">${body}</div>`;
}

/* ---------- ACT PAGE (hierarchical tree) ---------- */
async function renderActPage(aid){
  if(!SRC[aid]){return renderHome();}
  $('#main').innerHTML=`<div class="boot"><span class="spin"></span>Loading ${esc(SRC[aid].short)}…</div>`;
  let d; try{d=await loadAct(aid)}catch(e){$('#main').innerHTML=`<div class="boot">Couldn’t load ${esc(SRC[aid].name)}.</div>`;return}
  curAct=aid; accAct=aid; renderSidebar(); autoOpenPart(aid);
  const a=SRC[aid], chById=Object.fromEntries((d.chapters||[]).map(c=>[c.id,c]));
  const secsByCh={}; d.sections.forEach(s=>{(secsByCh[s.ch]=secsByCh[s.ch]||[]).push(s)});
  const row=s=>`<a class="arow" href="#/s/${aid}/${s.id}"><span class="badge" style="background:${tileBg(a.hue)};--tsh:${tsh(aid)}">${esc(s.num)}</span><div><div class="nm">${esc(s.t)}</div><div class="me">${esc(ud(s))}</div></div><span class="ch">${ic('chev','currentColor')}</span></a>`;
  let body='';
  for(const node of (d.tree||[])){
    body+=`<div class="tree-part"><div class="tp-h">${esc(node.label||'')}${node.title?(' · '+esc(node.title)):''}</div>${node.sub?`<div class="tp-sub">${esc(node.sub)}</div>`:''}`;
    for(const it of (node.items||[])){
      if(it.k==='lbl') body+=`<div class="tp-lbl">${esc(it.t)}</div>`;
      else if(it.k==='sec'){const s=d._byId[it.id]; if(s) body+=row(s);}
      else if(it.k==='ch'){const c=chById[it.id]; body+=`<div class="tp-ch">${esc(c?c.label:'')}${c&&c.title?(' · '+esc(c.title)):''}</div>`+(secsByCh[it.id]||[]).map(row).join('');}
    }
    body+=`</div>`;
  }
  $('#main').innerHTML=`
    <a class="r-back fade" href="#/browse">${ic('back','currentColor')} Browse</a>
    <div class="r-band fade" style="--h:${a.hue};--hi:${a.ink}"><div class="act"><span style="width:9px;height:9px;border-radius:3px;background:${a.hue};display:inline-block"></span>${a.cat==='act'?'Act':a.cat==='doc'?'Doctrine':'Reference'}${a.comp?(' · as at '+esc(a.comp)):''}</div><div class="stt" style="margin-top:8px">${esc(a.name)}</div><div style="font-size:13px;color:var(--ink-3);margin-top:6px">${a.n?a.n.toLocaleString()+' provisions':''}</div></div>
    <div class="fade">${body}</div>`;
}

/* ---------- READER ---------- */
async function openSec(aid,sid){
  if(!SRC[aid]) return renderHome();
  $('#main').innerHTML=`<div class="boot"><span class="spin"></span>Loading…</div>`;
  let d; try{d=await loadAct(aid)}catch(e){$('#main').innerHTML=`<div class="boot">Couldn’t load that section.</div>`;return}
  const s=d._byId[sid]; if(!s){$('#main').innerHTML=`<div class="boot">Section not found.</div>`;return}
  curAct=aid; curSec=sid; accAct=aid;
  const a=SRC[aid];
  pushRecent(aid,s); ls.set('last',{a:aid,id:sid,num:s.num,disp:ud(s),t:s.t,p:(s.b||'').slice(0,140)});
  renderSidebar(); autoOpenPart(aid);
  const alt=s.alt?`<div class="altbox"><div><div class="lbl">Alternative charges</div><div class="body">${esc(s.alt)}</div></div></div>`:'';
  const idx=d.sections.indexOf(s), prev=idx>0?d.sections[idx-1]:null, next=idx<d.sections.length-1?d.sections[idx+1]:null;
  const refs=(s.rf||[]).map(r=>d._byId[r]).filter(Boolean).slice(0,12);
  const chips=refs.length?`<div class="cite-h">Cited in this section</div><div class="cwrap">`+refs.map(r=>`<a class="chip2" href="#/s/${aid}/${r.id}"><span class="n" style="background:${a.ink}">${esc(ud(r))}</span>${esc((r.t||'').slice(0,32))}</a>`).join('')+`</div>`:'';
  const inT=TOPICS.topics.filter(t=>JSON.stringify(t.clusters||[]).includes('"'+sid+'"')).slice(0,4);
  const topc=inT.length?`<div class="cite-h">Appears in topics</div><div class="cwrap">`+inT.map(t=>`<a class="chip2" href="#/topic/${t.id}">${esc(t.name)}</a>`).join('')+`</div>`:'';
  const marksOn=ls.get('marks',true);
  const saved=(ls.get('saved',[])||[]).some(x=>x.a===aid&&x.id===sid);
  curPrev=prev?('/s/'+aid+'/'+prev.id):null; curNext=next?('/s/'+aid+'/'+next.id):null;
  const pager=(prev||next)?`<div class="pager">${prev?`<a class="pgbtn" href="#/s/${aid}/${prev.id}"><span class="dir">‹ Previous</span><span class="pnm">${esc(ud(prev))} · ${esc((prev.t||'').slice(0,42))}</span></a>`:'<span></span>'}${next?`<a class="pgbtn next" href="#/s/${aid}/${next.id}"><span class="dir">Next ›</span><span class="pnm">${esc(ud(next))} · ${esc((next.t||'').slice(0,42))}</span></a>`:'<span></span>'}</div>`:'';
  const key=aid+'|'+sid; const memo=SCAF[key]?scaffoldCard(key,SCAF[key],a):'';
  $('#main').innerHTML=`
    <div class="r-top fade">
      <a class="r-back" href="#/a/${aid}">${ic('back','currentColor')} ${esc(a.short)}</a>
      <div class="r-tools">
        <button class="rtb ${saved?'saved':''}" id="saveBtn" aria-pressed="${saved}" aria-label="Save section" title="Save section">${ic('heart','currentColor')}<span>${saved?'Saved':'Save'}</span></button>
        <button class="rtb" id="copyBtn" aria-label="Copy verbatim text" title="Copy verbatim text">${ic('copy','currentColor')}<span>Copy</span></button>
        <button class="rtb ${marksOn?'on':''}" id="markBtn" aria-pressed="${marksOn}" aria-label="Toggle defined-term highlights" title="Toggle defined-term highlights">${ic('book','currentColor')}<span>Terms</span></button>
      </div>
    </div>
    <div class="r-card fade"><div class="r-strip" style="--h:${a.hue};--hi:${a.ink}"></div>
      <div class="r-head" style="--h:${a.hue};--hi:${a.ink}"><span class="snum">${esc(ud(s))}</span><div><div class="act"><i></i>${esc(a.name)}</div><div class="stt">${esc(s.t)}</div></div></div>
      <div class="r-body" style="--h:${a.hue};--hi:${a.ink}">${alt}<div class="statute" id="statBody">${marksOn?markTerms(s.h,aid):s.h}</div>${chips}${topc}</div></div>
    ${memo}
    ${pager}`;
  wireReader(aid,s,key);
}
function wireStatBody(aid){
  $$('#statBody .xref').forEach(x=>{const t=actCache[aid]._byId[x.dataset.s]; if(t)x.onclick=()=>navigate('/s/'+aid+'/'+t.id); else x.onclick=()=>toast('Cross-reference outside the sample');});
  $$('#statBody dfn').forEach(df=>{const d=DEFS.find(x=>x.a===aid&&x.t.toLowerCase()===df.dataset.term); if(!d){df.style.cssText='background:none;border:0';return;}
    if(FINE){ df.addEventListener('mouseenter',()=>{clearTimeout(tipT);showTerm(df,d)}); df.addEventListener('mouseleave',hideTermSoon); df.addEventListener('click',ev=>{ev.preventDefault();hideTerm();navigate('/s/'+d.a+'/'+d.s)}); }
    else { df.addEventListener('click',ev=>{ev.stopPropagation();showTerm(df,d)}); }
  });
}
function wireReader(aid,s,key){
  wireStatBody(aid);
  try{document.title=ud(s)+' '+s.t+' · WA Legislation';}catch(e){}
  $('#saveBtn').onclick=()=>{toggleSave(aid,s);};
  $('#copyBtn').onclick=()=>{navigator.clipboard&&navigator.clipboard.writeText(`${SRC[aid].name} ${ud(s)} — ${s.t}\n\n${s.b}`);toast('Verbatim copied')};
  $('#markBtn').onclick=()=>{const on=!ls.get('marks',true);ls.set('marks',on);const sb=$('#statBody');if(sb){sb.innerHTML=on?markTerms(s.h,aid):s.h;wireStatBody(aid);}const mb=$('#markBtn');if(mb){mb.classList.toggle('on',on);mb.setAttribute('aria-pressed',on);}};
  const mc=$('#memoCopy'); if(mc)mc.onclick=()=>copyScaffold(key);
  const md=$('#memoDrill'); if(md)md.onclick=()=>{const m=$('#memo');const on=m.classList.toggle('drill');md.textContent=on?'Reveal all':'Drill';if(!on)$$('#memo .mitem').forEach(li=>li.classList.remove('shown'));};
  $$('#memo .mitem').forEach(li=>li.addEventListener('click',()=>{if($('#memo').classList.contains('drill'))li.classList.toggle('shown')}));
}
function scaffoldCard(key,sc,a){
  const items=sc.items.map(it=>`<li class="mitem"><span class="mk">${esc(it.k)}</span><div class="mbody"><span class="mtx">${esc(it.txt)}</span>${it.eg?`<span class="meg">${esc(it.eg)}</span>`:''}</div></li>`).join('');
  return `<div class="memo fade" id="memo" style="--h:${a.hue};--hi:${a.ink}">
    <div class="memo-h"><span class="memo-badge">${ic('study','currentColor')} Memorise${sc.count?`<span class="memo-ct">${esc(sc.count.n)}</span>`:''}</span><div class="memo-act"><button class="mbtn" id="memoDrill">Drill</button><button class="mbtn" id="memoCopy">${ic('copy','currentColor')} Copy</button></div></div>
    ${sc.name?`<div class="memo-name">${esc(sc.name)}${sc.sec?` <span class="memo-sec">${esc(sc.sec)}</span>`:''}</div>`:''}
    ${sc.hook?`<div class="memo-hook">${ic('activity','currentColor')} ${esc(sc.hook)}</div>`:''}
    <ol class="memo-list">${items}</ol>
    ${sc.note?`<div class="memo-note">${esc(sc.note)}</div>`:''}
    <div class="memo-fyi">Study aid — your own condensed notes, not the verbatim text above.</div>
  </div>`;
}
function copyScaffold(key){const sc=SCAF[key];if(!sc)return;
  let t=(sc.name||'')+(sc.sec?(' — '+sc.sec):'')+(sc.count?(' ('+sc.count.n+')'):'')+'\n';
  if(sc.hook)t+='Hook: '+sc.hook+'\n';
  sc.items.forEach(it=>{t+=`(${it.k}) ${it.txt}`+(it.eg?` — e.g. ${it.eg}`:'')+'\n';});
  if(sc.note)t+='Note: '+sc.note+'\n';
  navigator.clipboard&&navigator.clipboard.writeText(t.trim());toast('Scaffold copied');
}
function toggleSave(aid,s){let sv=ls.get('saved',[])||[];const k=x=>x.a===aid&&x.id===s.id;
  if(sv.some(k)){sv=sv.filter(x=>!k(x));toast('Removed')}else{sv.unshift({a:aid,id:s.id,num:s.num,disp:ud(s),t:s.t});toast('Saved')}
  ls.set('saved',sv.slice(0,200)); if(curSec===s.id){const b=$('#saveBtn');const now=sv.some(k);if(b){b.classList.toggle('saved',now);b.setAttribute('aria-pressed',now);b.innerHTML=ic('heart','currentColor')+'<span>'+(now?'Saved':'Save')+'</span>'}}}
function pushRecent(aid,s){let r=ls.get('recents',[])||[];r=r.filter(x=>!(x.a===aid&&x.id===s.id));r.unshift({a:aid,id:s.id,num:s.num,disp:ud(s),t:s.t});ls.set('recents',r.slice(0,30))}

/* defined-term marking (act-scoped, non-destructive, exact spacing) */
function markTerms(html,aid){
  const terms=defsOf(aid).slice().sort((a,b)=>b.t.length-a.t.length); if(!terms.length)return html;
  const tmp=document.createElement('div'); tmp.innerHTML=html;
  const walk=n=>{for(const c of [...n.childNodes]){
    if(c.nodeType===3){const txt=c.nodeValue;
      for(const d of terms){const m=new RegExp('\\b('+escRe(d.t)+')\\b','i').exec(txt);
        if(m){const f=document.createDocumentFragment();
          if(m.index>0)f.appendChild(document.createTextNode(txt.slice(0,m.index)));
          const df=document.createElement('dfn');df.textContent=m[0];df.dataset.term=d.t.toLowerCase();f.appendChild(df);
          const rest=txt.slice(m.index+m[0].length);if(rest)f.appendChild(document.createTextNode(rest));
          c.replaceWith(f);break;}}}
    else if(c.nodeType===1&&!['DFN','A'].includes(c.tagName)&&!c.classList.contains('mk'))walk(c);}};
  walk(tmp); return tmp.innerHTML;
}
let tipT, FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
function showTerm(el,d){
  const p=$('#pop');
  p.innerHTML=`<div class="grab"></div><div class="pt">${esc(d.t)}</div><div class="ps">${esc(SRC[d.a].abbr)} s ${esc(d.num)}${d.sc?(' · '+esc(d.sc)):''}</div><div class="pd">${esc(d.d)}</div><div class="pj" id="popjump">Open s ${esc(d.num)} →</div>`;
  $('#popjump').onclick=ev=>{ev.stopPropagation();hideTerm();navigate('/s/'+d.a+'/'+d.s)};
  if(!FINE){ p.classList.add('sheet'); p.classList.add('on'); termScrim(true); return; }
  p.classList.remove('sheet'); p.style.left='-9999px'; p.style.top='0'; p.classList.add('on');
  const pr=p.getBoundingClientRect(), r=el.getBoundingClientRect(), gap=8;
  let top=r.bottom+gap; if(top+pr.height>innerHeight-8) top=Math.max(8, r.top-gap-pr.height);
  const left=Math.min(Math.max(8, r.left), innerWidth-pr.width-8);
  p.style.left=left+'px'; p.style.top=top+'px';
  p.onmouseenter=()=>clearTimeout(tipT); p.onmouseleave=hideTermSoon;
}
function hideTermSoon(){clearTimeout(tipT);tipT=setTimeout(hideTerm,150)}
function hideTerm(){clearTimeout(tipT);const p=$('#pop');p.classList.remove('on');p.classList.remove('sheet');termScrim(false)}
function termScrim(on){let s=$('#termScrim');if(!s){s=document.createElement('div');s.id='termScrim';s.className='term-scrim';s.addEventListener('click',hideTerm);document.body.appendChild(s)}s.classList.toggle('on',on)}

/* ---------- TOPIC ---------- */
function renderTopicPage(id){
  const t=TOPICS.topics.find(x=>x.id===id); if(!t)return renderBrowse('topics');
  const fam=(t.clusters&&t.clusters[0]&&t.clusters[0].c[0])?SRC[t.clusters[0].c[0].a].fam:'blue';const hx=REG.palette[fam];
  const cl=(t.clusters||[]).map(c=>`<div class="cite-h">${esc(c.h)}</div><div style="display:flex;flex-direction:column;gap:9px">`+
    (c.c||[]).map(x=>`<a class="chip2" style="justify-content:flex-start;padding:13px 15px" href="#/s/${x.a}/${x.s}"><span class="n" style="background:${ink(x.a)}">${esc((x.u==='s'?'s ':'')+x.n)}</span><span style="font-weight:600">${esc(x.t)}</span><span style="margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-4)">${esc(SRC[x.a].abbr)}</span></a>`).join('')+`</div>`).join('');
  $('#main').innerHTML=`<a class="r-back fade" href="#/topics">${ic('back','currentColor')} Topics</a>
    <div class="tile fade" style="min-height:96px;align-items:flex-start;margin:6px 0 16px;background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(topicIcon(t))}</span><span class="lb" style="font-size:1.3rem;text-align:left;margin-top:8px">${esc(t.name)}<small style="font-size:12.5px;line-height:1.4">${esc(t.blurb||'')}</small></span></div>${cl}`;
}

/* ---------- SEARCH ---------- */
let searchT;
function pushSearch(q){q=(q||'').trim();if(q.length<2)return;let r=ls.get('searches',[])||[];r=r.filter(x=>x.toLowerCase()!==q.toLowerCase());r.unshift(q);ls.set('searches',r.slice(0,8));}
function hl(text,q){text=text==null?'':String(text);if(!q)return esc(text);const i=text.toLowerCase().indexOf(q);if(i<0)return esc(text);return esc(text.slice(0,i))+'<mark>'+esc(text.slice(i,i+q.length))+'</mark>'+esc(text.slice(i+q.length));}
function snippet(e,q){let body=(actCache[e.a]&&actCache[e.a]._byId[e.id]&&actCache[e.a]._byId[e.id].b)||(FTEXT&&FTEXT[e.a+'|'+e.id])||'';const low=body.toLowerCase();const i=low.indexOf(q);if(i<0)return '';const s=Math.max(0,i-46),en=Math.min(body.length,i+q.length+78);return (s>0?'… ':'')+esc(body.slice(s,i))+'<mark>'+esc(body.slice(i,i+q.length))+'</mark>'+esc(body.slice(i+q.length,en))+(en<body.length?' …':'');}
function renderSearch(q){
  $('#main').innerHTML=`<h1 class="h-title fade" style="margin-bottom:8px">Search</h1>
    <div class="sfield fade" style="height:54px"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="sin" aria-label="Search legislation" placeholder="Section number, words, or a term…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" style="flex:1;border:0;outline:0;background:none;font-size:15.5px;color:var(--ink);font-family:inherit"><button id="sclear" class="sclear" aria-label="Clear search" title="Clear" hidden>✕</button></div>
    <div class="s-res" id="sres"></div>`;
  const i=$('#sin'); i.value=q||'';
  const clr=$('#sclear'); const toggleClr=()=>{if(clr)clr.hidden=!i.value;}; toggleClr();
  i.addEventListener('input',()=>{toggleClr();clearTimeout(searchT);searchT=setTimeout(()=>runSearch(i.value),110)});
  i.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('#sres a.s-item'); if(first){e.preventDefault();const v=i.value.trim(); if(v.length>=2)pushSearch(v); navigate(first.getAttribute('href').slice(1));}}});
  if(clr)clr.onclick=()=>{i.value='';toggleClr();runSearch('');i.focus();};
  $('#sres').addEventListener('click',e=>{
    const x=e.target.closest('.s-x'); if(x){e.preventDefault();e.stopPropagation();ls.set('searches',(ls.get('searches',[])||[]).filter(v=>v!==x.dataset.q));runSearch(i.value);return;}
    const c=e.target.closest('.s-clear'); if(c){e.preventDefault();ls.set('searches',[]);runSearch(i.value);return;}
    if(e.target.closest('a.s-item')){const v=i.value.trim();if(v.length>=2)pushSearch(v);}
  });
  i.focus(); runSearch(q||'');
  if(!FTEXT && !loadingFT){ loadingFT=true; jget('ftext.json').then(d=>{FTEXT=d;loadingFT=false; if($('#sin'))runSearch($('#sin').value)}).catch(()=>loadingFT=false); }
}
function runSearch(q){
  q=(q||'').trim().toLowerCase(); const el=$('#sres'); if(!el)return;
  if(!q){
    const rec=ls.get('searches',[])||[]; let h='';
    if(rec.length){ h+=`<div class="s-grp s-grp-row">Recent <button class="s-clear">Clear</button></div>`+rec.map(r=>`<div class="s-rec"><a class="s-recline" href="#/search/${encodeURIComponent(r)}"><svg class="rico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>${esc(r)}</a><button class="s-x" data-q="${esc(r)}" aria-label="Remove">✕</button></div>`).join(''); }
    h+=`<div class="s-grp">Try</div><div class="s-recent" style="margin-top:0"><a class="s-rchip" href="#/search/279">s 279</a><a class="s-rchip" href="#/search/murder">murder</a><a class="s-rchip" href="#/search/grievous">grievous bodily harm</a><a class="s-rchip" href="#/search/deemed%20supply">deemed supply</a><a class="s-rchip" href="#/search/search%20warrant">search warrant</a></div>`;
    el.innerHTML=h; return;
  }
  const isNum=/^\d/.test(q.replace(/^s\.?\s*/,'')); const qn=q.replace(/^s\.?\s*/,'');
  const titleHit=[], seen=new Set();
  for(const e of SEARCH){const t=(e.num+' '+e.t).toLowerCase();
    if((isNum&&String(e.num).toLowerCase().startsWith(qn))||t.includes(q)){titleHit.push(e);seen.add(e.a+'|'+e.id);if(titleHit.length>=40)break;}}
  const defs=DEFS.filter(d=>d.t.toLowerCase().includes(q)).slice(0,12);
  const tops=TOPICS.topics.filter(t=>t.name.toLowerCase().includes(q)).slice(0,8);
  const srcs=REG.sources.filter(s=>(s.name+' '+s.abbr).toLowerCase().includes(q)).slice(0,6);
  let bodyHit=[];
  if(FTEXT && q.length>=2){ for(const e of SEARCH){const k=e.a+'|'+e.id; if(seen.has(k))continue; const b=FTEXT[k]; if(b&&b.includes(q)){bodyHit.push(e); if(bodyHit.length>=30)break;}} }
  const secRow=e=>`<a class="s-item" href="#/s/${e.a}/${e.id}"><span class="sn" style="background:${ink(e.a)}">${esc((e.u==='s'?'s ':'')+e.num)}</span><span class="stx">${hl(e.t,q)}</span><span class="smeta">${esc(SRC[e.a].abbr)}</span></a>`;
  const ftRow=e=>`<a class="s-item ft" href="#/s/${e.a}/${e.id}"><span class="sn" style="background:${ink(e.a)}">${esc((e.u==='s'?'s ':'')+e.num)}</span><span class="ftcol"><span class="stx">${hl(e.t,q)}</span><span class="snip">${snippet(e,q)}</span></span><span class="smeta">${esc(SRC[e.a].abbr)}</span></a>`;
  let html='';
  if(titleHit.length){html+=`<div class="s-grp">Sections</div>`+titleHit.slice(0,12).map(secRow).join('')}
  if(srcs.length){html+=`<div class="s-grp">Acts &amp; sources</div>`+srcs.map(s=>`<a class="s-item" href="#/a/${s.id}"><span class="sn" style="background:${s.hue}"> </span><span class="stx">${hl(s.name,q)}</span><span class="smeta">${esc(s.abbr)}</span></a>`).join('')}
  if(defs.length){html+=`<div class="s-grp">Definitions</div>`+defs.map(d=>`<a class="s-item" href="#/s/${d.a}/${d.s}"><span class="sn" style="background:var(--ink-3)">def</span><span class="stx">${hl(d.t,q)}</span><span class="smeta">${esc(SRC[d.a].abbr)} ${esc(d.num)}</span></a>`).join('')}
  if(tops.length){html+=`<div class="s-grp">Topics</div>`+tops.map(t=>`<a class="s-item" href="#/topic/${t.id}"><span class="sn" style="background:var(--ink-3)">topic</span><span class="stx">${hl(t.name,q)}</span></a>`).join('')}
  if(bodyHit.length){html+=`<div class="s-grp">In the provision text</div>`+bodyHit.slice(0,14).map(ftRow).join('')}
  else if(!FTEXT){html+=`<div class="s-grp" style="color:var(--ink-4)"><span class="spin" style="width:11px;height:11px"></span> loading full-text…</div>`}
  el.innerHTML=html||`<p class="empty">No matches for “${esc(q)}”.</p>`;
}

/* ---------- STUDY / SAVED / RECENTS / DEFS / DRUGS ---------- */
function studyTiles(full){return [['Recall drill',full?'flip cards · weakest-first':'flip cards','activity','#797efe','/study/drill'],['Section quiz',full?'multiple choice or type':'test yourself','alert','#fc8f66','/study/quiz'],['Scenarios',full?'worked examples':'worked','file','#3dcfae','/study/scen'],['Drug matrix','MDA quantities','droplet','#fec846','/drugs']]
  .map(([n,d,i,h,a])=>`<a class="tile" href="#${a}" style="background:${tileBg(h)};--tsh:color-mix(in srgb,${h} 55%,transparent)"><span class="chip">${ic(i)}</span><span class="lb">${n}<small>${d}</small></span></a>`).join('')}
function renderStudy(){
  const n=Object.keys(SCAF).length;
  $('#main').innerHTML=`<h1 class="h-title fade">Study</h1><div class="tilegrid fade">${studyTiles(true)}</div>
   <p style="color:var(--ink-4);font-size:13px;margin-top:20px">Active recall over ${n} recall scaffolds — every string built from verbatim source, no invented law. Your weakest cards surface first.</p>`;
}
function studyHead(title){return `<a class="r-back fade" href="#/study">${ic('back','currentColor')} Study</a><h1 class="h-title" style="margin:6px 0 14px">${esc(title)}</h1>`;}
const _shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const _pick=(a,n)=>_shuf(a).slice(0,n);
function scaffoldKeys(){return Object.keys(SCAF).filter(k=>SCAF[k]&&SCAF[k].items&&SCAF[k].items.length);}

/* ===== RECALL DRILL — active recall over scaffold cards, weakest-first ===== */
let drillSess=null;
function weakestFirst(keys){const sc=ls.get('drillScore',{})||{};
  return keys.slice().sort((a,b)=>{const A=sc[a],B=sc[b];const ap=A?1:0,bp=B?1:0;
    if(ap!==bp)return ap-bp;                       // never-seen first
    if(A&&B&&A.s!==B.s)return A.s-B.s;              // then lowest score (weakest)
    return Math.random()-.5;});}
function renderDrill(){
  const keys=scaffoldKeys();
  if(!keys.length){$('#main').innerHTML=studyHead('Recall drill')+`<p class="empty">No scaffolds loaded.</p>`;return;}
  const q=weakestFirst(keys).slice(0,Math.min(15,keys.length));
  drillSess={queue:q,i:0,size:q.length,res:{got:0,hard:0,miss:0}};
  document.title='Recall drill · WA Legislation';
  drillStep();
}
function drillStep(){
  const s=drillSess; if(!s)return; if(s.i>=s.queue.length)return drillDone();
  const key=s.queue[s.i], sc=SCAF[key], a=key.split('|')[0], id=key.split('|')[1];
  const cnt=sc.count&&sc.count.n, unit=/limb/i.test((sc.count&&sc.count.q)||'')?'limbs':'elements';
  const prompt=cnt?`Recall the ${cnt} ${unit}`:'Recall the elements';
  const items=sc.items.map((it,idx)=>`<li class="dmi" data-i="${idx}"><span class="dmk">${esc(it.k||'•')}</span><span class="dmb"><span class="dmt">${esc(it.txt)}</span>${it.eg?`<span class="dme">${esc(it.eg)}</span>`:''}</span></li>`).join('');
  $('#main').innerHTML=studyHead('Recall drill')+`
  <div class="qprog"><span style="width:${Math.round(s.i/s.size*100)}%"></span></div>
  <div class="qcount">${s.i+1} / ${s.size}</div>
  <div class="dcard fade" style="--h:${hue(a)};--hi:${ink(a)}">
    <div class="r-strip"></div>
    <div class="dbody">
      <div class="dact">${esc(SRC[a].abbr)} ${esc(sc.sec||ud({u:'s',num:id}))}</div>
      <h2 class="dname">${esc(sc.name)}</h2><p class="dprompt">${prompt}</p>
      <ul class="dlist drillblur" id="dlist">${items}</ul>
      ${sc.note?`<p class="dnote" hidden>${esc(sc.note)}</p>`:''}
    </div>
    <div class="dactions" id="dreveal"><button class="qbtn primary" id="dRevealBtn">Reveal answer</button><a class="qbtn ghost" href="#/s/${a}/${id}">Open section</a></div>
    <div class="drate" id="drate" hidden><button class="rate miss" data-r="miss">Missed</button><button class="rate hard" data-r="hard">Hard</button><button class="rate got" data-r="got">Got it</button></div>
  </div>`;
  $('#dRevealBtn').onclick=()=>{$('#dlist').classList.remove('drillblur');const nt=$('.dnote');if(nt)nt.hidden=false;$('#dreveal').hidden=true;$('#drate').hidden=false;};
  $$('#dlist .dmi').forEach(li=>li.onclick=()=>{if($('#dlist').classList.contains('drillblur'))li.classList.toggle('peek');});
  $('#drate').onclick=e=>{const b=e.target.closest('.rate');if(b)rateDrill(key,b.dataset.r);};
}
function rateDrill(key,r){
  const sc=ls.get('drillScore',{})||{}; const cur=sc[key]||{s:0,n:0};
  cur.s=Math.max(-6,Math.min(10,(cur.s||0)+(r==='got'?2:r==='hard'?0:-2))); cur.n=(cur.n||0)+1; cur.t=Date.now();
  sc[key]=cur; ls.set('drillScore',sc);
  const s=drillSess; s.res[r]++;
  if(r==='miss'){s.queue.splice(Math.min(s.i+3,s.queue.length+1),0,key);s.size=s.queue.length;}
  else if(r==='hard'){s.queue.push(key);s.size=s.queue.length;}
  s.i++; drillStep();
}
function drillDone(){
  const s=drillSess,r=s.res;
  $('#main').innerHTML=studyHead('Recall drill')+`<div class="qdone fade"><div class="qbig">${r.got}<span>/${s.i}</span></div><p class="qsum">Got it ${r.got} · Hard ${r.hard} · Missed ${r.miss}</p><div class="qend"><button class="qbtn primary" id="qAgain">Drill again</button><a class="qbtn ghost" href="#/study">Done</a></div></div>`;
  $('#qAgain').onclick=renderDrill; drillSess=null;
}

/* ===== SECTION QUIZ — MCQ or type-in, generated from scaffolds + sections ===== */
let quizSess=null;
function quizPool(){
  // Prefer the named-offence library (clean offence titles) so questions read correctly;
  // attach scaffold elements/count only where a scaffold exists for that section.
  const seen=new Set();
  const off=(OFF.offences||[]).filter(o=>SRC[o.a]).map(o=>{const k=o.a+'|'+o.id;const sc=SCAF[k];
    return{key:k,a:o.a,id:o.id,name:o.t,sec:o.num?('s '+o.num):((sc&&sc.sec)||''),items:sc&&sc.items,count:sc&&sc.count};})
    .filter(c=>c.name&&c.sec&&!seen.has(c.key)&&seen.add(c.key));
  if(off.length>=8)return off;
  return scaffoldKeys().map(k=>{const[a,id]=k.split('|');const sc=SCAF[k];return{key:k,a,id,name:sc.name,sec:sc.sec||('s '+id.replace(/^[a-z]+-/,'')),items:sc.items,count:sc.count};});
}
function secLabel(c){return SRC[c.a].abbr+' '+c.sec;}
function genQuestion(pool,mode){
  const c=pool[Math.floor(Math.random()*pool.length)];
  const sib=pool.filter(x=>x.a===c.a&&x.key!==c.key);
  const others=sib.length>=3?sib:pool.filter(x=>x.key!==c.key);
  const types=mode==='type'?['nameOffence','nameSection','count']:['nameOffence','nameSection','count','pickElement'];
  let type=types[Math.floor(Math.random()*types.length)];
  if(type==='count'&&!(c.count&&c.count.n))type='nameOffence';
  if(type==='pickElement'&&!(c.items&&c.items.length))type='nameOffence';
  if(type==='nameOffence'){const ans=c.name;return{q:`What offence is ${secLabel(c)}?`,ans,opts:_shuf([ans,..._pick(others,3).map(x=>x.name)]),accept:[ans],a:c.a,id:c.id,type};}
  if(type==='nameSection'){const ans=secLabel(c);const num=(c.sec||'').replace(/[^0-9A-Za-z]/g,'');return{q:`Which section is “${esc(c.name)}” (${SRC[c.a].abbr})?`,ans,opts:_shuf([ans,..._pick(others,3).map(secLabel)]),accept:[ans,c.sec,num].filter(Boolean),a:c.a,id:c.id,type};}
  if(type==='count'){const n=String(c.count.n),unit=/limb/i.test((c.count.q)||'')?'limbs':'elements';const set=new Set([n]);let g=Math.max(1,+n-2)||1;while(set.size<4&&g<=+n+5){if(g!=+n)set.add(String(g));g++;}return{q:`How many ${unit} — ${esc(c.name)} (${secLabel(c)})?`,ans:n,opts:_shuf([...set]),accept:[n],a:c.a,id:c.id,type};}
  const it=c.items[Math.floor(Math.random()*c.items.length)];
  const distract=[...new Set(_shuf(others).slice(0,10).flatMap(x=>(x.items||[]).map(i=>i.txt)).filter(t=>t&&t!==it.txt))];
  return{q:`Which is an element of “${esc(c.name)}” (${secLabel(c)})?`,ans:it.txt,opts:_shuf([it.txt,..._pick(distract,3)]),accept:[it.txt],a:c.a,id:c.id,type};
}
function renderQuiz(){
  const pool=quizPool();
  if(pool.length<4){$('#main').innerHTML=studyHead('Section quiz')+`<p class="empty">Not enough scaffolds to quiz yet.</p>`;return;}
  quizSess={pool,mode:ls.get('quizMode','mc'),n:0,size:Math.min(12,pool.length),correct:0};
  document.title='Section quiz · WA Legislation';
  quizStep();
}
function quizStep(){
  const s=quizSess; if(!s)return; if(s.n>=s.size)return quizDone();
  s.answered=false; const Q=genQuestion(s.pool,s.mode); s.cur=Q;
  const toggle=`<div class="qmode">${[['mc','Multiple choice'],['type','Type answer']].map(([m,l])=>`<button data-m="${m}" class="${s.mode===m?'on':''}">${l}</button>`).join('')}</div>`;
  const body=s.mode==='mc'
    ?`<div class="qopts" id="qopts">${Q.opts.map(o=>`<button class="qopt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
    :`<form class="qform" id="qform"><input id="qin" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type your answer…" aria-label="Your answer"><button class="qbtn primary" type="submit">Check</button></form>`;
  $('#main').innerHTML=studyHead('Section quiz')+`${toggle}
   <div class="qprog"><span style="width:${Math.round(s.n/s.size*100)}%"></span></div>
   <div class="qcount">${s.n+1} / ${s.size} · score ${s.correct}</div>
   <div class="qcard fade" style="--h:${hue(Q.a)};--hi:${ink(Q.a)}"><p class="qq">${Q.q}</p>${body}<div class="qfb" id="qfb" hidden></div><div class="qnext" id="qnext" hidden><button class="qbtn primary" id="qNextBtn">Next</button></div></div>`;
  $$('.qmode button').forEach(b=>b.onclick=()=>{if(b.dataset.m!==s.mode){s.mode=b.dataset.m;ls.set('quizMode',s.mode);quizStep();}});
  if(s.mode==='mc'){$('#qopts').onclick=e=>{const b=e.target.closest('.qopt');if(b)quizAnswer(b.dataset.o,b);};}
  else{$('#qform').onsubmit=e=>{e.preventDefault();quizAnswer($('#qin').value,null);};const qi=$('#qin');if(qi)qi.focus();}
  const nb=$('#qNextBtn'); if(nb)nb.onclick=()=>{s.n++;quizStep();};
}
const _norm=s=>(s||'').toLowerCase().replace(/^s\.?\s*/,'').replace(/[^a-z0-9]/g,'');
function quizAnswer(given,btn){
  const s=quizSess,Q=s.cur; if(s.answered)return; s.answered=true;
  const g=_norm(given);
  const ok=Q.accept.some(x=>_norm(x)===g)||(Q.type!=='count'&&g.length>=4&&(_norm(Q.ans).includes(g)||g.includes(_norm(Q.ans))));
  if(ok)s.correct++;
  const fb=$('#qfb'); fb.hidden=false; fb.className='qfb '+(ok?'ok':'no');
  fb.innerHTML=(ok?'✓ Correct':'✗ '+esc(Q.ans))+` · <a href="#/s/${Q.a}/${Q.id}">open section</a>`;
  if(s.mode==='mc'){$$('.qopt').forEach(b=>{b.disabled=true;if(_norm(b.dataset.o)===_norm(Q.ans))b.classList.add('correct');else if(b===btn)b.classList.add('wrong');});}
  else{const qi=$('#qin');if(qi)qi.disabled=true;const sb=$('#qform button');if(sb)sb.disabled=true;}
  $('#qnext').hidden=false; const nb=$('#qNextBtn'); if(nb)nb.focus();
}
function quizDone(){
  const s=quizSess,pct=Math.round(s.correct/s.size*100);
  $('#main').innerHTML=studyHead('Section quiz')+`<div class="qdone fade"><div class="qbig">${s.correct}<span>/${s.size}</span></div><p class="qsum">${pct}% — ${pct>=80?'at the DTS competency bar (80%)':'keep drilling toward 80%'}</p><div class="qend"><button class="qbtn primary" id="qAgain">New quiz</button><a class="qbtn ghost" href="#/study">Done</a></div></div>`;
  $('#qAgain').onclick=renderQuiz; quizSess=null;
}
function renderScenarios(){
  loadStudy().then(()=>{const sc=STUDY.scen;const keys=Object.keys(sc);
    const body=keys.map(k=>{const v=sc[k];const a=k.split(':')[0];return `<div class="r-card" style="margin-bottom:12px;--h:${hue(a)};--hi:${ink(a)}"><div class="r-body"><div class="tag" style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--hi)">${esc(v.h||'')}</div><p style="margin:6px 0 0;color:var(--ink-2)">${esc(v.fact||'')}</p></div></div>`}).join('');
    $('#main').innerHTML=`<a class="r-back fade" href="#/study">${ic('back','currentColor')} Study</a><h1 class="h-title" style="margin:6px 0 12px">Scenarios</h1><div class="fade">${body}</div>`;
  });
}
function renderSaved(){
  const sv=ls.get('saved',[])||[];
  if(!sv.length){$('#main').innerHTML=`<h1 class="h-title fade">Saved</h1><div class="empty fade"><p>No saved sections yet. Tap ♥ Save in any provision and it’ll wait here.</p><div class="empty-cta"><a class="ecta" href="#/browse">Browse the Acts</a><a class="ecta ghost" href="#/search">Search</a></div></div>`;return;}
  const body=sv.map(x=>`<div class="row-wrap"><a class="arow" href="#/s/${x.a}/${x.id}"><span class="badge" style="background:${tileBg(hue(x.a))};--tsh:${tsh(x.a)}">${esc(x.num)}</span><div><div class="nm">${esc(x.t)}</div><div class="me">${esc(SRC[x.a].abbr)} · ${esc(x.disp)}</div></div></a><button class="row-x" data-a="${x.a}" data-id="${x.id}" aria-label="Remove from saved">✕</button></div>`).join('');
  $('#main').innerHTML=`<h1 class="h-title fade">Saved</h1><div class="fade" id="savedList">${body}</div>`;
  const list=$('#savedList'); if(list)list.addEventListener('click',e=>{const x=e.target.closest('.row-x'); if(x){e.preventDefault();const sv2=(ls.get('saved',[])||[]).filter(i=>!(i.a===x.dataset.a&&i.id===x.dataset.id));ls.set('saved',sv2);toast('Removed');renderSaved();}});
}
function renderRecents(){
  const r=ls.get('recents',[])||[];
  const body=r.length?r.map(x=>`<a class="arow" href="#/s/${x.a}/${x.id}"><span class="badge" style="background:${tileBg(hue(x.a))};--tsh:${tsh(x.a)}">${esc(x.num)}</span><div><div class="nm">${esc(x.t)}</div><div class="me">${esc(SRC[x.a].abbr)} · ${esc(x.disp)}</div></div><span class="ch">${ic('chev','currentColor')}</span></a>`).join(''):`<div class="empty"><p>No recents yet — open a section and it’ll show here.</p><div class="empty-cta"><a class="ecta" href="#/browse">Browse the Acts</a><a class="ecta ghost" href="#/search">Search</a></div></div>`;
  $('#main').innerHTML=`<h1 class="h-title fade">Recent</h1><div class="fade">${body}</div>`;
}
function renderDefs(){
  const byL={};DEFS.forEach(d=>{const L=(d.t[0]||'#').toUpperCase();(byL[L]=byL[L]||[]).push(d)});
  const body=Object.keys(byL).sort().map(L=>`<div class="sb-letter" style="font-size:13px;padding:14px 2px 6px">${L}</div>`+byL[L].slice().sort((a,b)=>a.t.localeCompare(b.t)).map(d=>`<a class="s-item" href="#/s/${d.a}/${d.s}"><span class="stx">${esc(d.t)}</span><span class="smeta">${esc(SRC[d.a].abbr)} ${esc(d.num)}</span></a>`).join('')).join('');
  $('#main').innerHTML=`<h1 class="h-title fade">Definitions</h1><p style="color:var(--ink-3);font-size:13.5px;margin:-6px 0 8px">${DEFS.length.toLocaleString()} defined terms across all Acts, verbatim.</p><div class="fade">${body}</div>`;
}
async function loadStudy(){if(!STUDY)STUDY=await jget('study.json');return STUDY}
function renderDrugMatrix(){
  $('#main').innerHTML=`<div class="boot"><span class="spin"></span>Loading…</div>`;
  loadStudy().then(()=>{const dr=STUDY.drugs,cols=dr.cols||[],rows=dr.rows||[];
    const head=`<tr><th style="text-align:left">Drug</th>`+cols.map(c=>`<th>${esc(c.label)}</th>`).join('')+`</tr>`;
    const trs=rows.map(r=>`<tr><td style="font-weight:620">${esc(r.name)}</td>`+cols.map(c=>{const cell=r.cells&&r.cells[c.k];return `<td style="text-align:center;font-family:var(--mono)">${cell?esc(cell.amt):'—'}</td>`}).join('')+`</tr>`).join('');
    $('#main').innerHTML=`<a class="r-back fade" href="#/study">${ic('back','currentColor')} Study</a>
      <div class="r-band fade" style="--h:#fec846;--hi:#946a00"><div class="act">Misuse of Drugs Act</div><div class="stt" style="margin-top:8px">Drug quantity matrix</div></div>
      <p style="color:var(--ink-3);font-size:13.5px;margin:-6px 0 12px">Threshold amounts by schedule — assembled verbatim from the Act &amp; Schedules.</p>
      <div class="matwrap fade"><table>${head}${trs}</table></div>`;
  });
}

/* ---------- SIDEBAR (browse panel) ---------- */
function renderSidebar(){
  $$('.sb-switch button').forEach(b=>b.classList.toggle('on',b.dataset.mode===sbMode));
  $$('.dock .di[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===sbMode));
  const tEl=$('#sbTitle'); if(tEl)tEl.textContent={acts:'Law Library',offences:'Offence Library',topics:'Topics',terms:'Defined Terms'}[sbMode]||'Browse';
  const body=$('#sbBody'); if(!body)return;
  if(sbMode==='acts') sbActs(body);
  else if(sbMode==='offences') sbOffences(body);
  else if(sbMode==='topics') sbTopics(body);
  else sbTerms(body);
}
const chev=`<span class="cv">${ic('chev','currentColor')}</span>`;
function secRow(a,s){return `<a class="sb-sec${s.id===curSec?' cur':''}" data-sid="${s.id}" href="#/s/${a.id}/${s.id}"><span class="n">${esc(s.num)}</span><span class="t">${esc(s.t)}</span></a>`}
/* ---- ACTS: nested accordion (Act → Part/Chapter → Section) ---- */
function actTreeHtml(a,d){
  const chById=Object.fromEntries((d.chapters||[]).map(c=>[c.id,c]));
  const secsByCh={}; d.sections.forEach(s=>{(secsByCh[s.ch]=secsByCh[s.ch]||[]).push(s)});
  const nodes=(d.tree&&d.tree.length)?d.tree:[{label:'',title:a.short,items:d.sections.map(s=>({k:'sec',id:s.id}))}];
  return nodes.map((node,i)=>{
    const key=a.id+'#'+i, open=accParts.has(key);
    const ttl=esc(node.title||node.label||('Part '+(i+1)));
    const lbl=`${node.label&&node.title?`<b>${esc(node.label)}</b> `:''}${ttl}`;
    const head=`<button class="sb-part${open?' open':''}" data-part="${key}" aria-expanded="${open}">${chev}<span class="pl">${lbl}</span></button>`;
    let secs='';
    if(open){
      const rows=[];
      for(const it of (node.items||[])){
        if(it.k==='lbl') rows.push(`<div class="sb-lbl">${esc(it.t)}</div>`);
        else if(it.k==='sec'){const s=d._byId[it.id]; if(s)rows.push(secRow(a,s));}
        else if(it.k==='ch'){const c=chById[it.id]; rows.push(`<div class="sb-chh">${esc(c?(c.title||c.label):'')}</div>`); (secsByCh[it.id]||[]).forEach(s=>rows.push(secRow(a,s)));}
      }
      secs=`<div class="sb-secs">${rows.join('')||'<div class="sb-lbl">—</div>'}</div>`;
    }
    return head+secs;
  }).join('');
}
function srcRow(a){
  const open=accAct===a.id, d=actCache[a.id];
  const head=`<button class="sb-acc${open?' open':''}${a.id===curAct?' cur':''}" data-act="${a.id}" aria-expanded="${open}"><span class="dot" style="background:${a.hue}"></span><span class="nm">${esc(a.short)}</span>${open?'':`<span class="ab">${esc(a.abbr)}</span>`}${chev}</button>`;
  let inner='';
  if(open) inner=`<div class="sb-acc-body">`+(d?actTreeHtml(a,d):`<div class="sb-loading"><span class="spin"></span></div>`)+`</div>`;
  return head+inner;
}
function sbActs(body){
  const grp=(label,cat)=>{const xs=REG.sources.filter(s=>s.cat===cat);if(!xs.length)return'';return `<div class="sb-grp">${label} <span>${xs.length}</span></div>`+xs.map(srcRow).join('')};
  body.innerHTML=grp('Acts &amp; Codes','act')+grp('Doctrine','doc')+grp('Reference','ref');
}
/* ---- OFFENCES library ---- */
function offRow(o){return `<a class="sb-sec offrow${o.id===curSec?' cur':''}" href="#/s/${o.a}/${o.id}"><span class="t">${esc(o.t)}</span><span class="src">${esc(SRC[o.a].abbr)}${o.num?(' '+esc(o.num)):''}</span></a>`}
function sbOffences(body){
  const sub=`<div class="sb-sub2">${['type','Type','act','Act','az','A–Z'].reduce((h,_,i,A)=>i%2?h:h+`<button data-offv="${A[i]}" class="${offView===A[i]?'on':''}">${A[i+1]}</button>`,'')}</div>`;
  let inner='';
  if(offView==='type'){
    inner=OFF.types.map(ty=>{
      const k='t:'+ty.id, open=accOff.has(k), list=OFF.offences.filter(o=>o.type===ty.id);
      const head=`<button class="sb-acc${open?' open':''}" data-off="${k}" aria-expanded="${open}"><span class="oi">${ic(ty.icon,'currentColor')}</span><span class="nm">${esc(ty.label)}</span><span class="ab">${ty.n}</span>${chev}</button>`;
      return head+(open?`<div class="sb-acc-body"><div class="sb-secs">`+list.map(offRow).join('')+`</div></div>`:'');
    }).join('');
  } else if(offView==='act'){
    inner=acts().filter(a=>OFF.offences.some(o=>o.a===a.id)).map(a=>{
      const k='a:'+a.id, open=accOff.has(k), list=OFF.offences.filter(o=>o.a===a.id);
      const head=`<button class="sb-acc${open?' open':''}" data-off="${k}" aria-expanded="${open}"><span class="dot" style="background:${a.hue}"></span><span class="nm">${esc(a.short)}</span><span class="ab">${list.length}</span>${chev}</button>`;
      return head+(open?`<div class="sb-acc-body"><div class="sb-secs">`+list.map(offRow).join('')+`</div></div>`:'');
    }).join('');
  } else {
    const byL={}; OFF.offences.forEach(o=>{const L=(o.t[0]||'#').toUpperCase();(byL[L]=byL[L]||[]).push(o)});
    const letters=Object.keys(byL).sort();
    const az=`<div class="sb-az">`+letters.map(L=>`<button class="azl" data-l="${L}">${L}</button>`).join('')+`</div>`;
    inner=az+letters.map(L=>`<div class="sb-letter" id="sbL-${L}">${L}</div>`+byL[L].map(offRow).join('')).join('');
  }
  body.innerHTML=sub+inner;
}
/* ---- TOPICS (domain accordion) ---- */
function sbTopics(body){
  body.innerHTML=TOPICS.doms.map((dn,i)=>{const ts=TOPICS.topics.filter(t=>t.dom===i);if(!ts.length)return'';
    const open=accDoms.has(i);
    const head=`<button class="sb-acc${open?' open':''}" data-dom="${i}" aria-expanded="${open}"><span class="nm">${esc(dn)}</span><span class="ab">${ts.length}</span>${chev}</button>`;
    return head+(open?`<div class="sb-acc-body"><div class="sb-secs">`+ts.map((t,j)=>`<a class="sb-topic2" href="#/topic/${t.id}"><span class="dot" style="background:${PAL10[(i*3+j)%10]}"></span><span class="nm">${esc(t.name)}</span></a>`).join('')+`</div></div>`:'');
  }).join('');
}
/* ---- TERMS (A–Z glossary) ---- */
function sbTerms(body){
  const byL={};DEFS.forEach(d=>{const L=(d.t[0]||'#').toUpperCase();(byL[L]=byL[L]||[]).push(d)});
  const letters=Object.keys(byL).sort();
  const az=`<div class="sb-az">`+letters.map(L=>`<button class="azl" data-l="${L}">${L}</button>`).join('')+`</div>`;
  body.innerHTML=az+letters.map(L=>`<div class="sb-letter" id="sbL-${L}">${L}</div>`+byL[L].slice().sort((a,b)=>a.t.localeCompare(b.t)).map(d=>`<a class="sb-term" href="#/s/${d.a}/${d.s}"><span class="tdot" style="background:${hue(d.a)}"></span><span class="ttx">${esc(d.t)}</span><span class="src">${esc(SRC[d.a].abbr)} ${esc(d.num)}</span></a>`).join('')).join('');
}
function sbSwitch(m){ _keepDrawer=true; navigate(m==='acts'?'/browse':m==='offences'?'/offences':m==='topics'?'/topics':'/defs'); }
/* accordion toggles via delegation on #sbBody */
function sbBodyClick(e){
  const az=e.target.closest('.azl'); if(az){e.preventDefault();const el=document.getElementById('sbL-'+az.dataset.l);if(el)el.scrollIntoView({block:'start'});return;}
  const ov=e.target.closest('[data-offv]'); if(ov){e.preventDefault();offView=ov.dataset.offv;ls.set('offView',offView);renderSidebar();return;}
  const ac=e.target.closest('.sb-acc[data-act]'); if(ac){e.preventDefault();const id=ac.dataset.act;
    if(accAct===id){accAct=null;renderSidebar();} else {accAct=id;accParts.clear();renderSidebar();
      const h=document.querySelector('.sb-acc[data-act="'+id+'"]'); if(h)h.scrollIntoView({block:'nearest'});
      (actCache[id]?Promise.resolve(actCache[id]):loadAct(id)).then(()=>{renderSidebar();autoOpenPart(id);}).catch(()=>{});
      _keepDrawer=true; navigate('/a/'+id);} return;}
  const pt=e.target.closest('.sb-part'); if(pt){e.preventDefault();const k=pt.dataset.part;accParts.has(k)?accParts.delete(k):accParts.add(k);renderSidebar();
    const node=document.querySelector(`.sb-part[data-part="${k}"]`); if(node)node.scrollIntoView({block:'nearest'});return;}
  const og=e.target.closest('.sb-acc[data-off]'); if(og){e.preventDefault();const k=og.dataset.off;accOff.has(k)?accOff.delete(k):accOff.add(k);renderSidebar();return;}
  const dm=e.target.closest('.sb-acc[data-dom]'); if(dm){e.preventDefault();const i=+dm.dataset.dom;accDoms.has(i)?accDoms.delete(i):accDoms.add(i);renderSidebar();return;}
}
/* when an act opens (or a section is read), open the part containing the current/first section */
function autoOpenPart(aid){
  const d=actCache[aid]; if(!d)return; const target=curAct===aid&&curSec?curSec:null;
  const nodes=(d.tree&&d.tree.length)?d.tree:[{items:d.sections.map(s=>({k:'sec',id:s.id}))}];
  let idx=0;
  if(target){ for(let i=0;i<nodes.length;i++){const ids=partSectionIds(d,nodes[i]); if(ids.includes(target)){idx=i;break;}} }
  accParts.add(aid+'#'+idx); renderSidebar();
  const cur=document.querySelector('#sbBody .sb-sec.cur'); if(cur)cur.scrollIntoView({block:'center'});
}
function partSectionIds(d,node){const out=[];const secsByCh={};d.sections.forEach(s=>{(secsByCh[s.ch]=secsByCh[s.ch]||[]).push(s.id)});
  for(const it of (node.items||[])){ if(it.k==='sec')out.push(it.id); else if(it.k==='ch')(secsByCh[it.id]||[]).forEach(x=>out.push(x)); } return out;}

/* ---------- drawer / theme / size ---------- */
function menuTap(){ innerWidth<861?openDrawer():document.body.classList.toggle('sb-collapsed'); }
let _lastFocus=null, _drawerOpen=false;
function trapTab(e){ if(e.key!=='Tab'||!_drawerOpen)return; const s=$('#sidebar'); if(!s)return;
  const f=$$('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])',s).filter(el=>el.offsetParent!==null);
  if(!f.length)return; const first=f[0], last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();} }
function openDrawer(){const s=$('#sidebar');if(!s)return; _lastFocus=document.activeElement;
  s.classList.add('open'); s.setAttribute('role','dialog'); s.setAttribute('aria-modal','true'); s.setAttribute('aria-label','Browse the law library');
  $('#sbScrim').classList.add('on'); document.body.classList.add('drawer-open'); _drawerOpen=true;
  document.addEventListener('keydown',trapTab); const mb=$('#menuBtn'); if(mb)mb.setAttribute('aria-expanded','true');
  const f=s.querySelector('.sb-srch,button,a[href]'); if(f)setTimeout(()=>f.focus(),20); }
function closeDrawer(){const s=$('#sidebar'); if(s){s.classList.remove('open'); s.removeAttribute('role'); s.removeAttribute('aria-modal');}
  const sc=$('#sbScrim'); if(sc)sc.classList.remove('on'); document.body.classList.remove('drawer-open');
  document.removeEventListener('keydown',trapTab); const mb=$('#menuBtn'); if(mb)mb.setAttribute('aria-expanded','false');
  if(_drawerOpen&&_lastFocus&&_lastFocus.focus){try{_lastFocus.focus()}catch(e){}} _drawerOpen=false; }
function paintThemeBtn(){const dark=document.documentElement.dataset.theme==='dark';const b=$('#themeBtn');if(b){b.innerHTML=ic(dark?'sun':'moon','currentColor');const lab=dark?'Switch to light theme':'Switch to dark theme';b.setAttribute('aria-label',lab);b.title=lab;b.setAttribute('aria-pressed',String(dark));}
  let tc=document.querySelector('meta[name="theme-color"][data-dyn]'); if(!tc){tc=document.createElement('meta');tc.name='theme-color';tc.setAttribute('data-dyn','');document.head.appendChild(tc);} tc.content=dark?'#0c0d12':'#eef2f8';}
function toggleTheme(){const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';ls.set('theme',r.dataset.theme);paintThemeBtn()}
function applySize(){const z=ls.get('size',1);document.documentElement.style.setProperty('--rsz',z);$$('.page')&&($('#main').style.fontSize=z+'em')}
function cycleSize(){let z=ls.get('size',1);z=z>=1.18?.9:Math.round((z+.08)*100)/100;ls.set('size',z);$('#main').style.fontSize=z+'em';toast('Text size '+Math.round(z*100)+'%')}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),1700)}

/* ---------- PWA ---------- */
let deferredPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=$('#installBtn');if(b){b.hidden=false;b.onclick=async()=>{b.hidden=true;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}}});
if('serviceWorker'in navigator){addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}

boot();
})();
