import { getPlan, getPlanUsage, serializePlan } from "../utils/plan.server.js";
import { getShopifyAppPricingConfig } from "./shopify-app-pricing.server.js";

export const ONBOARDING_TRACKS = Object.freeze([
  Object.freeze({ key:"landing-page", label:"Landing Page", description:"Build a focused campaign or lead-generation page.", panel:"pages", template:"page", docs:"landing" }),
  Object.freeze({ key:"product-page", label:"Product Page", description:"Create a reusable default product experience.", panel:"pages", template:"product", docs:"product" }),
  Object.freeze({ key:"full-theme", label:"Full Theme", description:"Build the storefront shell and core commerce templates.", panel:"pages", template:"index", docs:"theme" }),
  Object.freeze({ key:"cro-test", label:"CRO Test", description:"Prepare a control, variation and experiment workflow.", panel:"experiments", template:"page", docs:"cro" }),
  Object.freeze({ key:"campaign", label:"Campaign", description:"Build a popup/flyout campaign with targeting and scheduling.", panel:"campaigns", template:"popup", docs:"campaign" }),
]);

function parse(value, fallback = {}) { try { return JSON.parse(String(value || "")) || fallback; } catch { return fallback; } }
function id(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function slug(value) { return String(value || "vsn-demo").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "vsn-demo"; }
async function uniqueHandle(db, shop, base) { let handle=slug(base), suffix=1; while(await db.builderPage.findFirst({where:{shop,handle}})){suffix+=1;handle=`${slug(base)}-${suffix}`;} return handle; }
function demoContent(title, subtitle, cta="Explore") {
  const section=id("section"), heading=id("heading"), text=id("text"), button=id("button");
  return [{id:section,type:"section",name:"Demo Hero",props:{},styles:{padding:{top:"72px",right:"32px",bottom:"72px",left:"32px"},background:{color:"#f7f7f5"}},children:[
    {id:heading,type:"heading",name:"Heading",props:{text:title,tag:"h1"},styles:{typography:{fontSize:"48px",fontWeight:"700",lineHeight:"1.05"}},children:[]},
    {id:text,type:"text",name:"Text",props:{text:subtitle},styles:{typography:{fontSize:"18px",lineHeight:"1.6"},spacing:{marginTop:"16px"}},children:[]},
    {id:button,type:"button",name:"Button",props:{text:cta,url:"#"},styles:{spacing:{marginTop:"24px"}},children:[]},
  ]}];
}

async function createDemoPage(db, shop, {title, template="page", isDefault=false, content}) {
  const existing=await db.builderPage.findFirst({where:{shop,title,deletedAt:null}});
  if(existing)return existing;
  return db.builderPage.create({data:{shop,title,handle:await uniqueHandle(db,shop,title),template,isDefault,status:"draft",workflowStatus:"draft",contentJson:JSON.stringify(content||demoContent(title,"Editable VSN demo content. Nothing is published automatically.")),createdBy:"VSN setup"}});
}

export async function seedDemoWorkspace(db, shop, trackKey) {
  const track=ONBOARDING_TRACKS.find((row)=>row.key===trackKey)||ONBOARDING_TRACKS[0];
  const created=[];
  if(track.key==="landing-page") created.push(await createDemoPage(db,shop,{title:"VSN Demo — Landing Page",template:"page",content:demoContent("A focused landing page","Use this local draft to explore responsive controls, reusable sections and publishing.","Primary CTA")}));
  if(track.key==="product-page") created.push(await createDemoPage(db,shop,{title:"VSN Demo — Default Product",template:"product",isDefault:true,content:demoContent("Product story, designed visually","Bind dynamic product widgets, media and conversion content in the editor.","Add to cart")}));
  if(track.key==="full-theme") {
    created.push(await createDemoPage(db,shop,{title:"VSN Demo — Home",template:"index",isDefault:true,content:demoContent("VSN sample storefront","A developer-safe starting point for a complete Shopify storefront.","Shop now")}));
    created.push(await createDemoPage(db,shop,{title:"VSN Demo — Header",template:"header",isDefault:true,content:demoContent("Header","Replace this draft with navigation, logo and actions.","Menu")}));
    created.push(await createDemoPage(db,shop,{title:"VSN Demo — Footer",template:"footer",isDefault:true,content:demoContent("Footer","Add newsletter, policies, navigation and trust content.","Subscribe")}));
    created.push(await createDemoPage(db,shop,{title:"VSN Demo — Collection",template:"collection",isDefault:true,content:demoContent("Collection template","Use Loop / Query to render dynamic Shopify products.","Browse products")}));
    created.push(await createDemoPage(db,shop,{title:"VSN Demo — Product",template:"product",isDefault:true,content:demoContent("Product template","Build one reusable product system instead of editing every product manually.","Add to cart")}));
  }
  if(track.key==="cro-test") {
    created.push(await createDemoPage(db,shop,{title:"VSN CRO Demo — Control",template:"page",content:demoContent("Control experience","Publish this draft, then use it as Variant A in CRO Experiments.","Start")}));
    created.push(await createDemoPage(db,shop,{title:"VSN CRO Demo — Variation",template:"page",content:demoContent("Alternative experience","Publish this draft, then select it as the variation source.","Try variation")}));
  }
  if(track.key==="campaign") created.push(await createDemoPage(db,shop,{title:"VSN Demo — Campaign Popup",template:"popup",content:demoContent("A campaign popup","Configure trigger, targeting, frequency and schedule in Growth → Campaigns.","Get offer")}));
  return {track,created:created.map((row)=>({id:row.id,title:row.title,template:row.template}))};
}

export async function onboardingStatus(db, shop, state = {}) {
  const [pages, experimentCount] = await Promise.all([
    db.builderPage.findMany({where:{shop,deletedAt:null},select:{id:true,title:true,template:true,isDefault:true,status:true}}),
    db.builderExperiment.count({where:{shop}}).catch(()=>0),
  ]);
  const campaigns=pages.filter((p)=>["popup","modal","drawer","flyout","announcement-overlay"].includes(p.template)).length;
  const has=(template)=>pages.some((p)=>p.template===template);
  const published=(template)=>pages.some((p)=>p.template===template&&p.status==="published");
  const selected=ONBOARDING_TRACKS.find((row)=>row.key===state.goal)||ONBOARDING_TRACKS[0];
  const trackProgress={
    "landing-page":[{key:"create",label:"Create a landing page",done:has("page")},{key:"publish",label:"Publish a landing page",done:published("page")},{key:"qa",label:"Run System Health",done:state.healthReviewed===true}],
    "product-page":[{key:"create",label:"Create a product template",done:has("product")},{key:"publish",label:"Publish the product template",done:published("product")},{key:"qa",label:"Test a product in preview/storefront",done:state.storefront===true}],
    "full-theme":[{key:"home",label:"Create Home template",done:has("index")},{key:"product",label:"Create Product template",done:has("product")},{key:"collection",label:"Create Collection template",done:has("collection")},{key:"shell",label:"Create Header & Footer",done:has("header")&&has("footer")},{key:"qa",label:"Run storefront QA",done:state.storefront===true}],
    "cro-test":[{key:"pages",label:"Prepare control & variation",done:pages.filter((p)=>/VSN CRO Demo/.test(p.title)).length>=2||pages.filter((p)=>p.template==="page").length>=2},{key:"publish",label:"Publish test sources",done:pages.filter((p)=>p.template==="page"&&p.status==="published").length>=2},{key:"experiment",label:"Create a CRO experiment",done:experimentCount>0}],
    "campaign":[{key:"create",label:"Create a campaign",done:campaigns>0},{key:"configure",label:"Configure targeting & schedule",done:state.campaignConfigured===true},{key:"test",label:"Preview the campaign",done:state.campaignTested===true}],
  };
  const steps=trackProgress[selected.key]||[];
  const completed=steps.filter((step)=>step.done).length;
  return {selected,tracks:ONBOARDING_TRACKS,steps,completed,total:steps.length,percent:steps.length?Math.round(completed/steps.length*100):0,pageCount:pages.length,experimentCount,campaignCount:campaigns};
}

export async function getCommercializationStatus(db, shop) {
  const setting=await db.builderShopSetting.findUnique({where:{shop}}).catch(()=>null);
  const onboarding=parse(setting?.onboardingJson,{});
  const plan=await getPlan(db,shop);
  const [usage,onboardingData]=await Promise.all([getPlanUsage(db,shop,plan),onboardingStatus(db,shop,onboarding)]);
  const pricing=getShopifyAppPricingConfig(shop);
  return {plan:serializePlan(plan),usage,onboarding:onboardingData,developerMode:process.env.NODE_ENV!=="production",billingConfigured:pricing.configured,billingProvider:pricing.provider,billingMode:pricing.mode};
}
