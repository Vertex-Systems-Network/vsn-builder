import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { safeImageTarget } from "../app/services/stock-images.server.js";
import { STOCK_AUDIO_PROVIDERS, STOCK_IMAGE_PROVIDERS, STOCK_VIDEO_PROVIDERS, loadStockProviderCredentials } from "../app/services/stock-image-integrations.server.js";

const read=(file)=>fs.readFileSync(file,"utf8");
const exists=(file)=>fs.existsSync(file);
const versionAtLeast=(value,min)=>{const a=String(value).split(".").map(Number),b=String(min).split(".").map(Number);for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av!==bv)return av>bv;}return true;};
const checks=[];
async function check(name,fn){try{await fn();checks.push([name,true]);console.log(`PASS  ${name}`)}catch(error){checks.push([name,false]);console.error(`FAIL  ${name}: ${error.message}`)}}

const pkg=JSON.parse(read("package.json"));
const baseline=JSON.parse(read("BASELINE.json"));
const baselineJs=read("app/config/baseline.js");
const integration=read("app/services/stock-image-integrations.server.js");
const settingsUi=read("app/components/dashboard/settings/StockImageIntegrationsSettings.jsx");
const settings=read("app/components/dashboard/pages/Settings.jsx");
const imageService=read("app/services/stock-images.server.js");
const imageRoute=read("app/routes/app.stock-images.jsx");
const mediaShopify=read("app/services/stock-media-shopify.server.js");
const videoService=read("app/services/stock-videos.server.js");
const videoRoute=read("app/routes/app.stock-videos.jsx");
const audioService=read("app/services/stock-audio.server.js");
const audioRoute=read("app/routes/app.stock-audio.jsx");
const sidebar=read("app/components/dashboard/Sidebar.jsx");
const appRoute=read("app/routes/app.jsx");
const permissions=read("app/utils/builder-permissions.js");
const css=read("app/styles/dashboard.css");
const env=read(".env.example");
const toml=read("shopify.app.toml");
const plans=read("app/config/commercialPlans.js");
const q63=read("scripts/milestone-q63-stock-image-hub-audit.mjs");
const q631=read("scripts/milestone-q631-stock-credential-ui-hotfix-audit.mjs");

await check("Version is v2.5.103 or newer",()=>assert.ok(versionAtLeast(pkg.version,"2.5.103")));
await check("Baseline retains Q.6.3 lineage after Q.6.3.2",()=>{assert.ok(versionAtLeast(baseline.version,"2.5.103"));assert.ok(String(baseline.milestone).startsWith("Q.6"))});
await check("Stock Image Hub schema is v3 or newer",()=>assert.match(baselineJs,/stockImageHub:\s*([3-9]|\d{2,})/));
await check("Stock Video Hub registered",()=>assert.match(baselineJs,/stockVideoHub:\s*[1-9]\d*/));
await check("Stock Audio Hub registered",()=>assert.match(baselineJs,/stockAudioHub:\s*[1-9]\d*/));
await check("Shared stock media upload schema registered",()=>assert.ok(baselineJs.includes("stockMediaUploads: 1")));
await check("Q6.3.2 developer report exists",()=>assert.ok(exists("MILESTONE_Q632_DEVELOPER_MODE.md")));
await check("Q6.3.2 release report exists",()=>assert.ok(exists("VSN_MILESTONE_Q632_STOCK_MEDIA_EXPANSION_REPORT_v2.5.103.md")));
await check("Stock Media user docs exist",()=>assert.ok(exists("docs/user/stock-media-hub.md")));
await check("Stock Media provider docs exist",()=>assert.ok(exists("docs/developer/stock-media-provider-contracts.md")));
await check("Dedicated Q6.3.2 QA command exists",()=>assert.equal(pkg.scripts?.["qa:q632"],"node scripts/milestone-q632-stock-media-expansion-audit.mjs"));
await check("Q6.3.2 is in full release QA",()=>assert.ok(pkg.scripts?.["qa:release"]?.includes("milestone-q632-stock-media-expansion-audit.mjs")));
await check("Q6.3 historical audit accepts stock-media integration form",()=>assert.ok(q63.includes("stock-(images|media)")||q63.includes("stock-media")));
await check("Q6.3.1 historical audit is version future-safe",()=>assert.ok(q631.includes("v2.5.102 or newer")&&q631.includes('startsWith("Q.6")')));

await check("Stock image providers retain Unsplash/Pexels/Pixabay",()=>{for(const key of ["unsplash","pexels","pixabay"])assert.ok(STOCK_IMAGE_PROVIDERS.includes(key));});
await check("Stock video providers retain Pexels/Pixabay",()=>{for(const key of ["pexels","pixabay"])assert.ok(STOCK_VIDEO_PROVIDERS.includes(key));});
await check("Stock audio providers retain Freesound",()=>assert.ok(STOCK_AUDIO_PROVIDERS.includes("freesound")));
await check("Freesound environment key is documented",()=>assert.ok(integration.includes("FREESOUND_API_KEY")&&env.includes("FREESOUND_API_KEY=")));
await check("Settings labels Pexels and Pixabay as video capable",()=>assert.ok(/capabilities:\s*\["Images","Videos"\]/.test(settingsUi)||/capabilities:\s*\["Images",\s*"Videos"\]/.test(settingsUi)));
await check("Settings labels Freesound as audio capable",()=>assert.ok(/capabilities:\s*\["Audio"\]/.test(settingsUi)));
await check("Settings save loop includes Freesound",()=>assert.ok(settings.includes("'unsplash','pexels','pixabay','freesound'")));

await check("API settings use VSN styled checkbox structure",()=>assert.ok(settingsUi.includes("vsn-tool-checkbox vsn-stock-option-checkbox")&&settingsUi.includes("vsn-tool-checkbox-box")));
await check("API checkbox dimensions are explicitly styled",()=>assert.ok(css.includes(".vsn-stock-option-checkbox .vsn-tool-checkbox-box")&&css.includes("width:18px")&&css.includes("height:18px")));
await check("API checkbox has dark mode styling",()=>assert.ok(css.includes(".dashboard-root.dark .vsn-stock-provider-options .vsn-stock-option-checkbox")));
await check("Pixabay options use StyledCheckbox",()=>assert.ok(settingsUi.includes("Safe search</StyledCheckbox>")&&settingsUi.includes("Editors' Choice</StyledCheckbox>")));
await check("Freesound options use StyledCheckbox",()=>assert.ok(settingsUi.includes("Hide NonCommercial sound licenses</StyledCheckbox>")));

await check("Shopify-safe image byte margin is 18 MB",()=>assert.ok(imageService.includes("18 * 1024 * 1024")));
await check("Shopify-safe image pixel margin is 18 MP",()=>assert.ok(imageService.includes("18_000_000")));
await check("Safe image target preserves under-limit dimensions",()=>assert.deepEqual(safeImageTarget(4000,3000),{width:4000,height:3000,resized:false}));
await check("Safe image target shrinks 7000x5000 below 18 MP",()=>{const out=safeImageTarget(7000,5000);assert.equal(out.resized,true);assert.ok(out.width*out.height<=18_000_000);assert.ok(Math.abs(out.width/out.height-1.4)<0.01)});
await check("Unsplash import uses transformed image URL",()=>assert.ok(imageService.includes('url.searchParams.set("w"')&&imageService.includes('url.searchParams.set("fit","max")')&&imageService.includes('url.searchParams.set("q","85")')));
await check("Unsplash download tracking remains required",()=>assert.ok(imageService.includes("trackUnsplashDownload")&&imageService.includes("downloadLocation")));
await check("Pexels image import avoids original source",()=>{const fn=imageService.slice(imageService.indexOf("function pexelsShopifyUrl"),imageService.indexOf("function pixabayShopifyUrl"));assert.doesNotMatch(fn,/\.original/);assert.match(fn,/large2x|large|medium/)});
await check("Pixabay image import avoids original imageURL",()=>{const fn=imageService.slice(imageService.indexOf("function pixabayShopifyUrl"),imageService.indexOf("async function providerPhoto"));assert.doesNotMatch(fn,/imageURL/);assert.match(fn,/fullHDURL|largeImageURL|webformatURL/)});
await check("Image import reports Shopify-safe target",()=>assert.ok(imageService.includes("shopifyTarget")&&imageRoute.includes("shopifyTarget")));
await check("Image download keeps HTTPS/MIME/redirect checks",()=>assert.ok(imageService.includes("assertSourceUrl(provider, response.url || url)")&&imageService.includes("ALLOWED_IMAGE_TYPES")));

await check("Shared stock media Shopify service exists",()=>assert.ok(exists("app/services/stock-media-shopify.server.js")));
await check("Shared media downloader revalidates redirected hosts",()=>assert.ok(mediaShopify.includes("assertTrustedMediaUrl(response.url || url")));
await check("Shared media downloader checks MIME and max bytes",()=>assert.ok(mediaShopify.includes("allowedMimeTypes")&&mediaShopify.includes("maxBytes")));
await check("Video staged upload uses VIDEO resource fileSize",()=>assert.ok(mediaShopify.includes('resource === "VIDEO"')&&mediaShopify.includes("fileSize: String(bytes.byteLength)")));
await check("Generic media staged upload supports FILE resource",()=>assert.ok(mediaShopify.includes('resource = "FILE"')));
await check("Shopify media create supports VIDEO/FILE contentType",()=>assert.ok(mediaShopify.includes("contentType")&&mediaShopify.includes("fileCreate")));
await check("Shopify media update remains READY-gated",()=>assert.ok(mediaShopify.includes('status !== "READY"')&&mediaShopify.includes("fileUpdate")));
await check("Shopify media delete uses fileDelete",()=>assert.ok(mediaShopify.includes("fileDelete(fileIds:$ids)")));
await check("App retains read_files/write_files scopes",()=>assert.ok(toml.includes("read_files")&&toml.includes("write_files")));

await check("Stock Videos route exists",()=>assert.ok(exists("app/routes/app.stock-videos.jsx")));
await check("Stock Videos service exists",()=>assert.ok(exists("app/services/stock-videos.server.js")));
await check("Pexels video search uses v1 video endpoint",()=>assert.ok(videoService.includes("https://api.pexels.com/v1/videos/${endpoint}")&&videoService.includes('endpoint=query?"search":"popular"')));
await check("Pexels popular video discovery is implemented",()=>assert.ok(videoService.includes('endpoint=query?"search":"popular"')&&videoService.includes("min_width")));
await check("Pexels specific video lookup uses current v1 endpoint",()=>assert.ok(videoService.includes("https://api.pexels.com/v1/videos/videos/")));
await check("Pixabay video search uses official endpoint",()=>assert.ok(videoService.includes("https://pixabay.com/api/videos/")));
await check("Pixabay video cache is 24 hours",()=>assert.ok(videoService.includes("86_400_000")));
await check("Video all-provider results are round-robin aligned",()=>assert.ok(videoService.includes("roundRobin(settled,perPage)")));
await check("Video rendition gate caps dimensions",()=>assert.ok(videoService.includes("MAX_SHOPIFY_DIMENSION")&&videoService.includes("<=MAX_SHOPIFY_DIMENSION")));
await check("Video rendition gate caps fps",()=>assert.ok(videoService.includes("file.fps<=120")));
await check("Video rendition gate checks Shopify duration",()=>assert.ok(videoService.includes("0.25")&&videoService.includes("MAX_SHOPIFY_DURATION_SECONDS")));
await check("Video transfer uses bounded server memory cap",()=>assert.ok(videoService.includes("MAX_SERVER_IMPORT_BYTES")));
await check("Video import stages as VIDEO",()=>assert.ok(videoService.includes('resource:"VIDEO"')&&videoService.includes('contentType:"VIDEO"')));
await check("Video library supports favorites/import/update/delete",()=>assert.ok(videoService.includes("toggleStockVideoFavorite")&&videoService.includes("importStockVideo")&&videoService.includes("deleteImportedStockVideo")&&videoService.includes("update")));
await check("Video route exposes Discover/Favorites/Shopify Imports",()=>assert.ok(videoRoute.includes("Discover")&&videoRoute.includes("Favorites")&&videoRoute.includes("Shopify Imports")));
await check("Video route has provider/filter/quality controls",()=>assert.ok(videoRoute.includes("Pexels")&&videoRoute.includes("Pixabay")&&videoRoute.includes("quality")&&videoRoute.includes("minDuration")&&videoRoute.includes("maxDuration")));
await check("Video route uses confirmation before permanent Shopify delete",()=>assert.ok(videoRoute.includes("useVsnConfirm")&&videoRoute.includes("Delete imported video from Shopify Files?")));

await check("Stock Audio route exists",()=>assert.ok(exists("app/routes/app.stock-audio.jsx")));
await check("Stock Audio service exists",()=>assert.ok(exists("app/services/stock-audio.server.js")));
await check("Freesound uses current APIv2 search endpoint",()=>assert.ok(audioService.includes("https://freesound.org/apiv2/search/?")));
await check("Freesound uses token authentication",()=>assert.ok(audioService.includes("Authorization:`Token ${auth.apiKey}`")));
await check("Freesound search requests preview/license fields",()=>assert.ok(audioService.includes("previews")&&audioService.includes("license")&&audioService.includes("images")));
await check("Freesound original download endpoint is not called",()=>assert.doesNotMatch(audioService,/\/download\//));
await check("Audio import uses high quality API preview first",()=>assert.ok(audioService.includes('preview-hq-mp3')&&audioService.includes('preview-hq-ogg')));
await check("Audio generic-file transfer cap stays below 20 MB",()=>assert.ok(audioService.includes("19 * 1024 * 1024")));
await check("Audio import stages as generic FILE",()=>assert.ok(audioService.includes('resource:"FILE"')&&audioService.includes('contentType:"FILE"')));
await check("NonCommercial sound licenses are blocked",()=>assert.ok(audioService.includes("NonCommercial")&&audioService.includes("commercialSafe")));
await check("Freesound provider defaults disabled",()=>assert.ok(integration.includes('freesound: { enabled: false')));
await check("Freesound commercial API confirmation defaults false",()=>assert.ok(integration.includes("commercialApiLicensed: false")));
await check("Freesound connection test fails closed without commercial permission",()=>assert.ok(integration.includes("commercial API permission/license must be confirmed")));
await check("Freesound search fails closed without commercial permission",()=>assert.ok(audioService.includes('commercial-api-license-required')));
await check("Freesound import fails closed without commercial permission",()=>assert.ok(audioService.includes("commercial API permission/license must be confirmed before importing")));
await check("Freesound commercial permission checkbox is visible",()=>assert.ok(settingsUi.includes("I have Freesound commercial API permission/license for this app")));
await check("Audio route requires commercial permission in configured state",()=>assert.ok(/commercialApiLicensed\s*!==\s*true|commercialApiLicensed\s*===\s*true/.test(audioRoute)));
await check("Audio route exposes search/license/duration controls",()=>assert.ok(audioRoute.includes("Commercial-safe licenses only")&&audioRoute.includes("Min duration")&&audioRoute.includes("Max duration")));
await check("Audio route uses confirmation before permanent Shopify delete",()=>assert.ok(audioRoute.includes("useVsnConfirm")&&audioRoute.includes("Delete imported audio from Shopify Files?")));

await check("Role matrix includes Stock Videos",()=>assert.ok(permissions.includes('key:"stockVideos"')&&permissions.includes('"stock-videos":"stockVideos"')));
await check("Role matrix includes Stock Audio",()=>assert.ok(permissions.includes('key:"stockAudio"')&&permissions.includes('"stock-audio":"stockAudio"')));
await check("Sidebar includes Stock Videos",()=>assert.ok(sidebar.includes("'stock-videos'")&&sidebar.includes("Stock Videos")));
await check("Sidebar includes Stock Audio",()=>assert.ok(sidebar.includes("'stock-audio'")&&sidebar.includes("Stock Audio")));
await check("App route maps Stock Videos",()=>assert.ok(appRoute.includes('"stock-videos": "/app/stock-videos"')));
await check("App route maps Stock Audio",()=>assert.ok(appRoute.includes('"stock-audio": "/app/stock-audio"')));
await check("Stock Video navigation count is DB-backed",()=>assert.ok(appRoute.includes("stockVideoCount")&&appRoute.includes('kind: "stock-video"')));
await check("Stock Audio navigation count is DB-backed",()=>assert.ok(appRoute.includes("stockAudioCount")&&appRoute.includes('kind: "stock-audio"')));

await check("No new Q6.3.2 Prisma migration was added",()=>{const dirs=fs.readdirSync("prisma/migrations");assert.equal(dirs.some((name)=>/q632|stock_media_expansion|stock_video|stock_audio/i.test(name)),false)});
await check("No Prisma migration was added specifically for Q6.3.2",()=>assert.equal(fs.readdirSync("prisma/migrations").some((name)=>/q632|stock_media_expansion/i.test(name)),false));
await check("Exact Shopify billing handles remain unchanged",()=>{for(const handle of ["free","sliver","gold","platenium"])assert.ok(plans.includes(handle),handle)});

await check("Freesound config loader defaults to disabled without stored row",async()=>{const db={builderIntegration:{findFirst:async()=>null}};const row=await loadStockProviderCredentials(db,"qa.myshopify.com","freesound");assert.equal(row.enabled,false);assert.equal(row.config.commercialApiLicensed,false)});

const failed=checks.filter(([,ok])=>!ok);
console.log(`\nMilestone Q.6.3.2 Stock Media Expansion audit: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length)process.exit(1);
