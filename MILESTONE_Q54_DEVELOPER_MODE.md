# Milestone Q.5.4 — Developer Mode

VSN Builder v2.5.96 keeps Developer Mode enabled while aligning merchant-facing plan names and Shopify App Pricing handles.

- Merchant-facing plans are Free / Silver / Gold / Platinum.
- Stable internal IDs remain `core` / `pro` / `cro` / `agency` so earlier migrations and entitlement rules remain compatible.
- Exact default Shopify plan handles are `free` / `sliver` / `gold` / `platenium`.
- Developer Mode may simulate plans locally; `VSN_DEFAULT_PLAN` accepts the public plan names/keys as aliases as well as legacy internal IDs.
- Production ignores local paid simulation and still requires verified Shopify subscription authority.
- Manual Shopify status refresh is hidden in normal Developer Mode unless real subscription sync is intentionally enabled.
- Q5.4 adds no Prisma migration and does not create, cancel or modify Shopify billing contracts directly.
