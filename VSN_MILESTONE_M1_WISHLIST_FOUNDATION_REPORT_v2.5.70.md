# VSN Milestone M.1 — Wishlist Foundation Report

Release: **v2.5.70**  
Milestone: **M.1 — Wishlist Foundation**  
Mode: **Developer Mode**

## Outcome

Milestone M has started with the lowest-risk commerce slice: anonymous/local wishlist state plus first-class editor/storefront widgets. The existing Page Renderer, SDK Widget Registry and Theme App Extension are reused; no parallel page renderer or custom widget runtime was introduced.

## Architecture

`Wishlist Button / Wishlist Count → VSN Core SDK widgets → Shared Widget Registry → Editor + Storefront renderer → Theme wishlist runtime → localStorage`

The local runtime stores bounded product snapshots and keeps all wishlist buttons/counts synchronized, including content inserted asynchronously by the VSN storefront renderer.

## Variant behavior

Wishlist Button supports:

- **Product** — one wishlist item per product.
- **Current variant** — variant id is resolved at click time from the closest Shopify product form when possible, with the server-rendered variant as fallback.

## Safety / compatibility

- No new database migration.
- No customer PII stored in the wishlist payload.
- No external requests.
- Maximum local list length is bounded.
- localStorage parse/write failures fail closed instead of breaking storefront rendering.
- Reduced-motion styling is respected.

## Remaining Milestone M work

M.2 will add authenticated server persistence, local→server merge, Wishlist Grid, Empty State and Wishlist Page template. Market/locale display behavior will be finalized with the grid/page layer where live pricing and availability are resolved.
