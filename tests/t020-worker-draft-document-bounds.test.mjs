import test from "node:test";
import assert from "node:assert/strict";
import {assertBoundedBuilderDraftDocument} from "../app/services/worker-shopify-draft-document.js";
import {encodeVerifiedBuilderDraft} from "../app/services/worker-shopify-page-draft-save.js";
import {createVerifiedMerchantPageContentLease} from "../app/services/worker-shopify-page-content.js";

const shop="one.myshopify.com";
const id="ckbuilder123";
function reader(raw) {
  const db={builderPage:{async findFirst(){
    return {id,shop,version:2,updatedAt:new Date("2026-10-15T12:00:00Z"),contentJson:raw};
  }}};
  return createVerifiedMerchantPageContentLease(db,shop).get(id);
}
const deniesSave=(value)=>assert.throws(()=>encodeVerifiedBuilderDraft(value),
  error=>error.status===400 && error.code==="INVALID_DRAFT_NODES");

test("ordinary nested editor JSON round-trips across exactly the same contract",async()=>{
  const elements=[{id:"hero",type:"section",props:{
    title:"Welcome",children:[{id:"button",type:"cta",props:{text:"Shop now"}}],
    columns:3,active:true,spacing:null,
  }}];
  assert.equal(assertBoundedBuilderDraftDocument(elements),elements);
  const raw=encodeVerifiedBuilderDraft(elements);
  assert.deepEqual((await reader(raw)).elements,elements);
});

test("deep editor documents are refused on save AND on hydration",async()=>{
  let nested={leaf:"text"};
  for(let i=0;i<66;i++)nested={children:nested};
  const elements=[nested];
  deniesSave(elements);
  await assert.rejects(reader(JSON.stringify(elements)),
    /structural limits/);
});

test("nested oversized arrays and sparse arrays cannot bypass the top-level node count",async()=>{
  const nested=[{content:{items:Array.from({length:5001},(_,i)=>i)}}];
  deniesSave(nested);
  await assert.rejects(reader(JSON.stringify(nested)),/Invalid Builder editor array/);
  const sparse=[{items:new Array(5)}];
  deniesSave(sparse);
});

test("object keys used in prototype pollution cannot reach editor renderers",async()=>{
  const payload='[{"id":"hero","props":{"__proto__":{"isAdmin":true}}}]';
  const parsed=JSON.parse(payload);
  deniesSave(parsed);
  await assert.rejects(reader(payload),/Unsafe Builder editor object key/);
  for(const key of ["prototype","constructor"]){
    const raw=JSON.stringify([{id:"hero",props:{[key]:{isAdmin:true}}}]);
    deniesSave(JSON.parse(raw));
    await assert.rejects(reader(raw),/Unsafe Builder editor object key/);
  }
});

test("non-JSON values and executing getters are rejected before serialization",()=>{
  deniesSave([{value:Infinity}]);
  deniesSave([{value:NaN}]);
  deniesSave([{value:undefined}]);
  deniesSave([{value:()=>1}]);
  deniesSave([{value:new Date()}]);
  let invoked=false;
  const untrusted={};
  Object.defineProperty(untrusted,"danger",{enumerable:true,get(){
    invoked=true;throw Error("must never execute editor getter");
  }});
  deniesSave([untrusted]);
  const accessorArray=[0];
  Object.defineProperty(accessorArray,"0",{enumerable:true,get(){
    invoked=true;throw Error("must never execute array getter");
  }});
  deniesSave([accessorArray]);
  assert.equal(invoked,false);
});
