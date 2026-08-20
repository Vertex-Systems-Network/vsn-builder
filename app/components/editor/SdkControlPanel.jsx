import { getVsnWidgetControls, getVsnWidgetDefinition } from "../../sdk/registry.js";
import { VsnCheckbox, VsnNumberField, VsnOption, VsnSelect, VsnTextArea, VsnTextField, VsnUrlField, VsnColorField } from "./EditorUi.jsx";
import {
  BorderRadiusControl,
  ButtonSetControl,
  ColorGradientControl,
  CssLengthControl,
  DateControl,
  DateTimeControl,
  DimensionsControl,
  IconControl,
  MediaControl,
  MultiSelectControl,
  RadioControl,
  TimeControl,
  TypographyControl,
} from "./EditorControls.jsx";

export default function SdkControlPanel({ element, onUpdate }) {
  const definition = getVsnWidgetDefinition(element?.type);
  const controls = getVsnWidgetControls(element?.type);
  if (!definition || !controls.length) return null;
  const props = element?.props || {};
  const set = (key, value) => onUpdate?.(element.id, { props: { ...props, [key]: value } });

  const render = (control) => {
    const value = props[control.key] ?? control.default ?? "";
    const key = control.key;
    if (control.type === "textarea") return <VsnTextArea key={key} label={control.label} helpText={control.help} value={String(value)} onInput={(event)=>set(key,event.currentTarget.value)}/>;
    if (control.type === "number" || control.type === "range") return <VsnNumberField key={key} label={control.label} helpText={control.help} type={control.type === "range" ? "range" : undefined} min={control.min} max={control.max} step={control.step} value={Number(value || 0)} onInput={(event)=>set(key,Number(event.currentTarget.value))}/>;
    if (control.type === "toggle") return <VsnCheckbox key={key} checked={Boolean(value)} onChange={(event)=>set(key,event.currentTarget.checked)}>{control.label}</VsnCheckbox>;
    if (control.type === "select") return <VsnSelect key={key} label={control.label} helpText={control.help} value={String(value)} onChange={(event)=>set(key,event.currentTarget.value)}>{(control.options||[]).map((option)=><VsnOption key={`${key}-${option.value}`} value={option.value}>{option.label}</VsnOption>)}</VsnSelect>;
    if (control.type === "multi-select") return <MultiSelectControl key={key} label={control.label} value={Array.isArray(value)?value:[]} options={control.options||[]} onChange={(next)=>set(key,next)}/>;
    if (control.type === "radio") return <RadioControl key={key} label={control.label} value={value} options={control.options||[]} onChange={(next)=>set(key,next)}/>;
    if (control.type === "button-set") return <ButtonSetControl key={key} label={control.label} value={value} options={control.options||[]} onChange={(next)=>set(key,next)}/>;
    if (control.type === "url") return <VsnUrlField key={key} label={control.label} helpText={control.help} value={String(value)} onInput={(event)=>set(key,event.currentTarget.value)}/>;
    if (control.type === "color") return <VsnColorField key={key} label={control.label} value={String(value || "#000000")} onInput={(event)=>set(key,event.currentTarget.value)}/>;
    if (control.type === "color-gradient") return <ColorGradientControl key={key} label={control.label} value={value&&typeof value==="object"?value:{type:"color",color:String(value||"#000000")}} onChange={(next)=>set(key,next)}/>;
    if (control.type === "css-length") return <CssLengthControl key={key} label={control.label} value={String(value||"")} defaultUnit={control.unit||"px"} keywords={control.keywords||[]} onChange={(next)=>set(key,next)}/>;
    if (control.type === "date") return <DateControl key={key} label={control.label} value={String(value||"")} onChange={(next)=>set(key,next)}/>;
    if (control.type === "datetime") return <DateTimeControl key={key} label={control.label} value={String(value||"")} onChange={(next)=>set(key,next)}/>;
    if (control.type === "time") return <TimeControl key={key} label={control.label} value={String(value||"")} onChange={(next)=>set(key,next)}/>;
    if (control.type === "dimensions") return <DimensionsControl key={key} label={control.label} values={value&&typeof value==="object"?value:{}} unit={control.unit||"px"} onChange={(next)=>set(key,next)}/>;
    if (control.type === "border-radius") return <BorderRadiusControl key={key} label={control.label} value={value&&typeof value==="object"?value:{}} defaultUnit={control.unit||"px"} onChange={(next)=>set(key,next)}/>;
    if (control.type === "typography") return <div key={key} className="vsn-sdk-complex-control"><div className="vsn-control-subtitle">{control.label}</div><TypographyControl value={value&&typeof value==="object"?value:{}} onChange={(next)=>set(key,next)}/>{control.help?<p className="vsn-control-help">{control.help}</p>:null}</div>;
    if (control.type === "media") return <div key={key} className="vsn-sdk-complex-control"><MediaControl label={control.label} value={value&&typeof value==="object"?value:{}} accept={control.accept||"image/*"} mediaTypes={control.mediaTypes||["MediaImage"]} onChange={(next)=>set(key,next)}/>{control.help?<p className="vsn-control-help">{control.help}</p>:null}</div>;
    if (control.type === "icon") return <div key={key} className="vsn-sdk-complex-control"><IconControl label={control.label} value={value&&typeof value==="object"?value:{}} onChange={(next)=>set(key,next)}/>{control.help?<p className="vsn-control-help">{control.help}</p>:null}</div>;
    return <VsnTextField key={key} label={control.label} helpText={control.help} value={String(value)} onInput={(event)=>set(key,event.currentTarget.value)}/>;
  };

  return <section className="vsn-inspector-section" data-vsn-sdk-controls={definition.pluginId}>
    <div className="vsn-inspector-section-toggle is-static"><span>Plugin Controls</span><span className="vsn-sdk-control-badge">SDK</span></div>
    <div className="vsn-inspector-section-body">
      <div className="vsn-sdk-control-meta"><strong>{definition.label}</strong><span>{definition.pluginId} · v{definition.version}</span></div>
      {controls.map(render)}
    </div>
  </section>;
}
