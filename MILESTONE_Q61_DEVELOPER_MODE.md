# Milestone Q.6.1 — Reusable Data View + App Shell QA (Developer Mode)

VSN Builder remains in Developer Mode for this milestone.

## Scope

- Harden Templates List/Grid runtime after Q.6 final QA.
- Fix the `fallbackFiles is not iterable` Trash regression at the theme-asset service boundary.
- Promote List/Grid controls, sorting, pagination, row actions, bulk actions and Settings popup primitives into the shared UI toolkit.
- Add fine-grained reusable Data View feature switches so future screens can disable controls without forking the component set.
- Add dismissible shared notices, portal-positioned menus and shared floating Settings behavior.
- Refine the app shell navigation/profile actions without bypassing Shopify-owned admin chrome.
- Preserve exact Shopify App Pricing handles `free`, `sliver`, `gold`, `platenium`.

## Safety

- No Prisma schema change or new migration.
- No production billing change.
- No automatic React Router v8 future-flag opt-in.
- Shopify pin state and Shopify Admin logout remain Shopify-owned controls; VSN does not fake unsupported host APIs.
- Programmatic uninstall uses Shopify's supported self-uninstall GraphQL mutation and requires explicit typed confirmation.
