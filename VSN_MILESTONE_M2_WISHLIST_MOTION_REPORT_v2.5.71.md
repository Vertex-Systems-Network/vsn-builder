# VSN Milestone M.2 — Wishlist Commerce & Motion Catalog Report

Release: **v2.5.71**  
Mode: **Developer Mode**

## Completed

### Wishlist Commerce
- Added `BuilderWishlist` persistence keyed by shop/customer.
- Added signed app-proxy wishlist GET and merge/replace/clear synchronization.
- Added local → server merge when a customer is logged in.
- Added live product snapshot resolution and best-effort current-storefront market refresh.
- Added Wishlist Grid and Wishlist Empty State widgets.
- Added editable Marketplace Wishlist Page starter.
- Added backup/restore, uninstall cleanup, customer-redact and shop-redact handling.

### Motion Library
- Added all **97** named animations shown by the Animate.css catalog as VSN-native timelines.
- Added **960** additional VSN presets: Modern, Spring, Elastic, Robust, Pop, Zoom, Rotate/Dynamic, Drift and Reveal/Cinematic families.
- Built-in Motion Library total is **1,063** presets: 6 legacy + 97 Animate.css + 960 VSN generated.
- Added category/search filtering and incremental 72-card loading to keep the large catalog responsive.

### Developer Studio
- Added explicit light-mode code-editor colors for GraphQL, JSON, CSS and JavaScript editors and read-only result panes.
- Added matching dark-mode caret/selection guarantees and readable suggestion popovers.

## Database

Migration `20260808234530_milestone_m2_wishlist` creates the app-owned `BuilderWishlist` table. Run the normal project setup/migration command before testing authenticated cross-device wishlist persistence.
