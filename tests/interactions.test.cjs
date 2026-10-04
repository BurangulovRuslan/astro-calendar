const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const archive=require('../data/archive.json');

// Lightweight DOM harness exercises actual event handlers without a browser dependency.
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.listeners={};this.className='';this.open=false;this.files=[];this.classList={toggle:(name,on)=>{const s=new Set(this.className.split(' ').filter(Boolean));if(on)s.add(name);else s.delete(name);this.className=[...s].join(' ');}};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 setAttribute(k,v){this.attrs[k]=v;if(k==='class')this.className=v;if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;}
 addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
 querySelector(selector){return flatten(this.children).find(e=>matches(e,selector));}
 showModal(){this.open=true;}
 close(){this.open=false;}
 focus(){}
 getBoundingClientRect(){return {left:0,right:600,top:0,bottom:500};}
 async fire(type,event={}){for(const handler of this.listeners[type]||[])await handler({target:this,preventDefault(){},...event});}
}
function flatten(items){return items.flatMap(e=>[e,...flatten(e.children||[])]);}
function matches(e,selector){if(selector.startsWith('.'))return e.className.split(' ').includes(selector.slice(1));const attr=selector.match(/^\[data-(.+)\]$/);return attr?e.dataset[attr[1]]!==undefined:false;}
function setup(){
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');const nodes={};
 for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes[id]=new Element();
 const buttons=[];for(const [,key,value] of html.matchAll(/data-(season|view)="([^"]+)"/g)){const b=new Element('button');b.dataset[key]=value;buttons.push(b);}
 const document={getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),querySelectorAll:selector=>[...buttons,...flatten(Object.values(nodes))].filter(e=>matches(e,selector))};
 const stored={};
 const context={document,window:{ASTRO_ARCHIVE:archive},localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=v},history:{replaceState(){}},location:{hash:''},URLSearchParams,Option:function(text,value){const e=new Element('option');e.textContent=text;e.value=value;return e;},setTimeout,URL,Blob};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),context);
 return {nodes,buttons,stored,document};
}
test('live season, theme and year handlers render their matching dossier',async()=>{
 const {nodes,buttons}=setup();
 assert.equal(nodes['period-title'].textContent,'Осень');assert(nodes['events-list'].children.length>0);
 await buttons.find(b=>b.dataset.season==='summer').fire('click');assert.equal(nodes['period-title'].textContent,'Лето');
 nodes['theme-filter'].value='relationships';await nodes['theme-filter'].fire('change');
 assert(nodes['events-list'].children.every(e=>e.children.find(c=>c.className==='event-foot').children[0].textContent==='Отношения'));
 const source=nodes['events-list'].children[0].children.find(c=>c.className==='event-foot').children[1];await source.fire('click');
 assert(nodes['source-dialog'].open);assert(nodes['source-quote'].textContent.length>30);
 nodes['year-select'].value='2027';await nodes['year-select'].fire('change');assert(nodes['next-year-panel'].hidden===false);assert.equal(nodes['events-list'].children.length,0);
});
test('notes save, clear and restore through the real controls',async()=>{
 const {nodes,stored}=setup();await nodes['notes-open'].fire('click');assert(nodes['notes-dialog'].open);
 nodes['note-input'].value='Наблюдение, а не предсказание';await nodes['note-save'].fire('click');
 assert.equal(JSON.parse(stored['astro-archive-notes-v1'])['2026:autumn:0'],'Наблюдение, а не предсказание');
 await nodes['note-close'].fire('click');await nodes['notes-open'].fire('click');assert.equal(nodes['note-input'].value,'Наблюдение, а не предсказание');
 await nodes['note-clear'].fire('click');assert.equal(JSON.parse(stored['astro-archive-notes-v1'])['2026:autumn:0'],undefined);
});
test('invalid note import preserves existing observations',async()=>{
 const {nodes,stored}=setup();nodes['note-input'].value='Сохранённое';await nodes['note-save'].fire('click');
 nodes['import-notes'].files=[{size:20,text:async()=>'{"notes":{"2026:autumn:0":42}}'}];await nodes['import-notes'].fire('change');
 assert.equal(JSON.parse(stored['astro-archive-notes-v1'])['2026:autumn:0'],'Сохранённое');
 assert(nodes['note-status'].textContent.includes('Не удалось'));
});
