const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {filterEvents,validateNotes,eventYear,THEMES}=require('../app.js');
const archive=require('../data/archive.json');
const base={year:2026,season:'all',month:0,view:'periods',theme:'',kind:'',search:''};

test('every thesis has a valid theme, type and exact source locator',()=>{
 assert.equal(archive.sources.length,6);
 assert.equal(new Set(archive.events.map(e=>e.id)).size,archive.events.length);
 for(const e of archive.events){
  assert(THEMES.some(t=>t.id===e.theme));
  assert(['challenge','strength','mixed'].includes(e.kind));
  assert(archive.sources.some(s=>s.id===e.source.id));
  assert(e.title&&e.summary&&e.source.quote);
  assert(e.source.paragraphs.every(p=>Number.isInteger(p)&&p>0));
  assert(e.months.every(m=>m>=1&&m<=12));
  assert.equal(e.precision==='general',e.months.length===0);
 }
});
test('prologue belongs to 2025 and December 2026 has no fabricated forecast',()=>{
 const prologue=filterEvents(archive.events,{...base,season:'prologue'});
 assert(prologue.length>0);assert(prologue.every(e=>e.source.id==='s3'));
 assert.equal(filterEvents(archive.events,{...base,month:12}).length,0);
 assert.equal(eventYear(archive.events.find(e=>e.id==='e108'),12),2025);
 assert.equal(eventYear(archive.events.find(e=>e.id==='e108'),1),2026);
 assert(filterEvents(archive.events,{...base,season:'winter'}).some(e=>e.id==='e108'));
});
test('general descriptions never silently become seasonal events',()=>{
 const general=filterEvents(archive.events,{...base,view:'general'});
 assert.equal(general.length,28);assert(general.every(e=>e.precision==='general'));
 for(const season of ['winter','spring','summer','autumn','prologue'])assert(filterEvents(archive.events,{...base,season}).every(e=>e.precision!=='general'));
});
test('new cycle remains empty in every mode',()=>{
 for(const view of ['general','periods'])assert.equal(filterEvents(archive.events,{...base,year:2027,view}).length,0);
});
test('theme, strength and query filters combine without losing temporal scope',()=>{
 const found=filterEvents(archive.events,{...base,season:'autumn',month:10,theme:'work',kind:'strength',search:'оптимизац'});
 assert.deepEqual(found.map(e=>e.id),['e607']);
 const counts=filterEvents(archive.events,{...base,season:'autumn',theme:'money'},true);
 assert(counts.some(e=>e.theme==='work'));
});
test('all seasons retain strengths and challenges',()=>{
 for(const season of ['winter','spring','summer','autumn','prologue']){
  const found=filterEvents(archive.events,{...base,season});
  assert(found.some(e=>e.kind==='strength'),season);
  assert(found.some(e=>e.kind==='challenge'),season);
 }
});
test('note imports accept only bounded archive format and period keys',()=>{
 assert(validateNotes({format:'astro-archive-notes',version:1,notes:{'2026:autumn:10':'Моя запись'}}));
 assert(!validateNotes(JSON.parse('{"format":"astro-archive-notes","version":1,"notes":{"__proto__":"bad"}}')));
 assert(!validateNotes({format:'astro-archive-notes',version:1,notes:{'2026:autumn:10':3}}));
 assert(!validateNotes({format:'astro-archive-notes',version:1,notes:{'2026:autumn:10':'a'.repeat(12001)}}));
});
test('static shell contains every required interaction and no external assets',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 const required=[...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of required)assert(html.includes(`id="${id}"`),`Missing DOM target ${id}`);
 assert(!/(?:src|href)="https?:\/\//.test(html));
});
