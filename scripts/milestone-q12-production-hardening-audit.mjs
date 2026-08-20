import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const checks=[];let failed=0;
function check(name,ok,detail=""){checks.push({name,ok,detail});if(!ok)failed++;console.log(`${ok?"PASS":"FAIL"} ${name}${detail?` · ${detail}`:""}`);}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const runtimeBaseline=read("app/config/baseline.js");
const patchVersion=(value)=>Number(String(value||"0.0.0").split(".").at(-1)||0);
check("Q release version",patchVersion(pkg.version)>=81&&patchVersion(baseline.version)>=81&&/version:\s*"2\.5\.(?:8[1-9]|9\d|\d{3,})"/.test(runtimeBaseline));
check("Q milestone marker",/^Q\./.test(String(baseline.milestone||""))&&/milestone:\s*"Q\./.test(runtimeBaseline));

const web=read("shopify.web.toml");
check("Dev database fail-fast",web.includes('predev = "npm run db:prepare"')&&web.includes('dev = "npm exec react-router dev"'));
const pkgScripts=pkg.scripts||{};
check("Database prepare pipeline",String(pkgScripts["db:prepare"]||"").includes("prepare-database.mjs")&&String(pkgScripts.setup||"").includes("db:prepare"));
check("Legacy migration repair packaged",fs.existsSync(path.join(root,"scripts/repair-legacy-migration-history.mjs"))&&read("scripts/repair-legacy-migration-history.mjs").includes("migrate","resolve"));
check("Database schema gate packaged",fs.existsSync(path.join(root,"scripts/database-schema-check.mjs"))&&fs.existsSync(path.join(root,"app/services/database-health.server.js")));

const email=read("app/routes/app.email-builder.jsx");
const emailService=read("app/services/email-builder.server.js");
check("Email Builder schema guard",email.includes('ensureFeatureSchema(db,"emailBuilder")')&&email.includes("VSN_SCHEMA_NOT_READY"));
check("Email Builder does not hide missing table",!emailService.includes('builderEmailTemplate.findMany({where:{shop},orderBy:{updatedAt:"desc"}}).catch'));

const app=read("app/routes/app.jsx");
const boundary=read("app/components/ui/AppRuntimeBoundary.jsx");
check("App runtime recovery boundary",app.includes("<AppRuntimeBoundary")&&boundary.includes("unhandledrejection")&&boundary.includes("/app/client-errors"));
check("Security response headers",app.includes("applyVsnSecurityHeaders")&&read("app/utils/request-security.server.js").includes("X-Content-Type-Options"));

const sensitive=["app.developer-studio.jsx","app.platform-intelligence.jsx","app.plugins.jsx","app.role-manager.jsx","app.control-center.jsx","app.backups.jsx","app.widget-studio.jsx","app.svg-assets.jsx","app.fonts.jsx","app.builder.$id.jsx","app.pages.jsx","app.client-errors.jsx","app.email-builder.jsx","app.builder-panel.$panel.jsx"];
for(const file of sensitive){const text=read(`app/routes/${file}`);check(`Mutation origin guard ${file}`,text.includes("assertTrustedMutationRequest(request)"));}
check("Dashboard mutation origin guard",read("app/services/dashboard-actions.server.js").includes("assertTrustedMutationRequest(request)"));

const proxy=read("app/routes/builder-proxy.$.jsx");
check("App proxy signature authentication",proxy.includes("authenticate.public.appProxy(request)"));
for(const file of ["webhooks.app.uninstalled.jsx","webhooks.app.scopes_update.jsx","webhooks.customers.data_request.jsx","webhooks.customers.redact.jsx","webhooks.shop.redact.jsx","webhooks.orders.paid.jsx"]){check(`Webhook authentication ${file}`,read(`app/routes/${file}`).includes("authenticate.webhook(request)"));}

const security=read("app/utils/security.server.js");
check("SVG executable-content hardening",security.includes("foreignObject")&&security.includes("javascript\\s*:")&&security.includes("on[a-z0-9:_-]+"));
const globalCode=read("app/services/global-code.server.js");
check("Global JS critical-risk blocking",globalCode.includes("criticalGlobalCodeRisks")&&globalCode.includes("eval() is blocked")&&globalCode.includes("document.write() is blocked"));
check("Global JS unsafe runtime filtering",globalCode.includes("globalCodeMatches(row, context) && criticalGlobalCodeRisks"));
const clientErrors=read("app/routes/app.client-errors.jsx");
check("Client error privacy trimming",clientErrors.includes("sanitizePlainText")&&clientErrors.includes("parsed.origin")&&clientErrors.includes("parsed.pathname"));

const control=read("app/routes/app.control-center.jsx");
check("System Health migration schema status",control.includes("getRuntimeSchemaHealth")&&control.includes("schemaHealth.expectedMigrationApplied")&&control.includes("schema:schemaHealth"));

const actionFiles=fs.readdirSync(path.join(root,"app/routes")).filter((name)=>name.startsWith("app.")&&name.endsWith(".jsx")).filter((name)=>/export\s+(?:async\s+function\s+action|const\s+action)/.test(read(`app/routes/${name}`)));
const authExceptions=new Set(["app.jsx"]);
const unauth=actionFiles.filter((name)=>!authExceptions.has(name)&&!read(`app/routes/${name}`).includes("authenticate.admin(request")&&!read(`app/routes/${name}`).includes("authenticate.admin(request.clone"));
check("Admin action authentication coverage",unauth.length===0,unauth.length?unauth.join(", "):`${actionFiles.length} action route(s)`);

check("Q docs packaged",fs.existsSync(path.join(root,"docs/user/runtime-recovery.md"))&&fs.existsSync(path.join(root,"docs/developer/runtime-security.md")));
console.log(`\nMilestone Q.1-Q.2 audit: ${checks.length-failed}/${checks.length} PASS`);
if(failed)process.exit(1);
