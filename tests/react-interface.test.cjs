const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {buildSync}=require('esbuild');
const React=require('react');
const {create,act}=require('react-test-renderer');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
global.IS_REACT_ACT_ENVIRONMENT=true;
let compiledExports;
function loadApp(){
 if(compiledExports)return compiledExports;
 const result=buildSync({entryPoints:[path.join(root,'src/App.jsx')],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react-dom','react-dom/*']});
 const m=new Module(path.join(root,'interface-test.cjs'),module);m.filename=path.join(root,'interface-test.cjs');m.paths=Module._nodeModulePaths(root);m._compile(result.outputFiles[0].text,m.filename);compiledExports=m.exports;return compiledExports;
}
function setupDOM(){
 const listeners=new Map(),media={matches:true,addEventListener(){},removeEventListener(){}};
 global.document={hidden:false,activeElement:{focus(){}},addEventListener(n,f){listeners.set(n,f);},removeEventListener(n){listeners.delete(n);}};
 global.window={location:{hash:'#year=2026&season=autumn&view=periods'},localStorage:{getItem(){return '{}';},setItem(){}},history:{replaceState(){}},addEventListener(){},removeEventListener(){},matchMedia(){return media;},requestAnimationFrame(){return 1;},cancelAnimationFrame(){}};
 return()=>{delete global.document;delete global.window;};
}

test('React state links retain exact temporal scope and validate note storage',()=>{
 const {parseState,stateHash,readNotes,noteKey,DEFAULT_STATE}=loadApp();
 const s=parseState('#year=2026&season=prologue&month=12&theme=work&kind=strength&search=работа');
 assert.equal(s.season,'prologue');assert.equal(s.month,12);assert.deepEqual(parseState(stateHash(s)),s);
 assert.equal(noteKey(s),'2026:prologue:12');
 assert.deepEqual(parseState('#year=2030&season=bad&month=12&theme=bad'),DEFAULT_STATE);
 assert.deepEqual(readNotes({getItem:()=>'{"__proto__":"x"}'}),{});
 assert.deepEqual(readNotes({getItem:()=>'{"2026:autumn:10":"заметка"}'}),{'2026:autumn:10':'заметка'});
});
test('initial React page hides filters and all globe text, renders forecast and two compact years',()=>{
 const {default:App}=loadApp();
 const html=renderToStaticMarkup(React.createElement(App));
 assert(html.includes('hologram-numogram'));
 assert(!html.includes('id="filters-panel"'));assert(!html.includes('id="month-filter"'));
 assert(!/<h[123]\b/.test(html));
 assert(html.includes('data-year="2026"')&&html.includes('data-year="2027"'));
 const svg=html.match(/<svg[^>]*class="hologram-numogram[^>]*>[\s\S]*?<\/svg>/)?.[0];
 assert(svg,'globe SVG');assert(!/<text\b/.test(svg),'no visible topic labels or numbers');
 assert(!/автор ожидает|автор считает|назван удачным|в записи говорится/.test(html));
 assert(html.includes('event-summary'));
});
test('React interactions open compact filters, change forecast scope, preserve source and notes actions',async()=>{
 const {default:App}=loadApp(),cleanup=setupDOM();let tree;
 try{
 await act(async()=>{tree=create(React.createElement(App),{createNodeMock:element=>element.type==='dialog'?{showModal(){},close(){},getBoundingClientRect(){return {left:0,top:0,right:100,bottom:100};}}:null});});
 const find=props=>{const found=tree.root.findAllByProps(props);return found.find(x=>['button','input','select','textarea'].includes(x.type))||found[0];};
 assert.equal(tree.root.findAllByProps({id:'filters-panel'}).length,0);
 await act(async()=>find({'aria-label':'Фильтры'}).props.onClick());
 assert.equal(find({'aria-label':'Фильтры'}).props['aria-expanded'],true);
 await act(async()=>find({'data-season':'winter'}).props.onClick());
 const winter=tree.root.findAllByType('article').map(x=>x.props['data-event']);assert(winter.includes('e108'));
 await act(async()=>find({id:'theme-filter'}).props.onChange({target:{value:'work'}}));
 const archive=require('../data/archive.json');assert(tree.root.findAllByType('article').every(x=>archive.events.find(e=>e.id===x.props['data-event']).theme==='work'));
 await act(async()=>find({'aria-label':'Сбросить фильтры'}).props.onClick());
 const first=tree.root.findAllByType('article')[0],event=archive.events.find(e=>e.id===first.props['data-event']);
 await act(async()=>first.findByType('button').props.onClick());
 assert.equal(tree.root.findByType('blockquote').children.join(''),event.source.quote);
 await act(async()=>find({'aria-label':'Закрыть'}).props.onClick());
 await act(async()=>find({'aria-label':'Заметки'}).props.onClick());
 await act(async()=>find({id:'note-input'}).props.onChange({target:{value:'Проверка заметки'}}));
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('Сохранить')).props.onClick());
 assert(tree.root.findAllByProps({role:'status'}).some(x=>x.children.includes('Сохранено.')));
 await act(async()=>find({'aria-label':'Закрыть'}).props.onClick());
 await act(async()=>find({'data-year':2027}).props.onClick());
 assert.equal(tree.root.findAllByType('article').length,0);assert(tree.root.findAllByType('p').some(x=>x.children.join('').includes('3 ноября')));
 }finally{if(tree)await act(async()=>tree.unmount());cleanup();}
});
