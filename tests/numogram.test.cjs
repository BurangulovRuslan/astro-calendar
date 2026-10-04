const test=require('node:test');
const assert=require('node:assert/strict');
const {THEMES}=require('../app.js');
const {rotatePoint,projectPoint,createModel,curvePoint,CAMERA,MAX_YAW,MAX_PITCH}=require('../numogram.js');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('the numogram has spatial depth and a perspective camera, preserving rigid geometry',()=>{
  const model=createModel(THEMES);
  assert.equal(model.length,10);
  assert.deepEqual(model.map(point=>point.id),THEMES.map(point=>point.id));
  assert(Math.max(...model.map(point=>point.z))-Math.min(...model.map(point=>point.z))>=300);
  for(const point of model){
    const rotated=rotatePoint(point,.37,-.16);
    assert(Math.abs(Math.hypot(point.x,point.y,point.z)-Math.hypot(rotated.x,rotated.y,rotated.z))<1e-10);
  }
  const near=projectPoint({x:100,y:100,z:160}),far=projectPoint({x:100,y:100,z:-155});
  assert(near.scale/far.scale>1.5);
  assert(near.x-CAMERA.centerX>far.x-CAMERA.centerX);
  assert.equal(projectPoint({x:0,y:0,z:CAMERA.distance}),null);
  assert.equal(projectPoint({x:0,y:0,z:CAMERA.distance+1}),null);
});

test('camera drag bounds keep all sphere centres finite and inside the SVG viewport',()=>{
  const model=createModel(THEMES);
  for(const yaw of [-MAX_YAW,0,MAX_YAW])for(const pitch of [-MAX_PITCH,0,MAX_PITCH])for(const point of model){
    const projected=projectPoint(rotatePoint(point,yaw,pitch));
    assert(projected&&Number.isFinite(projected.x)&&Number.isFinite(projected.y));
    const radius=28*projected.scale;
    assert(projected.x-radius>15&&projected.x+radius<705,`${point.id} x bounds`);
    assert(projected.y-radius>15&&projected.y+radius<755,`${point.id} y bounds`);
  }
});

test('links bend through depth while retaining their original node endpoints',()=>{
  const model=createModel(THEMES),a=model[6],b=model[3];
  assert.deepEqual(curvePoint(a,b,0),{x:a.x,y:a.y,z:a.z});
  assert.deepEqual(curvePoint(a,b,1),{x:b.x,y:b.y,z:b.z});
  const middle=curvePoint(a,b,.5);
  assert(middle.z>(a.z+b.z)/2+60);
  const samples=Array.from({length:17},(_,i)=>projectPoint(rotatePoint(curvePoint(a,b,i/16),-.19,-.045)));
  assert(samples.every(point=>point&&Number.isFinite(point.scale)));
});

// SVG-only harness verifies the actual renderer and can serialize a geometry preview.
function createSceneHarness(reduced=false){
  const all=element=>[element,...element.children.flatMap(all)];
  function matches(element,selector){
    if(selector.startsWith('#'))return element.attrs.id===selector.slice(1);
    const match=selector.match(/^\.([\w-]+)(?:\[data-theme="([^"]+)"\])?$/);
    return Boolean(match&&element.classList.contains(match[1])&&(!match[2]||element.attrs['data-theme']===match[2]));
  }
  class Element{
    constructor(tag,attrs={}){
      this.tag=tag;this.attrs={};this.children=[];this.parent=null;this.textContent='';this.listeners={};
      this.classList={contains:name=>(this.attrs.class||'').split(' ').includes(name),toggle:(name,on)=>{const classes=new Set((this.attrs.class||'').split(' ').filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.attrs.class=[...classes].join(' ');},add:name=>this.classList.toggle(name,true),remove:name=>this.classList.toggle(name,false)};
      for(const [key,value]of Object.entries(attrs))this.setAttribute(key,value);
    }
    setAttribute(key,value){this.attrs[key]=String(value);}
    getAttribute(key){return this.attrs[key]??null;}
    append(...elements){for(const element of elements){element.remove();this.children.push(element);element.parent=this;}}
    remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
    querySelectorAll(selector){return all(this).slice(1).filter(element=>matches(element,selector));}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){return matches(this,selector)?this:this.parent?.closest(selector);}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
    removeEventListener(name,fn){this.listeners[name]=(this.listeners[name]||[]).filter(item=>item!==fn);}
    fire(name,event={}){for(const fn of this.listeners[name]||[])fn({target:this,...event});}
  }
  const svg=new Element('svg',{xmlns:'http://www.w3.org/2000/svg',viewBox:'0 0 720 780',id:'sky-map'});
  const edgeLayer=new Element('g',{id:'map-edges'}),nodeLayer=new Element('g',{id:'map-nodes'});
  svg.append(new Element('g',{class:'sky-background'}),edgeLayer,nodeLayer);
  const links=[[6,3],[3,2],[2,7],[7,1],[1,5],[5,4],[4,1],[1,8],[8,9],[9,0],[0,9],[5,7],[8,7]];
  for(const [a,b]of links)edgeLayer.append(new Element('path',{class:'map-edge','data-a':THEMES[a].id,'data-b':THEMES[b].id}));
  for(const theme of THEMES){
    const group=new Element('g',{class:'map-node-group','data-theme':theme.id,tabindex:0,role:'button'});
    const anchor=theme.id==='study'?'start':theme.id==='friends'?'end':theme.x>400?'end':'start';
    const number=new Element('text',{class:'node-number','text-anchor':'middle',y:8});number.textContent=String(theme.number);
    const label=new Element('text',{class:'node-label','text-anchor':anchor,y:-3});label.textContent=({study:'Учёба',body:'Тело',family:'Дом',friends:'Друзья'})[theme.id]||theme.name;
    group.append(new Element('circle',{class:'node-hit-area',r:46}),new Element('circle',{class:'node-orbit',r:38}),new Element('circle',{class:'map-node',r:28}),number,label);nodeLayer.append(group);
  }
  const frames=new Map(),observers=[],media={matches:reduced},documentEvents={},windowEvents={};let next=0;
  const document={hidden:false,createElementNS:(ns,tag)=>new Element(tag),addEventListener:(name,fn)=>documentEvents[name]=fn,removeEventListener(){}};
  media.addEventListener=(name,fn)=>media.change=fn;media.removeEventListener=()=>{};
  const window={matchMedia:()=>media,requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(name,fn)=>windowEvents[name]=fn,removeEventListener(){}};
  class MutationObserver{constructor(fn){this.callback=fn;this.targets=[];observers.push(this);}observe(target,options){this.targets.push({target,options});}disconnect(){this.targets=[];}}
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../numogram.js'),'utf8'),{window,document,MutationObserver});
  const controller=window.Numogram3D.create({svg,nodes:THEMES,links});
  const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const serialize=element=>`<${element.tag}${Object.entries(element.attrs).map(([key,value])=>` ${key}="${escape(value)}"`).join('')}>${escape(element.textContent)}${element.children.map(serialize).join('')}</${element.tag}>`;
  return {svg,frames,media,document,documentEvents,windowEvents,observers,controller,serialize:()=>serialize(svg)};
}
module.exports={createSceneHarness};

test('renderer depth sorts solid geometry while preserving interactive nodes and live selection',()=>{
  const scene=createSceneHarness(true),geometry=scene.svg.querySelector('#numogram-geometry');
  assert.equal(scene.svg.querySelectorAll('.map-node-group').length,10);
  assert.equal(scene.svg.querySelectorAll('.spatial-node').length,10);
  assert.equal(scene.svg.querySelectorAll('.spatial-tube').length,13*16);
  assert.equal(scene.svg.querySelectorAll('.map-edge').length,13);
  assert.equal(scene.observers[0].targets.length,23);
  assert(scene.observers[0].targets.every(({options})=>options.attributeFilter.length===1&&options.attributeFilter[0]==='class'&&!options.subtree));
  const work=scene.svg.querySelector('.map-node-group[data-theme="work"]');
  const keyboardOrder=scene.svg.querySelectorAll('.map-node-group').map(group=>group.attrs['data-theme']);
  work.classList.add('is-active');scene.observers[0].callback();
  assert.equal(scene.svg.querySelectorAll('.spatial-node').filter(node=>node.classList.contains('is-active')).length,1);
  assert.deepEqual(scene.svg.querySelectorAll('.map-node-group').map(group=>group.attrs['data-theme']),keyboardOrder);
  assert.equal(geometry.children.length,10+13*16+10*16+64);
  assert(!scene.serialize().includes('NaN'));
});

test('spatial animation pauses for hidden documents and reduced motion without duplicate loops',()=>{
  const scene=createSceneHarness();assert.equal(scene.frames.size,1);
  scene.document.hidden=true;scene.documentEvents.visibilitychange();assert.equal(scene.frames.size,0);
  scene.document.hidden=false;scene.documentEvents.visibilitychange();assert.equal(scene.frames.size,1);
  scene.windowEvents.pageshow();assert.equal(scene.frames.size,1);
  scene.media.matches=true;scene.media.change();assert.equal(scene.frames.size,0);
  scene.observers[0].callback();assert.equal(scene.frames.size,0);
  scene.media.matches=false;scene.media.change();assert.equal(scene.frames.size,1);
  scene.controller.destroy();assert.equal(scene.frames.size,0);
  assert.equal(createSceneHarness(true).frames.size,0);
});
