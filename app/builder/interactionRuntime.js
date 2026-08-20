function parseConfig(element) {
  try {
    const raw = element?.getAttribute?.("data-vsn-motion");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}
function safeQuery(root, selector) { try { return selector ? Array.from(root?.querySelectorAll?.(selector) || []) : []; } catch { return []; } }
function targetsFor(source, target = {}, root = document) {
  const mode = String(target?.mode || "self");
  const selector = String(target?.selector || "").trim();
  if (mode === "self") return [source];
  if (mode === "child") return selector ? safeQuery(source, selector) : Array.from(source.children || []);
  if (mode === "sibling") {
    const parent = source.parentElement;
    return parent ? Array.from(parent.children || []).filter((node) => node !== source && (!selector || node.matches?.(selector))) : [];
  }
  if (mode === "component-slot") {
    const component = source.closest?.("[data-vsn-component-id]") || source.closest?.("[data-vsn-component-instance]");
    const slot = String(target?.slot || "").trim();
    if (!component) return [];
    if (slot) return safeQuery(component, `[data-vsn-component-slot="${globalThis.CSS?.escape ? globalThis.CSS.escape(slot) : slot}"]`);
    return selector ? safeQuery(component, selector) : [component];
  }
  if (mode === "page-selector") return safeQuery(source.closest?.("[data-vsn-page-boundary='1']") || root, selector);
  return [source];
}
function conditionPasses(source, condition = {}) {
  const type = String(condition.type || "media-query");
  let passed = true;
  if (type === "media-query") {
    const query = String(condition.value || condition.key || "").trim();
    passed = !query || typeof matchMedia !== "function" || matchMedia(query).matches;
  } else if (type === "selector-exists") {
    const selector = String(condition.value || condition.key || "").trim();
    passed = !selector || Boolean(source.closest?.("[data-vsn-page-boundary='1']")?.querySelector?.(selector));
  } else if (type === "attribute-equals") {
    passed = String(source.getAttribute?.(String(condition.key || "")) || "") === String(condition.value || "");
  } else if (type === "reduced-motion") {
    passed = typeof matchMedia !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return condition.negate === true ? !passed : passed;
}
function frameStyle(frame = {}) {
  const x = Number(frame.x || 0), y = Number(frame.y || 0), scale = Number(frame.scale ?? 1), rotate = Number(frame.rotate || 0);
  const out = { transform: `translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${rotate}deg)` };
  if (frame.opacity !== null && frame.opacity !== undefined) out.opacity = String(frame.opacity);
  if (frame.filter) out.filter = String(frame.filter);
  return out;
}
function animationFrames(action = {}) {
  const middle = (Array.isArray(action.keyframes) ? action.keyframes : []).map((item) => ({ ...frameStyle(item.frame || {}), offset: Math.max(0.01, Math.min(0.99, Number(item.offset || 0.5))) }));
  return [{ ...frameStyle(action.from || {}), offset: 0 }, ...middle, { ...frameStyle(action.to || {}), offset: 1 }];
}
function frameAtProgress(action = {}, progress = 0) {
  const rows = [{ offset:0, frame:action.from || {} }, ...(Array.isArray(action.keyframes)?action.keyframes.map(item=>({offset:Number(item.offset||0.5),frame:item.frame||{}})):[]), { offset:1, frame:action.to || {} }].sort((a,b)=>a.offset-b.offset);
  const p=Math.max(0,Math.min(1,Number(progress)||0));
  let left=rows[0], right=rows[rows.length-1];
  for(let i=1;i<rows.length;i++){ if(p<=rows[i].offset){left=rows[i-1];right=rows[i];break;} }
  const span=Math.max(.0001,right.offset-left.offset); const local=Math.max(0,Math.min(1,(p-left.offset)/span));
  const a=left.frame||{}, b=right.frame||{}; const mix=(x,y,d=0)=>Number(x??d)+(Number(y??d)-Number(x??d))*local;
  return { opacity:a.opacity==null&&b.opacity==null?null:mix(a.opacity??1,b.opacity??1,1), x:mix(a.x,b.x), y:mix(a.y,b.y), scale:mix(a.scale,b.scale,1), rotate:mix(a.rotate,b.rotate), filter:local<.5?(a.filter||""):(b.filter||"") };
}
function parseDetail(text = "") { try { return text ? JSON.parse(text) : undefined; } catch { return text || undefined; } }
function runAction(source, action, timeline, root, index = 0, progress = null) {
  const targets = targetsFor(source, action.target, root);
  const baseDuration = action.duration === null || action.duration === undefined ? Number(timeline.duration || 400) : Number(action.duration || 0);
  const delay = Number(timeline.delay || 0) + Number(action.delay || 0) + (Number(timeline.stagger || 0) * index);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reducedMode = timeline.reducedMotion || "instant";
  if (reduced && reducedMode === "skip") return [];
  const duration = reduced && reducedMode !== "allow" ? 0 : Math.max(0, baseDuration);
  const easing = action.easing && action.easing !== "inherit" ? action.easing : (timeline.easing || "ease");
  const animations = [];
  targets.forEach((target, targetIndex) => {
    const staggerDelay = delay + Number(timeline.stagger || 0) * targetIndex;
    if (action.type === "animate") {
      if (progress !== null) {
        Object.assign(target.style, frameStyle(frameAtProgress(action, progress)));
        return;
      }
      const keyframes = animationFrames(action);
      if (typeof target.animate === "function" && duration > 0) {
        const animation = target.animate(keyframes, { duration, delay:staggerDelay, easing, iterations:timeline.yoyo ? Math.max(2,(Number(timeline.repeat||0)+1)*2) : Math.max(1,Number(timeline.repeat||0)+1), direction:timeline.yoyo?"alternate":"normal", fill:"both" });
        animations.push(animation);
      } else Object.assign(target.style, keyframes[keyframes.length-1]);
    } else if (action.type === "show") target.hidden = false;
    else if (action.type === "hide") target.hidden = true;
    else if (action.type === "class-toggle" && action.className) target.classList.toggle(action.className);
    else if (action.type === "style-variable" && action.variable) target.style.setProperty(action.variable.startsWith("--") ? action.variable : `--${action.variable}`, action.value || "");
    else if (action.type === "scroll-to") (action.selector ? document.querySelector(action.selector) : target)?.scrollIntoView?.({behavior:action.behavior||"smooth",block:"start"});
    else if (action.type === "media-play") { const media = target.matches?.("video,audio") ? target : target.querySelector?.("video,audio"); media?.play?.().catch?.(()=>{}); }
    else if (action.type === "media-pause") { const media = target.matches?.("video,audio") ? target : target.querySelector?.("video,audio"); media?.pause?.(); }
    else if (action.type === "popup-open") {
      const popup = action.selector ? document.querySelector(action.selector) : null;
      if (popup) { popup.hidden = false; popup.setAttribute("data-vsn-popup-open","1"); }
      document.dispatchEvent(new CustomEvent("vsn:popup-open",{detail:{selector:action.selector||"",source}}));
    } else if (action.type === "custom-event" && action.eventName) {
      document.dispatchEvent(new CustomEvent(action.eventName,{detail:parseDetail(action.eventDetail)}));
    }
  });
  return animations;
}
function runTimeline(source, config, event, root, progress = null) {
  if (!config?.enabled || !Array.isArray(config.actions) || !config.actions.length) return [];
  if ((config.conditions || []).some((condition) => !conditionPasses(source, condition))) return [];
  const timeline = config.timeline || {};
  const animations = [];
  config.actions.forEach((action,index)=>animations.push(...runAction(source,action,timeline,root,index,progress)));
  source.dispatchEvent?.(new CustomEvent("vsn:interaction-run",{bubbles:false,detail:{timelineId:config.id,trigger:config.trigger?.type,eventType:event?.type||""}}));
  return animations;
}

export function setupInteractionRuntime(root = document) {
  if (!root?.querySelectorAll) return () => {};
  const cleanups = [], observers = [], seen = new WeakMap();
  const nodes = Array.from(root.querySelectorAll("[data-vsn-motion]"));
  const byElement = nodes.map((element)=>({element,config:parseConfig(element)})).filter((row)=>row.config?.timelines?.length);
  const add = (target,event,handler,options) => { target.addEventListener(event,handler,options); cleanups.push(()=>target.removeEventListener(event,handler,options)); };
  const execute = (element,timeline,event,progress=null) => {
    if (timeline.trigger?.once) {
      const done = seen.get(element) || new Set(); if (done.has(timeline.id)) return; done.add(timeline.id); seen.set(element,done);
    }
    runTimeline(element,timeline,event,root,progress);
  };
  const viewportTimelines = [];
  const scrollRows = [];
  for (const {element,config} of byElement) for (const timeline of config.timelines) {
    if (!timeline.enabled) continue;
    const trigger = timeline.trigger || {};
    if (["page-load","viewport-enter"].includes(trigger.type)) {
      const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const reducedMode = timeline.timeline?.reducedMotion || "instant";
      if (!reduced || reducedMode === "allow") for (const action of timeline.actions || []) if (action.type === "animate") for (const target of targetsFor(element, action.target, root)) Object.assign(target.style, frameStyle(action.from || {}));
    }
    if (trigger.type === "page-load") queueMicrotask(()=>execute(element,timeline,{type:"page-load"}));
    else if (["viewport-enter","viewport-exit"].includes(trigger.type)) viewportTimelines.push({element,timeline});
    else if (trigger.type === "click") add(element,"click",(event)=>{ const selector=String(trigger.selector||"").trim(); if(!selector || event.target?.closest?.(selector)) execute(element,timeline,event); });
    else if (trigger.type === "hover") add(element,trigger.selector?"mouseover":"mouseenter",(event)=>{ const selector=String(trigger.selector||"").trim(); if(!selector || event.target?.closest?.(selector)) execute(element,timeline,event); });
    else if (trigger.type === "focus") add(element,"focusin",(event)=>{ const selector=String(trigger.selector||"").trim(); if(!selector || event.target?.closest?.(selector)) execute(element,timeline,event); });
    else if (trigger.type === "form-submit") add(element,"submit",(event)=>{ const selector=String(trigger.selector||"").trim(); if(!selector || event.target?.closest?.(selector) || event.target?.matches?.(selector)) execute(element,timeline,event); });
    else if (trigger.type === "custom-event") add(document,trigger.eventName||"vsn:custom",(event)=>execute(element,timeline,event));
    else if (trigger.type === "cart-event") ["vsn:cart","cart:updated","product:added"].forEach((name)=>add(document,name,(event)=>execute(element,timeline,event)));
    else if (["scroll-progress","mouse-move"].includes(trigger.type)) scrollRows.push({element,timeline,type:trigger.type});
  }
  if (viewportTimelines.length && typeof IntersectionObserver !== "undefined") {
    const map = new Map(); viewportTimelines.forEach((row)=>{ if(!map.has(row.element))map.set(row.element,[]);map.get(row.element).push(row.timeline); });
    const observer = new IntersectionObserver((entries)=>entries.forEach((entry)=>{ for(const timeline of map.get(entry.target)||[]) { if (timeline.trigger.type === "viewport-enter" && entry.isIntersecting && entry.intersectionRatio >= Number(timeline.trigger?.threshold ?? 0.15)) execute(entry.target,timeline,{type:"viewport-enter"}); if (timeline.trigger.type === "viewport-exit" && !entry.isIntersecting) execute(entry.target,timeline,{type:"viewport-exit"}); } }),{threshold:[0,.01,.15,.5,1]});
    map.forEach((_,element)=>observer.observe(element)); observers.push(observer);
  }
  if (scrollRows.some((row)=>row.type==="scroll-progress")) {
    let raf=0; const update=()=>{raf=0;const vh=window.innerHeight||document.documentElement.clientHeight||800;scrollRows.filter(r=>r.type==="scroll-progress").forEach(({element,timeline})=>{const rect=element.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(vh-rect.top)/(vh+rect.height||1)));execute(element,timeline,{type:"scroll-progress"},progress);});};
    const schedule=()=>{if(!raf)raf=requestAnimationFrame(update)}; add(window,"scroll",schedule,{passive:true}); add(window,"resize",schedule,{passive:true}); schedule(); cleanups.push(()=>raf&&cancelAnimationFrame(raf));
  }
  for (const {element,timeline,type} of scrollRows.filter((row)=>row.type==="mouse-move")) {
    add(element,"pointermove",(event)=>{const rect=element.getBoundingClientRect();const nx=rect.width?((event.clientX-rect.left)/rect.width-.5)*2:0;const ny=rect.height?((event.clientY-rect.top)/rect.height-.5)*2:0;const t={...timeline,actions:(timeline.actions||[]).map((a)=>a.type==="animate"?{...a,to:{...a.to,x:Number(a.to?.x||0)*nx,y:Number(a.to?.y||0)*ny}}:a)};execute(element,t,event);},{passive:true});
  }
  add(document,"vsn:preview-interaction",(event)=>{const id=String(event.detail?.elementId||"");const timelineId=String(event.detail?.timelineId||"");const element=(root.querySelector?.(`[data-vsn-id="${id.replace(/"/g,'\\"')}"]`)||document.querySelector?.(`[data-vsn-id="${id.replace(/"/g,'\\"')}"]`));const config=element?parseConfig(element):null;const timeline=config?.timelines?.find((item)=>item.id===timelineId);if(element&&timeline)runTimeline(element,timeline,event,root);});
  return () => { cleanups.forEach((fn)=>{try{fn()}catch{}}); observers.forEach((observer)=>observer.disconnect?.()); };
}

export { runTimeline };
