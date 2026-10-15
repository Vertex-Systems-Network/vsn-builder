import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const configFile = "vite.full-merchant-cloudflare-ci.config.js";
const workerFile = "workers/full-merchant-vite-ci.js";
const wranglerFile = "wrangler.full-merchant-vite-ci.jsonc";

test("Cloudflare Vite SSR config compiles real merchant application (no fixture)", () => {
  const config = readFileSync(configFile,"utf8");
  assert.match(config,/cloudflare\(\{/);
  assert.match(config,/viteEnvironment:\s*\{\s*name:\s*"ssr"/);
  assert.match(config,/reactRouter\(\)/);
  assert.doesNotMatch(config,/t020-vite-build\/app|tests\/fixtures\/t020-vite-build/);
  assert.match(config,/wrangler\.full-merchant-vite-ci\.jsonc/);
});

test("Cloudflare-native Worker uses virtual real ServerBuild and never dispatches /app", () => {
  const code = readFileSync(workerFile,"utf8");
  assert.match(code,/virtual:react-router\/server-build/);
  assert.match(code,/Object\.keys\(build\?\.routes \|\| \{\}\)/);
  assert.doesNotMatch(code,/handler\(request,|authenticate\.admin\(request\)|DATABASE_URL/);
  assert.match(code,/url\.hostname === "127\.0\.0\.1"/);
  assert.match(code,/!request\.headers\.has\("authorization"\)/);
  assert.match(code,/if \(!testOnly\) return locked\(\)/);
});

test("Cloudflare-native target can neither publish nor bind real service secrets", () => {
  const cfg = JSON.parse(readFileSync(wranglerFile,"utf8")
    .replace(/^\s*\/\/.*$/gm,""));
  assert.equal(cfg.name,"vsn-builder-full-merchant-vite-ci");
  assert.equal(cfg.workers_dev,false);
  assert.equal(cfg.preview_urls,false);
  assert.equal(cfg.vars.APP_ENV,"test");
  assert.equal(cfg.vars.VSN_BUILD_INTENT,"cloudflare-vite-full-merchant-ci");
  assert.notEqual(cfg.name,"vsn-builder-staging");
  assert.notEqual(cfg.name,"vsn-builder-production");
  assert.doesNotMatch(JSON.stringify(cfg),/SHOPIFY_API_SECRET|SHOPIFY_API_KEY|DATABASE_URL|DIRECT_URL/);
});

test("Local and hosted production Vite configuration remain separate",()=>{
  const local = readFileSync("vite.config.js","utf8");
  assert.doesNotMatch(local,/@cloudflare\/vite-plugin/);
  assert.match(local,/reactRouter\(\)/);
  const hosted = readFileSync("wrangler.staging.jsonc","utf8");
  assert.doesNotMatch(hosted,/full-merchant-vite-ci/);
});
