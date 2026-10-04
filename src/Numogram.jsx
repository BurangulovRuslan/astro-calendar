import React, {memo, useEffect, useId, useMemo, useRef, useState} from 'react';
import {axisAngle, beginGesture, advanceGesture, finishGesture, buildScene, createModel, createMotionLoop,
  hitTest, multiplyQuaternion} from './numogram-math.js';

const MATERIALS = [
  {light:'#c7ffe3', mid:'#2d9973', shade:'#07231b', accent:'#85ebaa', motif:'liquid'},
  {light:'#d8fff7', mid:'#258b8b', shade:'#061d25', accent:'#8ef7ef', motif:'orbital'},
  {light:'#eee2ff', mid:'#7561aa', shade:'#15182e', accent:'#c2b8fc', motif:'crystal'},
  {light:'#f1e9f8', mid:'#967da1', shade:'#261827', accent:'#ecb8e2', motif:'aurora'},
  {light:'#fff0c2', mid:'#a57938', shade:'#2a2410', accent:'#e7be76', motif:'embers'},
  {light:'#d4e5ff', mid:'#416591', shade:'#0d1c35', accent:'#9eaff1', motif:'bands'},
  {light:'#b6fff1', mid:'#307c76', shade:'#071f22', accent:'#6fdac6', motif:'constellation'},
  {light:'#fff4cf', mid:'#8a8d58', shade:'#1d2b19', accent:'#e0d785', motif:'nested'},
  {light:'#ccffff', mid:'#397b8b', shade:'#0a1d2b', accent:'#a2d6df', motif:'rings'},
  {light:'#f4fff0', mid:'#739289', shade:'#122d28', accent:'#e3f0d8', motif:'phase'}
];

export {MATERIALS};

const INITIAL_ORIENTATION = multiplyQuaternion(axisAngle({x:1,y:0,z:0}, -.22), axisAngle({x:0,y:1,z:0}, .62));
const n = value => Number(value.toFixed(3));

const SphereMotif = memo(function SphereMotif({material, index}) {
  const stroke = material.accent;
  const common = {fill:'none', stroke, strokeWidth:1.1, opacity:.45};
  switch (material.motif) {
    case 'liquid': return <g {...common}>
      <path d="M -99 -17 C -49 -84 3 -39 64 -91 M -104 20 C -61 -43 13 3 100 -52 M -91 58 C -18 -8 31 67 106 10" />
      <path d="M -95 -30 C -39 -74 -7 -19 55 -63 M -85 72 C -11 29 25 71 86 31" opacity=".38" strokeWidth="7" />
    </g>;
    case 'orbital': return <g {...common}>
      <ellipse rx="91" ry="30" transform="rotate(-28)" /><ellipse rx="81" ry="46" transform="rotate(42)" opacity=".6" />
      <path d="M -75 -27 C -15 -69 74 -40 86 10" strokeWidth="3" opacity=".45" />
      <circle cx="-38" cy="-27" r="5" fill={stroke} stroke="none" opacity=".64" />
    </g>;
    case 'crystal': return <g stroke={stroke} strokeWidth=".7" opacity=".43">
      <path d="M -73 -68 L 2 -86 L 54 -20 L -31 10 Z" fill={stroke} fillOpacity=".14" />
      <path d="M -31 10 L 54 -20 L 89 43 L 13 89 Z" fill={stroke} fillOpacity=".07" />
      <path d="M -95 12 L -31 10 L 13 89 L -60 70 Z" fill={stroke} fillOpacity=".16" />
      <path d="M 2 -86 L -31 10 L 13 89 M -95 12 L 54 -20" fill="none" />
    </g>;
    case 'aurora': return <g {...common}>
      <path d="M -80 87 C 17 5 -102 -36 31 -83 S 102 -44 90 39" strokeWidth="17" opacity=".13" />
      <path d="M -94 68 C 1 -9 -93 -43 32 -84 M -72 90 C 39 18 -60 -5 63 -68" strokeWidth="2.2" />
      <path d="M -104 31 C -22 63 6 -67 107 -16" opacity=".32" />
    </g>;
    case 'embers': return <g {...common}>
      <path d="M -100 -43 C -45 4 -12 -67 101 -37 M -94 8 C -20 70 -11 -22 96 10 M -71 71 C -4 43 38 94 84 39" strokeWidth="3.2" opacity=".38" />
      <path d="M -102 -46 C -51 -4 -13 -68 100 -39 M -94 6 C -16 62 -8 -26 98 8" />
      {[[-44,-34],[18,12],[51,-35],[-32,40]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%2?1.5:2.5} fill={stroke} stroke="none" />)}
    </g>;
    case 'bands': return <g {...common} transform="rotate(-23)">
      {[-60,-38,-16,6,28,50,72].map((y,i)=><path key={y} d={`M -107 ${y} Q 0 ${y+34} 107 ${y}`} strokeWidth={i%3===0?10:2} opacity={i%3===0?.16:.5} />)}
    </g>;
    case 'constellation': return <g {...common}>
      <path d="M -58 -32 L -10 -65 L 41 -25 L 62 36 L 4 52 L -40 20 Z M -10 -65 L 4 52" opacity=".2" />
      {[[-58,-32],[-10,-65],[41,-25],[62,36],[4,52],[-40,20],[-7,-8]].map(([x,y],i)=><g key={i}>
        <circle cx={x} cy={y} r={i%2?2:3.5} fill={stroke} stroke="none" />
        {i%3===0&&<path d={`M ${x-5} ${y} H ${x+5} M ${x} ${y-5} V ${y+5}`} opacity=".65" />}
      </g>)}
    </g>;
    case 'nested': return <g {...common} transform="rotate(25)">
      {[24,43,65,88].map((r,i)=><ellipse key={r} cx={i*5-13} cy="-7" rx={r} ry={r*.77} opacity={.64-i*.12} strokeWidth={i===1?2:1} />)}
      <path d="M -57 -49 A 70 65 0 0 1 64 14" strokeWidth="5" opacity=".16" />
    </g>;
    case 'rings': return <g {...common}>
      <path d="M -96 -24 Q 6 74 102 17 M -96 -36 Q 4 57 108 4" strokeWidth="1.8" />
      <path d="M -97 -30 Q 4 64 107 10" strokeWidth="8" opacity=".14" />
      <ellipse rx="87" ry="30" transform="rotate(22)" opacity=".25" />
    </g>;
    default: return <g {...common}>
      <path d="M 20 -99 C -54 -68 -37 52 54 86 C -104 76 -118 -61 20 -99" fill={stroke} fillOpacity=".1" stroke="none" />
      <path d="M 20 -99 C -54 -68 -37 52 54 86 M -10 -89 C -68 -44 -45 36 17 76" opacity=".6" />
      <circle cx="-22" cy="-36" r="33" strokeDasharray="1.5 8" opacity=".35" />
    </g>;
  }
});

function MaterialDefs({prefix}) {
  return <defs>
    <radialGradient id={`${prefix}-shell`} cx="37%" cy="27%" r="70%">
      <stop offset="0" stopColor="#35584b" stopOpacity=".13" />
      <stop offset=".56" stopColor="#10251e" stopOpacity=".025" />
      <stop offset=".89" stopColor="#49a990" stopOpacity=".015" />
      <stop offset="1" stopColor="#6cc8bc" stopOpacity=".08" />
    </radialGradient>
    <linearGradient id={`${prefix}-edge`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#b8e4d5" /><stop offset=".34" stopColor="#72a89d" />
      <stop offset=".65" stopColor="#aca7d1" /><stop offset="1" stopColor="#8dbb92" />
    </linearGradient>
    {MATERIALS.map((material,index)=><React.Fragment key={index}>
      <radialGradient id={`${prefix}-body-${index}`} cx="30%" cy="24%" r="77%">
        <stop offset="0" stopColor={material.light} stopOpacity=".98" />
        <stop offset=".14" stopColor={material.accent} stopOpacity=".88" />
        <stop offset=".44" stopColor={material.mid} />
        <stop offset=".79" stopColor={material.shade} />
        <stop offset="1" stopColor="#020b0a" />
      </radialGradient>
      <radialGradient id={`${prefix}-halo-${index}`}>
        <stop offset=".54" stopColor={material.mid} stopOpacity=".16" />
        <stop offset=".76" stopColor={material.accent} stopOpacity=".04" />
        <stop offset="1" stopColor={material.accent} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${prefix}-sheen-${index}`} x1=".18" y1="0" x2=".82" y2="1">
        <stop offset="0" stopColor={material.light} stopOpacity=".56" />
        <stop offset=".25" stopColor={material.accent} stopOpacity=".05" />
        <stop offset=".7" stopColor={material.shade} stopOpacity="0" />
        <stop offset="1" stopColor={material.accent} stopOpacity=".19" />
      </linearGradient>
    </React.Fragment>)}
    <clipPath id={`${prefix}-sphere-clip`}><circle r="100" /></clipPath>
  </defs>;
}

const Sphere = memo(function Sphere({node, prefix, selected, focused, hovered, empty}) {
  const index=node.index%MATERIALS.length, material=MATERIALS[index];
  const active=selected||focused||hovered;
  const depthOpacity=.57+(node.depth+208)/416*.43;
  return <g aria-hidden="true" className={`hologram-sphere${selected?' is-selected':''}`}
    transform={`translate(${n(node.x)} ${n(node.y)}) scale(${n(node.projectedRadius/100)})`}
    opacity={n(depthOpacity*(empty?.73:1))}>
    <circle r="164" fill={`url(#${prefix}-halo-${index})`} opacity={active?1:.7} />
    {index===8&&<ellipse rx="137" ry="42" transform="rotate(24)" fill="none" stroke={material.accent} strokeWidth="1.4" opacity=".26" />}
    {index===1&&<ellipse rx="116" ry="64" transform="rotate(-35)" fill="none" stroke={material.accent} strokeWidth=".9" opacity=".2" />}
    <circle r="100" fill={`url(#${prefix}-body-${index})`} />
    <g clipPath={`url(#${prefix}-sphere-clip)`}>
      <SphereMotif material={material} index={index} />
      <circle r="100" fill={`url(#${prefix}-sheen-${index})`} />
      <ellipse cx="-31" cy="-48" rx="28" ry="11" transform="rotate(-29 -31 -48)" fill={material.light} opacity=".23" />
      <path d="M -78 -46 A 89 89 0 0 1 -16 -91" fill="none" stroke={material.light} strokeWidth="1.8" opacity=".56" />
      <path d="M 45 76 A 86 86 0 0 0 82 10" fill="none" stroke={material.accent} strokeWidth="2.4" opacity=".32" />
    </g>
    <circle r="100" fill="none" stroke={material.accent} strokeWidth=".75" opacity=".41" />
    {active&&<circle r="112" fill="none" stroke={material.light} strokeWidth={focused?2.7:1.7} opacity={selected?.8:.55} strokeDasharray={focused?'4 5':undefined} />}
    {index===8&&<path d="M -130 -35 C -82 41 82 92 129 36" fill="none" stroke={material.accent} strokeWidth="1.7" opacity=".43" />}
  </g>;
});

function countFor(counts,id) {
  if (counts instanceof Map) return counts.get(id);
  if (Array.isArray(counts)) return id==='all'?counts.length:counts.filter(event=>event.theme===id).length;
  if (counts && typeof counts==='object') return counts[id];
  return undefined;
}

export default function Numogram({themes=[],links=[],selectedTheme='',onSelect,counts}) {
  const prefix=`holo-${useId().replace(/[^a-zA-Z0-9]/g,'')}`;
  const svgRef=useRef(null), gestureRef=useRef(null), orientationRef=useRef(INITIAL_ORIENTATION), sceneRef=useRef(null);
  const callbacks=useRef({selectedTheme,onSelect}); callbacks.current={selectedTheme,onSelect};
  const [orientation,setOrientation]=useState(INITIAL_ORIENTATION), [dragging,setDragging]=useState(false);
  const [hovered,setHovered]=useState(''), [focused,setFocused]=useState('');
  const model=useMemo(()=>createModel(themes),[themes]);
  const scene=useMemo(()=>buildScene(model,links,orientation),[model,links,orientation]); sceneRef.current=scene;

  useEffect(()=>{
    const svg=svgRef.current;
    if (!svg) return undefined;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let inView=true, pageActive=true;
    const loop=createMotionLoop({
      requestFrame:callback=>window.requestAnimationFrame(callback), cancelFrame:id=>window.cancelAnimationFrame(id),
      onFrame(delta) {
        if (gestureRef.current) return;
        const turn=axisAngle({x:.17,y:1,z:.055},delta*.13);
        orientationRef.current=multiplyQuaternion(turn,orientationRef.current);
        setOrientation(orientationRef.current);
      }
    });
    const sync=()=>loop.setRunning(pageActive&&!document.hidden&&inView&&!reduced?.matches);
    const hide=()=>{pageActive=false;loop.setRunning(false);gestureRef.current=null;setDragging(false);};
    const show=()=>{pageActive=true;sync();};
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      inView=entries[0]?.isIntersecting??true;sync();
    },{rootMargin:'80px'}):null;
    observer?.observe(svg);
    document.addEventListener('visibilitychange',sync);
    window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
    reduced?.addEventListener?.('change',sync);
    sync();
    return ()=>{
      loop.dispose();observer?.disconnect();
      document.removeEventListener('visibilitychange',sync);
      window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);
      reduced?.removeEventListener?.('change',sync);
      if (gestureRef.current) {
        const id=gestureRef.current.pointerId;
        if (svg.hasPointerCapture?.(id)) svg.releasePointerCapture(id);
        gestureRef.current=null;
      }
    };
  },[]);

  const activate=id=>callbacks.current.onSelect?.(id==='all'||callbacks.current.selectedTheme===id?'':id);
  const point=event=>{
    const rect=svgRef.current.getBoundingClientRect();
    // The CSS gives the SVG a square viewport; account for letterboxing if embedded otherwise.
    const side=Math.min(rect.width,rect.height),left=rect.left+(rect.width-side)/2,top=rect.top+(rect.height-side)/2;
    return {x:(event.clientX-left)*720/side,y:(event.clientY-top)*720/side,
      minimumRadius:event.pointerType==='touch'?22*720/side:24};
  };
  const release=event=>{
    if (svgRef.current?.hasPointerCapture?.(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  };
  const pointerDown=event=>{
    if (event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||gestureRef.current) return;
    gestureRef.current=beginGesture({pointerId:event.pointerId,x:event.clientX,y:event.clientY,
      pointerType:event.pointerType,orientation:orientationRef.current});
    svgRef.current.setPointerCapture?.(event.pointerId);
  };
  const pointerMove=event=>{
    const gesture=gestureRef.current;
    if (!gesture) {
      if (event.pointerType!=='touch') {const p=point(event);setHovered(hitTest(sceneRef.current.nodes,p.x,p.y)?.id||'');}
      return;
    }
    if (gesture.pointerId!==event.pointerId) return;
    const next=advanceGesture(gesture,{pointerId:event.pointerId,x:event.clientX,y:event.clientY});
    gestureRef.current=next;
    if(next.status==='scrolling') {gestureRef.current=null;setDragging(false);release(event);return;}
    if(next.status==='dragging') {
      setDragging(true);setHovered('');orientationRef.current=next.orientation;setOrientation(next.orientation);
      if(event.cancelable&&event.pointerType!=='touch')event.preventDefault();
    }
  };
  const pointerEnd=(event,canceled=false)=>{
    const ended=finishGesture(gestureRef.current,event.pointerId,canceled);
    if (!ended) return;
    gestureRef.current=null;setDragging(false);release(event);
    if(ended.activate) {
      const p=point(event),node=hitTest(sceneRef.current.nodes,p.x,p.y,p.minimumRadius);
      if(node)activate(node.id);
    }
  };

  return <div className="hologram-space">
    <svg ref={svgRef} className={`hologram-numogram${dragging?' is-dragging':''}`} viewBox="0 0 720 720"
      role="group" aria-label="Объёмная нумограмма. Выберите сферу или поверните её перетаскиванием."
      style={{touchAction:'pan-y',userSelect:'none'}}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event=>pointerEnd(event)}
      onPointerCancel={event=>pointerEnd(event,true)} onLostPointerCapture={event=>pointerEnd(event,true)}
      onPointerLeave={()=>setHovered('')}>
      <MaterialDefs prefix={prefix} />
      <g aria-hidden="true" pointerEvents="none">
        <circle cx="360" cy="360" r="269" fill={`url(#${prefix}-shell)`} />
        <circle cx="360" cy="360" r="269" fill="none" stroke={`url(#${prefix}-edge)`} strokeWidth=".65" opacity=".12" />
        <path d="M 156 186 A 269 269 0 0 1 413 96" fill="none" stroke="#c0e5d7" strokeWidth="1.1" opacity=".19" />
        <path d="M 567 528 A 269 269 0 0 1 379 628" fill="none" stroke="#8db8cb" strokeWidth=".8" opacity=".16" />
        {scene.items.map(item=>item.type==='edge'?<line key={item.key} x1={n(item.x1)} y1={n(item.y1)} x2={n(item.x2)} y2={n(item.y2)}
          stroke={`url(#${prefix}-edge)`} strokeWidth={selectedTheme&&(item.a===selectedTheme||item.b===selectedTheme)?1.2:.65}
          opacity={n((.07+(item.depth+208)/416*.15)*(selectedTheme&&(item.a===selectedTheme||item.b===selectedTheme)?1.6:1))} strokeLinecap="round" />:
          <Sphere key={item.key} node={item} prefix={prefix} selected={selectedTheme===item.id}
            focused={focused===item.id} hovered={hovered===item.id} empty={countFor(counts,item.id)===0} />)}
      </g>
      {scene.nodes.map(node=><g key={node.id} role="button" tabIndex="0" className="hologram-target"
        aria-label={node.name} aria-pressed={node.id==='all'?!selectedTheme:selectedTheme===node.id}
        data-theme={node.id} onFocus={()=>setFocused(node.id)} onBlur={()=>setFocused('')}
        onClick={event=>{if(event.detail===0)activate(node.id);}}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(node.id);}}}>
        <circle cx={n(node.x)} cy={n(node.y)} r={n(Math.max(node.projectedRadius,24))} fill="transparent" stroke="none" />
      </g>)}
    </svg>
  </div>;
}
