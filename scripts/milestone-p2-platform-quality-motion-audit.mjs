import assert from 'node:assert/strict';
import fs from 'node:fs';
import { builtinMotionDuplicateReport, builtinMotionPresets } from '../app/services/motion-library.server.js';
import { MOTION_REFERENCE_LIBRARIES, REFERENCE_LIBRARY_COUNT, REFERENCE_MOTION_CANDIDATE_COUNT } from '../app/data/motion-reference-catalog.js';
import { BUILDER_RESOURCE_DEFINITIONS } from '../app/utils/builder-permissions.js';

const read=(f)=>fs.readFileSync(f,'utf8'); const exists=(f)=>fs.existsSync(f); const checks=[];
function check(label,fn){try{fn();checks.push([label,true]);console.log(`PASS ${label}`);}catch(error){checks.push([label,false]);console.error(`FAIL ${label}: ${error.message}`);}}
const pkg=JSON.parse(read('package.json')); const baseline=JSON.parse(read('BASELINE.json'));
const presets=builtinMotionPresets(); const refs=presets.filter((row)=>row.tokens?.referenceOnly); const sourceIds=new Set(refs.map((row)=>row.source));
const canonical=(row)=>String(row.tokens?.sourceEffect||row.tokens?.className||row.name).replace(/^animate__/,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

check('P.2 capabilities retained in current release',()=>{assert.ok(Number(pkg.version.split('.').at(-1))>=80);assert.equal(pkg.version,baseline.version);assert.ok(baseline.milestone==='P.2'||String(baseline.milestone||'').startsWith('Q.')); });
check('All 12 requested reference libraries are registered',()=>{assert.equal(REFERENCE_LIBRARY_COUNT,12);for(const id of ['hovercss','all-animation','magic','tuesday','reboundgen','csshake','wickedcss','woah','obnoxious','infinite','micron','mimic'])assert.ok(MOTION_REFERENCE_LIBRARIES.some((row)=>row.id===id),id);});
check('Reference catalog contains over 300 named candidates',()=>assert.ok(REFERENCE_MOTION_CANDIDATE_COUNT>=300,`found ${REFERENCE_MOTION_CANDIDATE_COUNT}`));
check('At least 250 deduplicated reference presets ship',()=>assert.ok(refs.length>=250,`found ${refs.length}`));
check('Every requested library contributes at least one retained preset',()=>{for(const row of MOTION_REFERENCE_LIBRARIES)assert.ok(sourceIds.has(row.id),row.id);});
check('Built-in canonical effect names are deduplicated',()=>{const seen=new Set();for(const row of presets){const key=canonical(row);assert.equal(seen.has(key),false,`duplicate canonical effect ${key}`);seen.add(key);}});
check('Duplicate report records removed aliases instead of cards',()=>assert.ok(builtinMotionDuplicateReport().length>=10));
check('Strobe and black-mirror references are accessibility-safe',()=>{for(const row of refs.filter((r)=>/strobe|black mirror|flicker|blink/i.test(r.name))){assert.equal(row.tokens?.safeAdaptation,true,row.name);assert.equal(row.timeline?.timeline?.reducedMotion,'skip',row.name);}});
check('No third-party reference CSS/JS is bundled into theme assets',()=>{const names=MOTION_REFERENCE_LIBRARIES.map(r=>r.id);const assets=fs.readdirSync('extensions/vsn-page-builder-theme/assets').join('\n').toLowerCase();for(const id of names)assert.equal(assets.includes(id),false,id);});
check('Motion Library exposes reference counts and duplicate count',()=>{const s=read('app/components/builder-panel/MotionLibraryPanel.jsx');for(const token of ['Reference libraries','Reference effects','Duplicates removed'])assert.ok(s.includes(token),token);});
check('P.2 platform-quality server contracts exist',()=>{for(const f of ['app/services/platform-p2.server.js','app/services/command-bus.server.js','app/builder/editorCommand.js','app/components/dashboard/platform/PlatformQualityPanel.jsx'])assert.ok(exists(f),f);});
check('Visual regression structural baseline and Playwright runner are wired',()=>{const s=read('app/services/platform-p2.server.js');assert.match(s,/buildVisualRegressionReport/);assert.match(s,/captureVisualBaselines/);assert.ok(exists('tests/e2e/visual-regression.spec.mjs'));assert.match(String(JSON.parse(read('package.json')).scripts['qa:visual-regression']),/visual-regression\.spec\.mjs/);});
check('Performance budget measures page pressure without blocking publish',()=>{const s=read('app/services/platform-p2.server.js');for(const token of ['nodes','contentBytes','mediaRefs','customCodeBytes','externalOrigins'])assert.ok(s.includes(token),token);});
check('Extension Permission Sandbox reuses SDK manifest policy',()=>{const s=read('app/services/platform-p2.server.js');assert.match(s,/validatePluginManifest/);assert.match(s,/VSN_PLUGIN_ALLOWED_PERMISSIONS/);assert.match(s,/evaluateExtensionManifest/);});
check('Migration Simulator runs migrateBuilderContent in dry-run mode',()=>{const s=read('app/services/platform-p2.server.js');assert.match(s,/simulateReleaseMigrations/);assert.match(s,/migrateBuilderContent/);assert.match(s,/dryRun:true/);});
check('Platform command bus uses database transactions and audit IDs',()=>{const s=read('app/services/command-bus.server.js');assert.match(s,/\$transaction/);assert.match(s,/commandId/);assert.match(s,/builderAuditLog\.create/);});
check('Editor normal commit path assigns command IDs',()=>{const s=read('app/components/editor/PageEditor.jsx');assert.match(s,/createEditorCommand/);assert.match(s,/editorHistoryEntry/);});
check('P.2 platform permissions are granular',()=>{const row=BUILDER_RESOURCE_DEFINITIONS.find((item)=>item.key==='platform');const actions=new Set(row.actions.map((x)=>x.key));for(const key of ['view','manage_tokens','run_qa','manage_extensions','simulate_migrations'])assert.ok(actions.has(key),key);});
check('Platform Intelligence UI exposes Quality & Release',()=>{const route=read('app/routes/app.platform-intelligence.jsx');assert.match(route,/Quality & Release/);assert.match(route,/PlatformQualityPanel/);});
check('P.2 docs and report are packaged',()=>{for(const f of ['docs/user/platform-quality.md','docs/developer/platform-p2.md','MILESTONE_P2_DEVELOPER_MODE.md','VSN_MILESTONE_P2_PLATFORM_QUALITY_MOTION_REPORT_v2.5.80.md'])assert.ok(exists(f),f);});
check('P.2 introduces no Prisma migration',()=>{const dirs=fs.readdirSync('prisma/migrations',{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);assert.equal(dirs.filter(x=>/p2|2\.5\.80/i.test(x)).length,0);});

const failed=checks.filter(([,ok])=>!ok);console.log(`Milestone P.2 platform quality + motion audit: ${checks.length-failed.length}/${checks.length} PASS`);if(failed.length)process.exit(1);
