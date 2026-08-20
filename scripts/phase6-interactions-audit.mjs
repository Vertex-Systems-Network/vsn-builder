import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VSN_BASELINE } from '../app/config/baseline.js';
import {
  INTERACTION_SCHEMA_VERSION,
  MOTION_TRIGGER_OPTIONS,
  MOTION_ACTION_OPTIONS,
  MOTION_TARGET_OPTIONS,
  createMotionTimeline,
  createMotionAction,
  createInteractionPreset,
  normalizeElementInteractions,
  motionConflictWarnings,
  timelinesFromLegacyPresets,
} from '../app/builder/interactionSchema.js';
import { migrateBuilderContent } from '../app/builder/schemaMigrations.js';
import { compileThemeAssets, collectRuntimeDependencies } from '../app/services/theme-assets.server.js';

const checks=[]; const check=(name,fn)=>{try{fn();checks.push([name,true]);}catch(e){checks.push([name,false,e.message]);}};
check('Phase 6 baseline or later',()=>assert.ok(VSN_BASELINE.completedPhases?.includes(6)&&VSN_BASELINE.phase>=6&&VSN_BASELINE.schema.interactions>=3));
check('Interaction schema v3 or later',()=>assert.ok(INTERACTION_SCHEMA_VERSION>=3));
check('Required triggers present',()=>{const v=new Set(MOTION_TRIGGER_OPTIONS.map(x=>x.value));for(const x of ['page-load','viewport-enter','viewport-exit','click','hover','focus','scroll-progress','mouse-move','form-submit','cart-event','custom-event'])assert.ok(v.has(x),x);});
check('Required actions present',()=>{const v=new Set(MOTION_ACTION_OPTIONS.map(x=>x.value));for(const x of ['animate','show','hide','class-toggle','style-variable','scroll-to','media-play','media-pause','popup-open','custom-event'])assert.ok(v.has(x),x);});
check('Target modes present',()=>{const v=new Set(MOTION_TARGET_OPTIONS.map(x=>x.value));for(const x of ['self','child','sibling','component-slot','page-selector'])assert.ok(v.has(x),x);});
check('Timeline timing model normalizes',()=>{const t=createMotionTimeline({timeline:{duration:800,delay:100,stagger:50,repeat:2,yoyo:true,easing:'ease-in-out'}});assert.equal(t.timeline.duration,800);assert.equal(t.timeline.stagger,50);assert.equal(t.timeline.repeat,2);assert.equal(t.timeline.yoyo,true);});
check('Actions support from/to frames',()=>{const a=createMotionAction({from:{opacity:0,y:20},to:{opacity:1,y:0}});assert.equal(a.from.opacity,0);assert.equal(a.to.opacity,1);});
check('Multiple timelines normalize',()=>{const i=normalizeElementInteractions({timelines:[createMotionTimeline(),createMotionTimeline()]});assert.equal(i.timelines.length,2);assert.equal(i.schemaVersion,INTERACTION_SCHEMA_VERSION);});
check('Legacy sticky/parallax preserved',()=>{const i=normalizeElementInteractions({sticky:true,parallax:true,stickyBoundary:'section'});assert.equal(i.sticky,true);assert.equal(i.parallax,true);assert.equal(i.stickyBoundary,'section');});
check('Legacy presets can convert',()=>assert.equal(timelinesFromLegacyPresets({entrance:'fade-up',hover:'lift'}).length,2));
check('Reusable preset library works',()=>assert.equal(createInteractionPreset('fade-up').trigger.type,'viewport-enter'));
check('Conflict detector warns',()=>{const a=createMotionTimeline(),b=createMotionTimeline();assert.ok(motionConflictWarnings({timelines:[a,b]}).length>0);});
check('Document migration reaches v3',()=>{const content=migrateBuilderContent([{id:'x',type:'heading',props:{text:'A'},styles:{},interactions:{entrance:'fade-up'},children:[]}]);const meta=content.find(x=>x.type==='template-settings')?.props?.__vsn;assert.equal(meta.documentSchemaVersion,3);assert.equal(meta.interactionSchemaVersion,INTERACTION_SCHEMA_VERSION);const node=content.find(x=>x.id==='x');assert.equal(node.interactions.schemaVersion,INTERACTION_SCHEMA_VERSION);});
const panel=fs.readFileSync('app/components/editor/InteractionTimelinePanel.jsx','utf8');
check('Editor exposes Trigger Timeline Actions',()=>{assert.match(panel,/Trigger → Conditions → Timeline → Actions/);assert.match(panel,/Add Action/);assert.match(panel,/Preview Interaction/);});
check('Editor exposes conditions',()=>{assert.match(panel,/Media Query/);assert.match(panel,/Selector Exists/);assert.match(panel,/Attribute Equals/);});
check('Editor exposes presets and convert',()=>{assert.match(panel,/Fade Up/);assert.match(panel,/Convert/);});
const canvas=fs.readFileSync('app/components/editor/Canvas.jsx','utf8');
const preview=fs.readFileSync('app/components/editor/PreviewRenderer.jsx','utf8');
const proxy=fs.readFileSync('app/routes/builder-proxy.$.jsx','utf8');
check('Canvas emits motion payload and runtime',()=>{assert.match(canvas,/data-vsn-motion/);assert.match(canvas,/setupInteractionRuntime/);});
check('Preview initializes same runtime',()=>{assert.match(preview,/setupInteractionRuntime/);assert.match(preview,/data-vsn-motion/);});
check('Storefront emits motion payload',()=>assert.match(proxy,/data-vsn-motion/));
const runtime=fs.readFileSync('extensions/vsn-page-builder-theme/assets/vsn-interactions.js','utf8');
check('Storefront runtime covers reduced motion',()=>assert.match(runtime,/prefers-reduced-motion/));
check('Storefront runtime covers observers and events',()=>{assert.match(runtime,/IntersectionObserver/);assert.match(runtime,/scroll-progress/);assert.match(runtime,/mouse-move/);assert.match(runtime,/cart:updated/);});
check('Storefront high-frequency UI triggers use delegation',()=>{assert.match(runtime,/registerDelegated/);assert.match(runtime,/delegated = \{ click/);});
check('Storefront runtime covers target modes',()=>{assert.match(runtime,/component-slot/);assert.match(runtime,/page-selector/);assert.match(runtime,/sibling/);});
const liquid=fs.readFileSync('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid','utf8');
const core=fs.readFileSync('extensions/vsn-page-builder-theme/assets/vsn-page-renderer.js','utf8');
check('Interaction runtime is dependency-loaded',()=>{assert.match(liquid,/vsn-interactions\.js/);assert.match(core,/loadRuntimeDependency/);assert.match(core,/runtimeDependencies/);});
const sampleTimeline=createMotionTimeline({trigger:{type:'click'},actions:[createMotionAction({type:'class-toggle',className:'active'})]});
const sampleNode={id:'motion-x',type:'heading',label:'Motion',props:{text:'Hello'},styles:{},interactions:{timelines:[sampleTimeline]},children:[]};
check('Asset dependency detects advanced interactions',()=>assert.ok(collectRuntimeDependencies([[sampleNode]]).includes('interactions')));
check('Static template needs no generated template JS',()=>{const content=[{id:'__vsn_template_settings__',type:'template-settings',props:{__vsn:{documentSchemaVersion:3}},styles:{},children:[]},sampleNode];const build=compileThemeAssets([{id:'p1',title:'Motion Page',handle:'motion',template:'page',status:'published',publishedJson:JSON.stringify(content),publishedVersion:1}],{});assert.equal(build.jsFileCount,0);assert.ok(build.manifest.entries[0].dependencies.includes('interactions'));});
const component=fs.readFileSync('app/builder/componentSystem.js','utf8');
check('Component slot targets are marked',()=>assert.match(component,/__vsnComponentSlotName/));
for(const [name,ok,msg] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}${msg?`: ${msg}`:''}`);
const failed=checks.filter(x=>!x[1]);
console.log(`Phase 6 Interaction/Motion audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length) process.exit(1);
