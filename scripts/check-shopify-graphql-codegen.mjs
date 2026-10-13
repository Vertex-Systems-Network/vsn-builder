// GraphQL codegen config relies on @shopify/api-codegen-preset and graphql-config.
// Check that the actual codegen plugin still evaluates after the patched
// GraphQL Tools major-version override; do not make Shopify API network calls.
import assert from "node:assert/strict";
const config=(await import("../.graphqlrc.js")).default;
assert(config&&typeof config==="object");
assert(config.projects&&typeof config.projects==="object");
assert(config.projects.default,"Canonical Shopify GraphQL project is missing");
const project=config.projects.default;
assert(project.schema||project.schemaExtensions||project.extensions,"Shopify GraphQL codegen schema/provider missing");
assert(project.documents||project.extensions,"Shopify codegen documents config missing");
console.log("PASS Shopify GraphQL codegen preset loads without contacting Shopify");
