import assert from "node:assert/strict";
import {
  registerVsnPlugin,
  listVsnPlugins,
  getVsnWidgetDefinition,
  getVsnWidgetControls,
  getVsnDataProvider,
} from "../app/sdk/registry.js";
import { renderVsnStorefrontWidget, prepareVsnSdkNodesForSave } from "../app/sdk/runtime.js";
import { validatePluginManifest } from "../app/sdk/validation.js";
import { vsnElement } from "../app/sdk/renderDescriptor.js";
import { resolveVsnDataProvider } from "../app/sdk/dataProviders.server.js";

const manifest={schemaVersion:1,id:"test.fixture",name:"SDK Test Fixture",version:"1.2.3",compatibility:{min:"2.5.50",maxExclusive:"3.0.0"},permissions:["editor:controls","storefront:render"],widgets:[]};
assert.equal(validatePluginManifest(manifest,{appVersion:"2.5.50"}).ok,true);
registerVsnPlugin({manifest,setup(api){
  api.registerWidget({
    id:"fixture-card",label:"Fixture Card",category:"Plugin",defaults:{props:{text:"Hello"},styles:{}},
    controls:[{key:"text",type:"text",label:"Text"}],
    renderers:{storefront:({node})=>vsnElement("div",{},node.props?.text||"")},
    hooks:{save:({node})=>({...node,props:{...node.props,text:String(node.props?.text||"").trim()}})},
  });
  api.registerDataProvider({id:"fixture:items",label:"Fixture items",resolve:async(context)=>[{id:"1",title:context.admin?"Unsafe":"One"}]});
}});
assert.equal(getVsnWidgetDefinition("fixture-card")?.pluginId,"test.fixture");
assert.equal(getVsnWidgetControls("fixture-card").length,1);
assert.equal(renderVsnStorefrontWidget({id:"x",type:"fixture-card",props:{text:"Hello"}}).value,"<div>Hello</div>");
const saved=await prepareVsnSdkNodesForSave([{id:"x",type:"fixture-card",props:{text:"  Saved  "},children:[]}]);
assert.equal(saved[0].props.text,"Saved");
assert.equal((await getVsnDataProvider("fixture:items").resolve({admin:{unsafe:true}}))[0].title,"Unsafe");
assert.equal((await resolveVsnDataProvider("fixture:items",{admin:{unsafe:true},shop:"test.myshopify.com"},{}))[0].title,"One");
assert.equal(listVsnPlugins().some(plugin=>plugin.manifest.id==="test.fixture"&&plugin.status==="active"),true);
console.log("VSN SDK test harness PASS");
