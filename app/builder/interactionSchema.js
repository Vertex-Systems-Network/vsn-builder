export const INTERACTION_SCHEMA_VERSION = 4;
export const STICKY_BOUNDARY_OPTIONS = Object.freeze(["parent", "column", "section", "page", "custom"]);

export const MOTION_TRIGGER_OPTIONS = Object.freeze([
  { value: "page-load", label: "Page Load" },
  { value: "viewport-enter", label: "Viewport Enter" },
  { value: "viewport-exit", label: "Viewport Exit" },
  { value: "click", label: "Click" },
  { value: "hover", label: "Hover" },
  { value: "focus", label: "Focus" },
  { value: "scroll-progress", label: "Scroll Progress" },
  { value: "mouse-move", label: "Mouse Move" },
  { value: "form-submit", label: "Form Submit" },
  { value: "cart-event", label: "Cart Event" },
  { value: "custom-event", label: "Custom Event" },
]);
export const MOTION_ACTION_OPTIONS = Object.freeze([
  { value: "animate", label: "Animate Style" },
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
  { value: "class-toggle", label: "Toggle Class" },
  { value: "style-variable", label: "Set CSS Variable" },
  { value: "scroll-to", label: "Scroll To" },
  { value: "media-play", label: "Play Media" },
  { value: "media-pause", label: "Pause Media" },
  { value: "popup-open", label: "Open Popup" },
  { value: "custom-event", label: "Dispatch Custom Event" },
]);
export const MOTION_TARGET_OPTIONS = Object.freeze([
  { value: "self", label: "This Element" },
  { value: "child", label: "Child Selector" },
  { value: "sibling", label: "Sibling Selector" },
  { value: "component-slot", label: "Component Slot" },
  { value: "page-selector", label: "Page Selector" },
]);
export const MOTION_EASING_OPTIONS = Object.freeze([
  { value: "linear", label: "Linear" },
  { value: "ease", label: "Ease" },
  { value: "ease-in", label: "Ease In" },
  { value: "ease-out", label: "Ease Out" },
  { value: "ease-in-out", label: "Ease In Out" },
  { value: "cubic-bezier(0.22,1,0.36,1)", label: "Smooth Out" },
  { value: "cubic-bezier(0.16,1,0.3,1)", label: "Expo Out" },
  { value: "cubic-bezier(0.34,1.56,0.64,1)", label: "Back Out" },
]);

const TRIGGERS = new Set(MOTION_TRIGGER_OPTIONS.map((item) => item.value));
const ACTIONS = new Set(MOTION_ACTION_OPTIONS.map((item) => item.value));
const TARGETS = new Set(MOTION_TARGET_OPTIONS.map((item) => item.value));
const EASINGS = new Set(MOTION_EASING_OPTIONS.map((item) => item.value));

export const DEFAULT_ELEMENT_INTERACTIONS = Object.freeze({
  entrance: "none",
  hover: "none",
  sticky: false,
  stickyBoundary: "parent",
  stickyOffset: 12,
  stickyEndOffset: 0,
  stickyZIndex: 20,
  stickyCustomTarget: "",
  stickyDesktop: true,
  stickyTablet: true,
  stickyMobile: true,
  parallax: false,
  schemaVersion: INTERACTION_SCHEMA_VERSION,
  timelines: Object.freeze([]),
});

function finiteNumber(value, fallback, min = -100000, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
function safeText(value, max = 256) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function uid(prefix = "motion") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }

export function normalizeStickyBoundary(value) {
  const boundary = String(value || "parent").trim().toLowerCase();
  return STICKY_BOUNDARY_OPTIONS.includes(boundary) ? boundary : "parent";
}

export function createMotionAction(input = {}) {
  return normalizeMotionAction({ id: uid("action"), type: "animate", target: { mode: "self", selector: "" }, to: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: "" }, ...input });
}
export function normalizeMotionAction(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const type = ACTIONS.has(String(source.type || "")) ? String(source.type) : "animate";
  const targetSource = source.target && typeof source.target === "object" ? source.target : {};
  const target = {
    mode: TARGETS.has(String(targetSource.mode || "")) ? String(targetSource.mode) : "self",
    selector: safeText(targetSource.selector, 512),
    slot: safeText(targetSource.slot, 128),
  };
  const from = source.from && typeof source.from === "object" ? source.from : {};
  const to = source.to && typeof source.to === "object" ? source.to : {};
  const normFrame = (frame, defaults = {}) => ({
    opacity: frame.opacity === "" || frame.opacity === undefined || frame.opacity === null ? (defaults.opacity ?? null) : finiteNumber(frame.opacity, defaults.opacity ?? 1, 0, 1),
    x: finiteNumber(frame.x, defaults.x ?? 0, -10000, 10000),
    y: finiteNumber(frame.y, defaults.y ?? 0, -10000, 10000),
    scale: finiteNumber(frame.scale, defaults.scale ?? 1, 0, 100),
    rotate: finiteNumber(frame.rotate, defaults.rotate ?? 0, -36000, 36000),
    filter: safeText(frame.filter ?? defaults.filter ?? "", 512),
  });
  return {
    id: safeText(source.id, 128) || uid("action"),
    type,
    target,
    duration: source.duration === "" || source.duration === null || source.duration === undefined ? null : finiteNumber(source.duration, 400, 0, 120000),
    delay: finiteNumber(source.delay, 0, 0, 120000),
    easing: EASINGS.has(String(source.easing || "")) ? String(source.easing) : "inherit",
    from: normFrame(from, { opacity:null, x:0, y:0, scale:1, rotate:0, filter:"" }),
    to: normFrame(to, { opacity:null, x:0, y:0, scale:1, rotate:0, filter:"" }),
    keyframes: (Array.isArray(source.keyframes) ? source.keyframes : []).slice(0, 12).map((item) => ({
      id: safeText(item?.id, 128) || uid("keyframe"),
      offset: finiteNumber(item?.offset, 0.5, 0.01, 0.99),
      frame: normFrame(item?.frame || item || {}, { opacity:null, x:0, y:0, scale:1, rotate:0, filter:"" }),
    })).sort((a,b)=>a.offset-b.offset),
    className: safeText(source.className, 256),
    variable: safeText(source.variable, 256),
    value: safeText(source.value, 1024),
    selector: safeText(source.selector, 512),
    behavior: ["auto", "smooth"].includes(String(source.behavior)) ? String(source.behavior) : "smooth",
    eventName: safeText(source.eventName, 256),
    eventDetail: safeText(source.eventDetail, 2048),
  };
}

export function createMotionTimeline(input = {}) {
  return normalizeMotionTimeline({
    id: uid("timeline"), name: "Interaction", enabled: true,
    trigger: { type: "click", once: false, threshold: 0.15, eventName: "", selector: "" },
    conditions: [], timeline: { duration: 400, delay: 0, easing: "ease", stagger: 0, repeat: 0, yoyo: false },
    actions: [createMotionAction()], ...input,
  });
}
export function normalizeMotionTimeline(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const triggerSource = source.trigger && typeof source.trigger === "object" ? source.trigger : {};
  const timelineSource = source.timeline && typeof source.timeline === "object" ? source.timeline : {};
  const type = TRIGGERS.has(String(triggerSource.type || "")) ? String(triggerSource.type) : "click";
  const easing = EASINGS.has(String(timelineSource.easing || "")) ? String(timelineSource.easing) : "ease";
  const conditions = Array.isArray(source.conditions) ? source.conditions.slice(0, 12).map((condition) => ({
    type: ["media-query", "selector-exists", "attribute-equals", "reduced-motion"].includes(String(condition?.type || "")) ? String(condition.type) : "media-query",
    key: safeText(condition?.key, 256),
    value: safeText(condition?.value, 512),
    negate: condition?.negate === true,
  })) : [];
  return {
    id: safeText(source.id, 128) || uid("timeline"),
    name: safeText(source.name, 120) || "Interaction",
    enabled: source.enabled !== false,
    trigger: {
      type,
      once: triggerSource.once === true,
      threshold: finiteNumber(triggerSource.threshold, 0.15, 0, 1),
      eventName: safeText(triggerSource.eventName, 256),
      selector: safeText(triggerSource.selector, 512),
    },
    conditions,
    timeline: {
      duration: finiteNumber(timelineSource.duration, 400, 0, 120000),
      delay: finiteNumber(timelineSource.delay, 0, 0, 120000),
      easing,
      stagger: finiteNumber(timelineSource.stagger, 0, 0, 30000),
      repeat: Math.round(finiteNumber(timelineSource.repeat, 0, 0, 100)),
      yoyo: timelineSource.yoyo === true,
      reducedMotion: ["instant", "skip", "allow"].includes(String(timelineSource.reducedMotion || "")) ? String(timelineSource.reducedMotion) : "instant",
    },
    actions: (Array.isArray(source.actions) ? source.actions : []).slice(0, 24).map(normalizeMotionAction),
  };
}

export function normalizeElementInteractions(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...DEFAULT_ELEMENT_INTERACTIONS,
    ...source,
    entrance: typeof source.entrance === "string" && source.entrance ? source.entrance : "none",
    hover: typeof source.hover === "string" && source.hover ? source.hover : "none",
    sticky: source.sticky === true,
    stickyBoundary: normalizeStickyBoundary(source.stickyBoundary),
    stickyOffset: finiteNumber(source.stickyOffset, 12, 0, 1000),
    stickyEndOffset: finiteNumber(source.stickyEndOffset, 0, 0, 1000),
    stickyZIndex: finiteNumber(source.stickyZIndex, 20, -1, 2147483000),
    stickyCustomTarget: typeof source.stickyCustomTarget === "string" ? source.stickyCustomTarget.trim().slice(0, 256) : "",
    stickyDesktop: source.stickyDesktop !== false,
    stickyTablet: source.stickyTablet !== false,
    stickyMobile: source.stickyMobile !== false,
    parallax: source.parallax === true,
    schemaVersion: INTERACTION_SCHEMA_VERSION,
    timelines: (Array.isArray(source.timelines) ? source.timelines : []).slice(0, 32).map(normalizeMotionTimeline),
  };
}

export function mergeElementInteractions(current, patch) {
  const base = normalizeElementInteractions(current);
  const next = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  return normalizeElementInteractions({ ...base, ...next });
}

export function createInteractionPreset(name = "fade-up") {
  const presets = {
    "fade-up": createMotionTimeline({ name: "Fade Up", trigger: { type: "viewport-enter", once: true, threshold: 0.15 }, timeline: { duration: 550, delay: 0, easing: "cubic-bezier(0.22,1,0.36,1)", stagger: 0, repeat: 0, yoyo: false }, actions: [createMotionAction({ from:{opacity:0,x:0,y:24,scale:1,rotate:0,filter:""}, to: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: "" } })] }),
    "click-scale": createMotionTimeline({ name: "Click Scale", trigger: { type: "click" }, timeline: { duration: 180, delay: 0, easing: "ease-out", stagger: 0, repeat: 1, yoyo: true }, actions: [createMotionAction({ from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, to: { opacity: 1, x: 0, y: 0, scale: 1.04, rotate: 0, filter: "" } })] }),
    "hover-lift": createMotionTimeline({ name: "Hover Lift", trigger: { type: "hover" }, timeline: { duration: 220, delay: 0, easing: "ease-out", stagger: 0, repeat: 0, yoyo: true }, actions: [createMotionAction({ from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, to: { opacity: 1, x: 0, y: -6, scale: 1, rotate: 0, filter: "" } })] }),
    "scroll-progress": createMotionTimeline({ name: "Scroll Progress", trigger: { type: "scroll-progress" }, timeline: { duration: 0, delay: 0, easing: "linear", stagger: 0, repeat: 0, yoyo: false }, actions: [createMotionAction({ from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, to: { opacity: 1, x: 0, y: -80, scale: 1, rotate: 0, filter: "" } })] }),
  };
  return normalizeMotionTimeline(presets[name] || presets["fade-up"]);
}

export function motionConflictWarnings(value) {
  const interactions = normalizeElementInteractions(value);
  const warnings = [];
  const propertyWriters = new Map();
  for (const timeline of interactions.timelines.filter((item) => item.enabled)) {
    for (const action of timeline.actions) {
      if (action.type !== "animate") continue;
      const target = `${action.target.mode}:${action.target.selector || action.target.slot || "self"}`;
      const properties = [];
      if (action.to.opacity !== null) properties.push("opacity");
      if (action.to.x || action.to.y || action.to.scale !== 1 || action.to.rotate) properties.push("transform");
      if (action.to.filter) properties.push("filter");
      for (const property of properties) {
        const key = `${target}:${property}`;
        const existing = propertyWriters.get(key);
        if (existing && existing !== timeline.id) warnings.push(`Multiple timelines write ${property} on ${target}.`);
        else propertyWriters.set(key, timeline.id);
      }
    }
  }
  return [...new Set(warnings)];
}

export function hasAdvancedInteractions(value) {
  return normalizeElementInteractions(value).timelines.some((timeline) => timeline.enabled && timeline.actions.length);
}

export function calculateBoundedStickyShift({ viewportTop = 0, naturalTop = 0, naturalBottom = 0, boundaryBottom = 0, topOffset = 12, endOffset = 0 } = {}) {
  const desired = Number(viewportTop || 0) + Math.max(0, Number(topOffset || 0)) - Number(naturalTop || 0);
  const maxShift = Math.max(0, Number(boundaryBottom || 0) - Math.max(0, Number(endOffset || 0)) - Number(naturalBottom || 0));
  return Math.max(0, Math.min(desired, maxShift));
}

export function isStickyEnabledForDevice(value, device = "desktop") {
  const interactions = normalizeElementInteractions(value);
  if (!interactions.sticky) return false;
  if (device === "mobile") return interactions.stickyMobile;
  if (device === "tablet") return interactions.stickyTablet;
  return interactions.stickyDesktop;
}

export function interactionEditorStyle(value, { parallaxOffset = 0, stickyActive } = {}) {
  const interactions = normalizeElementInteractions(value);
  const activeSticky = stickyActive === undefined ? interactions.sticky : stickyActive === true;
  const style = {};
  const translations = [];
  if (activeSticky) {
    style.position = "relative";
    style.zIndex = interactions.stickyZIndex;
    style["--vsn-editor-sticky-y"] = "0px";
    translations.push("var(--vsn-editor-sticky-y, 0px)");
  }
  if (interactions.parallax) {
    style["--vsn-editor-parallax-y"] = Number.isFinite(Number(parallaxOffset)) && Number(parallaxOffset) !== 0 ? `${Number(parallaxOffset)}px` : "var(--vsn-editor-parallax-source, 0px)";
    translations.push("var(--vsn-editor-parallax-y, 0px)");
  }
  if (translations.length) {
    style.translate = `0 calc(${translations.join(" + ")})`;
    style.willChange = "translate";
  }
  return style;
}

export function timelinesFromLegacyPresets(value) {
  const interactions = normalizeElementInteractions(value);
  const timelines = [];
  const entranceMap = {
    "fade-up": { from:{opacity:0,x:0,y:24,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""} },
    "fade-in": { from:{opacity:0,x:0,y:0,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""} },
    "slide-left": { from:{opacity:0,x:-28,y:0,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""} },
    "slide-right": { from:{opacity:0,x:28,y:0,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""} },
    "zoom-in": { from:{opacity:0,x:0,y:0,scale:.96,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""} },
  };
  if (entranceMap[interactions.entrance]) timelines.push(createMotionTimeline({ name:`Entrance · ${interactions.entrance}`, trigger:{type:"viewport-enter",once:true,threshold:.12}, timeline:{duration:550,delay:0,easing:"ease-out",stagger:0,repeat:0,yoyo:false}, actions:[createMotionAction(entranceMap[interactions.entrance])] }));
  const hoverMap = {
    lift: { from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:-4,scale:1,rotate:0,filter:""} },
    scale: { from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1.025,rotate:0,filter:""} },
    fade: { from:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, to:{opacity:.78,x:0,y:0,scale:1,rotate:0,filter:""} },
  };
  if (hoverMap[interactions.hover]) timelines.push(createMotionTimeline({ name:`Hover · ${interactions.hover}`, trigger:{type:"hover",once:false}, timeline:{duration:200,delay:0,easing:"ease-out",stagger:0,repeat:0,yoyo:true}, actions:[createMotionAction(hoverMap[interactions.hover])] }));
  return timelines;
}
