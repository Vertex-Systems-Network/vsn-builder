import test from "node:test";
import assert from "node:assert/strict";
import {inspectBlock,inspectThemeExtension} from "../scripts/t032-theme-extension-static-audit.mjs";

const assets=new Set(["widget.js","widget.css"]);
const block=({
 name="Test block",target="section",settings=[{type:"text",id:"title",label:"Title"}],
 stylesheet="widget.css",javascript="widget.js",
}={})=>'{% schema %}'+JSON.stringify({name,target,settings,stylesheet,javascript})+'{% endschema %}';

test("all actual extension blocks have valid schema and existing local CSS/JS dependencies",()=>{
 const actual=inspectThemeExtension();
 assert.deepEqual(actual.failures,[]);
 assert(actual.blocks>=20);
 assert(actual.assets>=10);
 assert.equal(actual.fixtureThemesVerified,false);
 assert.equal(actual.hostedThemeCompatibilityVerified,false);
 for(const entry of actual.inspected)assert(entry.errors.length===0,entry.name);
});
test("duplicate setting IDs, missing assets, unsafe paths and unknown Liquid target fail",()=>{
 assert.equal(inspectBlock("safe.liquid",block(),assets).errors.length,0);
 assert(inspectBlock("duplicate.liquid",block({
  settings:[{type:"text",id:"test"},{type:"text",id:"test"}],
 }),assets).errors.some(x=>x.includes("Duplicate")));
 assert(inspectBlock("missing.liquid",block({javascript:"absent.js"}),assets)
  .errors.some(x=>x.includes("Missing/unsafe asset")));
 assert(inspectBlock("traversal.liquid",block({javascript:"../widget.js"}),assets)
  .errors.some(x=>x.includes("Missing/unsafe asset")));
 assert(inspectBlock("target.liquid",block({target:"script"}),assets)
  .errors.some(x=>x.includes("Unsupported")));
});
test("malformed JSON, missing schema, empty settings and invalid range default fail",()=>{
 assert(inspectBlock("invalid.liquid","{% schema %}{INVALID}{% endschema %}",assets)
  .errors.some(x=>x.includes("JSON")));
 assert(inspectBlock("missing.liquid","<div></div>",assets).errors.length>0);
 assert(inspectBlock("empty.liquid",block({settings:null}),assets)
  .errors.includes("Missing settings array"));
 assert(inspectBlock("range.liquid",block({
  settings:[{type:"range",id:"gap",min:0,max:100,step:5,default:500}],
 }),assets).errors.some(x=>x.includes("Invalid range")));
});
test("Liquid asset_url dependencies must point to packaged extension files",()=>{
 const linked=block()+"\n<script src=\"{{ 'missing.js' | asset_url }}\"></script>";
 assert(inspectBlock("linked.liquid",linked,assets)
  .errors.some(x=>x.includes("missing.js")));
});
