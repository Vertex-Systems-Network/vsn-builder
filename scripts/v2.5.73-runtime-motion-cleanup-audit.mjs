import assert from 'node:assert/strict';
import fs from 'node:fs';
import { builtinMotionPresets } from '../app/services/motion-library.server.js';

const read=(file)=>fs.readFileSync(file,'utf8');
const checks=[];
function check(name,fn){try{fn();checks.push([name,true]);console.log(`PASS ${name}`);}catch(error){checks.push([name,false]);console.error(`FAIL ${name}: ${error.message}`);}}

function normalizedName(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function timelineSignature(value){
  const clean=(input)=>{
    if(Array.isArray(input))return input.map(clean);
    if(input&&typeof input==='object'){
      const out={};
      for(const key of Object.keys(input).sort())if(!['id','name'].includes(key))out[key]=clean(input[key]);
      return out;
    }
    return input;
  };
  return JSON.stringify(clean(value));
}

check('npm config no longer contains pnpm-only shamefully-hoist',()=>assert.doesNotMatch(read('.npmrc'),/shamefully-hoist/));
check('Theme Liquid has no direct remote app-proxy CSS or JS tags',()=>{const liquid=read('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid');assert.doesNotMatch(liquid,/<(?:link|script)[^>]+(?:href|src)="\/apps\/vsn-builder\/runtime/i);});
check('Theme Global Code loader is served as a Shopify extension asset',()=>{const liquid=read('extensions/vsn-page-builder-theme/blocks/vsn-page-renderer.liquid');assert.match(liquid,/vsn-global-code-loader\.js' \| asset_url/);assert.ok(fs.existsSync('extensions/vsn-page-builder-theme/assets/vsn-global-code-loader.js'));});
check('Global Code loader preserves storefront context',()=>{const loader=read('extensions/vsn-page-builder-theme/assets/vsn-global-code-loader.js');for(const token of ['template','visitorPath','language','country','market'])assert.match(loader,new RegExp(token));assert.match(loader,/globalCode/);});

const presets=builtinMotionPresets();
check('Duplicate legacy Fade In preset is removed',()=>assert.equal(presets.filter((item)=>normalizedName(item.name)==='fade in').length,1));
check('Duplicate legacy Zoom In preset is removed',()=>assert.equal(presets.filter((item)=>normalizedName(item.name)==='zoom in').length,1));
check('Built-in motion names are unique',()=>{const names=new Set();for(const item of presets){const key=normalizedName(item.name);assert.equal(names.has(key),false,`duplicate ${item.name}`);names.add(key);}});
check('Animate.css still exposes all 97 named presets',()=>assert.equal(presets.filter((item)=>item.source==='animate.css').length,97));
check('VSN generated catalog still exposes 960 modern presets',()=>assert.equal(presets.filter((item)=>item.source==='vsn').length,960));
check('Built-in motion catalog retains the 1,061 cleanup baseline or later expansion',()=>assert.ok(presets.length>=1061,`found ${presets.length}`));
check('Animate.css timelines are behavior-distinct after diagonal direction repair',()=>{const signatures=new Set();for(const item of presets.filter((entry)=>entry.source==='animate.css')){const sig=timelineSignature(item.timeline);assert.equal(signatures.has(sig),false,`duplicate behavior ${item.name}`);signatures.add(sig);}});
check('React Router v8 future flags are not enabled without a compatibility migration',()=>{const vite=read('vite.config.js');assert.doesNotMatch(vite,/v8_(?:middleware|splitRouteModules|viteEnvironmentApi|passThroughRequests|trailingSlashAwareDataRequests)\s*:\s*true/);});

const failed=checks.filter(([,ok])=>!ok);
console.log(`v2.5.73 runtime + motion cleanup audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
