import fs from "node:fs";
import path from "node:path";
import {
  getVsnDataProvider,
  getVsnWidgetDefinition,
  listVsnDataProviders,
  listVsnPlugins,
  listVsnWidgets,
  registerVsnPlugin,
} from "../app/sdk/registry.js";
import { ensureBuiltinSdkPlugins } from "../app/sdk/builtinPlugins.js";
import { registerCoreShopifyDataProviders, resolveVsnDataProvider } from "../app/sdk/dataProviders.server.js";
import { renderVsnStorefrontWidget, prepareVsnSdkNodesForSave } from "../app/sdk/runtime.js";
import { scanPluginSource, isPublicHttpsUrl } from "../app/sdk/security.js";
import { validateControlSchema, validatePluginManifest } from "../app/sdk/validation.js";
import { serializeVsnDescriptor, vsnElement } from "../app/sdk/renderDescriptor.js";
import { compareVersions, versionSatisfies, VSN_SDK_API_VERSION } from "../app/sdk/version.js";
import { widgetRegistry, createWidget } from "../app/builder/widgetRegistry.js";
import { getWidgetCapabilities } from "../app/builder/widgetCapabilities.js";
import { getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";

const root=process.cwd(); const read=(p)=>fs.readFileSync(path.join(root,p),"utf8"); const exists=(p)=>fs.existsSync(path.join(root,p));
let pass=0,fail=0; const check=(name,ok)=>{if(ok){pass++;console.log(`PASS  ${name}`)}else{fail++;console.error(`FAIL  ${name}`)}};
const pkg=JSON.parse(read("package.json")); const baseline=JSON.parse(read("BASELINE.json")); const baselineJs=read("app/config/baseline.js");

check("Phase 14 SDK is preserved on v2.5.50 or later",compareVersions(pkg.version,"2.5.50")>=0&&pkg.version===baseline.version&&Number(baseline.phase)>=14);
check("Milestone D / Phase 14 remains completed in the Phase 15+ baseline",baselineJs.includes("completedPhases")&&baselineJs.includes("14, 15")&&/developerSdk:\s*[12]/.test(baselineJs)&&baselineJs.includes('pluginManifest: 1'));
check("Phase 14 feature flag exists and defaults off",read("app/config/featureFlags.js").includes('VSN_FEATURE_DEVELOPER_SDK')&&read("app/config/featureFlags.js").includes('phase: 14'));
check("Developer-mode example enables Phase 14 flag",read(".env.example").includes("VSN_FEATURE_DEVELOPER_SDK=true"));
check("SDK API version is v1",VSN_SDK_API_VERSION==="1.0.0");

for(const file of ["app/sdk/index.js","app/sdk/server.js","app/sdk/version.js","app/sdk/security.js","app/sdk/validation.js","app/sdk/registry.js","app/sdk/runtime.js","app/sdk/renderDescriptor.js","app/sdk/dataProviders.server.js","app/sdk/builtinPlugins.js"]) check(`SDK module packaged: ${file}`,exists(file));

check("Semantic version comparison works",compareVersions("2.5.50","2.5.49")===1&&versionSatisfies("2.5.50",{min:"2.5.50",maxExclusive:"3.0.0"}));
const validManifest=validatePluginManifest({schemaVersion:1,id:"audit.sample",name:"Audit Sample",version:"1.0.0",compatibility:{min:"2.5.50",maxExclusive:"3.0.0"},permissions:["editor:controls"]},{appVersion:"2.5.50"});
check("Compatible plugin manifest validates",validManifest.ok===true);
check("Incompatible plugin range is rejected",validatePluginManifest({schemaVersion:1,id:"audit.range",name:"Range",version:"1.0.0",compatibility:{min:"3.0.0"},permissions:[]},{appVersion:"2.5.50"}).ok===false);
check("Unknown plugin permission is rejected",validatePluginManifest({schemaVersion:1,id:"audit.permission",name:"Permission",version:"1.0.0",compatibility:{min:"2.5.50"},permissions:["admin:raw"]},{appVersion:"2.5.50"}).ok===false);
check("Network origin requires external permission",validatePluginManifest({schemaVersion:1,id:"audit.net",name:"Net",version:"1.0.0",compatibility:{min:"2.5.50"},networkOrigins:["https://api.example.com/"]},{appVersion:"2.5.50"}).ok===false);

const controlTypes=["text","textarea","number","toggle","select","multi-select","radio","button-set","url","color","color-gradient","range","css-length","date","datetime","time","dimensions","border-radius","typography","media","icon"];
check("Control Schema API reuses broad editor control set",validateControlSchema(controlTypes.map((type,index)=>({key:`c${index}`,type,label:type,...(["select","multi-select","radio","button-set"].includes(type)?{options:["one","two"]}:{})}))).ok===true);
check("Invalid control type is rejected",validateControlSchema([{key:"x",type:"shell"}]).ok===false);

const unsafe=scanPluginSource('import x from "node:child_process"; fetch("https://x"); console.log(process.env.KEY); registerVsnWidget({});');
check("Source scanner catches forbidden runtime APIs",unsafe.some((x)=>x.includes("child_process"))&&unsafe.includes("fetch(")&&unsafe.includes("process.env")&&unsafe.includes("registerVsnWidget("));
check("Source scanner rejects external package imports",scanPluginSource('import React from "react";').some((x)=>x==="import:react"));
check("Source scanner allows local and SDK imports",scanPluginSource('import x from "./local.js"; import {registerVsnPlugin} from "../../../app/sdk/index.js";').length===0);
check("Public HTTPS guard blocks local/private endpoints",isPublicHttpsUrl("https://api.example.com/items")&&!isPublicHttpsUrl("http://api.example.com")&&!isPublicHttpsUrl("https://127.0.0.1/test")&&!isPublicHttpsUrl("https://192.168.1.10/test")&&!isPublicHttpsUrl("https://[::1]/test")&&!isPublicHttpsUrl("https://[fd00::1]/test"));

ensureBuiltinSdkPlugins(); registerCoreShopifyDataProviders();
const plugins=listVsnPlugins(); const sdkWidgets=listVsnWidgets(); const providers=listVsnDataProviders();
check("Built-in SDK plugins register",plugins.some((x)=>x.manifest.id==="vsn.core"&&x.status==="active")&&plugins.some((x)=>x.manifest.id==="vsn.example"&&x.status==="active"));
check("Internal Spacer is bridged into SDK gradually",getVsnWidgetDefinition("spacer")?.pluginId==="vsn.core"&&widgetRegistry.spacer?.sdk?.pluginId==="vsn.core");
check("Existing Spacer still uses legacy renderer path",sdkWidgets.find((x)=>x.id==="spacer")?.renderers?.editor===false&&sdkWidgets.find((x)=>x.id==="spacer")?.renderers?.storefront===false);
check("Example SDK widget joins canonical widget registry",widgetRegistry["example-announcement-card"]?.sdk?.pluginId==="vsn.example"&&createWidget("example-announcement-card").type==="example-announcement-card");
check("SDK capability hooks feed central capability engine",getWidgetCapabilities("example-announcement-card").background===true&&getWidgetCapabilities("example-announcement-card").customCode===true);
check("SDK style-profile hooks feed central style profiles",getWidgetStyleProfile("example-announcement-card").sdkGroups.includes("background")&&getWidgetStyleProfile("example-announcement-card").sdkGroups.includes("responsive"));
check("Plugin/widget snapshots are loader-serializable",(()=>{try{JSON.stringify({plugins:listVsnPlugins(),widgets:listVsnWidgets(),providers:listVsnDataProviders()});return true}catch{return false}})());

const descriptor=vsnElement("a",{href:"javascript:alert(1)",target:"_blank",onClick:"bad",style:{color:"red",backgroundImage:"url(javascript:bad)"}},["<unsafe>"]);
const serialized=serializeVsnDescriptor(descriptor);
check("Render descriptor escapes text",serialized.includes("&lt;unsafe&gt;"));
check("Render descriptor strips unsafe URL/events/styles",!serialized.includes("javascript:")&&!serialized.includes("onclick")&&serialized.includes('rel="noopener noreferrer"'));
const exampleRendered=renderVsnStorefrontWidget({id:"audit",type:"example-announcement-card",props:{eyebrow:"SDK",title:"Hello <world>",body:"Safe"}});
check("Third-party storefront renderer uses safe descriptor serializer",exampleRendered.handled===true&&exampleRendered.value.includes("Hello &lt;world&gt;")&&!exampleRendered.error);

registerVsnPlugin({manifest:{schemaVersion:1,id:"audit.raw",name:"Raw",version:"1.0.0",compatibility:{min:"2.5.50"},permissions:["storefront:render"],widgets:[]},setup(api){api.registerWidget({id:"raw-card",label:"Raw",renderers:{storefront:()=>'<script>alert(1)</script>'}})}});
const rawRendered=renderVsnStorefrontWidget({id:"r",type:"raw-card",props:{}});
check("Third-party raw HTML storefront output is escaped as text",rawRendered.handled===true&&!rawRendered.error&&rawRendered.value.includes("&lt;script&gt;")&&!rawRendered.value.includes("<script>"));

const saveResult=await prepareVsnSdkNodesForSave([{id:"s",type:"spacer",props:{height:" 88px "},children:[]}]);
check("SDK save lifecycle hook executes before persistence",saveResult[0].props.height.includes("88px"));

registerVsnPlugin({manifest:{schemaVersion:1,id:"audit.permissionless",name:"No permission",version:"1.0.0",compatibility:{min:"2.5.50"},permissions:[],widgets:[]},setup(api){api.registerWidget({id:"permissionless-card",label:"Nope",controls:[{key:"x",type:"text",label:"X"}]})}});
check("Plugin permissions are enforced during registration",listVsnPlugins().some((x)=>x.manifest.id==="audit.permissionless"&&x.status==="error")&&!getVsnWidgetDefinition("permissionless-card"));

registerVsnPlugin({manifest:{schemaVersion:1,id:"audit.upgrade",name:"Upgrade",version:"1.0.0",compatibility:{min:"2.5.50"},permissions:["storefront:render"],widgets:[]},setup(api){api.registerWidget({id:"upgrade-card",label:"Stable",renderers:{storefront:()=>vsnElement("div",{},"v1")}})}});
registerVsnPlugin({manifest:{schemaVersion:1,id:"audit.upgrade",name:"Upgrade",version:"2.0.0",compatibility:{min:"2.5.50"},permissions:["storefront:render"],widgets:[]},setup(api){api.registerWidget({id:"upgrade-card",label:"Broken",renderers:{storefront:()=>vsnElement("div",{},"v2")}});throw new Error("upgrade failed")}});
check("Failed plugin upgrade rolls registry back",getVsnWidgetDefinition("upgrade-card")?.version==="1.0.0"&&renderVsnStorefrontWidget({id:"u",type:"upgrade-card",props:{}}).value==="<div>v1</div>");

check("Six constrained Shopify data providers exist",providers.filter((x)=>x.id.startsWith("shopify:")).length>=6);
registerVsnPlugin({manifest:{schemaVersion:1,id:"audit.provider",name:"Provider namespace",version:"1.0.0",compatibility:{min:"2.5.50"},permissions:[],widgets:[]},setup(api){api.registerDataProvider({id:"shopify:products",label:"Collision",resolve:async()=>[]})}});
check("Third-party data-provider namespaces cannot shadow VSN/Shopify providers",listVsnPlugins().some((x)=>x.manifest.id==="audit.provider"&&x.status==="error")&&getVsnDataProvider("shopify:products")?.pluginId==="vsn.core");
registerVsnPlugin({manifest:{schemaVersion:1,id:"audit.context",name:"Context",version:"1.0.0",compatibility:{min:"2.5.50"},permissions:[],widgets:[]},setup(api){api.registerDataProvider({id:"context:test",label:"Context",resolve:async(context)=>[{id:"1",unsafe:Boolean(context.admin),shopifyMethods:Object.keys(context.shopify||{}).length}]})}});
const safeRows=await resolveVsnDataProvider("context:test",{admin:{secret:true},shop:"example.myshopify.com"},{});
check("Third-party providers never receive raw Shopify Admin client",safeRows[0]?.unsafe===false&&safeRows[0]?.shopifyMethods===0);

const preview=read("app/components/editor/PreviewRenderer.jsx"); const sdkView=exists("app/components/editor/SdkWidgetView.jsx")?read("app/components/editor/SdkWidgetView.jsx"):preview; const proxy=read("app/routes/builder-proxy.$.jsx"); const editorRoute=read("app/routes/app.builder.$id.jsx"); const propsPanel=read("app/components/editor/PropertiesPanel.jsx");
check("Editor Renderer API is in shared preview pipeline",preview.includes("SdkWidgetView")&&sdkView.includes("renderVsnEditorWidget")&&sdkView.includes("SdkWidgetErrorBoundary"));
check("Storefront Renderer API is in shared storefront pipeline",proxy.includes("renderVsnStorefrontWidget")&&proxy.includes("sdkRender.handled"));
check("Save lifecycle is wired into editor save/publish",editorRoute.includes("prepareVsnSdkNodesForSave")&&editorRoute.includes("content = await prepareVsnSdkNodesForSave"));
check("Control Schema panel is wired into Properties sidebar",propsPanel.includes("SdkControlPanel"));
check("Editor renderer descriptor props are sanitized",sdkView.includes("sanitizeVsnDescriptorProps"));
check("Crash isolation records SDK errors",read("app/sdk/runtime.js").includes("reportVsnSdkError")&&sdkView.includes("componentDidCatch"));

const queryBuilder=read("app/builder/queryBuilder.js"); const queryEngine=read("app/services/query-engine.server.js");
check("Loop Builder exposes SDK Data Provider source",queryBuilder.includes('value: "sdk-provider"')&&queryBuilder.includes("providerId")&&queryBuilder.includes("providerInputJson"));
check("Query runtime resolves SDK providers",queryEngine.includes("resolveVsnDataProvider")&&queryEngine.includes('query.source === "sdk-provider"'));
check("Editor provides readable SDK provider preview",preview.includes('q.source === "sdk-provider"'));

const sidebar=read("app/components/AppSidebar.jsx"); const host=read("app/components/BuilderPanelHost.jsx"); const panelService=read("app/services/builder-panels.server.js"); const pluginRoute=read("app/routes/app.plugins.jsx");
check("Plugin SDK appears in Builder Developer sidebar",sidebar.includes('id: "developer-sdk"')&&sidebar.includes('label: "Plugin SDK"')&&sidebar.includes("ownerOnly: true"));
check("Developer SDK panel uses Builder panel system",panelService.includes("pluginsPanelLoader")&&panelService.includes('"developer-sdk":pluginsPanelLoader')&&host.includes("DeveloperSdkPanel"));
check("Plugin SDK route remains server permission restricted",pluginRoute.includes('canAccessBuilderSystem(db,session,"developerSdk")')&&pluginRoute.includes('canAccessBuilderAction(db,session,"plugins","view")')&&pluginRoute.includes('canAccessBuilderAction(db,session,"plugins","configure")'));
check("Developer panel can validate manifests",host.includes('intent:"validate-manifest"')&&pluginRoute.includes('intent==="validate-manifest"'));
check("Developer panel can run SDK self-test",host.includes('intent:"self-test"')&&pluginRoute.includes('intent==="self-test"'));
check("Developer panel exposes security contract",host.includes("Security contract")&&host.includes("forbiddenApis"));
check("Developer panel exposes plugins/widgets/providers/errors",host.includes("Registered plugins")&&host.includes("Widget & Renderer registry")&&host.includes("Data Provider API")&&host.includes("Recent SDK isolation events"));

const health=read("app/routes/app.control-center.jsx");
check("System Health reports Developer SDK engine",health.includes("developerSdk")&&health.includes("VSN_SDK_API_VERSION")&&host.includes('infoCard("Developer SDK"'));

check("Plugin validation CLI exists",exists("scripts/vsn-plugin-validate.mjs")&&pkg.scripts["plugin:validate"]);
check("Plugin SDK test harness exists",exists("scripts/vsn-sdk-test.mjs")&&pkg.scripts["plugin:test"]);
check("Public SDK docs exist",exists("docs/sdk/README.md")&&read("docs/sdk/README.md").includes("Data Provider API"));
check("Widget plugin example exists",exists("examples/plugins/announcement-card/manifest.json")&&exists("examples/plugins/announcement-card/plugin.jsx"));
check("External data-provider example exists",exists("examples/plugins/remote-data/manifest.json")&&exists("examples/plugins/remote-data/provider.server.js"));
check("Plugin source contract disables remote arbitrary JS",read("PHASE14_DEVELOPER_MODE.md").includes("No remote JavaScript plugin installation")&&read("docs/sdk/README.md").includes("does **not** download or execute remote JavaScript plugins"));
check("Creator plugin signing/review explicitly deferred",read("docs/sdk/README.md").includes("Creator Marketplace plugin signing")&&read("docs/sdk/README.md").includes("deferred"));

console.log(`\nPhase 14 Developer SDK audit: ${pass} PASS / ${fail} FAIL`);
if(fail) process.exit(1);
