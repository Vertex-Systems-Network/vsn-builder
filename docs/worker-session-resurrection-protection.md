# Worker session resurrection protection — CI only / no merchant traffic

The Shopify React Router SDK calls SessionStorage.storeSession for session creation **and refresh**. An SDK-provided offline session record or token rotation alone does **not** prove that a merchant completed a new Shopify app install after APP_UNINSTALLED. A previous Worker wrapper treated a revoked installation's normal session write as a new generation, allowing previously revoked credentials to reactivate installation lifecycle state.

## Fail-closed correction

- Once the `BuilderShopInstallation` row has `uninstalledAt` set, any ordinary SDK `storeSession` path refuses the write (sanitized `VSN_WORKER_INSTALL_SESSION_BLOCKED`); it never clears the marker or advances generation.
- Changed offline access tokens and routine token refreshes **do not move `installedAt`**. Install-generation state can only advance during a separate, explicitly verified future installation/reinstallation path. The SDK remains responsible for actual Shopify authentication; this storage wrapper does not invent an OAuth verification flag.
- Orphaned offline sessions that exist without a lifecycle row are blocked until a reviewed migration/recovery path verifies the merchant. This avoids treating a preexisting token as proof of a brand-new install after a partial migration.
- Online sessions must belong to an active installation; missing/revoked lifecycle rows cannot authorize a write.
- Each rejected write occurs **within the transaction**, so any temporary lock/update rolls back together. The official Shopify Prisma adapter is still used to persist authorized sessions.

## Hosted migration readiness

The real Worker session-context constructor now checks **both** `Session.count()` and `BuilderShopInstallation.count()` before creating the official Shopify SDK storage. Missing or inaccessible lifecycle tables lead to a generic 503-capable bootstrap error and close the DB handle, rather than accepting Shopify authentication only to lose its resulting tokens.

Regression tests cover failed schema probe, wrong database tier, missing lifecycle table, token rotation, uninstalled-session replay, orphan migration state, transaction rollback and merchant isolation. A real local Cloudflare Workerd smoke test uses synthetic data and an actual Shopify adapter, not live merchant installations. No cloud SQL/migrations or deployments are executed.

## Remaining critical blockers

A dedicated *actual Shopify-authenticated reinstall acceptance* integration must be designed and reviewed before it advances `BuilderShopInstallation.installedAt`; until then the safe behavior is to refuse ordinary offline `storeSession` after uninstall. The hosted app router and full Shopify merchant auth acceptance are missing, and webhook `X-Shopify-Triggered-At` is an unsigned header. A captured old signed webhook request with a modified timestamp still threatens the earlier cleanup prototype; **do not wire destructive uninstall cleanup to production** without independent event-generation proof. Mandatory development dependency audit #96 still blocks release.
