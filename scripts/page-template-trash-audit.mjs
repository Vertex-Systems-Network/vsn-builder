import fs from 'node:fs';
import sqlite3 from 'node:sqlite';

const read=(file)=>fs.readFileSync(file,'utf8');
let failures=0; const pass=(name,ok)=>{console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failures++;};
const schema=read('prisma/schema.prisma');
const pages=read('app/routes/app.pages.jsx');
const dash=read('app/components/Dashboard.jsx');
const assets=read('app/services/theme-assets.server.js');
const proxy=read('app/routes/builder-proxy.$.jsx');
const editor=read('app/routes/app.builder.$id.jsx');
const shopify=read('app/services/shopify-pages.server.js');

pass('BuilderPage has soft-delete timestamp', /model BuilderPage[\s\S]*deletedAt\s+DateTime\?/.test(schema));
pass('BuilderPage remembers trashed asset filenames', /trashedAssetsJson\s+String\?/.test(schema));
pass('BuilderPage has trash index', schema.includes('@@index([shop, deletedAt, updatedAt])'));
pass('Pages loader separates active and Trash', pages.includes('deletedAt: null') && pages.includes('deletedAt: { not: null }') && /trash:\s*trash[\s\S]{0,180}\.map/.test(pages));
pass('Dashboard exposes Trash tab', dash.includes('"Trash"') && dash.includes('normalizedTrash'));
pass('Dashboard exposes Restore', dash.includes('onRestorePage') && dash.includes('<RotateCcw'));
pass('Dashboard exposes Delete forever', dash.includes('onHardDeletePage') && dash.includes('Delete forever'));
pass('Page delete is soft-delete', pages.includes('data: { deletedAt: new Date() }'));
pass('Restore clears deletedAt', pages.includes('data: { deletedAt: null }'));
pass('Editor delete moves to Trash', editor.includes('data:{deletedAt:new Date()}') && editor.includes('trashTemplateThemeAssets'));
pass('Theme assets use themeFilesDelete', assets.includes('themeFilesDelete(themeId:$themeId,files:$files)'));
pass('Trash removes manifest entry', assets.includes('manifestWithoutPage') && assets.includes('trashTemplateThemeAssets'));
pass('Restore recompiles hashed asset', assets.includes('restoreTemplateThemeAssets') && assets.includes('compileThemeAssets(pages'));
pass('Restore writes generated asset before manifest switch', assets.includes('await upsertThemeFiles(admin, theme.id, files)') && assets.includes('manifestWithEntry'));
pass('Standard rebuild excludes Trash', assets.includes('status: "published", deletedAt: null'));
pass('Storefront resolver excludes Trash', proxy.includes('deletedAt: null') && proxy.includes('status: "published"'));
pass('Editor loader excludes Trash', editor.includes('where: { id: pageId, shop: session.shop, deletedAt: null }'));
pass('Linked Shopify Page can be unpublished/restored', shopify.includes('setShopifyPagePublished') && shopify.includes('isPublished: Boolean(isPublished)'));
pass('Trash audit action exists', pages.includes('action: "template.trashed"'));
pass('Restore audit action exists', pages.includes('action: "template.restored"'));

try {
  const db=new sqlite3.DatabaseSync('prisma/dev.sqlite');
  const cols=db.prepare('PRAGMA table_info("BuilderPage")').all().map(r=>r.name);
  pass('Packaged SQLite has deletedAt', cols.includes('deletedAt'));
  pass('Packaged SQLite has trashedAssetsJson', cols.includes('trashedAssetsJson'));
  db.close();
} catch (e) { console.error(e); failures++; }

if(failures){ console.error(`Page template Trash audit failed: ${failures}`); process.exit(1); }
console.log('Page template Trash audit PASS');
