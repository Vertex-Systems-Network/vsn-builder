// Deliberately block direct Shopify version creation/release while three-tier
// identities, hosted PostgreSQL and Cloudflare acceptance are unverified.
// A real release must use reviewed, exact-SHA GitHub Actions after all gates pass.
const operation = process.argv[2] || "deploy";
console.error(
  "VSN Builder " + operation + ": BLOCKED. " +
  "Direct Shopify CLI deployment/config switching is disabled during three-environment migration. " +
  "See docs/three-environments.md and issue #95. This command did not deploy anything."
);
process.exitCode = 1;
