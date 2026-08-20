import { createInteractionPreset, createMotionTimeline, normalizeMotionTimeline } from "../builder/interactionSchema.js";
import { ANIMATE_CSS_PRESET_COUNT, GENERATED_VSN_PRESET_COUNT, buildAnimateCssPresets, buildGeneratedVsnPresets } from "../data/motion-preset-catalog.js";
import { REFERENCE_LIBRARY_COUNT, REFERENCE_MOTION_CANDIDATE_COUNT, buildReferenceMotionPresets } from "../data/motion-reference-catalog.js";

const BUILTIN = Object.freeze([
  ["fade-up", "Fade Up", "Entrance", "Subtle upward entrance for sections and cards."],
  ["slide-left", "Slide From Left", "Entrance", "Horizontal entrance from the left."],
  ["slide-right", "Slide From Right", "Entrance", "Horizontal entrance from the right."],
  ["hover-lift", "Hover Lift", "Hover", "Small lift interaction for cards and buttons."],
]);

function safeJson(value, fallback = {}) { try { return JSON.parse(String(value || "")); } catch { return fallback; } }

function entranceTimeline(name, from) {
  return createMotionTimeline({
    name,
    trigger: { type: "viewport-enter", once: true, threshold: 0.15, eventName: "", selector: "" },
    timeline: { duration: 520, delay: 0, easing: "cubic-bezier(0.22,1,0.36,1)", stagger: 0, repeat: 0, yoyo: false, reducedMotion: "instant" },
    actions: [{ type: "animate", target: { mode: "self" }, from, to: { x:0,y:0,scale:1,rotate:0,opacity:1,filter:"" } }],
  });
}

function builtInTimeline(id) {
  if (id === "fade-up") return createInteractionPreset("fade-up");
  if (id === "fade-in") return entranceTimeline("Fade In", { x:0,y:0,scale:1,rotate:0,opacity:0,filter:"" });
  if (id === "slide-left") return entranceTimeline("Slide From Left", { x:-36,y:0,scale:1,rotate:0,opacity:0,filter:"" });
  if (id === "slide-right") return entranceTimeline("Slide From Right", { x:36,y:0,scale:1,rotate:0,opacity:0,filter:"" });
  if (id === "zoom-in") return entranceTimeline("Zoom In", { x:0,y:0,scale:.92,rotate:0,opacity:0,filter:"" });
  if (id === "hover-lift") return createMotionTimeline({
    name: "Hover Lift",
    trigger: { type: "hover", once: false, threshold: 0.15, eventName: "", selector: "" },
    timeline: { duration: 180, delay: 0, easing: "ease-out", stagger: 0, repeat: 0, yoyo: true },
    actions: [{ type: "animate", target: { mode: "self" }, from: { x:0,y:0,scale:1,rotate:0,opacity:1,filter:"" }, to: { x:0,y:-6,scale:1.01,rotate:0,opacity:1,filter:"" } }],
  });
  return createInteractionPreset("fade-up");
}

function normalizedMotionName(value = "") { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function canonicalEffectName(row = {}) {
  if (row.tokens?.sourceEffect) return normalizedMotionName(row.tokens.sourceEffect);
  if (row.source === "animate.css" && row.tokens?.className) return normalizedMotionName(String(row.tokens.className).replace(/^animate__/, ""));
  return normalizedMotionName(row.name);
}
function motionTimelineSignature(value = {}) {
  const t = normalizeMotionTimeline(value);
  return JSON.stringify({
    trigger:t.trigger, conditions:t.conditions, timeline:t.timeline,
    actions:(t.actions||[]).map((action)=>({type:action.type,target:action.target,duration:action.duration,delay:action.delay,easing:action.easing,from:action.from,to:action.to,keyframes:(action.keyframes||[]).map((item)=>({offset:item.offset,frame:item.frame})),className:action.className,variable:action.variable,value:action.value,selector:action.selector,behavior:action.behavior,eventName:action.eventName,eventDetail:action.eventDetail})),
  });
}
function dedupeBuiltinMotionPresets(rows = []) {
  const effectNames = new Map(); const fullNames = new Map(); const signatureByEffect = new Map(); const kept = []; const duplicates = [];
  for (const source of rows) {
    const row = {...source,tokens:{...(source.tokens||{})}};
    const fullKey = normalizedMotionName(row.name); const effectKey = canonicalEffectName(row); const signature = motionTimelineSignature(row.timeline);
    const sameName = fullNames.get(fullKey);
    const sameEffect = effectNames.get(effectKey);
    const sameEffectSignature = signatureByEffect.get(`${effectKey}:${signature}`);
    const existing = sameName || sameEffect || sameEffectSignature;
    if (existing) {
      existing.tokens.aliases = [...new Set([...(existing.tokens.aliases||[]),row.name])];
      existing.tokens.sourceAliases = [...new Set([...(existing.tokens.sourceAliases||[]),row.source].filter(Boolean))];
      duplicates.push({id:row.id,name:row.name,duplicateOf:existing.id,reason:sameName?"name":"canonical-effect"});
      continue;
    }
    fullNames.set(fullKey,row); effectNames.set(effectKey,row); signatureByEffect.set(`${effectKey}:${signature}`,row); kept.push(row);
  }
  return {rows:kept,duplicates};
}

let BUILTIN_CACHE = null; let BUILTIN_DUPLICATES = [];
export function builtinMotionPresets() {
  if (BUILTIN_CACHE) return BUILTIN_CACHE;
  const legacy = BUILTIN.map(([id,name,category,description]) => ({
    id: `builtin:${id}`, builtinId:id, name, category, description, scope:"global", builtin:true, isFavorite:false, source:"vsn-core",
    timeline: normalizeMotionTimeline(builtInTimeline(id)), tokens:{ legacy:true },
  }));
  const result = dedupeBuiltinMotionPresets([...legacy, ...buildAnimateCssPresets(), ...buildGeneratedVsnPresets(), ...buildReferenceMotionPresets()]);
  BUILTIN_DUPLICATES = result.duplicates;
  BUILTIN_CACHE = Object.freeze(result.rows.map((row)=>Object.freeze(row)));
  return BUILTIN_CACHE;
}
export function builtinMotionDuplicateReport() { builtinMotionPresets(); return [...BUILTIN_DUPLICATES]; }

function compactFrame(frame = {}) {
  return [frame.opacity ?? null, Number(frame.x || 0), Number(frame.y || 0), Number(frame.scale ?? 1), Number(frame.rotate || 0), String(frame.filter || "")];
}
function compactBuiltin(row = {}) {
  const action = row.timeline?.actions?.find((item) => item.type === "animate") || {};
  const keyframes = Array.isArray(action.keyframes) ? action.keyframes : [];
  const indexes = keyframes.length ? [0, Math.floor((keyframes.length - 1) / 3), Math.floor((keyframes.length - 1) * 2 / 3), keyframes.length - 1].filter((value, index, list) => value >= 0 && list.indexOf(value) === index) : [];
  return {
    id: row.id, name: row.name, description: row.description || "", category: row.category || "custom", scope: row.scope || "global", builtin: true, isFavorite: false, source: row.source || "vsn",
    tokens: { sourceLibrary: row.tokens?.sourceLibrary || "", referenceOnly: row.tokens?.referenceOnly === true },
    preview: { r: row.timeline?.trigger?.type || "click", d: Number(row.timeline?.timeline?.duration || 400), e: row.timeline?.timeline?.easing || "ease", f: compactFrame(action.from), t: compactFrame(action.to), k: indexes.map((index) => [Number(keyframes[index]?.offset || .5), ...compactFrame(keyframes[index]?.frame)]), kc: keyframes.length },
  };
}
export function getBuiltinMotionPreset(id = "") {
  return builtinMotionPresets().find((row) => row.id === id || row.builtinId === id) || null;
}

function serializeRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    category: row.category || "custom",
    scope: row.scope || "global",
    builtin: false,
    isFavorite: row.isFavorite === true,
    deletedAt: row.deletedAt?.toISOString?.() || row.deletedAt || null,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
    timeline: normalizeMotionTimeline(safeJson(row.timelineJson, {})),
    tokens: safeJson(row.tokensJson, {}),
  };
}

export async function listMotionLibrary(db, shop) {
  const rows = await db.builderMotionPreset.findMany({ where: { shop }, orderBy: { updatedAt: "desc" } }).catch(() => []);
  const active = rows.filter((row) => !row.deletedAt).map(serializeRow);
  const trash = rows.filter((row) => row.deletedAt).map(serializeRow);
  const builtinRows = builtinMotionPresets();
  const builtins = builtinRows.map(compactBuiltin);
  const referenceBySource = {};
  for (const row of builtinRows.filter((item)=>item.tokens?.referenceOnly)) referenceBySource[row.source] = (referenceBySource[row.source] || 0) + 1;
  return { builtins, presets: active, trash, counts: { builtins: builtinRows.length, animateCss: ANIMATE_CSS_PRESET_COUNT, generated: GENERATED_VSN_PRESET_COUNT, referenceLibraries:REFERENCE_LIBRARY_COUNT, referenceCandidates:REFERENCE_MOTION_CANDIDATE_COUNT, referenceAdded:Object.values(referenceBySource).reduce((sum,value)=>sum+value,0), referenceBySource, duplicateBuiltins:builtinMotionDuplicateReport().length, custom: active.length, trash: trash.length, total: builtinRows.length + active.length } };
}

export function normalizePresetInput(input = {}) {
  const timeline = normalizeMotionTimeline(typeof input.timeline === "string" ? safeJson(input.timeline, {}) : input.timeline || {});
  return {
    name: String(input.name || timeline.name || "Animation").trim().slice(0, 120) || "Animation",
    description: String(input.description || "").trim().slice(0, 400),
    category: String(input.category || "custom").trim().slice(0, 80) || "custom",
    scope: ["global", "component", "local"].includes(String(input.scope)) ? String(input.scope) : "global",
    timelineJson: JSON.stringify(timeline),
    tokensJson: JSON.stringify(input.tokens && typeof input.tokens === "object" ? input.tokens : {}),
  };
}
