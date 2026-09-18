import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { deriveTemplateMetadata, templateTableQueryFromUrl } from "../app/services/template-management.server.js";
import { resolveScriptDatabaseLocation } from "./lib/database-location.mjs";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const dashboard=read("app/components/Dashboard.jsx");
const dataKit=read("app/components/ui/VsnDataViewKit.jsx");
const pages=read("app/routes/app.pages.jsx");
const service=read("app/services/template-management.server.js");
const bulkService=read("app/services/template-dashboard-actions.server.js");
const editorSettings=read("app/components/editor/PageSettingsPanel.jsx");
const editorRoute=read("app/routes/app.builder.$id.jsx");
const createModal=read("app/components/CreatePageModal.jsx");
const schema=read("prisma/schema.prisma");
const migrationPath="prisma/migrations/20260810013000_templates_management_final_qa/migration.sql";
const migration=read(migrationPath);
const css=read("app/styles/dashboard.css");
const databaseLocation=resolveScriptDatabaseLocation({cwd:process.cwd(),env:process.env});
const databaseFile=databaseLocation.file;
if(!databaseFile)throw new Error(`Milestone Q.6 audit requires a SQLite DATABASE_URL; resolved ${databaseLocation.url}`);

await check("Version retains v2.5.98+ Templates baseline",()=>{const parts=pkg.version.split(".").map(Number);assert.ok(parts[0]>2||(parts[0]===2&&(parts[1]>5||(parts[1]===5&&parts[2]>=98))))});
await check("Baseline remains on Q.6 lineage",()=>assert.match(String(baseline.milestone||""),/^Q\.6(?:\.|$)/));
await check("Q6 audit is part of release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q6-templates-final-qa-audit.mjs")));
await check("Q6 dedicated QA command exists",()=>assert.equal(pkg.scripts?.["qa:q6"],"node scripts/milestone-q6-templates-final-qa-audit.mjs"));
await check("Q6 Developer Mode report exists",()=>assert.equal(exists("MILESTONE_Q6_DEVELOPER_MODE.md"),true));
await check("Q6 final QA report exists",()=>assert.equal(exists("VSN_MILESTONE_Q6_TEMPLATES_MANAGEMENT_FINAL_QA_REPORT_v2.5.98.md"),true));
await check("Templates user documentation exists",()=>assert.equal(exists("docs/user/templates-management.md"),true));

await check("Screen title is Templates",()=>assert.match(dashboard,/<h1>Templates<\/h1>/));
await check("Create action is merchant-facing Create template",()=>assert.match(dashboard,/>Create template<\/Button>/));
await check("Widget cards include icons",()=>assert.ok(dashboard.includes("vsn-pages-stat-icon")&&dashboard.includes("icon: FileText")));
await check("Widget visual treatment follows dashboard-stat style",()=>assert.ok(css.includes(".vsn-pages-stat-top")&&css.includes("rgba(92,106,196,.1)")));

for(const label of ["Checkbox","Image","Title","Status","Template","View","Updated","Created Date","Pages","SEO Score","Author"]){
  await check(`Table column exists: ${label}`,()=>assert.ok(dashboard.includes(`label: "${label}"`)));
}
for(const sort of ["status","template","views","updated","created","pages","seo","author"]){
  await check(`DB sort field exists: ${sort}`,()=>assert.ok(service.includes(`"${sort}":`)));
}
await check("Column visibility is persisted",()=>assert.ok(dashboard.includes("visibleColumns")&&dashboard.includes("SETTINGS_KEY")));
await check("Checkbox column can be hidden from Page Settings",()=>assert.ok(dashboard.includes('key: "select", label: "Checkbox"')));
await check("Floating settings control exists",()=>assert.ok(dashboard.includes("VsnDataViewSettings")&&dataKit.includes("VsnFloatingSettingsButton")));
await check("Widget visibility settings exist",()=>assert.ok(dashboard.includes("visibleWidgets")&&dashboard.includes("Templates settings")));
await check("Default records-per-page is 12",()=>assert.equal(templateTableQueryFromUrl(new URL("https://vsn.local/app/pages")).pageSize,12));
await check("Page size is sent to database query",()=>assert.ok(service.includes("take: query.pageSize")&&dashboard.includes('params.set("pageSize",')));

await check("Status filters include requested sequence",()=>assert.ok(dashboard.includes('const FILTERS = ["All", "Published", "Draft", "Trash", "Scheduled"]')));
await check("Search is positioned with Grid/List controls",()=>assert.ok(dashboard.includes("vsn-template-primary-right")&&dashboard.includes("vsn-pages-search")&&dashboard.includes("VsnDataViewToggle")));
await check("List icon appears before Grid icon",()=>assert.ok(dataKit.indexOf('aria-label="List view"')<dataKit.indexOf('aria-label="Grid view"')));
await check("Loaded-list search is immediate",()=>assert.ok(dashboard.includes("immediateRows")&&dashboard.includes("records.filter")));
await check("Search automatically falls back to DB",()=>assert.ok(dashboard.includes("tableFetcher.load")&&dashboard.includes("setTimeout(() => loadTable()")));
await check("DB search exposes a loading state",()=>assert.ok(dashboard.includes("Searching database…")&&dashboard.includes("vsn-template-spin")));
await check("Server table mode exists for smart search",()=>assert.ok(pages.includes('searchParams.get("mode") === "table"')));
await check("Search query is applied server-side",()=>assert.ok(service.includes("where.OR")&&service.includes("title: { contains: query.search }")));
await check("Search query keeps DB filters",()=>{const q=templateTableQueryFromUrl(new URL("https://vsn.local/app/pages?q=hero&status=published&seoScore=90&author=A&page=2&pageSize=24&sort=author&direction=asc"));assert.equal(q.search,"hero");assert.equal(q.filter,"published");assert.equal(q.seoScore,90);assert.equal(q.author,"A");assert.equal(q.page,2);assert.equal(q.pageSize,24);assert.equal(q.sort,"author");assert.equal(q.direction,"asc")});
await check("Table query omits full editor JSON payloads",()=>{const start=service.indexOf("const TEMPLATE_TABLE_SELECT");const end=service.indexOf("const SORT_FIELDS");const selection=service.slice(start,end);assert.doesNotMatch(selection,/contentJson|publishedJson/)});

await check("Master checkbox exists",()=>assert.ok(dashboard.includes("masterRef")&&dashboard.includes("Select all templates on this page")));
await check("Individual List checkboxes exist",()=>assert.ok(dashboard.includes('aria-label={`Select ${page.title}`}')));
await check("Grid bulk selection exists",()=>assert.ok(dashboard.includes("vsn-page-grid-select")&&dashboard.includes("toggleSelect(page.id)")));
for(const action of ["Trash","Draft","Scheduled","Publish"]){await check(`Bulk action exists: ${action}`,()=>assert.ok(dashboard.includes(`label: "${action}"`)))}
await check("Bulk actions use icon-bearing custom menu",()=>assert.ok(dataKit.includes("VsnDataViewBulkMenu")&&dataKit.includes("<Icon size={14}/>{action.label}")));
await check("Bulk action is disabled until selection",()=>assert.ok(dashboard.includes("const disabled = !selectedIds.size || busy")));
await check("Bulk server authorization is enforced",()=>assert.ok(bulkService.includes("canAccessBuilderAction")&&bulkService.includes("requiredPermission")));

await check("Scheduled action uses custom modal",()=>assert.ok(dashboard.includes('title="Schedule selected templates"')));
await check("Scheduled modal has date picker",()=>assert.ok(dashboard.includes('type="date" value={scheduleDate}')));
await check("Scheduled modal has time picker",()=>assert.ok(dashboard.includes('type="time" value={scheduleTime}')));
await check("Server rejects past schedules",()=>assert.ok(bulkService.includes("Scheduled date/time must be in the future.")));
await check("ScheduledAt persists in BuilderPage schema",()=>assert.match(schema,/scheduledAt\s+DateTime\?/));

await check("Sort dropdown is DB-backed",()=>assert.ok(dashboard.includes("sortField")&&dashboard.includes('params.set("sort",')&&service.includes("orderByFor")));
await check("Date filter includes Custom",()=>assert.ok(dashboard.includes('<option value="custom">Custom…</option>')));
await check("Custom date range modal exists",()=>assert.ok(dashboard.includes('title="Custom date range"')));
await check("Custom date range has Start Date",()=>assert.ok(dashboard.includes("Start Date")));
await check("Custom date range has End Date",()=>assert.ok(dashboard.includes("End Date")));
await check("Date range is applied server-side",()=>assert.ok(service.includes("where.createdAt = range")));

await check("SEO filter facets are DB-derived",()=>assert.ok(service.includes("seoScores")&&service.includes("select: { template: true, seoScore: true, createdBy: true }")));
await check("SEO filter is available in List/Grid common controls",()=>assert.ok(dashboard.includes("All SEO scores")));
await check("Author facet is DB-derived",()=>assert.ok(service.includes("authors")&&dashboard.includes("All authors")));
await check("Created Date uses DB createdAt",()=>assert.ok(dashboard.includes("formatDate(page.createdAt)")&&schema.includes("createdAt       DateTime")));

await check("Top pagination exists in secondary row",()=>assert.ok(dashboard.includes("vsn-template-row is-secondary")&&dashboard.includes("<VsnDataViewPagination page={currentPage}")));
await check("Bottom Bulk Action + Pagination exists",()=>assert.ok(dashboard.includes("vsn-template-bottom-bar")&&dashboard.includes("<BulkDropdown bottom")));
await check("Page change scrolls to screen start",()=>assert.ok(dashboard.includes("scrollIntoView")&&dashboard.includes('block: "start"')));
await check("Pagination applies to List and Grid shared data",()=>assert.ok(dashboard.includes("displayRows.map")&&dashboard.includes('viewMode === "list"')&&dashboard.includes('viewMode === "grid"')));

for(const action of ["Visit Page","Duplicate","Rename","Export","Trash"]){await check(`Item action is available in shared List/Grid menu: ${action}`,()=>assert.ok(dashboard.includes(`"${action}"`)))}
await check("List and Grid share ActionMenu",()=>assert.ok((dashboard.match(/<ActionMenu/g)||[]).length>=2));
await check("Rename uses custom VSN modal",()=>assert.ok(dashboard.includes('title="Rename template"')&&dashboard.includes("Current Name")&&dashboard.includes("New Name")));
await check("Pages route contains no browser alert/confirm/prompt",()=>assert.doesNotMatch(pages,/window\.(?:alert|confirm|prompt)\s*\(/));
await check("Templates dashboard contains no browser alert/confirm/prompt",()=>assert.doesNotMatch(dashboard,/window\.(?:alert|confirm|prompt)\s*\(/));

await check("Campaign types are removed from Templates Create list",()=>assert.doesNotMatch(createModal,/Campaign|announcement-overlay|floating-element|\["popup"/));
await check("Author is persisted on new Templates",()=>assert.ok(schema.includes('createdBy       String    @default("Store owner")')&&pages.includes("createdBy: builderActorName")));
await check("Import path persists author",()=>assert.ok(read("app/services/page-transfer.server.js").includes('createdBy:actor || "Store owner"')));

await check("Template Image editor section exists",()=>assert.ok(editorSettings.includes('>Image</p>')&&editorSettings.includes('<Field label="Image URL">')));
await check("Template Image uses Shopify Files picker",()=>assert.ok(editorSettings.includes("openShopifyFilePicker")&&editorSettings.includes("Choose from Shopify Files")));
await check("Template image derives from template settings",()=>{const result=deriveTemplateMetadata({page:{title:"QA"},content:[{type:"template-settings",props:{templateImage:"https://cdn.example.com/template.jpg"}}]});assert.equal(result.templateImage,"https://cdn.example.com/template.jpg")});
await check("Editor save persists template image metadata",()=>assert.ok(editorRoute.includes("templateImage: templateMetadata.templateImage")));
await check("Editor save persists SEO score metadata",()=>assert.ok(editorRoute.includes("seoScore: templateMetadata.seoScore")));
await check("List uses persisted template image",()=>assert.ok(dashboard.includes("page.templateImage")&&dashboard.includes("TemplateThumb")));
await check("Grid uses the same TemplateThumb",()=>assert.ok(dashboard.includes("<TemplateThumb page={page} large")));

await check("Template table metadata fields exist in Prisma schema",()=>{for(const field of ["views","templateImage","seoScore","pageCount","createdBy","scheduledAt"])assert.ok(schema.includes(field))});
await check("Q6 migration exists",()=>assert.equal(exists(migrationPath),true));
await check("Migration is additive to BuilderPage",()=>{assert.match(migration,/ALTER TABLE "BuilderPage" ADD COLUMN "views"/);assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM|DROP COLUMN/i)});
await check("Migration adds query indexes",()=>assert.ok(migration.includes("BuilderPage_shop_deletedAt_status_updatedAt_idx")&&migration.includes("BuilderPage_shop_deletedAt_seoScore_createdBy_idx")));
await check("Packaged SQLite has all Q6 columns",()=>{const db=new DatabaseSync(databaseFile,{readOnly:true});const cols=db.prepare("PRAGMA table_info('BuilderPage')").all().map((row)=>row.name);db.close();for(const field of ["views","templateImage","seoScore","pageCount","createdBy","scheduledAt"])assert.ok(cols.includes(field),field)});
await check("Packaged SQLite records Q6 migration checksum",()=>{const checksum=crypto.createHash("sha256").update(fs.readFileSync(migrationPath)).digest("hex");const db=new DatabaseSync(databaseFile,{readOnly:true});const row=db.prepare("SELECT checksum FROM _prisma_migrations WHERE migration_name=?").get("20260810013000_templates_management_final_qa");db.close();assert.equal(row?.checksum,checksum)});

await check("Bulk publish preserves collaboration lock guard",()=>assert.ok(bulkService.includes("getBlockingPageLock")&&bulkService.includes("Locked by")));
await check("Bulk publish preserves approval workflow",()=>assert.ok(bulkService.includes("Approve this template before publishing.")));
await check("Export has dedicated optimized server mode",()=>assert.ok(pages.includes('searchParams.get("mode") === "export"')&&pages.includes("makePagePackage(exportPage, exportSections")));
await check("Responsive Templates controls exist",()=>assert.ok(css.includes("@media(max-width:720px)")&&css.includes("vsn-template-primary-right")));
await check("Dark-mode Templates overrides exist",()=>assert.ok(css.includes(".dashboard-root.dark .vsn-template-row.is-secondary")&&css.includes(".dashboard-root.dark .vsn-template-modal")));
await check("Q5 exact Shopify handles remain untouched",()=>{const plans=read("app/config/commercialPlans.js");for(const handle of ["free","sliver","gold","platenium"])assert.ok(plans.includes(handle))});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6 Templates Final QA audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
