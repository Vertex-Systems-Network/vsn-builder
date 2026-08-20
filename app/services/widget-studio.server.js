import { getWidgetDefinitions } from "./widget-settings.server.js";
import { parseVisualTemplate, validateVisualTemplate } from "../builder/visualTemplate.js";
import { registerVisualWidgetDefinitions } from "../sdk/visualWidgets.js";
import { listVsnFieldTypes } from "../sdk/registry.js";
import { VSN_WIDGET_FIELD_BASE_SET, widgetFieldDefault, widgetFieldUsesNumberRules, widgetFieldUsesOptions } from "../config/widget-field-types.js";
function parseJson(value,fallback){try{return JSON.parse(value??"");}catch{return fallback;}}
function slug(value){return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48);}
function finiteNumber(value){if(value===null||value===undefined||value==="")return undefined;const number=Number(value);return Number.isFinite(number)?number:undefined;}
function stringList(value,max=30){return Array.isArray(value)?value.slice(0,max).map((item)=>String(item).trim()).filter(Boolean):[];}
function normalizeDefault(value,baseType){
  if(value===undefined||value===null)return widgetFieldDefault(baseType);
  if(baseType==="toggle")return value===true||value==="true";
  if(baseType==="number"||baseType==="range"){const number=Number(value);return Number.isFinite(number)?number:0;}
  if(baseType==="multi-select")return stringList(value);
  if(["color-gradient","dimensions","border-radius","typography","media","icon"].includes(baseType))return value&&typeof value==="object"&&!Array.isArray(value)?value:widgetFieldDefault(baseType);
  return String(value);
}
function normalizeFields(value){
  const input=Array.isArray(value)?value:parseJson(value,[]);
  const seen=new Set();
  const sdkTypes=new Map(listVsnFieldTypes().map((row)=>[row.id,row]));
  return input.slice(0,40).map((row,index)=>{
    const key=String(row?.key||`field${index+1}`).trim().replace(/[^a-zA-Z0-9_.-]/g,"").slice(0,64);
    if(!key||seen.has(key))return null;
    seen.add(key);
    const requested=String(row?.type||"text");
    const type=VSN_WIDGET_FIELD_BASE_SET.has(requested)||sdkTypes.has(requested)?requested:"text";
    const baseType=sdkTypes.get(type)?.baseType||type;
    const normalized={key,label:String(row?.label||key).slice(0,100),type,help:String(row?.help||"").slice(0,240),default:normalizeDefault(row?.default,baseType)};
    if(widgetFieldUsesOptions(baseType)){normalized.options=stringList(row?.options,100);if(!normalized.options.length)normalized.options=["Option 1","Option 2"];}
    if(widgetFieldUsesNumberRules(baseType)){const min=finiteNumber(row?.min),max=finiteNumber(row?.max),step=finiteNumber(row?.step);if(min!==undefined)normalized.min=min;if(max!==undefined)normalized.max=max;if(step!==undefined)normalized.step=step;}
    if(["range","css-length","dimensions","border-radius"].includes(baseType)) normalized.unit=String(row?.unit||"px").slice(0,16);
    if(baseType==="css-length") normalized.keywords=stringList(row?.keywords);
    if(baseType==="media"){normalized.accept=String(row?.accept||"image/*").slice(0,100);normalized.mediaTypes=stringList(row?.mediaTypes,20);if(!normalized.mediaTypes.length)normalized.mediaTypes=["MediaImage"];}
    return normalized;
  }).filter(Boolean);
}
function serializeTemplate(row){return row?{id:row.id,widgetType:row.widgetType,html:row.html,css:row.css,enabled:row.enabled,updatedAt:row.updatedAt?.toISOString?.()||row.updatedAt}:null;}
function serializeCustom(row){return{ id:row.id,type:`vsn-custom-${row.id}`,widgetKey:row.widgetKey,name:row.name,category:row.category,icon:row.icon,description:row.description||"",fields:normalizeFields(parseJson(row.fieldsJson,[])),templateHtml:row.templateHtml,templateCss:row.templateCss,capabilities:parseJson(row.capabilitiesJson,{}),enabled:row.enabled,deletedAt:row.deletedAt?.toISOString?.()||null,updatedAt:row.updatedAt?.toISOString?.()||row.updatedAt };}
export function defaultWidgetTemplate(){return '<div {{vsn.root}} class="vsn-widget-template">\n  {{vsn.content}}\n</div>';}
export async function loadWidgetStudio(db,shop){const [templates,custom,trash]=await Promise.all([db.builderWidgetTemplate.findMany({where:{shop},orderBy:{updatedAt:"desc"}}),db.builderCustomWidget.findMany({where:{shop,deletedAt:null},orderBy:{updatedAt:"desc"}}),db.builderCustomWidget.findMany({where:{shop,deletedAt:{not:null}},orderBy:{deletedAt:"desc"}})]);return{widgets:getWidgetDefinitions().map((row)=>({id:row.id,name:row.name,category:row.category})),templates:templates.map(serializeTemplate),customWidgets:custom.map(serializeCustom),trash:trash.map(serializeCustom),counts:{templates:templates.length,custom:custom.length,trash:trash.length}};}
export async function loadWidgetTemplateMap(db,shop){const rows=await db.builderWidgetTemplate.findMany({where:{shop,enabled:true}}).catch(()=>[]);return Object.fromEntries(rows.map((row)=>[row.widgetType,serializeTemplate(row)]));}
export async function loadCustomWidgets(db,shop){const rows=await db.builderCustomWidget.findMany({where:{shop,deletedAt:null,enabled:true},orderBy:{updatedAt:"asc"}}).catch(()=>[]);return rows.map(serializeCustom);}
export async function saveWidgetTemplate(db,shop,{widgetType,html,css,enabled=true}){const definition=getWidgetDefinitions().find((row)=>row.id===widgetType);if(!definition)throw new Error("Select a registered VSN widget.");const checked=validateVisualTemplate(html,css,{requireContent:true});if(!checked.ok)throw new Error(checked.errors.join(" "));parseVisualTemplate(html);return serializeTemplate(await db.builderWidgetTemplate.upsert({where:{shop_widgetType:{shop,widgetType}},create:{shop,widgetType,html,css:String(css||""),enabled},update:{html,css:String(css||""),enabled}}));}
export async function resetWidgetTemplate(db,shop,widgetType){await db.builderWidgetTemplate.deleteMany({where:{shop,widgetType}});return{widgetType,html:defaultWidgetTemplate(),css:"",enabled:false};}
export async function saveCustomWidget(db,shop,input){const id=String(input.id||"").trim();const name=String(input.name||"").trim().slice(0,100);if(!name)throw new Error("Custom widget name is required.");const fields=normalizeFields(input.fields);const html=String(input.templateHtml||"").trim();const css=String(input.templateCss||"");const checked=validateVisualTemplate(html,css,{requireContent:false,fieldKeys:fields.map((row)=>row.key)});if(!checked.ok)throw new Error(checked.errors.join(" "));parseVisualTemplate(html);const widgetKey=slug(input.widgetKey||name);if(!widgetKey)throw new Error("Custom widget key is invalid.");const data={widgetKey,name,category:String(input.category||"Custom").trim().slice(0,80)||"Custom",icon:String(input.icon||"widgets").slice(0,40),description:String(input.description||"").slice(0,280)||null,fieldsJson:JSON.stringify(fields),templateHtml:html,templateCss:css,capabilitiesJson:JSON.stringify({acceptsChildren:false,...(input.capabilities||{})}),enabled:input.enabled!==false,deletedAt:null};let row;if(id){const existing=await db.builderCustomWidget.findFirst({where:{id,shop}});if(!existing)throw new Error("Custom widget not found for this store.");row=await db.builderCustomWidget.update({where:{id},data});}else row=await db.builderCustomWidget.create({data:{shop,...data}});return serializeCustom(row);}
export async function mutateCustomWidget(db,shop,{id,intent}){const row=await db.builderCustomWidget.findFirst({where:{id,shop}});if(!row)throw new Error("Custom widget not found.");if(intent==="trash")return serializeCustom(await db.builderCustomWidget.update({where:{id},data:{deletedAt:new Date()}}));if(intent==="restore")return serializeCustom(await db.builderCustomWidget.update({where:{id},data:{deletedAt:null}}));if(intent==="hard-delete"){await db.builderCustomWidget.delete({where:{id}});return{id,deleted:true};}if(intent==="toggle")return serializeCustom(await db.builderCustomWidget.update({where:{id},data:{enabled:!row.enabled}}));if(intent==="duplicate"){const fields=parseJson(row.fieldsJson,[]);return saveCustomWidget(db,shop,{name:`${row.name} Copy`,widgetKey:`${row.widgetKey}-copy-${Date.now().toString(36).slice(-4)}`,category:row.category,icon:row.icon,description:row.description,fields,templateHtml:row.templateHtml,templateCss:row.templateCss,enabled:true});}throw new Error("Unsupported custom widget action.");}
export { normalizeFields };

export async function loadStorefrontWidgetPlatform(db,shop){
  const [customWidgets,templates]=await Promise.all([loadCustomWidgets(db,shop),loadWidgetTemplateMap(db,shop)]);
  registerVisualWidgetDefinitions(customWidgets);
  return{customWidgets,templates};
}
