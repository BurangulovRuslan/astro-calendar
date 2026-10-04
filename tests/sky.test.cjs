const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const catalog=require('../data/sky-catalog.json');
const {equatorialVector,rotateVector,projectVector,magnitudeAppearance}=require('../sky.js');

test('celestial data retains catalog identities and the measured position of Sirius',()=>{
 assert.equal(catalog.epoch,'J2000');
 assert.equal(catalog.stars.length,3596);
 assert.equal(new Set(catalog.stars.map(s=>s[0])).size,catalog.stars.length);
 assert.deepEqual(catalog.stars.find(s=>s[0]===32349),[32349,101.2872,-16.7161,-1.44]);
 for(const [hip,ra,dec,mag] of catalog.stars){
  assert(Number.isInteger(hip)&&hip>0);
  assert(ra>=0&&ra<360&&dec>=-90&&dec<=90&&mag<=5.7);
 }
});

test('camera rotation preserves stellar angular separations and clips the opposite pole',()=>{
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const stars=[32349,24436,91262].map(id=>catalog.stars.find(s=>s[0]===id));
 const vectors=stars.map(s=>equatorialVector(s[1],s[2]));
 const moved=vectors.map(v=>rotateVector(v,1.17,-.43));
 for(const v of moved)assert(Math.abs(Math.hypot(...v)-1)<1e-12);
 for(let i=1;i<vectors.length;i++)assert(Math.abs(dot(vectors[0],vectors[i])-dot(moved[0],moved[i]))<1e-12);
 assert.deepEqual(projectVector([0,0,1],390,844),[195,422,1]);
 assert.equal(projectVector([0,0,-1],390,844),null);
 const bright=magnitudeAppearance(-1.44),faint=magnitudeAppearance(5.7);
 assert(bright.radius>faint.radius&&bright.opacity>faint.opacity);
});

function renderer(reduced=false){
 const windowEvents={},documentEvents={},frames=new Map();let next=1;
 const media={matches:reduced,addEventListener:(name,fn)=>media.change=fn};
 const gradient={addColorStop(){}};
 const context={createRadialGradient:()=>gradient,fillRect(){},setTransform(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},drawImage(){},arc(){},fill(){}};
 const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:390,height:844})};
 const document={readyState:'complete',hidden:false,getElementById:id=>id==='celestial-sky'?canvas:null,createElement:()=>({getContext:()=>context}),addEventListener:(name,fn)=>documentEvents[name]=fn};
 const window={ASTRO_SKY:catalog,innerWidth:390,innerHeight:844,devicePixelRatio:3,matchMedia:()=>media,requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(name,fn)=>windowEvents[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sky.js'),'utf8'),{window,document});
 return {document,windowEvents,documentEvents,frames,media,canvas};
}

test('background animation stops for hidden tabs and reduced motion without duplicate frame loops',()=>{
 const r=renderer();assert.equal(r.frames.size,1);assert.equal(r.canvas.width,683);
 const [id,fn]=r.frames.entries().next().value;r.frames.delete(id);fn(50);assert.equal(r.frames.size,1);
 r.document.hidden=true;r.documentEvents.visibilitychange();assert.equal(r.frames.size,0);
 r.document.hidden=false;r.documentEvents.visibilitychange();assert.equal(r.frames.size,1);
 r.windowEvents.pageshow();assert.equal(r.frames.size,1);
 r.media.matches=true;r.media.change();assert.equal(r.frames.size,0);
 r.windowEvents.resize();assert.equal(r.frames.size,0);
 r.media.matches=false;r.media.change();assert.equal(r.frames.size,1);
 r.windowEvents.pagehide();assert.equal(r.frames.size,0);
 assert.equal(renderer(true).frames.size,0);
});
