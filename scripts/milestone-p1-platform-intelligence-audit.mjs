import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(); let pass=0,fail=0;
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const exists=(file)=>fs.existsSync(path.join(root,file));
const has=(file,text)=>exists(file)&&read(file).includes(text);
function check(ok,label){if(ok){console.log(`PASS  ${label}`);pass++;}else{console.error(`FAIL  ${label}`);fail++;}}
const pkg=JSON.parse(read('package.json'));
const baseline=JSON.parse(read('BASELINE.json'));
check(baseline.version===pkg.version&&/^(P\.|Q\.)/.test(String(baseline.milestone||'')),'Package baseline retains P.1 capabilities in a later post-roadmap release');
check(/platformIntelligence:\s*[1-9]/.test(read('app/config/baseline.js'))&&has('app/config/baseline.js','designTokens: 2')&&/milestone:\s*"(?:P|Q)\./.test(read('app/config/baseline.js')),'Runtime baseline exposes P.1 contracts or compatible later versions');
check(exists('MILESTONE_P1_DEVELOPER_MODE.md')&&exists('VSN_MILESTONE_P1_PLATFORM_INTELLIGENCE_REPORT_v2.5.78.md'),'P.1 release documentation is packaged');

check(exists('app/routes/app.platform-intelligence.jsx')&&exists('app/services/platform-intelligence.server.js'),'Platform Intelligence route and server service are packaged');
check(has('app/services/platform-intelligence.server.js','buildUsageGraph')&&has('app/services/platform-intelligence.server.js','scanLibraryDependencies'),'Usage Graph scans VSN library dependencies');
for(const token of ["type:'widget'","type:'component'","type:'font'","type:'svg'","type:'query'","type:'binding'","type:'condition'","type:'motion'","type:'email-binding'","type:'global-code-target'"]) check(has('app/services/platform-intelligence.server.js',token),`Usage Graph includes ${token}`);
check(has('app/routes/app.platform-intelligence.jsx','Usage Graph')&&has('app/routes/app.platform-intelligence.jsx','Design Tokens 2.0'),'Platform Intelligence UI exposes both workspaces');
check(has('app/routes/app.platform-intelligence.jsx',"canAccessBuilderAction(db,session,'platform','manage_tokens')")&&has('app/routes/app.platform-intelligence.jsx','builderActor(session)'),'Token writes are permission-checked and audited with session identity');

check(exists('app/builder/designTokens2.js'),'Design Tokens 2.0 contract is packaged');
for(const token of ['DESIGN_TOKEN_SYSTEM_VERSION = 2','DEFAULT_SEMANTIC_ALIASES','normalizeDesignTokenDocument','serializeDesignTokenDocument','semanticCssVariables','__vsn2']) check(has('app/builder/designTokens2.js',token),`Design Tokens 2.0 includes ${token}`);
check(has('app/services/theme-assets.server.js','semanticCssVariables')&&has('app/services/theme-assets.server.js','prefers-color-scheme: dark')&&has('app/services/theme-assets.server.js','--vsn-text')&&has('app/services/theme-assets.server.js','--vsn-bg'),'Storefront CSS resolves semantic and dark-mode tokens');
check(has('app/routes/app.control-center.jsx','__vsn2'),'Legacy Control Center preserves Design Tokens 2.0 metadata');

check(has('app/utils/builder-permissions.js','platformIntelligence')&&has('app/utils/builder-permissions.js','manage_tokens'),'Platform Intelligence system/action permissions are registered');
check(has('app/components/dashboard/Sidebar.jsx',"id: 'platform-intelligence'")&&has('app/routes/app.jsx','"platform-intelligence": "/app/platform-intelligence"'),'Sidebar and app-shell routing expose Platform Intelligence');
check(exists('app/components/dashboard/AppCommandPalette.jsx')&&has('app/components/dashboard/AppCommandPalette.jsx','Ctrl/Cmd + K')&&has('app/components/dashboard/AppCommandPalette.jsx','platform-intelligence'),'App-wide role-aware command palette is packaged');
check(has('app/routes/app.jsx','<AppCommandPalette'),'Command palette is mounted in the shared app shell');

check(has('app/builder/dynamicBindings.js','inspectDynamicBindings')&&has('app/components/editor/AdvancedBuilderControls.jsx','DynamicBindingInspector'),'Dynamic Binding Inspector resolves and displays bindings');
check(has('app/components/editor/PropertiesPanel.jsx','context={bindingContext}')&&has('app/components/editor/AdvancedBuilderControls.jsx','<DynamicBindingInspector element={element} context={context}')&&has('app/components/editor/PageEditor.jsx','bindingContext'),'Editor passes preview binding context into the inspector');
const ruleFiles=['app/components/editor/AdvancedBuilderControls.jsx','app/components/editor/Canvas.jsx','app/builder/commerceConditions.js','extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js'];
for(const rule of ['cart-empty','cart-has-items','cart-items-min','product-inventory-min','product-inventory-max']) check(ruleFiles.every((file)=>has(file,rule)),`Condition runtime parity includes ${rule}`);
check(has('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid','cartItemCount')&&has('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid','productInventory'),'Theme Liquid context exposes cart and inventory values');

check(exists('docs/user/platform-intelligence.md')&&exists('docs/developer/platform-intelligence.md'),'Platform Intelligence user/developer docs are packaged');
check(has('app/components/dashboard/documentation/docsCatalog.js',"id:'platform-intelligence'")&&has('app/components/dashboard/documentation/DocsContent.jsx',"active==='platform-intelligence'"),'In-app Documentation covers Platform Intelligence');
check(String(pkg.scripts?.['qa:milestone-p1']||'').includes('milestone-p1-platform-intelligence-audit.mjs'),'P.1 QA command is registered');
check(String(pkg.scripts?.['qa:release']||'').includes('node scripts/milestone-p1-platform-intelligence-audit.mjs'),'Release QA retains P.1 audit');
const p1MigrationCount=fs.readdirSync(path.join(root,'prisma/migrations'),{withFileTypes:true}).filter((e)=>e.isDirectory()&&/p1|platform[_-]?intelligence|2\.5\.78/i.test(e.name)).length;
check(p1MigrationCount===0,'P.1 introduces no Prisma migration');
console.log(`\nMilestone P.1 Platform Intelligence audit: ${pass} passed, ${fail} failed.`); if(fail)process.exit(1);
