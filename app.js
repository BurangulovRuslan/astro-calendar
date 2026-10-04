(function () {
  'use strict';
  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const THEMES = [
    {id:'self', number:0, name:'Внутренний мир', x:420, y:700},
    {id:'work', number:1, name:'Работа', x:350, y:500},
    {id:'study', number:2, name:'Учёба и документы', x:490, y:270},
    {id:'relationships', number:3, name:'Отношения', x:390, y:165},
    {id:'body', number:4, name:'Тело и самочувствие', x:180, y:410},
    {id:'family', number:5, name:'Дом и семья', x:240, y:300},
    {id:'friends', number:6, name:'Друзья и сообщества', x:270, y:130},
    {id:'money', number:7, name:'Деньги', x:535, y:365},
    {id:'travel', number:8, name:'Поездки', x:405, y:605},
    {id:'all', number:9, name:'Все темы', x:290, y:660}
  ];
  const SEASONS = {
    all:{name:'Весь цикл', code:'00 / TIME CIRCUIT', months:[1,2,3,4,5,6,7,8,9,10,11,12]},
    winter:{name:'Зима', code:'01 / WINTER', months:[1,2]},
    spring:{name:'Весна', code:'02 / SPRING', months:[3,4,5]},
    summer:{name:'Лето', code:'03 / SUMMER', months:[6,7,8]},
    autumn:{name:'Осень', code:'04 / AUTUMN', months:[9,10,11]},
    prologue:{name:'Пролог · ноябрь — декабрь 2025', code:'05 / PRELUDE', months:[11,12]}
  };
  const KIND = {challenge:'Трудность', strength:'Сильная сторона', mixed:'Смешанная тема'};
  function eventYear(event, month) {
    return event.monthYears?.[month] || (event.source.id === 's3' && month >= 11 ? 2025 : 2026);
  }
  function matchesPeriod(event, state) {
    if (state.year !== 2026) return false;
    if (state.view === 'general') return event.precision === 'general';
    if (event.precision === 'general') return false;
    const months = state.month ? [state.month] : SEASONS[state.season].months;
    const year = state.season === 'prologue' ? 2025 : 2026;
    return event.months.some(m => months.includes(m) && eventYear(event,m) === year);
  }
  function filterEvents(events, state, ignoreTheme = false) {
    const query = (state.search || '').trim().toLocaleLowerCase('ru');
    return events.filter(e => matchesPeriod(e,state)
      && (ignoreTheme || !state.theme || state.theme === 'all' || e.theme === state.theme)
      && (!state.kind || e.kind === state.kind)
      && (!query || [e.title,e.summary,e.timingLabel, THEMES.find(t=>t.id===e.theme)?.name].join(' ').toLocaleLowerCase('ru').includes(query)));
  }
  function validateNotes(value) {
    if (!value || value.format !== 'astro-archive-notes' || value.version !== 1 || !value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes)) return false;
    return Object.entries(value.notes).length <= 300 && Object.entries(value.notes).every(([key,text]) => /^20\d{2}:(all|winter|spring|summer|autumn|prologue):([0-9]|1[0-2])$/.test(key) && typeof text === 'string' && text.length <= 12000);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {MONTHS,THEMES,SEASONS,eventYear,matchesPeriod,filterEvents,validateNotes};
  if (typeof document === 'undefined') return;
  const archive = window.ASTRO_ARCHIVE;
  const $ = id => document.getElementById(id);
  const state = {year:2026, season:'autumn', month:0, view:'periods', theme:'', kind:'', search:''};
  const events = archive.events;
  let notes = {};
  let storageAvailable = true;
  try {notes=JSON.parse(localStorage.getItem('astro-archive-notes-v1') || '{}'); if(!notes || typeof notes!=='object' || Array.isArray(notes)) notes={};} catch {storageAvailable=false;}
  const el = (tag, className, text) => {const n=document.createElement(tag); if(className)n.className=className; if(text!==undefined)n.textContent=text; return n;};
  const svgEl = (tag, attrs) => {const n=document.createElementNS('http://www.w3.org/2000/svg',tag); for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v)); return n;};
  const noteKey = () => `${state.year}:${state.season}:${state.month}`;
  function noteStatus(message) { $('note-status').textContent=message; }
  function writeNotes() {
    try {localStorage.setItem('astro-archive-notes-v1',JSON.stringify(notes));storageAvailable=true;return true;}
    catch {storageAvailable=false;return false;}
  }
  function saveCurrentNote() {
    const text=$('note-input').value.trim(); if(text) notes[noteKey()]=text; else delete notes[noteKey()];
    noteStatus(writeNotes() ? 'Запись сохранена в этом браузере.' : 'Запись хранится только до закрытия страницы. Скачай копию заметок.');
    $('notes-open').textContent=notes[noteKey()] ? 'Моя запись ●' : 'Моя запись +';
  }
  function openSource(event) {
    const source=archive.sources.find(s=>s.id===event.source.id);
    $('source-title').textContent=event.title;
    $('source-meta').textContent=`${source.file} · абзац${event.source.paragraphs.length>1?'ы':''} ${event.source.paragraphs.join(', ')} · ${event.timingLabel}`;
    $('source-quote').textContent=event.source.quote;
    $('source-caution').textContent=event.caution || 'Фрагмент транскрипта сохранён без исправления ошибок распознавания. Тезис передаёт интерпретацию автора записи.';
    $('source-dialog').showModal();
  }
  function drawMap() {
    const group=$('map-nodes');
    for (const theme of THEMES) {
      const g=svgEl('g',{class:'map-node-group',transform:`translate(${theme.x} ${theme.y})`,role:'button',tabindex:0,'data-theme':theme.id,'aria-label':theme.name});
      g.append(svgEl('circle',{class:'node-hit-area',r:46}),svgEl('circle',{class:'node-orbit',r:38}), svgEl('circle',{class:'map-node',r:28}));
      const number=svgEl('text',{class:'node-number','text-anchor':'middle',y:8});number.textContent=theme.number;g.append(number);
      const anchor=theme.id==='friends'?'end':theme.x>400?'end':'start';
      const labelX=anchor==='end'?-43:43;
      const label=svgEl('text',{class:'node-label','text-anchor':anchor,x:labelX,y:-3});label.textContent=theme.name;g.append(label);
      const counter=svgEl('text',{class:'node-counter','text-anchor':anchor,x:labelX,y:15});g.append(counter);
      const activate=()=>{state.theme=theme.id==='all'?'':(state.theme===theme.id?'':theme.id);$('theme-filter').value=state.theme;render();};
      g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
      group.append(g);
    }
    const pairs=[[6,3],[3,2],[2,7],[7,1],[1,5],[5,4],[4,1],[1,8],[8,9],[9,0],[0,9],[5,7],[8,7]];
    for(const [a,b] of pairs){const A=THEMES[a],B=THEMES[b];const mx=(A.x+B.x)/2+(a>b?45:-45);$('map-edges').append(svgEl('path',{d:`M ${A.x} ${A.y} Q ${mx} ${(A.y+B.y)/2} ${B.x} ${B.y}`,class:'map-edge','data-a':A.id,'data-b':B.id}));}
  }
  function render() {
    const filtered=filterEvents(events,state);
    const counts=filterEvents(events,state,true);
    const summary=state.view==='general' ? archive.summaries.general : archive.summaries[state.season];
    $('active-period').textContent=state.view==='general'?'06 / YEAR BACKGROUND':SEASONS[state.season].code;
    $('period-title').textContent=state.year===2027?'Следующий цикл':state.view==='general'?'Общий фон года':state.month?`${MONTHS[state.month-1]} ${state.season==='prologue'?2025:2026}`:SEASONS[state.season].name;
    $('period-summary').textContent=state.year===2027?'Новая запись ожидается примерно 3 ноября 2026. До её добавления прогнозы этого цикла здесь не отображаются.':summary;
    $('results-count').textContent=state.year===2027?'ЗАПИСЬ НЕ ДОБАВЛЕНА':`${String(filtered.length).padStart(2,'0')} / ФРАГМЕНТОВ`;
    $('next-year-panel').hidden=state.year!==2027;
    $('empty-state').hidden=filtered.length>0 || state.year===2027;
    $('events-list').replaceChildren();
    const sorted=[...filtered].sort((a,b)=>{
      const am=a.months.filter(m=>eventYear(a,m)===(state.season==='prologue'?2025:2026));
      const bm=b.months.filter(m=>eventYear(b,m)===(state.season==='prologue'?2025:2026));
      return (Math.min(...am)||0)-(Math.min(...bm)||0) || a.id.localeCompare(b.id);
    });
    for(const event of sorted){
      const article=el('article',`event-entry kind-${event.kind}`);
      const meta=el('div','event-meta');meta.append(el('span','event-kind',KIND[event.kind]),el('span','event-timing',event.timingLabel));
      article.append(meta,el('h3','event-title',event.title),el('p','event-summary',event.summary));
      if(event.timingNote)article.append(el('p','event-caution',event.timingNote));
      const foot=el('div','event-foot');foot.append(el('span','event-theme',THEMES.find(t=>t.id===event.theme)?.name || event.theme));
      const button=el('button','source-button',`[ источник ${event.source.id.slice(1).padStart(2,'0')} ↗ ]`);button.type='button';button.addEventListener('click',()=>openSource(event));foot.append(button);article.append(foot);$('events-list').append(article);
    }
    document.querySelectorAll('[data-season]').forEach(b=>{const selected=b.dataset.season===state.season;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=state.view==='general'||state.year===2027;});
    document.querySelectorAll('[data-view]').forEach(b=>{const selected=b.dataset.view===state.view;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});
    $('month-filter').disabled=state.view==='general'||state.year===2027;
    $('month-filter').replaceChildren(new Option('Все месяцы периода',''));
    for(const month of SEASONS[state.season].months)$('month-filter').append(new Option(MONTHS[month-1],String(month)));
    $('month-filter').value=state.month?String(state.month):'';
    document.querySelectorAll('.map-node-group').forEach(g=>{
      const theme=g.dataset.theme, count=theme==='all'?counts.length:counts.filter(e=>e.theme===theme).length;
      const active=theme==='all'?!state.theme:state.theme===theme;
      g.classList.toggle('is-active',active);g.classList.toggle('is-empty',count===0);g.setAttribute('aria-pressed',String(active));
      g.setAttribute('aria-label',`${THEMES.find(t=>t.id===theme).name}, ${count} фрагментов`);g.querySelector('.node-counter').textContent=count?`${String(count).padStart(2,'0')} фрагм.`:'нет фрагментов';
    });
    document.querySelectorAll('.map-edge').forEach(e=>e.classList.toggle('is-active',Boolean(state.theme)&&(e.dataset.a===state.theme||e.dataset.b===state.theme)));
    $('map-caption').textContent=state.theme?`Зона ${THEMES.find(t=>t.id===state.theme).number} / ${THEMES.find(t=>t.id===state.theme).name}`:'Выбери зону, чтобы прочитать её темы';
    $('month-timeline').replaceChildren();
    const months=state.season==='prologue'?[11,12]:Array.from({length:12},(_,i)=>i+1);
    for(const month of months){
      const button=el('button','timeline-month');button.type='button';
      const year=state.season==='prologue'?2025:2026;
      const count=events.filter(e=>e.precision!=='general'&&e.months.includes(month)&&eventYear(e,month)===year).length;
      button.append(el('span','month-number',String(month).padStart(2,'0')),el('span','month-name',MONTHS[month-1]),el('span','month-count',count?`${count} фр.`:'нет записи'));
      button.disabled=state.year===2027||state.view==='general'||!count;
      button.title=count?`${MONTHS[month-1]} ${year}: ${count} фрагментов`:'Нет прогноза в текущей записи';
      button.classList.toggle('is-active',state.month===month);button.setAttribute('aria-pressed',String(state.month===month));
      button.addEventListener('click',()=>{state.month=state.month===month?0:month;if(state.season!=='prologue'&&!SEASONS[state.season].months.includes(month))state.season='all';render();});$('month-timeline').append(button);
    }
    $('notes-open').textContent=notes[noteKey()]?'Моя запись ●':'Моя запись +';
    const params=new URLSearchParams();for(const [key,value] of Object.entries(state))if(value!==''&&value!==0)params.set(key,String(value));
    try {history.replaceState(null,'',`#${params}`);} catch {}
  }
  function init(){
    const p=new URLSearchParams(location.hash.slice(1));
    if(['2026','2027'].includes(p.get('year')))state.year=Number(p.get('year'));
    if(Object.hasOwn(SEASONS,p.get('season')))state.season=p.get('season');
    if(['general','periods'].includes(p.get('view')))state.view=p.get('view');
    const month=Number(p.get('month'));if(SEASONS[state.season].months.includes(month))state.month=month;
    if(THEMES.some(t=>t.id===p.get('theme')))state.theme=p.get('theme');
    if(Object.hasOwn(KIND,p.get('kind')))state.kind=p.get('kind');
    state.search=(p.get('search')||'').slice(0,300);
    $('year-select').value=String(state.year);$('search-input').value=state.search;$('kind-filter').value=state.kind;
    $('theme-filter').replaceChildren(new Option('Все жизненные темы',''));
    THEMES.filter(t=>t.id!=='all').forEach(t=>$('theme-filter').append(new Option(`${t.number} / ${t.name}`,t.id)));$('theme-filter').value=state.theme;
    $('year-select').addEventListener('change',e=>{state.year=Number(e.target.value);render();});
    document.querySelectorAll('[data-season]').forEach(b=>b.addEventListener('click',()=>{state.season=b.dataset.season;state.month=0;render();}));
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;state.month=0;render();}));
    for(const [id,key] of [['theme-filter','theme'],['kind-filter','kind'],['month-filter','month']])$(id).addEventListener('change',e=>{state[key]=key==='month'?Number(e.target.value):e.target.value;render();});
    $('search-input').addEventListener('input',e=>{state.search=e.target.value;render();});
    $('reset-filters').addEventListener('click',()=>{state.theme='';state.kind='';state.search='';state.month=0;$('theme-filter').value='';$('kind-filter').value='';$('search-input').value='';render();});
    $('source-close').addEventListener('click',()=>$('source-dialog').close());
    $('note-close').addEventListener('click',()=>$('notes-dialog').close());
    for(const id of ['source-dialog','notes-dialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
    $('notes-open').addEventListener('click',()=>{$('notes-title').textContent=`Мои наблюдения · ${$('period-title').textContent}`;$('note-input').value=notes[noteKey()]||'';noteStatus(storageAvailable?'Заметки остаются в этом браузере. Для переноса скачай копию.':'Хранилище браузера недоступно. Скачай копию заметок перед закрытием.');$('notes-dialog').showModal();$('note-input').focus();});
    $('note-save').addEventListener('click',saveCurrentNote);
    $('note-clear').addEventListener('click',()=>{$('note-input').value='';saveCurrentNote();});
    $('export-notes').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'astro-archive-notes',version:1,notes},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='astro-archive-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);noteStatus('Копия заметок подготовлена для скачивания.');});
    $('import-notes-button').addEventListener('click',()=>$('import-notes').click());
    $('import-notes').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>4000000)throw new Error('size');const data=JSON.parse(await file.text());if(!validateNotes(data))throw new Error('format');notes={...notes,...data.notes};const saved=writeNotes();$('note-input').value=notes[noteKey()]||'';noteStatus(saved?'Заметки из копии добавлены. Совпадающие периоды обновлены.':'Заметки добавлены до закрытия страницы. Скачай новую копию.');render();}catch{noteStatus('Не удалось прочитать копию. Нужен JSON, скачанный из этого приложения.');}e.target.value='';});
    const list=el('ul','sources-list');for(const source of archive.sources)list.append(el('li','',`${source.id.slice(1).padStart(2,'0')} / ${source.file} — ${source.description}`));$('archive-sources').append(list);
    drawMap();render();
  }
  init();
})();
