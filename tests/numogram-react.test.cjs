const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const math = import(`data:text/javascript;base64,${fs.readFileSync(path.join(root,'src/numogram-math.js')).toString('base64')}`);
const themes = ['self','work','study','relationships','body','family','friends','money','travel','all']
  .map((id,index)=>({id,number:index,name:`Тема ${index}`}));
const links = [[6,3],[3,2],[2,7],[7,1],[1,5],[5,4],[4,1],[1,8],[8,9],[9,0],[0,9],[5,7],[8,7]];

function loadComponent() {
  const result=require('esbuild').buildSync({entryPoints:[path.join(root,'src/Numogram.jsx')],
    bundle:true,write:false,platform:'node',format:'cjs',external:['react']});
  const component=new Module(path.join(root,'src/Numogram.testing.cjs'),module);
  component.filename=path.join(root,'src/Numogram.testing.cjs');
  component.paths=Module._nodeModulePaths(path.join(root,'src'));
  component._compile(result.outputFiles[0].text,component.filename);
  return component.exports;
}

test('globe model lies on a true sphere and remains finite through unrestricted rotation',async()=>{
  const {createModel,axisAngle,multiplyQuaternion,rotatePoint,projectPoint}=await math;
  const model=createModel(themes);
  assert.equal(new Set(model.map(node=>node.radius)).size,10);
  for(const node of model) assert.ok(Math.abs(Math.hypot(node.x,node.y,node.z)-208)<1e-8);
  for(let turn=-8;turn<=8;turn++) {
    const q=multiplyQuaternion(axisAngle({x:1,y:0,z:0},turn*Math.PI/4),axisAngle({x:0,y:1,z:0},turn*Math.PI/3));
    for(const node of model) {
      const rotated=rotatePoint(node,q),projected=projectPoint(rotated);
      assert.ok(Math.abs(Math.hypot(rotated.x,rotated.y,rotated.z)-208)<1e-7);
      assert.ok(Object.values(projected).every(Number.isFinite));
      assert.ok(projected.x>65&&projected.x<655&&projected.y>65&&projected.y<655);
    }
  }
  const point=model[4],full=rotatePoint(point,axisAngle({x:0,y:1,z:0},Math.PI*2));
  assert.ok(Math.hypot(full.x-point.x,full.y-point.y,full.z-point.z)<1e-8);
});

test('connections follow spherical arcs with exact endpoints and correct painter ordering',async()=>{
  const {createModel,sphericalArc,buildScene,IDENTITY,hitTest}=await math;
  const model=createModel(themes),a=model[2],b=model[7];
  for(const [t,p] of [[0,a],[1,b]]) {
    const result=sphericalArc(a,b,t);
    assert.ok(Math.hypot(result.x-p.x,result.y-p.y,result.z-p.z)<1e-8);
  }
  const middle=sphericalArc(a,b,.5);
  assert.ok(Math.abs(Math.hypot(middle.x,middle.y,middle.z)-213)<1e-8);
  const scene=buildScene(model,links,IDENTITY);
  assert.equal(scene.nodes.length,10);assert.equal(scene.items.filter(item=>item.type==='edge').length,208);
  for(let index=1;index<scene.items.length;index++) assert.ok(scene.items[index-1].depth<=scene.items[index].depth);
  const overlapping=[{id:'back',x:100,y:100,depth:-10,projectedRadius:30},{id:'front',x:100,y:100,depth:20,projectedRadius:30}];
  assert.equal(hitTest(overlapping,100,100).id,'front');assert.equal(hitTest(overlapping,200,200),undefined);
  assert.equal(hitTest(overlapping,140,100),undefined);
  assert.equal(hitTest(overlapping,140,100,44).id,'front');
});

test('touch gestures distinguish taps, horizontal rotation, page scrolling and cancellation',async()=>{
  const {beginGesture,advanceGesture,finishGesture,rotatePoint}=await math;
  let gesture=beginGesture({pointerId:1,x:10,y:20,pointerType:'touch'});
  gesture=advanceGesture(gesture,{pointerId:1,x:13,y:22});
  assert.equal(gesture.status,'pending');assert.equal(finishGesture(gesture,1).activate,true);
  gesture=advanceGesture(gesture,{pointerId:1,x:160,y:35});
  assert.equal(gesture.status,'dragging');assert.equal(finishGesture(gesture,1).activate,false);
  assert.equal(finishGesture(gesture,1,true).activate,false);
  assert.equal(finishGesture(gesture,2),null);
  const rotated=rotatePoint({x:0,y:0,z:208},gesture.orientation);
  assert.ok(Math.abs(rotated.x)>100);
  let scroll=beginGesture({pointerId:8,x:10,y:10,pointerType:'touch'});
  scroll=advanceGesture(scroll,{pointerId:8,x:12,y:50});
  assert.equal(scroll.status,'scrolling');assert.equal(finishGesture(scroll,8).activate,false);
  const mouse=advanceGesture(beginGesture({pointerId:9,x:0,y:0}),{pointerId:9,x:0,y:500});
  assert.equal(mouse.status,'dragging');assert.ok(Math.abs(mouse.orientation[0])>.8);
});

test('animation scheduler cancels reliably, resumes with bounded delta and never doubles RAF loops',async()=>{
  const {createMotionLoop}=await math;
  let id=0;const queued=new Map(),paint=[];
  const loop=createMotionLoop({requestFrame:fn=>{queued.set(++id,fn);return id;},cancelFrame:key=>queued.delete(key),onFrame:delta=>paint.push(delta)});
  const tick=time=>{const [key,callback]=queued.entries().next().value;queued.delete(key);callback(time);};
  loop.setRunning(true);loop.setRunning(true);assert.equal(queued.size,1);
  tick(0);tick(16);tick(35);assert.equal(paint.length,2);assert.equal(queued.size,1);
  loop.setRunning(false);assert.equal(queued.size,0);
  loop.setRunning(true);tick(900000);assert.equal(paint.at(-1),0);
  tick(950000);assert.equal(paint.at(-1),.06);
  loop.dispose();loop.setRunning(true);assert.equal(queued.size,0);
});

test('React SSR produces ten distinct unlabeled sphere materials and stable accessible buttons',()=>{
  const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
  const {default:Numogram,MATERIALS}=loadComponent();
  const markup=renderToStaticMarkup(React.createElement(Numogram,{themes,links,selectedTheme:'work'}));
  assert.equal((markup.match(/class="hologram-sphere/g)||[]).length,10);
  assert.equal((markup.match(/role="button"/g)||[]).length,10);
  assert.equal((markup.match(/<text[ >]/g)||[]).length,0);
  assert.equal(new Set(MATERIALS.map(item=>item.mid)).size,10);
  assert.equal(new Set(MATERIALS.map(item=>item.motif)).size,10);
  assert.ok(markup.includes('touch-action:pan-y'));
  assert.ok(markup.includes('data-theme="work"'));
  assert.ok(!markup.includes('NaN')&&!markup.includes('Infinity'));
});

test('mounted React component supports touch selection and pauses for hidden/offscreen/reduced-motion states',async()=>{
  const React=require('react'),Renderer=require('react-test-renderer');const {act}=Renderer;
  const {default:Numogram}=loadComponent();
  const saved={window:global.window,document:global.document,IntersectionObserver:global.IntersectionObserver,
    IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
  const queued=new Map(),docListeners=new Map(),winListeners=new Map(),mediaListeners=new Map(),capture=new Set();
  let rafId=0,observer,tree;const selected=[];
  const media={matches:false,addEventListener:(name,fn)=>mediaListeners.set(name,fn),removeEventListener:name=>mediaListeners.delete(name)};
  const svg={getBoundingClientRect:()=>({left:0,top:0,width:720,height:720}),
    setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)};
  global.IS_REACT_ACT_ENVIRONMENT=true;
  global.document={hidden:false,addEventListener:(name,fn)=>docListeners.set(name,fn),removeEventListener:name=>docListeners.delete(name)};
  global.window={requestAnimationFrame:fn=>{queued.set(++rafId,fn);return rafId;},cancelAnimationFrame:id=>queued.delete(id),
    matchMedia:()=>media,addEventListener:(name,fn)=>winListeners.set(name,fn),removeEventListener:name=>winListeners.delete(name)};
  global.IntersectionObserver=class{constructor(callback){this.callback=callback;this.disconnected=false;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
  try {
    await act(()=>{tree=Renderer.create(React.createElement(Numogram,{themes,links,selectedTheme:'',onSelect:value=>selected.push(value)}),
      {createNodeMock:element=>element.type==='svg'?svg:null});});
    assert.equal(queued.size,1);
    const props=()=>tree.root.findByType('svg').props;
    const node=tree.root.findByProps({'data-theme':'work'}).findByType('circle').props;
    const event=(pointerId,x,y)=>({pointerId,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y,cancelable:true,preventDefault(){}});
    await act(()=>props().onPointerDown(event(2,node.cx,node.cy)));
    assert.ok(capture.has(2));
    await act(()=>props().onPointerUp(event(2,node.cx,node.cy)));
    assert.equal(capture.size,0);assert.equal(selected.at(-1),'work');
    const before=tree.root.findAllByProps({className:'hologram-sphere'})[0].props.transform;
    await act(()=>props().onPointerDown(event(3,100,200)));
    await act(()=>props().onPointerMove(event(3,360,240)));
    assert.ok(props().className.includes('is-dragging'));
    const after=tree.root.findAllByProps({className:'hologram-sphere'})[0].props.transform;
    assert.notEqual(after,before);
    await act(()=>props().onPointerCancel(event(3,360,240)));
    assert.equal(capture.size,0);assert.equal(selected.length,1);
    await act(()=>props().onPointerDown(event(4,100,200)));
    await act(()=>props().onPointerMove(event(4,105,250)));
    await act(()=>props().onPointerUp(event(4,node.cx,node.cy)));
    assert.equal(selected.length,1);assert.equal(capture.size,0);
    await act(()=>tree.root.findByProps({'data-theme':'work'}).props.onClick({detail:1}));
    assert.equal(selected.length,1);
    await act(()=>tree.root.findByProps({'data-theme':'work'}).props.onClick({detail:0}));
    assert.equal(selected.at(-1),'work');assert.equal(selected.length,2);
    await act(()=>tree.root.findByProps({'data-theme':'all'}).props.onKeyDown({key:'Enter',preventDefault(){}}));
    assert.equal(selected.at(-1),'');
    global.document.hidden=true;docListeners.get('visibilitychange')();assert.equal(queued.size,0);
    media.matches=true;mediaListeners.get('change')();global.document.hidden=false;docListeners.get('visibilitychange')();assert.equal(queued.size,0);
    media.matches=false;mediaListeners.get('change')();assert.equal(queued.size,1);
    observer.callback([{isIntersecting:false}]);assert.equal(queued.size,0);
    observer.callback([{isIntersecting:true}]);assert.equal(queued.size,1);
    await act(()=>winListeners.get('pagehide')());assert.equal(queued.size,0);
    winListeners.get('pageshow')();assert.equal(queued.size,1);
    await act(()=>tree.unmount());tree=null;
    assert.equal(queued.size,0);assert.ok(observer.disconnected);
    assert.equal(docListeners.size,0);assert.equal(winListeners.size,0);assert.equal(mediaListeners.size,0);
  } finally {
    if(tree)await act(()=>tree.unmount());
    for(const [key,value]of Object.entries(saved)) {if(value===undefined)delete global[key];else global[key]=value;}
  }
});
