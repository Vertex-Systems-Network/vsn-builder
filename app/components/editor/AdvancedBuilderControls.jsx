import { VsnButton, VsnTextField } from "./EditorUi";
import { useState } from "react";
import PolarisIcon from "../ui/PolarisIcon";
import {
  AlertControl,
  AspectRatioControl,
  BackdropFilterControl,
  BackgroundControl,
  BlendModeControl,
  BorderControl,
  BoxShadowControl,
  ButtonSetControl,
  ColorGradientControl,
  CssKeywordLengthControl,
  CssLengthControl,
  CursorControl,
  FlexControl,
  GridLayoutControl,
  LinkedDimensionsControl,
  NumberControl,
  OverflowControl,
  PositionControl,
  SelectControl,
  SliderControl,
  SwitcherControl,
  TextControl,
  TransformControl,
  TransitionControl,
} from "./EditorControls";
import FilterEffectsControl from "./FilterEffectsControl";
import FontFamilyControl from "./fonts/FontFamilyControl";
import { getWidgetCapabilities } from "../../builder/widgetCapabilities";
import { dynamicFieldsForWidget, dynamicSourcesForType, inspectDynamicBindings, normalizeBindings } from "../../builder/dynamicBindings.js";
import { breakpointById, buildFluidClamp, createCustomBreakpoint, inheritedBreakpointSource, normalizeResponsiveBreakpoints } from "../../builder/responsiveEngine.js";

function Panel({ title, children, defaultOpen = true, badge = "" }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-visible rounded-xl border border-[#e3e3e3] bg-white">
      <VsnButton type="button" variant="plain" onClick={() => setOpen((v) => !v)} className="vsn-advanced-panel-toggle">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#303030]">{title}{badge ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-[#006e52]">{badge}</span> : null}</span>
        <span className={open ? "rotate-90" : ""}><PolarisIcon type="chevron-right" size="small" /></span>
      </VsnButton>
      {open ? <div className="space-y-3 border-t border-[#f1f1f1] p-3">{children}</div> : null}
    </section>
  );
}

const SOURCES = [
  ["", "Select source"],
  ["product.title", "Product · title"],
  ["product.description", "Product · description"],
  ["product.vendor", "Product · vendor"],
  ["product.productType", "Product · type"],
  ["product.price", "Product · price"],
  ["product.featuredImage.url", "Product · featured image"],
  ["product.metafield", "Product · metafield"],
  ["collection.title", "Collection · title"],
  ["collection.description", "Collection · description"],
  ["collection.image.url", "Collection · image"],
  ["article.title", "Article · title"],
  ["article.excerpt", "Article · excerpt"],
  ["article.author.name", "Article · author"],
  ["article.image.url", "Article · image"],
  ["blog.title", "Blog · title"],
  ["customer.name", "Customer · name"],
  ["customer.email", "Customer · email"],
  ["query.search", "URL query parameter"],
  ["metaobject.field", "Metaobject · field"],
].map(([value, label]) => ({ value, label }));

const RULES = [
  ["always", "Always"], ["logged-in", "Customer logged in"], ["logged-out", "Customer logged out"],
  ["product-available", "Product available"], ["product-sold-out", "Product sold out"], ["product-vendor", "Product vendor equals"],
  ["product-type", "Product type equals"], ["product-tag", "Product tag contains"], ["collection-handle", "Collection handle equals"],
  ["market", "Market / country equals"], ["language", "Language equals"], ["cart-empty", "Cart is empty"], ["cart-has-items", "Cart has items"], ["cart-items-min", "Cart item count at least"], ["product-inventory-min", "Product inventory at least"], ["product-inventory-max", "Product inventory at most"], ["device-mobile", "Mobile only"], ["device-tablet", "Tablet only"],
  ["device-desktop", "Desktop only"], ["query-param", "URL query parameter equals"], ["date-after", "Date/time after"], ["date-before", "Date/time before"],
].map(([value, label]) => ({ value, label }));

function newRule() { return { id: globalThis.crypto?.randomUUID?.() || `rule-${Date.now()}-${Math.random()}`, rule: "always", key: "", value: "" }; }
function newGroup() { return { id: globalThis.crypto?.randomUUID?.() || `group-${Date.now()}-${Math.random()}`, operator: "AND", rules: [newRule()] }; }

export function DynamicSourcePanel({ element, onUpdate }) {
  const dynamic = element?.dynamicSource || {};
  const patch = (next) => onUpdate?.(element.id, { dynamicSource: { ...dynamic, ...next } });
  const bound = dynamic.enabled && dynamic.source;
  return <Panel title="Dynamic Source" badge={bound ? "BOUND" : ""}>
    <SwitcherControl label="Enable dynamic source" checked={dynamic.enabled === true} onChange={(enabled) => patch({ enabled })} />
    {dynamic.enabled ? <>
      <SelectControl label="Source" value={dynamic.source || ""} onChange={(source) => patch({ source })} options={SOURCES} />
      <ButtonSetControl label="Bind to" value={dynamic.target || "text"} onChange={(target) => patch({ target })} options={[{value:"text",label:"Text"},{value:"src",label:"Image"},{value:"url",label:"URL"}]} />
      {dynamic.source === "product.metafield" ? <div className="grid grid-cols-2 gap-2"><TextControl label="Namespace" value={dynamic.namespace || "custom"} onChange={(namespace)=>patch({namespace})}/><TextControl label="Key" value={dynamic.key || ""} onChange={(key)=>patch({key})}/></div> : null}
      {dynamic.source === "query.search" ? <TextControl label="Query parameter" value={dynamic.key || ""} onChange={(key)=>patch({key})}/> : null}
      {dynamic.source === "metaobject.field" ? <>
        <TextControl label="Metaobject handle / ID" value={dynamic.metaobjectId || ""} placeholder="gid://... or handle" onChange={(metaobjectId)=>patch({metaobjectId})}/>
        <TextControl label="Metaobject type" value={dynamic.metaobjectType || ""} placeholder="custom_type (needed for handle lookup)" onChange={(metaobjectType)=>patch({metaobjectType})}/>
        <TextControl label="Field key" value={dynamic.key || ""} onChange={(key)=>patch({key})}/>
      </> : null}
      <TextControl label="Fallback value" value={dynamic.fallback || ""} onChange={(fallback)=>patch({fallback})}/>
      <div className="flex items-center justify-between rounded-lg bg-[#f6f6f7] px-2.5 py-2 text-[10px] text-[#6d7175]"><span>Binding</span><code className="max-w-[160px] truncate">{dynamic.source || "—"} → {dynamic.target || "text"}</code></div>
    </> : null}
  </Panel>;
}


export function DynamicBindingInspector({ element, context = {} }) {
  const rows = inspectDynamicBindings(element, context);
  if (!rows.length) return null;
  return <Panel title="Data Binding Inspector" badge={`${rows.length} ACTIVE`} defaultOpen={false}>
    <p className="text-[10px] leading-4 text-[#6d7175]">Inspect the selected element's source, resolved preview value and fallback behavior without changing the binding.</p>
    <div className="space-y-2">{rows.map((row)=><div key={`${row.path}:${row.source}`} className="rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-2.5"><div className="flex items-start justify-between gap-2"><div><strong className="text-[11px] text-[#303030]">{row.label}</strong><div className="mt-0.5 font-mono text-[9px] text-[#8c9196]">{row.path}</div></div><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${row.value==null||row.value===''?'bg-amber-50 text-amber-700':row.usedFallback?'bg-blue-50 text-blue-700':'bg-emerald-50 text-emerald-700'}`}>{row.value==null||row.value===''?'EMPTY':row.usedFallback?'FALLBACK':'RESOLVED'}</span></div><div className="mt-2 grid gap-1 text-[10px]"><div className="flex justify-between gap-2"><span className="text-[#8c9196]">Source</span><code className="max-w-[190px] truncate text-[#303030]">{row.source}</code></div><div className="flex justify-between gap-2"><span className="text-[#8c9196]">Preview</span><code className="max-w-[190px] truncate text-[#303030]">{row.value==null||row.value===''?'—':String(row.value)}</code></div>{row.fallback?<div className="flex justify-between gap-2"><span className="text-[#8c9196]">Fallback</span><code className="max-w-[190px] truncate text-[#303030]">{row.fallback}</code></div>:null}</div></div>)}</div>
  </Panel>;
}

export function DynamicBindingsPanel({ element, onUpdate, context = {} }) {
  const fields = dynamicFieldsForWidget(element?.type);
  const bindings = normalizeBindings(element?.bindings);
  const focusedPath = element?.meta?.dynamicFocusPath || "";
  const boundCount = Object.values(bindings).filter((item)=>item?.enabled && item?.source).length;
  if (!fields.length) return null;
  const patchBinding = (path, patch) => onUpdate?.(element.id, { bindings: { ...bindings, [path]: { ...(bindings[path] || {}), ...patch } } });
  return <Panel title="Dynamic Bindings 2.0" badge={boundCount ? `${boundCount} BOUND` : ""}>
    <p className="text-[10px] leading-4 text-[#6d7175]">Bind each compatible field independently. Sources are filtered by field data type; multiple fields can be dynamic at the same time.</p>
    <div className="space-y-2">
      {fields.map((field)=>{
        const binding = bindings[field.path] || {};
        const enabled = binding.enabled === true;
        const sources = [{value:"",label:`Select ${field.type} source`}, ...dynamicSourcesForType(field.type)];
        return <div key={field.path} className={`rounded-lg border p-2.5 ${focusedPath===field.path?'border-[#95BF47] bg-[#f7fbef]':'border-[#e3e3e3] bg-[#fafafa]'}`}>
          <div className="mb-2 flex items-center justify-between gap-2"><div><strong className="text-[11px] text-[#303030]">⚡ {field.label}</strong><div className="text-[9px] text-[#8c9196]">{field.path} · {field.type}</div></div><SwitcherControl label="" checked={enabled} onChange={(value)=>patchBinding(field.path,{enabled:value,type:field.type})}/></div>
          {enabled ? <div className="space-y-2">
            <SelectControl label="Source" value={binding.source || ""} onChange={(source)=>patchBinding(field.path,{source,type:field.type})} options={sources}/>
            {binding.source === "product.metafield" ? <div className="grid grid-cols-2 gap-2"><TextControl label="Namespace" value={binding.namespace || "custom"} onChange={(namespace)=>patchBinding(field.path,{namespace})}/><TextControl label="Key" value={binding.key || ""} onChange={(key)=>patchBinding(field.path,{key})}/></div> : null}
            {binding.source === "query.search" ? <TextControl label="Query parameter" value={binding.key || ""} onChange={(key)=>patchBinding(field.path,{key})}/> : null}
            {binding.source === "metaobject.field" ? <><TextControl label="Metaobject handle / ID" value={binding.metaobjectId || ""} onChange={(metaobjectId)=>patchBinding(field.path,{metaobjectId})}/><div className="grid grid-cols-2 gap-2"><TextControl label="Type" value={binding.metaobjectType || ""} onChange={(metaobjectType)=>patchBinding(field.path,{metaobjectType})}/><TextControl label="Field key" value={binding.key || ""} onChange={(key)=>patchBinding(field.path,{key})}/></div></> : null}
            <TextControl label="Fallback" value={binding.fallback || ""} onChange={(fallback)=>patchBinding(field.path,{fallback})}/>
            {field.type === "text" || field.type === "number" || field.type === "date" ? <><div className="grid grid-cols-2 gap-2"><TextControl label="Before" value={binding.before || ""} onChange={(before)=>patchBinding(field.path,{before})}/><TextControl label="After" value={binding.after || ""} onChange={(after)=>patchBinding(field.path,{after})}/></div><SelectControl label="Format" value={binding.format || ""} onChange={(format)=>patchBinding(field.path,{format})} options={[{value:"",label:"Default"},{value:"uppercase",label:"UPPERCASE"},{value:"lowercase",label:"lowercase"},{value:"capitalize",label:"Capitalize"}]}/><NumberControl label="Truncate characters" value={binding.truncate ?? ""} min={0} max={5000} onChange={(truncate)=>patchBinding(field.path,{truncate:truncate===""?"":Number(truncate)})}/></> : null}
          </div> : null}
        </div>;
      })}
    </div>
    {element?.dynamicSource?.enabled ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-4 text-amber-800">Legacy Dynamic Source is still preserved for backward compatibility. Dynamic Bindings 2.0 takes priority when both target the same field.</div> : null}
    <DynamicBindingInspector element={element} context={context} />
  </Panel>;
}

function RuleEditor({ rule, onChange, onRemove }) {
  const needsValue = ["product-vendor","product-type","product-tag","collection-handle","market","language","query-param","cart-items-min","product-inventory-min","product-inventory-max","date-after","date-before"].includes(rule.rule);
  return <div className="rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-2.5 space-y-2">
    <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><SelectControl value={rule.rule || "always"} onChange={(value)=>onChange({...rule,rule:value})} options={RULES}/></div><VsnButton type="button" title="Remove rule" onClick={onRemove} variant="icon" size="sm" tone="critical" className="vsn-icon-button mt-0.5"><PolarisIcon type="delete" size="small"/></VsnButton></div>
    {rule.rule === "query-param" ? <TextControl label="Parameter" value={rule.key || ""} onChange={(key)=>onChange({...rule,key})}/> : null}
    {needsValue ? (rule.rule.startsWith("date-") ? <VsnTextField label="Date & time" value={rule.value || ""} placeholder="YYYY-MM-DDTHH:mm" onInput={(event)=>onChange({...rule,value:event.currentTarget.value || ""})} /> : <TextControl label="Value" value={rule.value || ""} onChange={(value)=>onChange({...rule,value})}/>) : null}
  </div>;
}

export function ConditionsBuilder({ element, onUpdate }) {
  const conditions = element?.conditions || {};
  const groups = Array.isArray(conditions.groups) && conditions.groups.length ? conditions.groups : [{ id: "legacy-group", operator: "AND", rules: conditions.rule ? [{ id: "legacy-rule", rule: conditions.rule, key: conditions.key || "", value: conditions.value || "" }] : [{ id: "legacy-rule", rule: "always", key: "", value: "" }] }];
  const patch = (next) => onUpdate?.(element.id,{conditions:{...conditions,...next}});
  const setGroups = (next) => patch({groups:next});
  return <Panel title="Conditional Display" badge={conditions.enabled ? `${groups.reduce((n,g)=>n+(g.rules?.length||0),0)} RULES` : ""} defaultOpen={false}>
    <SwitcherControl label="Enable conditions" checked={conditions.enabled === true} onChange={(enabled)=>patch({enabled})}/>
    {conditions.enabled ? <>
      <ButtonSetControl label="Editor preview" value={conditions.preview || "actual"} onChange={(preview)=>patch({preview})} options={[{value:"actual",label:"Actual"},{value:"show",label:"Force show"},{value:"hide",label:"Force hide"}]} />
      <ButtonSetControl label="Match groups" value={conditions.operator || "AND"} onChange={(operator)=>patch({operator})} options={[{value:"AND",label:"AND"},{value:"OR",label:"OR"}]}/>
      <div className="space-y-3">{groups.map((group,gi)=><div key={group.id || gi} className="rounded-xl border border-[#d9d9d9] p-2.5 space-y-2">
        <div className="flex items-center justify-between"><strong className="text-[10px] uppercase tracking-wide text-[#6d7175]">Group {gi+1}</strong><div className="flex items-center gap-1"><ButtonSetControl value={group.operator||"AND"} onChange={(operator)=>setGroups(groups.map((g,i)=>i===gi?{...g,operator}:g))} options={[{value:"AND",label:"AND"},{value:"OR",label:"OR"}]}/>{groups.length>1?<VsnButton type="button" variant="icon" size="sm" tone="critical" className="vsn-icon-button" onClick={()=>setGroups(groups.filter((_,i)=>i!==gi))}><PolarisIcon type="delete" size="small"/></VsnButton>:null}</div></div>
        {(group.rules||[]).map((rule,ri)=><RuleEditor key={rule.id||ri} rule={rule} onChange={(next)=>setGroups(groups.map((g,i)=>i===gi?{...g,rules:g.rules.map((r,j)=>j===ri?next:r)}:g))} onRemove={()=>setGroups(groups.map((g,i)=>i===gi?{...g,rules:g.rules.filter((_,j)=>j!==ri)}:g))}/>) }
        <VsnButton type="button" variant="tertiary" size="sm" className="vsn-inline-add" onClick={()=>setGroups(groups.map((g,i)=>i===gi?{...g,rules:[...(g.rules||[]),newRule()]}:g))}><PolarisIcon type="plus" size="small"/>Add rule</VsnButton>
      </div>)}</div>
      <VsnButton type="button" variant="tertiary" className="vsn-dashed-add" onClick={()=>setGroups([...groups,newGroup()])}><PolarisIcon type="plus" size="small"/>Add condition group</VsnButton>
    </> : null}
  </Panel>;
}

export function ResponsivePanel({ element, deviceMode, onUpdate, capabilities, globalStyles = {} }) {
  const caps = capabilities || getWidgetCapabilities(element?.type);
  const breakpoints = normalizeResponsiveBreakpoints(globalStyles);
  const active = breakpointById(globalStyles, deviceMode);
  const responsive = element?.responsive || {};
  const device = responsive?.[deviceMode] || {};
  const styles = device.styles || {};
  const props = device.props || {};
  const update = (next) => onUpdate?.(element.id,{responsive:{...responsive,[deviceMode]:{...device,...next}}});
  const styleSection=(section,patch)=>update({styles:{...styles,[section]:{...(styles[section]||{}),...patch}}});
  const resetSection=(section)=>{const next={...styles};delete next[section];update({styles:next});};
  const inherited = !Object.keys(styles).length && !Object.keys(props).length;
  const inheritedFrom = inheritedBreakpointSource(element, globalStyles, deviceMode);
  const container = element?.responsiveContainer || {};
  const query = element?.containerQuery || {};
  const [fluidMin,setFluidMin]=useState(16); const [fluidMax,setFluidMax]=useState(32);
  const applyFluid=()=>styleSection('typography',{fontSize:buildFluidClamp({min:fluidMin,max:fluidMax,minViewport:320,maxViewport:active?.maxWidth||1440})});
  return <Panel title={`Responsive · ${active?.label || deviceMode}`} badge={inherited ? `FROM ${String(inheritedFrom).toUpperCase()}` : "OVERRIDE"} defaultOpen={false}>
    <div className="flex items-center justify-between rounded-lg bg-[#f6f6f7] px-2.5 py-2 text-[10px] text-[#6d7175]"><span>{inherited ? `Inherited from ${inheritedFrom === 'base' ? 'base styles' : inheritedFrom}` : `Overrides active for ${active?.minWidth||0}px${active?.maxWidth==null?' +':`–${active.maxWidth}px`}`}</span>{!inherited?<VsnButton type="button" className="font-semibold text-[#b42318]" onClick={()=>onUpdate?.(element.id,{responsive:{...responsive,[deviceMode]:{}}})}>Reset breakpoint</VsnButton>:null}</div>
    <SwitcherControl label={`Visible on ${active?.label || deviceMode}`} checked={props.visible !== false} onChange={(visible)=>update({props:{...props,visible}})}/>
    {caps.typography ? <div className="space-y-2 rounded-lg border border-[#eee] p-2">
      <div className="flex items-center justify-between"><strong className="text-[10px] uppercase tracking-wide text-[#6d7175]">Typography</strong>{styles.typography?<VsnButton type="button" variant="plain" size="slim" onClick={()=>resetSection('typography')}>Reset</VsnButton>:null}</div>
      <div className="grid grid-cols-2 gap-2"><FontFamilyControl label="Font family" value={styles.typography?.fontFamily || "inherit"} fontWeight={styles.typography?.fontWeight} fontStyle={styles.typography?.fontStyle} onChange={(fontFamily)=>styleSection("typography",{fontFamily})}/><SelectControl label="Weight" value={styles.typography?.fontWeight ?? ""} onChange={(fontWeight)=>styleSection("typography",{fontWeight})} options={[{value:"",label:"Inherit"},"300","400","500","600","700","800","900"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={styles.typography?.fontSize ?? ""} defaultUnit="px" onChange={(fontSize)=>styleSection("typography",{fontSize})}/><NumberControl label="Line height" value={styles.typography?.lineHeight ?? ""} onChange={(lineHeight)=>styleSection("typography",{lineHeight})}/></div>
      <div className="rounded-lg bg-[#fafafa] p-2"><div className="mb-2 text-[10px] font-medium text-[#6d7175]">Fluid clamp() generator</div><div className="grid grid-cols-2 gap-2"><NumberControl label="Min px" value={fluidMin} min={1} max={300} onChange={setFluidMin}/><NumberControl label="Max px" value={fluidMax} min={1} max={400} onChange={setFluidMax}/></div><VsnButton type="button" variant="tertiary" size="sm" className="mt-2 w-full" onClick={applyFluid}>Apply fluid font size</VsnButton></div>
    </div> : null}
    {caps.sizing ? <div className="rounded-lg border border-[#eee] p-2"><div className="mb-2 flex items-center justify-between"><strong className="text-[10px] uppercase tracking-wide text-[#6d7175]">Sizing</strong>{styles.size?<VsnButton type="button" variant="plain" size="slim" onClick={()=>resetSection('size')}>Reset</VsnButton>:null}</div><div className="grid grid-cols-2 gap-2"><CssLengthControl label="Width" value={styles.size?.width ?? ""} defaultUnit="%" keywords={["auto","fit-content","min-content","max-content"]} onChange={(width)=>styleSection("size",{width})}/><CssLengthControl label="Height" value={styles.size?.height ?? ""} defaultUnit="px" keywords={["auto","fit-content","min-content","max-content"]} onChange={(height)=>styleSection("size",{height})}/><CssLengthControl label="Min width" value={styles.size?.minWidth ?? ""} defaultUnit="px" onChange={(minWidth)=>styleSection("size",{minWidth})}/><CssLengthControl label="Max width" value={styles.size?.maxWidth ?? ""} defaultUnit="px" keywords={["none"]} onChange={(maxWidth)=>styleSection("size",{maxWidth})}/></div></div> : null}
    {caps.spacing ? <div className="rounded-lg border border-[#eee] p-2"><div className="mb-2 flex items-center justify-between"><strong className="text-[10px] uppercase tracking-wide text-[#6d7175]">Spacing</strong>{styles.spacing?<VsnButton type="button" variant="plain" size="slim" onClick={()=>resetSection('spacing')}>Reset</VsnButton>:null}</div><LinkedDimensionsControl label="Margin" values={{top:styles.spacing?.marginTop||"",right:styles.spacing?.marginRight||"",bottom:styles.spacing?.marginBottom||"",left:styles.spacing?.marginLeft||""}} onChange={(v)=>styleSection("spacing",{marginTop:v.top,marginRight:v.right,marginBottom:v.bottom,marginLeft:v.left})}/><LinkedDimensionsControl label="Padding" values={{top:styles.spacing?.paddingTop||"",right:styles.spacing?.paddingRight||"",bottom:styles.spacing?.paddingBottom||"",left:styles.spacing?.paddingLeft||""}} onChange={(v)=>styleSection("spacing",{paddingTop:v.top,paddingRight:v.right,paddingBottom:v.bottom,paddingLeft:v.left})}/></div> : null}
    {caps.layout ? <div className="grid grid-cols-2 gap-2"><SelectControl label="Display" value={styles.layout?.display ?? ""} onChange={(display)=>styleSection("layout",{display})} options={[{value:"",label:"Inherit"},"block","flex","grid","inline-flex","inline-grid","none"]}/><SelectControl label="Overflow" value={styles.layout?.overflow ?? ""} onChange={(overflow)=>styleSection("layout",{overflow})} options={[{value:"",label:"Inherit"},"visible","hidden","clip","auto","scroll"]}/></div> : null}
    {element.type === "collection-product-grid" ? <NumberControl label="Grid columns" value={props.columns ?? ""} unit="" min={1} max={8} onChange={(columns)=>update({props:{...props,columns}})}/> : null}
    <div className="rounded-lg border border-[#e3e3e3] p-2 space-y-2"><strong className="text-[10px] uppercase tracking-wide text-[#6d7175]">Container Queries</strong><SwitcherControl label="Use this element as a query container" checked={container.enabled===true} onChange={(enabled)=>onUpdate?.(element.id,{responsiveContainer:{...container,enabled,name:container.name||`vsn-${element.id}`,type:container.type||'inline-size'}})}/>{container.enabled?<><TextControl label="Container name" value={container.name||`vsn-${element.id}`} onChange={(name)=>onUpdate?.(element.id,{responsiveContainer:{...container,enabled:true,name}})}/><SelectControl label="Container type" value={container.type||'inline-size'} onChange={(type)=>onUpdate?.(element.id,{responsiveContainer:{...container,enabled:true,type}})} options={[{value:'inline-size',label:'Inline Size'},{value:'size',label:'Size'}]}/></>:null}<SwitcherControl label="Style by parent container" checked={query.enabled===true} onChange={(enabled)=>onUpdate?.(element.id,{containerQuery:{...query,enabled,name:query.name||'vsn-container',styles:query.styles||{},props:query.props||{}}})}/>{query.enabled?<><TextControl label="Parent container name" value={query.name||'vsn-container'} onChange={(name)=>onUpdate?.(element.id,{containerQuery:{...query,enabled:true,name}})}/><div className="grid grid-cols-2 gap-2"><NumberControl label="Min width" value={query.minWidth??0} min={0} unit="px" onChange={(minWidth)=>onUpdate?.(element.id,{containerQuery:{...query,enabled:true,minWidth}})}/><NumberControl label="Max width" value={query.maxWidth??''} min={0} unit="px" onChange={(maxWidth)=>onUpdate?.(element.id,{containerQuery:{...query,enabled:true,maxWidth:maxWidth===''?null:maxWidth}})}/></div><CssLengthControl label="Width in query" value={query.styles?.size?.width||''} defaultUnit="%" onChange={(width)=>onUpdate?.(element.id,{containerQuery:{...query,enabled:true,styles:{...(query.styles||{}),size:{...(query.styles?.size||{}),width}}}})}/></>:null}</div>
  </Panel>;
}

export function AdvancedLayoutPanel({ element, onUpdate, capabilities }) {
  const styles = element?.styles || {};
  const caps = capabilities || getWidgetCapabilities(element?.type);
  const section = (name) => styles[name] || {};
  const patchSection = (name, next) => onUpdate?.(element.id, { styles: { ...styles, [name]: { ...section(name), ...next } } });
  const patchStyles = (next) => onUpdate?.(element.id, { styles: { ...styles, ...next } });
  const size = section("size");
  const spacing = section("spacing");
  const layout = section("layout");
  const background = section("background");
  const border = section("border");
  const effects = section("effects");
  const transform = section("transform");
  const interaction = section("interaction");
  const scroll = section("scroll");

  return <>
    {(caps.layout || caps.sizing) ? <Panel title="Layout & Sizing" defaultOpen={true} badge={String(caps.family || "widget").toUpperCase()}>
      {caps.sizing ? <>
        <div className="grid grid-cols-2 gap-2">
          <CssKeywordLengthControl label="Width" value={size.width ?? ""} defaultUnit="%" onChange={(width)=>patchSection("size",{width})}/>
          <CssKeywordLengthControl label="Height" value={size.height ?? ""} defaultUnit="px" onChange={(height)=>patchSection("size",{height})}/>
          <CssKeywordLengthControl label="Min width" value={size.minWidth ?? ""} defaultUnit="px" keywords={["auto","fit-content","min-content","max-content"]} onChange={(minWidth)=>patchSection("size",{minWidth})}/>
          <CssKeywordLengthControl label="Min height" value={size.minHeight ?? ""} defaultUnit="px" keywords={["auto","fit-content","min-content","max-content"]} onChange={(minHeight)=>patchSection("size",{minHeight})}/>
          <CssKeywordLengthControl label="Max width" value={size.maxWidth ?? ""} defaultUnit="px" keywords={["none","fit-content","min-content","max-content"]} onChange={(maxWidth)=>patchSection("size",{maxWidth})}/>
          <CssKeywordLengthControl label="Max height" value={size.maxHeight ?? ""} defaultUnit="px" keywords={["none","fit-content","min-content","max-content"]} onChange={(maxHeight)=>patchSection("size",{maxHeight})}/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AspectRatioControl value={layout.aspectRatio || ""} onChange={(aspectRatio)=>patchSection("layout",{aspectRatio})}/>
          <SelectControl label="Box sizing" value={size.boxSizing || "border-box"} onChange={(boxSizing)=>patchSection("size",{boxSizing})} options={["content-box","border-box"]}/>
        </div>
      </> : null}
      {caps.layout ? <>
        <div className="grid grid-cols-2 gap-2">
          <SelectControl label="Display" value={layout.display || ""} onChange={(display)=>patchSection("layout",{display})} options={[{value:"",label:"Widget default"},"block","inline","inline-block","flex","inline-flex","grid","inline-grid","contents","none"]}/>
          <SelectControl label="Visibility" value={layout.visibility || "visible"} onChange={(visibility)=>patchSection("layout",{visibility})} options={["visible","hidden","collapse"]}/>
        </div>
        <div className="vsn-control-subsection">
          <div className="vsn-control-subtitle">Position</div>
          <PositionControl value={layout} onChange={(next)=>patchSection("layout",next)}/>
        </div>
        <div className="vsn-control-subsection">
          <div className="vsn-control-subtitle">Overflow</div>
          <OverflowControl value={layout} onChange={(next)=>patchSection("layout",next)}/>
        </div>
      </> : null}
    </Panel> : null}

    {caps.spacing ? <Panel title="Spacing" defaultOpen={false}>
      <LinkedDimensionsControl label="Margin" values={{top:spacing.marginTop||"",right:spacing.marginRight||"",bottom:spacing.marginBottom||"",left:spacing.marginLeft||""}} onChange={(v)=>patchSection("spacing",{marginTop:v.top,marginRight:v.right,marginBottom:v.bottom,marginLeft:v.left})}/>
      <LinkedDimensionsControl label="Padding" values={{top:spacing.paddingTop||"",right:spacing.paddingRight||"",bottom:spacing.paddingBottom||"",left:spacing.paddingLeft||""}} onChange={(v)=>patchSection("spacing",{paddingTop:v.top,paddingRight:v.right,paddingBottom:v.bottom,paddingLeft:v.left})}/>
      {(caps.flexContainer || caps.gridContainer) ? <div className="grid grid-cols-2 gap-2">
        <CssLengthControl label="Gap" value={layout.gap ?? ""} defaultUnit="px" onChange={(gap)=>patchSection("layout",{gap})}/>
        <CssLengthControl label="Row gap" value={layout.rowGap ?? ""} defaultUnit="px" onChange={(rowGap)=>patchSection("layout",{rowGap})}/>
        <CssLengthControl label="Column gap" value={layout.columnGap ?? ""} defaultUnit="px" onChange={(columnGap)=>patchSection("layout",{columnGap})}/>
      </div> : null}
    </Panel> : null}

    {(caps.flexItem || caps.flexContainer || caps.gridContainer) ? <Panel title="Flex & Grid" defaultOpen={false}>
      {(caps.flexItem || caps.flexContainer) ? <FlexControl value={layout} showItem={caps.flexItem} showContainer={caps.flexContainer} onChange={(next)=>patchSection("layout",next)}/> : null}
      {caps.gridContainer ? <>
        {(caps.flexItem || caps.flexContainer) ? <div className="vsn-control-divider" /> : null}
        <GridLayoutControl value={layout} onChange={(next)=>patchSection("layout",next)}/>
      </> : null}
    </Panel> : null}

    {caps.layout ? <Panel title="Flow & Performance" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2">
        <SelectControl label="Direction" value={layout.direction || ""} onChange={(direction)=>patchSection("layout",{direction})} options={[{value:"",label:"Inherit"},"ltr","rtl"]}/>
        <SelectControl label="Writing mode" value={layout.writingMode || ""} onChange={(writingMode)=>patchSection("layout",{writingMode})} options={[{value:"",label:"Inherit"},"horizontal-tb","vertical-rl","vertical-lr"]}/>
        <SelectControl label="Content visibility" value={layout.contentVisibility || ""} onChange={(contentVisibility)=>patchSection("layout",{contentVisibility})} options={[{value:"",label:"Default"},"visible","auto","hidden"]}/>
        <SelectControl label="Contain" value={layout.contain || ""} onChange={(contain)=>patchSection("layout",{contain})} options={[{value:"",label:"Default"},"none","strict","content","size","inline-size","layout","style","paint"]}/>
      </div>
      <CssKeywordLengthControl label="Contain intrinsic size" value={layout.containIntrinsicSize || ""} defaultUnit="px" keywords={["none","auto"]} onChange={(containIntrinsicSize)=>patchSection("layout",{containIntrinsicSize})}/>
      <TextControl label="Will change" value={layout.willChange || ""} placeholder="auto / transform, opacity" onChange={(willChange)=>patchSection("layout",{willChange})}/>
      <TextControl label="Clip path" value={layout.clipPath || ""} placeholder="inset(0) / circle(50%) / polygon(...)" onChange={(clipPath)=>patchSection("layout",{clipPath})}/>
      <div className="vsn-control-subsection">
        <div className="vsn-control-subtitle">Fragmentation</div>
        <div className="grid grid-cols-3 gap-2">
          <SelectControl label="Break before" value={layout.breakBefore || "auto"} onChange={(breakBefore)=>patchSection("layout",{breakBefore})} options={["auto","avoid","page","column","left","right"]}/>
          <SelectControl label="Break inside" value={layout.breakInside || "auto"} onChange={(breakInside)=>patchSection("layout",{breakInside})} options={["auto","avoid","avoid-page","avoid-column"]}/>
          <SelectControl label="Break after" value={layout.breakAfter || "auto"} onChange={(breakAfter)=>patchSection("layout",{breakAfter})} options={["auto","avoid","page","column","left","right"]}/>
        </div>
      </div>
      <div className="vsn-control-subsection">
        <div className="vsn-control-subtitle">Multi-column</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberControl label="Column count" value={layout.columnCount ?? ""} min={1} max={12} onChange={(columnCount)=>patchSection("layout",{columnCount:columnCount === "" ? "" : Number(columnCount)})}/>
          <CssKeywordLengthControl label="Column width" value={layout.columnWidth || ""} defaultUnit="px" keywords={["auto"]} onChange={(columnWidth)=>patchSection("layout",{columnWidth})}/>
          <SelectControl label="Column fill" value={layout.columnFill || "balance"} onChange={(columnFill)=>patchSection("layout",{columnFill})} options={["auto","balance","balance-all"]}/>
          <CssKeywordLengthControl label="Rule width" value={layout.columnRuleWidth || ""} defaultUnit="px" keywords={["thin","medium","thick"]} onChange={(columnRuleWidth)=>patchSection("layout",{columnRuleWidth})}/>
          <SelectControl label="Rule style" value={layout.columnRuleStyle || "none"} onChange={(columnRuleStyle)=>patchSection("layout",{columnRuleStyle})} options={["none","solid","dashed","dotted","double","groove","ridge","inset","outset"]}/>
          <ColorGradientControl solidOnly label="Rule color" value={{type:"color",color:layout.columnRuleColor || "#d1d5db"}} onChange={(next)=>patchSection("layout",{columnRuleColor:next.color})}/>
        </div>
      </div>
    </Panel> : null}

    {(caps.background || caps.border) ? <Panel title="Background & Border" defaultOpen={false}>
      {caps.background ? <>
        <BackgroundControl value={background} onChange={(next)=>patchStyles({background:next})}/>
        <BlendModeControl label="Background blend mode" value={background.blendMode || "normal"} onChange={(blendMode)=>patchSection("background",{blendMode})}/>
      </> : null}
      {caps.border ? <BorderControl value={border} onChange={(next)=>patchStyles({border:next})}/> : null}
    </Panel> : null}

    {caps.effects ? <Panel title="Effects" defaultOpen={false}>
      <SliderControl label="Opacity" value={Number.isFinite(parseFloat(String(effects.opacity ?? "100").replace("%",""))) ? parseFloat(String(effects.opacity ?? "100").replace("%","")) : 100} min={0} max={100} suffix="%" onChange={(opacity)=>patchSection("effects",{opacity:`${opacity}%`})}/>
      <BoxShadowControl value={effects.boxShadow || {}} onChange={(boxShadow)=>patchSection("effects",{boxShadow})}/>
      <FilterEffectsControl value={effects.filters || {}} onChange={(filters)=>patchSection("effects",{filters})}/>
      <div className="vsn-control-subsection">
        <div className="vsn-control-subtitle">Backdrop filter</div>
        <BackdropFilterControl value={effects.backdropFilters || {}} onChange={(backdropFilters)=>patchSection("effects",{backdropFilters})}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BlendModeControl label="Blend mode" value={effects.mixBlendMode || "normal"} onChange={(mixBlendMode)=>patchSection("effects",{mixBlendMode})}/>
        <SelectControl label="Isolation" value={effects.isolation || "auto"} onChange={(isolation)=>patchSection("effects",{isolation})} options={["auto","isolate"]}/>
      </div>
    </Panel> : null}

    {caps.transform ? <Panel title="Transform" defaultOpen={false}>
      <TransformControl value={transform} onChange={(next)=>patchStyles({transform:next})}/>
    </Panel> : null}

    {caps.transition ? <Panel title="Transition" defaultOpen={false}>
      <TransitionControl value={styles.transition} onChange={(transition)=>patchStyles({transition})}/>
    </Panel> : null}

    {caps.interaction ? <Panel title="Interaction" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2">
        <CursorControl value={interaction.cursor || ""} onChange={(cursor)=>patchSection("interaction",{cursor})}/>
        <SelectControl label="Pointer events" value={interaction.pointerEvents || "auto"} onChange={(pointerEvents)=>patchSection("interaction",{pointerEvents})} options={["auto","none"]}/>
        <SelectControl label="User select" value={interaction.userSelect || "auto"} onChange={(userSelect)=>patchSection("interaction",{userSelect})} options={["auto","text","none","all"]}/>
        <SelectControl label="Touch action" value={interaction.touchAction || "auto"} onChange={(touchAction)=>patchSection("interaction",{touchAction})} options={["auto","none","pan-x","pan-y","manipulation","pinch-zoom"]}/>
        <SelectControl label="Appearance" value={interaction.appearance || "auto"} onChange={(appearance)=>patchSection("interaction",{appearance})} options={["auto","none","menulist-button","textfield"]}/>
        <SelectControl label="Resize" value={interaction.resize || "none"} onChange={(resize)=>patchSection("interaction",{resize})} options={["none","both","horizontal","vertical","block","inline"]}/>
        <ColorGradientControl solidOnly label="Accent color" value={{type:"color",color:interaction.accentColor || "#95BF47"}} onChange={(next)=>patchSection("interaction",{accentColor:next.color})}/>
        <ColorGradientControl solidOnly label="Caret color" value={{type:"color",color:interaction.caretColor || "#111111"}} onChange={(next)=>patchSection("interaction",{caretColor:next.color})}/>
      </div>
    </Panel> : null}

    {caps.scroll ? <Panel title="Scroll" defaultOpen={false}>
      <LinkedDimensionsControl label="Scroll margin" values={{top:scroll.scrollMarginTop||"",right:scroll.scrollMarginRight||"",bottom:scroll.scrollMarginBottom||"",left:scroll.scrollMarginLeft||""}} onChange={(v)=>patchSection("scroll",{scrollMarginTop:v.top,scrollMarginRight:v.right,scrollMarginBottom:v.bottom,scrollMarginLeft:v.left})}/>
      <LinkedDimensionsControl label="Scroll padding" values={{top:scroll.scrollPaddingTop||"",right:scroll.scrollPaddingRight||"",bottom:scroll.scrollPaddingBottom||"",left:scroll.scrollPaddingLeft||""}} onChange={(v)=>patchSection("scroll",{scrollPaddingTop:v.top,scrollPaddingRight:v.right,scrollPaddingBottom:v.bottom,scrollPaddingLeft:v.left})}/>
      <div className="grid grid-cols-2 gap-2">
        <SelectControl label="Scroll behavior" value={scroll.scrollBehavior || "auto"} onChange={(scrollBehavior)=>patchSection("scroll",{scrollBehavior})} options={["auto","smooth"]}/>
        <SelectControl label="Snap align" value={scroll.scrollSnapAlign || "none"} onChange={(scrollSnapAlign)=>patchSection("scroll",{scrollSnapAlign})} options={["none","start","center","end","start end","center center"]}/>
        <SelectControl label="Overscroll" value={scroll.overscrollBehavior || "auto"} onChange={(overscrollBehavior)=>patchSection("scroll",{overscrollBehavior})} options={["auto","contain","none"]}/>
        <SelectControl label="Overscroll X" value={scroll.overscrollBehaviorX || "auto"} onChange={(overscrollBehaviorX)=>patchSection("scroll",{overscrollBehaviorX})} options={["auto","contain","none"]}/>
        <SelectControl label="Overscroll Y" value={scroll.overscrollBehaviorY || "auto"} onChange={(overscrollBehaviorY)=>patchSection("scroll",{overscrollBehaviorY})} options={["auto","contain","none"]}/>
        <SelectControl label="Snap type" value={scroll.scrollSnapType || "none"} onChange={(scrollSnapType)=>patchSection("scroll",{scrollSnapType})} options={["none","x mandatory","y mandatory","both mandatory","x proximity","y proximity","both proximity"]}/>
        <SelectControl label="Snap stop" value={scroll.scrollSnapStop || "normal"} onChange={(scrollSnapStop)=>patchSection("scroll",{scrollSnapStop})} options={["normal","always"]}/>
        <SelectControl label="Scrollbar gutter" value={scroll.scrollbarGutter || "auto"} onChange={(scrollbarGutter)=>patchSection("scroll",{scrollbarGutter})} options={["auto","stable","stable both-edges"]}/>
      </div>
    </Panel> : null}
  </>;
}

export function StateStylesPanel({ element, onUpdate, capabilities }) {
  const caps = capabilities || getWidgetCapabilities(element?.type);
  const [state,setState]=useState("hover"); const styles=element?.styles||{}; const states=styles.states||{}; const current=states[state]||{};
  const patch=(section,next)=>onUpdate?.(element.id,{styles:{...styles,states:{...states,[state]:{...current,[section]:{...(current[section]||{}),...next}}}}});
  const clear=()=>onUpdate?.(element.id,{styles:{...styles,states:{...states,[state]:{}}}});
  return <Panel title="State Styling" badge={Object.values(states).some(v=>v&&Object.keys(v).length)?"ACTIVE":""} defaultOpen={false}>
    <ButtonSetControl label="State" value={state} onChange={setState} options={[{value:"hover",label:"Hover"},{value:"active",label:"Active"},{value:"focus",label:"Focus"},{value:"disabled",label:"Disabled"}]}/>
    <div className="flex justify-end"><VsnButton type="button" variant="tertiary" size="sm" tone="critical" onClick={clear}>Clear {state}</VsnButton></div>
    {caps.background ? <ColorGradientControl toggleable label="Background" value={current.background||{}} onChange={(background)=>onUpdate?.(element.id,{styles:{...styles,states:{...states,[state]:{...current,background}}}})}/> : null}
    {(caps.typography || caps.effects) ? <div className="grid grid-cols-2 gap-2">{caps.typography ? <ColorGradientControl solidOnly label="Text color" value={{type:"color",color:current.typography?.color||"#000000"}} onChange={(next)=>patch("typography",{color:next.color})}/> : null}{caps.effects ? <SliderControl label="Opacity" value={Number.isFinite(parseFloat(String(current.effects?.opacity ?? "100").replace("%", ""))) ? parseFloat(String(current.effects?.opacity ?? "100").replace("%", "")) : 100} min={0} max={100} suffix="%" onChange={(opacity)=>patch("effects",{opacity:`${opacity}%`})}/> : null}</div> : null}
    {caps.border ? <BorderControl value={current.border||{}} onChange={(border)=>onUpdate?.(element.id,{styles:{...styles,states:{...states,[state]:{...current,border}}}})}/> : null}
    {caps.effects ? <BoxShadowControl value={current.effects?.boxShadow||{}} onChange={(boxShadow)=>patch("effects",{boxShadow})}/> : null}
    {caps.transform ? <TransformControl value={{...(current.transform||{}),translateY:current.transform?.translateY ?? current.transform?.y ?? "",scaleX:current.transform?.scaleX ?? current.transform?.scale ?? "",scaleY:current.transform?.scaleY ?? current.transform?.scale ?? ""}} onChange={(transform)=>onUpdate?.(element.id,{styles:{...styles,states:{...states,[state]:{...current,transform}}}})}/> : null}
    {caps.transition ? <TransitionControl value={current.transition || {property:"all",duration:"200ms",timingFunction:"ease",delay:"0ms"}} onChange={(transition)=>onUpdate?.(element.id,{styles:{...styles,states:{...states,[state]:{...current,transition}}}})}/> : null}
  </Panel>;
}

export function BreakpointControls({ globalStyles, onChange }) {
  const rows = normalizeResponsiveBreakpoints(globalStyles);
  const updateRows=(next)=>{
    const mobile=next.find((bp)=>bp.id==='mobile'); const tablet=next.find((bp)=>bp.id==='tablet');
    onChange?.({responsiveBreakpoints:next,mobileBreakpoint:mobile?.maxWidth??globalStyles.mobileBreakpoint??749,tabletBreakpoint:tablet?.maxWidth??globalStyles.tabletBreakpoint??989});
  };
  const patch=(id,patch)=>updateRows(rows.map((bp)=>bp.id===id?{...bp,...patch}:bp));
  const add=()=>updateRows(createCustomBreakpoint(globalStyles,{label:`Custom ${rows.filter((bp)=>!bp.locked).length+1}`,minWidth:990,maxWidth:1199,previewWidth:1100,orientation:'landscape'}));
  return <Panel title="Responsive Breakpoints 2.0" defaultOpen={false} badge={`${rows.length} RANGES`}>
    <AlertControl tone="info">Named ranges are saved globally. Existing desktop/tablet/mobile overrides remain backward compatible. Custom ranges can overlap intentionally, but QA will flag overlaps.</AlertControl>
    <div className="space-y-2">{rows.map((bp)=><div key={bp.id} className="rounded-lg border border-[#e3e3e3] p-2"><div className="mb-2 flex items-center justify-between"><strong className="text-[10px]">{bp.label}</strong>{!bp.locked?<VsnButton type="button" variant="plain" size="slim" tone="critical" onClick={()=>updateRows(rows.filter((row)=>row.id!==bp.id))}>Remove</VsnButton>:<span className="text-[9px] text-[#8c9196]">Core</span>}</div><TextControl label="Name" value={bp.label} onChange={(label)=>patch(bp.id,{label})}/><div className="grid grid-cols-2 gap-2"><NumberControl label="Min" value={bp.minWidth??0} min={0} unit="px" onChange={(minWidth)=>patch(bp.id,{minWidth:Number(minWidth)||0})}/><NumberControl label="Max" value={bp.maxWidth??''} min={0} unit="px" onChange={(maxWidth)=>patch(bp.id,{maxWidth:maxWidth===''?null:Number(maxWidth)})}/></div><div className="grid grid-cols-2 gap-2"><NumberControl label="Preview width" value={bp.previewWidth||390} min={240} max={2560} unit="px" onChange={(previewWidth)=>patch(bp.id,{previewWidth:Number(previewWidth)||390})}/><SelectControl label="Preset" value={bp.orientation||'portrait'} onChange={(orientation)=>patch(bp.id,{orientation})} options={[{value:'portrait',label:'Portrait'},{value:'landscape',label:'Landscape'}]}/></div></div>)}</div>
    <VsnButton type="button" variant="tertiary" className="w-full" onClick={add}><PolarisIcon type="plus" size="small"/>Add named breakpoint</VsnButton>
  </Panel>;
}

