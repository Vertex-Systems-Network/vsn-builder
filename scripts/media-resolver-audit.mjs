import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const route = read('app/routes/app.editor-media.jsx');
const controls = read('app/components/editor/EditorControls.jsx');
const appToml = read('shopify.app.toml');
const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); else console.log(`  ✓ ${name}`); };

check('read_files scope configured', /read_files/.test(appToml));
check('Files resolver is a JSON resource route', !route.includes('export default function'));
check('Files resolver accepts Shopify Files/theme/image scopes', ['read_files','read_themes','read_images'].every((scope)=>route.includes(scope)) && route.includes('hasFilesReadCapability'));
check('picker IDs are not restricted to GID format', route.includes('function normalizeIds') && !route.includes('.filter((id) => id.startsWith("gid://shopify/"))'));
check('numeric identity fallback exists', route.includes('function numericIdentity') && route.includes('fileMatchesRequestedId'));
check('direct GraphQL nodes remain first path', route.includes('resolveByNodes') && route.includes('nodes(ids: $ids)'));
check('targeted Files ID query exists', route.includes('resolveByFilesQuery') && route.includes('id:${id}') && route.includes('sortKey: ID'));
check('paginated Files fallback exists', route.includes('scanFilesForIds') && route.includes('pageInfo { hasNextPage endCursor }'));
check('fallback is media-type aware', route.includes('mediaQueryFromTypes') && controls.includes('JSON.stringify({ ids: normalizedIds, mediaTypes, attempt })'));
check('MediaImage filtered fallback', route.includes('media_type:IMAGE'));
check('Video filtered fallback', route.includes('media_type:VIDEO'));
check('GenericFile filtered fallback', route.includes('media_type:GENERIC_FILE'));
check('SVG library paginates GenericFiles', route.includes('getSvgFiles') && route.includes('maxPages = 30') && route.includes('media_type:GENERIC_FILE'));
check('SVG direct GenericFile URL retained', route.includes('typename === "GenericFile"') && route.includes('url: absoluteCdnUrl'));
check('protocol-relative CDN URLs normalized', route.includes('if (url.startsWith("//")) return `https:${url}`'));
check('client caches actual and picker aliases', controls.includes('shopifyMediaIdentityKeys(file.id)') && controls.includes('shopifyMediaIdentityKeys(file.requestedId)'));
check('client resolves returned aliases immediately', controls.includes('resolveCachedOrReturnedFile'));
check('picker mediaTypes forwarded to resolver', controls.includes('resolveShopifyFiles(ids, { mediaTypes })'));
check('misleading HTTP 200 processing message removed', !controls.includes('could not be resolved (${lastStatus'));
check('client reports non-JSON media endpoint failures', controls.includes('media resolver did not return JSON'));
check('client points permission debugging to System Health', controls.includes('System Health → Shopify & Permissions'));

if (failures.length) {
  console.error(`Media resolver audit FAILED (${failures.length})`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log('Media resolver audit PASS');
