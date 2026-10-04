import React, {useEffect, useMemo, useRef, useState} from 'react';
import Numogram from './Numogram.jsx';
import Sky from './Sky.jsx';
import model from './model.cjs';
import archive from '../data/archive.json';
import catalog from '../data/sky-catalog.json';
const {MONTHS,THEMES,SEASONS,KIND,eventYear,filterEvents,validateNotes}=model;
export const LINKS=[[6,3],[3,2],[2,7],[7,1],[1,5],[5,4],[4,1],[1,8],[8,9],[9,0],[0,9],[5,7],[8,7]];
export const DEFAULT_STATE={year:2026,season:'autumn',month:0,view:'periods',theme:'',kind:'',search:''};
export function parseState(hash='') {
 const p=new URLSearchParams(hash.replace(/^#/,'')),s={...DEFAULT_STATE};
 if(['2026','2027'].includes(p.get('year')))s.year=Number(p.get('year'));
 if(Object.hasOwn(SEASONS,p.get('season')))s.season=p.get('season');
 if(['general','periods'].includes(p.get('view')))s.view=p.get('view');
 const m=Number(p.get('month'));if(SEASONS[s.season].months.includes(m))s.month=m;
 if(THEMES.some(t=>t.id===p.get('theme'))&&p.get('theme')!=='all')s.theme=p.get('theme');
 if(Object.hasOwn(KIND,p.get('kind')))s.kind=p.get('kind');
 s.search=(p.get('search')||'').slice(0,300);return s;
}
export function stateHash(state) {const p=new URLSearchParams();for(const [k,v] of Object.entries(state))if(v!==''&&v!==0)p.set(k,String(v));return `#${p}`;}
export function noteKey(s) {return `${s.year}:${s.season}:${s.month}`;}
export function readNotes(storage) {try{const value=JSON.parse(storage.getItem('astro-archive-notes-v1')||'{}');return validateNotes({format:'astro-archive-notes',version:1,notes:value})?value:{};}catch{return {};}}
export function periodLabel(s) {if(s.year===2027)return '27';if(s.view==='general')return '∞';if(s.month)return String(s.month).padStart(2,'0');const ms=SEASONS[s.season].months;return `${String(ms[0]).padStart(2,'0')}—${String(ms.at(-1)).padStart(2,'0')}${s.season==='prologue'?' / 25':''}`;}
export function Icon({name}) {
 const paths={filters:'M4 7h16M4 17h16M9 4v6M15 14v6',notes:'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',source:'M7 17 17 7M7 7h10v10',close:'M6 6l12 12M18 6 6 18',reset:'M5 9a8 8 0 1 1-1 7M5 3v6h6',check:'M5 12l4 4L19 6'};
 return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]||paths.close}/></svg>;
}
function Modal({label,children,onClose}) {
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement;const d=ref.current;d.showModal();return()=>{d.close();previous?.focus?.();};},[]);
 return <dialog ref={ref} className="archive-dialog" aria-label={label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <button className="dialog-close icon-button" type="button" aria-label="Закрыть" onClick={onClose}><Icon name="close"/></button>{children}
 </dialog>;
}
export function Filters({state,update,onReset}) {
 const disabled=state.year===2027||state.view==='general';
 const pickMonth=m=>update({month:state.month===m?0:m,...(state.season!=='prologue'&&!SEASONS[state.season].months.includes(m)?{season:'all'}:{})});
 const months=state.season==='prologue'?[11,12]:Array.from({length:12},(_,i)=>i+1);
 return <section id="filters-panel" className="filters-popover" aria-label="Фильтры">
  <div className="period-picker" role="group" aria-label="Сезон">{Object.entries(SEASONS).map(([id,s])=><button type="button" key={id} data-season={id} className={state.season===id?'is-selected':''} aria-pressed={state.season===id} disabled={disabled} onClick={()=>update({season:id,month:0})}>{id==='prologue'?'11—12 / 25':s.name}</button>)}</div>
  <div className="view-switch" role="group" aria-label="Тип прогноза">{[['periods','Периоды'],['general','Общие']].map(([id,name])=><button type="button" key={id} data-view={id} className={state.view===id?'is-selected':''} aria-pressed={state.view===id} onClick={()=>update({view:id,month:0})}>{name}</button>)}</div>
  <div className="filter-grid">
   <label><span className="sr-only">Месяц</span><select id="month-filter" aria-label="Месяц" value={state.month||''} disabled={disabled} onChange={e=>update({month:Number(e.target.value)})}><option value="">Месяц</option>{SEASONS[state.season].months.map(m=><option key={m} value={m}>{MONTHS[m-1]}</option>)}</select></label>
   <label><span className="sr-only">Тема</span><select id="theme-filter" aria-label="Тема" value={state.theme} onChange={e=>update({theme:e.target.value})}><option value="">Тема</option>{THEMES.filter(t=>t.id!=='all').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label><span className="sr-only">Характер</span><select id="kind-filter" aria-label="Характер" value={state.kind} onChange={e=>update({kind:e.target.value})}><option value="">Характер</option>{Object.entries(KIND).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label className="search-field"><span className="sr-only">Поиск</span><input id="search-input" aria-label="Поиск" type="search" maxLength={300} placeholder="Поиск" value={state.search} onChange={e=>update({search:e.target.value})}/></label>
   <button className="reset-button icon-button" type="button" aria-label="Сбросить фильтры" onClick={onReset}><Icon name="reset"/></button>
  </div>
  <div className="month-timeline" role="group" aria-label="Месяцы">{months.map(m=>{const y=state.season==='prologue'?2025:2026;const has=archive.events.some(e=>e.precision!=='general'&&e.months.includes(m)&&eventYear(e,m)===y);return <button key={m} type="button" data-month={m} className={state.month===m?'is-active':''} aria-pressed={state.month===m} aria-label={`${MONTHS[m-1]} ${y}`} disabled={disabled||!has} onClick={()=>pickMonth(m)}>{String(m).padStart(2,'0')}</button>;})}</div>
 </section>;
}
export function Forecast({state,onSource}) {
 const filtered=useMemo(()=>filterEvents(archive.events,state).sort((a,b)=>{
 const y=state.season==='prologue'?2025:2026,am=a.months.filter(m=>eventYear(a,m)===y),bm=b.months.filter(m=>eventYear(b,m)===y);
 return (am.length?Math.min(...am):0)-(bm.length?Math.min(...bm):0)||a.id.localeCompare(b.id);}),[state]);
 return <section className="dossier-panel" aria-label="Прогноз">
  <span className="sr-only" role="status">{filtered.length} записей</span>
  {state.year===2027?<p className="next-year-panel">2027 · новый прогноз ожидается 3 ноября.</p>:<>
   <div id="events-list" className="events-list" tabIndex={-1}>{filtered.map(e=><article key={e.id} data-event={e.id} className={`event-entry kind-${e.kind}`} aria-label={e.title}>
    <div className="event-meta"><span className="event-marker" aria-label={KIND[e.kind]} role="img"/><span className="event-timing">{e.timingLabel}</span></div>
    <p className="event-summary">{e.summary}</p>
    <div className="event-foot"><button type="button" className="source-button icon-button" aria-label={`Источник: ${e.title}`} onClick={()=>onSource(e)}><Icon name="source"/></button></div>
   </article>)}</div>
   {!filtered.length&&<p className="empty-state">Для этого периода записей нет.</p>}
  </>}
 </section>;
}
function Notes({state,notes,onChange,onClose,storageAvailable}) {
 const key=noteKey(state),[draft,setDraft]=useState(notes[key]||''),[status,setStatus]=useState(storageAvailable?'':'Хранилище недоступно. Скачайте копию заметок.'),fileRef=useRef(null);
 const save=text=>{const n={...notes};if(text.trim())n[key]=text.trim();else delete n[key];const success=onChange(n);setStatus(success?'Сохранено.':'Сохранено до закрытия страницы. Скачайте копию.');};
 const exportNotes=()=>{const next={...notes};if(draft.trim())next[key]=draft.trim();else delete next[key];const url=URL.createObjectURL(new Blob([JSON.stringify({format:'astro-archive-notes',version:1,notes:next},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='astro-archive-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Копия скачана.');};
 const importNotes=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>4000000)throw Error('size');const data=JSON.parse(await file.text());if(!validateNotes(data))throw Error('format');const next={...notes,...data.notes};const saved=onChange(next);setDraft(next[key]||'');setStatus(saved?'Загружено.':'Загружено до закрытия страницы. Скачайте копию.');}catch{setStatus('Нужна JSON-копия заметок из приложения.');}e.target.value='';};
 return <Modal label="Заметки" onClose={onClose}><label className="sr-only" htmlFor="note-input">Заметка</label><textarea id="note-input" className="note-input" rows={8} maxLength={12000} value={draft} onChange={e=>setDraft(e.target.value)}/><div className="dialog-actions"><button type="button" onClick={()=>save(draft)}>Сохранить</button><button type="button" onClick={()=>{setDraft('');save('');}}>Очистить</button></div><p className="dialog-note" role="status">{status}</p><div className="dialog-actions"><button type="button" onClick={exportNotes}>Скачать</button><button type="button" onClick={()=>fileRef.current.click()}>Загрузить</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importNotes}/></div></Modal>;
}
export default function App() {
 const [state,setState]=useState(DEFAULT_STATE),[ready,setReady]=useState(false),[filtersOpen,setFiltersOpen]=useState(false),[source,setSource]=useState(null),[notesOpen,setNotesOpen]=useState(false),[notes,setNotes]=useState({}),[storageAvailable,setStorageAvailable]=useState(true),filterRef=useRef(null);
 useEffect(()=>{setState(parseState(window.location.hash));try{setNotes(readNotes(window.localStorage));}catch{setStorageAvailable(false);}setReady(true);const onHash=()=>setState(parseState(window.location.hash));window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash);},[]);
 useEffect(()=>{if(ready){try{window.history.replaceState(null,'',stateHash(state));}catch{}}},[state,ready]);
 useEffect(()=>{if(!filtersOpen)return;const close=e=>{if(filterRef.current&&!filterRef.current.contains(e.target))setFiltersOpen(false);};const esc=e=>{if(e.key==='Escape')setFiltersOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',esc);};},[filtersOpen]);
 const update=patch=>setState(s=>({...s,...patch}));
 const counts=useMemo(()=>{const all=filterEvents(archive.events,state,true);return Object.fromEntries(THEMES.map(t=>[t.id,t.id==='all'?all.length:all.filter(e=>e.theme===t.id).length]));},[state]);
 const saveNotes=value=>{setNotes(value);try{window.localStorage.setItem('astro-archive-notes-v1',JSON.stringify(value));setStorageAvailable(true);return true;}catch{setStorageAvailable(false);return false;}};
 return <><Sky catalog={catalog}/><a className="skip-link" href="#events-list">К прогнозу</a><main className="archive-shell">
  <header className="archive-header"><div className="year-switch" role="group" aria-label="Год">{[2026,2027].map(y=><button key={y} data-year={y} className={state.year===y?'is-selected':''} type="button" aria-pressed={state.year===y} aria-label={String(y)} onClick={()=>update({year:y})}>{String(y).slice(-2)}</button>)}</div>
   {state.year===2026&&<span className="active-period" aria-label={state.view==='general'?'Общие темы':state.month?MONTHS[state.month-1]:SEASONS[state.season].name}>{periodLabel(state)}</span>}
   <div className="header-actions"><div ref={filterRef} className="filter-control"><button className={`filter-toggle icon-button${filtersOpen?' is-active':''}`} type="button" aria-label="Фильтры" aria-expanded={filtersOpen} aria-controls="filters-panel" onClick={()=>setFiltersOpen(v=>!v)}><Icon name="filters"/></button>{filtersOpen&&<Filters state={state} update={update} onReset={()=>update({theme:'',kind:'',search:'',month:0})}/>}</div><button type="button" className={`notes-button icon-button${notes[noteKey(state)]?' has-note':''}`} aria-label="Заметки" onClick={()=>setNotesOpen(true)}><Icon name="notes"/></button></div>
  </header>
  <div className="archive-grid"><aside className="map-panel" aria-label="Сфера жизненных тем"><Numogram themes={THEMES} links={LINKS} selectedTheme={state.theme} onSelect={theme=>update({theme})} counts={counts}/></aside><Forecast state={state} onSource={setSource}/></div>
 </main>{source&&<Modal label={source.title} onClose={()=>setSource(null)}><p className="source-meta">{archive.sources.find(s=>s.id===source.source.id)?.file} · {source.source.paragraphs.join(', ')} · {source.timingLabel}</p><blockquote>{source.source.quote}</blockquote>{(source.timingNote||source.caution)&&<p className="dialog-caution">{source.timingNote||source.caution}</p>}</Modal>}{notesOpen&&<Notes state={state} notes={notes} storageAvailable={storageAvailable} onChange={saveNotes} onClose={()=>setNotesOpen(false)}/>}</>;
}
