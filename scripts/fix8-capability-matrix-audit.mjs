import fs from "node:fs";
import assert from "node:assert/strict";
import { widgetRegistry } from "../app/builder/widgetRegistry.js";
import {
  WIDGET_CAPABILITY_KEYS,
  auditWidgetCapabilityCoverage,
  auditWidgetCapabilityConsistency,
  getWidgetCapabilities,
  widgetCapabilityMatrix,
} from "../app/builder/widgetCapabilities.js";
import {
  WIDGET_STYLE_FEATURES,
  auditWidgetStyleProfiles,
  getWidgetStyleProfile,
} from "../app/builder/widgetStyleProfiles.js";

const types = Object.keys(widgetRegistry);
assert.equal(types.length, 117, `Expected 117 widgets, found ${types.length}`);

const coverage = auditWidgetCapabilityCoverage(types);
assert.equal(coverage.covered, 117, `Capability coverage ${coverage.covered}/117`);
assert.deepEqual(coverage.missing, [], `Missing capability mappings: ${coverage.missing.join(", ")}`);
assert.deepEqual(coverage.unexpected, [], `Stale capability mappings: ${coverage.unexpected.join(", ")}`);
const staticTypes=types.filter((type)=>Boolean(widgetCapabilityMatrix[type]));
assert.deepEqual(Object.keys(widgetCapabilityMatrix).sort(), [...staticTypes].sort(), "Static capability matrix must match statically mapped widget keys; SDK-only widgets extend it dynamically");

const consistency = auditWidgetCapabilityConsistency(types);
assert.equal(consistency.valid, true, consistency.errors.join("\n"));

for (const type of types) {
  const caps = getWidgetCapabilities(type);
  assert.notEqual(caps.family, "unknown", `${type}: must not use unknown/fallback capabilities`);
  for (const key of WIDGET_CAPABILITY_KEYS) assert.equal(typeof caps[key], "boolean", `${type}.${key} must be boolean`);
  assert.ok(Object.isFrozen(caps), `${type}: resolved capability record must be immutable`);
}

// Fail closed: a future widget is not allowed to inherit a permissive generic profile accidentally.
const unknown = getWidgetCapabilities("__future_unregistered_widget__");
assert.equal(unknown.family, "unknown");
for (const key of WIDGET_CAPABILITY_KEYS) assert.equal(unknown[key], false, `Unknown widget must disable ${key}`);

// Concrete unsupported-control cleanup in FIX-8.
assert.equal(getWidgetCapabilities("map").typography, false, "Map iframe must not expose Typography controls");
assert.equal(getWidgetCapabilities("map").textEffects, false, "Map iframe must not expose Text Effects");
assert.equal(getWidgetCapabilities("gallery-grid").typography, false, "Gallery Grid image-only renderer must not expose Typography controls");
assert.equal(getWidgetCapabilities("gallery-grid").textEffects, false, "Gallery Grid image-only renderer must not expose Text Effects");
assert.equal(getWidgetCapabilities("image").media, true, "Basic Image must expose Media controls");
assert.equal(getWidgetCapabilities("image").imageDimensions, true, "Basic Image must expose Image Dimension controls");
assert.equal(getWidgetCapabilities("menu-anchor").layout, false, "Menu Anchor must stay free of visual layout controls");
assert.equal(getWidgetCapabilities("menu-anchor").customCode, true, "Menu Anchor may retain custom-code escape hatch");

const genericDynamicTypes = types.filter((type) => getWidgetCapabilities(type).dynamicSource).sort();
assert.deepEqual(genericDynamicTypes, ["button", "heading", "image", "text"], "Generic Dynamic Source must only appear on renderers that consume the binding contract");
const genericLinkTypes = types.filter((type) => getWidgetCapabilities(type).elementLink).sort();
assert.deepEqual(genericLinkTypes, ["heading", "icon", "image", "text"], "Generic Element Link must not wrap commerce/article/rich-data widgets");

const profileAudit = auditWidgetStyleProfiles(types);
assert.equal(profileAudit.profiled, 117, `Style profile coverage ${profileAudit.profiled}/117`);
assert.equal(profileAudit.valid, true, profileAudit.errors.join("\n"));

const controlSource = fs.readFileSync("app/components/editor/WidgetSpecificStyleControls.jsx", "utf8");
const engineSource = fs.readFileSync("app/builder/widgetSpecificStyleEngine.js", "utf8");
const hasPattern = /has\(["']([^"']+)["']\)/g;
const featuresIn = (source) => {
  const out = new Set();
  let match;
  while ((match = hasPattern.exec(source))) out.add(match[1]);
  hasPattern.lastIndex = 0;
  return out;
};
const uiFeatures = featuresIn(controlSource);
const engineFeatures = featuresIn(engineSource);
assert.deepEqual([...uiFeatures].sort(), [...engineFeatures].sort(), "Widget-specific control features and CSS-engine features must match exactly");
assert.deepEqual([...uiFeatures].sort(), [...WIDGET_STYLE_FEATURES].sort(), "Feature catalog must match actual editor/CSS engine feature contracts");

for (const type of types) {
  const profile = getWidgetStyleProfile(type);
  for (const feature of profile.features) {
    assert.ok(uiFeatures.has(feature), `${type}: feature ${feature} has no editor controls`);
    assert.ok(engineFeatures.has(feature), `${type}: feature ${feature} has no CSS serializer`);
  }
}

const propertiesSource = fs.readFileSync("app/components/editor/PropertiesPanel.jsx", "utf8");
for (const key of ["typography", "background", "border", "spacing", "sizing", "effects", "media", "imageDimensions", "icon", "backgroundGallery", "elementLink", "dynamicSource", "conditions", "responsive", "stateStyles", "animations", "cssVariables", "customCode"]) {
  assert.ok(propertiesSource.includes(`capabilities.${key}`), `PropertiesPanel must gate ${key} by capabilities`);
}
const advancedSource = fs.readFileSync("app/components/editor/AdvancedBuilderControls.jsx", "utf8");
for (const key of ["layout", "sizing", "spacing", "flexItem", "flexContainer", "gridContainer", "background", "border", "effects", "transform", "transition", "interaction", "scroll", "typography"]) {
  assert.ok(advancedSource.includes(`caps.${key}`), `Advanced controls must gate ${key} by capabilities`);
}

console.log(`FIX-8 capability matrix: ${coverage.covered}/${coverage.total}`);
console.log(`FIX-8 style profiles: ${profileAudit.profiled}/${profileAudit.total}`);
console.log(`FIX-8 widget-specific feature contracts: ${uiFeatures.size}/${WIDGET_STYLE_FEATURES.length}`);
console.log("FIX-8 fail-closed unknown widget behavior: PASS");
console.log("FIX-8 unsupported-control cleanup: PASS");
console.log("FIX-8 audit: PASS");
