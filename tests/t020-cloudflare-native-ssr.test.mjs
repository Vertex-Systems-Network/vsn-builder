import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

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
  assert.match(code,/shopify-worker-sdk-context\.js/);
  assert.match(code,/db-worker-neon\.js/);
  assert.match(code,/typeof createWorkerShopifySdkContext === "function"/);
  assert.match(code,/typeof createWorkerNeonPrisma === "function"/);
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
  // Pin only this locked loopback Workerd: the CI binary from plugin 1.41.0
  // cannot run the hosted 2026-10-13 date. Never relax live config.
  assert.equal(cfg.compatibility_date,"2026-06-23");
  const stage = JSON.parse(readFileSync("wrangler.staging.jsonc","utf8")
    .replace(/^\s*\/\/.*$/gm,""));
  assert.notEqual(stage.name,cfg.name);
  assert.notEqual(stage.compatibility_date,cfg.compatibility_date);
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

test("Cloudflare output directory must be opt-in; Node build defaults to build",()=>{
  const evalConfig = vars => {
    const child=spawnSync(process.execPath,[
      "--input-type=module","--eval",
      "import config from './react-router.config.js'; process.stdout.write(config.buildDirectory);"
    ],{env:{...process.env,...vars},encoding:"utf8",timeout:5000});
    assert.equal(child.status,0,child.stderr);
    return child.stdout;
  };
  assert.equal(evalConfig({
    CI:"true",NODE_ENV:"test",APP_ENV:"development",VSN_CLOUDFLARE_NATIVE_CI:"1",
  }),"dist");
  assert.equal(evalConfig({VSN_CLOUDFLARE_NATIVE_CI:"0"}),"build");
  assert.equal(evalConfig({CI:"false",VSN_CLOUDFLARE_NATIVE_CI:"1"}),"build");
  assert.equal(evalConfig({APP_ENV:"staging",VSN_CLOUDFLARE_NATIVE_CI:"1"}),"build");
  assert.equal(evalConfig({APP_ENV:"staging",VSN_STAGING_FULL_APP_BUILD:"1"}),"dist");
});
