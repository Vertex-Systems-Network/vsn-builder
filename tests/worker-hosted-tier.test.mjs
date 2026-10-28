import test from "node:test";
import assert from "node:assert/strict";
import { isHostedTier, isHostedWorker } from "../app/services/worker-hosted-tier.js";

test("Staging is a hosted tier; Production needs its explicit release opt-in",()=>{
  assert.equal(isHostedTier({APP_ENV:"staging"}),true);
  assert.equal(isHostedTier({APP_ENV:"production",VSN_STAGING_OAUTH_ENABLED:"true"}),false);
  assert.equal(isHostedTier({APP_ENV:"production",VSN_PRODUCTION_ENABLED:"true"}),true);
  assert.equal(isHostedTier({APP_ENV:"development",VSN_PRODUCTION_ENABLED:"true"}),false);
});

test("Worker name must match the tier",()=>{
  assert.equal(isHostedWorker({APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-staging"}),true);
  assert.equal(isHostedWorker({APP_ENV:"staging",VSN_WORKER_NAME:"vsn-builder-production"}),false);
  assert.equal(isHostedWorker({APP_ENV:"production",VSN_PRODUCTION_ENABLED:"true",VSN_WORKER_NAME:"vsn-builder-production"}),true);
  assert.equal(isHostedWorker({APP_ENV:"production",VSN_PRODUCTION_ENABLED:"true",VSN_WORKER_NAME:"vsn-builder-staging"}),false);
});
