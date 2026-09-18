import fs from "node:fs";
import { safeExternalUrl } from "../app/utils/security.server.js";

const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
let failed = 0;

function check(name, ok) {
  if (ok) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

const routes = read("app/routes.js");
const secureRoute = read("app/routes/builder-proxy-secure.$.jsx");
const legacyDelivery = read("app/services/legacy-storefront-form-submission.server.js");
const securityUtils = read("app/utils/security.server.js");

check(
  "Builder proxy URL is manually bound to the hardened action module",
  routes.includes('route("builder-proxy/*", "./routes/builder-proxy-secure.$.jsx")'),
);
check(
  "Filesystem routing cannot register the legacy proxy action",
  routes.includes('ignoredRouteFiles: ["**/builder-proxy.$.jsx", "**/builder-proxy-secure.$.jsx"]'),
);
check(
  "Hardened proxy preserves the mature loader only",
  secureRoute.includes('export { loader } from "./builder-proxy.$.jsx";'),
);
check(
  "Hardened proxy owns storefront mutation handling",
  secureRoute.includes("export async function action({ request })") &&
    secureRoute.includes("handleLegacyStorefrontFormSubmission") &&
    secureRoute.includes("handleStorefrontFormSubmission"),
);
check(
  "Legacy webhook delivery uses DNS-pinned public HTTPS transport",
  legacyDelivery.includes("publicHttpsRequest(endpoint.url, {") &&
    !/fetch\s*\(\s*endpoint\.url/.test(legacyDelivery),
);
check(
  "Legacy webhook delivery keeps bounded timeout/body/response limits",
  legacyDelivery.includes("timeoutMs: 5000") &&
    legacyDelivery.includes("maxBodyBytes: 512 * 1024") &&
    legacyDelivery.includes("maxResponseBytes: 64 * 1024"),
);
check(
  "Shared egress resolves and rejects unsafe DNS answers before connection",
  securityUtils.includes("resolvePublicHttpsTarget") &&
    securityUtils.includes("lookup(host, { all: true, verbatim: true })") &&
    securityUtils.includes("rows.some((row) => unsafeExternalHost(row.address))"),
);
check(
  "Shared egress pins the validated DNS address into the HTTPS request",
  securityUtils.includes("lookup(_hostname, options, callback)") &&
    securityUtils.includes("target.address") &&
    securityUtils.includes("target.family"),
);
check(
  "Shared egress transport does not implement redirect following",
  !securityUtils.includes('headers.get("location")') &&
    !securityUtils.includes("response.headers.location") &&
    !securityUtils.includes("redirect:"),
);

for (const value of [
  "http://example.com/hook",
  "https://user:pass@example.com/hook",
  "https://localhost/hook",
  "https://127.0.0.1/hook",
  "https://10.0.0.1/hook",
  "https://169.254.169.254/latest/meta-data",
  "https://192.168.1.1/hook",
  "https://[::1]/hook",
  "https://[fc00::1]/hook",
]) {
  check(`Unsafe outbound URL rejected: ${value}`, safeExternalUrl(value) === null);
}

check(
  "Public HTTPS webhook destinations remain accepted",
  safeExternalUrl("https://example.com/webhooks/vsn") !== null,
);

console.log(`Legacy webhook egress audit: ${passed} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
