import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { MOTION_ACTION_OPTIONS, MOTION_EASING_OPTIONS, MOTION_TARGET_OPTIONS, MOTION_TRIGGER_OPTIONS } from "../../builder/interactionSchema.js";
import { VsnButton, VsnCard, VsnCheckbox, VsnInput, VsnSelect, VsnTabs, VsnTextarea } from "../ui/VsnToolkit.jsx";
import { humanLabel } from "../../utils/display-format.js";

const EDITOR_TABS = [
  { value: "general", label: "Timeline" },
  { value: "action", label: "Actions" },
  { value: "frames", label: "Frames" },
  { value: "keyframes", label: "Keyframes" },
];

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ACTION_LABEL = Object.fromEntries(MOTION_ACTION_OPTIONS.map((item) => [item.value, item.label]));

function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function frameStyle(frame = {}) {
  const x=number(frame.x), y=number(frame.y), scale=number(frame.scale,1), rotate=number(frame.rotate);
  const style={transform:`translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${rotate}deg)`};
  if(frame.opacity!==null&&frame.opacity!==undefined)style.opacity=String(frame.opacity);
  if(frame.filter)style.filter=String(frame.filter);
  return style;
}
function frameRows(action = {}) {
  return [
    { id:"from", offset:0, frame:action.from||{} },
    ...(Array.isArray(action.keyframes)?action.keyframes:[]).map((item)=>({ id:item.id, offset:number(item.offset,.5), frame:item.frame||{} })),
    { id:"to", offset:1, frame:action.to||{} },
  ].sort((a,b)=>a.offset-b.offset);
}
function frameAtProgress(action = {}, progress = 0) {
  const rows=frameRows(action); const p=Math.max(0,Math.min(1,number(progress)));
  let left=rows[0]||{offset:0,frame:{}}, right=rows[rows.length-1]||left;
  for(let i=1;i<rows.length;i++){ if(p<=rows[i].offset){left=rows[i-1];right=rows[i];break;} }
  const span=Math.max(.0001,right.offset-left.offset), local=Math.max(0,Math.min(1,(p-left.offset)/span));
  const a=left.frame||{},b=right.frame||{}; const mix=(x,y,d=0)=>number(x,d)+(number(y,d)-number(x,d))*local;
  return {opacity:a.opacity==null&&b.opacity==null?null:mix(a.opacity??1,b.opacity??1,1),x:mix(a.x,b.x),y:mix(a.y,b.y),scale:mix(a.scale,b.scale,1),rotate:mix(a.rotate,b.rotate),filter:local<.5?(a.filter||""):(b.filter||"")};
}
function animationFrames(action = {}) { return frameRows(action).map((row)=>({...frameStyle(row.frame),offset:row.offset})); }
function defaultAction(type="animate") {
  return { id:uid("action"), type, target:{mode:"self",selector:"",slot:""}, duration:null, delay:0, easing:"inherit", from:{opacity:0,x:0,y:24,scale:1,rotate:0,filter:""}, to:{opacity:1,x:0,y:0,scale:1,rotate:0,filter:""}, keyframes:[], className:"", variable:"", value:"", selector:"", behavior:"smooth", eventName:"", eventDetail:"" };
}

function FrameEditor({ title, frame = {}, onChange }) {
  const patch=(key,value)=>onChange?.({...frame,[key]:value});
  return <div className="vsn-motion-frame-editor"><strong>{title}</strong><div className="vsn-motion-frame-grid">
    <VsnInput label="Opacity" type="number" min="0" max="1" step="0.05" value={frame.opacity??1} onChange={(e)=>patch("opacity",number(e.target.value,1))}/>
    <VsnInput label="X (px)" type="number" value={frame.x??0} onChange={(e)=>patch("x",number(e.target.value))}/>
    <VsnInput label="Y (px)" type="number" value={frame.y??0} onChange={(e)=>patch("y",number(e.target.value))}/>
    <VsnInput label="Scale" type="number" min="0" step="0.05" value={frame.scale??1} onChange={(e)=>patch("scale",number(e.target.value,1))}/>
    <VsnInput label="Rotate (°)" type="number" value={frame.rotate??0} onChange={(e)=>patch("rotate",number(e.target.value))}/>
    <VsnInput label="CSS filter" value={frame.filter||""} onChange={(e)=>patch("filter",e.target.value)} placeholder="blur(4px)"/>
  </div></div>;
}

function PreviewStage({ timeline, selectedActionIndex, playhead, setPlayhead, playbackRate }) {
  const nodeRef=useRef(null); const animationRef=useRef(null); const [playing,setPlaying]=useState(false);
  const actions=timeline?.actions||[]; const action=actions[selectedActionIndex]||actions.find((item)=>item.type==="animate")||{};
  const animateAction=action.type==="animate"?action:(actions.find((item)=>item.type==="animate")||{});
  const timing=timeline?.timeline||{};
  const duration=Math.max(1,number(animateAction.duration??timing.duration,400));
  const easing=animateAction.easing&&animateAction.easing!=="inherit"?animateAction.easing:(timing.easing||"ease");
  const scrub=(next)=>{const p=Math.max(0,Math.min(1,number(next)));setPlayhead(p);animationRef.current?.cancel?.();animationRef.current=null;setPlaying(false);if(nodeRef.current)Object.assign(nodeRef.current.style,frameStyle(frameAtProgress(animateAction,p)));};
  const play=()=>{const node=nodeRef.current;if(!node||animateAction.type!=="animate")return;animationRef.current?.cancel?.();const anim=node.animate(animationFrames(animateAction),{duration:duration/Math.max(.1,playbackRate),delay:Math.max(0,number(timing.delay)+number(animateAction.delay)),easing,iterations:timing.yoyo?Math.max(2,(number(timing.repeat)+1)*2):Math.max(1,number(timing.repeat)+1),direction:timing.yoyo?"alternate":"normal",fill:"both"});animationRef.current=anim;setPlaying(true);anim.onfinish=()=>{setPlaying(false);setPlayhead(timing.yoyo?0:1);};};
  const pause=()=>{animationRef.current?.pause?.();setPlaying(false);};
  const reset=()=>{animationRef.current?.cancel?.();animationRef.current=null;scrub(0);};
  useEffect(()=>{scrub(playhead);return()=>animationRef.current?.cancel?.();},[animateAction]);
  return <div className="vsn-motion-advanced-preview">
    <div className="vsn-motion-preview-toolbar"><div><strong>Live Preview</strong><span>{ACTION_LABEL[action.type]||humanLabel(action.type||"animate")} · {duration}ms</span></div><div className="vsn-motion-preview-actions"><VsnButton size="xs" icon={<RotateCcw size={13}/>} onClick={reset}>Reset</VsnButton><VsnButton size="xs" variant="primary" icon={playing?<Pause size={13}/>:<Play size={13}/>} onClick={playing?pause:play}>{playing?"Pause":"Play"}</VsnButton></div></div>
    <div className="vsn-motion-advanced-stage"><div className="vsn-motion-stage-grid"/><div ref={nodeRef} className="vsn-motion-advanced-object"><span>VSN</span><small>Motion</small></div></div>
    <div className="vsn-motion-scrubber"><div className="vsn-motion-scrubber-head"><span>Playhead</span><b>{Math.round(playhead*100)}%</b></div><div className="vsn-motion-track-wrap"><input aria-label="Animation playhead" type="range" min="0" max="100" value={Math.round(playhead*100)} onChange={(e)=>scrub(number(e.target.value)/100)}/><div className="vsn-motion-keyframe-markers">{frameRows(animateAction).map((row)=><button key={row.id} type="button" title={`${Math.round(row.offset*100)}%`} style={{left:`${row.offset*100}%`}} onClick={()=>scrub(row.offset)}/>)}</div></div></div>
  </div>;
}

export default function MotionAdvancedEditor({ form, setForm }) {
  const [tab,setTab]=useState("general"); const [selectedActionIndex,setSelectedActionIndex]=useState(0); const [playhead,setPlayhead]=useState(0); const [playbackRate,setPlaybackRate]=useState(1);
  const timeline=form?.timeline||{}; const timing=timeline.timeline||{}; const trigger=timeline.trigger||{}; const actions=timeline.actions||[]; const action=actions[selectedActionIndex]||actions[0]||defaultAction();
  useEffect(()=>{if(selectedActionIndex>=actions.length)setSelectedActionIndex(Math.max(0,actions.length-1));},[actions.length,selectedActionIndex]);
  const patchForm=(patch)=>setForm((current)=>({...current,...patch}));
  const patchTimeline=(patch)=>setForm((current)=>({...current,timeline:{...current.timeline,...patch}}));
  const patchTiming=(patch)=>patchTimeline({timeline:{...timing,...patch}});
  const patchTrigger=(patch)=>patchTimeline({trigger:{...trigger,...patch}});
  const patchAction=(patch,index=selectedActionIndex)=>setForm((current)=>{const next=[...(current.timeline?.actions||[])];next[index]={...(next[index]||defaultAction()),...patch};return {...current,timeline:{...current.timeline,actions:next}};});
  const addAction=()=>{const next=defaultAction("animate");patchTimeline({actions:[...actions,next]});setSelectedActionIndex(actions.length);setTab("action");};
  const duplicateAction=()=>{const copy=JSON.parse(JSON.stringify(action));copy.id=uid("action");copy.keyframes=(copy.keyframes||[]).map((row)=>({...row,id:uid("keyframe")}));const next=[...actions];next.splice(selectedActionIndex+1,0,copy);patchTimeline({actions:next});setSelectedActionIndex(selectedActionIndex+1);};
  const removeAction=()=>{if(actions.length<=1)return;patchTimeline({actions:actions.filter((_,index)=>index!==selectedActionIndex)});setSelectedActionIndex(Math.max(0,selectedActionIndex-1));};
  const addKeyframe=()=>{if(action.type!=="animate"||(action.keyframes||[]).length>=12)return;let offset=Math.max(.01,Math.min(.99,playhead));if(offset<=.01||offset>=.99)offset=.5;const keyframe={id:uid("keyframe"),offset,frame:frameAtProgress(action,offset)};patchAction({keyframes:[...(action.keyframes||[]),keyframe].sort((a,b)=>a.offset-b.offset)});setTab("keyframes");};
  const patchKeyframe=(id,patch)=>patchAction({keyframes:(action.keyframes||[]).map((row)=>row.id===id?{...row,...patch}:row).sort((a,b)=>a.offset-b.offset)});
  const removeKeyframe=(id)=>patchAction({keyframes:(action.keyframes||[]).filter((row)=>row.id!==id)});
  const setActionType=(type)=>patchAction({...defaultAction(type),id:action.id,type,target:action.target||{mode:"self",selector:"",slot:""}});
  const actionTarget=action.target||{};
  const actionOptions=useMemo(()=>MOTION_ACTION_OPTIONS.map((item)=>({value:item.value,label:item.label})),[]);

  return <div className="vsn-motion-editor-workspace">
    <aside className="vsn-motion-editor-preview-column">
      <PreviewStage timeline={timeline} selectedActionIndex={selectedActionIndex} playhead={playhead} setPlayhead={setPlayhead} playbackRate={playbackRate}/>
      <VsnCard title="Playback"><div className="vsn-motion-playback-row"><VsnSelect label="Preview speed" value={String(playbackRate)} onChange={(e)=>setPlaybackRate(number(e.target.value,1))}>{RATE_OPTIONS.map((rate)=><option key={rate} value={rate}>{rate}×</option>)}</VsnSelect><div className="vsn-motion-summary-chips"><span>{actions.length} action{actions.length===1?"":"s"}</span><span>{actions.reduce((sum,row)=>sum+(row.keyframes?.length||0),0)} keyframes</span><span>{humanLabel(trigger.type||"click")}</span></div></div></VsnCard>
    </aside>
    <section className="vsn-motion-editor-inspector">
      <div className="vsn-motion-editor-tabs"><VsnTabs items={EDITOR_TABS} value={tab} onChange={setTab}/></div>
      <div className="vsn-motion-editor-scroll">
        {tab==="general"?<div className="vsn-stack">
          <div className="vsn-two-column-grid"><VsnInput label="Name" value={form.name} onChange={(e)=>patchForm({name:e.target.value})}/><VsnSelect label="Scope" value={form.scope} onChange={(e)=>patchForm({scope:e.target.value})}><option value="global">Global</option><option value="component">Component</option><option value="local">Local</option></VsnSelect></div>
          <VsnTextarea label="Description" rows={2} value={form.description||""} onChange={(e)=>patchForm({description:e.target.value})}/>
          <VsnCard title="Trigger"><div className="vsn-stack"><VsnSelect label="Trigger type" value={trigger.type||"viewport-enter"} onChange={(e)=>patchTrigger({type:e.target.value})}>{MOTION_TRIGGER_OPTIONS.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</VsnSelect><div className="vsn-two-column-grid"><VsnInput label="Trigger selector" value={trigger.selector||""} onChange={(e)=>patchTrigger({selector:e.target.value})} placeholder="Optional child selector"/><VsnInput label="Viewport threshold" type="number" min="0" max="1" step="0.05" value={trigger.threshold??.15} onChange={(e)=>patchTrigger({threshold:number(e.target.value,.15)})}/></div>{trigger.type==="custom-event"?<VsnInput label="Custom event name" value={trigger.eventName||""} onChange={(e)=>patchTrigger({eventName:e.target.value})} placeholder="vsn:my-event"/>:null}<VsnCheckbox label="Run only once per element" checked={trigger.once===true} onChange={(e)=>patchTrigger({once:e.target.checked})}/></div></VsnCard>
          <VsnCard title="Timeline timing"><div className="vsn-motion-editor-timing"><VsnInput label="Duration (ms)" type="number" min="0" value={timing.duration??400} onChange={(e)=>patchTiming({duration:number(e.target.value)})}/><VsnInput label="Delay (ms)" type="number" min="0" value={timing.delay??0} onChange={(e)=>patchTiming({delay:number(e.target.value)})}/><VsnInput label="Stagger (ms)" type="number" min="0" value={timing.stagger??0} onChange={(e)=>patchTiming({stagger:number(e.target.value)})}/></div><div className="vsn-two-column-grid"><VsnSelect label="Easing" value={timing.easing||"ease"} onChange={(e)=>patchTiming({easing:e.target.value})}>{MOTION_EASING_OPTIONS.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</VsnSelect><VsnSelect label="Reduced motion" value={timing.reducedMotion||"instant"} onChange={(e)=>patchTiming({reducedMotion:e.target.value})}><option value="instant">Final state instantly</option><option value="skip">Skip animation</option><option value="allow">Allow full motion</option></VsnSelect></div><div className="vsn-two-column-grid"><VsnInput label="Repeat" type="number" min="0" max="100" value={timing.repeat??0} onChange={(e)=>patchTiming({repeat:number(e.target.value)})}/><VsnCheckbox label="Yoyo / alternate direction" checked={timing.yoyo===true} onChange={(e)=>patchTiming({yoyo:e.target.checked})}/></div></VsnCard>
        </div>:null}

        {tab==="action"?<div className="vsn-stack"><div className="vsn-motion-action-toolbar"><VsnSelect label="Selected action" value={String(selectedActionIndex)} onChange={(e)=>setSelectedActionIndex(number(e.target.value))}>{actions.map((row,index)=><option key={row.id||index} value={index}>{index+1}. {ACTION_LABEL[row.type]||humanLabel(row.type)}</option>)}</VsnSelect><div><VsnButton size="xs" icon={<Plus size={13}/>} onClick={addAction}>Add</VsnButton><VsnButton size="xs" icon={<Copy size={13}/>} onClick={duplicateAction}>Duplicate</VsnButton><VsnButton size="xs" variant="danger" icon={<Trash2 size={13}/>} disabled={actions.length<=1} onClick={removeAction}>Delete</VsnButton></div></div>
          <VsnCard title="Action"><div className="vsn-stack"><VsnSelect label="Action type" value={action.type||"animate"} onChange={(e)=>setActionType(e.target.value)}>{actionOptions.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</VsnSelect><div className="vsn-two-column-grid"><VsnSelect label="Target" value={actionTarget.mode||"self"} onChange={(e)=>patchAction({target:{...actionTarget,mode:e.target.value}})}>{MOTION_TARGET_OPTIONS.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</VsnSelect>{actionTarget.mode==="component-slot"?<VsnInput label="Slot" value={actionTarget.slot||""} onChange={(e)=>patchAction({target:{...actionTarget,slot:e.target.value}})}/>:<VsnInput label="Target selector" value={actionTarget.selector||""} onChange={(e)=>patchAction({target:{...actionTarget,selector:e.target.value}})} placeholder={actionTarget.mode==="self"?"Not required":".selector"}/>}</div>{action.type==="animate"?<><div className="vsn-motion-editor-timing"><VsnInput label="Action duration" type="number" min="0" placeholder="Inherit" value={action.duration??""} onChange={(e)=>patchAction({duration:e.target.value===""?null:number(e.target.value)})}/><VsnInput label="Action delay" type="number" min="0" value={action.delay??0} onChange={(e)=>patchAction({delay:number(e.target.value)})}/><VsnSelect label="Action easing" value={action.easing||"inherit"} onChange={(e)=>patchAction({easing:e.target.value})}><option value="inherit">Inherit timeline</option>{MOTION_EASING_OPTIONS.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</VsnSelect></div></>:null}{action.type==="class-toggle"?<VsnInput label="Class name" value={action.className||""} onChange={(e)=>patchAction({className:e.target.value})}/>:null}{action.type==="style-variable"?<div className="vsn-two-column-grid"><VsnInput label="CSS variable" value={action.variable||""} onChange={(e)=>patchAction({variable:e.target.value})} placeholder="--progress"/><VsnInput label="Value" value={action.value||""} onChange={(e)=>patchAction({value:e.target.value})}/></div>:null}{["scroll-to","popup-open"].includes(action.type)?<VsnInput label={action.type==="scroll-to"?"Scroll selector":"Popup selector"} value={action.selector||""} onChange={(e)=>patchAction({selector:e.target.value})} placeholder="#target"/>:null}{action.type==="scroll-to"?<VsnSelect label="Scroll behavior" value={action.behavior||"smooth"} onChange={(e)=>patchAction({behavior:e.target.value})}><option value="smooth">Smooth</option><option value="auto">Instant</option></VsnSelect>:null}{action.type==="custom-event"?<><VsnInput label="Event name" value={action.eventName||""} onChange={(e)=>patchAction({eventName:e.target.value})} placeholder="vsn:custom"/><VsnTextarea label="Event detail (JSON or text)" rows={3} value={action.eventDetail||""} onChange={(e)=>patchAction({eventDetail:e.target.value})}/></>:null}</div></VsnCard>
        </div>:null}

        {tab==="frames"?<div className="vsn-stack">{action.type!=="animate"?<VsnCard title="Frames unavailable"><p className="vsn-help-text">Select an Animate Style action to edit transform, opacity and filter frames.</p></VsnCard>:<><FrameEditor title="From · 0%" frame={action.from||{}} onChange={(frame)=>patchAction({from:frame})}/><FrameEditor title="To · 100%" frame={action.to||{}} onChange={(frame)=>patchAction({to:frame})}/><VsnCard title="Quick frame tools"><div className="vsn-row-actions"><VsnButton size="xs" onClick={()=>patchAction({from:{...(action.from||{}),opacity:0},to:{...(action.to||{}),opacity:1}})}>Fade</VsnButton><VsnButton size="xs" onClick={()=>patchAction({from:{...(action.from||{}),scale:.8},to:{...(action.to||{}),scale:1}})}>Scale in</VsnButton><VsnButton size="xs" onClick={()=>patchAction({from:{...(action.from||{}),y:32},to:{...(action.to||{}),y:0}})}>Rise</VsnButton><VsnButton size="xs" onClick={()=>patchAction({from:{...(action.from||{}),rotate:-8},to:{...(action.to||{}),rotate:0}})}>Rotate in</VsnButton></div></VsnCard></>}</div>:null}

        {tab==="keyframes"?<div className="vsn-stack">{action.type!=="animate"?<VsnCard title="Keyframes unavailable"><p className="vsn-help-text">Keyframes apply only to Animate Style actions.</p></VsnCard>:<><div className="vsn-motion-keyframe-head"><div><strong>Intermediate keyframes</strong><span>Up to 12 points between From and To.</span></div><VsnButton size="xs" icon={<Plus size={13}/>} disabled={(action.keyframes||[]).length>=12} onClick={addKeyframe}>Add at {Math.round(playhead*100)}%</VsnButton></div>{(action.keyframes||[]).length?(action.keyframes||[]).map((row,index)=><VsnCard key={row.id||index} title={`Keyframe ${index+1} · ${Math.round(number(row.offset,.5)*100)}%`} actions={<VsnButton size="xs" variant="danger" icon={<Trash2 size={12}/>} onClick={()=>removeKeyframe(row.id)}>Remove</VsnButton>}><div className="vsn-stack"><label className="vsn-motion-offset-field"><span>Timeline position</span><input type="range" min="1" max="99" value={Math.round(number(row.offset,.5)*100)} onChange={(e)=>patchKeyframe(row.id,{offset:number(e.target.value)/100})}/><b>{Math.round(number(row.offset,.5)*100)}%</b></label><FrameEditor title="Frame values" frame={row.frame||{}} onChange={(frame)=>patchKeyframe(row.id,{frame})}/></div></VsnCard>):<VsnCard title="No intermediate keyframes"><p className="vsn-help-text">Move the playhead to the point you want, then add a keyframe. From (0%) and To (100%) are always present.</p></VsnCard>}</>}</div>:null}
      </div>
    </section>
  </div>;
}
