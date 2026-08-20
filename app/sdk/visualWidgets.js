import { parseVisualTemplate, renderVisualTemplateHtml, visualTemplateTreeToDescriptor, scopeVisualTemplateCss } from "../builder/visualTemplate.js";
import { listVsnFieldTypes, registerVsnWidget, unregisterVsnWidget } from "./registry.js";
import { VSN_WIDGET_FIELD_BASE_SET, widgetFieldDefault, widgetFieldUsesOptions } from "../config/widget-field-types.js";

const registered = new Set();

function controlForField(field) {
  const extension = listVsnFieldTypes().find((row)=>row.id===field?.type);
  const type = VSN_WIDGET_FIELD_BASE_SET.has(field?.type) ? field.type : (extension?.baseType || "text");
  const control = {
    key:field.key,
    type,
    sdkFieldType:extension?.id || undefined,
    label:field.label || field.key,
    help:field.help || "",
    default:field.default ?? widgetFieldDefault(type),
  };
  if (widgetFieldUsesOptions(type)) control.options = (field.options || []).map((value)=>({value:String(value),label:String(value)}));
  for (const key of ["min","max","step","unit","keywords","accept","mediaTypes"]) if (field[key] !== undefined) control[key] = field[key];
  return control;
}

function defaults(fields=[]) {
  return Object.fromEntries(fields.map((field)=>{
    const extension=listVsnFieldTypes().find((row)=>row.id===field?.type);
    const type=VSN_WIDGET_FIELD_BASE_SET.has(field?.type)?field.type:(extension?.baseType||"text");
    return [field.key,field.default ?? widgetFieldDefault(type)];
  }));
}

export function registerVisualWidgetDefinitions(rows=[]) {
  const active = new Set();
  for (const row of rows || []) {
    if (!row?.enabled || !row?.type) continue;
    active.add(row.type);
    const tree = parseVisualTemplate(row.templateHtml);
    const renderers = {
      editor: ({node}) => visualTemplateTreeToDescriptor(tree,{props:node?.props||{},templateKey:row.type}),
      storefront: ({node}) => { const css=scopeVisualTemplateCss(row.templateCss||"",row.type); const html=renderVisualTemplateHtml(tree,{props:node?.props||{},templateKey:row.type}); return `${css?`<style data-vsn-custom-widget-style="${row.type}">${css}</style>`:""}${html}`; },
    };
    registerVsnWidget({
      id:row.type,
      label:row.name || "Custom Widget",
      category:row.category || "Custom",
      acceptsChildren:false,
      defaults:{props:defaults(row.fields),styles:{}},
      controls:(row.fields||[]).map(controlForField),
      capabilities:{background:true,border:true,spacing:true,responsive:true,visibility:true,customCss:true,...(row.capabilities||{})},
      styleProfile:{groups:["background","border","spacing","responsive","advanced"]},
      renderers,
    },{pluginId:"vsn.core",pluginVersion:"2.0.0",permissions:["editor:controls","editor:preview","storefront:render"]});
    registered.add(row.type);
  }
  for (const id of [...registered]) if (!active.has(id)) { unregisterVsnWidget(id,{pluginId:"vsn.core"}); registered.delete(id); }
  return active;
}

export function visualWidgetCss(rows=[]) {
  return (rows||[]).filter((row)=>row?.enabled&&row?.templateCss).map((row)=>scopeVisualTemplateCss(row.templateCss,row.type)).filter(Boolean).join("\n");
}
