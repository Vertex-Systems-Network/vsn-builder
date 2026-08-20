# Milestone Q.5.3 — Developer Mode

VSN Builder v2.5.95 keeps Developer Mode enabled for safe plan simulation while introducing Entitlement Engine 2.0.

- Development may simulate Core / Pro / CRO / Agency through the existing local subscription row or `VSN_DEFAULT_PLAN`.
- Production ignores `VSN_DEFAULT_PLAN` for paid access. A paid entitlement requires a trusted Q5.2 Shopify App Pricing subscription mirror.
- Entitlement decisions are server-side and named: feature, quota, or minimum-plan tier.
- UI capability state is derived from the same serialized entitlement snapshot; UI hiding is never the only enforcement layer.
- Q5.3 adds no Prisma migration and does not create or alter merchant Shopify charges.
