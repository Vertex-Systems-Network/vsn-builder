import { blankEmailDocument, normalizeEmailBlock, normalizeEmailDocument } from "../email/emailSchema.js";
import { EMAIL_MARKETPLACE_CATALOG, findEmailMarketplaceTemplate } from "../email/emailMarketplace.js";
import { renderEmailHtml, renderEmailPlainText } from "./email-renderer.server.js";
import { renderEmailMjml } from "../email/emailMjml.js";
import { analyzeEmailCompatibility } from "../email/emailCompatibility.js";

function clone(value){return JSON.parse(JSON.stringify(value));}
function parse(value,fallback={}){try{const v=typeof value==="string"?JSON.parse(value):value;return v&&typeof v==="object"?v:fallback;}catch{return fallback;}}

function starter(key,name,category,subject,preheader,blocks){return Object.freeze({key,name,category,subject,preheader,document:normalizeEmailDocument({blocks})});}
export const EMAIL_STARTERS=Object.freeze([
  starter("welcome","Welcome","Lifecycle","Welcome to {{ shop.name }}","A warm welcome from {{ shop.name }}.",[
    {type:"header",content:{text:"{{ shop.name }}"},style:{align:"center"}},
    {type:"hero",content:{heading:"Welcome — we’re glad you’re here",text:"Thanks for joining us. Explore what’s new and find something made for you.",buttonText:"Visit store",buttonUrl:"{{ shop.url }}"}},
    {type:"footer",content:{text:"{{ shop.name }} · Manage your email preferences at any time."}},
  ]),
  starter("newsletter","Newsletter","Newsletter","This week at {{ shop.name }}","News, ideas and highlights from {{ shop.name }}.",[
    {type:"header",content:{text:"{{ shop.name }}"}},
    {type:"text",content:{heading:"What’s new this week",text:"Use this layout for editorial updates, announcements and featured stories."}},
    {type:"divider"},{type:"button",content:{text:"Read more",url:"{{ shop.url }}"}},{type:"footer",content:{text:"You’re receiving this because you subscribed to {{ shop.name }} updates."}},
  ]),
  starter("promotion","Promotion","Marketing","A special offer for you","Limited-time savings from {{ shop.name }}.",[
    {type:"hero",content:{heading:"A limited-time offer",text:"Highlight the value clearly, keep the message focused, and give customers one strong action.",buttonText:"Shop the offer",buttonUrl:"{{ shop.url }}"}},
    {type:"coupon",content:{label:"Use code",code:"SAVE10"}},{type:"footer",content:{text:"Terms and availability may apply."}},
  ]),
  starter("product-launch","Product launch","Marketing","Introducing {{ product.title }}","Meet the newest addition to {{ shop.name }}.",[
    {type:"header",content:{text:"{{ shop.name }}"}},{type:"text",content:{heading:"Meet something new",text:"Introduce the product with one clear benefit and a concise launch story."}},{type:"product",content:{title:"{{ product.title }}",price:"{{ product.price }}",url:"{{ product.url }}",buttonText:"View product"}},{type:"footer",content:{text:"{{ shop.name }}"}},
  ]),
  starter("abandoned-cart","Abandoned cart","Commerce","Still thinking it over?","Your cart is waiting.",[
    {type:"text",content:{heading:"Your cart is still here",text:"Return to your cart when you’re ready."}},{type:"button",content:{text:"Return to cart",url:"{{ cart.url }}"}},{type:"footer",content:{text:"Need help? Reply to this email and our team can assist."}},
  ]),
  starter("order-update","Order update","Transactional","Update for order {{ order.name }}","The latest information about your order.",[
    {type:"header",content:{text:"{{ shop.name }}"}},{type:"text",content:{heading:"Your order has an update",text:"Order {{ order.name }} is moving forward."}},{type:"order-summary"},{type:"footer",content:{text:"Questions about your order? Contact {{ shop.email }}."}},
  ]),
  starter("back-in-stock","Back in stock","Commerce","Back in stock: {{ product.title }}","The item you wanted is available again.",[
    {type:"text",content:{heading:"It’s back",text:"Good news — the product you were watching is available again."}},{type:"product",content:{title:"{{ product.title }}",price:"{{ product.price }}",url:"{{ product.url }}",buttonText:"Shop now"}},{type:"footer",content:{text:"Availability can change quickly."}},
  ]),
]);

function serialize(row,versions=[]){const document=normalizeEmailDocument(parse(row.documentJson,blankEmailDocument()));const compiledHtml=renderEmailHtml(document,{subject:row.subject,preheader:row.preheader});const plainText=row.plainText||renderEmailPlainText(document);return {...row,document,versions,compiledHtml,plainText,mjmlSource:renderEmailMjml(document,{subject:row.subject,preheader:row.preheader}),compatibility:analyzeEmailCompatibility(document,{subject:row.subject,preheader:row.preheader,html:compiledHtml})};}

function revisionPageId(id){return `email:${String(id||"")}`;}
function serializeEmailRevision(row){const snapshot=parse(row?.contentJson,{});const document=normalizeEmailDocument(parse(snapshot.documentJson||snapshot.document||{},blankEmailDocument()));return {id:row.id,label:row.label||"Saved version",createdAt:row.createdAt,createdBy:row.createdBy||null,meta:{name:String(snapshot.name||"Untitled email"),category:String(snapshot.category||"Custom"),subject:String(snapshot.subject||""),preheader:String(snapshot.preheader||""),status:String(snapshot.status||"draft")},document};}
export async function captureEmailRevision(db,shop,row,{label="Before save",createdBy=null}={}){if(!row?.id)return null;return db.builderRevision.create({data:{shop,pageId:revisionPageId(row.id),title:row.name||"Email template",contentJson:JSON.stringify({name:row.name,category:row.category,subject:row.subject,preheader:row.preheader,status:row.status,documentJson:row.documentJson}),kind:"email-save",label:String(label||"Before save").slice(0,120),createdBy:createdBy?String(createdBy).slice(0,160):null}}).catch((error)=>{console.warn("VSN Email version snapshot unavailable:",error instanceof Error?error.message:error);return null;});}
async function loadEmailVersions(db,shop){const rows=await db.builderRevision.findMany({where:{shop,kind:"email-save",pageId:{startsWith:"email:"}},orderBy:{createdAt:"desc"},take:320}).catch(()=>[]);const map=new Map();for(const row of rows){const id=String(row.pageId||"").replace(/^email:/,"");if(!id)continue;const list=map.get(id)||[];if(list.length<20)list.push(serializeEmailRevision(row));map.set(id,list);}return map;}
function serializeSavedBlock(row){return {id:row.id,name:row.title,category:row.category||"Email blocks",block:normalizeEmailBlock(parse(row.contentJson,{})),updatedAt:row.updatedAt,createdAt:row.createdAt};}
export async function listEmailSavedBlocks(db,shop){const rows=await db.builderLibraryItem.findMany({where:{shop,kind:"email-block",templateType:"email",source:"local",deletedAt:null},orderBy:[{isFavorite:"desc"},{updatedAt:"desc"}],take:120}).catch(()=>[]);return rows.map(serializeSavedBlock);}
export async function saveEmailReusableBlock(db,shop,{name,block,createdBy=null}={}){const normalized=normalizeEmailBlock(parse(block,{}));const row=await db.builderLibraryItem.create({data:{shop,title:String(name||`${normalized.type} block`).trim().slice(0,120)||"Email block",kind:"email-block",category:"Email blocks",syncMode:"local",contentJson:JSON.stringify(normalized),templateType:"email",source:"local",createdBy:createdBy?String(createdBy).slice(0,160):null,description:`Reusable Email Studio ${normalized.type} block`}});return serializeSavedBlock(row);}
export async function deleteEmailReusableBlock(db,shop,id){const result=await db.builderLibraryItem.updateMany({where:{id:String(id||""),shop,kind:"email-block",templateType:"email"},data:{deletedAt:new Date()}});return {deleted:result.count>0,id:String(id||"")};}
function serializeMarketplaceTemplate(item){const document=normalizeEmailDocument(item.document);const compiledHtml=renderEmailHtml(document,{subject:item.subject,preheader:item.preheader});return {...item,id:`email-market:${item.key}`,name:item.title,marketplace:true,document,compiledHtml,plainText:renderEmailPlainText(document),mjmlSource:renderEmailMjml(document,{subject:item.subject,preheader:item.preheader}),compatibility:analyzeEmailCompatibility(document,{subject:item.subject,preheader:item.preheader,html:compiledHtml})};}

export function serializeEmailStarter(item){const document=clone(item.document);const compiledHtml=renderEmailHtml(document,{subject:item.subject,preheader:item.preheader});return {...item,id:`starter:${item.key}`,starter:true,compiledHtml,plainText:renderEmailPlainText(document),mjmlSource:renderEmailMjml(document,{subject:item.subject,preheader:item.preheader}),compatibility:analyzeEmailCompatibility(document,{subject:item.subject,preheader:item.preheader,html:compiledHtml})};}

export async function listEmailBuilder(db,shop){
  const [rows,versionMap,savedBlocks]=await Promise.all([db.builderEmailTemplate.findMany({where:{shop},orderBy:{updatedAt:"desc"}}),loadEmailVersions(db,shop),listEmailSavedBlocks(db,shop)]);
  const templates=rows.filter((row)=>!row.deletedAt).map((row)=>serialize(row,versionMap.get(row.id)||[])),trash=rows.filter((row)=>row.deletedAt).map((row)=>serialize(row,versionMap.get(row.id)||[])),starters=EMAIL_STARTERS.map(serializeEmailStarter),marketplace=EMAIL_MARKETPLACE_CATALOG.map(serializeMarketplaceTemplate);
  return {templates,trash,starters,marketplace,savedBlocks,counts:{templates:templates.length,starters:starters.length,marketplace:marketplace.length,savedBlocks:savedBlocks.length,trash:trash.length,total:templates.length+starters.length+marketplace.length},renderer:{schemaVersion:4,mode:"email-studio-22",mjmlExport:true,darkModePreview:true,compatibilityDiagnostics:true,assetManager:true,richText:true,conditions:true,repeats:true,resizableColumns:true,reusableSymbols:true,savedBlocks:true,responsiveVisibility:true,versionHistory:true,commerceBrowser:true,templateMarketplace:true,aiFoundation:true}};
}

export function compileEmailTemplateInput(input={}){
  const document=normalizeEmailDocument(parse(input.document,blankEmailDocument()));
  const name=String(input.name||"Untitled email").trim().slice(0,140)||"Untitled email";
  const category=String(input.category||"Custom").trim().slice(0,80)||"Custom";
  const subject=String(input.subject||name).trim().slice(0,200)||name;
  const preheader=String(input.preheader||"").trim().slice(0,300);
  return {name,category,subject,preheader,documentJson:JSON.stringify(document),compiledHtml:renderEmailHtml(document,{subject,preheader}),plainText:renderEmailPlainText(document),status:String(input.status||"draft")==="ready"?"ready":"draft"};
}

export function starterInput(key){
  const marketplaceKey=String(key||"").replace(/^marketplace:/,"");const market=String(key||"").startsWith("marketplace:")?findEmailMarketplaceTemplate(marketplaceKey):null;
  if(market)return compileEmailTemplateInput({name:market.title,category:market.category,subject:market.subject,preheader:market.preheader,document:market.document});
  const item=EMAIL_STARTERS.find((entry)=>entry.key===key);
  if(!item)return compileEmailTemplateInput({name:"Untitled email",category:"Custom",subject:"Untitled email",document:blankEmailDocument()});
  return compileEmailTemplateInput({name:item.name,category:item.category,subject:item.subject,preheader:item.preheader,document:item.document});
}


function money(amount,currency){
  const value=Number(amount);if(!Number.isFinite(value))return String(amount||"");
  try{return new Intl.NumberFormat("en",{style:"currency",currency:String(currency||"USD")}).format(value);}catch{return `${value.toFixed(2)} ${currency||""}`.trim();}
}

export async function loadEmailPreviewBindings(admin,shop){
  const bindings={shop:{url:`https://${shop}`,domain:shop}};let live=false;
  if(!admin?.graphql)return {bindings,meta:{live:false,sources:[]}};
  const sources=[];
  try{
    const response=await admin.graphql(`#graphql\nquery VsnEmailPreviewShop { shop { name email myshopifyDomain primaryDomain { url host } } }`);
    const payload=await response.json();const row=payload?.data?.shop;
    if(row){bindings.shop={name:row.name||"Your Store",email:row.email||"",url:row.primaryDomain?.url||`https://${row.myshopifyDomain||shop}`,domain:row.primaryDomain?.host||row.myshopifyDomain||shop};sources.push("shop");live=true;}
  }catch(error){console.warn("VSN Email Builder preview shop data unavailable:",error instanceof Error?error.message:error);}
  try{
    const response=await admin.graphql(`#graphql\nquery VsnEmailPreviewProduct { products(first: 4, sortKey: UPDATED_AT, reverse: true) { nodes { title handle featuredImage { url } priceRangeV2 { minVariantPrice { amount currencyCode } } } } }`);
    const payload=await response.json();const rows=payload?.data?.products?.nodes||[];
    const products=rows.map((row)=>{const price=row.priceRangeV2?.minVariantPrice;return {title:row.title||"Featured Product",handle:row.handle||"",price:money(price?.amount,price?.currencyCode),url:`${bindings.shop?.url||`https://${shop}`}/products/${row.handle||""}`,image:row.featuredImage?.url||""};});
    if(products.length){bindings.product=products[0];bindings.products=products;sources.push("products");live=true;}
  }catch(error){console.warn("VSN Email Builder preview product data unavailable:",error instanceof Error?error.message:error);}
  try{
    const response=await admin.graphql(`#graphql\nquery VsnEmailPreviewOrder { orders(first: 1, sortKey: CREATED_AT, reverse: true) { nodes { name totalPriceSet { shopMoney { amount currencyCode } } lineItems(first: 4) { nodes { title quantity originalUnitPriceSet { shopMoney { amount currencyCode } } } } } } }`);
    const payload=await response.json();const row=payload?.data?.orders?.nodes?.[0];
    if(row){const total=row.totalPriceSet?.shopMoney;const lineItems=(row.lineItems?.nodes||[]).map((item)=>{const unit=item.originalUnitPriceSet?.shopMoney;return {title:item.title||"Order item",quantity:Number(item.quantity)||1,price:money(unit?.amount,unit?.currencyCode),url:bindings.shop?.url||`https://${shop}`,image:""};});bindings.order={name:row.name||"#1001",total_price:money(total?.amount,total?.currencyCode),line_items:lineItems.map((item)=>`${item.title} × ${item.quantity}`).join(", ")||"Recent order items",line_items_data:lineItems,status_url:bindings.shop?.url||`https://${shop}`};sources.push("order");live=true;}
  }catch(error){console.warn("VSN Email Builder preview order data unavailable:",error instanceof Error?error.message:error);}
  return {bindings,meta:{live,sources}};
}


export async function loadEmailCommerceCatalog(admin,shop){
  const fallback={products:[],collections:[],live:false,error:null};if(!admin?.graphql)return fallback;
  try{
    const response=await admin.graphql(`#graphql
query VsnEmailCommerceCatalog {
  products(first: 30, sortKey: UPDATED_AT, reverse: true) { nodes { id title handle status featuredImage { url altText } priceRangeV2 { minVariantPrice { amount currencyCode } } } }
  collections(first: 20, sortKey: UPDATED_AT, reverse: true) { nodes { id title handle image { url altText } products(first: 4) { nodes { id title handle featuredImage { url altText } priceRangeV2 { minVariantPrice { amount currencyCode } } } } } }
}`);
    const payload=await response.json();if(payload?.errors?.length)throw new Error(payload.errors.map((e)=>e.message).join("; "));
    const baseUrl=`https://${shop}`;const product=(row)=>{const price=row?.priceRangeV2?.minVariantPrice;return {id:row?.id||"",title:row?.title||"Product",handle:row?.handle||"",status:row?.status||"ACTIVE",price:money(price?.amount,price?.currencyCode),url:`${baseUrl}/products/${row?.handle||""}`,image:row?.featuredImage?.url||"",alt:row?.featuredImage?.altText||row?.title||"Product"};};
    const products=(payload?.data?.products?.nodes||[]).map(product);const collections=(payload?.data?.collections?.nodes||[]).map((row)=>({id:row.id||"",title:row.title||"Collection",handle:row.handle||"",url:`${baseUrl}/collections/${row.handle||""}`,image:row.image?.url||"",alt:row.image?.altText||row.title||"Collection",products:(row.products?.nodes||[]).map(product)}));
    return {products,collections,live:true,error:null};
  }catch(error){console.warn("VSN Email commerce catalog unavailable:",error instanceof Error?error.message:error);return {...fallback,error:error instanceof Error?error.message:"Shopify catalog unavailable."};}
}
