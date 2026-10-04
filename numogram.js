(function (global) {
  'use strict';
  const CAMERA = {distance:760, centerX:360, centerY:382};
  const DEPTHS = [55,-20,-125,85,-85,75,-155,160,95,145];
  const MAX_YAW = .58, MAX_PITCH = .22;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  function rotatePoint(point,yaw,pitch) {
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
    const x=point.x*cy+point.z*sy, z=-point.x*sy+point.z*cy;
    return {x,y:point.y*cx-z*sx,z:point.y*sx+z*cx};
  }
  function projectPoint(point,camera=CAMERA) {
    const distance=camera.distance ?? CAMERA.distance;
    const depth=distance-point.z;
    if(!Number.isFinite(depth)||depth<=20)return null;
    const scale=distance/depth;
    return {x:(camera.centerX ?? CAMERA.centerX)+point.x*scale,
      y:(camera.centerY ?? CAMERA.centerY)+point.y*scale,z:point.z,scale};
  }
  function createModel(nodes) {
    return nodes.map((node,i)=>({...node,x:(node.x-360)*.86,y:(node.y-390)*.86,z:DEPTHS[i%DEPTHS.length]}));
  }
  function curvePoint(a,b,t,bend=1) {
    const u=1-t, dx=b.x-a.x,dy=b.y-a.y, length=Math.hypot(dx,dy)||1;
    const lateral=45*bend, lift=85+Math.abs(a.z-b.z)*.16;
    const c1={x:a.x+dx/3-dy/length*lateral,y:a.y+dy/3+dx/length*lateral,z:a.z+(b.z-a.z)/3+lift};
    const c2={x:a.x+dx*2/3-dy/length*lateral,y:a.y+dy*2/3+dx/length*lateral,z:a.z+(b.z-a.z)*2/3+lift};
    const coordinate=k=>u*u*u*a[k]+3*u*u*t*c1[k]+3*u*t*t*c2[k]+t*t*t*b[k];
    return {x:coordinate('x'),y:coordinate('y'),z:coordinate('z')};
  }
  function create({svg,nodes,links}) {
    if(!svg||!nodes?.length)return null;
    const NS='http://www.w3.org/2000/svg';
    const make=(tag,attrs={})=>{const element=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))element.setAttribute(key,String(value));return element;};
    const put=(element,key,value)=>element.setAttribute(key,typeof value==='number'?value.toFixed(3):value);
    const model=createModel(nodes), groups=nodes.map(node=>svg.querySelector(`.map-node-group[data-theme="${node.id}"]`));
    if(groups.some(group=>!group))return null;
    svg.classList.add('numogram-spatial');
    svg.querySelector('.sky-background')?.remove();
    const edges=svg.querySelector('#map-edges');
    const originals=[...edges.querySelectorAll('.map-edge')];
    originals.forEach(edge=>edge.setAttribute('visibility','hidden'));
    const geometry=make('g',{id:'numogram-geometry','aria-hidden':'true'});
    edges.append(geometry);
    const items=[], states=groups.map(()=>({active:false,empty:false,hover:false}));
    const addItem=(element,points,kind,index,parts)=>{
      geometry.append(element);const item={element,points,kind,index,parts,key:items.length,depth:0};items.push(item);return item;
    };
    function tube(points,kind,index) {
      const element=make('g',{class:kind==='edge'?'spatial-tube':'spatial-orbit'});
      const classes=kind==='edge'?['edge-shadow','edge-body','edge-core','edge-specular']:['orbit-shadow','orbit-body','orbit-specular'];
      const parts=classes.map(className=>make('path',{class:className,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'}));
      element.append(...parts);return addItem(element,points,kind,index,parts);
    }
    links.forEach(([aIndex,bIndex],index)=>{
      const a=model[aIndex],b=model[bIndex],bend=aIndex>bIndex?1:-1;
      // Stop at the sphere surfaces instead of drawing a connection through its centre.
      const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z);
      let start=0,end=1;
      while(start<.45&&distance(curvePoint(a,b,start,bend),a)<31)start+=.015;
      while(end>.55&&distance(curvePoint(a,b,end,bend),b)<31)end-=.015;
      for(let i=0;i<16;i++){
        const t=start+(end-start)*i/16,next=start+(end-start)*(i+1)/16;
        tube([curvePoint(a,b,t,bend),curvePoint(a,b,(t+next)/2,bend),curvePoint(a,b,next,bend)],'edge',index);
      }
    });
    function orbit(center,radiusX,radiusY,tilt,yaw,index,segments=16) {
      const at=angle=>{
        const vector=rotatePoint({x:radiusX*Math.cos(angle),y:radiusY*Math.sin(angle),z:0},yaw,tilt);
        return {x:center.x+vector.x,y:center.y+vector.y,z:center.z+vector.z};
      };
      for(let i=0;i<segments;i++){
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        tube([at(a),at((a+b)/2),at(b)],'orbit',index);
      }
    }
    model.forEach((point,index)=>orbit(point,40,40,.75+(index%3)*.19,index%2?.32:-.32,index));
    // Two enclosing toroids share the same camera as every node and wire.
    orbit({x:0,y:12,z:-105},220,312,.36,-.18,-1,32);
    orbit({x:0,y:12,z:-115},249,295,-.46,.46,-1,32);
    model.forEach((point,index)=>{
      const group=make('g',{class:'spatial-node'});
      const shadow=make('ellipse',{class:'sphere-shadow',fill:'#000',opacity:'.55'});
      const sphere=make('circle',{class:'spatial-sphere',fill:'url(#node-sphere)'});
      const rim=make('circle',{class:'sphere-rim',fill:'none',stroke:'#5d9b74','stroke-width':'.8'});
      const shine=make('ellipse',{class:'sphere-specular',fill:'#d5ffe6',opacity:'.44'});
      const reflection=make('path',{class:'sphere-reflection',fill:'none',stroke:'#63aa80','stroke-linecap':'round',opacity:'.55'});
      group.append(shadow,sphere,rim,shine,reflection);
      addItem(group,[point],'node',index,[shadow,sphere,rim,shine,reflection]);
      const original=groups[index];
      if(nodes[index].id==='all')original.querySelector('.node-label').setAttribute('text-anchor','end');
      original.querySelector('.map-node').setAttribute('visibility','hidden');
      original.querySelector('.node-orbit')?.remove();
      original.addEventListener('pointerenter',()=>{states[index].hover=true;draw();});
      original.addEventListener('pointerleave',()=>{states[index].hover=false;draw();});
      original.addEventListener('focus',()=>{states[index].hover=true;draw();});
      original.addEventListener('blur',()=>{states[index].hover=false;draw();});
    });
    let yaw=-.19,pitch=-.045,elapsed=0,lastFrame=0,frame=0,visible=true,disposed=false,drag=null,order='';
    const media=global.matchMedia?.('(prefers-reduced-motion: reduce)') || {matches:false};
    function cameraAngles() {
      return [yaw+(media.matches||drag?0:Math.sin(elapsed*.00011)*.10),pitch+(media.matches||drag?0:Math.sin(elapsed*.00008)*.035)];
    }
    function draw() {
      if(disposed)return;
      const [angleY,angleX]=cameraAngles();
      const project=point=>projectPoint(rotatePoint(point,angleY,angleX));
      const activeEdges=originals.map(edge=>edge.classList.contains('is-active'));
      groups.forEach((group,index)=>{
        const position=project(model[index]);
        put(group,'transform',`translate(${position.x.toFixed(3)} ${position.y.toFixed(3)})`);
        put(group.querySelector('.node-hit-area'),'r',Math.max(38,46*position.scale));
        const label=group.querySelector('.node-label');
        const direction=label.getAttribute('text-anchor')==='end'?-1:1;
        put(label,'x',direction*(28*position.scale+15));
        if(nodes[index].id==='self')put(label,'y',28*position.scale+36);
        states[index].active=group.classList.contains('is-active');states[index].empty=group.classList.contains('is-empty');
      });
      for(const item of items){
        const projected=item.points.map(project);
        item.depth=projected.reduce((sum,point)=>sum+point.z,0)/projected.length+(item.kind==='node'?14:0);
        if(item.kind==='node'){
          const point=projected[0],radius=28*point.scale,state=states[item.index];
          const [shadow,sphere,rim,shine,reflection]=item.parts;
          put(item.element,'transform',`translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`);
          item.element.classList.toggle('is-active',state.active);item.element.classList.toggle('is-empty',state.empty);item.element.classList.toggle('is-hovered',state.hover);
          put(item.element,'opacity',state.empty&&!state.active&&!state.hover?.4:clamp(.72+point.scale*.2,.75,1));
          put(shadow,'cx',radius*.12);put(shadow,'cy',radius*.31);put(shadow,'rx',radius*1.15);put(shadow,'ry',radius*1.02);
          put(sphere,'r',radius);put(sphere,'fill',state.active?'url(#node-sphere-active)':'url(#node-sphere)');
          put(rim,'r',radius-.4);put(rim,'stroke-width',(state.active||state.hover?1.2:.65)*point.scale);
          put(shine,'cx',-radius*.32);put(shine,'cy',-radius*.47);put(shine,'rx',radius*.24);put(shine,'ry',radius*.11);put(shine,'transform','rotate(-35)');
          put(reflection,'d',`M ${-radius*.7} ${radius*.37} Q 0 ${radius*1.05} ${radius*.73} ${radius*.31}`);put(reflection,'stroke-width',2*point.scale);
          continue;
        }
        const scale=projected.reduce((sum,point)=>sum+point.scale,0)/projected.length;
        const control={x:2*projected[1].x-(projected[0].x+projected[2].x)/2,y:2*projected[1].y-(projected[0].y+projected[2].y)/2};
        const path=(dx=0,dy=0)=>`M ${(projected[0].x+dx).toFixed(2)} ${(projected[0].y+dy).toFixed(2)} Q ${(control.x+dx).toFixed(2)} ${(control.y+dy).toFixed(2)} ${(projected[2].x+dx).toFixed(2)} ${(projected[2].y+dy).toFixed(2)}`;
        const active=item.kind==='edge'?activeEdges[item.index]:item.index>=0&&states[item.index].active;
        item.element.classList.toggle('is-active',Boolean(active));
        const opacity=clamp(.28+(scale-.70)*.92,.27,.94)*(item.kind==='orbit'&&item.index<0?.57:1);
        put(item.element,'opacity',active?Math.max(.75,opacity):opacity);
        const widths=item.kind==='edge'?[9,6.4,3.8,1.05]:[5,2.8,.7];
        item.parts.forEach((part,index)=>{
          put(part,'d',index===0?path(1.4*scale,2.7*scale):index===item.parts.length-1?path(-.45*scale,-.7*scale):path());
          put(part,'stroke-width',widths[index]*scale);
        });
      }
      const sorted=[...items].sort((a,b)=>a.depth-b.depth||a.key-b.key);
      const signature=sorted.map(item=>item.key).join(',');
      if(signature!==order){for(const item of sorted)geometry.append(item.element);order=signature;}
    }
    function running(){return !disposed&&!document.hidden&&visible&&!media.matches;}
    function tick(time){
      frame=0;
      if(!running())return;
      if(!lastFrame||time-lastFrame>=1000/24){elapsed+=lastFrame?Math.min(time-lastFrame,100):0;lastFrame=time;draw();}
      frame=global.requestAnimationFrame(tick);
    }
    function lifecycle(){
      if(frame){global.cancelAnimationFrame(frame);frame=0;}lastFrame=0;
      if(running())frame=global.requestAnimationFrame(tick);draw();
    }
    const observer=new MutationObserver(()=>draw());
    groups.forEach(group=>observer.observe(group,{attributes:true,attributeFilter:['class']}));
    originals.forEach(edge=>observer.observe(edge,{attributes:true,attributeFilter:['class']}));
    const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lifecycle();},{rootMargin:'80px'}):null;
    intersection?.observe(svg);
    const down=event=>{
      if(event.button!==0||event.pointerType!=='mouse'||event.target.closest('.map-node-group'))return;
      drag={x:event.clientX,y:event.clientY,yaw,pitch,id:event.pointerId};svg.setPointerCapture?.(event.pointerId);svg.classList.add('is-rotating');
    };
    const move=event=>{
      if(!drag||event.pointerId!==drag.id)return;
      yaw=clamp(drag.yaw+(event.clientX-drag.x)*.003,-MAX_YAW,MAX_YAW);
      pitch=clamp(drag.pitch+(event.clientY-drag.y)*.002,-MAX_PITCH,MAX_PITCH);draw();
    };
    const up=event=>{if(!drag||event.pointerId!==drag.id)return;drag=null;svg.classList.remove('is-rotating');draw();};
    svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
    document.addEventListener('visibilitychange',lifecycle);media.addEventListener?.('change',lifecycle);
    const hide=()=>{visible=false;lifecycle();},show=()=>{visible=true;lifecycle();};
    global.addEventListener('pagehide',hide);global.addEventListener('pageshow',show);
    lifecycle();
    return {reset(){yaw=-.19;pitch=-.045;elapsed=0;draw();},destroy(){disposed=true;if(frame)global.cancelAnimationFrame(frame);observer.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',lifecycle);media.removeEventListener?.('change',lifecycle);global.removeEventListener('pagehide',hide);global.removeEventListener('pageshow',show);svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerup',up);svg.removeEventListener('pointercancel',up);}};
  }
  const api={rotatePoint,projectPoint,createModel,curvePoint,create,CAMERA,MAX_YAW,MAX_PITCH};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(global)global.Numogram3D=api;
})(typeof window==='undefined'?null:window);
