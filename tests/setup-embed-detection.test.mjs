import test from "node:test";
import assert from "node:assert/strict";
import { parseThemeSettingsData, findEmbedBlock } from "../app/services/theme-embed-status.server.js";
import { setupIsPending } from "../app/utils/setup-state.js";

test("theme settings_data.json with Shopify's comment banner still finds the enabled VSN embed", () => {
  const raw = `/*\n * IMPORTANT: The contents of this file are auto-generated.\n */\n{"current":{"blocks":{"1":{"type":"shopify://apps/vsn/blocks/vsn-page-renderer/abc","disabled":false}}}}`;
  const settings = parseThemeSettingsData(raw);
  assert.ok(settings);
  assert.equal(findEmbedBlock(settings).disabled, false);
});

test("setup keeps opening until the three required steps are complete", () => {
  assert.equal(setupIsPending({}), true);
  assert.equal(setupIsPending({ setupSkipped: true }), true);
  assert.equal(setupIsPending({ requiredStepsComplete: true }), false);
});
