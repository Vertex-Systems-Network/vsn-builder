import { GLOBAL_DESIGN_DEFAULTS } from "../builder/globalDesign.js";
import { brandProfileFromForm, normalizeBrandProfile } from "../brand/brandProfile.js";

function parseJson(value, fallback) { try { return JSON.parse(String(value || "")); } catch { return fallback; } }
function stringify(value) { return JSON.stringify(value || {}); }
function cleanColor(value, fallback) { const v=String(value||"").trim(); return /^#[0-9a-f]{6}$/i.test(v)?v:fallback; }
function normalizeKitInput(input={}) {
  const colors={primary:cleanColor(input.primary,"#008060"),secondary:cleanColor(input.secondary,"#6d7175"),accent:cleanColor(input.accent,"#008060"),text:cleanColor(input.text,"#1a1a1a"),background:cleanColor(input.background,"#ffffff"),surface:cleanColor(input.surface,"#ffffff")};
  const typography={bodyFont:String(input.bodyFont||"Inter, system-ui, sans-serif").slice(0,180),headingFont:String(input.headingFont||"inherit").slice(0,180),headingScale:Math.max(.8,Math.min(2,Number(input.headingScale||1.25)))};
  const spacing={base:Math.max(1,Math.min(16,Number(input.spacingBase||4))),containerMaxWidth:String(input.containerMaxWidth||"1200px").slice(0,40)};
  const radius={sm:String(input.radiusSm||"6px").slice(0,30),md:String(input.radiusMd||"12px").slice(0,30),lg:String(input.radiusLg||"20px").slice(0,30),button:String(input.buttonRadius||"8px").slice(0,30)};
  const shadows={sm:String(input.shadowSm||GLOBAL_DESIGN_DEFAULTS.shadowSm).slice(0,240),md:String(input.shadowMd||GLOBAL_DESIGN_DEFAULTS.shadowMd).slice(0,240),lg:String(input.shadowLg||GLOBAL_DESIGN_DEFAULTS.shadowLg).slice(0,240)};
  return {colors,typography,spacing,radius,shadows};
}

export function brandKitToTokens(kit) {
  const colors=parseJson(kit?.colorsJson,{}), typography=parseJson(kit?.typographyJson,{}), spacing=parseJson(kit?.spacingJson,{}), radius=parseJson(kit?.radiusJson,{}), shadows=parseJson(kit?.shadowsJson,{});
  return {
    primaryColor:colors.primary||GLOBAL_DESIGN_DEFAULTS.primaryColor, secondaryColor:colors.secondary||GLOBAL_DESIGN_DEFAULTS.secondaryColor, accentColor:colors.accent||GLOBAL_DESIGN_DEFAULTS.accentColor,
    textColor:colors.text||GLOBAL_DESIGN_DEFAULTS.textColor, backgroundColor:colors.background||GLOBAL_DESIGN_DEFAULTS.backgroundColor, surfaceColor:colors.surface||GLOBAL_DESIGN_DEFAULTS.surfaceColor,
    fontFamily:typography.bodyFont||GLOBAL_DESIGN_DEFAULTS.fontFamily, headingFontFamily:typography.headingFont||GLOBAL_DESIGN_DEFAULTS.headingFontFamily, headingScale:Number(typography.headingScale||GLOBAL_DESIGN_DEFAULTS.headingScale),
    spacingBase:Number(spacing.base||GLOBAL_DESIGN_DEFAULTS.spacingBase), containerMaxWidth:spacing.containerMaxWidth||GLOBAL_DESIGN_DEFAULTS.containerMaxWidth,
    radiusSm:radius.sm||GLOBAL_DESIGN_DEFAULTS.radiusSm, radiusMd:radius.md||GLOBAL_DESIGN_DEFAULTS.radiusMd, radiusLg:radius.lg||GLOBAL_DESIGN_DEFAULTS.radiusLg, buttonRadius:radius.button||GLOBAL_DESIGN_DEFAULTS.buttonRadius,
    shadowSm:shadows.sm||GLOBAL_DESIGN_DEFAULTS.shadowSm, shadowMd:shadows.md||GLOBAL_DESIGN_DEFAULTS.shadowMd, shadowLg:shadows.lg||GLOBAL_DESIGN_DEFAULTS.shadowLg,
    buttonBackground:colors.primary||GLOBAL_DESIGN_DEFAULTS.buttonBackground, buttonTextColor:"#ffffff",
  };
}

export function serializeBrandKit(kit) { return {...kit,colors:parseJson(kit.colorsJson,{}),typography:parseJson(kit.typographyJson,{}),spacing:parseJson(kit.spacingJson,{}),radius:parseJson(kit.radiusJson,{}),shadows:parseJson(kit.shadowsJson,{}),profile:normalizeBrandProfile(kit.profileJson),tokens:brandKitToTokens(kit)}; }

export async function saveBrandKit({db,shop,id,name,logoUrl,input,isDefault=false}) {
  const normalized=normalizeKitInput(input); const profile=brandProfileFromForm(input); const data={name:String(name||"Brand Kit").trim().slice(0,100)||"Brand Kit",logoUrl:String(logoUrl||"").trim().slice(0,1000)||null,colorsJson:stringify(normalized.colors),typographyJson:stringify(normalized.typography),spacingJson:stringify(normalized.spacing),radiusJson:stringify(normalized.radius),shadowsJson:stringify(normalized.shadows),profileJson:stringify(profile),deletedAt:null};
  let kit;
  if(id){const existing=await db.builderBrandKit.findFirst({where:{id,shop}});if(!existing)throw new Error("Brand Kit not found.");kit=await db.builderBrandKit.update({where:{id},data});} else kit=await db.builderBrandKit.create({data:{shop,...data,isDefault:false}});
  if(isDefault)kit=await setDefaultBrandKit({db,shop,id:kit.id});
  return kit;
}

export async function setDefaultBrandKit({db,shop,id}) {
  const kit=await db.builderBrandKit.findFirst({where:{id,shop,deletedAt:null}}); if(!kit)throw new Error("Brand Kit not found.");
  await db.$transaction([db.builderBrandKit.updateMany({where:{shop,isDefault:true},data:{isDefault:false}}),db.builderBrandKit.update({where:{id},data:{isDefault:true}})]);
  const tokens=brandKitToTokens({...kit,isDefault:true});
  const setting=await db.builderShopSetting.findUnique({where:{shop}}); const current=parseJson(setting?.designTokensJson,{});
  await db.builderShopSetting.upsert({where:{shop},create:{shop,designTokensJson:JSON.stringify({...current,...tokens,brandKitId:id})},update:{designTokensJson:JSON.stringify({...current,...tokens,brandKitId:id})}});
  return {...kit,isDefault:true};
}

export async function applyBrandKitToLibraryItem({db,shop,kitId,libraryItemId}) {
  const [kit,item]=await Promise.all([db.builderBrandKit.findFirst({where:{id:kitId,shop,deletedAt:null}}),db.builderLibraryItem.findFirst({where:{id:libraryItemId,shop,deletedAt:null}})]);
  if(!kit||!item)throw new Error("Brand Kit or library item was not found."); const tokens=brandKitToTokens(kit);
  const raw=parseJson(item.contentJson,[]);
  const themeNode=(node)=>{if(!node||typeof node!=="object")return node;const next={...node,styles:{...(node.styles||{})},children:Array.isArray(node.children)?node.children.map(themeNode):node.children};if(node.type==="heading")next.styles={...next.styles,typography:{...(next.styles.typography||{}),color:tokens.textColor,fontFamily:tokens.headingFontFamily}};if(node.type==="text")next.styles={...next.styles,typography:{...(next.styles.typography||{}),color:tokens.textColor,fontFamily:tokens.fontFamily}};if(node.type==="button")next.styles={...next.styles,background:{...(next.styles.background||{}),color:tokens.primaryColor},typography:{...(next.styles.typography||{}),color:tokens.buttonTextColor,fontFamily:tokens.fontFamily},border:{...(next.styles.border||{}),radius:tokens.buttonRadius}};if(node.type==="section"||node.type==="container")next.meta={...(next.meta||{}),brandKitId:kit.id};return next;};
  let output;
  if(Array.isArray(raw)){const content=raw.map(themeNode);let globals=content.find((node)=>node?.type==="global-styles");if(globals)globals.props={...(globals.props||{}),...tokens};else content.unshift({id:`brand-${Date.now().toString(36)}`,type:"global-styles",label:"Global Styles",props:tokens,styles:{},children:[]});output=content;}else output=themeNode({...raw,meta:{...(raw?.meta||{}),brandKitId:kit.id,brandKitTokens:tokens}});
  await db.builderLibraryItem.update({where:{id:item.id},data:{contentJson:JSON.stringify(output)}}); return {itemId:item.id,kitId:kit.id};
}
