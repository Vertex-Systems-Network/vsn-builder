# Destructive uninstall requires independent installation-generation attestation — fail closed

**Security problem:** Shopify's HMAC authenticates the webhook's **raw body**; it does not authenticate `X-Shopify-Triggered-At` or `X-Shopify-Webhook-Id` by themselves. A replayed genuine old `app/uninstalled` body with an attacker-controlled *later* timestamp can appear newer than a legitimate fresh installation and defeat a timestamp-only `installedAt <= triggeredAt` comparison. Double-verifying the same body with WebCrypto and the official SDK does not make its delivery metadata cryptographically trustworthy.

## Default security behavior

`revokeVerifiedWorkerShopifySessions` now requires a request-scoped `verifyTrustedUninstallGeneration` capability **before it begins any Prisma transaction, installation row update or Session.deleteMany**. Missing verifier, thrown verifier or any value other than literal boolean `true` returns HTTP 503, no body, `cache-control: no-store`, and no destructive database query.

The **real** `createWorkerShopifySdkContext` deliberately does *not* provide this capability: there is **no independently authenticated webhook generation-proof provider in this repo**. Therefore ordinary SDK webhooks are not permitted to delete hosted merchant sessions using only a signed body and unsigned timestamp; this is intentional until a genuinely separate identity/current-install evidence flow is designed, implemented and verified. This change does not enable any hosted Worker route.

## Test boundary

Existing transactional unit tests, real local PostgreSQL row-lock/rollback tests and CI-only Workerd signed-webhook tests inject an explicitly named `syntheticCiAttestation` verifier. **That fake verifier is not production event evidence** and exists only to continue certifying tenant-scoped Prisma writes when the missing future trust prerequisite is simulated.

New tests demonstrate **default-denial** with an unsigned timestamp forged into the future using a legitimate synthetic Shopify event, with no transaction, claims or session deletes. Real disposable PostgreSQL and actual Cloudflare Workerd both exercise this fail-closed behavior. The SDK compatibility test separately asserts its production-shaped context has no attestor.

## Future acceptance gate

A production replacement verifier must obtain **independent, authenticated evidence tying a particular Shopify uninstall event to the installation generation currently stored for the shop**, not merely re-check the webhook body, timestamp header, webhook ID, merchant domain or token. It must be replay-resistant, transactionally serialized with verified OAuth install/reinstall writes, and validated using disposable PostgreSQL before any Staging deployment. If Shopify APIs do not provide reliable event-generation attribution, retain no-destructive-cleanup behavior and follow a separately approved merchant session revocation/reconciliation path. Do not simply inject `async()=>true` in a hosted route.

Mandatory dependency audit issue #96 and actual hosted Shopify OAuth/Neon Cloudflare acceptance remain release blockers. No actual Neon query/migration, Cloudflare deploy, Shopify merchant delete or app submission occurred.
