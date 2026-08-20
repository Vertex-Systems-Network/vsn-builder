import { createMotionTimeline, normalizeMotionTimeline } from "../builder/interactionSchema.js";

// Third-party catalogs are used as naming/interaction references only. VSN ships its
// own normalized motion timelines and does not bundle their CSS or JavaScript.
export const MOTION_REFERENCE_LIBRARIES = Object.freeze([
  { id:"hovercss", label:"Hover.css", url:"https://ianlunn.github.io/Hover/", kind:"hover" },
  { id:"all-animation", label:"All Animation", url:"https://all-animation.github.io/", kind:"motion" },
  { id:"magic", label:"Magic Animations", url:"https://www.minimamente.com/project/magic/", kind:"motion" },
  { id:"tuesday", label:"Tuesday", url:"https://shakrmedia.github.io/tuesday/", kind:"motion" },
  { id:"reboundgen", label:"ReboundGen", url:"https://dwarcher.github.io/reboundgen/examples/", kind:"spring" },
  { id:"csshake", label:"CSShake", url:"https://elrumordelaluz.github.io/csshake/", kind:"shake" },
  { id:"wickedcss", label:"WickedCSS", url:"https://kristofferandreasen.github.io/wickedCSS/", kind:"motion" },
  { id:"woah", label:"Woah.css", url:"https://www.joerezendes.com/projects/Woah.css", kind:"eccentric" },
  { id:"obnoxious", label:"Obnoxious.css", url:"https://tholman.com/obnoxious/", kind:"eccentric" },
  { id:"infinite", label:"Infinite", url:"https://tilomitra.github.io/infinite/", kind:"loop" },
  { id:"micron", label:"Micron", url:"https://webkul.github.io/micron/", kind:"microinteraction" },
  { id:"mimic", label:"Mimic.css", url:"https://codepen.io/etreacy/pen/ZJYoRV", kind:"eccentric" },
]);

const EFFECTS = Object.freeze({
  hovercss: [
    "Grow","Shrink","Pulse","Pulse Grow","Pulse Shrink","Push","Pop","Bounce In","Bounce Out","Rotate","Grow Rotate","Float","Sink","Bob","Hang","Skew","Skew Forward","Skew Backward","Wobble Horizontal","Wobble Vertical","Wobble To Bottom Right","Wobble To Top Right","Wobble Top","Wobble Bottom","Wobble Skew","Buzz","Buzz Out","Forward","Backward","Fade","Back Pulse","Sweep To Right","Sweep To Left","Sweep To Bottom","Sweep To Top","Bounce To Right","Bounce To Left","Bounce To Bottom","Bounce To Top","Radial Out","Radial In","Rectangle In","Rectangle Out","Shutter In Horizontal","Shutter Out Horizontal","Shutter In Vertical","Shutter Out Vertical","Float Shadow","Grow Shadow","Shadow Radial","Box Shadow Outset","Box Shadow Inset","Glow","Shadow"
  ],
  "all-animation": [
    "Dance","Journal","Pulse Slow","Jamp","Four Rock","Enter Up Bounce","Enter Down Bounce","Enter Right Bounce","Enter Left Bounce","Scale Bounce","Jump Bounce","Three Flip Right","Three Flip Up","Three Flip Down","Flip Left Bounce","Rotate Flip","Flip Right Bounce","Flip Top","Flip Left","Flip Right","Flip Bottom","Rotate Flip Down","Rotate Down Bounce","Rotate Out","Flash Bang","Bomb","Jello Horizontal","Jello Vertical","Vibrate Low","Vibrate Medium","Vibrate High","Wobble Bottom","Wobble Left","Wobble Right","Wobble Top"
  ],
  magic: [
    "Magic","Twister In Down","Twister In Up","Swap","Puff In","Puff Out","Vanish In","Vanish Out","Open Down Left","Open Down Right","Open Up Left","Open Up Right","Open Down Left Return","Open Down Right Return","Open Up Left Return","Open Up Right Return","Open Down Left Out","Open Down Right Out","Open Up Left Out","Open Up Right Out","Perspective Down","Perspective Up","Perspective Left","Perspective Right","Perspective Down Return","Perspective Up Return","Perspective Left Return","Perspective Right Return","Rotate Down","Rotate Up","Rotate Left","Rotate Right","Slide Down","Slide Up","Slide Left","Slide Right","Slide Down Return","Slide Up Return","Slide Left Return","Slide Right Return","Swash Out","Swash In","Foolish In","Hole Out","Tin Right Out","Tin Left Out","Tin Up Out","Tin Down Out","Tin Right In","Tin Left In","Tin Up In","Tin Down In","Bomb Right Out","Bomb Left Out","Boing In Up","Boing Out Down","Space Out Up","Space Out Right","Space Out Down","Space Out Left","Space In Up","Space In Right","Space In Down","Space In Left"
  ],
  tuesday: [
    "Fade In","Fade In Down","Fade In Left","Fade In Up","Fade In Right","Fade Out","Fade Out Down","Fade Out Left","Fade Out Up","Fade Out Right","Expand In","Expand In Bounce","Expand Out","Expand Out Bounce","Stamp In","Stamp In Swing","Shrink In","Shrink In Bounce","Shrink Out","Shrink Out Bounce","Swing In","Swing Out","Drop In Left","Drop In Right","Plop In","Plop In Down","Hinge Flip In","Hinge Flip Out"
  ],
  reboundgen: [
    "Bounce In Right","Bounce In Left","Bounce In Down","Bounce In Drop","Glide In Right","Glide In Left","Glide In Up","Glide In Down","Bounce In Scale","Bounce In Scale 2","Spring Scale Out","Hover Jiggle","Hover Jiggle 2","Twirl In","Rubberband","Jellyfall","Jellyfall 2","Slide In Right","Slide In Left","Flip In Left","Flip In Right","Flip In Bottom","Flip In Top","Kitchen Sink","Fly In Bottom","Fly In Left","Fly In Right"
  ],
  csshake: ["Basic Shake","Slow Shake","Little Shake","Hard Shake","Horizontal Shake","Vertical Shake","Rotation Shake","Opacity Shake","Crazy Shake","Constant Shake","Chunk Shake"],
  wickedcss: ["Floater","Barrel Roll","Roller Right","Roller Left","Heartbeat","Rotation","Side To Side","Zoomer","Zoomer Out","Spinner","Wiggle","Pound","Slide Up","Slide Down","Slide Right","Slide Left","Fade In","Fade Out","Rotate In Right","Rotate In Left","Rotate In","Bounce In"],
  woah: ["Wowzors","Come In Style","Leave In Style","Rotate Complex","Rotate Complex Out","Fly Out","Fly In","Black Mirror Safe","Black Mirror Text Safe","Spin 3D","Simple Entrance","Scale Out","Deal With It","Deal With It Norm","Fedora Tip","Fedora Tip Norm","Blazing Star","Blazing Star Text","Star Wars","Fade In","Pulse","Shaker"],
  obnoxious: ["Shake It","Intensifies","Fontalicious","Strobe Safe","Twister"],
  infinite: ["Pulsate Loop","Opacity Pulse Loop","Alert Pulse Loop","Rotating Loop"],
  micron: ["Shake","Fade","Jelly","Bounce","Tada","Groove","Swing","Squeeze","Flicker Safe","Jerk","Blink Safe","Pop"],
  mimic: ["Boomerang","Swivel Chair","Gettin In Yo Face","Airplane Propeller","Pulsate","Candle In The Wind","Highlighter","Lawn Mower","I Wan Chu Back","Nope","Heart Beat","Sleepy Eyes","Plummit","Drop It Like Its Hot","Gettin Lifted","Glaucoma","Chameleon","Backdrop","Tear Drop","Acid Trip","Spinner","Page Turn"],
});

function frame(overrides={}) { return { opacity:1,x:0,y:0,scale:1,rotate:0,filter:"",...overrides }; }
function k(offset, overrides={}) { return { offset, frame:frame(overrides) }; }
function timeline(name,{from=frame(),to=frame(),keyframes=[],duration=620,easing="ease-out",trigger="viewport-enter",once=true,repeat=0,yoyo=false,reducedMotion="instant"}={}) {
  return normalizeMotionTimeline(createMotionTimeline({
    name,
    trigger:{type:trigger,once,threshold:.14,eventName:"",selector:""},
    timeline:{duration,delay:0,easing,stagger:0,repeat,yoyo,reducedMotion},
    actions:[{type:"animate",target:{mode:"self"},from,to,keyframes}],
  }));
}
function normalizeName(value="") { return String(value).toLowerCase().replace(/safe/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function direction(name, distance=48) {
  const n=normalizeName(name); let x=0,y=0;
  if(/left/.test(n)) x=distance; if(/right/.test(n)) x=-distance;
  if(/up|top/.test(n)) y=distance; if(/down|bottom|drop/.test(n)) y=-distance;
  return {x,y};
}
function isOut(name){return /\b(out|leave|vanish|hole|plummit)\b/i.test(name);}

function referenceTimeline(label, libraryId) {
  const n=normalizeName(label); const out=isOut(label); const d=direction(label,/big|bomb|fly|space|drop/.test(n)?88:48); const normal=frame();
  const hover=libraryId==="hovercss" || /^hover /.test(n);
  const loop=libraryId==="infinite" || /\bconstant\b|\bloop\b/.test(n);
  const trigger=hover?"hover":loop?"page-load":"viewport-enter";
  const repeat=loop?100:0; const once=!hover&&!loop;
  const base={trigger,repeat,once,reducedMotion:/strobe|black mirror|blink|flicker|crazy/.test(n)?"skip":"instant"};
  if(/fade|opacity/.test(n)) return timeline(label,{...base,from:out?normal:frame({opacity:0,x:d.x*.35,y:d.y*.35}),to:out?frame({opacity:0,x:d.x*.35,y:d.y*.35}):normal,duration:560});
  if(/strobe|black mirror|blink|flicker|flash bang/.test(n)) return timeline(label,{...base,duration:1200,keyframes:[k(.28,{opacity:.3}),k(.55,{opacity:1}),k(.78,{opacity:.45})],reducedMotion:"skip"});
  if(/shake|nope|buzz|vibrate|jiggle|jerk|intensif|shaker/.test(n)) {
    const amount=/hard|crazy|high|intensif/.test(n)?16:/little|low|slow/.test(n)?5:10;
    const vertical=/vertical/.test(n); const rotation=/rotation|rotate/.test(n);
    return timeline(label,{...base,trigger:hover?"hover":trigger,once:hover?false:once,duration:/slow/.test(n)?1100:620,keyframes:[k(.18,vertical?{y:-amount}:rotation?{rotate:-amount}:{x:-amount}),k(.36,vertical?{y:amount}:rotation?{rotate:amount}:{x:amount}),k(.54,vertical?{y:-amount*.7}:rotation?{rotate:-amount*.7}:{x:-amount*.7}),k(.72,vertical?{y:amount*.45}:rotation?{rotate:amount*.45}:{x:amount*.45})]});
  }
  if(/pulse|heartbeat|heart beat|pound|squeeze/.test(n)) return timeline(label,{...base,trigger:hover?"hover":trigger,once:hover?false:once,duration:760,keyframes:[k(.25,{scale:1.09}),k(.5,{scale:.97}),k(.72,{scale:1.06})]});
  if(/grow|expand|scale bounce|bounce in scale|zoomer|zoom/.test(n)) { const hidden=frame({opacity:hover?1:0,scale:/out/.test(n)?1.28:.68,x:d.x*.2,y:d.y*.2}); return timeline(label,{...base,from:out?normal:hidden,to:out?hidden:normal,keyframes:[k(.68,{scale:out?.94:1.08})],duration:650,easing:"cubic-bezier(0.34,1.56,0.64,1)"}); }
  if(/shrink|scale out|swash out/.test(n)) return timeline(label,{...base,from:normal,to:frame({opacity:out?0:1,scale:.55}),duration:600,easing:"cubic-bezier(0.22,1,0.36,1)"});
  if(/bounce|boing|jamp|jump/.test(n)) { const hidden=frame({opacity:hover?1:0,x:d.x||0,y:d.y||36,scale:.86}); return timeline(label,{...base,from:out?normal:hidden,to:out?hidden:normal,keyframes:[k(.55,{x:-d.x*.12,y:-d.y*.12-10,scale:1.07}),k(.76,{x:d.x*.04,y:d.y*.04+3,scale:.985})],duration:780,easing:"ease-out"}); }
  if(/slide|glide|fly|gettin lifted|forward|backward|sink|float|drop in/.test(n)) { const hidden=frame({opacity:hover?1:0,x:d.x||(/left/.test(n)?60:/right/.test(n)?-60:0),y:d.y||(/float|lifted|up/.test(n)?42:/sink|down|drop/.test(n)?-42:0)}); return timeline(label,{...base,from:out?normal:hidden,to:out?hidden:normal,duration:620,easing:"cubic-bezier(0.22,1,0.36,1)"}); }
  if(/rotate|roller|twirl|twister|spinner|propeller|barrel|spin 3d|star wars|page turn|swivel/.test(n)) { const turns=/propeller|lawn mower/.test(n)?720:/barrel|spinner|star wars/.test(n)?360:110; const sign=/left/.test(n)?-1:1; const hidden=frame({opacity:hover?1:0,rotate:sign*(out?turns:-turns),scale:/swivel|page turn/.test(n)?.86:1,x:d.x*.2,y:d.y*.2}); return timeline(label,{...base,from:out?normal:hidden,to:out?hidden:normal,keyframes:/complex|swivel|page turn/.test(n)?[k(.42,{rotate:sign*32,scale:1.04}),k(.72,{rotate:sign*-12,scale:.98})]:[],duration:/propeller|lawn mower/.test(n)?1500:760,easing:"ease-in-out"}); }
  if(/flip|perspective|open|hinge|fedora/.test(n)) { const hidden=frame({opacity:hover?1:0,rotate:(/left/.test(n)?-1:1)*(out?82:-82),scale:.9,x:d.x*.2,y:d.y*.2}); return timeline(label,{...base,from:out?normal:hidden,to:out?hidden:normal,keyframes:[k(.58,{rotate:(/left/.test(n)?1:-1)*7,scale:1.035})],duration:760,easing:"cubic-bezier(0.22,1,0.36,1)"}); }
  if(/puff|vanish|magic|simple entrance|come in|leave in|swash|foolish|tin|space|plop|stamp/.test(n)) { const hidden=frame({opacity:0,x:d.x||0,y:d.y||16,scale:/puff|swash/.test(n)?1.45:.72,rotate:/foolish|magic|stamp/.test(n)?-18:0,filter:/puff|vanish/.test(n)?"blur(8px)":""}); return timeline(label,{...base,from:out?normal:hidden,to:out?hidden:normal,keyframes:[k(.62,{scale:out?.92:1.05,rotate:/foolish|magic|stamp/.test(n)?4:0,filter:"blur(0px)"})],duration:760,easing:"cubic-bezier(0.16,1,0.3,1)"}); }
  if(/wobble|wiggle|dance|four rock|side to side|groove|jelly|jello|rubber|candle/.test(n)) return timeline(label,{...base,duration:860,keyframes:[k(.18,{x:-10,rotate:-4,scale:1.02}),k(.36,{x:9,rotate:4,scale:.99}),k(.55,{x:-6,rotate:-3,scale:1.015}),k(.74,{x:4,rotate:2})]});
  if(/pop|push/.test(n)) return timeline(label,{...base,trigger:hover?"hover":trigger,once:hover?false:once,duration:360,keyframes:[k(.45,{scale:/push/.test(n)?.9:1.13}),k(.78,{scale:/push/.test(n)?1.04:.97})],easing:"cubic-bezier(0.34,1.56,0.64,1)"});
  if(/skew/.test(n)) return timeline(label,{...base,duration:520,keyframes:[k(.35,{rotate:/backward/.test(n)?-7:7,x:/forward/.test(n)?8:-8}),k(.72,{rotate:/backward/.test(n)?3:-3,x:0})]});
  if(/shadow|glow|glaucoma/.test(n)) return timeline(label,{...base,trigger:hover?"hover":trigger,once:hover?false:once,from:frame({filter:"drop-shadow(0 0 0 rgba(0,0,0,0))"}),to:frame({filter:"drop-shadow(0 8px 12px rgba(0,0,0,.24))"}),duration:420});
  if(/boomerang/.test(n)) return timeline(label,{...base,duration:1100,keyframes:[k(.22,{x:80,y:-22,rotate:-70,scale:.72}),k(.52,{x:-90,y:18,rotate:-240,scale:.82}),k(.78,{x:14,y:-4,rotate:-350,scale:.96})]});
  if(/gettin in yo face/.test(n)) return timeline(label,{...base,from:normal,to:frame({scale:8,opacity:0}),duration:1100,easing:"ease-in"});
  if(/sleepy eyes/.test(n)) return timeline(label,{...base,duration:1400,keyframes:[k(.2,{rotate:-9,opacity:.65}),k(.5,{rotate:0,opacity:1}),k(.78,{rotate:-35,opacity:.4})],to:frame({rotate:-75,opacity:0})});
  if(/plummit/.test(n)) return timeline(label,{...base,from:frame({scale:4}),to:frame({scale:0,opacity:0}),duration:1000});
  if(/drop it like its hot/.test(n)) return timeline(label,{...base,to:frame({y:500,opacity:0}),duration:520,easing:"ease-in"});
  if(/acid trip|chameleon|backdrop|highlighter|fontalicious/.test(n)) return timeline(label,{...base,duration:1200,keyframes:[k(.25,{filter:"hue-rotate(90deg)"}),k(.5,{filter:"hue-rotate(180deg)"}),k(.75,{filter:"hue-rotate(270deg)"})],to:frame({filter:"hue-rotate(360deg)"})});
  if(/tear drop/.test(n)) return timeline(label,{...base,duration:900,from:frame({opacity:0,y:-8,scale:.9}),keyframes:[k(.32,{opacity:1,y:0}),k(.7,{opacity:.7,y:15})],to:frame({opacity:0,y:26,scale:.82})});
  if(/alert/.test(n)) return timeline(label,{...base,duration:900,keyframes:[k(.28,{scale:1.08,filter:"drop-shadow(0 0 10px rgba(255,80,80,.45))"}),k(.58,{scale:1,filter:""}),k(.8,{scale:1.05})]});
  return timeline(label,{...base,from:frame({opacity:hover?1:0,scale:.96,y:hover?0:18}),to:normal,duration:620});
}

function properName(libraryId, effect) {
  const lib=MOTION_REFERENCE_LIBRARIES.find((item)=>item.id===libraryId);
  return `${lib?.label || libraryId} · ${effect}`;
}
function slug(value="") { return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }

export function buildReferenceMotionPresets() {
  const rows=[];
  for (const library of MOTION_REFERENCE_LIBRARIES) {
    for (const effect of EFFECTS[library.id] || []) {
      const safeAdaptation=/\bSafe\b/.test(effect);
      const name=properName(library.id,effect);
      rows.push({
        id:`builtin:reference:${library.id}:${slug(effect)}`,
        builtinId:`reference:${library.id}:${slug(effect)}`,
        name,
        category:`Reference · ${library.label}`,
        description:`VSN-native ${safeAdaptation?"accessibility-safe adaptation":"interpretation"} of the “${effect.replace(/ Safe$/,'')}” effect from ${library.label}. No third-party stylesheet or runtime is bundled.`,
        scope:"global", builtin:true, isFavorite:false, source:library.id,
        timeline:referenceTimeline(effect,library.id),
        tokens:{sourceLibrary:library.label,sourceUrl:library.url,sourceEffect:effect.replace(/ Safe$/,''),referenceOnly:true,safeAdaptation},
      });
    }
  }
  return rows;
}

export const REFERENCE_MOTION_CANDIDATE_COUNT = Object.values(EFFECTS).reduce((sum,list)=>sum+list.length,0);
export const REFERENCE_LIBRARY_COUNT = MOTION_REFERENCE_LIBRARIES.length;
