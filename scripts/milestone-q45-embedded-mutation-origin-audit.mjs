import fs from "node:fs";
import { mutationRequestTrust, isTrustedShopifyAdminOrigin } from "../app/utils/request-security.server.js";

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}`); }
}

function req({ url = "http://127.0.0.1:3000/app/email-builder", origin, site, forwardedHost, forwardedProto, forwarded }) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (site) headers.set("sec-fetch-site", site);
  if (forwardedHost) headers.set("x-forwarded-host", forwardedHost);
  if (forwardedProto) headers.set("x-forwarded-proto", forwardedProto);
  if (forwarded) headers.set("forwarded", forwarded);
  return new Request(url, { method: "POST", headers, body: new URLSearchParams({ intent: "create" }) });
}

const oldAppUrl = process.env.SHOPIFY_APP_URL;
process.env.SHOPIFY_APP_URL = "https://vsn-dev.trycloudflare.com";

check("same-origin mutation allowed", mutationRequestTrust(req({ url: "https://vsn-dev.trycloudflare.com/app/pages", origin: "https://vsn-dev.trycloudflare.com", site: "same-origin" })).ok);
check("configured app origin allowed behind localhost proxy", mutationRequestTrust(req({ origin: "https://vsn-dev.trycloudflare.com", site: "cross-site" })).ok);
check("spoofed x-forwarded-host cannot create a trusted app origin", !mutationRequestTrust(req({ origin: "https://attacker.example", site: "cross-site", forwardedHost: "attacker.example", forwardedProto: "https" })).ok);
check("spoofed Forwarded host cannot create a trusted app origin", !mutationRequestTrust(req({ origin: "https://attacker.example", site: "cross-site", forwarded: "for=127.0.0.1;proto=https;host=attacker.example" })).ok);
check("Shopify Admin embedded origin allowed even when fetch metadata says cross-site", mutationRequestTrust(req({ origin: "https://admin.shopify.com", site: "cross-site" })).ok);
check("legacy merchant Shopify admin origin allowed", mutationRequestTrust(req({ origin: "https://example-shop.myshopify.com", site: "cross-site" })).ok);
check("HTTP myshopify origin rejected", !isTrustedShopifyAdminOrigin("http://example-shop.myshopify.com"));
check("lookalike Shopify host rejected", !isTrustedShopifyAdminOrigin("https://admin.shopify.com.evil.example"));
check("arbitrary cross-site origin rejected", !mutationRequestTrust(req({ origin: "https://evil.example", site: "cross-site" })).ok);
check("arbitrary same-site-looking origin still rejected", !mutationRequestTrust(req({ origin: "https://evil.example", site: "same-site" })).ok);
check("cross-site request without Origin rejected", !mutationRequestTrust(req({ site: "cross-site" })).ok);
check("server/internal request without Origin allowed", mutationRequestTrust(req({})).ok);
check("malformed Origin rejected", !mutationRequestTrust(req({ origin: "not a url" })).ok);

const files = [
  ...fs.readdirSync("app/routes").filter((name) => name.endsWith(".jsx")).map((name) => `app/routes/${name}`),
  "app/services/dashboard-actions.server.js",
].filter((file) => fs.existsSync(file));
const guarded = files.filter((file) => fs.readFileSync(file, "utf8").includes("assertTrustedMutationRequest"));
check("all guarded admin mutation modules authenticate with authenticate.admin", guarded.length >= 10 && guarded.every((file) => fs.readFileSync(file, "utf8").includes("authenticate.admin")));
check("shared guard covers all mutation call sites centrally", guarded.length >= 15);

const source = fs.readFileSync("app/utils/request-security.server.js", "utf8");
check("guard does not trust forwarded host headers for authorization", !source.includes("forwardedOrigin") && !source.includes('headers?.get?.("x-forwarded-host")'));
check("guard requires configured public proxy origin instead", source.includes("SHOPIFY_APP_URL") && source.includes("configuredAppOrigin"));
check("guard explicitly supports admin.shopify.com", source.includes('"admin.shopify.com"'));
check("guard retains hostile cross-site rejection", source.includes("untrusted-cross-site") && source.includes("Cross-site mutation request rejected."));

if (oldAppUrl == null) delete process.env.SHOPIFY_APP_URL; else process.env.SHOPIFY_APP_URL = oldAppUrl;
console.log(`\nQ4.5 embedded mutation origin audit: ${passed}/${passed + failed} PASS`);
if (failed) process.exit(1);
