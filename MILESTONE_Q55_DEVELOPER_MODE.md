# Milestone Q.5.5 — Developer Mode

VSN Builder v2.5.97 remains safe to run in Developer Mode.

- Local plan simulation remains available outside production.
- Exact Shopify plan handles remain `free` / `sliver` / `gold` / `platenium`.
- Partner API billing verification remains disabled in normal Developer Mode unless `VSN_SYNC_SHOPIFY_BILLING_IN_DEVELOPMENT=true` is explicitly set.
- Q5.5 adds bounded Partner API retries, but does not create, cancel or modify Shopify billing contracts.
- No Prisma migration is added by Q5.5.
- The Q5.2 `BuilderSubscription` mirror remains disposable local state; production paid authority still requires a verified Shopify App Pricing contract.
