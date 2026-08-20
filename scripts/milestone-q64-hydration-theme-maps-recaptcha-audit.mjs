import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { UI_COLOR_SCHEMES, normalizeUiColorScheme, normalizeUiHex, resolveUiTheme } from "../app/config/ui-theme.js";
import { loadGoogleMapsApiKey, loadGoogleMapsSettings, saveGoogleMapsSettings, loadGoogleCaptchaSettings, loadGoogleCaptchaRuntime, saveGoogleCaptchaSettings } from "../app/services/google-platform.server.js";
import { verifyGoogleRecaptcha } from "../app/services/form-automation.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}
function memoryDb(){let rows=[];return{builderIntegration:{findFirst:async({where})=>rows.filter((row)=>Object.entries(where||{}).every(([k,v])=>row[k]===v)).sort((a,b)=>+new Date(b.updatedAt)-+new Date(a.updatedAt))[0]||null,create:async({data})=>{const row={id:`int-${rows.length+1}`,...data,createdAt:new Date(),updatedAt:new Date()};rows.push(row);return row;},update:async({where,data})=>{const index=rows.findIndex((row)=>row.id===where.id);if(index<0)throw new Error("missing integration");rows[index]={...rows[index],...data,updatedAt:new Date()};return rows[index];}},_rows:()=>rows};}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const baselineJs=read("app/config/baseline.js");
const appShell=read("app/routes/app.jsx");
const dashboard=read("app/components/dashboard/DashboardApp.jsx");
const settings=read("app/components/dashboard/pages/Settings.jsx");
const dashboardCss=read("app/styles/dashboard.css");
const builderCss=read("app/styles/builder.css");
const googleService=read("app/services/google-platform.server.js");
const formEngine=read("app/builder/formEngine.js");
const formSettingsRoute=read("app/routes/app.form-settings.jsx");
const panelHost=read("app/components/BuilderPanelHost.jsx");
const properties=read("app/components/editor/PropertiesPanel.jsx");
const proxy=read("app/routes/builder-proxy.$.jsx");
const renderer=read("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js");
const formSubmission=read("app/services/storefront-form-submission.server.js");
const env=read(".env.example");
const plans=read("app/config/commercialPlans.js");

await check("Version is v2.5.107",()=>assert.equal(pkg.version,"2.5.107"));
await check("Baseline is Q.6.4",()=>{assert.equal(baseline.version,"2.5.107");assert.equal(baseline.milestone,"Q.6.4")});
await check("Q6.4 baseline capabilities are registered",()=>{for(const key of ["hydrationHardening","uiColorSchemes","googleMapsPlatform","googleRecaptcha"])assert.ok(baselineJs.includes(`${key}: 1`),key);assert.ok(baselineJs.includes("forms: 3"))});
await check("Developer Mode report exists",()=>assert.ok(exists("MILESTONE_Q64_DEVELOPER_MODE.md")));
await check("Q6.4 report exists",()=>assert.ok(exists("VSN_MILESTONE_Q64_HYDRATION_THEME_MAPS_RECAPTCHA_REPORT_v2.5.107.md")));
await check("Google integration developer documentation exists",()=>assert.ok(exists("docs/developer/google-platform-integrations.md")));
await check("Dedicated Q6.4 command exists",()=>assert.equal(pkg.scripts?.["qa:q64"],"node scripts/milestone-q64-hydration-theme-maps-recaptcha-audit.mjs"));
await check("Q6.4 audit is in full release chain",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q64-hydration-theme-maps-recaptcha-audit.mjs")));

await check("App shell imports React startTransition",()=>assert.ok(appShell.includes("startTransition")));
await check("Initial appearance hydration is transitioned",()=>assert.ok(appShell.includes("startTransition(()=>{\n      setThemePreferenceState(savedTheme)")));
await check("System theme changes are transitioned",()=>assert.ok(appShell.includes("const update = () => startTransition(()=>setSystemDark")));
await check("Color-scheme events are transitioned",()=>assert.ok(appShell.includes("startTransition(()=>{setColorSchemePreferenceState(scheme);setCustomAccentState(accent);})")));
await check("Dashboard prop synchronization is transitioned",()=>{assert.ok(dashboard.includes("startTransition(()=>setSettings"));assert.ok(dashboard.includes("startTransition(()=>setActivePage"))});
await check("Default Dashboard Home is outside lazy Suspense",()=>assert.ok(dashboard.includes("activePage === 'home' ? renderPage() : <Suspense")));
await check("Lazy Dashboard destinations still retain Suspense",()=>assert.ok(dashboard.includes("<Suspense fallback={<DashboardPageFallback/>}")));

await check("UI has seven presets plus Custom",()=>{assert.equal(UI_COLOR_SCHEMES.filter((row)=>row.id!=="custom").length,7);assert.ok(UI_COLOR_SCHEMES.some((row)=>row.id==="custom"))});
await check("Unknown scheme safely falls to Lime",()=>assert.equal(normalizeUiColorScheme("not-real"),"lime"));
await check("Three-digit custom hex normalizes",()=>assert.equal(normalizeUiHex("#abc"),"#AABBCC"));
await check("Invalid custom hex safely falls back",()=>assert.equal(normalizeUiHex("bad","#123456"),"#123456"));
await check("Resolved theme derives usable CSS values",()=>{const value=resolveUiTheme("custom","#2563eb");assert.equal(value.accent,"#2563EB");assert.match(value.accentRgb,/^\d+,\d+,\d+$/);assert.ok(value.accentDark.startsWith("#"));assert.ok(value.accentSoft.startsWith("#"))});
await check("Color preference keys persist in localStorage",()=>{assert.ok(appShell.includes('localStorage.setItem("vsn:color-scheme"'));assert.ok(appShell.includes('localStorage.setItem("vsn:custom-accent"'))});
await check("App shell publishes shared accent CSS variables",()=>{for(const key of ["--vsn-green","--vsn-green-dark","--vsn-accent-soft","--vsn-accent-rgb","--vsn-accent-foreground"])assert.ok(appShell.includes(key),key)});
await check("Settings renders presets and custom color input",()=>{assert.ok(settings.includes("UI_COLOR_SCHEMES"));assert.ok(settings.includes('type="color"'));assert.ok(settings.includes("onCustomAccentChange"))});
await check("Dashboard accent rgba uses dynamic RGB variable",()=>assert.ok(dashboardCss.includes("rgba(var(--vsn-accent-rgb)")));
await check("Editor core green derives from management accent",()=>{assert.ok(builderCss.includes("--vsn-editor-green:var(--vsn-green"));assert.ok(builderCss.includes("--vsn-e-green:var(--vsn-green"))});

await check("Google Maps settings use encrypted secret vault",()=>assert.ok(googleService.includes("encryptSecret(shop,nextKey)")));
await check("Google Maps blank save preserves existing key",async()=>{process.env.VSN_SECRET_ENCRYPTION_KEY="q64-test-secret";const db=memoryDb();await saveGoogleMapsSettings(db,"maps.myshopify.com",{enabled:true,apiKey:"maps-key-1234"});await saveGoogleMapsSettings(db,"maps.myshopify.com",{enabled:true,apiKey:""});assert.equal(await loadGoogleMapsApiKey(db,"maps.myshopify.com"),"maps-key-1234");const pub=await loadGoogleMapsSettings(db,"maps.myshopify.com");assert.equal(pub.configured,true);assert.ok(pub.maskedApiKey.endsWith("1234"));assert.equal("apiKey" in pub,false)});
await check("Maps environment fallback is documented",()=>assert.ok(env.includes("GOOGLE_MAPS_API_KEY=")));
await check("Dashboard loader exposes Google Maps public settings",()=>assert.ok(read("app/routes/app._index.jsx").includes("loadGoogleMapsSettings")));
await check("Settings save action persists Google Maps",()=>assert.ok(read("app/services/dashboard-actions.server.js").includes("saveGoogleMapsSettings")));
await check("Settings has Google Maps configuration card",()=>{assert.ok(settings.includes("Google Maps"));assert.ok(settings.includes("googleMapsApiKey"));assert.ok(settings.includes("Maps Embed API"))});
await check("Map widget uses keyed Google Maps Embed endpoint",()=>assert.ok(proxy.includes("https://www.google.com/maps/embed/v1/place?key=")));
await check("Legacy keyless Google map iframe is gone",()=>assert.doesNotMatch(proxy,/google\.com\/maps\?q=.*output=embed/));
await check("Missing Maps key renders explicit placeholder",()=>assert.ok(proxy.includes("Google Maps API key is not configured in VSN Builder Settings.")));
await check("Map inspector points users to global Maps settings",()=>assert.ok(properties.includes("Published maps use the global Google Maps API key")));

await check("Form engine includes reCAPTCHA v2 and v3",()=>{assert.ok(formEngine.includes('"recaptcha-v2"'));assert.ok(formEngine.includes('"recaptcha-v3"'));assert.ok(formEngine.includes("recaptchaV3Threshold"));assert.ok(formEngine.includes("recaptchaV3Action"))});
await check("reCAPTCHA v3 action allows only documented action characters",()=>{assert.ok(googleService.includes('replace(/[^A-Za-z0-9_/]/g,""'));assert.ok(formEngine.includes('replace(/[^A-Za-z0-9_/]/g,""'));assert.doesNotMatch(googleService,/A-Za-z0-9_\/-/)});
await check("reCAPTCHA secrets use encrypted integration storage",()=>assert.ok(googleService.includes("secretKey:encryptSecret(shop,secretKey)")));
await check("Blank reCAPTCHA secret save preserves prior secret",async()=>{process.env.VSN_SECRET_ENCRYPTION_KEY="q64-captcha-secret";const db=memoryDb();await saveGoogleCaptchaSettings(db,"captcha.myshopify.com","v3",{enabled:true,siteKey:"site-1",secretKey:"secret-1",threshold:.65,action:"checkout/form"});await saveGoogleCaptchaSettings(db,"captcha.myshopify.com","v3",{enabled:true,siteKey:"site-1",secretKey:"",threshold:.7,action:"checkout/form"});const runtime=await loadGoogleCaptchaRuntime(db,"captcha.myshopify.com","v3");assert.equal(runtime.secretKey,"secret-1");assert.equal(runtime.threshold,.7);assert.equal(runtime.action,"checkout/form");const pub=await loadGoogleCaptchaSettings(db,"captcha.myshopify.com");assert.equal(pub.v3.secretConfigured,true);assert.equal("secretKey" in pub.v3,false)});
await check("reCAPTCHA environment fallbacks are documented",()=>{for(const key of ["VSN_RECAPTCHA_V2_SITE_KEY=","VSN_RECAPTCHA_V2_SECRET_KEY=","VSN_RECAPTCHA_V3_SITE_KEY=","VSN_RECAPTCHA_V3_SECRET_KEY="])assert.ok(env.includes(key),key)});
await check("Forms Settings loader includes Google captcha providers",()=>assert.ok(formSettingsRoute.includes("loadGoogleCaptchaSettings")));
await check("Forms Settings action saves Google captcha",()=>assert.ok(formSettingsRoute.includes('intent==="save-google-captcha"')&&formSettingsRoute.includes("saveGoogleCaptchaSettings")));
await check("Forms panel exposes Google reCAPTCHA v2/v3",()=>{assert.ok(panelHost.includes("Google reCAPTCHA v2"));assert.ok(panelHost.includes("Google reCAPTCHA v3"));assert.ok(panelHost.includes("save-google-captcha"))});
await check("Properties panel exposes reCAPTCHA v2/v3 modes",()=>{assert.ok(properties.includes('{value:"recaptcha-v2"'));assert.ok(properties.includes('{value:"recaptcha-v3"'))});
await check("Storefront proxy renders both Google captcha modes",()=>{assert.ok(proxy.includes("vsn-g-recaptcha\""));assert.ok(proxy.includes("vsn-g-recaptcha-v3"))});
await check("Storefront renderer loads Google captcha explicitly",()=>assert.ok(renderer.includes("render=explicit")&&renderer.includes("grecaptcha.render")));
await check("v3 token is requested at submit time",()=>{const submit=renderer.indexOf('document.addEventListener("submit"');const execute=renderer.indexOf("api.execute(widgetId",submit);assert.ok(submit>=0&&execute>submit)});
await check("Captcha tokens are excluded from persisted fields",()=>{assert.ok(formSubmission.includes('"g-recaptcha-response"'));assert.ok(formSubmission.includes('"recaptchaToken"'));assert.ok(formSubmission.includes('"recaptchaAction"'))});
await check("Storefront form/security code is extracted server-side",()=>{assert.ok(proxy.includes("handleStorefrontFormSubmission"));assert.ok(formSubmission.includes("export async function handleStorefrontFormSubmission"))});

await check("reCAPTCHA v2 server verification succeeds on Google success",async()=>{const prior=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({success:true}),{status:200,headers:{"content-type":"application/json"}});const result=await verifyGoogleRecaptcha("token",new Request("https://shop.test/"),{secretKey:"secret",version:"v2"});assert.equal(result.ok,true)}finally{global.fetch=prior}});
await check("reCAPTCHA v3 enforces score threshold",async()=>{const prior=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({success:true,score:.2,action:"form_submit"}),{status:200,headers:{"content-type":"application/json"}});const result=await verifyGoogleRecaptcha("token",new Request("https://shop.test/"),{secretKey:"secret",version:"v3",threshold:.5,expectedAction:"form_submit"});assert.equal(result.ok,false);assert.match(result.error,/score/i)}finally{global.fetch=prior}});
await check("reCAPTCHA v3 enforces exact action",async()=>{const prior=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({success:true,score:.9,action:"wrong"}),{status:200,headers:{"content-type":"application/json"}});const result=await verifyGoogleRecaptcha("token",new Request("https://shop.test/"),{secretKey:"secret",version:"v3",threshold:.5,expectedAction:"form_submit"});assert.equal(result.ok,false);assert.match(result.error,/action/i)}finally{global.fetch=prior}});
await check("reCAPTCHA v3 accepts matching score and action",async()=>{const prior=global.fetch;try{global.fetch=async()=>new Response(JSON.stringify({success:true,score:.9,action:"form_submit"}),{status:200,headers:{"content-type":"application/json"}});const result=await verifyGoogleRecaptcha("token",new Request("https://shop.test/"),{secretKey:"secret",version:"v3",threshold:.5,expectedAction:"form_submit"});assert.equal(result.ok,true);assert.equal(result.score,.9)}finally{global.fetch=prior}});

await check("No Prisma migration was added for Q6.4",()=>{const db=new DatabaseSync("prisma/dev.sqlite");const latest=db.prepare("SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC, started_at DESC LIMIT 1").get();db.close();assert.equal(latest?.migration_name,"20260810114500_milestone_q633_stock_usage_history")});
await check("Exact Shopify billing handles remain unchanged",()=>{for(const handle of ["free","sliver","gold","platenium"])assert.ok(plans.includes(handle),handle)});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.4 Hydration/Theme/Maps/reCAPTCHA audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
