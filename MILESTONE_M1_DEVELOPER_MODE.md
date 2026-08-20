# Milestone M.1 — Wishlist Foundation (Developer Mode)

Status: **complete sub-milestone / Milestone M in progress**

This package starts Milestone M without introducing new customer/account persistence tables yet.

## Included

- VSN Core `Wishlist Button` widget.
- VSN Core `Wishlist Count` widget.
- Browser-local anonymous wishlist persistence (`vsn:wishlist:v1`).
- Product and current-variant modes.
- Product snapshot metadata: product id, optional variant id, handle, title, URL, image, price, currency and timestamp.
- Cross-tab/localStorage synchronization.
- MutationObserver hydration for VSN content rendered after the theme runtime boots.
- Theme App Extension wishlist JS/CSS runtime.
- Small read/clear client API at `window.VSNWishlist`.

## Deliberately deferred to M.2

- Logged-in customer server persistence.
- Anonymous → authenticated merge.
- Wishlist Grid widget.
- Wishlist Empty State widget.
- Wishlist Page template.
- Server-backed cross-device synchronization.

The split is intentional: M.1 establishes the browser/runtime and editor contract first; M.2 can add authenticated persistence without coupling a new database/session flow to the v2.5.69 stabilization work.
