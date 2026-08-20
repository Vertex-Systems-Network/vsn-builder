(function(){
  "use strict";
  const initialized = new WeakSet();
  const delegated = { click:[], mouseover:[], focusin:[], submit:[] };
  let delegationReady = false;
  function registerDelegated(type, el, timeline, exec) {
    delegated[type].push({el,timeline,exec});
    if (delegationReady) return;
    delegationReady = true;
    for (const eventType of Object.keys(delegated)) document.addEventListener(eventType, (event) => {
      for (const row of delegated[eventType]) {
        if (!row.el?.isConnected || !row.el.contains(event.target)) continue;
        const selector = String(row.timeline.trigger?.selector || "").trim();
        if (selector) {
          let matched = null; try { matched = event.target?.closest?.(selector); } catch { continue; }
          if (!matched || !row.el.contains(matched)) continue;
          if (eventType === "mouseover" && event.relatedTarget && matched.contains?.(event.relatedTarget)) continue;
        } else if (eventType === "mouseover" && event.relatedTarget && row.el.contains(event.relatedTarget)) continue;
        row.exec(row.timeline, event);
      }
    });
  }
  function parse(el){ try { const raw=el.getAttribute("data-vsn-motion"); return raw?JSON.parse(raw):null; } catch { return null; } }
  function q(root,selector){ try{return selector?Array.from(root.querySelectorAll(selector)):[];}catch{return[];} }
  function targets(source,target){
    const mode=String(target?.mode||"self"), selector=String(target?.selector||"").trim();
    if(mode==="self")return[source];
    if(mode==="child")return selector?q(source,selector):Array.from(source.children||[]);
    if(mode==="sibling"){const p=source.parentElement;return p?Array.from(p.children||[]).filter(n=>n!==source&&(!selector||n.matches?.(selector))):[];}
    if(mode==="component-slot"){const c=source.closest?.("[data-vsn-component-id],[data-vsn-component-instance]");if(!c)return[];const slot=String(target?.slot||"").trim();return slot?q(c,`[data-vsn-component-slot="${slot.replace(/"/g,"\\\"")}"]`):(selector?q(c,selector):[c]);}
    if(mode==="page-selector")return q(source.closest?.("[data-vsn-page-boundary='1']")||document,selector);
    return[source];
  }
  function condition(source,c={}){
    let ok=true;const type=String(c.type||"media-query");
    if(type==="media-query"){const query=String(c.value||c.key||"").trim();ok=!query||!window.matchMedia||matchMedia(query).matches;}
    else if(type==="selector-exists"){const selector=String(c.value||c.key||"").trim();try{ok=!selector||!!source.closest?.("[data-vsn-page-boundary='1']")?.querySelector?.(selector);}catch{ok=false;}}
    else if(type==="attribute-equals")ok=String(source.getAttribute(String(c.key||""))||"")===String(c.value||"");
    else if(type==="reduced-motion")ok=!window.matchMedia||matchMedia("(prefers-reduced-motion: reduce)").matches;
    return c.negate===true?!ok:ok;
  }
  function styleFrame(frame={}){const x=Number(frame.x||0),y=Number(frame.y||0),scale=Number(frame.scale??1),rotate=Number(frame.rotate||0);const out={transform:`translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${rotate}deg)`};if(frame.opacity!==null&&frame.opacity!==undefined)out.opacity=String(frame.opacity);if(frame.filter)out.filter=String(frame.filter);return out;}
  function animationFrames(action={}){const middle=(Array.isArray(action.keyframes)?action.keyframes:[]).map(item=>({...styleFrame(item.frame||{}),offset:Math.max(.01,Math.min(.99,Number(item.offset||.5)))}));return[{...styleFrame(action.from||{}),offset:0},...middle,{...styleFrame(action.to||{}),offset:1}];}
  function frameAtProgress(action={},progress=0){const rows=[{offset:0,frame:action.from||{}},...(Array.isArray(action.keyframes)?action.keyframes.map(item=>({offset:Number(item.offset||.5),frame:item.frame||{}})):[]),{offset:1,frame:action.to||{}}].sort((a,b)=>a.offset-b.offset);const p=Math.max(0,Math.min(1,Number(progress)||0));let left=rows[0],right=rows[rows.length-1];for(let i=1;i<rows.length;i++){if(p<=rows[i].offset){left=rows[i-1];right=rows[i];break;}}const span=Math.max(.0001,right.offset-left.offset),local=Math.max(0,Math.min(1,(p-left.offset)/span)),a=left.frame||{},b=right.frame||{},mix=(x,y,d=0)=>Number(x??d)+(Number(y??d)-Number(x??d))*local;return{opacity:a.opacity==null&&b.opacity==null?null:mix(a.opacity??1,b.opacity??1,1),x:mix(a.x,b.x),y:mix(a.y,b.y),scale:mix(a.scale,b.scale,1),rotate:mix(a.rotate,b.rotate),filter:local<.5?(a.filter||""):(b.filter||"")};}
  function detail(text=""){try{return text?JSON.parse(text):undefined}catch{return text||undefined}}
  function animateAction(source,action,timeline,index,progress){
    const list=targets(source,action.target);const base=action.duration===null||action.duration===undefined?Number(timeline.duration||400):Number(action.duration||0);const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;const reducedMode=timeline.reducedMotion||"instant";if(reduced&&reducedMode==="skip")return;const duration=reduced&&reducedMode!=="allow"?0:Math.max(0,base);const easing=action.easing&&action.easing!=="inherit"?action.easing:(timeline.easing||"ease");
    list.forEach((target,targetIndex)=>{
      const delay=Number(timeline.delay||0)+Number(action.delay||0)+Number(timeline.stagger||0)*(index+targetIndex);
      if(action.type==="animate"){
        if(progress!==null){Object.assign(target.style,styleFrame(frameAtProgress(action,progress)));return;}
        const frames=animationFrames(action);
        if(target.animate&&duration>0)target.animate(frames,{duration,delay,easing,iterations:timeline.yoyo?Math.max(2,(Number(timeline.repeat||0)+1)*2):Math.max(1,Number(timeline.repeat||0)+1),direction:timeline.yoyo?"alternate":"normal",fill:"both"});else Object.assign(target.style,frames[frames.length-1]);
        return;
      }
      const apply=()=>{
        if(action.type==="show")target.hidden=false;
        else if(action.type==="hide")target.hidden=true;
        else if(action.type==="class-toggle"&&action.className)target.classList.toggle(action.className);
        else if(action.type==="style-variable"&&action.variable)target.style.setProperty(action.variable.startsWith("--")?action.variable:`--${action.variable}`,action.value||"");
        else if(action.type==="scroll-to")(action.selector?document.querySelector(action.selector):target)?.scrollIntoView?.({behavior:action.behavior||"smooth",block:"start"});
        else if(action.type==="media-play"){const media=target.matches?.("video,audio")?target:target.querySelector?.("video,audio");media?.play?.().catch?.(()=>{});}
        else if(action.type==="media-pause"){const media=target.matches?.("video,audio")?target:target.querySelector?.("video,audio");media?.pause?.();}
        else if(action.type==="popup-open"){const popup=action.selector?document.querySelector(action.selector):null;if(popup){popup.hidden=false;popup.setAttribute("data-vsn-popup-open","1");}document.dispatchEvent(new CustomEvent("vsn:popup-open",{detail:{selector:action.selector||"",source}}));}
        else if(action.type==="custom-event"&&action.eventName)document.dispatchEvent(new CustomEvent(action.eventName,{detail:detail(action.eventDetail)}));
      };
      delay>0?setTimeout(apply,delay):apply();
    });
  }
  function run(source,timeline,event,progress=null){if(!timeline?.enabled||!timeline.actions?.length)return;if((timeline.conditions||[]).some(c=>!condition(source,c)))return;timeline.actions.forEach((a,i)=>animateAction(source,a,timeline.timeline||{},i,progress));source.dispatchEvent(new CustomEvent("vsn:interaction-run",{detail:{timelineId:timeline.id,trigger:timeline.trigger?.type,eventType:event?.type||""}}));}
  function initElement(el){
    if(initialized.has(el))return;const config=parse(el);if(!config?.timelines?.length)return;initialized.add(el);const done=new Set();const exec=(tl,e,p=null)=>{if(tl.trigger?.once&&done.has(tl.id))return;if(tl.trigger?.once)done.add(tl.id);run(el,tl,e,p);};
    const view=[];
    for(const tl of config.timelines){if(!tl.enabled)continue;const t=tl.trigger||{};
      if(["page-load","viewport-enter"].includes(t.type)){const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true,reducedMode=tl.timeline?.reducedMotion||"instant";if(!reduced||reducedMode==="allow")for(const a of tl.actions||[])if(a.type==="animate")for(const target of targets(el,a.target))Object.assign(target.style,styleFrame(a.from||{}));}
      if(t.type==="page-load")queueMicrotask(()=>exec(tl,{type:"page-load"}));
      else if(t.type==="click")registerDelegated("click",el,tl,exec);
      else if(t.type==="hover")registerDelegated("mouseover",el,tl,exec);
      else if(t.type==="focus")registerDelegated("focusin",el,tl,exec);
      else if(t.type==="form-submit")registerDelegated("submit",el,tl,exec);
      else if(t.type==="custom-event")document.addEventListener(t.eventName||"vsn:custom",e=>exec(tl,e));
      else if(t.type==="cart-event")["vsn:cart","cart:updated","product:added"].forEach(n=>document.addEventListener(n,e=>exec(tl,e)));
      else if(["viewport-enter","viewport-exit"].includes(t.type))view.push(tl);
      else if(t.type==="scroll-progress"){
        let raf=0;const update=()=>{raf=0;const r=el.getBoundingClientRect(),vh=innerHeight||document.documentElement.clientHeight||800,p=Math.max(0,Math.min(1,(vh-r.top)/(vh+r.height||1)));exec(tl,{type:"scroll-progress"},p)};const schedule=()=>{if(!raf)raf=requestAnimationFrame(update)};addEventListener("scroll",schedule,{passive:true});addEventListener("resize",schedule,{passive:true});schedule();
      } else if(t.type==="mouse-move")el.addEventListener("pointermove",e=>{const r=el.getBoundingClientRect(),nx=r.width?((e.clientX-r.left)/r.width-.5)*2:0,ny=r.height?((e.clientY-r.top)/r.height-.5)*2:0;const copy={...tl,actions:(tl.actions||[]).map(a=>a.type==="animate"?{...a,to:{...a.to,x:Number(a.to?.x||0)*nx,y:Number(a.to?.y||0)*ny}}:a)};exec(copy,e);},{passive:true});
    }
    if(view.length&&"IntersectionObserver"in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>view.forEach(tl=>{const threshold=Number(tl.trigger?.threshold??.15);if(tl.trigger?.type==="viewport-enter"&&entry.isIntersecting&&entry.intersectionRatio>=threshold)exec(tl,{type:"viewport-enter"});if(tl.trigger?.type==="viewport-exit"&&!entry.isIntersecting)exec(tl,{type:"viewport-exit"});})),{threshold:[0,.01,.05,.1,.15,.25,.5,.75,1]});observer.observe(el);}
  }
  function scan(root=document){if(root?.matches?.("[data-vsn-motion]"))initElement(root);root?.querySelectorAll?.("[data-vsn-motion]").forEach(initElement);}
  window.VSNInteractions={scan,run:(element,timelineId)=>{const config=parse(element);const tl=config?.timelines?.find(x=>x.id===timelineId);if(tl)run(element,tl,{type:"manual"});}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>scan(document),{once:true});else scan(document);
  const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)scan(node)})));observer.observe(document.documentElement,{childList:true,subtree:true});
})();
