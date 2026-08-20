import { useState } from "react";
import { VsnButton } from "./EditorUi";
import {
  AspectRatioControl,
  ColorGradientControl,
  CssLengthControl,
  NumberControl,
  SelectControl,
  TextControl,
} from "./EditorControls";
import FilterEffectsControl from "./FilterEffectsControl";
import { getWidgetStyleProfile } from "../../builder/widgetStyleProfiles.js";

function Group({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="vsn-inspector-section">
      <VsnButton type="button" variant="plain" className="vsn-inspector-section-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span><span className={`vsn-inspector-chevron ${open ? "is-open" : ""}`}>›</span>
      </VsnButton>
      {open ? <div className="vsn-inspector-section-body">{children}</div> : null}
    </section>
  );
}

function SolidColor({ label, value, onChange, fallback = "#1a1a1a" }) {
  return <ColorGradientControl solidOnly label={label} value={{ type: "color", color: value || fallback }} onChange={(next) => onChange(next.color || fallback)} />;
}

function LengthPair({ aLabel, aValue, aChange, bLabel, bValue, bChange, aDefault = "px", bDefault = "px" }) {
  return <div className="grid grid-cols-2 gap-2"><CssLengthControl label={aLabel} value={aValue || ""} defaultUnit={aDefault} onChange={aChange}/><CssLengthControl label={bLabel} value={bValue || ""} defaultUnit={bDefault} onChange={bChange}/></div>;
}

export default function WidgetSpecificStyleControls({ type, value = {}, onChange }) {
  const profile = getWidgetStyleProfile(type);
  const has = (feature) => profile.features.includes(feature);
  if (!profile.features.length) return null;

  const patch = (group, next) => onChange?.({ ...value, [group]: { ...(value[group] || {}), ...next } });

  return <div className="vsn-widget-specific-styles">
    {has("structureItems") ? <Group title="Direct child items">
      <p className="vsn-control-help">Optional styles for immediate child elements. Leave fields empty to keep each child widget's own styling.</p>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Child min width" value={value.structureItems?.minWidth || ""} defaultUnit="px" keywords={["auto","min-content","max-content","fit-content"]} onChange={(v)=>patch("structureItems",{minWidth:v})}/><CssLengthControl label="Child min height" value={value.structureItems?.minHeight || ""} defaultUnit="px" keywords={["auto","min-content","max-content","fit-content"]} onChange={(v)=>patch("structureItems",{minHeight:v})}/></div>
      <ColorGradientControl toggleable label="Child background" value={value.structureItems?.background || {type:"color",color:"transparent"}} onChange={(v)=>patch("structureItems",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Child padding" value={value.structureItems?.padding || ""} defaultUnit="px" onChange={(v)=>patch("structureItems",{padding:v})}/><CssLengthControl label="Child radius" value={value.structureItems?.radius || ""} defaultUnit="px" onChange={(v)=>patch("structureItems",{radius:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Child border" value={value.structureItems?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("structureItems",{borderWidth:v})}/><SolidColor label="Border color" value={value.structureItems?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("structureItems",{borderColor:v})}/></div>
      <SelectControl label="Border style" value={value.structureItems?.borderStyle || "solid"} onChange={(v)=>patch("structureItems",{borderStyle:v})} options={["solid","dashed","dotted","double","none"]}/>
      <TextControl label="Child shadow" value={value.structureItems?.shadow || ""} placeholder="0 8px 24px rgba(0,0,0,.08)" onChange={(v)=>patch("structureItems",{shadow:v})}/>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Align self" value={value.structureItems?.alignSelf || ""} onChange={(v)=>patch("structureItems",{alignSelf:v})} options={[{value:"",label:"Default"},"auto","stretch","flex-start","center","flex-end","baseline"]}/><SelectControl label="Overflow" value={value.structureItems?.overflow || ""} onChange={(v)=>patch("structureItems",{overflow:v})} options={[{value:"",label:"Default"},"visible","hidden","clip","auto","scroll"]}/></div>
    </Group> : null}

    {has("textCore") ? <Group title="Text surface">
      <ColorGradientControl toggleable label="Text fill" value={value.textCore?.fill || {type:"color",color:""}} onChange={(v)=>patch("textCore",{fill:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Selection text" value={value.textCore?.selectionColor} fallback="#ffffff" onChange={(v)=>patch("textCore",{selectionColor:v})}/><SolidColor label="Selection background" value={value.textCore?.selectionBackground} fallback="#1a1a1a" onChange={(v)=>patch("textCore",{selectionBackground:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Strong text" value={value.textCore?.strongColor} fallback="" onChange={(v)=>patch("textCore",{strongColor:v})}/><SolidColor label="Emphasis text" value={value.textCore?.emColor} fallback="" onChange={(v)=>patch("textCore",{emColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Text rendering" value={value.textCore?.textRendering || ""} onChange={(v)=>patch("textCore",{textRendering:v})} options={[{value:"",label:"Default"},"auto","optimizeSpeed","optimizeLegibility","geometricPrecision"]}/><SelectControl label="Font smoothing" value={value.textCore?.fontSmoothing || ""} onChange={(v)=>patch("textCore",{fontSmoothing:v})} options={[{value:"",label:"Default"},"antialiased","subpixel-antialiased"]}/></div>
    </Group> : null}

    {has("richText") ? <Group title="Rich text details">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Link" value={value.richText?.linkColor} onChange={(v)=>patch("richText",{linkColor:v})}/><SolidColor label="Link hover" value={value.richText?.linkHoverColor} onChange={(v)=>patch("richText",{linkHoverColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Decoration" value={value.richText?.linkDecoration || "underline"} onChange={(v)=>patch("richText",{linkDecoration:v})} options={["none","underline","overline","line-through"]}/><CssLengthControl label="Underline offset" value={value.richText?.linkUnderlineOffset || ""} defaultUnit="px" onChange={(v)=>patch("richText",{linkUnderlineOffset:v})}/></div>
      <LengthPair aLabel="Paragraph gap" aValue={value.richText?.paragraphSpacing} aChange={(v)=>patch("richText",{paragraphSpacing:v})} bLabel="List indent" bValue={value.richText?.listIndent} bChange={(v)=>patch("richText",{listIndent:v})}/>
      <LengthPair aLabel="Heading top" aValue={value.richText?.headingSpacingTop} aChange={(v)=>patch("richText",{headingSpacingTop:v})} bLabel="Heading bottom" bValue={value.richText?.headingSpacingBottom} bChange={(v)=>patch("richText",{headingSpacingBottom:v})}/>
      <SolidColor label="List marker" value={value.richText?.markerColor} onChange={(v)=>patch("richText",{markerColor:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Quote border" value={value.richText?.blockquoteBorderColor} onChange={(v)=>patch("richText",{blockquoteBorderColor:v})}/><SolidColor label="Quote background" value={value.richText?.blockquoteBackground} fallback="#f6f6f7" onChange={(v)=>patch("richText",{blockquoteBackground:v})}/></div>
      <LengthPair aLabel="Quote border" aValue={value.richText?.blockquoteBorderWidth} aChange={(v)=>patch("richText",{blockquoteBorderWidth:v})} bLabel="Quote padding" bValue={value.richText?.blockquotePadding} bChange={(v)=>patch("richText",{blockquotePadding:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Code background" value={value.richText?.codeBackground} fallback="#f3f4f6" onChange={(v)=>patch("richText",{codeBackground:v})}/><SolidColor label="Code color" value={value.richText?.codeColor} onChange={(v)=>patch("richText",{codeColor:v})}/></div>
      <LengthPair aLabel="Code radius" aValue={value.richText?.codeRadius} aChange={(v)=>patch("richText",{codeRadius:v})} bLabel="Code padding" bValue={value.richText?.codePadding} bChange={(v)=>patch("richText",{codePadding:v})}/>
    </Group> : null}

    {has("media") ? <Group title="Media surface">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Media width" value={value.media?.width || ""} defaultUnit="%" keywords={["auto"]} onChange={(v)=>patch("media",{width:v})}/><CssLengthControl label="Media height" value={value.media?.height || ""} defaultUnit="px" keywords={["auto"]} onChange={(v)=>patch("media",{height:v})}/></div>
      <AspectRatioControl value={value.media?.aspectRatio || ""} onChange={(v)=>patch("media",{aspectRatio:v})}/>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Object fit" value={value.media?.objectFit || ""} onChange={(v)=>patch("media",{objectFit:v})} options={[{value:"",label:"Default"},"cover","contain","fill","none","scale-down"]}/><TextControl label="Object position" value={value.media?.objectPosition || ""} placeholder="center center" onChange={(v)=>patch("media",{objectPosition:v})}/></div>
      <CssLengthControl label="Media radius" value={value.media?.borderRadius || ""} defaultUnit="px" onChange={(v)=>patch("media",{borderRadius:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.media?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("media",{borderWidth:v})}/><SolidColor label="Border color" value={value.media?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("media",{borderColor:v})}/></div>
      <SelectControl label="Border style" value={value.media?.borderStyle || "solid"} onChange={(v)=>patch("media",{borderStyle:v})} options={["solid","dashed","dotted","double","none"]}/>
      <ColorGradientControl toggleable label="Media background" value={value.media?.background || {type:"color",color:"transparent"}} onChange={(v)=>patch("media",{background:v})}/>
      <TextControl label="Media shadow" value={value.media?.shadow || ""} placeholder="0 10px 30px rgba(0,0,0,.12)" onChange={(v)=>patch("media",{shadow:v})}/>
      <SelectControl label="Alignment" value={value.media?.alignment || ""} onChange={(v)=>patch("media",{alignment:v})} options={[{value:"",label:"Default"},"left","center","right"]}/>
      <NumberControl label="Opacity" value={value.media?.opacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("media",{opacity:v})}/>
      <FilterEffectsControl value={value.media?.filters || {}} onChange={(v)=>patch("media",{filters:v})}/>
      <div className="vsn-control-subtitle">Hover</div>
      <TextControl label="Hover transform" value={value.media?.hoverTransform || ""} placeholder="scale(1.03)" onChange={(v)=>patch("media",{hoverTransform:v})}/>
      <NumberControl label="Hover opacity" value={value.media?.hoverOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("media",{hoverOpacity:v})}/>
      <TextControl label="Transition" value={value.media?.transition || ""} placeholder="transform .25s ease, filter .25s ease" onChange={(v)=>patch("media",{transition:v})}/>
    </Group> : null}

    {has("galleryThumbs") ? <Group title="Gallery thumbnails">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Thumb size" value={value.galleryThumbs?.size || ""} defaultUnit="px" onChange={(v)=>patch("galleryThumbs",{size:v})}/><CssLengthControl label="Gap" value={value.galleryThumbs?.gap || ""} defaultUnit="px" onChange={(v)=>patch("galleryThumbs",{gap:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Radius" value={value.galleryThumbs?.radius || ""} defaultUnit="px" onChange={(v)=>patch("galleryThumbs",{radius:v})}/><CssLengthControl label="Border" value={value.galleryThumbs?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("galleryThumbs",{borderWidth:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Border color" value={value.galleryThumbs?.borderColor} fallback="#d9d9d9" onChange={(v)=>patch("galleryThumbs",{borderColor:v})}/><SolidColor label="Active border" value={value.galleryThumbs?.activeBorderColor} fallback="#95BF47" onChange={(v)=>patch("galleryThumbs",{activeBorderColor:v})}/></div>
    </Group> : null}

    {has("button") ? <Group title="Button surface">
      <ColorGradientControl toggleable label="Background" value={value.button?.background || {type:"color",color:"#1a1a1a"}} onChange={(v)=>patch("button",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Text" value={value.button?.color} fallback="#ffffff" onChange={(v)=>patch("button",{color:v})}/><SolidColor label="Border" value={value.button?.borderColor} fallback="#1a1a1a" onChange={(v)=>patch("button",{borderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.button?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("button",{borderWidth:v})}/><CssLengthControl label="Radius" value={value.button?.borderRadius || ""} defaultUnit="px" onChange={(v)=>patch("button",{borderRadius:v})}/></div>
      <LengthPair aLabel="Padding X" aValue={value.button?.paddingX} aChange={(v)=>patch("button",{paddingX:v})} bLabel="Padding Y" bValue={value.button?.paddingY} bChange={(v)=>patch("button",{paddingY:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Min height" value={value.button?.minHeight || ""} defaultUnit="px" onChange={(v)=>patch("button",{minHeight:v})}/><CssLengthControl label="Min width" value={value.button?.minWidth || ""} defaultUnit="px" onChange={(v)=>patch("button",{minWidth:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={value.button?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("button",{fontSize:v})}/><SelectControl label="Weight" value={String(value.button?.fontWeight || "")} onChange={(v)=>patch("button",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Letter spacing" value={value.button?.letterSpacing || ""} defaultUnit="px" onChange={(v)=>patch("button",{letterSpacing:v})}/><CssLengthControl label="Line height" value={value.button?.lineHeight || ""} defaultUnit="em" keywords={["normal"]} onChange={(v)=>patch("button",{lineHeight:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Text transform" value={value.button?.textTransform || ""} onChange={(v)=>patch("button",{textTransform:v})} options={[{value:"",label:"Default"},"none","uppercase","lowercase","capitalize"]}/><SelectControl label="Border style" value={value.button?.borderStyle || "solid"} onChange={(v)=>patch("button",{borderStyle:v})} options={["solid","dashed","dotted","double","none"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Icon gap" value={value.button?.iconGap || ""} defaultUnit="px" onChange={(v)=>patch("button",{iconGap:v})}/><CssLengthControl label="Icon size" value={value.button?.iconSize || ""} defaultUnit="px" onChange={(v)=>patch("button",{iconSize:v})}/></div>
      <SelectControl label="Alignment" value={value.button?.alignment || ""} onChange={(v)=>patch("button",{alignment:v})} options={[{value:"",label:"Default"},"flex-start","center","flex-end","space-between"]}/>
      <TextControl label="Shadow" value={value.button?.shadow || ""} placeholder="0 6px 18px rgba(0,0,0,.12)" onChange={(v)=>patch("button",{shadow:v})}/>
      <div className="vsn-control-subtitle">Hover</div>
      <ColorGradientControl toggleable label="Hover background" value={value.button?.hoverBackground || {type:"color",color:"#333333"}} onChange={(v)=>patch("button",{hoverBackground:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Hover text" value={value.button?.hoverColor} fallback="#ffffff" onChange={(v)=>patch("button",{hoverColor:v})}/><SolidColor label="Hover border" value={value.button?.hoverBorderColor} fallback="#333333" onChange={(v)=>patch("button",{hoverBorderColor:v})}/></div>
      <TextControl label="Hover transform" value={value.button?.hoverTransform || ""} placeholder="translateY(-2px)" onChange={(v)=>patch("button",{hoverTransform:v})}/>
      <TextControl label="Hover shadow" value={value.button?.hoverShadow || ""} placeholder="0 10px 24px rgba(0,0,0,.16)" onChange={(v)=>patch("button",{hoverShadow:v})}/>
      <div className="vsn-control-subtitle">Active / pressed</div>
      <ColorGradientControl toggleable label="Active background" value={value.button?.activeBackground || {type:"color",color:"#111111"}} onChange={(v)=>patch("button",{activeBackground:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Active text" value={value.button?.activeColor} fallback="#ffffff" onChange={(v)=>patch("button",{activeColor:v})}/><SolidColor label="Active border" value={value.button?.activeBorderColor} fallback="#111111" onChange={(v)=>patch("button",{activeBorderColor:v})}/></div>
      <TextControl label="Active transform" value={value.button?.activeTransform || ""} placeholder="translateY(1px) scale(.99)" onChange={(v)=>patch("button",{activeTransform:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Focus ring" value={value.button?.focusColor} fallback="#95BF47" onChange={(v)=>patch("button",{focusColor:v})}/><CssLengthControl label="Focus width" value={value.button?.focusWidth || ""} defaultUnit="px" onChange={(v)=>patch("button",{focusWidth:v})}/></div>
      <CssLengthControl label="Focus offset" value={value.button?.focusOffset || ""} defaultUnit="px" onChange={(v)=>patch("button",{focusOffset:v})}/>
      <div className="grid grid-cols-2 gap-2"><NumberControl label="Disabled opacity" value={value.button?.disabledOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("button",{disabledOpacity:v})}/><SelectControl label="Disabled cursor" value={value.button?.disabledCursor || "not-allowed"} onChange={(v)=>patch("button",{disabledCursor:v})} options={["not-allowed","default","wait","progress"]}/></div>
      <div className="grid grid-cols-2 gap-2"><TextControl label="Transition duration" value={value.button?.transitionDuration || ""} placeholder=".2s" onChange={(v)=>patch("button",{transitionDuration:v})}/><SelectControl label="Transition easing" value={value.button?.transitionTiming || ""} onChange={(v)=>patch("button",{transitionTiming:v})} options={[{value:"",label:"Default"},"ease","linear","ease-in","ease-out","ease-in-out"]}/></div>
    </Group> : null}

    {has("navigation") ? <Group title="Navigation items">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Link" value={value.navigation?.linkColor} onChange={(v)=>patch("navigation",{linkColor:v})}/><SolidColor label="Hover" value={value.navigation?.hoverColor} onChange={(v)=>patch("navigation",{hoverColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Active" value={value.navigation?.activeColor} fallback="#95BF47" onChange={(v)=>patch("navigation",{activeColor:v})}/><SolidColor label="Active background" value={value.navigation?.activeBackground} fallback="#f0f7e7" onChange={(v)=>patch("navigation",{activeBackground:v})}/></div>
      <LengthPair aLabel="Item padding X" aValue={value.navigation?.paddingX} aChange={(v)=>patch("navigation",{paddingX:v})} bLabel="Item padding Y" bValue={value.navigation?.paddingY} bChange={(v)=>patch("navigation",{paddingY:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Item radius" value={value.navigation?.radius || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{radius:v})}/><CssLengthControl label="Item gap" value={value.navigation?.gap || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{gap:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={value.navigation?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{fontSize:v})}/><SelectControl label="Weight" value={String(value.navigation?.fontWeight || "")} onChange={(v)=>patch("navigation",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/></div>
      <div className="vsn-control-subtitle">Dropdown / submenu</div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Background" value={value.navigation?.submenuBackground} fallback="#ffffff" onChange={(v)=>patch("navigation",{submenuBackground:v})}/><SolidColor label="Border" value={value.navigation?.submenuBorderColor} fallback="#e5e7eb" onChange={(v)=>patch("navigation",{submenuBorderColor:v})}/></div>
      <LengthPair aLabel="Submenu radius" aValue={value.navigation?.submenuRadius} aChange={(v)=>patch("navigation",{submenuRadius:v})} bLabel="Submenu padding" bValue={value.navigation?.submenuPadding} bChange={(v)=>patch("navigation",{submenuPadding:v})}/>
      <TextControl label="Submenu shadow" value={value.navigation?.submenuShadow || ""} placeholder="0 16px 40px rgba(0,0,0,.12)" onChange={(v)=>patch("navigation",{submenuShadow:v})}/>
    </Group> : null}

    {has("form") ? <Group title="Form controls">
      <CssLengthControl label="Field gap" value={value.form?.fieldGap || ""} defaultUnit="px" onChange={(v)=>patch("form",{fieldGap:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Label" value={value.form?.labelColor} onChange={(v)=>patch("form",{labelColor:v})}/><SelectControl label="Label weight" value={String(value.form?.labelWeight || "")} onChange={(v)=>patch("form",{labelWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/></div>
      <CssLengthControl label="Label size" value={value.form?.labelSize || ""} defaultUnit="px" onChange={(v)=>patch("form",{labelSize:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Input background" value={value.form?.controlBackground} fallback="#ffffff" onChange={(v)=>patch("form",{controlBackground:v})}/><SolidColor label="Input text" value={value.form?.controlColor} onChange={(v)=>patch("form",{controlColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Input border" value={value.form?.controlBorderColor} fallback="#d9d9d9" onChange={(v)=>patch("form",{controlBorderColor:v})}/><SolidColor label="Placeholder" value={value.form?.placeholderColor} fallback="#8c9196" onChange={(v)=>patch("form",{placeholderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Input height" value={value.form?.controlHeight || ""} defaultUnit="px" onChange={(v)=>patch("form",{controlHeight:v})}/><CssLengthControl label="Input radius" value={value.form?.controlRadius || ""} defaultUnit="px" onChange={(v)=>patch("form",{controlRadius:v})}/></div>
      <LengthPair aLabel="Input padding X" aValue={value.form?.controlPaddingX} aChange={(v)=>patch("form",{controlPaddingX:v})} bLabel="Input padding Y" bValue={value.form?.controlPaddingY} bChange={(v)=>patch("form",{controlPaddingY:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Focus border" value={value.form?.focusBorderColor} fallback="#95BF47" onChange={(v)=>patch("form",{focusBorderColor:v})}/><SolidColor label="Error" value={value.form?.errorColor} fallback="#d72c0d" onChange={(v)=>patch("form",{errorColor:v})}/></div>
      <TextControl label="Focus shadow" value={value.form?.focusShadow || ""} placeholder="0 0 0 3px rgba(149,191,71,.2)" onChange={(v)=>patch("form",{focusShadow:v})}/>
      <SolidColor label="Success message" value={value.form?.successColor} fallback="#008060" onChange={(v)=>patch("form",{successColor:v})}/>
    </Group> : null}

    {has("navigation") ? <Group title="Navigation interaction" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Item background" value={value.navigation?.linkBackground} fallback="transparent" onChange={(v)=>patch("navigation",{linkBackground:v})}/><SolidColor label="Hover background" value={value.navigation?.hoverBackground} fallback="transparent" onChange={(v)=>patch("navigation",{hoverBackground:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Visited text" value={value.navigation?.visitedColor} fallback="" onChange={(v)=>patch("navigation",{visitedColor:v})}/><SolidColor label="Hover border" value={value.navigation?.hoverBorderColor} fallback="transparent" onChange={(v)=>patch("navigation",{hoverBorderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Item border" value={value.navigation?.borderColor} fallback="transparent" onChange={(v)=>patch("navigation",{borderColor:v})}/><SolidColor label="Active border" value={value.navigation?.activeBorderColor} fallback="#95BF47" onChange={(v)=>patch("navigation",{activeBorderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.navigation?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{borderWidth:v})}/><SelectControl label="Border style" value={value.navigation?.borderStyle || "solid"} onChange={(v)=>patch("navigation",{borderStyle:v})} options={["solid","dashed","dotted","double","none"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Line height" value={value.navigation?.lineHeight || ""} defaultUnit="em" onChange={(v)=>patch("navigation",{lineHeight:v})}/><CssLengthControl label="Letter spacing" value={value.navigation?.letterSpacing || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{letterSpacing:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Text transform" value={value.navigation?.textTransform || ""} onChange={(v)=>patch("navigation",{textTransform:v})} options={[{value:"",label:"Default"},"none","uppercase","lowercase","capitalize"]}/><SelectControl label="Active weight" value={String(value.navigation?.activeWeight || "")} onChange={(v)=>patch("navigation",{activeWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Icon size" value={value.navigation?.iconSize || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{iconSize:v})}/><CssLengthControl label="Icon gap" value={value.navigation?.iconGap || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{iconGap:v})}/></div>
      <div className="grid grid-cols-3 gap-2"><SolidColor label="Focus ring" value={value.navigation?.focusColor} fallback="#95BF47" onChange={(v)=>patch("navigation",{focusColor:v})}/><CssLengthControl label="Ring width" value={value.navigation?.focusWidth || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{focusWidth:v})}/><CssLengthControl label="Ring offset" value={value.navigation?.focusOffset || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{focusOffset:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><TextControl label="Transition duration" value={value.navigation?.transitionDuration || ""} placeholder=".2s" onChange={(v)=>patch("navigation",{transitionDuration:v})}/><SelectControl label="Transition easing" value={value.navigation?.transitionTiming || ""} onChange={(v)=>patch("navigation",{transitionTiming:v})} options={[{value:"",label:"Default"},"ease","linear","ease-in","ease-out","ease-in-out"]}/></div>
      <div className="vsn-control-subtitle">Submenu items</div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Submenu text" value={value.navigation?.submenuColor} onChange={(v)=>patch("navigation",{submenuColor:v})}/><SolidColor label="Submenu hover" value={value.navigation?.submenuHoverColor} onChange={(v)=>patch("navigation",{submenuHoverColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Submenu hover bg" value={value.navigation?.submenuHoverBackground} fallback="#f6f6f7" onChange={(v)=>patch("navigation",{submenuHoverBackground:v})}/><CssLengthControl label="Submenu min width" value={value.navigation?.submenuMinWidth || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{submenuMinWidth:v})}/></div>
      <CssLengthControl label="Submenu border width" value={value.navigation?.submenuBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{submenuBorderWidth:v})}/>
      <LengthPair aLabel="Submenu item X" aValue={value.navigation?.submenuItemPaddingX} aChange={(v)=>patch("navigation",{submenuItemPaddingX:v})} bLabel="Submenu item Y" bValue={value.navigation?.submenuItemPaddingY} bChange={(v)=>patch("navigation",{submenuItemPaddingY:v})}/>
      <CssLengthControl label="Submenu item radius" value={value.navigation?.submenuItemRadius || ""} defaultUnit="px" onChange={(v)=>patch("navigation",{submenuItemRadius:v})}/>
    </Group> : null}

    {has("form") ? <Group title="Form states & choices" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.form?.controlBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("form",{controlBorderWidth:v})}/><SelectControl label="Border style" value={value.form?.controlBorderStyle || "solid"} onChange={(v)=>patch("form",{controlBorderStyle:v})} options={["solid","dashed","dotted","double","none"]}/></div>
      <div className="grid grid-cols-3 gap-2"><CssLengthControl label="Font size" value={value.form?.controlFontSize || ""} defaultUnit="px" onChange={(v)=>patch("form",{controlFontSize:v})}/><SelectControl label="Weight" value={String(value.form?.controlFontWeight || "")} onChange={(v)=>patch("form",{controlFontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/><CssLengthControl label="Line height" value={value.form?.controlLineHeight || ""} defaultUnit="em" onChange={(v)=>patch("form",{controlLineHeight:v})}/></div>
      <NumberControl label="Placeholder opacity" value={value.form?.placeholderOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("form",{placeholderOpacity:v})}/>
      <div className="vsn-control-subtitle">Focus</div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Focus background" value={value.form?.focusBackground} fallback="#ffffff" onChange={(v)=>patch("form",{focusBackground:v})}/><SolidColor label="Focus text" value={value.form?.focusColor} onChange={(v)=>patch("form",{focusColor:v})}/></div>
      <div className="grid grid-cols-3 gap-2"><SolidColor label="Outline" value={value.form?.focusOutlineColor} fallback="#95BF47" onChange={(v)=>patch("form",{focusOutlineColor:v})}/><CssLengthControl label="Width" value={value.form?.focusOutlineWidth || ""} defaultUnit="px" onChange={(v)=>patch("form",{focusOutlineWidth:v})}/><CssLengthControl label="Offset" value={value.form?.focusOutlineOffset || ""} defaultUnit="px" onChange={(v)=>patch("form",{focusOutlineOffset:v})}/></div>
      <div className="vsn-control-subtitle">Invalid / disabled</div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Invalid background" value={value.form?.invalidBackground} fallback="#fff4f4" onChange={(v)=>patch("form",{invalidBackground:v})}/><SolidColor label="Invalid border" value={value.form?.invalidBorderColor} fallback="#d72c0d" onChange={(v)=>patch("form",{invalidBorderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Disabled background" value={value.form?.disabledBackground} fallback="#f3f4f6" onChange={(v)=>patch("form",{disabledBackground:v})}/><SolidColor label="Disabled text" value={value.form?.disabledColor} fallback="#8c9196" onChange={(v)=>patch("form",{disabledColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Disabled border" value={value.form?.disabledBorderColor} fallback="#e5e7eb" onChange={(v)=>patch("form",{disabledBorderColor:v})}/><NumberControl label="Disabled opacity" value={value.form?.disabledOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("form",{disabledOpacity:v})}/></div>
      <div className="vsn-control-subtitle">Textarea & choices</div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Textarea min height" value={value.form?.textareaMinHeight || ""} defaultUnit="px" onChange={(v)=>patch("form",{textareaMinHeight:v})}/><SelectControl label="Textarea resize" value={value.form?.textareaResize || "vertical"} onChange={(v)=>patch("form",{textareaResize:v})} options={["none","both","horizontal","vertical","block","inline"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Choice size" value={value.form?.choiceSize || ""} defaultUnit="px" onChange={(v)=>patch("form",{choiceSize:v})}/><SolidColor label="Accent color" value={value.form?.accentColor} fallback="#95BF47" onChange={(v)=>patch("form",{accentColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Helper text" value={value.form?.helperColor} fallback="#6d7175" onChange={(v)=>patch("form",{helperColor:v})}/><CssLengthControl label="Helper size" value={value.form?.helperSize || ""} defaultUnit="px" onChange={(v)=>patch("form",{helperSize:v})}/></div>
      <TextControl label="Control transition" value={value.form?.controlTransition || ""} placeholder="border-color .2s ease, box-shadow .2s ease" onChange={(v)=>patch("form",{controlTransition:v})}/>
    </Group> : null}

    {has("icon") ? <Group title="Icon interaction" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.icon?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("icon",{borderWidth:v})}/><SelectControl label="Border style" value={value.icon?.borderStyle || "solid"} onChange={(v)=>patch("icon",{borderStyle:v})} options={["solid","dashed","dotted","double","none"]}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Border color" value={value.icon?.borderColor} fallback="transparent" onChange={(v)=>patch("icon",{borderColor:v})}/><NumberControl label="Opacity" value={value.icon?.opacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("icon",{opacity:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><NumberControl label="SVG stroke width" value={value.icon?.strokeWidth ?? ""} min={0} max={8} step={0.25} onChange={(v)=>patch("icon",{strokeWidth:v})}/><TextControl label="Rotation" value={value.icon?.rotate || ""} placeholder="15deg" onChange={(v)=>patch("icon",{rotate:v})}/></div>
      <TextControl label="Shadow" value={value.icon?.shadow || ""} placeholder="0 6px 18px rgba(0,0,0,.12)" onChange={(v)=>patch("icon",{shadow:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Label text" value={value.icon?.labelColor} onChange={(v)=>patch("icon",{labelColor:v})}/><CssLengthControl label="Label size" value={value.icon?.labelSize || ""} defaultUnit="px" onChange={(v)=>patch("icon",{labelSize:v})}/></div>
      <SelectControl label="Label weight" value={String(value.icon?.labelWeight || "")} onChange={(v)=>patch("icon",{labelWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/>
      <div className="vsn-control-subtitle">Hover</div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Hover icon" value={value.icon?.hoverColor} onChange={(v)=>patch("icon",{hoverColor:v})}/><SolidColor label="Hover background" value={value.icon?.hoverBackground} fallback="transparent" onChange={(v)=>patch("icon",{hoverBackground:v})}/></div>
      <SolidColor label="Hover border" value={value.icon?.hoverBorderColor} fallback="transparent" onChange={(v)=>patch("icon",{hoverBorderColor:v})}/>
      <TextControl label="Hover transform" value={value.icon?.hoverTransform || ""} placeholder="translateY(-2px) scale(1.05)" onChange={(v)=>patch("icon",{hoverTransform:v})}/>
      <TextControl label="Transition" value={value.icon?.transition || ""} placeholder="all .2s ease" onChange={(v)=>patch("icon",{transition:v})}/>
    </Group> : null}

    {has("accordion") ? <Group title="Disclosure states" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Item border width" value={value.accordion?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("accordion",{borderWidth:v})}/><SelectControl label="Border style" value={value.accordion?.borderStyle || "solid"} onChange={(v)=>patch("accordion",{borderStyle:v})} options={["solid","dashed","dotted","double","none"]}/></div>
      <TextControl label="Item shadow" value={value.accordion?.shadow || ""} placeholder="0 8px 24px rgba(0,0,0,.08)" onChange={(v)=>patch("accordion",{shadow:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Header background" value={value.accordion?.headerBackground} fallback="transparent" onChange={(v)=>patch("accordion",{headerBackground:v})}/><SolidColor label="Header hover" value={value.accordion?.headerHoverBackground} fallback="#f6f6f7" onChange={(v)=>patch("accordion",{headerHoverBackground:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Header hover text" value={value.accordion?.headerHoverColor} onChange={(v)=>patch("accordion",{headerHoverColor:v})}/><SolidColor label="Open header text" value={value.accordion?.openHeaderColor} fallback="#1a1a1a" onChange={(v)=>patch("accordion",{openHeaderColor:v})}/></div>
      <SelectControl label="Header weight" value={String(value.accordion?.headerWeight || "")} onChange={(v)=>patch("accordion",{headerWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/>
      <LengthPair aLabel="Header padding" aValue={value.accordion?.headerPadding} aChange={(v)=>patch("accordion",{headerPadding:v})} bLabel="Content padding" bValue={value.accordion?.contentPadding} bChange={(v)=>patch("accordion",{contentPadding:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Content line height" value={value.accordion?.contentLineHeight || ""} defaultUnit="em" onChange={(v)=>patch("accordion",{contentLineHeight:v})}/><CssLengthControl label="Marker size" value={value.accordion?.markerSize || ""} defaultUnit="px" onChange={(v)=>patch("accordion",{markerSize:v})}/></div>
      <SolidColor label="Marker color" value={value.accordion?.markerColor} fallback="#6d7175" onChange={(v)=>patch("accordion",{markerColor:v})}/>
      <TextControl label="Open shadow" value={value.accordion?.openShadow || ""} placeholder="0 12px 30px rgba(0,0,0,.1)" onChange={(v)=>patch("accordion",{openShadow:v})}/>
      <TextControl label="Transition" value={value.accordion?.transition || ""} placeholder="background .2s ease, border-color .2s ease" onChange={(v)=>patch("accordion",{transition:v})}/>
    </Group> : null}

    {has("tabs") ? <Group title="Tab interaction" defaultOpen={false}>
      <CssLengthControl label="Tab gap" value={value.tabs?.gap || ""} defaultUnit="px" onChange={(v)=>patch("tabs",{gap:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={value.tabs?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("tabs",{fontSize:v})}/><SelectControl label="Weight" value={String(value.tabs?.fontWeight || "")} onChange={(v)=>patch("tabs",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Tab border" value={value.tabs?.borderColor} fallback="transparent" onChange={(v)=>patch("tabs",{borderColor:v})}/><CssLengthControl label="Border width" value={value.tabs?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("tabs",{borderWidth:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Hover text" value={value.tabs?.hoverColor} onChange={(v)=>patch("tabs",{hoverColor:v})}/><SolidColor label="Hover background" value={value.tabs?.hoverBackground} fallback="#f6f6f7" onChange={(v)=>patch("tabs",{hoverBackground:v})}/></div>
      <SolidColor label="Active border" value={value.tabs?.activeBorderColor} fallback="#95BF47" onChange={(v)=>patch("tabs",{activeBorderColor:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Panel border" value={value.tabs?.panelBorderColor} fallback="#e5e7eb" onChange={(v)=>patch("tabs",{panelBorderColor:v})}/><CssLengthControl label="Panel border width" value={value.tabs?.panelBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("tabs",{panelBorderWidth:v})}/></div>
      <TextControl label="Panel shadow" value={value.tabs?.panelShadow || ""} placeholder="0 10px 30px rgba(0,0,0,.08)" onChange={(v)=>patch("tabs",{panelShadow:v})}/>
      <TextControl label="Transition" value={value.tabs?.transition || ""} placeholder="all .2s ease" onChange={(v)=>patch("tabs",{transition:v})}/>
    </Group> : null}

    {has("progress") ? <Group title="Progress details" defaultOpen={false}>
      <ColorGradientControl toggleable label="Fill surface" value={value.progress?.fillBackground || {type:"color",color:value.progress?.fillColor || "#95BF47"}} onChange={(v)=>patch("progress",{fillBackground:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Track border" value={value.progress?.trackBorderColor} fallback="transparent" onChange={(v)=>patch("progress",{trackBorderColor:v})}/><CssLengthControl label="Track border width" value={value.progress?.trackBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("progress",{trackBorderWidth:v})}/></div>
      <SelectControl label="Label weight" value={String(value.progress?.labelWeight || "")} onChange={(v)=>patch("progress",{labelWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Value color" value={value.progress?.valueColor} onChange={(v)=>patch("progress",{valueColor:v})}/><CssLengthControl label="Value size" value={value.progress?.valueSize || ""} defaultUnit="px" onChange={(v)=>patch("progress",{valueSize:v})}/></div>
      <SelectControl label="Value weight" value={String(value.progress?.valueWeight || "")} onChange={(v)=>patch("progress",{valueWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/>
    </Group> : null}

    {has("table") ? <Group title="Table details" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Outer border" value={value.table?.outerBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("table",{outerBorderWidth:v})}/><CssLengthControl label="Row border" value={value.table?.rowBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("table",{rowBorderWidth:v})}/></div>
      <SelectControl label="Row border style" value={value.table?.rowBorderStyle || "solid"} onChange={(v)=>patch("table",{rowBorderStyle:v})} options={["solid","dashed","dotted","double","none"]}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Header size" value={value.table?.headerSize || ""} defaultUnit="px" onChange={(v)=>patch("table",{headerSize:v})}/><SelectControl label="Header weight" value={String(value.table?.headerWeight || "")} onChange={(v)=>patch("table",{headerWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/></div>
      <CssLengthControl label="Cell size" value={value.table?.cellSize || ""} defaultUnit="px" onChange={(v)=>patch("table",{cellSize:v})}/>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Text align" value={value.table?.textAlign || ""} onChange={(v)=>patch("table",{textAlign:v})} options={[{value:"",label:"Default"},"left","center","right","start","end"]}/><SelectControl label="Vertical align" value={value.table?.verticalAlign || ""} onChange={(v)=>patch("table",{verticalAlign:v})} options={[{value:"",label:"Default"},"top","middle","bottom","baseline"]}/></div>
      <SelectControl label="Sticky header" value={value.table?.stickyHeader ? "yes" : "no"} onChange={(v)=>patch("table",{stickyHeader:v==="yes"})} options={[{value:"no",label:"Off"},{value:"yes",label:"On"}]}/>
    </Group> : null}

    {has("stats") ? <Group title="Stats layout" defaultOpen={false}>
      <CssLengthControl label="Item gap" value={value.stats?.itemGap || ""} defaultUnit="px" onChange={(v)=>patch("stats",{itemGap:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Item border width" value={value.stats?.itemBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("stats",{itemBorderWidth:v})}/><SelectControl label="Border style" value={value.stats?.itemBorderStyle || "solid"} onChange={(v)=>patch("stats",{itemBorderStyle:v})} options={["solid","dashed","dotted","double","none"]}/></div>
      <CssLengthControl label="Item min width" value={value.stats?.itemMinWidth || ""} defaultUnit="px" onChange={(v)=>patch("stats",{itemMinWidth:v})}/>
      <TextControl label="Item shadow" value={value.stats?.itemShadow || ""} placeholder="0 8px 24px rgba(0,0,0,.08)" onChange={(v)=>patch("stats",{itemShadow:v})}/>
      <SelectControl label="Text align" value={value.stats?.textAlign || "center"} onChange={(v)=>patch("stats",{textAlign:v})} options={["left","center","right","start","end"]}/>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Value weight" value={String(value.stats?.valueWeight || "")} onChange={(v)=>patch("stats",{valueWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><CssLengthControl label="Value line height" value={value.stats?.valueLineHeight || ""} defaultUnit="em" onChange={(v)=>patch("stats",{valueLineHeight:v})}/></div>
      <SelectControl label="Label weight" value={String(value.stats?.labelWeight || "")} onChange={(v)=>patch("stats",{labelWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/>
    </Group> : null}

    {has("carousel") ? <Group title="Carousel behavior" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Snap align" value={value.carousel?.snapAlign || "start"} onChange={(v)=>patch("carousel",{snapAlign:v})} options={["none","start","center","end"]}/><SelectControl label="Scroll behavior" value={value.carousel?.scrollBehavior || "smooth"} onChange={(v)=>patch("carousel",{scrollBehavior:v})} options={["auto","smooth"]}/></div>
      <ColorGradientControl toggleable label="Slide background" value={value.carousel?.itemBackground || {type:"color",color:"transparent"}} onChange={(v)=>patch("carousel",{itemBackground:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Slide border" value={value.carousel?.itemBorderColor} fallback="transparent" onChange={(v)=>patch("carousel",{itemBorderColor:v})}/><CssLengthControl label="Border width" value={value.carousel?.itemBorderWidth || ""} defaultUnit="px" onChange={(v)=>patch("carousel",{itemBorderWidth:v})}/></div>
      <TextControl label="Slide shadow" value={value.carousel?.itemShadow || ""} placeholder="0 8px 24px rgba(0,0,0,.08)" onChange={(v)=>patch("carousel",{itemShadow:v})}/>
      <TextControl label="Slide hover transform" value={value.carousel?.itemHoverTransform || ""} placeholder="translateY(-2px)" onChange={(v)=>patch("carousel",{itemHoverTransform:v})}/>
      <TextControl label="Transition" value={value.carousel?.itemTransition || ""} placeholder="all .2s ease" onChange={(v)=>patch("carousel",{itemTransition:v})}/>
    </Group> : null}

    {has("bar") ? <Group title="Bar surface" defaultOpen={false}>
      <ColorGradientControl toggleable label="Background" value={value.bar?.background || {type:"color",color:"transparent"}} onChange={(v)=>patch("bar",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Text color" value={value.bar?.color} onChange={(v)=>patch("bar",{color:v})}/><CssLengthControl label="Font size" value={value.bar?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("bar",{fontSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Font weight" value={String(value.bar?.fontWeight || "")} onChange={(v)=>patch("bar",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><SelectControl label="Text transform" value={value.bar?.textTransform || ""} onChange={(v)=>patch("bar",{textTransform:v})} options={[{value:"",label:"Default"},"none","uppercase","lowercase","capitalize"]}/></div>
      <SelectControl label="Text align" value={value.bar?.textAlign || "center"} onChange={(v)=>patch("bar",{textAlign:v})} options={["left","center","right","start","end"]}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Radius" value={value.bar?.radius || ""} defaultUnit="px" onChange={(v)=>patch("bar",{radius:v})}/><CssLengthControl label="Border width" value={value.bar?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("bar",{borderWidth:v})}/></div>
      <SolidColor label="Border color" value={value.bar?.borderColor} fallback="transparent" onChange={(v)=>patch("bar",{borderColor:v})}/>
      <TextControl label="Shadow" value={value.bar?.shadow || ""} placeholder="0 4px 16px rgba(0,0,0,.08)" onChange={(v)=>patch("bar",{shadow:v})}/>
    </Group> : null}

    {has("divider") ? <Group title="Divider effects" defaultOpen={false}>
      <NumberControl label="Opacity" value={value.divider?.opacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("divider",{opacity:v})}/>
    </Group> : null}

    {(has("gridCards") || has("cards")) ? <Group title="Cards & grid">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Grid gap" value={value.grid?.gap || ""} defaultUnit="px" onChange={(v)=>patch("grid",{gap:v})}/><CssLengthControl label="Row gap" value={value.grid?.rowGap || ""} defaultUnit="px" onChange={(v)=>patch("grid",{rowGap:v})}/></div>
      <ColorGradientControl toggleable label="Card background" value={value.card?.background || {type:"color",color:"#ffffff"}} onChange={(v)=>patch("card",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Card text" value={value.card?.color} onChange={(v)=>patch("card",{color:v})}/><SolidColor label="Card border" value={value.card?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("card",{borderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.card?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("card",{borderWidth:v})}/><CssLengthControl label="Radius" value={value.card?.borderRadius || ""} defaultUnit="px" onChange={(v)=>patch("card",{borderRadius:v})}/></div>
      <CssLengthControl label="Card padding" value={value.card?.padding || ""} defaultUnit="px" onChange={(v)=>patch("card",{padding:v})}/>
      <TextControl label="Card shadow" value={value.card?.shadow || ""} placeholder="0 8px 24px rgba(0,0,0,.08)" onChange={(v)=>patch("card",{shadow:v})}/>
      <TextControl label="Hover shadow" value={value.card?.hoverShadow || ""} placeholder="0 14px 32px rgba(0,0,0,.12)" onChange={(v)=>patch("card",{hoverShadow:v})}/>
      <TextControl label="Hover transform" value={value.card?.hoverTransform || ""} placeholder="translateY(-4px)" onChange={(v)=>patch("card",{hoverTransform:v})}/>
      <div className="grid grid-cols-2 gap-2"><AspectRatioControl label="Media ratio" value={value.card?.mediaAspectRatio || ""} onChange={(v)=>patch("card",{mediaAspectRatio:v})}/><SelectControl label="Media fit" value={value.card?.mediaObjectFit || ""} onChange={(v)=>patch("card",{mediaObjectFit:v})} options={[{value:"",label:"Default"},"cover","contain","fill","none","scale-down"]}/></div>
      <CssLengthControl label="Media radius" value={value.card?.mediaRadius || ""} defaultUnit="px" onChange={(v)=>patch("card",{mediaRadius:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Title color" value={value.card?.titleColor} onChange={(v)=>patch("card",{titleColor:v})}/><CssLengthControl label="Title size" value={value.card?.titleSize || ""} defaultUnit="px" onChange={(v)=>patch("card",{titleSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Body color" value={value.card?.bodyColor} fallback="#6d7175" onChange={(v)=>patch("card",{bodyColor:v})}/><CssLengthControl label="Body size" value={value.card?.bodySize || ""} defaultUnit="px" onChange={(v)=>patch("card",{bodySize:v})}/></div>
    </Group> : null}

    {has("commercePrice") ? <Group title="Commerce pricing">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Price color" value={value.commercePrice?.color} fallback="#1a1a1a" onChange={(v)=>patch("commercePrice",{color:v})}/><CssLengthControl label="Price size" value={value.commercePrice?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("commercePrice",{fontSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Price weight" value={String(value.commercePrice?.fontWeight || "")} onChange={(v)=>patch("commercePrice",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><CssLengthControl label="Line height" value={value.commercePrice?.lineHeight || ""} defaultUnit="em" keywords={["normal"]} onChange={(v)=>patch("commercePrice",{lineHeight:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Compare color" value={value.commercePrice?.compareColor} fallback="#777777" onChange={(v)=>patch("commercePrice",{compareColor:v})}/><CssLengthControl label="Compare size" value={value.commercePrice?.compareSize || ""} defaultUnit="px" onChange={(v)=>patch("commercePrice",{compareSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><NumberControl label="Compare opacity" value={value.commercePrice?.compareOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("commercePrice",{compareOpacity:v})}/><CssLengthControl label="Decoration thickness" value={value.commercePrice?.decorationThickness || ""} defaultUnit="px" onChange={(v)=>patch("commercePrice",{decorationThickness:v})}/></div>
      <CssLengthControl label="Price group gap" value={value.commercePrice?.gap || ""} defaultUnit="px" onChange={(v)=>patch("commercePrice",{gap:v})}/>
    </Group> : null}

    {has("commerceMeta") ? <Group title="Product meta & status">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Label color" value={value.commerceMeta?.labelColor} fallback="#6d7175" onChange={(v)=>patch("commerceMeta",{labelColor:v})}/><SolidColor label="Value color" value={value.commerceMeta?.valueColor} fallback="#1a1a1a" onChange={(v)=>patch("commerceMeta",{valueColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={value.commerceMeta?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("commerceMeta",{fontSize:v})}/><SelectControl label="Weight" value={String(value.commerceMeta?.fontWeight || "")} onChange={(v)=>patch("commerceMeta",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="In stock" value={value.commerceMeta?.inStockColor} fallback="#008060" onChange={(v)=>patch("commerceMeta",{inStockColor:v})}/><SolidColor label="Low stock" value={value.commerceMeta?.lowStockColor} fallback="#b98900" onChange={(v)=>patch("commerceMeta",{lowStockColor:v})}/></div>
      <SolidColor label="Sold out" value={value.commerceMeta?.soldOutColor} fallback="#d72c0d" onChange={(v)=>patch("commerceMeta",{soldOutColor:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Pill padding X" value={value.commerceMeta?.pillPaddingX || ""} defaultUnit="px" onChange={(v)=>patch("commerceMeta",{pillPaddingX:v})}/><CssLengthControl label="Pill padding Y" value={value.commerceMeta?.pillPaddingY || ""} defaultUnit="px" onChange={(v)=>patch("commerceMeta",{pillPaddingY:v})}/></div>
      <CssLengthControl label="Pill radius" value={value.commerceMeta?.pillRadius || ""} defaultUnit="px" onChange={(v)=>patch("commerceMeta",{pillRadius:v})}/>
    </Group> : null}

    {has("commerceOptions") ? <Group title="Product option controls">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Label gap" value={value.commerceOptions?.labelGap || ""} defaultUnit="px" onChange={(v)=>patch("commerceOptions",{labelGap:v})}/><CssLengthControl label="Control width" value={value.commerceOptions?.width || ""} defaultUnit="px" keywords={["auto","fit-content","100%"]} onChange={(v)=>patch("commerceOptions",{width:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Label color" value={value.commerceOptions?.labelColor} fallback="#1a1a1a" onChange={(v)=>patch("commerceOptions",{labelColor:v})}/><SelectControl label="Label weight" value={String(value.commerceOptions?.labelWeight || "")} onChange={(v)=>patch("commerceOptions",{labelWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Selected border" value={value.commerceOptions?.selectedBorderColor} fallback="#1a1a1a" onChange={(v)=>patch("commerceOptions",{selectedBorderColor:v})}/><SolidColor label="Selected background" value={value.commerceOptions?.selectedBackground} fallback="#f6f6f7" onChange={(v)=>patch("commerceOptions",{selectedBackground:v})}/></div>
    </Group> : null}

    {has("commerceGrid") ? <Group title="Commerce cards" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Content gap" value={value.commerceGrid?.contentGap || ""} defaultUnit="px" onChange={(v)=>patch("commerceGrid",{contentGap:v})}/><CssLengthControl label="Image padding" value={value.commerceGrid?.imagePadding || ""} defaultUnit="px" onChange={(v)=>patch("commerceGrid",{imagePadding:v})}/></div>
      <SolidColor label="Image surface" value={value.commerceGrid?.imageBackground} fallback="#f6f6f7" onChange={(v)=>patch("commerceGrid",{imageBackground:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Price color" value={value.commerceGrid?.priceColor} fallback="#1a1a1a" onChange={(v)=>patch("commerceGrid",{priceColor:v})}/><CssLengthControl label="Price size" value={value.commerceGrid?.priceSize || ""} defaultUnit="px" onChange={(v)=>patch("commerceGrid",{priceSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Compare price" value={value.commerceGrid?.compareColor} fallback="#777777" onChange={(v)=>patch("commerceGrid",{compareColor:v})}/><NumberControl label="Compare opacity" value={value.commerceGrid?.compareOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("commerceGrid",{compareOpacity:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Sale badge" value={value.commerceGrid?.saleBadgeBackground} fallback="#d72c0d" onChange={(v)=>patch("commerceGrid",{saleBadgeBackground:v})}/><SolidColor label="Sold out badge" value={value.commerceGrid?.soldOutBadgeBackground} fallback="#1a1a1a" onChange={(v)=>patch("commerceGrid",{soldOutBadgeBackground:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Badge text" value={value.commerceGrid?.badgeColor} fallback="#ffffff" onChange={(v)=>patch("commerceGrid",{badgeColor:v})}/><CssLengthControl label="Badge radius" value={value.commerceGrid?.badgeRadius || ""} defaultUnit="px" onChange={(v)=>patch("commerceGrid",{badgeRadius:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Badge padding X" value={value.commerceGrid?.badgePaddingX || ""} defaultUnit="px" onChange={(v)=>patch("commerceGrid",{badgePaddingX:v})}/><CssLengthControl label="Badge padding Y" value={value.commerceGrid?.badgePaddingY || ""} defaultUnit="px" onChange={(v)=>patch("commerceGrid",{badgePaddingY:v})}/></div>
      <NumberControl label="Title line clamp" value={value.commerceGrid?.titleClamp ?? ""} min={1} max={6} step={1} onChange={(v)=>patch("commerceGrid",{titleClamp:v})}/>
    </Group> : null}

    {has("collectionTools") ? <Group title="Collection toolbar">
      <ColorGradientControl toggleable label="Toolbar background" value={value.collectionTools?.background || {type:"color",color:"transparent"}} onChange={(v)=>patch("collectionTools",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Padding" value={value.collectionTools?.padding || ""} defaultUnit="px" onChange={(v)=>patch("collectionTools",{padding:v})}/><CssLengthControl label="Radius" value={value.collectionTools?.radius || ""} defaultUnit="px" onChange={(v)=>patch("collectionTools",{radius:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Gap" value={value.collectionTools?.gap || ""} defaultUnit="px" onChange={(v)=>patch("collectionTools",{gap:v})}/><CssLengthControl label="Bottom gap" value={value.collectionTools?.marginBottom || ""} defaultUnit="px" onChange={(v)=>patch("collectionTools",{marginBottom:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Heading" value={value.collectionTools?.headingColor} fallback="#1a1a1a" onChange={(v)=>patch("collectionTools",{headingColor:v})}/><CssLengthControl label="Heading size" value={value.collectionTools?.headingSize || ""} defaultUnit="px" onChange={(v)=>patch("collectionTools",{headingSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Clear text" value={value.collectionTools?.clearColor} fallback="#1a1a1a" onChange={(v)=>patch("collectionTools",{clearColor:v})}/><SolidColor label="Clear background" value={value.collectionTools?.clearBackground} fallback="#ffffff" onChange={(v)=>patch("collectionTools",{clearBackground:v})}/></div>
    </Group> : null}

    {has("commercePagination") ? <Group title="Commerce pagination">
      <SelectControl label="Alignment" value={value.commercePagination?.alignment || "center"} onChange={(v)=>patch("commercePagination",{alignment:v})} options={["flex-start","center","flex-end","space-between"]}/>
      <CssLengthControl label="Button gap" value={value.commercePagination?.gap || ""} defaultUnit="px" onChange={(v)=>patch("commercePagination",{gap:v})}/>
      <NumberControl label="Loading opacity" value={value.commercePagination?.loadingOpacity ?? ""} min={0} max={1} step={0.05} onChange={(v)=>patch("commercePagination",{loadingOpacity:v})}/>
    </Group> : null}

    {has("cartSurface") ? <Group title="Cart surface">
      <ColorGradientControl toggleable label="Surface" value={value.cartSurface?.background || {type:"color",color:"#ffffff"}} onChange={(v)=>patch("cartSurface",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Padding" value={value.cartSurface?.padding || ""} defaultUnit="px" onChange={(v)=>patch("cartSurface",{padding:v})}/><CssLengthControl label="Radius" value={value.cartSurface?.radius || ""} defaultUnit="px" onChange={(v)=>patch("cartSurface",{radius:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Border" value={value.cartSurface?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("cartSurface",{borderColor:v})}/><CssLengthControl label="Border width" value={value.cartSurface?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("cartSurface",{borderWidth:v})}/></div>
      <TextControl label="Shadow" value={value.cartSurface?.shadow || ""} placeholder="0 16px 48px rgba(0,0,0,.12)" onChange={(v)=>patch("cartSurface",{shadow:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Heading" value={value.cartSurface?.headingColor} fallback="#1a1a1a" onChange={(v)=>patch("cartSurface",{headingColor:v})}/><CssLengthControl label="Heading size" value={value.cartSurface?.headingSize || ""} defaultUnit="px" onChange={(v)=>patch("cartSurface",{headingSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Muted text" value={value.cartSurface?.mutedColor} fallback="#6d7175" onChange={(v)=>patch("cartSurface",{mutedColor:v})}/><CssLengthControl label="Action gap" value={value.cartSurface?.actionGap || ""} defaultUnit="px" onChange={(v)=>patch("cartSurface",{actionGap:v})}/></div>
    </Group> : null}

    {has("stickyCart") ? <Group title="Sticky cart surface">
      <ColorGradientControl toggleable label="Surface" value={value.stickyCart?.background || {type:"color",color:"#ffffff"}} onChange={(v)=>patch("stickyCart",{background:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Padding X" value={value.stickyCart?.paddingX || ""} defaultUnit="px" onChange={(v)=>patch("stickyCart",{paddingX:v})}/><CssLengthControl label="Padding Y" value={value.stickyCart?.paddingY || ""} defaultUnit="px" onChange={(v)=>patch("stickyCart",{paddingY:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Border top" value={value.stickyCart?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("stickyCart",{borderColor:v})}/><CssLengthControl label="Border width" value={value.stickyCart?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("stickyCart",{borderWidth:v})}/></div>
      <TextControl label="Shadow" value={value.stickyCart?.shadow || ""} placeholder="0 -8px 30px rgba(0,0,0,.08)" onChange={(v)=>patch("stickyCart",{shadow:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Title" value={value.stickyCart?.titleColor} fallback="#1a1a1a" onChange={(v)=>patch("stickyCart",{titleColor:v})}/><SolidColor label="Price" value={value.stickyCart?.priceColor} fallback="#6d7175" onChange={(v)=>patch("stickyCart",{priceColor:v})}/></div>
    </Group> : null}

    {has("commerceHeading") ? <Group title="Commerce section heading" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Heading color" value={value.commerceHeading?.color} fallback="#1a1a1a" onChange={(v)=>patch("commerceHeading",{color:v})}/><CssLengthControl label="Heading size" value={value.commerceHeading?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("commerceHeading",{fontSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Weight" value={String(value.commerceHeading?.fontWeight || "")} onChange={(v)=>patch("commerceHeading",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><CssLengthControl label="Bottom gap" value={value.commerceHeading?.marginBottom || ""} defaultUnit="px" onChange={(v)=>patch("commerceHeading",{marginBottom:v})}/></div>
    </Group> : null}

    {has("searchSummary") ? <Group title="Search summary" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Prefix / label" value={value.searchSummary?.labelColor} fallback="#6d7175" onChange={(v)=>patch("searchSummary",{labelColor:v})}/><SolidColor label="Query / value" value={value.searchSummary?.valueColor} fallback="#1a1a1a" onChange={(v)=>patch("searchSummary",{valueColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Value weight" value={String(value.searchSummary?.valueWeight || "")} onChange={(v)=>patch("searchSummary",{valueWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><SolidColor label="Count background" value={value.searchSummary?.background} fallback="transparent" onChange={(v)=>patch("searchSummary",{background:v})}/></div>
      <LengthPair aLabel="Padding X" aValue={value.searchSummary?.paddingX} aChange={(v)=>patch("searchSummary",{paddingX:v})} bLabel="Padding Y" bValue={value.searchSummary?.paddingY} bChange={(v)=>patch("searchSummary",{paddingY:v})}/>
      <CssLengthControl label="Radius" value={value.searchSummary?.radius || ""} defaultUnit="px" onChange={(v)=>patch("searchSummary",{radius:v})}/>
    </Group> : null}

    {has("searchResults") ? <Group title="Search result details" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Type color" value={value.searchResults?.typeColor} fallback="#777777" onChange={(v)=>patch("searchResults",{typeColor:v})}/><CssLengthControl label="Type size" value={value.searchResults?.typeSize || ""} defaultUnit="px" onChange={(v)=>patch("searchResults",{typeSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Title color" value={value.searchResults?.titleColor} fallback="#1a1a1a" onChange={(v)=>patch("searchResults",{titleColor:v})}/><CssLengthControl label="Title size" value={value.searchResults?.titleSize || ""} defaultUnit="px" onChange={(v)=>patch("searchResults",{titleSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><NumberControl label="Title clamp" value={value.searchResults?.titleClamp ?? ""} min={1} max={6} step={1} onChange={(v)=>patch("searchResults",{titleClamp:v})}/><SelectControl label="Title weight" value={String(value.searchResults?.titleWeight || "")} onChange={(v)=>patch("searchResults",{titleWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Excerpt color" value={value.searchResults?.excerptColor} fallback="#666666" onChange={(v)=>patch("searchResults",{excerptColor:v})}/><CssLengthControl label="Excerpt size" value={value.searchResults?.excerptSize || ""} defaultUnit="px" onChange={(v)=>patch("searchResults",{excerptSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><NumberControl label="Excerpt clamp" value={value.searchResults?.excerptClamp ?? ""} min={1} max={8} step={1} onChange={(v)=>patch("searchResults",{excerptClamp:v})}/><CssLengthControl label="Content gap" value={value.searchResults?.contentGap || ""} defaultUnit="px" onChange={(v)=>patch("searchResults",{contentGap:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Media bottom" value={value.searchResults?.mediaMarginBottom || ""} defaultUnit="px" onChange={(v)=>patch("searchResults",{mediaMarginBottom:v})}/><SolidColor label="Empty text" value={value.searchResults?.emptyColor} fallback="#6d7175" onChange={(v)=>patch("searchResults",{emptyColor:v})}/></div>
    </Group> : null}

    {has("articleCards") ? <Group title="Article card content" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Title color" value={value.articleCards?.titleColor} fallback="#1a1a1a" onChange={(v)=>patch("articleCards",{titleColor:v})}/><CssLengthControl label="Title size" value={value.articleCards?.titleSize || ""} defaultUnit="px" onChange={(v)=>patch("articleCards",{titleSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Title weight" value={String(value.articleCards?.titleWeight || "")} onChange={(v)=>patch("articleCards",{titleWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><NumberControl label="Title clamp" value={value.articleCards?.titleClamp ?? ""} min={1} max={6} step={1} onChange={(v)=>patch("articleCards",{titleClamp:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Excerpt color" value={value.articleCards?.excerptColor} fallback="#666666" onChange={(v)=>patch("articleCards",{excerptColor:v})}/><CssLengthControl label="Excerpt size" value={value.articleCards?.excerptSize || ""} defaultUnit="px" onChange={(v)=>patch("articleCards",{excerptSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Date color" value={value.articleCards?.dateColor} fallback="#777777" onChange={(v)=>patch("articleCards",{dateColor:v})}/><SolidColor label="Author color" value={value.articleCards?.authorColor} fallback="#777777" onChange={(v)=>patch("articleCards",{authorColor:v})}/></div>
      <LengthPair aLabel="Content gap" aValue={value.articleCards?.contentGap} aChange={(v)=>patch("articleCards",{contentGap:v})} bLabel="Meta gap" bValue={value.articleCards?.metaGap} bChange={(v)=>patch("articleCards",{metaGap:v})}/>
    </Group> : null}

    {has("articleBody") ? <Group title="Article body" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Heading color" value={value.articleBody?.headingColor} fallback="#1a1a1a" onChange={(v)=>patch("articleBody",{headingColor:v})}/><SolidColor label="Link color" value={value.articleBody?.linkColor} fallback="#006e52" onChange={(v)=>patch("articleBody",{linkColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Link hover" value={value.articleBody?.linkHoverColor} fallback="#004c3f" onChange={(v)=>patch("articleBody",{linkHoverColor:v})}/><SolidColor label="Quote accent" value={value.articleBody?.quoteBorderColor} fallback="#95BF47" onChange={(v)=>patch("articleBody",{quoteBorderColor:v})}/></div>
      <LengthPair aLabel="Heading top" aValue={value.articleBody?.headingTop} aChange={(v)=>patch("articleBody",{headingTop:v})} bLabel="Heading bottom" bValue={value.articleBody?.headingBottom} bChange={(v)=>patch("articleBody",{headingBottom:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Media radius" value={value.articleBody?.mediaRadius || ""} defaultUnit="px" onChange={(v)=>patch("articleBody",{mediaRadius:v})}/><CssLengthControl label="Quote padding" value={value.articleBody?.quotePadding || ""} defaultUnit="px" onChange={(v)=>patch("articleBody",{quotePadding:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Code background" value={value.articleBody?.codeBackground} fallback="#f3f4f6" onChange={(v)=>patch("articleBody",{codeBackground:v})}/><SolidColor label="Code text" value={value.articleBody?.codeColor} fallback="#1a1a1a" onChange={(v)=>patch("articleBody",{codeColor:v})}/></div>
    </Group> : null}

    {has("articleMeta") ? <Group title="Article meta" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Text color" value={value.articleMeta?.color} fallback="#666666" onChange={(v)=>patch("articleMeta",{color:v})}/><SolidColor label="Background" value={value.articleMeta?.background} fallback="transparent" onChange={(v)=>patch("articleMeta",{background:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={value.articleMeta?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("articleMeta",{fontSize:v})}/><SelectControl label="Weight" value={String(value.articleMeta?.fontWeight || "")} onChange={(v)=>patch("articleMeta",{fontWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700"]}/></div>
      <LengthPair aLabel="Padding X" aValue={value.articleMeta?.paddingX} aChange={(v)=>patch("articleMeta",{paddingX:v})} bLabel="Padding Y" bValue={value.articleMeta?.paddingY} bChange={(v)=>patch("articleMeta",{paddingY:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Radius" value={value.articleMeta?.radius || ""} defaultUnit="px" onChange={(v)=>patch("articleMeta",{radius:v})}/><CssLengthControl label="Tag gap" value={value.articleMeta?.tagGap || ""} defaultUnit="px" onChange={(v)=>patch("articleMeta",{tagGap:v})}/></div>
      <SolidColor label="Tag background" value={value.articleMeta?.tagBackground} fallback="#f3f4f6" onChange={(v)=>patch("articleMeta",{tagBackground:v})}/>
    </Group> : null}

    {has("articleNav") ? <Group title="Article navigation" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Link color" value={value.articleNav?.color} fallback="#1a1a1a" onChange={(v)=>patch("articleNav",{color:v})}/><SolidColor label="Hover color" value={value.articleNav?.hoverColor} fallback="#006e52" onChange={(v)=>patch("articleNav",{hoverColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Background" value={value.articleNav?.background} fallback="transparent" onChange={(v)=>patch("articleNav",{background:v})}/><SolidColor label="Border" value={value.articleNav?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("articleNav",{borderColor:v})}/></div>
      <LengthPair aLabel="Padding" aValue={value.articleNav?.padding} aChange={(v)=>patch("articleNav",{padding:v})} bLabel="Radius" bValue={value.articleNav?.radius} bChange={(v)=>patch("articleNav",{radius:v})}/>
      <CssLengthControl label="Navigation gap" value={value.articleNav?.gap || ""} defaultUnit="px" onChange={(v)=>patch("articleNav",{gap:v})}/>
    </Group> : null}

    {has("customerIdentity") ? <Group title="Customer identity" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Prefix color" value={value.customerIdentity?.prefixColor} fallback="#6d7175" onChange={(v)=>patch("customerIdentity",{prefixColor:v})}/><SolidColor label="Name color" value={value.customerIdentity?.nameColor} fallback="#1a1a1a" onChange={(v)=>patch("customerIdentity",{nameColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Name weight" value={String(value.customerIdentity?.nameWeight || "")} onChange={(v)=>patch("customerIdentity",{nameWeight:v})} options={[{value:"",label:"Default"},"400","500","600","700","800"]}/><SolidColor label="Background" value={value.customerIdentity?.background} fallback="transparent" onChange={(v)=>patch("customerIdentity",{background:v})}/></div>
      <LengthPair aLabel="Padding X" aValue={value.customerIdentity?.paddingX} aChange={(v)=>patch("customerIdentity",{paddingX:v})} bLabel="Padding Y" bValue={value.customerIdentity?.paddingY} bChange={(v)=>patch("customerIdentity",{paddingY:v})}/>
      <CssLengthControl label="Radius" value={value.customerIdentity?.radius || ""} defaultUnit="px" onChange={(v)=>patch("customerIdentity",{radius:v})}/>
    </Group> : null}

    {has("customerLink") ? <Group title="Customer link behavior" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SelectControl label="Decoration" value={value.customerLink?.decoration || "none"} onChange={(v)=>patch("customerLink",{decoration:v})} options={["none","underline","overline","line-through"]}/><SelectControl label="Hover decoration" value={value.customerLink?.hoverDecoration || "underline"} onChange={(v)=>patch("customerLink",{hoverDecoration:v})} options={["none","underline","overline","line-through"]}/></div>
      <CssLengthControl label="Underline offset" value={value.customerLink?.underlineOffset || ""} defaultUnit="px" onChange={(v)=>patch("customerLink",{underlineOffset:v})}/>
    </Group> : null}

    {has("codeSurface") ? <Group title="Code output surface" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Background" value={value.codeSurface?.background} fallback="#f6f6f7" onChange={(v)=>patch("codeSurface",{background:v})}/><SolidColor label="Text" value={value.codeSurface?.color} fallback="#1a1a1a" onChange={(v)=>patch("codeSurface",{color:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Font size" value={value.codeSurface?.fontSize || ""} defaultUnit="px" onChange={(v)=>patch("codeSurface",{fontSize:v})}/><CssLengthControl label="Line height" value={value.codeSurface?.lineHeight || ""} defaultUnit="em" keywords={["normal"]} onChange={(v)=>patch("codeSurface",{lineHeight:v})}/></div>
      <LengthPair aLabel="Padding" aValue={value.codeSurface?.padding} aChange={(v)=>patch("codeSurface",{padding:v})} bLabel="Radius" bValue={value.codeSurface?.radius} bChange={(v)=>patch("codeSurface",{radius:v})}/>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Border width" value={value.codeSurface?.borderWidth || ""} defaultUnit="px" onChange={(v)=>patch("codeSurface",{borderWidth:v})}/><SolidColor label="Border color" value={value.codeSurface?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("codeSurface",{borderColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Max height" value={value.codeSurface?.maxHeight || ""} defaultUnit="px" keywords={["none"]} onChange={(v)=>patch("codeSurface",{maxHeight:v})}/><SelectControl label="Overflow" value={value.codeSurface?.overflow || "auto"} onChange={(v)=>patch("codeSurface",{overflow:v})} options={["visible","hidden","clip","auto","scroll"]}/></div>
    </Group> : null}

    {has("contentCollection") ? <Group title="Content collection" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Item background" value={value.contentCollection?.background} fallback="#ffffff" onChange={(v)=>patch("contentCollection",{background:v})}/><SolidColor label="Item border" value={value.contentCollection?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("contentCollection",{borderColor:v})}/></div>
      <LengthPair aLabel="Item padding" aValue={value.contentCollection?.padding} aChange={(v)=>patch("contentCollection",{padding:v})} bLabel="Item radius" bValue={value.contentCollection?.radius} bChange={(v)=>patch("contentCollection",{radius:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Title color" value={value.contentCollection?.titleColor} fallback="#1a1a1a" onChange={(v)=>patch("contentCollection",{titleColor:v})}/><SolidColor label="Body color" value={value.contentCollection?.bodyColor} fallback="#666666" onChange={(v)=>patch("contentCollection",{bodyColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Media radius" value={value.contentCollection?.mediaRadius || ""} defaultUnit="px" onChange={(v)=>patch("contentCollection",{mediaRadius:v})}/><CssLengthControl label="Content gap" value={value.contentCollection?.gap || ""} defaultUnit="px" onChange={(v)=>patch("contentCollection",{gap:v})}/></div>
      <TextControl label="Item shadow" value={value.contentCollection?.shadow || ""} placeholder="0 8px 24px rgba(0,0,0,.08)" onChange={(v)=>patch("contentCollection",{shadow:v})}/>
    </Group> : null}

    {has("icon") ? <Group title="Icon appearance">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Icon size" value={value.icon?.size || ""} defaultUnit="px" onChange={(v)=>patch("icon",{size:v})}/><CssLengthControl label="Icon gap" value={value.icon?.gap || ""} defaultUnit="px" onChange={(v)=>patch("icon",{gap:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Icon color" value={value.icon?.color} onChange={(v)=>patch("icon",{color:v})}/><SolidColor label="Icon background" value={value.icon?.background} fallback="#ffffff" onChange={(v)=>patch("icon",{background:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Padding" value={value.icon?.padding || ""} defaultUnit="px" onChange={(v)=>patch("icon",{padding:v})}/><CssLengthControl label="Radius" value={value.icon?.radius || ""} defaultUnit="px" onChange={(v)=>patch("icon",{radius:v})}/></div>
    </Group> : null}

    {has("accordion") ? <Group title="Accordion / disclosure">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Item background" value={value.accordion?.background} fallback="#ffffff" onChange={(v)=>patch("accordion",{background:v})}/><SolidColor label="Border" value={value.accordion?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("accordion",{borderColor:v})}/></div>
      <LengthPair aLabel="Radius" aValue={value.accordion?.radius} aChange={(v)=>patch("accordion",{radius:v})} bLabel="Padding" bValue={value.accordion?.padding} bChange={(v)=>patch("accordion",{padding:v})}/>
      <CssLengthControl label="Item gap" value={value.accordion?.itemGap || ""} defaultUnit="px" onChange={(v)=>patch("accordion",{itemGap:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Heading" value={value.accordion?.headerColor} onChange={(v)=>patch("accordion",{headerColor:v})}/><CssLengthControl label="Heading size" value={value.accordion?.headerSize || ""} defaultUnit="px" onChange={(v)=>patch("accordion",{headerSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Content" value={value.accordion?.contentColor} fallback="#4a4a4a" onChange={(v)=>patch("accordion",{contentColor:v})}/><CssLengthControl label="Content size" value={value.accordion?.contentSize || ""} defaultUnit="px" onChange={(v)=>patch("accordion",{contentSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Open background" value={value.accordion?.openBackground} fallback="#fafafa" onChange={(v)=>patch("accordion",{openBackground:v})}/><SolidColor label="Open border" value={value.accordion?.openBorderColor} fallback="#95BF47" onChange={(v)=>patch("accordion",{openBorderColor:v})}/></div>
    </Group> : null}

    {has("tabs") ? <Group title="Tabs">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Tab text" value={value.tabs?.color} onChange={(v)=>patch("tabs",{color:v})}/><SolidColor label="Tab background" value={value.tabs?.background} fallback="#ffffff" onChange={(v)=>patch("tabs",{background:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Active text" value={value.tabs?.activeColor} fallback="#ffffff" onChange={(v)=>patch("tabs",{activeColor:v})}/><SolidColor label="Active background" value={value.tabs?.activeBackground} fallback="#1a1a1a" onChange={(v)=>patch("tabs",{activeBackground:v})}/></div>
      <LengthPair aLabel="Padding X" aValue={value.tabs?.paddingX} aChange={(v)=>patch("tabs",{paddingX:v})} bLabel="Padding Y" bValue={value.tabs?.paddingY} bChange={(v)=>patch("tabs",{paddingY:v})}/>
      <CssLengthControl label="Tab radius" value={value.tabs?.radius || ""} defaultUnit="px" onChange={(v)=>patch("tabs",{radius:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Panel background" value={value.tabs?.panelBackground} fallback="#ffffff" onChange={(v)=>patch("tabs",{panelBackground:v})}/><SolidColor label="Panel text" value={value.tabs?.panelColor} onChange={(v)=>patch("tabs",{panelColor:v})}/></div>
      <LengthPair aLabel="Panel padding" aValue={value.tabs?.panelPadding} aChange={(v)=>patch("tabs",{panelPadding:v})} bLabel="Panel radius" bValue={value.tabs?.panelRadius} bChange={(v)=>patch("tabs",{panelRadius:v})}/>
    </Group> : null}

    {has("progress") ? <Group title="Progress / status">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Track" value={value.progress?.trackColor} fallback="#eeeeee" onChange={(v)=>patch("progress",{trackColor:v})}/><SolidColor label="Fill" value={value.progress?.fillColor} fallback="#95BF47" onChange={(v)=>patch("progress",{fillColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Height" value={value.progress?.height || ""} defaultUnit="px" onChange={(v)=>patch("progress",{height:v})}/><CssLengthControl label="Radius" value={value.progress?.radius || ""} defaultUnit="px" onChange={(v)=>patch("progress",{radius:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Label" value={value.progress?.labelColor} onChange={(v)=>patch("progress",{labelColor:v})}/><CssLengthControl label="Label size" value={value.progress?.labelSize || ""} defaultUnit="px" onChange={(v)=>patch("progress",{labelSize:v})}/></div>
    </Group> : null}

    {has("table") ? <Group title="Table">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Header background" value={value.table?.headerBackground} fallback="#f6f6f7" onChange={(v)=>patch("table",{headerBackground:v})}/><SolidColor label="Header text" value={value.table?.headerColor} onChange={(v)=>patch("table",{headerColor:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Cell text" value={value.table?.cellColor} onChange={(v)=>patch("table",{cellColor:v})}/><SolidColor label="Border" value={value.table?.borderColor} fallback="#e5e7eb" onChange={(v)=>patch("table",{borderColor:v})}/></div>
      <LengthPair aLabel="Cell padding" aValue={value.table?.cellPadding} aChange={(v)=>patch("table",{cellPadding:v})} bLabel="Table radius" bValue={value.table?.radius} bChange={(v)=>patch("table",{radius:v})}/>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Stripe" value={value.table?.stripeColor} fallback="#fafafa" onChange={(v)=>patch("table",{stripeColor:v})}/><SolidColor label="Row hover" value={value.table?.hoverColor} fallback="#f3f7ee" onChange={(v)=>patch("table",{hoverColor:v})}/></div>
    </Group> : null}

    {has("stats") ? <Group title="Numbers / stats">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Value" value={value.stats?.valueColor} onChange={(v)=>patch("stats",{valueColor:v})}/><CssLengthControl label="Value size" value={value.stats?.valueSize || ""} defaultUnit="px" onChange={(v)=>patch("stats",{valueSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Label" value={value.stats?.labelColor} fallback="#6d7175" onChange={(v)=>patch("stats",{labelColor:v})}/><CssLengthControl label="Label size" value={value.stats?.labelSize || ""} defaultUnit="px" onChange={(v)=>patch("stats",{labelSize:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Item background" value={value.stats?.itemBackground} fallback="#ffffff" onChange={(v)=>patch("stats",{itemBackground:v})}/><SolidColor label="Item border" value={value.stats?.itemBorderColor} fallback="#e5e7eb" onChange={(v)=>patch("stats",{itemBorderColor:v})}/></div>
      <LengthPair aLabel="Item radius" aValue={value.stats?.itemRadius} aChange={(v)=>patch("stats",{itemRadius:v})} bLabel="Item padding" bValue={value.stats?.itemPadding} bChange={(v)=>patch("stats",{itemPadding:v})}/>
    </Group> : null}

    {has("carousel") ? <Group title="Carousel spacing">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Slide gap" value={value.carousel?.gap || ""} defaultUnit="px" onChange={(v)=>patch("carousel",{gap:v})}/><CssLengthControl label="Slide width" value={value.carousel?.itemWidth || ""} defaultUnit="%" onChange={(v)=>patch("carousel",{itemWidth:v})}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Slide radius" value={value.carousel?.itemRadius || ""} defaultUnit="px" onChange={(v)=>patch("carousel",{itemRadius:v})}/><CssLengthControl label="Slide padding" value={value.carousel?.itemPadding || ""} defaultUnit="px" onChange={(v)=>patch("carousel",{itemPadding:v})}/></div>
    </Group> : null}

    {has("bar") ? <Group title="Bar layout">
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Min height" value={value.bar?.minHeight || ""} defaultUnit="px" onChange={(v)=>patch("bar",{minHeight:v})}/><CssLengthControl label="Letter spacing" value={value.bar?.letterSpacing || ""} defaultUnit="px" onChange={(v)=>patch("bar",{letterSpacing:v})}/></div>
      <LengthPair aLabel="Padding X" aValue={value.bar?.paddingX} aChange={(v)=>patch("bar",{paddingX:v})} bLabel="Padding Y" bValue={value.bar?.paddingY} bChange={(v)=>patch("bar",{paddingY:v})}/>
    </Group> : null}

    {has("divider") ? <Group title="Divider line">
      <div className="grid grid-cols-2 gap-2"><SolidColor label="Color" value={value.divider?.color} fallback="#e5e7eb" onChange={(v)=>patch("divider",{color:v})}/><SelectControl label="Style" value={value.divider?.style || "solid"} onChange={(v)=>patch("divider",{style:v})} options={["solid","dashed","dotted","double"]}/></div>
      <div className="grid grid-cols-2 gap-2"><CssLengthControl label="Thickness" value={value.divider?.width || ""} defaultUnit="px" onChange={(v)=>patch("divider",{width:v})}/><CssLengthControl label="Length" value={value.divider?.length || ""} defaultUnit="%" onChange={(v)=>patch("divider",{length:v})}/></div>
      <SelectControl label="Alignment" value={value.divider?.alignment || "left"} onChange={(v)=>patch("divider",{alignment:v})} options={["left","center","right"]}/>
    </Group> : null}
  </div>;
}
