import assert from "node:assert/strict";
import fs from "node:fs";
import { conditionRuleMatches, serverConditionMatches } from "../app/storefront/serverConditions.js";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepStrictEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const ctx = {
  customer: { loggedIn: true },
  product: { availableForSale: true, vendor: "Acme", tags: ["Sale"] },
  collection: { handle: "summer" },
  cart: { itemCount: 2 },
};

equal(serverConditionMatches({}, ctx), true, "Nodes without conditions render");
equal(serverConditionMatches({ conditions: { enabled: false, rule: "logged-out" } }, ctx), true, "Disabled conditions never hide nodes");
equal(serverConditionMatches({ conditions: { enabled: true, rule: "logged-out" } }, ctx), false, "Single legacy rule is evaluated");
equal(conditionRuleMatches({}, ctx), true, "Missing rule defaults to always");
equal(conditionRuleMatches({ rule: "logged-in" }, ctx), true, "Logged-in rule matches customer");
equal(conditionRuleMatches({ rule: "logged-in" }, {}), false, "Logged-in rule fails closed without customer");
equal(conditionRuleMatches({ rule: "product-vendor", value: "ACME" }, ctx), true, "Commerce rules delegate case-insensitively");
equal(conditionRuleMatches({ rule: "product-sold-out" }, ctx), false, "Commerce false result is respected");
equal(conditionRuleMatches({ rule: "cart-items-min", value: "3" }, ctx), false, "Cart minimum rule is respected");
equal(conditionRuleMatches({ rule: "date-after", value: "2000-01-01" }, ctx), true, "Past date-after matches");
equal(conditionRuleMatches({ rule: "date-before", value: "2000-01-01" }, ctx), false, "Past date-before fails");
equal(conditionRuleMatches({ rule: "date-after" }, ctx), true, "Empty date rule matches");
equal(conditionRuleMatches({ rule: "device", value: "mobile" }, ctx), true, "Browser-dependent rules defer to theme renderer");

const groups = (operator, a, b) => ({
  conditions: {
    enabled: true,
    operator,
    groups: [
      { operator: "AND", rules: a },
      { operator: "or", rules: b },
    ],
  },
});
const pass = [{ rule: "logged-in" }];
const fail = [{ rule: "logged-out" }];
equal(serverConditionMatches(groups("AND", pass, [...fail, ...pass]), ctx), true, "AND of groups with lowercase OR group");
equal(serverConditionMatches(groups("AND", [...pass, ...fail], pass), ctx), false, "AND group requires every rule");
equal(serverConditionMatches(groups("or", fail, fail), ctx), false, "OR of failing groups fails");
equal(serverConditionMatches(groups("or", fail, pass), ctx), true, "OR of groups matches any group");
equal(serverConditionMatches({ conditions: { enabled: true, groups: [], rule: "logged-out" } }, ctx), false, "Empty groups fall back to legacy rule");

const route = fs.readFileSync("app/routes/builder-proxy.$.jsx", "utf8");
const source = fs.readFileSync("app/storefront/serverConditions.js", "utf8");
ok(route.includes('from "../storefront/serverConditions.js"'), "Builder proxy imports server-conditions boundary");
ok(!route.includes("function conditionRuleMatches("), "Builder proxy no longer owns condition rule evaluation");
ok(!route.includes("function serverConditionMatches("), "Builder proxy no longer owns condition group evaluation");
ok(!route.includes('from "../builder/commerceConditions.js"'), "Builder proxy no longer imports commerce conditions directly");
ok(route.includes('if (!serverConditionMatches(node, renderContext)) return "";'), "renderNode still gates nodes on server conditions");
ok(source.includes('from "../builder/commerceConditions.js"'), "Server-conditions boundary delegates commerce rules");
for (const forbidden of ["db.", "fetch(", "graphql(", "authenticate.", "session.", "Response(", "renderNode", "shopify.server", "process.env"]) {
  ok(!source.includes(forbidden), `Server-conditions boundary gained unrelated authority: ${forbidden}`);
}

console.log(`VSN P1.6o storefront server conditions audit: PASS (${checks}/${checks})`);
