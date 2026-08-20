import { createMotionTimeline, normalizeMotionTimeline } from "../builder/interactionSchema.js";

// Animate.css v4.1.1 public animation catalog. VSN recreates the named presets
// with its own schema/runtime so storefronts do not depend on a third-party CSS file.
export const ANIMATE_CSS_GROUPS = Object.freeze([
  ["Attention seekers", ["bounce","flash","pulse","rubberBand","shakeX","shakeY","headShake","swing","tada","wobble","jello","heartBeat"]],
  ["Back entrances", ["backInDown","backInLeft","backInRight","backInUp"]],
  ["Back exits", ["backOutDown","backOutLeft","backOutRight","backOutUp"]],
  ["Bouncing entrances", ["bounceIn","bounceInDown","bounceInLeft","bounceInRight","bounceInUp"]],
  ["Bouncing exits", ["bounceOut","bounceOutDown","bounceOutLeft","bounceOutRight","bounceOutUp"]],
  ["Fading entrances", ["fadeIn","fadeInDown","fadeInDownBig","fadeInLeft","fadeInLeftBig","fadeInRight","fadeInRightBig","fadeInUp","fadeInUpBig","fadeInTopLeft","fadeInTopRight","fadeInBottomLeft","fadeInBottomRight"]],
  ["Fading exits", ["fadeOut","fadeOutDown","fadeOutDownBig","fadeOutLeft","fadeOutLeftBig","fadeOutRight","fadeOutRightBig","fadeOutUp","fadeOutUpBig","fadeOutTopLeft","fadeOutTopRight","fadeOutBottomRight","fadeOutBottomLeft"]],
  ["Flippers", ["flip","flipInX","flipInY","flipOutX","flipOutY"]],
  ["Lightspeed", ["lightSpeedInRight","lightSpeedInLeft","lightSpeedOutRight","lightSpeedOutLeft"]],
  ["Rotating entrances", ["rotateIn","rotateInDownLeft","rotateInDownRight","rotateInUpLeft","rotateInUpRight"]],
  ["Rotating exits", ["rotateOut","rotateOutDownLeft","rotateOutDownRight","rotateOutUpLeft","rotateOutUpRight"]],
  ["Specials", ["hinge","jackInTheBox","rollIn","rollOut"]],
  ["Zooming entrances", ["zoomIn","zoomInDown","zoomInLeft","zoomInRight","zoomInUp"]],
  ["Zooming exits", ["zoomOut","zoomOutDown","zoomOutLeft","zoomOutRight","zoomOutUp"]],
  ["Sliding entrances", ["slideInDown","slideInLeft","slideInRight","slideInUp"]],
  ["Sliding exits", ["slideOutDown","slideOutLeft","slideOutRight","slideOutUp"]],
]);

const DIRECTION_MAP = Object.freeze({
  Up:[0,1], Down:[0,-1], Left:[1,0], Right:[-1,0],
  TopLeft:[1,1], TopRight:[-1,1], BottomLeft:[1,-1], BottomRight:[-1,-1],
  UpLeft:[1,1], UpRight:[-1,1], DownLeft:[1,-1], DownRight:[-1,-1],
});
const GENERATED_DIRECTIONS = Object.freeze([
  ["Up",0,1],["Down",0,-1],["Left",1,0],["Right",-1,0],
  ["Up Left",1,1],["Up Right",-1,1],["Down Left",1,-1],["Down Right",-1,-1],
]);
const GENERATED_STRENGTHS = Object.freeze([
  ["Subtle",16,.96],["Balanced",28,.92],["Bold",46,.86],["Extreme",72,.78],
]);
const GENERATED_MOODS = Object.freeze([
  ["Smooth",640,"cubic-bezier(0.22,1,0.36,1)"],
  ["Snappy",420,"ease-out"],
  ["Cinematic",820,"cubic-bezier(0.16,1,0.3,1)"],
]);
const GENERATED_FAMILIES = Object.freeze([
  ["Fade","Modern"],["Glide","Modern"],["Spring","Spring"],["Elastic","Elastic"],["Robust","Robust"],
  ["Pop","Modern"],["Zoom","Modern"],["Rotate","Dynamic"],["Drift","Cinematic"],["Reveal","Cinematic"],
]);

function frame(overrides={}) { return { opacity:1,x:0,y:0,scale:1,rotate:0,filter:"",...overrides }; }
function k(offset, overrides={}) { return { offset, frame:frame(overrides) }; }
function timeline(name,{from=frame(),to=frame(),keyframes=[],duration=600,easing="ease-out",trigger="viewport-enter",once=true,repeat=0,yoyo=false,reducedMotion="instant"}={}) {
  return normalizeMotionTimeline(createMotionTimeline({
    name,
    trigger:{type:trigger,once,threshold:.14,eventName:"",selector:""},
    timeline:{duration,delay:0,easing,stagger:0,repeat,yoyo,reducedMotion},
    actions:[{type:"animate",target:{mode:"self"},from,to,keyframes}],
  }));
}
function directionFromName(name, distance=42) {
  // Match compound directions before their single-axis suffixes. Without this,
  // `fadeInTopLeft` matched `Left` first and produced the same timeline as
  // `fadeInLeft`, creating visually duplicated presets in Motion Library.
  const token=Object.keys(DIRECTION_MAP)
    .sort((a,b)=>b.length-a.length)
    .find((key)=>name.includes(key));
  if(!token) return {x:0,y:0};
  const [x,y]=DIRECTION_MAP[token];
  return {x:x*distance,y:y*distance};
}
function readableAnimateName(name){return name.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/^./,(c)=>c.toUpperCase());}

function attentionTimeline(name) {
  const base={duration:760,easing:"ease-in-out",trigger:"viewport-enter",once:true};
  if(name==="bounce") return timeline("Bounce",{...base,keyframes:[k(.2,{y:-22}),k(.4,{y:0}),k(.6,{y:-11}),k(.8,{y:0})]});
  if(name==="flash") return timeline("Flash",{...base,keyframes:[k(.25,{opacity:0}),k(.5,{opacity:1}),k(.75,{opacity:0})]});
  if(name==="pulse") return timeline("Pulse",{...base,keyframes:[k(.5,{scale:1.08})]});
  if(name==="rubberBand") return timeline("Rubber Band",{...base,keyframes:[k(.3,{scale:1.22}),k(.45,{scale:.88}),k(.6,{scale:1.1}),k(.75,{scale:.96})]});
  if(name==="shakeX") return timeline("Shake X",{...base,keyframes:[k(.2,{x:-12}),k(.4,{x:12}),k(.6,{x:-9}),k(.8,{x:9})]});
  if(name==="shakeY") return timeline("Shake Y",{...base,keyframes:[k(.2,{y:-12}),k(.4,{y:12}),k(.6,{y:-9}),k(.8,{y:9})]});
  if(name==="headShake") return timeline("Head Shake",{...base,keyframes:[k(.25,{x:-8,rotate:-3}),k(.5,{x:7,rotate:3}),k(.75,{x:-4,rotate:-2})]});
  if(name==="swing") return timeline("Swing",{...base,keyframes:[k(.2,{rotate:14}),k(.4,{rotate:-10}),k(.6,{rotate:6}),k(.8,{rotate:-3})]});
  if(name==="tada") return timeline("Tada",{...base,keyframes:[k(.12,{scale:.9,rotate:-3}),k(.25,{scale:.9,rotate:3}),k(.4,{scale:1.1,rotate:-3}),k(.55,{scale:1.1,rotate:3}),k(.7,{scale:1.1,rotate:-3}),k(.85,{scale:1.05,rotate:2})]});
  if(name==="wobble") return timeline("Wobble",{...base,keyframes:[k(.15,{x:-18,rotate:-5}),k(.3,{x:14,rotate:4}),k(.45,{x:-10,rotate:-3}),k(.6,{x:7,rotate:2}),k(.75,{x:-4,rotate:-1})]});
  if(name==="jello") return timeline("Jello",{...base,keyframes:[k(.2,{rotate:-4,scale:1.03}),k(.35,{rotate:3,scale:.98}),k(.5,{rotate:-2,scale:1.02}),k(.65,{rotate:1.5,scale:.99}),k(.8,{rotate:-.8})]});
  if(name==="heartBeat") return timeline("Heart Beat",{...base,duration:900,keyframes:[k(.14,{scale:1.18}),k(.28,{scale:1}),k(.42,{scale:1.18}),k(.7,{scale:1})]});
  return timeline(readableAnimateName(name),base);
}

export function animateCssTimeline(name) {
  if(["bounce","flash","pulse","rubberBand","shakeX","shakeY","headShake","swing","tada","wobble","jello","heartBeat"].includes(name)) return attentionTimeline(name);
  const out=/Out/.test(name)||name==="rollOut"||name==="hinge";
  const big=/Big/.test(name); const dist=big?120:52; const dir=directionFromName(name,dist);
  const normal=frame(); const hidden=frame({opacity:0,x:dir.x,y:dir.y});
  if(/^fade/.test(name)) return timeline(readableAnimateName(name),{from:out?normal:hidden,to:out?hidden:normal,duration:620,easing:"ease-out"});
  if(/^slide/.test(name)) { const slide=frame({x:dir.x||0,y:dir.y||0}); return timeline(readableAnimateName(name),{from:out?normal:slide,to:out?slide:normal,duration:560,easing:"cubic-bezier(0.22,1,0.36,1)"}); }
  if(/^zoom/.test(name)) { const zoom=frame({opacity:0,scale:out?1.35:.55,x:dir.x*.45,y:dir.y*.45}); return timeline(readableAnimateName(name),{from:out?normal:zoom,to:out?zoom:normal,duration:620,easing:"cubic-bezier(0.22,1,0.36,1)"}); }
  if(/^back/.test(name)) { const hiddenBack=frame({opacity:.2,scale:out?.72:.72,x:dir.x*1.2,y:dir.y*1.2}); const mids=out?[k(.3,{scale:.92,x:-dir.x*.08,y:-dir.y*.08})]:[k(.72,{scale:1.04,x:-dir.x*.06,y:-dir.y*.06})]; return timeline(readableAnimateName(name),{from:out?normal:hiddenBack,to:out?hiddenBack:normal,keyframes:mids,duration:690,easing:"cubic-bezier(0.34,1.56,0.64,1)"}); }
  if(/^bounce/.test(name)) { const hiddenBounce=frame({opacity:0,scale:.76,x:dir.x*1.35,y:dir.y*1.35}); const mids=out?[k(.2,{scale:1.06,x:-dir.x*.08,y:-dir.y*.08}),k(.45,{scale:.96,x:dir.x*.12,y:dir.y*.12})]:[k(.58,{scale:1.08,x:-dir.x*.09,y:-dir.y*.09}),k(.78,{scale:.98,x:dir.x*.04,y:dir.y*.04})]; return timeline(readableAnimateName(name),{from:out?normal:hiddenBounce,to:out?hiddenBounce:normal,keyframes:mids,duration:760,easing:"ease-out"}); }
  if(/^rotate/.test(name)) { const sign=/Left/.test(name)?-1:1; const rot=frame({opacity:0,rotate:sign*(out?65:-65),x:dir.x*.45,y:dir.y*.45}); return timeline(readableAnimateName(name),{from:out?normal:rot,to:out?rot:normal,duration:650,easing:"cubic-bezier(0.22,1,0.36,1)"}); }
  if(/^lightSpeed/.test(name)) { const sign=/Left/.test(name)?-1:1; const fast=frame({opacity:0,x:sign*(out?-110:110),rotate:sign*(out?7:-7)}); return timeline(readableAnimateName(name),{from:out?normal:fast,to:out?fast:normal,keyframes:[k(.68,{x:sign*-8,rotate:sign*2})],duration:520,easing:"ease-out"}); }
  if(/^flip/.test(name)) { const axis=/Y/.test(name)?1:-1; const flip=frame({opacity:/In|Out/.test(name)?0:1,rotate:axis*(out?82:-82),scale:.94}); return timeline(readableAnimateName(name),{from:out?normal:flip,to:out?flip:normal,keyframes:name==="flip"?[k(.45,{rotate:170,scale:1.04}),k(.75,{rotate:345,scale:.98})]:[],duration:720,easing:"ease-in-out"}); }
  if(name==="hinge") return timeline("Hinge",{from:normal,to:frame({opacity:0,y:90,rotate:75}),keyframes:[k(.2,{rotate:12}),k(.4,{rotate:55}),k(.6,{rotate:35}),k(.78,{rotate:68})],duration:1100,easing:"ease-in"});
  if(name==="jackInTheBox") return timeline("Jack In The Box",{from:frame({opacity:0,scale:.2,rotate:25}),to:normal,keyframes:[k(.55,{scale:1.08,rotate:-5}),k(.75,{scale:.98,rotate:2})],duration:720,easing:"cubic-bezier(0.34,1.56,0.64,1)"});
  if(name==="rollIn"||name==="rollOut") { const roll=frame({opacity:0,x:name==="rollIn"?-85:85,rotate:name==="rollIn"?-120:120}); return timeline(readableAnimateName(name),{from:out?normal:roll,to:out?roll:normal,duration:680,easing:"ease-out"}); }
  return timeline(readableAnimateName(name),{});
}

function generatedTimeline(family, direction, strength, mood) {
  const [,dx,dy]=direction; const [,distance,scaleFrom]=strength; const [,duration,easing]=mood;
  const x=dx*distance,y=dy*distance; const name=`VSN ${family[0]} ${direction[0]} · ${strength[0]} · ${mood[0]}`;
  if(family[0]==="Fade") return timeline(name,{from:frame({opacity:0,x:x*.55,y:y*.55}),to:frame(),duration,easing});
  if(family[0]==="Glide") return timeline(name,{from:frame({opacity:.08,x:x*1.4,y:y*1.4,scale:.985}),to:frame(),duration,easing});
  if(family[0]==="Spring") return timeline(name,{from:frame({opacity:0,x,y,scale:scaleFrom}),to:frame(),keyframes:[k(.62,{x:-x*.13,y:-y*.13,scale:1.055}),k(.8,{x:x*.04,y:y*.04,scale:.985})],duration:duration+90,easing:"ease-out"});
  if(family[0]==="Elastic") return timeline(name,{from:frame({opacity:0,x,y,scale:scaleFrom}),to:frame(),keyframes:[k(.46,{x:-x*.2,y:-y*.2,scale:1.09}),k(.62,{x:x*.12,y:y*.12,scale:.955}),k(.76,{x:-x*.07,y:-y*.07,scale:1.035}),k(.88,{x:x*.025,y:y*.025,scale:.99})],duration:duration+220,easing:"ease-out"});
  if(family[0]==="Robust") return timeline(name,{from:frame({opacity:0,x:x*1.15,y:y*1.15,scale:Math.max(.7,scaleFrom-.04),rotate:dx*dy*3}),to:frame(),keyframes:[k(.55,{opacity:1,x:-x*.08,y:-y*.08,scale:1.035}),k(.76,{x:x*.025,y:y*.025,scale:.99})],duration:duration+120,easing:"cubic-bezier(0.16,1,0.3,1)"});
  if(family[0]==="Pop") return timeline(name,{from:frame({opacity:0,x:x*.25,y:y*.25,scale:Math.max(.5,scaleFrom-.16)}),to:frame(),keyframes:[k(.68,{scale:1.08,x:-x*.03,y:-y*.03})],duration:Math.max(340,duration-80),easing:"cubic-bezier(0.34,1.56,0.64,1)"});
  if(family[0]==="Zoom") return timeline(name,{from:frame({opacity:0,x:x*.5,y:y*.5,scale:scaleFrom}),to:frame(),duration,easing});
  if(family[0]==="Rotate") return timeline(name,{from:frame({opacity:0,x:x*.5,y:y*.5,scale:.92,rotate:(dx||dy)*distance*.6}),to:frame(),keyframes:[k(.7,{rotate:(dx||dy)*-3,scale:1.02})],duration:duration+60,easing});
  if(family[0]==="Drift") return timeline(name,{from:frame({opacity:0,x:x*.8+dy*10,y:y*.8-dx*10,filter:"blur(5px)"}),to:frame(),keyframes:[k(.62,{opacity:.94,x:-dy*4,y:dx*4,filter:"blur(0px)"})],duration:duration+160,easing:"cubic-bezier(0.22,1,0.36,1)"});
  return timeline(name,{from:frame({opacity:0,x:x*.45,y:y*.45,scale:.97,filter:`blur(${Math.max(5,Math.round(distance/5))}px)`}),to:frame(),keyframes:[k(.68,{opacity:1,filter:"blur(0px)"})],duration:duration+100,easing});
}

export function buildAnimateCssPresets() {
  return ANIMATE_CSS_GROUPS.flatMap(([group,names])=>names.map((name)=>({
    id:`builtin:animatecss:${name}`,
    builtinId:`animatecss:${name}`,
    name:readableAnimateName(name),
    category:`Animate.css · ${group}`,
    description:`VSN-native recreation of the Animate.css “${name}” preset. No external stylesheet is required.`,
    scope:"global",builtin:true,isFavorite:false,source:"animate.css",timeline:animateCssTimeline(name),tokens:{source:"animate.css",className:`animate__${name}`},
  })));
}

export function buildGeneratedVsnPresets() {
  const out=[];
  for(const family of GENERATED_FAMILIES) for(const direction of GENERATED_DIRECTIONS) for(const strength of GENERATED_STRENGTHS) for(const mood of GENERATED_MOODS) {
    const slug=[family[0],direction[0],strength[0],mood[0]].join("-").toLowerCase().replace(/[^a-z0-9]+/g,"-");
    out.push({
      id:`builtin:vsn:${slug}`,builtinId:`vsn:${slug}`,name:`VSN ${family[0]} ${direction[0]} · ${strength[0]} · ${mood[0]}`,
      category:`VSN ${family[1]}`,description:`${mood[0]} ${family[0].toLowerCase()} motion with a ${strength[0].toLowerCase()} ${direction[0].toLowerCase()} directional profile.`,
      scope:"global",builtin:true,isFavorite:false,source:"vsn",timeline:generatedTimeline(family,direction,strength,mood),tokens:{family:family[0],direction:direction[0],strength:strength[0],mood:mood[0]},
    });
  }
  return out;
}

export const ANIMATE_CSS_PRESET_COUNT = ANIMATE_CSS_GROUPS.reduce((sum,[,names])=>sum+names.length,0);
export const GENERATED_VSN_PRESET_COUNT = GENERATED_FAMILIES.length*GENERATED_DIRECTIONS.length*GENERATED_STRENGTHS.length*GENERATED_MOODS.length;
