'use strict';
/* WA Legislation — app engine (v2).
   Offline-first reader over a corpus built from the OFFICIAL Word files (legislation.wa.gov.au / legislation.gov.au)
   and proved against the official PDFs at build time. Statute HTML (h) is injected unchanged; everything the app adds
   on top — defined-term marks, cross-reference links, search highlights — is a non-destructive wrapper.
   Vanilla JS, hash routing, no framework, no build step for the shell. */
(function(){
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>(s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const dec=s=>{try{return decodeURIComponent(s)}catch(e){return s}};
const NS='wal-';
const ls={get(k,d){try{const v=localStorage.getItem(NS+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
          set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v))}catch(e){}}};
const DATA='./data/';

let REG, SRC={}, PAL10=[], SEARCH=[], DEFS=[], DEFS_BY={}, TOPICS={doms:[],topics:[]}, STUDY=null, FTEXT=null, FTL=null, SCAF={}, SCAF_BY={}, OFF={types:[],offences:[]};
const actCache=new Map();        // id -> parsed Act (small LRU: Acts are big, phones are not)
const ACT_KEEP=6;
let curAct=null, curSec=null, sbMode=ls.get('sbMode','acts'), loadingFT=false, curPrev=null, curNext=null, curSeg='home';
/* accordion / browse state (in-memory; the reader auto-expands its Act) */
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
 flame:'<path d="M12 22c4.2 0 7-2.9 7-6.8 0-3-1.700-5.300-3.400-7.200-.5 1.700-1.400 2.700-2.500 3.300C13.400 8 12.300 4.700 9.500 2c.2 3.100-1.200 5.200-2.600 7.100C5.700 10.800 5 12.700 5 15.200 5 19.100 7.800 22 12 22Z"/><path d="M12 22c-1.800 0-3-1.300-3-3 0-1.800 1.400-2.700 2.300-4.300.900 1.400 3.700 2.300 3.700 4.300 0 1.700-1.200 3-3 3Z"/>',
 box:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
 mask:'<path d="M4 5h16v7a8 8 0 0 1-16 0Z"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M9 15c1 1 5 1 6 0"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m17 5 2 2"/><path d="m14 8 2 2"/>',
 link:'<path d="M9 12h6"/><path d="M10 8H7a4 4 0 0 0 0 8h3"/><path d="M14 8h3a4 4 0 0 1 0 8h-3"/>',
 scale:'<path d="M12 4v16"/><path d="M7 8h10"/><path d="m7 8-3 6a3 3 0 0 0 6 0Z"/><path d="m17 8-3 6a3 3 0 0 0 6 0Z"/><path d="M6 20h12"/>',
 car:'<path d="M5 13 6.6 8h10.8L19 13"/><path d="M4 17v-3.5L5 13h14l1 .5V17h-2"/><path d="M8 17H4"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
 file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M19.5 20a5.500 5.500 0 0 0-3-5"/>',
 book:'<path d="M5 4h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.500 0 0 1 5 19.500Z"/><path d="M5 17.500h14"/>',
 play:'<path d="M8 5v14l11-7Z"/>',chev:'<path d="m9 6 6 6-6 6"/>',back:'<path d="m15 6-6 6 6 6"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',
 ext:'<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
 check:'<path d="m5 12.500 4.500 4.500L19 7.500"/>',
 heart:'<path d="M12 21s-7-4.4-9.5-8.5C.9 9.6 2.3 5.8 5.5 5.2 8 4.7 10.3 6.2 12 8.6c1.7-2.4 4-3.9 6.5-3.4 3.2.6 4.6 4.4 3 7.3C19 16.6 12 21 12 21Z"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
 list:'<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',gavel:'<path d="m14 11-7 7-3-3 7-7"/><path d="m18 7-4-4"/><path d="m14 3-4 4 4 4 4-4Z"/><path d="m5 21 4-4"/><path d="M19 21h-8"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'};
function ic(n,stroke='#fff'){return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SVG[n]||SVG.box}</svg>`}
const ICON_RULES=[['homicid|murder|manslaughter|kill','activity'],['assault|gbh|grievous|bodily harm|wound|strangulat','shield'],['sexual|indecent|rape|pornograph','mask'],['drug|cannabis|methyl|traffick','droplet'],['bush ?fire|fire ban','flame'],['steal|theft|property|receiv','box'],['burglar|invasion|trespass','home'],['robber','alert'],['fraud|forgery|dishonest|deception|bribery|corrupt','file'],['search|warrant|seiz|powers','search'],['arrest|custody|detain','link'],['bail','scale'],['sentenc|penalt|confiscat','scale'],['evidence|disclosure|court','book'],['traffic|driv|vehicle|road','car'],['weapon|firearm','shield'],['child|young|famil|juvenile|infant','users'],['threat|blackmail|stalk|intimidat|harass','alert'],['kidnap|libert|deprivation|abduct|detention','link'],['restrain|violence','shield'],['public order|riot|affray|disorder|justice','alert'],['surveillance|covert|intercept','key'],['damage|arson','alert']].map(([re,k])=>[new RegExp(re),k]);
function iconFor(name){const n=(name||'').toLowerCase();for(const[re,k] of ICON_RULES){if(re.test(n))return k}return 'box'}
const topicIcon=t=>iconFor(t.name);

/* ---------- data ---------- */
async function jget(f){const r=await fetch(DATA+f);if(!r.ok)throw new Error('Could not load '+f);return r.json()}
async function loadAct(id){
  if(actCache.has(id)){const d=actCache.get(id);actCache.delete(id);actCache.set(id,d);return d}
  const d=await jget(id+'.json'); d._byId={}; d._lc={}; d.sections.forEach((s,i)=>{d._byId[s.id]=s;d._lc[s.id.toLowerCase()]=s;s._i=i});
  d._grp={}; (d.tree||[]).forEach(g=>d._grp[g.id]=g); d._ch={}; (d.chapters||[]).forEach(c=>d._ch[c.id]=c);
  actCache.set(id,d);
  for(const k of actCache.keys()){ if(actCache.size<=ACT_KEEP)break; if(k!==curAct&&k!==id)actCache.delete(k); }
  return d}
const hue=a=>(SRC[a]||{}).hue||'#94a3b8';
const ink=a=>(SRC[a]||{}).ink||'#475569';
const tsh=a=>`color-mix(in srgb, ${hue(a)} 55%, transparent)`;
const tileBg=hex=>`linear-gradient(157deg, color-mix(in srgb,${hex} 92%,#fff), color-mix(in srgb,${hex} 86%,#000))`;
/* how a provision is cited: s 279 · r 5 · cl 3 · Sch. 2 · (front matter has no number) */
function ud(s){const u=s.u||s.unit||'s', n=s.num!=null?s.num:s.n;
  if(u==='s')return 's '+n; if(u==='r')return 'r '+n; if(u==='cl')return 'cl '+n;
  if(u==='fm')return n==='—'?'Title':String(n); return String(n)}
const badge=s=>{const n=String(s.num!=null?s.num:'');return n.replace(/^Sch\.\s*/,'Sch ')};
const acts=()=>REG.sources.filter(s=>s.cat==='act');
const catName=c=>c==='act'?'Act':c==='doc'?'Doctrine':'Reference';
const UNIT={};                   // "act|id" -> unit, from the search index
const citeOf=(a,id,num)=>ud({unit:UNIT[a+'|'+id]||'s',num});
const secHref=(a,id,q)=>`#/s/${a}/${encodeURIComponent(id)}${q?`?q=${encodeURIComponent(q)}`:''}`;

/* ---------- boot ---------- */
async function boot(){
  document.documentElement.dataset.theme = ls.get('theme', matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  try{
    REG=await jget('registry.json');
    REG.sources.forEach(s=>SRC[s.id]=s);
    PAL10=['blue','teal','orange','purple','indigo','pink','gold','cyan','emerald','brown'].map(f=>REG.palette[f]);
    const [sj,dj,tj,scf,off]=await Promise.all([jget('search.json'),jget('defs.json'),jget('topics.json'),jget('scaffolds.json').catch(()=>({})),jget('offences.json').catch(()=>({types:[],offences:[]}))]);
    SEARCH=sj; SEARCH.forEach(e=>{UNIT[e.a+'|'+e.id]=e.u}); TOPICS=tj; SCAF=scf||{}; OFF=off&&off.offences?off:{types:[],offences:[]};
    DEFS=dj.acts.flatMap(a=>a.terms.map(t=>Object.assign({a:a.a},t)));
    DEFS.forEach(d=>{(DEFS_BY[d.a]=DEFS_BY[d.a]||[]).push(d)});
    Object.keys(SCAF).forEach(k=>{const base=k.split('#')[0];(SCAF_BY[base]=SCAF_BY[base]||[]).push(k)});
    Object.values(SCAF_BY).forEach(a=>a.sort((x,y)=>(+(x.split('#')[1]||1))-(+(y.split('#')[1]||1))));
    paintChrome();
    addEventListener('hashchange',route);
    if(!location.hash) history.replaceState(history.state,'','#/home');
    route();
  }catch(e){ $('#main').innerHTML=`<div class="boot">Couldn’t load the statute library.<br><small>${esc(e.message)}</small><br><button class="ecta" style="margin-top:16px" onclick="location.reload()">Try again</button></div>`; console.error(e); }
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
    else if(e.key==='Escape'){hideTerm();closeDrawer();if(typing&&e.target.id==='ain'&&e.target.value){e.target.value='';e.target.dispatchEvent(new Event('input'))}}
    else if(typing||e.metaKey||e.ctrlKey||e.altKey){return}
    else if(e.key==='/'){e.preventDefault(); const ain=$('#ain'); if(ain){ain.focus();ain.select()} else if(curAct&&(curSeg==='s'||curSeg==='a'))navigate('/a/'+curAct+'?q='); else navigate('/search')}
    else if(e.key==='['&&curPrev){e.preventDefault();navigate(curPrev)}
    else if(e.key===']'&&curNext){e.preventDefault();navigate(curNext)}
    else if(e.key.toLowerCase()==='t'){toggleTheme()}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('dfn')&&!e.target.closest('#pop'))hideTerm();});
  $('#sbBody').addEventListener('click',sbBodyClick);
  if(!accDoms.size) TOPICS.doms.forEach((_,i)=>accDoms.add(i)); // topics expanded by default
}
function navigate(h){ if(location.hash==='#'+h){ if(history.state)delete _scrollPos[history.state.i]; _entry=null; route(); } else location.hash='#'+h; }

/* which sidebar browse-mode each route segment implies */
const SEG_MODE={browse:'acts',a:'acts',s:'acts',topics:'topics',topic:'topics',offences:'offences',defs:'terms'};
const PAGE_TITLE={browse:'Acts & codes',offences:'Offences',topics:'Topics',defs:'Defined terms',search:'Search',study:'Study',saved:'Saved',recents:'Recents',drugs:'Drug quantity matrix',about:'Sources & currency'};

/* scroll memory per history entry: Back returns you to where you were, a new page starts at the top */
let _navI=0, _entry=null, _pendingY=0, _tok=0; const _scrollPos={};
function settle(y){ const to=(y!=null)?y:(_pendingY||0); _pendingY=0; requestAnimationFrame(()=>window.scrollTo(0,to)); }

function route(){
  if(_entry!=null) _scrollPos[_entry]=window.scrollY;
  let st=history.state, back=false;
  if(st&&typeof st.i==='number'){ back=(st.i in _scrollPos); _navI=Math.max(_navI,st.i); }
  else { st={i:++_navI}; try{history.replaceState(st,'')}catch(e){} }
  _entry=st.i; _pendingY=back?_scrollPos[st.i]:0; const tok=++_tok;

  const raw=(location.hash||'#/home').slice(1), qi=raw.indexOf('?');
  const path=qi<0?raw:raw.slice(0,qi), Q=new URLSearchParams(qi<0?'':raw.slice(qi+1));
  const p=path.split('/').filter(Boolean).map(dec);
  hideTerm(); hideHitNav();
  if(_keepDrawer){_keepDrawer=false;}else{closeDrawer();}
  const seg=p[0]||'home'; curSeg=seg;
  if(SEG_MODE[seg]) { sbMode=SEG_MODE[seg]; ls.set('sbMode',sbMode); }
  if(SEG_MODE[seg]&&innerWidth>=861) document.body.classList.remove('sb-collapsed'); // picking a mode always reveals the panel
  $$('.di').forEach(d=>{
    const on=d.dataset.mode ? (!!SEG_MODE[seg] && d.dataset.mode===sbMode) : d.dataset.route==='/'+seg;
    d.classList.toggle('on', on);
    if(on)d.setAttribute('aria-current','page'); else d.removeAttribute('aria-current');
  });
  document.title = PAGE_TITLE[seg] ? PAGE_TITLE[seg]+' · WA Legislation' : 'WA Legislation';
  if(seg!=='s'&&seg!=='a'){curSec=null;curPrev=curNext=null;}
  if(seg==='s')      return openSec(p[1],p[2],Q.get('q')||'',tok);
  if(seg==='a')      return renderActPage(p[1],p[2],Q,tok);
  renderSidebar();
  if(seg==='topic')  return renderTopicPage(p[1]);
  if(seg==='topics') return renderBrowse('topics');
  if(seg==='browse') return renderBrowse('acts');
  if(seg==='offences')return renderOffences(p[1],p[2]);
  if(seg==='search') return renderSearch(p.slice(1).join('/'));
  if(seg==='study')  return p[1]==='drill'?renderDrill():p[1]==='quiz'?renderQuiz():p[1]==='scen'?renderScenarios():renderStudy();
  if(seg==='saved')  return renderSaved();
  if(seg==='defs')   return renderDefs();
  if(seg==='drugs')  return renderDrugMatrix();
  if(seg==='recents')return renderRecents();
  if(seg==='about')  return renderAbout();
  renderHome();
}
function page(html){ $('#main').innerHTML=html; settle(); }

/* ---------- HOME ---------- */
function renderHome(){
  const legend=PAL10.map(h=>`<i style="background:${h}"></i>`).join('');
  const tops=TOPICS.topics.slice(0,10).map((t,i)=>{const hx=PAL10[i%10];
    return `<a class="tile" href="#/topic/${t.id}" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(topicIcon(t))}</span><span class="lb">${esc(t.name)}</span></a>`}).join('');
  const ac=acts().slice(0,10).map(actTile).join('');
  const last=ls.get('last',null);
  const cont=last&&SRC[last.a]?`<a class="cont" href="${secHref(last.a,last.id)}" style="background:${tileBg(hue(last.a))};--tsh:color-mix(in srgb,${hue(last.a)} 55%,transparent)"><span class="big${String(last.num).length>4?' long':''}">${esc(last.num)}</span><div class="meta"><div class="tag">${esc(SRC[last.a].short)} · ${esc(last.disp)}</div><div class="tt">${esc(last.t)}</div><div class="ex">${esc(last.p||'')}</div></div><span class="play">${ic('play')}</span></a>`
    :`<a class="cont" href="#/s/cc/cc-279" style="background:${tileBg(hue('cc'))};--tsh:color-mix(in srgb,${hue('cc')} 55%,transparent)"><span class="big">279</span><div class="meta"><div class="tag">Criminal Code · s 279</div><div class="tt">Murder</div><div class="ex">Start with the homicide spine, or jump anywhere with search.</div></div><span class="play">${ic('play')}</span></a>`;
  page(`
    <div class="legend fade">${legend}</div>
    <h1 class="h-title fade">Verbatim WA law,<br>in your pocket.</h1>
    <a class="sfield fade" href="#/search"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg> Search ${REG.counts.provisions.toLocaleString()} provisions… <span class="kbd">⌘K</span></a>
    <div class="row-h"><h2>Jump back in</h2></div>
    <div class="tilegrid fade">${cont}</div>
    <div class="row-h"><h2>Topics</h2><a class="more" href="#/topics">All ${TOPICS.topics.length}</a></div>
    <div class="tilegrid fade">${tops}</div>
    <div class="row-h"><h2>Acts &amp; Codes</h2><a class="more" href="#/browse">All ${REG.counts.acts}</a></div>
    <div class="tilegrid fade">${ac}</div>
    <div class="row-h"><h2>Study</h2></div>
    <div class="tilegrid fade">${studyTiles(false)}</div>
    <a class="curr fade" href="#/about">${ic('check','currentColor')}<span>Every Act checked against the official current version · built ${esc(REG.builtDisp||'')}</span></a>`);
}
function actTile(a){return `<a class="tile" href="#/a/${a.id}" style="background:${tileBg(a.hue)};--tsh:color-mix(in srgb,${a.hue} 55%,transparent)"><span class="chip"><span class="mono">${esc(a.abbr)}</span></span><span class="lb">${esc(a.short)}</span></a>`}

/* ---------- BROWSE ---------- */
function renderBrowse(mode){
  const seg=`<div class="seg"><a class="${mode==='topics'?'on':''}" href="#/topics">Topics</a><a class="${mode==='acts'?'on':''}" href="#/browse">Acts</a></div>`;
  let body='';
  if(mode==='topics'){
    body=TOPICS.doms.map((d,i)=>{const ts=TOPICS.topics.filter(t=>t.dom===i);if(!ts.length)return'';
      return `<div class="row-h sub"><h2>${esc(d)}</h2></div><div class="tilegrid">`+
        ts.map((t,j)=>{const hx=PAL10[(i*3+j)%10];return `<a class="tile" href="#/topic/${t.id}" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(topicIcon(t))}</span><span class="lb">${esc(t.name)}</span></a>`}).join('')+`</div>`}).join('');
  } else {
    const grp=(label,cat)=>{const xs=REG.sources.filter(s=>s.cat===cat);if(!xs.length)return'';
      return `<div class="row-h sub"><h2>${label}</h2><span class="more muted">${xs.length}</span></div><div class="tilegrid">`+xs.map(actTile).join('')+`</div>`};
    body=grp('Acts &amp; Codes','act')+grp('Doctrine &amp; manuals','doc')+grp('Reference library','ref');
  }
  page(`<h1 class="h-title fade" style="margin-bottom:4px">Browse</h1>${seg}<div class="fade">${body}</div>`);
}

/* ---------- OFFENCE LIBRARY (main page) ---------- */
const offNum=o=>o.num?ud({u:o.u||'s',num:o.num}):'·';
function offMain(o){return `<a class="s-item" href="${secHref(o.a,o.id)}"><span class="sn" style="background:${ink(o.a)}">${esc(offNum(o))}</span><span class="stx">${esc(o.t)}</span><span class="smeta">${esc(SRC[o.a].abbr)}</span></a>`}
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
      return `<a class="arow" href="#/offences/a/${a.id}"><span class="badge" style="background:${tileBg(a.hue)};--tsh:${tsh(a.id)}"><span class="mono">${esc(a.abbr)}</span></span><div><div class="nm">${esc(a.short)}</div><div class="me">${n} offence${n>1?'s':''}</div></div><span class="ch">${ic('chev','currentColor')}</span></a>`}).join('');
  } else if(view==='az'){
    const byL={};OFF.offences.forEach(o=>{const L=(o.t[0]||'#').toUpperCase();(byL[L]=byL[L]||[]).push(o)});
    body=Object.keys(byL).sort().map(L=>`<div class="cite-h" style="margin:18px 0 10px">${L}</div><div class="s-res" style="margin-top:0">`+byL[L].map(offMain).join('')+`</div>`).join('');
  } else {
    body=`<div class="tilegrid fade">`+OFF.types.map((ty,i)=>{const hx=PAL10[i%10];
      return `<a class="tile" href="#/offences/t/${ty.id}" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(ty.icon)}</span><span class="lb">${esc(ty.label)}<small>${ty.n} offence${ty.n>1?'s':''}</small></span></a>`}).join('')+`</div>`;
  }
  page(`<h1 class="h-title fade" style="margin-bottom:4px">Offences</h1><p class="sub-note fade">${OFF.offences.length} offence provisions across the Acts — grouped by type, by Act, or A–Z. Tap any to read it verbatim with its memorise card.</p>${seg}<div class="fade">${body}</div>`);
}

/* =====================================================================
   SEARCH CORE — shared by the global search and the search inside one Act
   ===================================================================== */
const STOP=new Set(['the','of','a','an','and','or','to','in','for','on','by','at','is','be']);
function parseQ(raw){
  const q=(raw||'').trim().toLowerCase().replace(/[“”]/g,'"'); const phrases=[];
  const rest=q.replace(/"([^"]+)"/g,(m,p)=>{p=p.trim();if(p)phrases.push(p);return ' '});
  let words=rest.split(/\s+/).filter(Boolean);
  const strong=words.filter(w=>!STOP.has(w)); if(strong.length||phrases.length) words=strong;
  const terms=[...phrases,...words], whole=q.replace(/"/g,'').replace(/\s+/g,' ').trim();
  return {q, terms, whole, hl:[...new Set([whole,...terms].filter(Boolean))]};
}
/* "279" · "s 279" · "cc 279" · "cia s 27a" · "road traffic 59(1)" -> {hint, num} */
function parseCite(q){
  const m=/^(?:(.*?)[\s,]+)??(?:ss?|sec|sect|section|r|reg|regulation|cl|clause)?\.?\s*(\d+[a-z]{0,4})(?:\s*\(\w+\))*$/i.exec(q.trim());
  if(!m)return null; return {hint:(m[1]||'').trim().toLowerCase(), num:m[2].toLowerCase()};
}
function actsForHint(h){ if(!h)return null;
  const exact=REG.sources.filter(s=>s.abbr.toLowerCase()===h||(s.al||[]).includes(h)||s.short.toLowerCase()===h||s.name.toLowerCase()===h);
  if(exact.length)return exact.map(s=>s.id);
  if(h.length<3)return [];
  return REG.sources.filter(s=>(s.name+' '+s.short).toLowerCase().includes(h)).map(s=>s.id); }
const countOf=(hay,needle)=>{if(!needle)return 0;let n=0,i=0;while((i=hay.indexOf(needle,i))>=0){n++;i+=needle.length;if(n>98)break}return n};
function hlAll(text,terms){ text=text==null?'':String(text); const ts=(terms||[]).filter(Boolean); if(!ts.length)return esc(text);
  const re=new RegExp('('+ts.slice().sort((a,b)=>b.length-a.length).map(escRe).join('|')+')','ig'); let out='',last=0,m;
  while((m=re.exec(text))){ out+=esc(text.slice(last,m.index))+'<mark>'+esc(m[0])+'</mark>'; last=m.index+m[0].length; if(!m[0].length)re.lastIndex++; }
  return out+esc(text.slice(last)); }
function snippetOf(body,P){ if(!body)return ''; const low=body.toLowerCase(); let i=-1;
  for(const t of [P.whole,...P.terms]){ if(!t)continue; i=low.indexOf(t); if(i>=0)break; }
  if(i<0)return ''; let s=Math.max(0,i-38); if(s>0){const sp=body.indexOf(' ',s); if(sp>0&&sp<i)s=sp+1}
  const en=Math.min(body.length,s+190);
  return (s>0?'… ':'')+hlAll(body.slice(s,en).replace(/\s+/g,' '),P.hl)+(en<body.length?' …':''); }

/* rank the provisions of ONE loaded Act against a query */
function searchAct(d,raw){
  const P=parseQ(raw); if(!P.terms.length)return {P,hits:[]};
  let cite=parseCite(P.q); if(cite&&cite.hint&&!(actsForHint(cite.hint)||[]).includes(d.meta.id))cite=null;
  const terms=cite?[cite.num]:P.terms, hits=[];
  for(const s of d.sections){
    const tt=(s._lt||(s._lt=(s.num+' '+s.t).toLowerCase())), bb=(s._lb||(s._lb=(s.b||'').toLowerCase()));
    let score=0;
    if(cite&&s.unit!=='fm'&&s.unit!=='sch'){ const n=String(s.num).toLowerCase(); if(n===cite.num)score+=1000; else if(n.startsWith(cite.num))score+=400; }
    const inT=terms.every(t=>tt.includes(t)), inAll=inT||terms.every(t=>tt.includes(t)||bb.includes(t));
    if(!score&&!inAll)continue;
    if(P.whole&&tt.includes(P.whole))score+=300; else if(inT)score+=200;
    let n=0; if(inAll){ for(const t of terms)n+=countOf(bb,t); if(terms.length>1&&P.whole&&bb.includes(P.whole))score+=60; score+=Math.min(n,40); }
    hits.push({s,score,n,inT});
  }
  hits.sort((a,b)=>b.score-a.score||a.s._i-b.s._i);
  if(cite){P.terms=terms;P.hl=terms}
  return {P,hits};
}

/* ---------- ACT PAGE (hierarchical tree + search inside this Act) ---------- */
let actSearchT;
async function renderActPage(aid,gid,Q,tok){
  if(!SRC[aid]){renderSidebar();return renderHome();}
  const a=SRC[aid];
  if(!actCache.has(aid)) $('#main').innerHTML=`<div class="boot"><span class="spin"></span>Loading ${esc(a.short)}…</div>`;
  let d; try{d=await loadAct(aid)}catch(e){renderSidebar();$('#main').innerHTML=`<div class="boot">Couldn’t load ${esc(a.name)}.<br><small>You may be offline and this Act isn’t saved yet.</small></div>`;return}
  if(tok!==_tok)return;                                              // the user moved on while it loaded
  curAct=aid; curSec=null; accAct=aid; curPrev=curNext=null;
  if(![...accParts].some(k=>k.startsWith(aid+'#'))){ const i=(d.tree||[]).findIndex(g=>g.kind!=='front'); accParts.add(aid+'#'+(i<0?0:i)); }
  renderSidebar(); revealAct();
  document.title=a.short+' · WA Legislation';
  const hasQ=Q&&Q.has('q'), q0=hasQ?(Q.get('q')||''):'';
  const official=a.url?`<a class="srcl" href="${esc(a.url)}" target="_blank" rel="noopener">${a.juris==='Cth'?'legislation.gov.au':'legislation.wa.gov.au'} ${ic('ext','currentColor')}</a>`:'';
  const ver=[a.comp?('As at '+a.comp):'', a.pco?('version '+a.pco):''].filter(Boolean);
  const jump=(d.tree||[]).length>3?`<div class="jump" id="jump">`+d.tree.map(g=>`<a href="#/a/${aid}/${g.id}" data-g="${g.id}">${esc(g.label||g.title||'')}</a>`).join('')+`</div>`:'';
  $('#main').innerHTML=`
    <a class="r-back fade" href="#/browse">${ic('back','currentColor')} Browse</a>
    <div class="r-band fade" style="--h:${a.hue};--hi:${a.ink}"><div class="act"><span class="sq"></span>${catName(a.cat)}${a.juris==='Cth'?' · Commonwealth':''}</div><div class="stt">${esc(a.name)}</div>
      <div class="bandmeta">${[a.n?a.n.toLocaleString()+' provisions':''].concat(ver).filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${official?`<div class="bandmeta">${official}${a.checked?` <span>checked ${esc(dmy(a.checked))}</span>`:''}</div>`:''}</div>
    <div class="sfield fade asearch" style="--h:${a.hue};--hi:${a.ink}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="ain" type="search" aria-label="Search inside ${esc(a.short)}" placeholder="Search inside ${esc(a.short)}…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><button id="aclear" class="sclear" aria-label="Clear search" title="Clear" hidden>${ic('x','currentColor')}</button></div>
    <div id="actBody" class="fade" style="--h:${a.hue};--hi:${a.ink}"></div>`;
  const input=$('#ain'), clr=$('#aclear'), body=$('#actBody');
  const tree=()=>{ body.innerHTML=jump+actTreeMain(a,d); };
  const run=(v,push)=>{ clr.hidden=!v;
    if(!v.trim()){ tree(); } else { body.innerHTML=actResults(a,d,v); }
    if(push){ try{history.replaceState(history.state,'','#/a/'+aid+(v?('?q='+encodeURIComponent(v)):''))}catch(e){} } };
  input.value=q0; run(q0,false);
  input.addEventListener('input',()=>{clearTimeout(actSearchT);actSearchT=setTimeout(()=>run(input.value,true),90)});
  input.addEventListener('keydown',e=>{ if(e.key==='Enter'){const f=$('#actBody a.s-item'); if(f){e.preventDefault();pushSearch(input.value);location.hash=f.getAttribute('href').slice(1)}} });
  clr.onclick=()=>{input.value='';run('',true);input.focus()};
  body.addEventListener('click',e=>{ if(e.target.closest('a.s-item')&&input.value.trim().length>1)pushSearch(input.value);
    const j=e.target.closest('#jump a'); if(j){ e.preventDefault(); const el=document.getElementById('g-'+j.dataset.g); if(el)el.scrollIntoView({block:'start',behavior:'smooth'});
      try{history.replaceState(history.state,'','#/a/'+aid+'/'+j.dataset.g)}catch(x){} return; }
    const more=e.target.closest('#amore'); if(more){e.preventDefault();body.innerHTML=actResults(a,d,input.value,1e4)} });
  if(hasQ&&!_pendingY){ settle(0); if(!q0||matchMedia('(hover:hover)').matches)input.focus({preventScroll:true}); }
  else if(gid&&d._grp[gid]&&!_pendingY){ _pendingY=0; requestAnimationFrame(()=>{const el=document.getElementById('g-'+gid); if(el)el.scrollIntoView({block:'start'});}); }
  else settle();
}
function actTreeMain(a,d){
  const row=s=>`<a class="arow" href="${secHref(a.id,s.id)}"><span class="badge" style="background:${tileBg(a.hue)};--tsh:${tsh(a.id)}">${esc(badge(s))}</span><div><div class="nm">${esc(s.t)}</div><div class="me">${esc(ud(s))}</div></div><span class="ch">${ic('chev','currentColor')}</span></a>`;
  let body='';
  const nodes=(d.tree&&d.tree.length)?d.tree:[{id:'all',label:'',title:a.short,items:d.sections.map(s=>({k:'sec',id:s.id}))}];
  for(const node of nodes){
    body+=`<section class="tree-part" id="g-${esc(node.id)}"><h2 class="tp-h">${node.label&&node.label!==node.title?`<span class="tp-l">${esc(node.label)}</span>`:''}${esc(node.title||node.label||'')}</h2>${node.sub?`<div class="tp-sub">${esc(node.sub)}</div>`:''}`;
    for(const it of (node.items||[])){
      if(it.k==='lbl') body+=`<h3 class="tp-lbl lv${it.lv||1}">${esc(it.t)}</h3>`;
      else if(it.k==='note') body+=`<p class="tp-note">${esc(it.t)}</p>`;
      else if(it.k==='sec'){const s=d._byId[it.id]; if(s) body+=row(s);}
      else if(it.k==='ch'){const c=d._ch[it.id]; if(c) body+=`<h3 class="tp-ch">${esc(c.label)}${c.title?(' · '+esc(c.title)):''}</h3>`;}
    }
    body+=`</section>`;
  }
  return body;
}
function actResults(a,d,raw,limit){
  limit=limit||60;
  const {P,hits}=searchAct(d,raw);
  const terms=(DEFS_BY[a.id]||[]).filter(t=>P.whole.length>1&&t.t.toLowerCase().includes(P.whole)).slice(0,5);
  const everywhere=`<a class="ghostlink" href="#/search/${encodeURIComponent(raw.trim())}">Search all Acts for “${esc(raw.trim())}” ›</a>`;
  if(!hits.length&&!terms.length) return `<p class="empty">Nothing in the ${esc(a.short)} matches “${esc(raw.trim())}”.</p><div class="center">${everywhere}</div>`;
  const total=hits.reduce((n,h)=>n+h.n,0);
  let html=`<div class="s-sum"><b>${hits.length.toLocaleString()}</b> provision${hits.length===1?'':'s'}${total?` · ${total>=99*hits.length?'many':total.toLocaleString()} match${total===1?'':'es'} in the text`:''}</div>`;
  if(terms.length) html+=`<div class="s-grp">Defined in this Act</div><div class="s-res" style="margin-top:6px">`+terms.map(t=>`<a class="s-item" href="${secHref(a.id,t.s,t.t)}"><span class="sn neutral">def</span><span class="stx">${hlAll(t.t,P.hl)}</span><span class="smeta">${esc(citeOf(a.id,t.s,t.num))}</span></a>`).join('')+`</div>`;
  html+=`<div class="s-res">`+hits.slice(0,limit).map(h=>{const s=h.s;
    return `<a class="s-item ft" href="${secHref(a.id,s.id,P.q)}"><span class="sn" style="background:${a.ink}">${esc(ud(s))}</span><span class="ftcol"><span class="stx">${hlAll(s.t,P.hl)}</span>${h.n?`<span class="snip">${snippetOf(s.b,P)}</span>`:''}</span>${h.n?`<span class="cnt" title="matches in the text">${h.n>98?'99+':h.n}</span>`:''}</a>`}).join('')+`</div>`;
  if(hits.length>limit) html+=`<div class="center"><button class="ghostlink" id="amore">Show all ${hits.length.toLocaleString()}</button></div>`;
  return html+`<div class="center">${everywhere}</div>`;
}
const dmy=iso=>{const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(iso||'');return m?`${m[3]}/${m[2]}/${m[1]}`:(iso||'')};

/* ---------- READER ---------- */
async function openSec(aid,sid,q,tok){
  if(!SRC[aid]){renderSidebar();return renderHome();}
  if(!actCache.has(aid)) $('#main').innerHTML=`<div class="boot"><span class="spin"></span>Loading…</div>`;
  let d; try{d=await loadAct(aid)}catch(e){renderSidebar();$('#main').innerHTML=`<div class="boot">Couldn’t load that provision.<br><small>You may be offline and this Act isn’t saved yet.</small></div>`;return}
  if(tok!==_tok)return;
  let s=d._byId[sid];
  if(!s&&d._lc[String(sid).toLowerCase()]){ s=d._lc[String(sid).toLowerCase()]; sid=s.id; try{history.replaceState(history.state,'',secHref(aid,sid,q))}catch(e){} }   // ids differ only by case between Acts
  if(!s){ const to=((REG.redir||{})[aid]||{})[sid];                  // an id from an older build of the corpus
    if(to&&d._byId[to]){ try{history.replaceState(history.state,'',secHref(aid,to,q))}catch(e){} sid=to; s=d._byId[to]; fixStored(aid,arguments[1],s); } }
  if(!s) return missingSec(aid,sid);
  curAct=aid; curSec=sid; accAct=aid;
  const a=SRC[aid];
  pushRecent(aid,s); ls.set('last',{a:aid,id:sid,num:badge(s),disp:ud(s),t:s.t,p:(s.b||'').slice(0,140)});
  openPartFor(aid,d,sid); renderSidebar(); revealCur();
  const idx=s._i, prev=idx>0?d.sections[idx-1]:null, next=idx<d.sections.length-1?d.sections[idx+1]:null;
  const chipFor=(r,act)=>`<a class="chip2" href="${secHref(act,r.id)}"><span class="n" style="background:${ink(act)}">${esc(ud(r))}</span>${esc((r.t||'').slice(0,40))}</a>`;
  const refs=(s.rf||[]).map(r=>d._byId[r]).filter(Boolean).slice(0,14);
  const chips=refs.length?`<div class="cite-h">Cited in this provision</div><div class="cwrap">`+refs.map(r=>chipFor(r,aid)).join('')+`</div>`:'';
  const back=((d.rref||{})[sid]||[]).map(r=>d._byId[r]).filter(Boolean);
  const cited=back.length?`<div class="cite-h">Cited by · ${back.length}</div><div class="cwrap" id="citedBy">`+back.slice(0,10).map(r=>chipFor(r,aid)).join('')+(back.length>10?`<button class="chip2 morechip" id="citedMore">+${back.length-10} more</button>`:'')+`</div>`:'';
  const inT=TOPICS.topics.filter(t=>(t.clusters||[]).some(c=>(c.c||[]).some(x=>x.a===aid&&x.s===sid))).slice(0,4);
  const topc=inT.length?`<div class="cite-h">Appears in topics</div><div class="cwrap">`+inT.map(t=>`<a class="chip2" href="#/topic/${t.id}">${esc(t.name)}</a>`).join('')+`</div>`:'';
  const hist=(s.hn&&s.hn.length)?`<details class="hist"><summary>Amendment history · ${s.hn.length} note${s.hn.length>1?'s':''}</summary>${s.hn.map(n=>`<p>${esc(n)}</p>`).join('')}</details>`:'';
  const marksOn=ls.get('marks',true);
  const saved=(ls.get('saved',[])||[]).some(x=>x.a===aid&&x.id===sid);
  curPrev=prev?('/s/'+aid+'/'+prev.id):null; curNext=next?('/s/'+aid+'/'+next.id):null;
  const pager=(prev||next)?`<nav class="pager" aria-label="Previous and next provision">${prev?`<a class="pgbtn" href="${secHref(aid,prev.id)}"><span class="dir">‹ Previous</span><span class="pnm">${esc(ud(prev))} · ${esc(prev.t||'')}</span></a>`:'<span></span>'}${next?`<a class="pgbtn next" href="${secHref(aid,next.id)}"><span class="dir">Next ›</span><span class="pnm">${esc(ud(next))} · ${esc(next.t||'')}</span></a>`:'<span></span>'}</nav>`:'';
  const g=d._grp[s.grp], c=s.ch&&d._ch[s.ch];
  const crumb=[g&&(g.label&&g.title&&g.label!==g.title?`${g.label} — ${g.title}`:(g.title||g.label)), c&&`${c.label} — ${c.title}`, s.sch&&!g?s.sch:''].filter(Boolean);
  const memo=(SCAF_BY[aid+'|'+sid]||[]).map((k,i)=>scaffoldCard(k,SCAF[k],a,i)).join('');
  $('#main').innerHTML=`
    <div class="r-top fade">
      <a class="r-back" href="#/a/${aid}${g?'/'+g.id:''}" aria-label="Back to ${esc(a.short)}">${ic('back','currentColor')}<span class="full">${esc(a.short)}</span><span class="abbr">${esc(a.abbr)}</span></a>
      <div class="r-tools">
        <button class="rtb" id="findBtn" aria-label="Search inside ${esc(a.short)}" title="Search inside this Act ( / )">${ic('search','currentColor')}<span>This Act</span></button>
        <button class="rtb ${saved?'saved':''}" id="saveBtn" aria-pressed="${saved}" aria-label="Save provision" title="Save">${ic('heart','currentColor')}<span>${saved?'Saved':'Save'}</span></button>
        <button class="rtb" id="copyBtn" aria-label="Copy verbatim text" title="Copy verbatim text">${ic('copy','currentColor')}<span>Copy</span></button>
        <button class="rtb ${marksOn?'on':''}" id="markBtn" aria-pressed="${marksOn}" aria-label="Toggle defined-term highlights" title="Toggle defined-term highlights">${ic('book','currentColor')}<span>Terms</span></button>
      </div>
    </div>
    <article class="r-card fade"><div class="r-strip" style="--h:${a.hue};--hi:${a.ink}"></div>
      <header class="r-head" style="--h:${a.hue};--hi:${a.ink}"><span class="snum">${esc(ud(s))}</span><div><div class="act"><i></i>${esc(a.name)}</div><h1 class="stt">${esc(s.t)}</h1>${crumb.length?`<div class="crumb">${crumb.map(esc).join(' › ')}</div>`:''}</div></header>
      <div class="r-body" style="--h:${a.hue};--hi:${a.ink}"><div class="statute" id="statBody"></div>${hist}${chips}${cited}${topc}</div>
      <footer class="r-foot">${a.official?`Verbatim from the official version${a.comp?' as at '+esc(a.comp):''}${a.pco?' ('+esc(a.pco)+')':''}.`:`${esc(catName(a.cat))} material — not legislation.`} <a href="#/about">Sources</a></footer></article>
    ${memo}
    ${pager}`;
  paintStatute(aid,s,marksOn,q);
  wireReader(aid,s,d,back);
  if(q&&!_pendingY){ _pendingY=0; const first=$('#statBody mark.hit'); if(first)requestAnimationFrame(()=>first.scrollIntoView({block:'center'})); else settle(0); }
  else settle();
}
function missingSec(aid,sid){
  curAct=aid; curSec=null; accAct=aid; renderSidebar();
  const was=[...(ls.get('saved',[])||[]),...(ls.get('recents',[])||[])].find(x=>x.a===aid&&x.id===sid);
  const a=SRC[aid];
  page(`<a class="r-back fade" href="#/a/${aid}">${ic('back','currentColor')} ${esc(a.short)}</a>
    <div class="empty fade"><p><b>That provision isn’t in the current ${esc(a.short)}.</b><br>It may have been repealed or renumbered since this link was saved${a.comp?` (the Act here is as at ${esc(a.comp)})`:''}.</p>
    <div class="empty-cta">${was&&was.t?`<a class="ecta" href="#/a/${aid}?q=${encodeURIComponent(was.t)}">Look for “${esc(was.t.slice(0,40))}”</a>`:''}<a class="ecta ghost" href="#/a/${aid}">Open the Act</a></div></div>`);
}
/* a saved / recent entry that pointed at a retired id is rewritten once we know where it went */
function fixStored(aid,oldId,s){ for(const key of ['saved','recents']){ const arr=ls.get(key,[])||[]; let ch=false;
    arr.forEach(x=>{if(x.a===aid&&x.id===oldId){x.id=s.id;x.num=badge(s);x.disp=ud(s);x.t=s.t;ch=true}}); if(ch)ls.set(key,arr); } }

/* statute body = the official HTML, then (optionally) defined-term marks, then search hits */
let curTerms=[];
function paintStatute(aid,s,marksOn,q){
  const sb=$('#statBody'); if(!sb)return;
  sb.innerHTML=s.h||'';
  wireXrefs(sb,aid);
  if(marksOn) markTerms(sb,aid,s);
  const P=q?parseQ(q):null; let n=0;
  if(P&&P.terms.length) n=markHits(sb,P);
  wireTerms(sb);
  if(n) showHitNav(n,q); else hideHitNav();
}
function wireXrefs(root,aid){
  $$('a.xref',root).forEach(x=>{ const ta=x.dataset.a||aid, sid=x.dataset.s;
    if(sid&&SRC[ta]){ x.setAttribute('href',secHref(ta,sid)); if(x.dataset.a&&x.dataset.a!==aid) x.title=SRC[ta].short; }
    else x.classList.add('dead'); });
}
function wireReader(aid,s,d,back){
  try{document.title=ud(s)+' '+s.t+' · '+SRC[aid].abbr+' · WA Legislation';}catch(e){}
  $('#saveBtn').onclick=()=>toggleSave(aid,s);
  $('#findBtn').onclick=()=>navigate('/a/'+aid+'?q=');
  $('#copyBtn').onclick=()=>copyText(`${SRC[aid].name} ${ud(s)} — ${s.t}\n\n${s.b}`,'Verbatim copied');
  $('#markBtn').onclick=()=>{const on=!ls.get('marks',true);ls.set('marks',on);const q=new URLSearchParams((location.hash.split('?')[1])||'').get('q')||'';paintStatute(aid,s,on,q);const mb=$('#markBtn');mb.classList.toggle('on',on);mb.setAttribute('aria-pressed',on);};
  const cm=$('#citedMore'); if(cm)cm.onclick=()=>{$('#citedBy').innerHTML=back.map(r=>`<a class="chip2" href="${secHref(aid,r.id)}"><span class="n" style="background:${ink(aid)}">${esc(ud(r))}</span>${esc((r.t||'').slice(0,40))}</a>`).join('')};
  $$('.memo').forEach(m=>{ const key=m.dataset.key;
    const mc=$('.memoCopy',m); if(mc)mc.onclick=()=>copyScaffold(key);
    const md=$('.memoDrill',m); if(md)md.onclick=()=>{const on=m.classList.toggle('drill');md.textContent=on?'Reveal all':'Drill';if(!on)$$('.mitem',m).forEach(li=>li.classList.remove('shown'));};
    $$('.mitem',m).forEach(li=>li.addEventListener('click',()=>{if(m.classList.contains('drill'))li.classList.toggle('shown')}));
  });
}
function scaffoldCard(key,sc,a,i){
  const items=sc.items.map(it=>`<li class="mitem"><span class="mk">${esc(it.k)}</span><div class="mbody"><span class="mtx">${esc(it.txt)}</span>${it.eg?`<span class="meg">${esc(it.eg)}</span>`:''}</div></li>`).join('');
  return `<section class="memo fade" data-key="${esc(key)}" style="--h:${a.hue};--hi:${a.ink}" aria-label="Memorise card">
    <div class="memo-h"><span class="memo-badge">${ic('study','currentColor')} Memorise${sc.count?`<span class="memo-ct">${esc(sc.count.n)}</span>`:''}</span><div class="memo-act"><button class="mbtn memoDrill">Drill</button><button class="mbtn memoCopy">${ic('copy','currentColor')} Copy</button></div></div>
    ${sc.name?`<div class="memo-name">${esc(sc.name)}${sc.sec?` <span class="memo-sec">${esc(sc.sec)}</span>`:''}</div>`:''}
    ${sc.hook?`<div class="memo-hook">${ic('activity','currentColor')} ${esc(sc.hook)}</div>`:''}
    ${sc.lead?`<div class="memo-lead">${esc(sc.lead)}</div>`:''}
    <ol class="memo-list">${items}</ol>
    ${sc.eg?`<div class="memo-eg">${esc(sc.eg)}</div>`:''}
    ${sc.note?`<div class="memo-note">${esc(sc.note)}</div>`:''}
    <div class="memo-fyi">Study aid — condensed notes, not the verbatim text above.</div>
  </section>`;
}
function copyScaffold(key){const sc=SCAF[key];if(!sc)return;
  let t=(sc.name||'')+(sc.sec?(' — '+sc.sec):'')+(sc.count?(' ('+sc.count.n+')'):'')+'\n';
  if(sc.hook)t+='Hook: '+sc.hook+'\n';
  if(sc.lead)t+=sc.lead+'\n';
  sc.items.forEach(it=>{t+=`(${it.k}) ${it.txt}`+(it.eg?` — e.g. ${it.eg}`:'')+'\n';});
  if(sc.eg)t+='e.g. '+sc.eg+'\n';
  if(sc.note)t+='Note: '+sc.note+'\n';
  copyText(t.trim(),'Scaffold copied');
}
async function copyText(t,okMsg){
  try{ if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t);return toast(okMsg)} throw 0 }
  catch(e){ try{ const ta=document.createElement('textarea'); ta.value=t; ta.setAttribute('readonly',''); ta.style.cssText='position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); toast(ok?okMsg:'Couldn’t copy — select the text instead'); }
    catch(e2){ toast('Couldn’t copy — select the text instead'); } }
}
function toggleSave(aid,s){let sv=ls.get('saved',[])||[];const k=x=>x.a===aid&&x.id===s.id;
  if(sv.some(k)){sv=sv.filter(x=>!k(x));toast('Removed')}else{sv.unshift({a:aid,id:s.id,num:badge(s),disp:ud(s),t:s.t});toast('Saved')}
  ls.set('saved',sv.slice(0,200)); if(curSec===s.id){const b=$('#saveBtn');const now=sv.some(k);if(b){b.classList.toggle('saved',now);b.setAttribute('aria-pressed',now);b.innerHTML=ic('heart','currentColor')+'<span>'+(now?'Saved':'Save')+'</span>'}}}
function pushRecent(aid,s){let r=ls.get('recents',[])||[];r=r.filter(x=>!(x.a===aid&&x.id===s.id));r.unshift({a:aid,id:s.id,num:badge(s),disp:ud(s),t:s.t});ls.set('recents',r.slice(0,30))}

/* ---------- defined terms: scope-aware, one pass, non-destructive ----------
   A term is marked only where its definition actually applies:
   k=act everywhere · k=grp inside that Part (and Chapter / Division / Subdivision when the definition says so) · k=sec in its own section.
   Where two definitions compete, the narrower scope wins. First occurrence per paragraph, so a page never turns solid highlight. */
function termsFor(aid,s){
  const rank=t=>t.k==='sec'?3:(t.k==='grp'?((t.ch||t.dv)?2:1):0), best=new Map();
  for(const t of (DEFS_BY[aid]||[])){
    let ok=t.k==='act'||t.k==null;
    if(t.k==='sec') ok=t.s===s.id;
    else if(t.k==='grp'){ ok=t.g===s.grp; if(ok&&t.ch)ok=s.ch===t.ch; if(ok&&t.dv)ok=t.sub?((s.sdv||s.dv)===t.dv):(s.dv===t.dv); }
    if(!ok||!t.t||t.t.length<2)continue;
    const key=t.t.toLowerCase(), cur=best.get(key);
    if(!cur||rank(t)>rank(cur))best.set(key,t);
  }
  /* terms this Act borrows because the law says so (RTAA s 4 defines terms for every "road law"); the Act's own definitions win */
  for(const imp of ((SRC[aid]||{}).imp||[])) for(const t of (DEFS_BY[imp.a]||[])){
    if(t.k!=='act'||!imp.s.includes(t.s)||!t.t||t.t.length<2)continue; const key=t.t.toLowerCase(); if(!best.has(key))best.set(key,t); }
  return best;
}
function markTerms(root,aid,s){
  const best=termsFor(aid,s); curTerms=[]; if(!best.size)return;
  const keys=[...best.keys()].sort((a,b)=>b.length-a.length);
  const re=new RegExp('(^|[^\\w-])('+keys.map(escRe).join('|')+')(?![\\w-])','gi');
  const SKIP=new Set(['DFN','A','MARK','SUP','SUB','TH']);
  let seen=new Set();
  const doBlock=block=>{ if(block.matches&&block.matches('p.it.l1'))seen=new Set();
    const tw=document.createTreeWalker(block,NodeFilter.SHOW_TEXT,{acceptNode:n=>{for(let p=n.parentNode;p&&p!==block.parentNode;p=p.parentNode){ if(p.nodeType===1&&(SKIP.has(p.tagName)||/\b(mk|dt|co-label|alt-label|misc-h|note-h|delnote|qh)\b/.test(p.className||'')))return NodeFilter.FILTER_REJECT } return NodeFilter.FILTER_ACCEPT}});
    const nodes=[]; while(tw.nextNode())nodes.push(tw.currentNode);
    for(const node of nodes){ const txt=node.nodeValue; re.lastIndex=0; let m,last=0,frag=null;
      while((m=re.exec(txt))){ const key=m[2].toLowerCase(), at=m.index+m[1].length; if(seen.has(key))continue; seen.add(key);
        frag=frag||document.createDocumentFragment(); if(at>last)frag.appendChild(document.createTextNode(txt.slice(last,at)));
        const df=document.createElement('dfn'); df.textContent=m[2]; df.dataset.k=curTerms.push(best.get(key))-1; df.tabIndex=0; df.setAttribute('role','button'); frag.appendChild(df); last=at+m[2].length; }
      if(frag){ if(last<txt.length)frag.appendChild(document.createTextNode(txt.slice(last))); node.replaceWith(frag); } } };
  [...root.children].forEach(el=>{ if(el.classList.contains('callout')||el.classList.contains('tw'))[...el.querySelectorAll('p,td')].forEach(doBlock); else doBlock(el); });
}
let tipT; const FINE=matchMedia('(hover:hover) and (pointer:fine)').matches;
function wireTerms(root){
  $$('dfn',root).forEach(df=>{ const d=curTerms[+df.dataset.k]; if(!d)return;
    const open=ev=>{ev.preventDefault();ev.stopPropagation();showTerm(df,d)};
    if(FINE){ df.addEventListener('mouseenter',()=>{clearTimeout(tipT);showTerm(df,d)}); df.addEventListener('mouseleave',hideTermSoon);
      df.addEventListener('click',ev=>{ if(d.a===curAct&&d.s===curSec)return open(ev); ev.preventDefault(); hideTerm(); navigate(secHref(d.a,d.s,d.t).slice(1)); }); }
    else df.addEventListener('click',open);
    df.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' ')open(ev)});
  });
}
function showTerm(el,d){
  const p=$('#pop'), here=(d.a===curAct&&d.s===curSec);
  p.innerHTML=`<div class="grab"></div><div class="pt">${esc(d.t)}</div><div class="ps">${esc(SRC[d.a].abbr)} ${esc(citeOf(d.a,d.s,d.num))}${d.sc?(' · '+esc(d.sc)):''}</div><div class="pd">${esc(d.d).replace(/\n/g,'<br>')}</div>${here?'':`<a class="pj" id="popjump" href="${secHref(d.a,d.s,d.t)}">Open ${esc(citeOf(d.a,d.s,d.num))} →</a>`}`;
  const pj=$('#popjump'); if(pj)pj.onclick=()=>hideTerm();
  if(!FINE){ p.classList.add('sheet','on'); termScrim(true); return; }
  p.classList.remove('sheet'); p.style.left='-9999px'; p.style.top='0'; p.classList.add('on');
  const pr=p.getBoundingClientRect(), r=el.getBoundingClientRect(), gap=8;
  let top=r.bottom+gap; if(top+pr.height>innerHeight-8) top=Math.max(8, r.top-gap-pr.height);
  const left=Math.min(Math.max(8, r.left), innerWidth-pr.width-8);
  p.style.left=left+'px'; p.style.top=top+'px';
  p.onmouseenter=()=>clearTimeout(tipT); p.onmouseleave=hideTermSoon;
}
function hideTermSoon(){clearTimeout(tipT);tipT=setTimeout(hideTerm,160)}
function hideTerm(){clearTimeout(tipT);const p=$('#pop');if(!p)return;p.classList.remove('on','sheet');termScrim(false)}
function termScrim(on){let s=$('#termScrim');if(!s){if(!on)return;s=document.createElement('div');s.id='termScrim';s.className='term-scrim';s.addEventListener('click',hideTerm);document.body.appendChild(s)}s.classList.toggle('on',on)}

/* ---------- search hits inside the open provision ---------- */
let hitI=0;
function markHits(root,P){
  const terms=(P.terms.length>1&&P.whole&&(root.textContent||'').toLowerCase().includes(P.whole))?[P.whole]:P.terms;
  const re=new RegExp('('+terms.slice().sort((a,b)=>b.length-a.length).map(escRe).join('|')+')','gi');
  const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[]; while(tw.nextNode())nodes.push(tw.currentNode);
  let n=0;
  for(const node of nodes){ const txt=node.nodeValue; if(!txt||!txt.trim())continue; re.lastIndex=0; let m,last=0,frag=null;
    while((m=re.exec(txt))){ if(!m[0].length){re.lastIndex++;continue}
      frag=frag||document.createDocumentFragment(); if(m.index>last)frag.appendChild(document.createTextNode(txt.slice(last,m.index)));
      const mk=document.createElement('mark'); mk.className='hit'; mk.textContent=m[0]; frag.appendChild(mk); last=m.index+m[0].length; n++; }
    if(frag){ if(last<txt.length)frag.appendChild(document.createTextNode(txt.slice(last))); node.replaceWith(frag); } }
  return n;
}
function showHitNav(n,q){ const el=$('#hitnav'); hitI=0;
  el.innerHTML=`<span class="hq">“${esc(q.length>22?q.slice(0,21)+'…':q)}”</span><span class="hc" id="hitCount">1 / ${n}</span><button id="hitPrev" aria-label="Previous match">${ic('up','currentColor')}</button><button id="hitNext" aria-label="Next match">${ic('down','currentColor')}</button><button id="hitClose" aria-label="Clear highlights">${ic('x','currentColor')}</button>`;
  el.hidden=false;
  const go=k=>{ const hs=$$('#statBody mark.hit'); if(!hs.length)return; hs.forEach(h=>h.classList.remove('cur')); hitI=(k+hs.length)%hs.length; hs[hitI].classList.add('cur'); hs[hitI].scrollIntoView({block:'center',behavior:'smooth'}); $('#hitCount').textContent=(hitI+1)+' / '+hs.length; };
  $('#hitPrev').onclick=()=>go(hitI-1); $('#hitNext').onclick=()=>go(hitI+1);
  $('#hitClose').onclick=()=>{ try{history.replaceState(history.state,'',location.hash.split('?')[0])}catch(e){} $$('#statBody mark.hit').forEach(m=>m.replaceWith(document.createTextNode(m.textContent))); $('#statBody').normalize(); hideHitNav(); };
  const first=$('#statBody mark.hit'); if(first)first.classList.add('cur');
}
function hideHitNav(){const el=$('#hitnav'); if(el){el.hidden=true;el.innerHTML=''}}

/* ---------- TOPIC ---------- */
function renderTopicPage(id){
  const t=TOPICS.topics.find(x=>x.id===id); if(!t)return renderBrowse('topics');
  const first=t.clusters&&t.clusters[0]&&t.clusters[0].c[0];
  const fam=(first&&SRC[first.a])?SRC[first.a].fam:'blue', hx=REG.palette[fam]||REG.palette.blue;
  document.title=t.name+' · WA Legislation';
  const cl=(t.clusters||[]).map(c=>`<div class="cite-h">${esc(c.h)}</div><div class="tlist">`+
    (c.c||[]).filter(x=>SRC[x.a]).map(x=>{const grp=x.g&&!x.s;
      return `<a class="chip2 trow" href="${grp?`#/a/${x.a}/${x.g}`:secHref(x.a,x.s)}"><span class="n" style="background:${ink(x.a)}">${esc(grp?x.n:ud({u:x.u||'s',num:x.n}))}</span><span class="tt">${esc(x.t)}${grp&&x.c?` <small>${x.c} provisions</small>`:''}</span><span class="ab">${esc(SRC[x.a].abbr)}</span></a>`}).join('')+`</div>`).join('');
  page(`<a class="r-back fade" href="#/topics">${ic('back','currentColor')} Topics</a>
    <div class="tile thead fade" style="background:${tileBg(hx)};--tsh:color-mix(in srgb,${hx} 55%,transparent)"><span class="chip">${ic(topicIcon(t))}</span><span class="lb">${esc(t.name)}<small>${esc(t.blurb||'')}</small></span></div>${cl}`);
}

/* ---------- SEARCH (all sources) ---------- */
let searchT;
function pushSearch(q){q=(q||'').trim();if(q.length<2)return;let r=ls.get('searches',[])||[];r=r.filter(x=>x.toLowerCase()!==q.toLowerCase());r.unshift(q);ls.set('searches',r.slice(0,8));}
function renderSearch(q){
  const scopes=`<div class="scopes" id="scopes" aria-label="Search inside one Act"><span class="sc-l">Inside one Act</span>`+acts().map(a=>`<button data-a="${a.id}" style="--h:${a.hue};--hi:${a.ink}">${esc(a.abbr)}</button>`).join('')+`</div>`;
  $('#main').innerHTML=`<h1 class="h-title fade" style="margin-bottom:8px">Search</h1>
    <div class="sfield fade" style="height:54px"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="sin" type="search" aria-label="Search legislation" placeholder="Section number, words, or “a phrase”…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><button id="sclear" class="sclear" aria-label="Clear search" title="Clear" hidden>${ic('x','currentColor')}</button></div>
    ${scopes}
    <div class="s-res" id="sres"></div>`;
  const i=$('#sin'); i.value=q||'';
  const clr=$('#sclear'); const toggleClr=()=>{clr.hidden=!i.value;}; toggleClr();
  const sync=()=>{ try{history.replaceState(history.state,'','#/search'+(i.value.trim()?'/'+encodeURIComponent(i.value.trim()):''))}catch(e){} };
  i.addEventListener('input',()=>{toggleClr();clearTimeout(searchT);searchT=setTimeout(()=>{runSearch(i.value);sync()},110)});
  i.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('#sres a.s-item'); if(first){e.preventDefault();pushSearch(i.value);location.hash=first.getAttribute('href').slice(1);}}});
  clr.onclick=()=>{i.value='';toggleClr();runSearch('');sync();i.focus();};
  $('#scopes').addEventListener('click',e=>{const b=e.target.closest('button[data-a]'); if(b)navigate('/a/'+b.dataset.a+'?q='+encodeURIComponent(i.value.trim()))});
  $('#sres').addEventListener('click',e=>{
    const x=e.target.closest('.s-x'); if(x){e.preventDefault();e.stopPropagation();ls.set('searches',(ls.get('searches',[])||[]).filter(v=>v!==x.dataset.q));runSearch(i.value);return;}
    const c=e.target.closest('.s-clear'); if(c){e.preventDefault();ls.set('searches',[]);runSearch(i.value);return;}
    const m=e.target.closest('#smore'); if(m){e.preventDefault();runSearch(i.value,400);return;}
    if(e.target.closest('a.s-item'))pushSearch(i.value);
  });
  if(!_pendingY)i.focus({preventScroll:true}); runSearch(q||''); settle();
  if(!FTEXT && !loadingFT){ loadingFT=true; jget('ftext.json').then(d=>{FTEXT=d;FTL={};for(const k in d)FTL[k]=d[k].toLowerCase();loadingFT=false; if($('#sin'))runSearch($('#sin').value)}).catch(()=>{loadingFT=false}); }
}
function runSearch(raw,limit){
  const el=$('#sres'); if(!el)return; limit=limit||16;
  const P=parseQ(raw);
  if(!P.terms.length){
    const rec=ls.get('searches',[])||[]; let h='';
    if(rec.length){ h+=`<div class="s-grp s-grp-row">Recent <button class="s-clear">Clear</button></div>`+rec.map(r=>`<div class="s-rec"><a class="s-recline" href="#/search/${encodeURIComponent(r)}"><svg class="rico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.500V12l3 2"/></svg>${esc(r)}</a><button class="s-x" data-q="${esc(r)}" aria-label="Remove ${esc(r)}">${ic('x','currentColor')}</button></div>`).join(''); }
    h+=`<div class="s-grp">Try</div><div class="s-recent" style="margin-top:0">`+['cc 279','murder','grievous bodily harm','cia 27','"reasonably suspects"','total fire ban','search warrant'].map(t=>`<a class="s-rchip" href="#/search/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')+`</div>`;
    el.innerHTML=h; return;
  }
  const w=a=>1+((SRC[a]&&SRC[a].pr)||0.5)/3;
  // 1. a citation: "cc 279", "s 27a", "rta 59(1)"
  const cite=parseCite(P.q), go=[], seen=new Set();
  if(cite){ const only=actsForHint(cite.hint);
    if(!(cite.hint&&!only.length)){ for(const e of SEARCH){ if(only&&!only.includes(e.a))continue; if(e.u==='d'||e.u==='fm')continue;
        const n=String(e.num).toLowerCase(); if(n===cite.num)go.push({e,sc:100*w(e.a)}); else if(!only&&n.startsWith(cite.num)&&go.length<400)go.push({e,sc:10*w(e.a)}); else if(only&&n.startsWith(cite.num))go.push({e,sc:10*w(e.a)}); }
      go.sort((x,y)=>y.sc-x.sc); go.splice(12); go.forEach(g=>seen.add(g.e.a+'|'+g.e.id)); } }
  // 2. headings
  const title=[]; for(const e of SEARCH){ const k=e.a+'|'+e.id; if(seen.has(k))continue; const t=e.t.toLowerCase();
    if(!P.terms.every(x=>t.includes(x)))continue; title.push({e,sc:(t.includes(P.whole)?2:1)*(t.startsWith(P.whole)?1.5:1)*w(e.a)*(e.u==='d'?0.6:1)}); }
  title.sort((x,y)=>y.sc-x.sc); title.forEach(x=>seen.add(x.e.a+'|'+x.e.id));
  const defs=DEFS.filter(d=>d.t.toLowerCase().includes(P.whole)).sort((x,y)=>(x.t.length-y.t.length)||(w(y.a)-w(x.a))).slice(0,8);
  const tops=TOPICS.topics.filter(t=>P.terms.every(x=>t.name.toLowerCase().includes(x))).slice(0,6);
  const srcs=REG.sources.filter(s=>P.terms.every(x=>(s.name+' '+s.abbr+' '+s.short).toLowerCase().includes(x))).slice(0,6);
  // 3. the text itself
  let text=[]; if(FTEXT){ for(const e of SEARCH){ const k=e.a+'|'+e.id; if(seen.has(k))continue; const b=FTL[k]; if(!b||!P.terms.every(x=>b.includes(x)))continue;
      let n=0; for(const t of P.terms)n+=countOf(b,t); const phrase=P.terms.length>1&&b.includes(P.whole);
      text.push({e,n,sc:(phrase?3:1)*Math.min(1+n/6,3)*w(e.a)}); } text.sort((x,y)=>y.sc-x.sc); }
  const lab=e=>esc(ud(e));
  const secRow=({e})=>`<a class="s-item" href="${secHref(e.a,e.id)}"><span class="sn" style="background:${ink(e.a)}">${lab(e)}</span><span class="stx">${hlAll(e.t,P.hl)}</span><span class="smeta">${esc(SRC[e.a].abbr)}</span></a>`;
  const ftRow=({e,n})=>`<a class="s-item ft" href="${secHref(e.a,e.id,P.q)}"><span class="sn" style="background:${ink(e.a)}">${lab(e)}</span><span class="ftcol"><span class="stx">${esc(e.t)}</span><span class="snip">${snippetOf(FTEXT[e.a+'|'+e.id],P)}</span></span><span class="smeta">${esc(SRC[e.a].abbr)}${n>1?`<br><span class="cnt">${n>98?'99+':n}</span>`:''}</span></a>`;
  let html='';
  if(go.length){html+=`<div class="s-grp">Go to</div>`+go.map(secRow).join('')}
  if(title.length){html+=`<div class="s-grp">Headings · ${title.length.toLocaleString()}</div>`+title.slice(0,limit).map(secRow).join('')}
  if(srcs.length){html+=`<div class="s-grp">Acts &amp; sources</div>`+srcs.map(s=>`<a class="s-item" href="#/a/${s.id}"><span class="sn" style="background:${s.ink}">${esc(s.abbr)}</span><span class="stx">${hlAll(s.name,P.hl)}</span><span class="smeta">${s.n.toLocaleString()}</span></a>`).join('')}
  if(defs.length){html+=`<div class="s-grp">Definitions</div>`+defs.map(d=>`<a class="s-item" href="${secHref(d.a,d.s,d.t)}"><span class="sn neutral">def</span><span class="stx">${hlAll(d.t,P.hl)}${d.sc?` <small class="scn">${esc(d.sc)}</small>`:''}</span><span class="smeta">${esc(SRC[d.a].abbr)} ${esc(d.num)}</span></a>`).join('')}
  if(tops.length){html+=`<div class="s-grp">Topics</div>`+tops.map(t=>`<a class="s-item" href="#/topic/${t.id}"><span class="sn neutral">topic</span><span class="stx">${hlAll(t.name,P.hl)}</span></a>`).join('')}
  if(text.length){html+=`<div class="s-grp">In the text · ${text.length.toLocaleString()} provision${text.length>1?'s':''}</div>`+text.slice(0,limit).map(ftRow).join('')}
  else if(!FTEXT){html+=`<div class="s-grp muted"><span class="spin" style="width:11px;height:11px"></span> loading full-text…</div>`}
  if(Math.max(title.length,text.length)>limit&&limit<400) html+=`<div class="center"><button class="ghostlink" id="smore">Show more</button></div>`;
  el.innerHTML=html||`<p class="empty">No matches for “${esc(raw.trim())}”.</p>`;
}

/* ---------- STUDY / SAVED / RECENTS / DEFS / DRUGS ---------- */
function studyTiles(full){return [['Recall drill',full?'flip cards · weakest-first':'weakest-first','activity','#797efe','/study/drill'],['Section quiz',full?'multiple choice or type':'test yourself','alert','#fc8f66','/study/quiz'],['Scenarios',full?'fact pattern → elements':'worked','file','#3dcfae','/study/scen'],['Drug matrix','MDA quantities','droplet','#fec846','/drugs']]
  .map(([n,d,i,h,a])=>`<a class="tile" href="#${a}" style="background:${tileBg(h)};--tsh:color-mix(in srgb,${h} 55%,transparent)"><span class="chip">${ic(i)}</span><span class="lb">${n}<small>${d}</small></span></a>`).join('')}
function renderStudy(){
  const n=Object.keys(SCAF).length;
  page(`<h1 class="h-title fade">Study</h1><div class="tilegrid fade">${studyTiles(true)}</div>
   <p class="sub-note fade" style="margin-top:20px">Active recall over ${n} recall cards — every limb sliced from the verbatim text, no invented law. Your weakest cards surface first.</p>`);
}
function studyHead(title){return `<a class="r-back fade" href="#/study">${ic('back','currentColor')} Study</a><h1 class="h-title" style="margin:6px 0 14px">${esc(title)}</h1>`;}
const _shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const _pick=(a,n)=>_shuf(a).slice(0,n);
function scaffoldKeys(){return Object.keys(SCAF).filter(k=>SCAF[k]&&SCAF[k].items&&SCAF[k].items.length&&SRC[k.split('|')[0]]);}
const keyParts=k=>{const[a,rest]=k.split('|');return{a,id:(rest||'').split('#')[0]}};

/* ===== RECALL DRILL — active recall over scaffold cards, weakest-first ===== */
let drillSess=null;
function weakestFirst(keys){const sc=ls.get('drillScore',{})||{};
  return _shuf(keys).sort((a,b)=>{const A=sc[a],B=sc[b];const ap=A?1:0,bp=B?1:0;
    if(ap!==bp)return ap-bp;                       // never-seen first
    if(A&&B&&A.s!==B.s)return A.s-B.s;              // then lowest score (weakest)
    return 0;});}
function renderDrill(){
  const keys=scaffoldKeys();
  if(!keys.length){page(studyHead('Recall drill')+`<p class="empty">No scaffolds loaded.</p>`);return;}
  const q=weakestFirst(keys).slice(0,Math.min(15,keys.length));
  drillSess={queue:q,i:0,size:q.length,res:{got:0,hard:0,miss:0}};
  document.title='Recall drill · WA Legislation';
  drillStep();
}
function drillStep(){
  const s=drillSess; if(!s)return; if(s.i>=s.queue.length)return drillDone();
  const key=s.queue[s.i], sc=SCAF[key], {a,id}=keyParts(key);
  const cnt=sc.count&&sc.count.n, unit=/limb/i.test((sc.count&&sc.count.q)||'')?'limbs':'elements';
  const prompt=cnt?`Recall the ${cnt} ${unit}`:(sc.items.length===1?'Recall it':'Recall the elements');
  const items=sc.items.map((it,idx)=>`<li class="dmi" data-i="${idx}"><span class="dmk">${esc(it.k||'•')}</span><span class="dmb"><span class="dmt">${esc(it.txt)}</span>${it.eg?`<span class="dme">${esc(it.eg)}</span>`:''}</span></li>`).join('');
  page(studyHead('Recall drill')+`
  <div class="qprog"><span style="width:${Math.round(s.i/s.size*100)}%"></span></div>
  <div class="qcount">${s.i+1} / ${s.size}</div>
  <div class="dcard fade" style="--h:${hue(a)};--hi:${ink(a)}">
    <div class="r-strip"></div>
    <div class="dbody">
      <div class="dact">${esc(SRC[a].abbr)} ${esc(sc.sec||'')}</div>
      <h2 class="dname">${esc(sc.name)}</h2><p class="dprompt">${prompt}</p>
      ${sc.lead?`<p class="dlead">${esc(sc.lead)}</p>`:''}
      <ul class="dlist drillblur" id="dlist">${items}</ul>
      ${(sc.eg||sc.note)?`<p class="dnote" hidden>${sc.eg?esc(sc.eg):''}${sc.eg&&sc.note?'<br>':''}${sc.note?esc(sc.note):''}</p>`:''}
    </div>
    <div class="dactions" id="dreveal"><button class="qbtn primary" id="dRevealBtn">Reveal answer</button><a class="qbtn ghost" href="${secHref(a,id)}">Open section</a></div>
    <div class="drate" id="drate" hidden><button class="rate miss" data-r="miss">Missed</button><button class="rate hard" data-r="hard">Hard</button><button class="rate got" data-r="got">Got it</button></div>
  </div>`);
  $('#dRevealBtn').onclick=()=>{$('#dlist').classList.remove('drillblur');const nt=$('.dnote');if(nt)nt.hidden=false;$('#dreveal').hidden=true;$('#drate').hidden=false;const g=$('.rate.got');if(g)g.focus({preventScroll:true});};
  $$('#dlist .dmi').forEach(li=>li.onclick=()=>{if($('#dlist').classList.contains('drillblur'))li.classList.toggle('peek');});
  $('#drate').onclick=e=>{const b=e.target.closest('.rate');if(b)rateDrill(key,b.dataset.r);};
}
function rateDrill(key,r){
  const sc=ls.get('drillScore',{})||{}; const cur=sc[key]||{s:0,n:0};
  cur.s=Math.max(-6,Math.min(10,(cur.s||0)+(r==='got'?2:r==='hard'?0:-2))); cur.n=(cur.n||0)+1; cur.t=Date.now();
  sc[key]=cur; ls.set('drillScore',sc);
  const s=drillSess; s.res[r]++;
  if(r==='miss'){s.queue.splice(Math.min(s.i+3,s.queue.length),0,key);s.size=s.queue.length;}
  else if(r==='hard'){s.queue.push(key);s.size=s.queue.length;}
  s.i++; drillStep();
}
function drillDone(){
  const s=drillSess,r=s.res;
  page(studyHead('Recall drill')+`<div class="qdone fade"><div class="qbig">${r.got}<span>/${s.i}</span></div><p class="qsum">Got it ${r.got} · Hard ${r.hard} · Missed ${r.miss}</p><div class="qend"><button class="qbtn primary" id="qAgain">Drill again</button><a class="qbtn ghost" href="#/study">Done</a></div></div>`);
  $('#qAgain').onclick=renderDrill; drillSess=null;
}

/* ===== SECTION QUIZ — MCQ or type-in, generated from the offence library + scaffolds ===== */
let quizSess=null;
function quizPool(){
  const seen=new Set();
  const off=(OFF.offences||[]).filter(o=>SRC[o.a]).map(o=>{const k=o.a+'|'+o.id;const sc=SCAF[k];
    return{key:k,a:o.a,id:o.id,name:o.t,sec:o.num?offNum(o):((sc&&sc.sec)||''),items:sc&&sc.items,count:sc&&sc.count,w:Math.pow((SRC[o.a].pr||1),2)+(sc?2:0)};})
    .filter(c=>c.name&&c.sec&&!seen.has(c.key)&&seen.add(c.key));
  if(off.length>=8)return off;
  return scaffoldKeys().map(k=>{const{a,id}=keyParts(k);const sc=SCAF[k];return{key:k,a,id,name:sc.name,sec:sc.sec||('s '+id.replace(/^[a-z]+-/,'')),items:sc.items,count:sc.count,w:1};});
}
/* weighted draw: the Acts you work from every day (Code, CIA, MDA, RTA) come up more than the fringe ones */
function drawWeighted(pool){let tot=0;for(const c of pool)tot+=c.w||1;let r=Math.random()*tot;for(const c of pool){r-=(c.w||1);if(r<=0)return c}return pool[pool.length-1]}
function secLabel(c){return SRC[c.a].abbr+' '+c.sec;}
function genQuestion(pool,mode,avoid){
  let c=drawWeighted(pool); for(let k=0;k<6&&avoid.has(c.key);k++)c=drawWeighted(pool); avoid.add(c.key);
  const sib=pool.filter(x=>x.a===c.a&&x.key!==c.key&&x.name!==c.name);
  const others=sib.length>=3?sib:pool.filter(x=>x.key!==c.key&&x.name!==c.name);
  const types=mode==='type'?['nameOffence','nameSection','count']:['nameOffence','nameSection','count','pickElement'];
  let type=types[Math.floor(Math.random()*types.length)];
  if(type==='count'&&!(c.count&&c.count.n))type='nameOffence';
  if(type==='pickElement'&&!(c.items&&c.items.length))type='nameOffence';
  const uniq=(arr,f)=>{const s=new Set();return arr.filter(x=>{const v=f(x);if(s.has(v))return false;s.add(v);return true})};
  if(type==='nameOffence'){const ans=c.name;return{q:`What is ${esc(secLabel(c))}?`,ans,opts:_shuf([ans,..._pick(uniq(others,x=>x.name),3).map(x=>x.name)]),accept:[ans],a:c.a,id:c.id,type};}
  if(type==='nameSection'){const ans=secLabel(c);const num=(c.sec||'').replace(/[^0-9A-Za-z]/g,'');return{q:`Which provision is “${esc(c.name)}” (${esc(SRC[c.a].abbr)})?`,ans,opts:_shuf([ans,..._pick(uniq(others.filter(x=>secLabel(x)!==ans),secLabel),3).map(secLabel)]),accept:[ans,c.sec,num].filter(Boolean),a:c.a,id:c.id,type};}
  if(type==='count'){const n=String(c.count.n),unit=/limb/i.test((c.count.q)||'')?'limbs':'elements';const set=new Set([n]);let g=Math.max(1,+n-2)||1;while(set.size<4&&g<=+n+5){if(g!=+n)set.add(String(g));g++;}return{q:`How many ${unit} — ${esc(c.name)} (${esc(secLabel(c))})?`,ans:n,opts:_shuf([...set]),accept:[n],a:c.a,id:c.id,type};}
  const it=c.items[Math.floor(Math.random()*c.items.length)];
  const distract=[...new Set(_shuf(others).slice(0,14).flatMap(x=>(x.items||[]).map(i=>i.txt)).filter(t=>t&&t!==it.txt))];
  if(distract.length<3){const ans=c.name;return{q:`What is ${esc(secLabel(c))}?`,ans,opts:_shuf([ans,..._pick(uniq(others,x=>x.name),3).map(x=>x.name)]),accept:[ans],a:c.a,id:c.id,type:'nameOffence'};}
  return{q:`Which is an element of “${esc(c.name)}” (${esc(secLabel(c))})?`,ans:it.txt,opts:_shuf([it.txt,..._pick(distract,3)]),accept:[it.txt],a:c.a,id:c.id,type};
}
function renderQuiz(){
  const pool=quizPool();
  if(pool.length<4){page(studyHead('Section quiz')+`<p class="empty">Not enough scaffolds to quiz yet.</p>`);return;}
  quizSess={pool,mode:ls.get('quizMode','mc'),n:0,size:Math.min(12,pool.length),correct:0,asked:new Set()};
  document.title='Section quiz · WA Legislation';
  quizStep();
}
function quizStep(){
  const s=quizSess; if(!s)return; if(s.n>=s.size)return quizDone();
  s.answered=false; const Q=genQuestion(s.pool,s.mode,s.asked); s.cur=Q;
  const toggle=`<div class="qmode">${[['mc','Multiple choice'],['type','Type answer']].map(([m,l])=>`<button data-m="${m}" class="${s.mode===m?'on':''}" aria-pressed="${s.mode===m}">${l}</button>`).join('')}</div>`;
  const body=s.mode==='mc'
    ?`<div class="qopts" id="qopts">${Q.opts.map(o=>`<button class="qopt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`
    :`<form class="qform" id="qform"><input id="qin" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type your answer…" aria-label="Your answer"><button class="qbtn primary" type="submit">Check</button></form>`;
  page(studyHead('Section quiz')+`${toggle}
   <div class="qprog"><span style="width:${Math.round(s.n/s.size*100)}%"></span></div>
   <div class="qcount">${s.n+1} / ${s.size} · score ${s.correct}</div>
   <div class="qcard fade" style="--h:${hue(Q.a)};--hi:${ink(Q.a)}"><p class="qq">${Q.q}</p>${body}<div class="qfb" id="qfb" role="status" hidden></div><div class="qnext" id="qnext" hidden><button class="qbtn primary" id="qNextBtn">Next</button></div></div>`);
  $$('.qmode button').forEach(b=>b.onclick=()=>{if(b.dataset.m!==s.mode){s.mode=b.dataset.m;ls.set('quizMode',s.mode);quizStep();}});
  if(s.mode==='mc'){$('#qopts').onclick=e=>{const b=e.target.closest('.qopt');if(b)quizAnswer(b.dataset.o,b);};}
  else{$('#qform').onsubmit=e=>{e.preventDefault();quizAnswer($('#qin').value,null);};const qi=$('#qin');if(qi)qi.focus({preventScroll:true});}
  const nb=$('#qNextBtn'); if(nb)nb.onclick=()=>{s.n++;quizStep();};
}
const _norm=s=>(s||'').toLowerCase().replace(/^(s|r)\.?\s*/,'').replace(/[^a-z0-9]/g,'');
function quizAnswer(given,btn){
  const s=quizSess,Q=s.cur; if(s.answered)return; s.answered=true;
  const g=_norm(given);
  const ok=!!g&&(Q.accept.some(x=>_norm(x)===g)||(Q.type==='nameOffence'&&g.length>=5&&_norm(Q.ans).includes(g)));
  if(ok)s.correct++;
  const fb=$('#qfb'); fb.hidden=false; fb.className='qfb '+(ok?'ok':'no');
  fb.innerHTML=(ok?'✓ Correct':'✗ '+esc(Q.ans))+` · <a href="${secHref(Q.a,Q.id)}">open section</a>`;
  if(s.mode==='mc'){$$('.qopt').forEach(b=>{b.disabled=true;if(b.dataset.o===Q.ans)b.classList.add('correct');else if(b===btn)b.classList.add('wrong');});}
  else{const qi=$('#qin');if(qi)qi.disabled=true;const sb=$('#qform button');if(sb)sb.disabled=true;}
  $('#qnext').hidden=false; const nb=$('#qNextBtn'); if(nb)nb.focus({preventScroll:true});
}
function quizDone(){
  const s=quizSess,pct=Math.round(s.correct/s.size*100);
  page(studyHead('Section quiz')+`<div class="qdone fade"><div class="qbig">${s.correct}<span>/${s.size}</span></div><p class="qsum">${pct}% — ${pct>=80?'at the 80% competency bar':'keep drilling toward 80%'}</p><div class="qend"><button class="qbtn primary" id="qAgain">New quiz</button><a class="qbtn ghost" href="#/study">Done</a></div></div>`);
  $('#qAgain').onclick=renderQuiz; quizSess=null;
}
/* ===== SCENARIOS — a fact pattern, then the provision's own words as the checklist ===== */
function renderScenarios(){
  $('#main').innerHTML=studyHead('Scenarios')+`<div class="boot"><span class="spin"></span>Loading…</div>`;
  loadStudy().then(()=>{ if(curSeg!=='study')return; const sc=STUDY.scen||{};
    const body=Object.keys(sc).filter(k=>SRC[sc[k].a||k.split(':')[0]]).map(k=>{const v=sc[k], a=v.a||k.split(':')[0], sid=v.s||k.split(':')[1];
      const els=(v.els||[]).map(e=>`<li><span class="mk">${esc(e.m)}</span><span>${esc(e.t)}</span></li>`).join('');
      return `<article class="r-card scen" style="--h:${hue(a)};--hi:${ink(a)}"><div class="r-body"><div class="scen-h">${esc(v.h||'')}</div><p class="scen-f">${esc(v.fact||'')}</p>
        <details><summary>What has to be proved · ${esc(SRC[a].abbr)} ${esc(citeOf(a,sid,v.num))}</summary>${els?`<ul class="scen-els">${els}</ul>`:''}${v.pen?`<p class="scen-pen">${esc(v.pen)}</p>`:''}<a class="ghostlink" href="${secHref(a,sid)}">Read ${esc(citeOf(a,sid,v.num))} ${esc(v.t||'')} ›</a></details></div></article>`}).join('');
    page(studyHead('Scenarios')+`<p class="sub-note fade">Read the facts, run the elements in your head, then open the checklist. The checklist is quoted from the provision, not paraphrased.</p><div class="fade">${body}</div>`);
  }).catch(()=>page(studyHead('Scenarios')+`<p class="empty">Couldn’t load the scenarios.</p>`));
}
function storedRow(x,rm){ if(!SRC[x.a])return ''; const row=`<a class="arow" href="${secHref(x.a,x.id)}"><span class="badge" style="background:${tileBg(hue(x.a))};--tsh:${tsh(x.a)}">${esc(String(x.num).replace(/^Sch\.\s*/,'Sch '))}</span><div><div class="nm">${esc(x.t)}</div><div class="me">${esc(SRC[x.a].abbr)} · ${esc(x.disp)}</div></div>${rm?'':`<span class="ch">${ic('chev','currentColor')}</span>`}</a>`;
  return rm?`<div class="row-wrap">${row}<button class="row-x" data-a="${esc(x.a)}" data-id="${esc(x.id)}" aria-label="Remove ${esc(x.t)} from saved">${ic('x','currentColor')}</button></div>`:row; }
const emptyCta=`<div class="empty-cta"><a class="ecta" href="#/browse">Browse the Acts</a><a class="ecta ghost" href="#/search">Search</a></div>`;
function renderSaved(){
  const sv=ls.get('saved',[])||[];
  if(!sv.length){page(`<h1 class="h-title fade">Saved</h1><div class="empty fade"><p>No saved provisions yet. Tap Save on any provision and it’ll wait here.</p>${emptyCta}</div>`);return;}
  page(`<h1 class="h-title fade">Saved</h1><div class="fade" id="savedList">${sv.map(x=>storedRow(x,true)).join('')}</div>`);
  const list=$('#savedList'); if(list)list.addEventListener('click',e=>{const x=e.target.closest('.row-x'); if(x){e.preventDefault();const sv2=(ls.get('saved',[])||[]).filter(i=>!(i.a===x.dataset.a&&i.id===x.dataset.id));ls.set('saved',sv2);toast('Removed');const y=window.scrollY;renderSaved();settle(y);}});
}
function renderRecents(){
  const r=ls.get('recents',[])||[];
  page(`<h1 class="h-title fade">Recent</h1><div class="fade">${r.length?r.map(x=>storedRow(x,false)).join(''):`<div class="empty"><p>No recents yet — open a provision and it’ll show here.</p>${emptyCta}</div>`}</div>`);
}
function renderDefs(){
  const byL={};DEFS.forEach(d=>{const L=(d.t[0]||'#').toUpperCase();(byL[/[A-Z]/.test(L)?L:'#']=byL[/[A-Z]/.test(L)?L:'#']||[]).push(d)});
  const letters=Object.keys(byL).sort();
  const az=`<div class="azbar">`+letters.map(L=>`<a href="#/defs" data-l="${L}">${L}</a>`).join('')+`</div>`;
  const body=letters.map(L=>`<h2 class="defs-l" id="defL-${L==='#'?'num':L}">${L}</h2>`+byL[L].slice().sort((a,b)=>a.t.localeCompare(b.t)||a.a.localeCompare(b.a)).map(d=>`<a class="s-item" href="${secHref(d.a,d.s,d.t)}"><span class="stx">${esc(d.t)}${d.sc&&d.k!=='act'?` <small class="scn">${esc(d.sc)}</small>`:''}</span><span class="smeta">${esc(SRC[d.a].abbr)} ${esc(d.num)}</span></a>`).join('')).join('');
  page(`<h1 class="h-title fade">Definitions</h1><p class="sub-note fade">${DEFS.length.toLocaleString()} defined terms, read from the way Parliamentary Counsel marks them in each Act. A term only applies where its definition says it does.</p>${az}<div class="fade s-res" id="defsBody" style="margin-top:0">${body}</div>`);
  $('.azbar').addEventListener('click',e=>{const a=e.target.closest('a[data-l]'); if(!a)return; e.preventDefault(); const el=document.getElementById('defL-'+(a.dataset.l==='#'?'num':a.dataset.l)); if(el)el.scrollIntoView({block:'start'})});
}
async function loadStudy(){if(!STUDY)STUDY=await jget('study.json');return STUDY}
function renderDrugMatrix(){
  $('#main').innerHTML=`<div class="boot"><span class="spin"></span>Loading…</div>`;
  loadStudy().then(()=>{ if(curSeg!=='drugs')return; const dr=STUDY.drugs;
    const amt=(cell,plants)=>{ if(!cell)return '—'; const v=String(cell.amt||''); return esc(/^[\d.]+$/.test(v)&&!plants?v+' g':v) };
    const table=(cols,rows,first,plants)=>{ if(!rows||!rows.length)return '';
      const head=`<tr><th>${first}</th>`+cols.map(c=>`<th><a href="#/a/mda${c.g?'/'+c.g:''}">${esc(c.label)}</a><small>${esc(c.desc)}</small></th>`).join('')+`</tr>`;
      const trs=rows.map(r=>`<tr><td>${esc(r.name)}</td>`+cols.map(c=>{const cell=r.cells&&r.cells[c.k];return `<td class="num">${cell?`<a href="${secHref('mda',cell.id,cell.t)}" title="${esc(c.label)} item ${esc(cell.item||'')}: ${esc(cell.t)}">${amt(cell,plants)}</a>`:'—'}</td>`}).join('')+`</tr>`).join('');
      return `<div class="matwrap fade"><table>${head}${trs}</table></div>`; };
    const heads=[...new Set((dr.cols||[]).map(c=>c.head).filter(Boolean))];
    page(`<a class="r-back fade" href="#/study">${ic('back','currentColor')} Study</a>
      <div class="r-band fade" style="--h:#fec846;--hi:#946a00"><div class="act">Misuse of Drugs Act 1981</div><div class="stt">Drug quantity matrix</div><div class="bandmeta">Read from the Schedules as at ${esc(dr.asat||'')}</div></div>
      <p class="sub-note fade">Threshold amounts, straight from the Schedule tables. Tap an amount to open its Schedule at that item. “—” means the Schedule has no entry under that name.${heads.length?` The Schedules head the column “${esc(heads[0])}”.`:''}</p>
      ${table(dr.cols||[],dr.rows||[],'Drug',false)}
      ${(dr.prows&&dr.prows.length)?`<div class="cite-h">Plants (number of plants)</div>`+table(dr.pcols||[],dr.prows,'Plant',true):''}`);
  }).catch(()=>page(`<p class="empty">Couldn’t load the matrix.</p>`));
}

/* ---------- ABOUT: where the text comes from, and how current it is ---------- */
function renderAbout(){
  const row=s=>`<div class="srow"><span class="dot" style="background:${s.hue}"></span><a class="sn2" href="#/a/${s.id}">${esc(s.name)}</a><span class="sv">${s.comp?('as at '+esc(s.comp)):''}${s.pco?`<small>${esc(s.pco)}</small>`:''}</span>${s.url?`<a class="sx" href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="Official page for ${esc(s.name)}">${ic('ext','currentColor')}</a>`:'<span class="sx"></span>'}</div>`;
  const official=REG.sources.filter(s=>s.official), other=REG.sources.filter(s=>!s.official);
  const checked=official.map(s=>s.checked).filter(Boolean).sort().pop();
  page(`<h1 class="h-title fade">Sources &amp; currency</h1>
    <p class="sub-note fade">Every Act here is built from the <b>official Word version</b> published by the Parliamentary Counsel’s Office (legislation.wa.gov.au), or the Federal Register of Legislation for Commonwealth law. Nothing is retyped. Each build then cross-checks the text against the official PDF both ways: every paragraph shown has to be found in the PDF, and the PDF is walked for anything the app doesn’t have. The build fails if either check does.</p>
    <div class="about-k fade"><div><b>${official.length}</b><span>official sources</span></div><div><b>${REG.counts.provisions.toLocaleString()}</b><span>provisions</span></div><div><b>${esc(dmy(checked))}</b><span>last checked for newer versions</span></div><div><b>${esc(REG.builtDisp||'')}</b><span>built</span></div></div>
    <div class="cite-h">Legislation — version in this app</div><div class="stable fade">${official.map(row).join('')}</div>
    <div class="cite-h">Doctrine &amp; reference (not legislation)</div><div class="stable fade">${other.map(row).join('')}</div>
    <div class="cite-h">Offline copy</div><div class="fade" id="offl"><p class="sub-note">Checking…</p></div>
    <p class="sub-note fade" style="margin-top:22px">Legislation changes. “As at” is the date the version shown came into force; an Act may have been amended since the last check. For court or anything formal, confirm against the official site.</p>`);
  swStatus().then(st=>{const el=$('#offl'); if(!el)return;
    el.innerHTML=st?`<p class="sub-note">${st.cached>=st.total?`${ic('check','currentColor')} All ${st.total} files are saved on this device — the whole library works with no signal.`:`Saving for offline use: ${st.cached} of ${st.total} files so far. Keep the app open on a good connection.`}</p>`
      :`<p class="sub-note">Offline storage isn’t active in this browser yet. Open the app once on a good connection (or add it to your home screen) and it saves itself.</p>`;
    const svg=$('#offl svg'); if(svg){svg.style.cssText='display:inline-block;width:15px;height:15px;vertical-align:-2px;margin-right:4px'} });
}

/* ---------- SIDEBAR (browse panel) ---------- */
let _sbSig='';
function renderSidebar(force){
  $$('.sb-switch button').forEach(b=>{const on=b.dataset.mode===sbMode;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  const tEl=$('#sbTitle'); if(tEl)tEl.textContent={acts:'Law Library',offences:'Offence Library',topics:'Topics',terms:'Defined Terms'}[sbMode]||'Browse';
  const body=$('#sbBody'); if(!body)return;
  const sig=[sbMode,accAct,actCache.has(accAct),[...accParts].join(','),offView,[...accOff].join(','),[...accDoms].join(',')].join('|');
  if(force||sig!==_sbSig){ _sbSig=sig;
    if(sbMode==='acts') sbActs(body); else if(sbMode==='offences') sbOffences(body); else if(sbMode==='topics') sbTopics(body); else sbTerms(body); }
  $$('.sb-sec.cur,.sb-acc.cur',body).forEach(e=>e.classList.remove('cur'));
  if(curAct){ const h=body.querySelector(`.sb-acc[data-act="${curAct}"]`); if(h)h.classList.add('cur'); }
  if(curAct&&curSec){ const el=body.querySelector(`.sb-sec[data-k="${CSS.escape(curAct+'|'+curSec)}"]`); if(el)el.classList.add('cur'); }
}
/* keep the open Act's header in view in the panel (it may sit far down the list of 52 sources) */
function revealAct(){ const b=$('#sbBody'), h=b&&b.querySelector('.sb-acc.open[data-act]'); if(!h)return;
  const top=h.offsetTop-b.offsetTop; if(top<b.scrollTop||top>b.scrollTop+b.clientHeight*0.4)b.scrollTop=Math.max(0,top-4); }
function revealCur(){ const cur=$('#sbBody .sb-sec.cur'); if(cur){const b=$('#sbBody'), r=cur.getBoundingClientRect(), br=b.getBoundingClientRect(); if(r.top<br.top+40||r.bottom>br.bottom-20)cur.scrollIntoView({block:'center'});} }
const chev=`<span class="cv">${ic('chev','currentColor')}</span>`;
function secRow(a,s){return `<a class="sb-sec" data-k="${esc(a.id+'|'+s.id)}" href="${secHref(a.id,s.id)}"><span class="n">${esc(badge(s))}</span><span class="t">${esc(s.t)}</span></a>`}
/* ---- ACTS: nested accordion (Act → Part/Chapter → Section) ---- */
function actTreeHtml(a,d){
  const nodes=(d.tree&&d.tree.length)?d.tree:[{label:'',title:a.short,items:d.sections.map(s=>({k:'sec',id:s.id}))}];
  return nodes.map((node,i)=>{
    const key=a.id+'#'+i, open=accParts.has(key);
    const ttl=esc(node.title||node.label||('Part '+(i+1)));
    const lbl=`${node.label&&node.title&&node.label!==node.title?`<b>${esc(node.label)}</b> `:''}${ttl}`;
    const head=`<button class="sb-part${open?' open':''}" data-part="${key}" aria-expanded="${open}">${chev}<span class="pl">${lbl}</span></button>`;
    let secs='';
    if(open){
      const rows=[];
      for(const it of (node.items||[])){
        if(it.k==='lbl') rows.push(`<div class="sb-lbl">${esc(it.t)}</div>`);
        else if(it.k==='sec'){const s=d._byId[it.id]; if(s)rows.push(secRow(a,s));}
        else if(it.k==='ch'){const c=d._ch[it.id]; if(c)rows.push(`<div class="sb-chh">${esc(c.title||c.label)}</div>`);}
      }
      secs=`<div class="sb-secs">${rows.join('')||'<div class="sb-lbl">—</div>'}</div>`;
    }
    return head+secs;
  }).join('');
}
function srcRow(a){
  const open=accAct===a.id, d=actCache.get(a.id);
  const head=`<button class="sb-acc${open?' open':''}" data-act="${a.id}" aria-expanded="${open}"><span class="dot" style="background:${a.hue}"></span><span class="nm">${esc(a.short)}</span>${open?'':`<span class="ab">${esc(a.abbr)}</span>`}${chev}</button>`;
  let inner='';
  if(open) inner=`<div class="sb-acc-body">`+(d?actTreeHtml(a,d):`<div class="sb-loading"><span class="spin"></span></div>`)+`</div>`;
  return head+inner;
}
function sbActs(body){
  const grp=(label,cat)=>{const xs=REG.sources.filter(s=>s.cat===cat);if(!xs.length)return'';return `<div class="sb-grp">${label} <span>${xs.length}</span></div>`+xs.map(srcRow).join('')};
  body.innerHTML=grp('Acts &amp; Codes','act')+grp('Doctrine','doc')+grp('Reference','ref');
}
/* ---- OFFENCES library ---- */
function offRow(o){return `<a class="sb-sec offrow" data-k="${esc(o.a+'|'+o.id)}" href="${secHref(o.a,o.id)}"><span class="t">${esc(o.t)}</span><span class="src">${esc(SRC[o.a].abbr)}${o.num?(' '+esc(o.num)):''}</span></a>`}
function sbOffences(body){
  const sub=`<div class="sb-sub2">${[['type','Type'],['act','Act'],['az','A–Z']].map(([k,l])=>`<button data-offv="${k}" class="${offView===k?'on':''}" aria-pressed="${offView===k}">${l}</button>`).join('')}</div>`;
  let inner='';
  if(offView==='type'){
    inner=OFF.types.map(ty=>{
      const k='t:'+ty.id, open=accOff.has(k);
      const head=`<button class="sb-acc${open?' open':''}" data-off="${k}" aria-expanded="${open}"><span class="oi">${ic(ty.icon,'currentColor')}</span><span class="nm">${esc(ty.label)}</span><span class="ab">${ty.n}</span>${chev}</button>`;
      return head+(open?`<div class="sb-acc-body"><div class="sb-secs">`+OFF.offences.filter(o=>o.type===ty.id).map(offRow).join('')+`</div></div>`:'');
    }).join('');
  } else if(offView==='act'){
    inner=acts().filter(a=>OFF.offences.some(o=>o.a===a.id)).map(a=>{
      const k='a:'+a.id, open=accOff.has(k), n=OFF.offences.filter(o=>o.a===a.id).length;
      const head=`<button class="sb-acc${open?' open':''}" data-off="${k}" aria-expanded="${open}"><span class="dot" style="background:${a.hue}"></span><span class="nm">${esc(a.short)}</span><span class="ab">${n}</span>${chev}</button>`;
      return head+(open?`<div class="sb-acc-body"><div class="sb-secs">`+OFF.offences.filter(o=>o.a===a.id).map(offRow).join('')+`</div></div>`:'');
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
/* ---- TERMS (A–Z glossary; one row per term, the Acts that define it alongside) ---- */
function sbTerms(body){
  const by=new Map(); DEFS.forEach(d=>{const k=d.t.toLowerCase(); if(!by.has(k))by.set(k,[]); by.get(k).push(d)});
  const byL={}; [...by.values()].forEach(arr=>{const c=(arr[0].t[0]||'#').toUpperCase(), L=/[A-Z]/.test(c)?c:'#';(byL[L]=byL[L]||[]).push(arr)});
  const letters=Object.keys(byL).sort();
  const az=`<div class="sb-az">`+letters.map(L=>`<button class="azl" data-l="${L}">${L}</button>`).join('')+`</div>`;
  body.innerHTML=az+letters.map(L=>`<div class="sb-letter" id="sbL-${L}">${L}</div>`+byL[L].sort((a,b)=>a[0].t.localeCompare(b[0].t)).map(arr=>{const d=arr[0], n=new Set(arr.map(x=>x.a)).size;
    return `<a class="sb-term" href="${arr.length>1?'#/search/'+encodeURIComponent('"'+d.t+'"'):secHref(d.a,d.s,d.t)}"><span class="tdot" style="background:${hue(d.a)}"></span><span class="ttx">${esc(d.t)}</span><span class="src">${arr.length>1?(n>1?n+' Acts':arr.length+'×'):esc(SRC[d.a].abbr)+' '+esc(d.num)}</span></a>`}).join('')).join('');
}
function sbSwitch(m){ _keepDrawer=true; navigate(m==='acts'?'/browse':m==='offences'?'/offences':m==='topics'?'/topics':'/defs'); }
/* accordion toggles via delegation on #sbBody */
function sbBodyClick(e){
  const az=e.target.closest('.azl'); if(az){e.preventDefault();const el=document.getElementById('sbL-'+az.dataset.l);if(el)el.scrollIntoView({block:'start'});return;}
  const ov=e.target.closest('[data-offv]'); if(ov){e.preventDefault();offView=ov.dataset.offv;ls.set('offView',offView);renderSidebar();return;}
  const ac=e.target.closest('.sb-acc[data-act]'); if(ac){e.preventDefault();const id=ac.dataset.act;
    if(accAct===id){accAct=null;renderSidebar();} else {accAct=id;renderSidebar();
      const h=$(`.sb-acc[data-act="${id}"]`); if(h)h.scrollIntoView({block:'nearest'});
      _keepDrawer=true; navigate('/a/'+id);} return;}
  const pt=e.target.closest('.sb-part'); if(pt){e.preventDefault();const k=pt.dataset.part;accParts.has(k)?accParts.delete(k):accParts.add(k);renderSidebar();
    const node=$(`.sb-part[data-part="${k}"]`); if(node)node.scrollIntoView({block:'nearest'});return;}
  const og=e.target.closest('.sb-acc[data-off]'); if(og){e.preventDefault();const k=og.dataset.off;accOff.has(k)?accOff.delete(k):accOff.add(k);renderSidebar();return;}
  const dm=e.target.closest('.sb-acc[data-dom]'); if(dm){e.preventDefault();const i=+dm.dataset.dom;accDoms.has(i)?accDoms.delete(i):accDoms.add(i);renderSidebar();return;}
}
/* when a provision is read, make sure the Part that holds it is open in the panel */
function openPartFor(aid,d,sid){
  const nodes=(d.tree&&d.tree.length)?d.tree:[];
  for(let i=0;i<nodes.length;i++){ const n=nodes[i];
    if((n.items||[]).some(it=>it.k==='sec'&&it.id===sid)){ accParts.add(aid+'#'+i); return; } }
  if(!nodes.length)accParts.add(aid+'#0');
}

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
  revealCur();
  const f=s.querySelector('.sb-srch,button,a[href]'); if(f)setTimeout(()=>f.focus({preventScroll:true}),20); }
function closeDrawer(){const s=$('#sidebar'); if(s){s.classList.remove('open'); s.removeAttribute('role'); s.removeAttribute('aria-modal');}
  const sc=$('#sbScrim'); if(sc)sc.classList.remove('on'); document.body.classList.remove('drawer-open');
  document.removeEventListener('keydown',trapTab); const mb=$('#menuBtn'); if(mb)mb.setAttribute('aria-expanded','false');
  if(_drawerOpen&&_lastFocus&&_lastFocus.focus){try{_lastFocus.focus({preventScroll:true})}catch(e){}} _drawerOpen=false; }
function paintThemeBtn(){const dark=document.documentElement.dataset.theme==='dark';const b=$('#themeBtn');if(b){b.innerHTML=ic(dark?'sun':'moon','currentColor');const lab=dark?'Switch to light theme':'Switch to dark theme';b.setAttribute('aria-label',lab);b.title=lab;b.setAttribute('aria-pressed',String(dark));}
  let tc=$('meta[name="theme-color"][data-dyn]'); if(!tc){tc=document.createElement('meta');tc.name='theme-color';tc.setAttribute('data-dyn','');document.head.appendChild(tc);} tc.content=dark?'#0c0d12':'#eef2f8';}
function toggleTheme(){const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';ls.set('theme',r.dataset.theme);paintThemeBtn()}
function applySize(){const z=ls.get('size',1);$('#main').style.fontSize=z+'em'}
function cycleSize(){let z=ls.get('size',1);z=z>=1.18?.9:Math.round((z+.08)*100)/100;ls.set('size',z);applySize();toast('Text size '+Math.round(z*100)+'%')}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),1900)}

/* ---------- PWA: install, offline copy, updates ---------- */
let deferredPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=$('#installBtn');if(b){b.hidden=false;b.onclick=async()=>{b.hidden=true;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null}}});
function swStatus(){ return new Promise(res=>{ const c=navigator.serviceWorker&&navigator.serviceWorker.controller; if(!c)return res(null);
  const ch=new MessageChannel(); const to=setTimeout(()=>res(null),2500); ch.port1.onmessage=e=>{clearTimeout(to);res(e.data||null)}; try{c.postMessage({type:'STATUS'},[ch.port2])}catch(e){clearTimeout(to);res(null)} }); }
function offlineProgress(done,total){ const bar=$('#loadbar'); if(!bar)return; bar.hidden=false; bar.style.width=Math.max(4,Math.round(done/total*100))+'%';
  if(done>=total){ setTimeout(()=>{bar.style.opacity='0';setTimeout(()=>{bar.hidden=true;bar.style.opacity='';bar.style.width='0'},400)},500); } }
function showUpdate(apply){ const u=$('#upd'); if(!u)return; u.innerHTML=`<span>Updated law is ready.</span><button id="updGo">Reload</button><button id="updX" aria-label="Later">${ic('x','currentColor')}</button>`; u.hidden=false;
  $('#updGo').onclick=()=>{u.hidden=true;apply()}; $('#updX').onclick=()=>{u.hidden=true}; }
if('serviceWorker'in navigator){ addEventListener('load',async()=>{
  try{
    const had=!!navigator.serviceWorker.controller, t0=Date.now();
    const reg=await navigator.serviceWorker.register('./sw.js');
    const activate=w=>{try{w.postMessage({type:'SKIP_WAITING'})}catch(e){}};
    /* an update that finished downloading: if the app only just opened, switch straight over; otherwise ask */
    const ready=w=>{ if(!had)return; if(Date.now()-t0<4000&&!curSec&&window.scrollY<40)activate(w); else showUpdate(()=>activate(w)); };
    if(reg.waiting)ready(reg.waiting);
    reg.addEventListener('updatefound',()=>{const w=reg.installing; if(!w)return; w.addEventListener('statechange',()=>{ if(w.state==='installed'&&navigator.serviceWorker.controller)ready(w); });});
    let reloading=false; navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(!had||reloading)return; reloading=true; location.reload(); });
    navigator.serviceWorker.addEventListener('message',e=>{ const m=e.data||{};
      if(m.type==='PROGRESS')offlineProgress(m.done,m.total);
      if(m.type==='READY'){ offlineProgress(1,1); if(m.first){toast('Saved for offline use'); if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});} }
      if(m.type==='FAILED'){ const b=$('#loadbar'); if(b)b.hidden=true; } });
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible')reg.update().catch(()=>{}); });
  }catch(e){}
}); }

/* test hook — only when the page is opened with ?qa (the build's browser tests use it to sweep every provision) */
if(/[?&]qa\b/.test(location.search)) window.__wal={loadAct,termsFor,markTerms,markHits,parseQ,searchAct,wireXrefs,get SRC(){return SRC},get REG(){return REG},get SCAF(){return SCAF}};

boot();
})();
