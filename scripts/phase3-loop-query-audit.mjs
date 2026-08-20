import assert from "node:assert/strict";
import fs from "node:fs";
import { widgetRegistry, createWidget } from "../app/builder/widgetRegistry.js";
import { auditWidgetCapabilityCoverage } from "../app/builder/widgetCapabilities.js";
import { auditWidgetStyleProfiles } from "../app/builder/widgetStyleProfiles.js";
import { QUERY_SOURCE_OPTIONS, QUERY_AST_VERSION, normalizeQueryDefinition, createLoopItemTemplate, queryCostEstimate, applyQueryFilters, normalizeLoopItem } from "../app/builder/queryBuilder.js";
import { VSN_BASELINE } from "../app/config/baseline.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pass = [];
const check = (name, condition) => { assert.ok(condition, name); pass.push(name); };

check("Phase 3 baseline present", Number(VSN_BASELINE.phase) >= 3);
check("Query schema v2", QUERY_AST_VERSION === 2 && VSN_BASELINE.schema.queries === 2);
const sourceValues = QUERY_SOURCE_OPTIONS.map((x) => x.value);
check("Seven generic Shopify sources preserved", sourceValues.slice(0, 7).join(",") === "products,collections,blogs,articles,search,metaobjects,metafield-references");
check("Phase 14 SDK provider extends query sources", Number(VSN_BASELINE.phase) < 14 || sourceValues.includes("sdk-provider"));
check("Registry contains Loop", Object.keys(widgetRegistry).length >= 111 && widgetRegistry.loop?.acceptsChildren === true);
const loop = createWidget("loop");
check("Loop creates reusable Loop Item", loop?.children?.length === 1 && loop.children[0]?.props?.__loopItem === true);
check("Loop Item contains dynamic children", createLoopItemTemplate().children.some((node)=>node.bindings?.["props.text"] || node.bindings?.["props.src"]));
const normalized = normalizeQueryDefinition({ source:"products", limit:999, offset:-2, pagination:"load-more", filters:[{field:"vendor",operator:"contains",value:"Acme"}] });
check("Query AST normalizes limits", normalized.limit === 50 && normalized.offset === 0 && normalized.pagination === "load-more");
check("Cost estimator produces guardrail", ["low","medium","high"].includes(queryCostEstimate({source:"metaobjects",limit:50,filters:Array.from({length:8},()=>({field:"field",operator:"contains",value:"x"}))}).level));
const filtered = applyQueryFilters([normalizeLoopItem({id:"1",title:"A",vendor:"Acme"}),normalizeLoopItem({id:"2",title:"B",vendor:"Other"})], {source:"products",filters:[{field:"vendor",operator:"equals",value:"Acme"}],limit:10});
check("Visual query filters execute", filtered.length === 1 && filtered[0].title === "A");
const caps = auditWidgetCapabilityCoverage(Object.keys(widgetRegistry));
const profiles = auditWidgetStyleProfiles(Object.keys(widgetRegistry));
check("Capability matrix covers registry", caps.covered === Object.keys(widgetRegistry).length && caps.missing.length === 0);
check("Style profiles cover registry", profiles.profiled === Object.keys(widgetRegistry).length && profiles.valid === true);

const properties = read("app/components/editor/PropertiesPanel.jsx");
check("Inspector exposes Loop Query panel", properties.includes("Loop Query & Repeater") && properties.includes("Preview query results") && properties.includes("Query estimate"));
const dynamic = read("app/builder/dynamicBindings.js");
check("Loop Item dynamic sources registered", dynamic.includes('loop.title') && dynamic.includes('loop.image.url') && dynamic.includes('loop.meta'));
const editorRoute = read("app/routes/app.builder.$id.jsx");
check("Editor query preview endpoint wired", editorRoute.includes('intent === "query-preview"') && editorRoute.includes("runShopifyLoopQuery"));
const engine = read("app/services/query-engine.server.js");
for (const token of ["products(first:","collections(first:","blogs(first:","articles(first:","metaobjects(first:","references(first:"]) check(`Server query source ${token}`, engine.includes(token));
const storefront = read("app/routes/builder-proxy.$.jsx");
check("Storefront loads Loop query data", storefront.includes("loadLoopQueryData") && storefront.includes('case "loop"') && storefront.includes("renderLoop"));
check("Storefront Loop pagination endpoint", storefront.includes("loopQueryMode") && storefront.includes("requestedLoopAfter") && storefront.includes("data-vsn-loop-load-more"));
const runtime = read("extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js");
check("Storefront Load More runtime", runtime.includes("initializeLoopLoadMore") && runtime.includes("loopQuery") && runtime.includes("insertAdjacentHTML"));
const migration = read("app/builder/schemaMigrations.js");
check("Schema migration stamps query version", migration.includes("querySchemaVersion") && migration.includes("CURRENT_SCHEMA.queries"));

console.log(`Phase 3 Loop/Query audit PASS (${pass.length}/${pass.length})`);
for (const name of pass) console.log(`✓ ${name}`);
