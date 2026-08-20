import fs from "node:fs";
import assert from "node:assert/strict";
import { FEATURE_FLAGS, normalizeFeatureFlags } from "../app/config/featureFlags.js";
import { VSN_BASELINE } from "../app/config/baseline.js";
import { migrateBuilderContent, readDocumentSchemaVersion, CURRENT_SCHEMA } from "../app/builder/schemaMigrations.js";

const source = (file) => fs.readFileSync(file, "utf8");
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };

ok(Array.isArray(VSN_BASELINE.completedPhases) && VSN_BASELINE.completedPhases.includes(0), "Current baseline must retain completed Phase 0 guardrails.");
ok(Number(VSN_BASELINE.schema?.document || 0) >= 1 && Number(VSN_BASELINE.schema?.styles || 0) >= 6, "Current baseline must preserve Phase 0 schema guardrails.");
ok(Object.keys(FEATURE_FLAGS).length >= 5, "Central feature flag registry is missing expected future systems.");
const defaults = normalizeFeatureFlags({});
ok(Object.values(defaults).every((value) => value === false), "Experimental feature flags must default OFF.");

const legacy = [{ id: "x", type: "heading", props: { text: "Legacy" }, children: null }];
const migrated = migrateBuilderContent(legacy);
ok(Array.isArray(migrated), "Migrated builder content must remain an array for backward compatibility.");
ok(readDocumentSchemaVersion(migrated) === CURRENT_SCHEMA.document, "Migrated content must be stamped with the current document schema.");
ok(migrated.some((node) => node.type === "template-settings"), "Schema metadata must use the non-rendered template-settings node.");
ok(migrated.find((node) => node.id === "x")?.props?.text === "Legacy", "Migration must preserve legacy widget data.");
ok(Array.isArray(migrated.find((node) => node.id === "x")?.children), "Migration must normalize children arrays.");

const route = source("app/routes/app.builder.$id.jsx");
const proxy = source("app/routes/builder-proxy.$.jsx");
const assets = source("app/services/theme-assets.server.js");
ok(route.includes("migrateBuilderContent") && proxy.includes("migrateBuilderContent") && assets.includes("migrateBuilderContent"), "Canvas/Preview/storefront asset paths must accept the shared migrated schema.");
const runtimeEntitlements = source("app/services/builder-runtime-entitlements.server.js");
ok((route.includes("getServerFeatureFlags") || route.includes("getBuilderRuntimeEntitlements")) && runtimeEntitlements.includes("getServerFeatureFlags"), "Editor loader must resolve the central feature flags.");
const pageEditor = source("app/components/editor/PageEditor.jsx");
ok(pageEditor.includes("contentNodes.length > 0") && pageEditor.includes("...systemNodes, ...starter"), "Schema stamping must not turn an otherwise empty page into a false non-empty canvas.");

const styleAudit = source("scripts/style-pipeline-audit.mjs");
ok(styleAudit.includes("Canvas") || styleAudit.includes("canvas"), "Shared renderer/style parity audit must remain present.");
ok(fs.existsSync("docs/ARCHITECTURE_GUARDRAILS.md"), "Architecture guardrails document missing.");
ok(fs.existsSync("scripts/package-integrity.mjs"), "Package integrity gate missing.");

const toolbar = source("app/components/editor/EditorToolbar.jsx");
ok(toolbar.indexOf("vsn-editor-workflow-actions--left") < toolbar.indexOf("vsn-editor-device-switcher--center"), "QA/settings/history/revisions must be in the left title zone.");
ok(toolbar.indexOf("vsn-editor-preview-history-group--right") < toolbar.indexOf("vsn-publish-group"), "Preview/undo/redo must sit directly left of Publish.");
const tooltip = source("app/components/editor/EditorTooltipLayer.jsx");
ok(tooltip.includes("activeTargetRef") && tooltip.includes("pointerover") && tooltip.includes("scheduleHide"), "Tooltip layer must use stable target tracking instead of mouseover state thrashing.");

console.log(`VSN Phase 0 foundation audit: PASS (${checks} checks)`);
