import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EMAIL_STARTERS, starterInput } from '../app/services/email-builder.server.js';
import { renderEmailHtml, renderEmailPlainText } from '../app/services/email-renderer.server.js';

const read=(file)=>fs.readFileSync(file,'utf8');const exists=(file)=>fs.existsSync(file);const checks=[];
function check(name,fn){try{fn();checks.push([name,true]);console.log(`PASS ${name}`);}catch(error){checks.push([name,false]);console.error(`FAIL ${name}: ${error.message}`);}}

const pkg=JSON.parse(read('package.json'));const baseline=JSON.parse(read('BASELINE.json'));
check('Release retains Milestone N email foundation',()=>{assert.ok((['N','O'].includes(baseline.milestone)||/^(P\.|Q\.)/.test(String(baseline.milestone||''))));assert.ok(Number(pkg.version.split('.').at(-1))>=74);assert.equal(pkg.version,baseline.version);});
check('Runtime exposes Email Builder schema contracts',()=>{const s=read('app/config/baseline.js');for(const key of ['emailBuilder','emailDocument','emailRenderer'])assert.match(s,new RegExp(`${key}\\s*:\\s*[1-9]`));});
check('Email Builder persistence model exists',()=>{const s=read('prisma/schema.prisma');assert.match(s,/model\s+BuilderEmailTemplate/);assert.match(s,/documentJson\s+String/);assert.match(s,/compiledHtml\s+String/);assert.match(s,/plainText\s+String/);});
check('Email Builder migration is packaged',()=>{const file='prisma/migrations/20260808234540_milestone_n1_email_builder/migration.sql';assert.equal(exists(file),true);assert.match(read(file),/CREATE TABLE "BuilderEmailTemplate"/);});
check('Email documents are separate from web page renderer',()=>{const schema=read('app/email/emailSchema.js');const renderer=read('app/email/emailRenderer.js');assert.match(schema,/schemaVersion:[1-9]/);assert.doesNotMatch(renderer,/PreviewRenderer|renderBuilder|page-renderer/);});
check('Email renderer produces table-safe HTML',()=>{const html=renderEmailHtml(starterInput('welcome').documentJson,{subject:'Test'});assert.match(html,/<!doctype html>/i);assert.match(html,/<table role="presentation"/);assert.match(html,/font-family:/);});
check('Email renderer produces plain text',()=>assert.ok(renderEmailPlainText(JSON.parse(starterInput('welcome').documentJson)).length>40));
check('Seven official starter email templates ship',()=>{assert.equal(EMAIL_STARTERS.length,7);for(const key of ['welcome','newsletter','promotion','product-launch','abandoned-cart','order-update','back-in-stock'])assert.ok(EMAIL_STARTERS.some((x)=>x.key===key),key);});
check('Every starter compiles to HTML and plain text',()=>{for(const item of EMAIL_STARTERS){const input=starterInput(item.key);assert.match(input.compiledHtml,/<table/);assert.ok(input.plainText.trim().length>20,item.key);}});
check('Email Builder route and management panel exist',()=>{assert.equal(exists('app/routes/app.email-builder.jsx'),true);assert.equal(exists('app/components/builder-panel/EmailBuilderPanel.jsx'),true);const route=read('app/routes/app.email-builder.jsx');for(const token of ['intent==="create"','intent==="update"','intent==="duplicate"','intent==="trash"','intent==="restore"','intent==="hard-delete"'])assert.ok(route.includes(token),token);});
check('Email Builder is wired to role-aware navigation',()=>{const perms=read('app/utils/builder-permissions.js');const side=read('app/components/dashboard/Sidebar.jsx');const config=read('app/config/builder-panels.js');assert.match(perms,/key:"emailBuilder"/);assert.match(perms,/"email-builder":"emailBuilder"/);assert.match(side,/Email Builder/);assert.match(config,/"email-builder": "\/app\/email-builder"/);});
check('Email Builder is lazy-loaded through the unified panel shell',()=>{const panels=read('app/services/builder-panels.server.js');const contract=read('app/components/builder-panel/panel-contract.js');const host=read('app/components/BuilderPanelHost.jsx');assert.match(panels,/emailBuilderPanelLoader/);assert.match(contract,/"email-builder"/);assert.match(host,/EmailBuilderPanel/);});
check('Sidebar count reads persisted email templates',()=>{const shell=read('app/routes/app.jsx');assert.match(shell,/builderEmailTemplate\.count/);assert.match(shell,/emailTemplates: emailTemplateCount/);});
check('Backup v9 includes Email Builder templates',()=>{const backup=read('app/routes/app.backups.jsx');assert.match(backup,/version: 9/);assert.match(backup,/email: \{ templates:/);assert.match(backup,/builderEmailTemplate\.deleteMany/);assert.match(backup,/payload\.email\?\.templates/);});
check('Uninstall cleanup removes Email Builder data',()=>assert.match((read('app/routes/webhooks.app.uninstalled.jsx')+read('app/services/shop-data-lifecycle.server.js')),/builderEmailTemplate\.deleteMany/));
check('Email Builder docs are packaged',()=>{for(const file of ['docs/user/email-builder.md','docs/engineering/email-renderer.md','VSN_MILESTONE_N1_EMAIL_BUILDER_REPORT_v2.5.74.md','MILESTONE_N1_DEVELOPER_MODE.md'])assert.equal(exists(file),true,file);});
check('N.1 remains development-only and does not send email',()=>{const report=read('VSN_MILESTONE_N1_EMAIL_BUILDER_REPORT_v2.5.74.md');assert.match(report,/Sending-provider integrations.*deferred|Sending-provider integrations/);assert.doesNotMatch(read('app/routes/app.email-builder.jsx'),/sendEmail|smtp|sendgrid|mailgun|resend/i);});

const failed=checks.filter(([,ok])=>!ok);console.log(`Milestone N.1 Email Builder audit: ${checks.length-failed.length}/${checks.length} PASS`);if(failed.length)process.exit(1);
