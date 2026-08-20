import { normalizeEmailLogic } from "./emailLogic.js";
import { sanitizeEmailRichText } from "./emailRichText.js";

const BLOCK_TYPES = new Set(["logo","header","navbar","hero","section","columns","text","image","image-text","button","product","product-grid","order-summary","coupon","testimonial","social","divider","spacer","footer"]);

function id(prefix="email") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function str(value,fallback=""){const v=String(value??"").trim();return v||fallback;}
function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function safeObject(value){return value&&typeof value==="object"&&!Array.isArray(value)?{...value}:{};}
function normalizeAsset(input={}){const source=safeObject(input);const url=str(source.url||source.previewUrl,"");return {id:str(source.id,`asset-${Math.random().toString(36).slice(2,9)}`),name:str(source.name||source.fileName,"Image"),url,previewUrl:str(source.previewUrl||url,url),alt:str(source.alt,""),width:clamp(source.width,0,10000,0)||null,height:clamp(source.height,0,10000,0)||null,source:["shopify","url","library"].includes(source.source)?source.source:"library"};}
function normalizeVisibility(input={}){const source=safeObject(input);return {desktop:source.desktop!==false,mobile:source.mobile!==false};}
function normalizeProductItems(items){return (Array.isArray(items)?items:[]).slice(0,4).map((item)=>({title:str(item?.title,"Product"),price:str(item?.price,""),url:str(item?.url,"#"),image:str(item?.image,""),alt:str(item?.alt||item?.title,"Product")}));}
function normalizeColumns(columns){
  const rows=(Array.isArray(columns)?columns:[]).slice(0,3).map((column)=>({heading:str(column?.heading,""),text:str(column?.text,""),textHtml:sanitizeEmailRichText(column?.textHtml||""),image:str(column?.image,""),buttonText:str(column?.buttonText,""),buttonUrl:str(column?.buttonUrl,""),width:clamp(column?.width,10,90,0)}));
  if(rows.length<2)return createEmailBlock("columns").content.columns;
  const explicit=rows.every((row)=>Number(row.width)>0);
  if(!explicit){const width=Math.round(100/rows.length*100)/100;return rows.map((row,index)=>({...row,width:index===rows.length-1?Math.round((100-width*(rows.length-1))*100)/100:width}));}
  const total=rows.reduce((sum,row)=>sum+Number(row.width||0),0)||100;let used=0;return rows.map((row,index)=>{const width=index===rows.length-1?Math.max(10,Math.round((100-used)*100)/100):Math.max(10,Math.round((Number(row.width)/total*100)*100)/100);used+=width;return {...row,width};});
}

export const EMAIL_BLOCK_CATALOG = Object.freeze([
  {type:"logo",label:"Logo",description:"Brand mark with email-safe sizing",group:"Structure"},
  {type:"header",label:"Header",description:"Brand name or compact email header",group:"Structure"},
  {type:"navbar",label:"Navigation",description:"Compact navigation links for newsletters",group:"Structure"},
  {type:"hero",label:"Hero",description:"Large heading, copy and primary CTA",group:"Content"},
  {type:"section",label:"Section",description:"Contained content section with optional CTA",group:"Structure"},
  {type:"columns",label:"Columns",description:"Two or three responsive-friendly content columns",group:"Structure"},
  {type:"text",label:"Text",description:"Heading and rich text content",group:"Content"},
  {type:"image",label:"Image",description:"Email-safe responsive image",group:"Content"},
  {type:"image-text",label:"Image + Text",description:"Responsive split story block",group:"Content"},
  {type:"button",label:"Button",description:"Outlook-safe primary or secondary CTA",group:"Content"},
  {type:"testimonial",label:"Testimonial",description:"Quote, author and trust content",group:"Content"},
  {type:"product",label:"Product",description:"Dynamic Shopify product card",group:"Commerce"},
  {type:"product-grid",label:"Product Grid",description:"Two to four product recommendation cards",group:"Commerce"},
  {type:"order-summary",label:"Order Summary",description:"Dynamic order details and total",group:"Commerce"},
  {type:"coupon",label:"Coupon",description:"Promotion or discount code callout",group:"Commerce"},
  {type:"social",label:"Social Links",description:"Compact social/navigation links",group:"Content"},
  {type:"divider",label:"Divider",description:"Horizontal rule",group:"Utility"},
  {type:"spacer",label:"Spacer",description:"Vertical spacing",group:"Utility"},
  {type:"footer",label:"Footer",description:"Compliance, address and unsubscribe copy",group:"Structure"},
]);

export function createEmailBlock(type="text"){
  const t=BLOCK_TYPES.has(type)?type:"text";
  const base={id:id(t),type:t,content:{},style:{},logic:normalizeEmailLogic(),visibility:normalizeVisibility()};
  if(t==="logo")return {...base,content:{src:"",alt:"{{ shop.name }}",width:140},style:{align:"center",padding:"22px 28px 8px",background:"#ffffff",radius:0}};
  if(t==="header")return {...base,content:{text:"{{ shop.name }}"},style:{align:"center",fontSize:22,padding:"24px 28px 14px",background:"#ffffff"}};
  if(t==="navbar")return {...base,content:{links:[{label:"Shop",url:"{{ shop.url }}"},{label:"New arrivals",url:"{{ shop.url }}"},{label:"Contact",url:"{{ shop.url }}"}]},style:{align:"center",fontSize:13,padding:"10px 28px 18px",background:"#ffffff"}};
  if(t==="hero")return {...base,content:{heading:"Build a stronger customer relationship",text:"Use a concise message that gives customers one clear reason to act.",buttonText:"Shop now",buttonUrl:"{{ shop.url }}"},style:{align:"center",headingSize:34,fontSize:16,padding:"34px 32px",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8}};
  if(t==="section")return {...base,content:{heading:"Section heading",text:"Add supporting content for this part of the email.",buttonText:"Learn more",buttonUrl:"{{ shop.url }}"},style:{align:"left",headingSize:24,fontSize:16,padding:"26px 28px",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8}};
  if(t==="columns")return {...base,content:{columns:[{heading:"Column one",text:"Add concise supporting copy.",textHtml:"",buttonText:"Learn more",buttonUrl:"{{ shop.url }}",width:50},{heading:"Column two",text:"Add concise supporting copy.",textHtml:"",buttonText:"Learn more",buttonUrl:"{{ shop.url }}",width:50}],mobileStack:true},style:{gap:"8px",padding:"18px 28px",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8}};
  if(t==="text")return {...base,content:{heading:"Email heading",text:"Write your email content here."},style:{align:"left",fontSize:16,headingSize:26,padding:"22px 28px",background:"#ffffff"}};
  if(t==="image")return {...base,content:{src:"{{ product.image }}",alt:"{{ product.title }}",width:560},style:{align:"center",radius:0,padding:"12px 28px",background:"#ffffff"}};
  if(t==="image-text")return {...base,content:{image:"{{ product.image }}",heading:"Tell the product story",text:"Pair a visual with focused copy for a compact editorial section.",buttonText:"Explore",buttonUrl:"{{ product.url }}",imagePosition:"left"},style:{headingSize:24,fontSize:15,padding:"20px 28px",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8,radius:8}};
  if(t==="button")return {...base,content:{text:"Shop now",url:"{{ shop.url }}"},style:{align:"center",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8,fontSize:15,padding:"14px 28px"}};
  if(t==="testimonial")return {...base,content:{heading:"Customer story",text:"A short customer quote that builds confidence without overwhelming the message.",author:"Alex Morgan",role:"Verified customer"},style:{align:"left",headingSize:18,fontSize:17,padding:"24px 28px",background:"#f8fafc"}};
  if(t==="product")return {...base,content:{image:"{{ product.image }}",title:"{{ product.title }}",price:"{{ product.price }}",url:"{{ product.url }}",buttonText:"View product"},style:{padding:"18px 28px",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8}};
  if(t==="product-grid")return {...base,content:{heading:"Featured products",count:2,title:"{{ product.title }}",price:"{{ product.price }}",url:"{{ product.url }}",buttonText:"Shop collection"},style:{align:"center",headingSize:24,fontSize:14,padding:"24px 28px",background:"#ffffff",buttonBackground:"#111827",buttonColor:"#ffffff",buttonRadius:8}};
  if(t==="order-summary")return {...base,content:{heading:"Order summary",items:"{{ order.line_items }}",total:"{{ order.total_price }}"},style:{padding:"18px 28px",background:"#ffffff"}};
  if(t==="coupon")return {...base,content:{label:"Use code",code:"{{ discount.code }}"},style:{borderColor:"#9ca3af",padding:"18px 28px",background:"#ffffff"}};
  if(t==="social")return {...base,content:{links:[{label:"Instagram",url:"https://instagram.com"},{label:"Facebook",url:"https://facebook.com"}]},style:{align:"center",padding:"14px 28px",background:"#ffffff"}};
  if(t==="divider")return {...base,style:{color:"#e5e7eb",padding:"14px 28px",background:"#ffffff"}};
  if(t==="spacer")return {...base,content:{height:24},style:{background:"#ffffff"}};
  if(t==="footer")return {...base,content:{text:"{{ shop.name }} · You are receiving this email because you subscribed to updates.\nManage your email preferences at any time."},style:{align:"center",fontSize:12,padding:"22px 28px 28px",background:"#ffffff",color:"#6b7280"}};
  return base;
}

export function normalizeEmailBlock(input={}) {
  const type=BLOCK_TYPES.has(String(input.type||""))?String(input.type):"text";
  const content=safeObject(input.content);const style=safeObject(input.style);const logic=normalizeEmailLogic(input.logic||{});
  if(type==="columns"){content.columns=normalizeColumns(content.columns);content.mobileStack=content.mobileStack!==false;}
  if(["social","navbar"].includes(type))content.links=(Array.isArray(content.links)?content.links:[]).slice(0,8).map((link)=>({label:str(link?.label,"Link"),url:str(link?.url,"#")}));
  if(type==="product-grid"){content.count=clamp(content.count,2,4,2);content.items=normalizeProductItems(content.items);}
  if(["hero","section","text","testimonial","image-text","footer"].includes(type))content.textHtml=sanitizeEmailRichText(content.textHtml||"");
  const symbolId=String(input.symbolId||"").trim();const symbolName=symbolId?str(input.symbolName,"Reusable symbol"):"";
  return {id:str(input.id,id(type)),type,content,style,logic,visibility:normalizeVisibility(input.visibility),...(symbolId?{symbolId,symbolName}:{})};
}

function normalizeEmailSymbol(input={}) {
  const source=safeObject(input);const symbolId=String(source.id||source.symbolId||"").trim()||`symbol-${Math.random().toString(36).slice(2,9)}`;const name=str(source.name||source.symbolName,"Reusable symbol");const rawBlock=safeObject(source.block);
  return {id:symbolId,name,block:normalizeEmailBlock({...rawBlock,symbolId,symbolName:name})};
}

export function normalizeEmailDocument(input={}) {
  const source=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const settings=safeObject(source.settings);
  return {
    schemaVersion:4,
    settings:{
      backgroundColor:str(settings.backgroundColor,"#f4f4f5"),
      contentBackground:str(settings.contentBackground,"#ffffff"),
      contentWidth:clamp(settings.contentWidth,320,760,600),
      contentRadius:clamp(settings.contentRadius,0,32,0),
      baseFontSize:clamp(settings.baseFontSize,12,22,16),
      fontFamily:str(settings.fontFamily,"Arial, Helvetica, sans-serif"),
      textColor:str(settings.textColor,"#202223"),
      linkColor:str(settings.linkColor,"#166534"),
      darkModeEnabled:settings.darkModeEnabled!==false,
      darkBackgroundColor:str(settings.darkBackgroundColor,"#0f172a"),
      darkContentBackground:str(settings.darkContentBackground,"#111827"),
      darkTextColor:str(settings.darkTextColor,"#f3f4f6"),
      darkLinkColor:str(settings.darkLinkColor,"#b7dd70"),
    },
    assets:(Array.isArray(source.assets)?source.assets:[]).slice(0,120).map(normalizeAsset).filter((asset)=>asset.url),
    symbols:(Array.isArray(source.symbols)?source.symbols:[]).slice(0,50).map(normalizeEmailSymbol),
    blocks:(Array.isArray(source.blocks)?source.blocks:[]).slice(0,160).map(normalizeEmailBlock),
  };
}

export function blankEmailDocument() {
  return normalizeEmailDocument({blocks:[createEmailBlock("header"),createEmailBlock("text"),createEmailBlock("button"),createEmailBlock("footer")]});
}

export { BLOCK_TYPES as EMAIL_BLOCK_TYPES };
