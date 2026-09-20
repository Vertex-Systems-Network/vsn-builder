import assert from 'node:assert/strict';
import fs from 'node:fs';
import { widgetRegistry } from '../app/builder/widgetRegistry.js';
import { ANIMATE_CSS_PRESET_COUNT, GENERATED_VSN_PRESET_COUNT } from '../app/data/motion-preset-catalog.js';
import { builtinMotionPresets } from '../app/services/motion-library.server.js';

const read=(file)=>fs.readFileSync(file,'utf8'); const exists=(file)=>fs.existsSync(file); const checks=[];
const check=(name,fn)=>{try{fn();checks.push([name,true]);}catch(error){checks.push([name,false,error?.message||String(error)]);}};
const pkg=JSON.parse(read('package.json')); const baseline=JSON.parse(read('BASELINE.json'));

check('Release preserves the Milestone M.2+ baseline',()=>{const parts=String(pkg.version).split('.').map(Number);assert.ok(parts[0]>2||(parts[0]===2&&(parts[1]>5||(parts[1]===5&&parts[2]>=72))),`version ${pkg.version}`);assert.equal(baseline.version,pkg.version);assert.ok((['M','N','O'].includes(baseline.milestone)||/^(P\.|Q\.)/.test(String(baseline.milestone||''))),`milestone ${baseline.milestone}`);});
check('Runtime preserves Milestone M wishlist/motion schema v2',()=>{const s=read('app/config/baseline.js');assert.match(s,/wishlist: 2/);assert.match(s,/motionLibrary: [2-9]/);});
check('Wishlist database model exists',()=>{const s=read('prisma/schema.prisma');assert.match(s,/model\s+BuilderWishlist/);assert.match(s,/@@unique\(\[shop, customerId\]\)/);});
check('Wishlist migration exists',()=>assert.equal(exists('prisma/migrations/20260808234530_milestone_m2_wishlist/migration.sql'),true));
check('Wishlist Grid is registered',()=>assert.equal(widgetRegistry['wishlist-grid']?.label,'Wishlist Grid'));
check('Wishlist Empty State is registered',()=>assert.equal(widgetRegistry['wishlist-empty-state']?.label,'Wishlist Empty State'));
check('Registry contains 117 widgets after M.2',()=>assert.equal(Object.keys(widgetRegistry).length,117));
check('Wishlist storefront has four runtime widgets',()=>{const s=read('app/sdk/builtinPlugins.js');for(const token of ['data-vsn-wishlist-button','data-vsn-wishlist-count','data-vsn-wishlist-grid','data-vsn-wishlist-empty-state'])assert.ok(s.includes(token),token);});
check('Wishlist server supports get save merge and live resolution',()=>{const s=read('app/services/wishlist.server.js');for(const token of ['getCustomerWishlist','saveCustomerWishlist','mergeWishlistItems','resolveWishlistLive','wishlistResponse'])assert.ok(s.includes(token),token);});
check('App proxy uses signed customer identity',()=>{const route=read('app/routes/builder-proxy.$.jsx');const secureRoute=read('app/routes/builder-proxy-secure.$.jsx');const service=read('app/services/wishlist-proxy.server.js');assert.match(secureRoute,/handleWishlistProxyAction/);assert.match(route,/handleWishlistProxyLoader/);assert.doesNotMatch(route,/handleWishlistProxyAction/);assert.match(service,/logged_in_customer_id/);assert.match(service,/wishlist-sync/);assert.match(service,/wishlistResponse/);});
check('Theme runtime performs local-server merge',()=>{const s=read('extensions/vsn-page-builder-theme/assets/vsn-wishlist.js');assert.match(s,/version: 2/);assert.match(s,/loadServerWishlist/);assert.match(s,/server-merge/);assert.match(s,/wishlist-sync/);assert.match(s,/refreshMarketSnapshots/);});
check('Wishlist grid is responsive and removable',()=>{const s=read('extensions/vsn-page-builder-theme/assets/vsn-wishlist.js');assert.match(s,/data-vsn-wishlist-remove-key/);const css=read('extensions/vsn-page-builder-theme/assets/vsn-wishlist.css');assert.match(css,/--vsn-wishlist-cols-desktop/);assert.match(css,/--vsn-wishlist-cols-tablet/);assert.match(css,/--vsn-wishlist-cols-mobile/);});
check('Marketplace contains editable Wishlist Page',()=>{const s=read('app/services/library-presets.server.js');assert.match(s,/id: "starter-wishlist"/);assert.match(s,/type:"wishlist-grid"/);assert.match(s,/type:"wishlist-empty-state"/);});
check('Wishlist is included in backup restore and uninstall cleanup',()=>{const backup=read('app/routes/app.backups.jsx');assert.match(backup,/version: 9/);assert.match(backup,/commerce: \{ wishlists/);assert.match(backup,/builderWishlist\.deleteMany/);const uninstall=(read('app/routes/webhooks.app.uninstalled.jsx')+read('app/services/shop-data-lifecycle.server.js'));assert.match(uninstall,/builderWishlist\.deleteMany/);});
check('Wishlist customer privacy webhooks use compliance_topics',()=>{
  for(const file of ['app/routes/webhooks.customers.data_request.jsx','app/routes/webhooks.customers.redact.jsx','app/routes/webhooks.shop.redact.jsx']) assert.equal(exists(file),true,file);
  const toml=read('shopify.app.toml');
  for(const topic of ['customers/data_request','customers/redact','shop/redact']){
    const escaped=topic.replace('/', '\\/');
    assert.match(toml,new RegExp(`uri\\s*=\\s*[\"']\/webhooks\/${escaped}[\"'][\\s\\S]*?compliance_topics\\s*=\\s*\\[[^\\]]*[\"']${escaped}[\"']`),`Missing compliance_topics subscription for ${topic}`);
    assert.doesNotMatch(toml,new RegExp(`(?:^|\\n)\\s*topics\\s*=\\s*\\[[^\\]]*[\"']${escaped}[\"']`),`Compliance topic must not be declared as normal topics: ${topic}`);
  }
});
check('Animate.css catalog is complete at 97 presets',()=>assert.equal(ANIMATE_CSS_PRESET_COUNT,97));
check('VSN ships at least 800 additional modern presets',()=>assert.ok(GENERATED_VSN_PRESET_COUNT>=800,`found ${GENERATED_VSN_PRESET_COUNT}`));
check('Generated VSN motion count is 960',()=>assert.equal(GENERATED_VSN_PRESET_COUNT,960));
check('Built-in motion catalog retains at least the 1,061 M.2 baseline',()=>assert.ok(builtinMotionPresets().length>=1061,`found ${builtinMotionPresets().length}`));
check('Motion catalog includes modern elastic and robust families',()=>{const names=builtinMotionPresets().map(x=>`${x.name} ${x.category}`).join('\n');for(const token of ['VSN Modern','VSN Elastic','VSN Robust','VSN Spring','VSN Cinematic'])assert.ok(names.includes(token),token);});
check('Motion library renders incrementally',()=>{const s=read('app/components/builder-panel/MotionLibraryPanel.jsx');assert.match(s,/72/);assert.match(s,/Load 72 more/);});
check('Developer Studio light code contrast is explicit',()=>{for(const file of ['app/styles/dashboard.scss','app/styles/dashboard.css']){const s=read(file);assert.match(s,/dashboard-root:not\(\.dark\) \.vsn-code-editor-shell textarea/);assert.match(s,/color:#111827!important/);assert.match(s,/-webkit-text-fill-color:#111827!important/);assert.match(s,/caret-color:#111827!important/);}});
check('M.2 docs exist',()=>{assert.equal(exists('docs/user/wishlist.md'),true);assert.equal(exists('docs/engineering/motion-catalog.md'),true);assert.equal(exists('VSN_MILESTONE_M2_WISHLIST_MOTION_REPORT_v2.5.71.md'),true);});

for(const [name,pass,msg] of checks)console.log(`${pass?'PASS':'FAIL'} ${name}${msg?`: ${msg}`:''}`);
const failed=checks.filter(([,pass])=>!pass); console.log(`Milestone M.2 wishlist + motion audit: ${checks.length-failed.length}/${checks.length} PASS`); if(failed.length)process.exit(1);
