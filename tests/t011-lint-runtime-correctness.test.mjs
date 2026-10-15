import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SECTION_PRESETS, createSectionPreset } from "../app/data/sectionPresets.js";

test("Canvas hooks run before conditional hidden-node return", () => {
  const source=readFileSync("app/components/editor/Canvas.jsx","utf8");
  const start=source.indexOf("function RenderNode(");
  const end=source.indexOf("function ",start+17);
  assert.ok(start>=0,"expected actual editor renderer");
  const body=source.slice(start,end>start?end:undefined);
  const firstReturn=body.indexOf("if (node?.meta?.hidden === true) return null;");
  assert.ok(firstReturn>0,"hidden-node early return must remain");
  for(const expression of [
    "useContext(LoopItemContext)",
    "useContext(ComponentLibraryContext)",
    "useContext(ComponentStackContext)",
    "useContext(ResponsiveConfigContext)",
    "useContext(WidgetTemplateContext)",
    "useState(\"\")",
    "useRef(0)",
    "useRef(\"\")",
  ]){
    const hook=body.indexOf(expression);
    assert.ok(hook>=0 && hook<firstReturn,
      expression+" must execute before hidden-node return");
  }
});

test("paid media resolver action has a real database binding",()=>{
  const source=readFileSync("app/routes/app.editor-media.jsx","utf8");
  assert.match(source,/import db from ["']\\.\\.\\/db\\.server\\.js["']/);
  assert.match(source,/const paidDenial=await paidMutationDenied\\(db,session\\.shop\\)/);
  const importAt=source.indexOf("import db from");
  const guardAt=source.indexOf("paidMutationDenied(db,session.shop)");
  assert.ok(importAt>=0&&guardAt>importAt);
});

test("section preset registry is dense, ordered and constructible",()=>{
  assert.ok(SECTION_PRESETS.length>=20);
  const ids=SECTION_PRESETS.map(preset=>preset?.id);
  assert.equal(ids.length,new Set(ids).size,"duplicate or undefined preset IDs");
  assert.ok(SECTION_PRESETS.every(preset=>Boolean(preset?.id&&preset?.node?.type)));
  assert.ok(Array.from({length:SECTION_PRESETS.length},(_,i)=>i)
    .every(i=>Object.hasOwn(SECTION_PRESETS,i)),"sparse index cannot be offered to editor");
  const hero=createSectionPreset("hero-centered");
  assert.equal(hero.type,"section");
  assert.ok(Array.isArray(hero.children)&&hero.children.length>=2);
  assert.ok(hero.children.every(item=>typeof item.id==="string"&&item.id!=="x"));
});
