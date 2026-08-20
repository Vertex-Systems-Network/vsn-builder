import { useEffect, useMemo, useState } from "react";
import { Copy, Edit3, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  VsnButton,
  VsnCard,
  VsnCodeEditor,
  VsnEmpty,
  VsnInput,
  VsnModal,
  VsnNotice,
  VsnPage,
  VsnSelect,
  VsnTabs,
  VsnTextarea,
} from "../ui/VsnToolkit.jsx";
import {
  parseVisualTemplate,
  renderVisualTemplateHtml,
  scopeVisualTemplateCss,
  validateVisualTemplate,
} from "../../builder/visualTemplate.js";
import { VSN_WIDGET_FIELD_TYPES, VSN_WIDGET_FIELD_BASE_IDS, widgetFieldDefault, widgetFieldUsesNumberRules, widgetFieldUsesOptions } from "../../config/widget-field-types.js";

const DEFAULT_WIDGET_TEMPLATE = `<div {{vsn.root}} class="vsn-widget-template">
  {{vsn.content}}
</div>`;

function emptyCustomWidget() {
  return {
    id: "",
    widgetKey: "",
    name: "",
    category: "Custom",
    icon: "widgets",
    description: "",
    fields: [{ key: "title", label: "Title", type: "text", default: "Title", options: [] }],
    templateHtml: `<div {{vsn.root}} class="vsn-custom-card">
  <strong>{{title}}</strong>
</div>`,
    templateCss: ".vsn-custom-card { padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; }",
    enabled: true,
  };
}

function templateFor(rows, widgetType) {
  return rows.find((row) => row.widgetType === widgetType) || null;
}

function replaceById(rows, item) {
  const next = rows.filter((row) => row.id !== item.id);
  return [item, ...next];
}

function Preview({ html, css, props = {}, requireContent = false }) {
  const result = useMemo(() => {
    try {
      const checked = validateVisualTemplate(html, css, {
        requireContent,
        fieldKeys: Object.keys(props),
      });
      if (!checked.ok) return { error: checked.errors.join(" ") };
      const tree = parseVisualTemplate(html);
      return {
        html: renderVisualTemplateHtml(tree, {
          props,
          slotHtml: '<div class="vsn-template-preview-slot">Current VSN widget renderer</div>',
          templateKey: "studio-preview",
        }),
        css: scopeVisualTemplateCss(css, "studio-preview"),
        warnings: checked.warnings,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [html, css, props, requireContent]);

  return (
    <div className="vsn-widget-studio-preview">
      {result.error ? (
        <VsnNotice tone="critical">{result.error}</VsnNotice>
      ) : (
        <>
          <style>{result.css}</style>
          <div dangerouslySetInnerHTML={{ __html: result.html }} />
          {result.warnings?.length ? <small>{result.warnings.join(" · ")}</small> : null}
        </>
      )}
    </div>
  );
}


function splitList(value) {
  return String(value || "").split(/[\n,]/).map((item)=>item.trim()).filter(Boolean);
}

function FieldConfiguration({ field, baseType, onPatch }) {
  const defaultValue = field.default;
  const defaultString = defaultValue && typeof defaultValue === "object" ? "" : String(defaultValue ?? "");
  const objectDefault = defaultValue && typeof defaultValue === "object" && !Array.isArray(defaultValue) ? defaultValue : {};
  const patchDefault = (next) => onPatch({ default: { ...objectDefault, ...next } });
  const optionTypes = widgetFieldUsesOptions(baseType);
  const numberRules = widgetFieldUsesNumberRules(baseType);
  const unitOptions = <><option value="px">px</option><option value="%">%</option><option value="rem">rem</option><option value="em">em</option><option value="vw">vw</option><option value="vh">vh</option></>;
  return <div className="vsn-widget-field-config">
    <VsnInput label="Help text" value={field.help || ""} onChange={(event)=>onPatch({help:event.target.value})}/>
    {optionTypes ? <VsnTextarea label="Options" rows={3} value={(field.options || []).join("\n")} onChange={(event)=>onPatch({options:splitList(event.target.value)})}/> : null}
    {baseType === "toggle" ? <VsnSelect label="Default state" value={String(Boolean(defaultValue))} onChange={(event)=>onPatch({default:event.target.value === "true"})}><option value="false">Off</option><option value="true">On</option></VsnSelect> : null}
    {["text","textarea","url","date","datetime","time","select","radio","button-set"].includes(baseType) ? <VsnInput label="Default value" value={defaultString} onChange={(event)=>onPatch({default:event.target.value})}/> : null}
    {baseType === "multi-select" ? <VsnInput label="Default selected values" value={Array.isArray(defaultValue)?defaultValue.join(", "):""} onChange={(event)=>onPatch({default:splitList(event.target.value)})}/> : null}
    {numberRules ? <><VsnInput label="Default number" type="number" value={Number.isFinite(Number(defaultValue))?defaultValue:0} onChange={(event)=>onPatch({default:Number(event.target.value)||0})}/><VsnInput label="Minimum" type="number" value={field.min ?? ""} onChange={(event)=>onPatch({min:event.target.value===""?undefined:Number(event.target.value)})}/><VsnInput label="Maximum" type="number" value={field.max ?? ""} onChange={(event)=>onPatch({max:event.target.value===""?undefined:Number(event.target.value)})}/><VsnInput label="Step" type="number" value={field.step ?? (baseType === "range" ? 1 : "")} onChange={(event)=>onPatch({step:event.target.value===""?undefined:Number(event.target.value)})}/></> : null}
    {baseType === "color" ? <VsnInput label="Default color" type="color" value={String(defaultValue || "#000000")} onChange={(event)=>onPatch({default:event.target.value})}/> : null}
    {baseType === "color-gradient" ? <><VsnSelect label="Default fill type" value={objectDefault.type || "color"} onChange={(event)=>onPatch({default:event.target.value === "gradient" ? {type:"gradient",gradientType:"linear",from:"#ffffff",to:"#000000",angle:135} : {type:"color",color:objectDefault.color || "#000000"}})}><option value="color">Solid color</option><option value="gradient">Gradient</option></VsnSelect>{(objectDefault.type || "color") === "gradient" ? <><VsnSelect label="Gradient type" value={objectDefault.gradientType || "linear"} onChange={(event)=>patchDefault({type:"gradient",gradientType:event.target.value})}><option value="linear">Linear</option><option value="radial">Radial</option></VsnSelect><VsnInput label="Start color" type="color" value={objectDefault.from || "#ffffff"} onChange={(event)=>patchDefault({type:"gradient",from:event.target.value})}/><VsnInput label="End color" type="color" value={objectDefault.to || "#000000"} onChange={(event)=>patchDefault({type:"gradient",to:event.target.value})}/>{(objectDefault.gradientType || "linear") === "linear" ? <VsnInput label="Angle" type="number" min="0" max="360" value={objectDefault.angle ?? 135} onChange={(event)=>patchDefault({type:"gradient",angle:Number(event.target.value)||0})}/> : null}</> : <VsnInput label="Default solid color" type="color" value={objectDefault.color || "#000000"} onChange={(event)=>patchDefault({type:"color",color:event.target.value})}/>}</> : null}
    {["range","css-length","dimensions","border-radius"].includes(baseType) ? <VsnSelect label="Default unit" value={field.unit || "px"} onChange={(event)=>onPatch({unit:event.target.value})}>{unitOptions}</VsnSelect> : null}
    {baseType === "css-length" ? <><VsnInput label="Default CSS length" value={defaultString || "0px"} onChange={(event)=>onPatch({default:event.target.value})}/><VsnInput label="Allowed keywords" value={(field.keywords || []).join(", ")} placeholder="auto, inherit, fit-content" onChange={(event)=>onPatch({keywords:splitList(event.target.value)})}/></> : null}
    {baseType === "dimensions" ? <>{["top","right","bottom","left"].map((side)=><VsnInput key={side} label={`Default ${side}`} value={objectDefault[side] ?? ""} placeholder={`0${field.unit || "px"}`} onChange={(event)=>patchDefault({[side]:event.target.value})}/>)}</> : null}
    {baseType === "border-radius" ? <><VsnSelect label="Radius mode" value={objectDefault.mode || "all"} onChange={(event)=>patchDefault({mode:event.target.value})}><option value="all">Linked corners</option><option value="individual">Per corner</option></VsnSelect>{(objectDefault.mode || "all") === "individual" ? <>{[["topLeft","Top left"],["topRight","Top right"],["bottomRight","Bottom right"],["bottomLeft","Bottom left"]].map(([key,label])=><VsnInput key={key} label={label} value={objectDefault[key] ?? objectDefault.all ?? ""} placeholder={`0${field.unit || "px"}`} onChange={(event)=>patchDefault({[key]:event.target.value,mode:"individual"})}/>)}</> : <VsnInput label="Default radius" value={objectDefault.all ?? ""} placeholder={`0${field.unit || "px"}`} onChange={(event)=>patchDefault({all:event.target.value,mode:"all"})}/>}</> : null}
    {baseType === "typography" ? <><VsnInput label="Default font family" value={objectDefault.fontFamily || ""} placeholder="Inter, system-ui, sans-serif" onChange={(event)=>patchDefault({fontFamily:event.target.value})}/><VsnInput label="Default font size" value={objectDefault.fontSize || ""} placeholder="16px" onChange={(event)=>patchDefault({fontSize:event.target.value})}/><VsnSelect label="Default font weight" value={String(objectDefault.fontWeight || "400")} onChange={(event)=>patchDefault({fontWeight:event.target.value})}>{[100,200,300,400,500,600,700,800,900].map((weight)=><option key={weight} value={weight}>{weight}</option>)}</VsnSelect><VsnInput label="Default line height" value={objectDefault.lineHeight || ""} placeholder="1.5" onChange={(event)=>patchDefault({lineHeight:event.target.value})}/><VsnInput label="Default letter spacing" value={objectDefault.letterSpacing || ""} placeholder="0px" onChange={(event)=>patchDefault({letterSpacing:event.target.value})}/><VsnInput label="Default text color" type="color" value={objectDefault.color || "#1a1a1a"} onChange={(event)=>patchDefault({color:event.target.value})}/></> : null}
    {baseType === "media" ? <><VsnInput label="Accepted file types" value={field.accept || "image/*"} placeholder="image/*,video/*" onChange={(event)=>onPatch({accept:event.target.value})}/><VsnInput label="Shopify media types" value={(field.mediaTypes || ["MediaImage"]).join(", ")} placeholder="MediaImage, Video" onChange={(event)=>onPatch({mediaTypes:splitList(event.target.value)})}/><VsnInput label="Default media URL" value={objectDefault.url || ""} placeholder="Optional fallback URL" onChange={(event)=>patchDefault({url:event.target.value})}/><VsnInput label="Default alt text" value={objectDefault.altText || ""} onChange={(event)=>patchDefault({altText:event.target.value})}/></> : null}
    {baseType === "icon" ? <><VsnInput label="Default icon name" value={objectDefault.polarisType || "star"} placeholder="star" onChange={(event)=>patchDefault({polarisType:event.target.value})}/><VsnInput label="Default icon size" type="number" min="6" max="200" value={objectDefault.size ?? 20} onChange={(event)=>patchDefault({size:Number(event.target.value)||20})}/><VsnInput label="Default icon color" value={objectDefault.color || "currentColor"} placeholder="currentColor or #000000" onChange={(event)=>patchDefault({color:event.target.value})}/></> : null}
  </div>;
}

export function WidgetStudioPanel({ data = {}, actionData, submit, busy = false, confirmAction }) {
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState(data.templates || []);
  const [customWidgets, setCustomWidgets] = useState(data.customWidgets || []);
  const [trash, setTrash] = useState(data.trash || []);
  const [widgetType, setWidgetType] = useState(data.widgets?.[0]?.id || "");
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState(emptyCustomWidget());

  const current = templateFor(templates, widgetType);
  const [html, setHtml] = useState(current?.html || DEFAULT_WIDGET_TEMPLATE);
  const [css, setCss] = useState(current?.css || "");
  const [enabled, setEnabled] = useState(current?.enabled !== false);

  useEffect(() => setTemplates(data.templates || []), [data.templates]);
  useEffect(() => setCustomWidgets(data.customWidgets || []), [data.customWidgets]);
  useEffect(() => setTrash(data.trash || []), [data.trash]);

  useEffect(() => {
    if (!widgetType && data.widgets?.[0]?.id) setWidgetType(data.widgets[0].id);
  }, [data.widgets, widgetType]);

  useEffect(() => {
    const row = templateFor(templates, widgetType);
    setHtml(row?.html || DEFAULT_WIDGET_TEMPLATE);
    setCss(row?.css || "");
    setEnabled(row?.enabled !== false);
  }, [widgetType, templates]);

  useEffect(() => {
    if (!actionData?.ok || !actionData.item) return;
    const { intent, item } = actionData;
    if (intent === "save-template") {
      setTemplates((rows) => [item, ...rows.filter((row) => row.widgetType !== item.widgetType)]);
    } else if (intent === "reset-template") {
      setTemplates((rows) => rows.filter((row) => row.widgetType !== item.widgetType));
    } else if (intent === "save-custom") {
      setCustomWidgets((rows) => replaceById(rows, item));
      setTrash((rows) => rows.filter((row) => row.id !== item.id));
      setCustomOpen(false);
    } else if (intent === "duplicate") {
      setCustomWidgets((rows) => replaceById(rows, item));
    } else if (intent === "toggle") {
      setCustomWidgets((rows) => rows.map((row) => (row.id === item.id ? item : row)));
    } else if (intent === "trash") {
      setCustomWidgets((rows) => rows.filter((row) => row.id !== item.id));
      setTrash((rows) => replaceById(rows, item));
    } else if (intent === "restore") {
      setTrash((rows) => rows.filter((row) => row.id !== item.id));
      setCustomWidgets((rows) => replaceById(rows, item));
    } else if (intent === "hard-delete") {
      setTrash((rows) => rows.filter((row) => row.id !== item.id));
    }
  }, [actionData]);

  const editCustom = (row) => {
    setCustom({
      ...emptyCustomWidget(),
      ...row,
      fields: (row.fields || []).map((field) => ({ ...field, options: field.options || [], keywords:field.keywords || [], mediaTypes:field.mediaTypes || [] })),
    });
    setCustomOpen(true);
  };

  const customProps = useMemo(
    () => Object.fromEntries((custom.fields || []).map((field) => [field.key, field.default ?? ""])),
    [custom.fields],
  );

  const saveCustom = () => submit({
    intent: "save-custom",
    id: custom.id || "",
    widgetKey: custom.widgetKey || "",
    name: custom.name,
    category: custom.category,
    icon: custom.icon,
    description: custom.description,
    fields: JSON.stringify(custom.fields || []),
    templateHtml: custom.templateHtml,
    templateCss: custom.templateCss,
    enabled: String(custom.enabled !== false),
  });

  const sdk = data.sdk || {};
  const sdkFieldTypes = sdk.fieldTypes || [];
  const fieldTypeOptions = [
    ...VSN_WIDGET_FIELD_TYPES,
    ...sdkFieldTypes.filter((row) => !VSN_WIDGET_FIELD_BASE_IDS.includes(row.id)).map((row) => ({ id:row.id, label:`${row.label} · SDK`, group:"SDK", baseType:row.baseType })),
  ];
  const fieldBaseType = (type) => sdkFieldTypes.find((row) => row.id === type)?.baseType || type;
  const fieldTypeGroups = [...new Set(fieldTypeOptions.map((row)=>row.group || "Other"))];
  const tabItems = [
    { value: "templates", label: "Template Lab", count: templates.length },
    { value: "custom", label: "Custom Widgets", count: customWidgets.length },
    { value: "sdk", label: "SDK 2.0" },
  ];

  return (
    <VsnPage
      title="Widget Studio"
      subtitle="Build reusable widget templates, create custom widgets visually, and extend the editor through SDK 2.0."
      actions={(
        <VsnButton variant="primary" onClick={() => { setCustom(emptyCustomWidget()); setCustomOpen(true); }}>
          <Plus size={14} />Create widget
        </VsnButton>
      )}
    >
      {actionData?.message ? (
        <VsnNotice tone={actionData.ok === false ? "critical" : "success"}>{actionData.message}</VsnNotice>
      ) : actionData?.error ? (
        <VsnNotice tone="critical">{actionData.error}</VsnNotice>
      ) : null}

      <VsnTabs value={tab} onChange={setTab} items={tabItems} />

      {tab === "templates" ? (
        <div className="vsn-widget-studio-grid">
          <VsnCard
            title="Widget Template Lab"
            subtitle="Override presentation without replacing the widget's data, controls, or business logic."
          >
            <VsnSelect label="Widget" value={widgetType} onChange={(event) => setWidgetType(event.target.value)}>
              {(data.widgets || []).map((row) => (
                <option key={row.id} value={row.id}>{row.category} · {row.name}</option>
              ))}
            </VsnSelect>
            <VsnNotice tone="info">
              <b>Protected:</b> keep <code>{"{{vsn.root}}"}</code> on the root and <code>{"{{vsn.content}}"}</code> where the current renderer must appear. JavaScript is not allowed here.
            </VsnNotice>
            <VsnCodeEditor label="Template HTML" language="html" rows={15} value={html} onChange={setHtml} />
            <VsnCodeEditor label="Scoped CSS" language="css" rows={10} value={css} onChange={setCss} />
            <label className="vsn-switch-row">
              <span><b>Enable override</b><small>Fallback remains the native VSN renderer.</small></span>
              <button type="button" role="switch" aria-checked={enabled} className={`vsn-toggle ${enabled ? "is-on" : ""}`} onClick={() => setEnabled(!enabled)}><span /></button>
            </label>
            <div className="vsn-row-actions">
              <VsnButton
                variant="primary"
                loading={busy}
                onClick={() => submit({ intent:"save-template", widgetType, html, css, enabled:String(enabled) })}
              >
                Save override
              </VsnButton>
              <VsnButton
                disabled={!current}
                onClick={() => confirmAction?.({
                  title: "Reset widget template?",
                  message: "This removes the override and restores the native VSN renderer.",
                  confirmLabel: "Reset",
                  onConfirm: () => submit({ intent:"reset-template", widgetType }),
                })}
              >
                <RotateCcw size={14} />Reset
              </VsnButton>
            </div>
          </VsnCard>
          <VsnCard title="Live preview" subtitle="Validated with the same safe template parser used in the editor and storefront.">
            <Preview html={html} css={css} requireContent />
          </VsnCard>
        </div>
      ) : null}

      {tab === "custom" ? (
        <VsnCard title="Custom Widgets" subtitle="Merchant-created widgets use the same registry and shared render contracts as built-in widgets.">
          {customWidgets.length ? (
            <div className="vsn-widget-studio-list">
              {customWidgets.map((row) => (
                <article key={row.id}>
                  <div><strong>{row.name}</strong><span>{row.category} · {row.fields?.length || 0} fields</span><small>{row.type}</small></div>
                  <span className={`vsn-status-pill ${row.enabled ? "success" : "neutral"}`}>{row.enabled ? "Active" : "Disabled"}</span>
                  <div className="vsn-row-actions">
                    <VsnButton onClick={() => editCustom(row)}><Edit3 size={13} />Edit</VsnButton>
                    <VsnButton onClick={() => submit({ intent:"duplicate", id:row.id })}><Copy size={13} />Duplicate</VsnButton>
                    <VsnButton onClick={() => submit({ intent:"toggle", id:row.id })}>{row.enabled ? "Disable" : "Enable"}</VsnButton>
                    <VsnButton
                      tone="critical"
                      onClick={() => confirmAction?.({
                        title: "Move widget to Trash?",
                        message: "Existing page data is preserved, but the widget will no longer be available for new insertion.",
                        confirmLabel: "Move to Trash",
                        onConfirm: () => submit({ intent:"trash", id:row.id }),
                      })}
                    >
                      <Trash2 size={13} />Trash
                    </VsnButton>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <VsnEmpty
              title="No custom widgets yet"
              description="Create a widget with fields, safe HTML and scoped CSS. It will appear in the editor after saving."
              action={<VsnButton variant="primary" onClick={() => { setCustom(emptyCustomWidget()); setCustomOpen(true); }}>Create widget</VsnButton>}
            />
          )}

          {trash.length ? (
            <details className="vsn-widget-studio-trash">
              <summary>Trash · {trash.length}</summary>
              {trash.map((row) => (
                <div key={row.id}>
                  <span>{row.name}</span>
                  <div className="vsn-row-actions">
                    <VsnButton onClick={() => submit({ intent:"restore", id:row.id })}>Restore</VsnButton>
                    <VsnButton
                      tone="critical"
                      onClick={() => confirmAction?.({
                        title: "Permanently delete widget?",
                        message: "This action cannot be undone.",
                        requireText: "DELETE",
                        confirmLabel: "Delete permanently",
                        onConfirm: () => submit({ intent:"hard-delete", id:row.id }),
                      })}
                    >
                      Delete permanently
                    </VsnButton>
                  </div>
                </div>
              ))}
            </details>
          ) : null}
        </VsnCard>
      ) : null}

      {tab === "sdk" ? (
        <div className="vsn-two-column-grid">
          <VsnCard title="SDK 2.0 extension points" subtitle="Theme/app developers use one extension architecture instead of parallel registries.">
            <div className="vsn-sdk-extension-grid">
              {[
                ["Widgets", sdk.widgets],
                ["Categories", sdk.categories],
                ["Field types", sdk.fieldTypes],
                ["Controls", sdk.controls],
                ["Data providers", sdk.providers],
                ["Template types", sdk.templateTypes],
                ["Inspector panels", sdk.inspectorPanels],
              ].map(([label, rows]) => <div key={label}><span>{label}</span><strong>{rows?.length || 0}</strong></div>)}
            </div>
          </VsnCard>
          <VsnCard title="Plugin contract" subtitle="Extensions are namespaced, permission-gated, versioned, and rollback-safe during plugin upgrades.">
            <p className="vsn-helper-copy">
              SDK 2.0 supports <code>registerWidget</code>, <code>registerCategory</code>, <code>registerFieldType</code>, <code>registerControl</code>, <code>registerDataProvider</code>, <code>registerTemplateType</code> and <code>registerInspectorPanel</code>.
            </p>
            <div className="vsn-sdk-chip-list">
              {(sdk.plugins || []).map((row) => <span key={row.manifest.id}>{row.manifest.name} · {row.status}</span>)}
            </div>
          </VsnCard>
        </div>
      ) : null}

      <VsnModal
        open={customOpen}
        title={custom.id ? "Edit custom widget" : "Create custom widget"}
        subtitle="Define fields and safe presentation. JavaScript remains an SDK responsibility."
        onClose={() => !busy && setCustomOpen(false)}
        size="xl"
        footer={(
          <>
            <VsnButton onClick={() => setCustomOpen(false)}>Cancel</VsnButton>
            <VsnButton variant="primary" loading={busy} disabled={!custom.name.trim()} onClick={saveCustom}>Save widget</VsnButton>
          </>
        )}
      >
        <div className="vsn-widget-studio-grid">
          <div className="vsn-widget-studio-form">
            <VsnInput label="Widget name" value={custom.name} onChange={(event) => setCustom({ ...custom, name:event.target.value })} />
            <VsnInput label="Category" value={custom.category} onChange={(event) => setCustom({ ...custom, category:event.target.value })} />
            <VsnTextarea label="Description" rows={3} value={custom.description} onChange={(event) => setCustom({ ...custom, description:event.target.value })} />
            <VsnCard
              title="Fields"
              actions={(
                <VsnButton onClick={() => setCustom({
                  ...custom,
                  fields: [...(custom.fields || []), { key:`field${(custom.fields || []).length + 1}`, label:"Field", type:"text", default:"", help:"", options:[] }],
                })}>
                  <Plus size={13} />Field
                </VsnButton>
              )}
            >
              {(custom.fields || []).map((field, index) => {
                const baseType = fieldBaseType(field.type);
                const patchField = (patch) => { const fields=[...custom.fields]; fields[index]={...field,...patch}; setCustom({...custom,fields}); };
                const removeField = () => setCustom({...custom,fields:custom.fields.filter((_,fieldIndex)=>fieldIndex!==index)});
                return <div key={`${field.key}-${index}`} className="vsn-widget-field-card">
                  <div className="vsn-widget-field-card-head">
                    <div className="vsn-widget-field-core">
                      <VsnInput label="Key" value={field.key} onChange={(event)=>patchField({key:event.target.value})}/>
                      <VsnInput label="Label" value={field.label} onChange={(event)=>patchField({label:event.target.value})}/>
                      <VsnSelect label="Field type" value={field.type} onChange={(event)=>{ const nextType=event.target.value; const nextBase=fieldBaseType(nextType); patchField({type:nextType,default:widgetFieldDefault(nextBase),options:widgetFieldUsesOptions(nextBase)?(field.options?.length?field.options:["Option 1","Option 2"]):[],min:undefined,max:undefined,step:undefined,unit:["range","css-length","dimensions","border-radius"].includes(nextBase)?"px":undefined,keywords:nextBase==="css-length"?["auto"]:[],accept:nextBase==="media"?"image/*":undefined,mediaTypes:nextBase==="media"?["MediaImage"]:undefined});}}>
                        {fieldTypeGroups.map((group)=><optgroup key={group} label={group}>{fieldTypeOptions.filter((row)=>(row.group||"Other")===group).map((type)=><option key={type.id} value={type.id}>{type.label}</option>)}</optgroup>)}
                      </VsnSelect>
                    </div>
                    <button type="button" className="vsn-mini-danger" onClick={removeField} aria-label={`Remove ${field.label || field.key}`} title="Remove field"><Trash2 size={16}/></button>
                  </div>
                  <FieldConfiguration field={field} baseType={baseType} onPatch={patchField}/>
                </div>;
              })}
            </VsnCard>
            <VsnCodeEditor label="Widget HTML" language="html" rows={12} value={custom.templateHtml} onChange={(value) => setCustom({...custom,templateHtml:value})} />
            <VsnCodeEditor label="Scoped CSS" language="css" rows={8} value={custom.templateCss} onChange={(value) => setCustom({...custom,templateCss:value})} />
          </div>
          <VsnCard title="Live widget preview"><Preview html={custom.templateHtml} css={custom.templateCss} props={customProps} /></VsnCard>
        </div>
      </VsnModal>
    </VsnPage>
  );
}
