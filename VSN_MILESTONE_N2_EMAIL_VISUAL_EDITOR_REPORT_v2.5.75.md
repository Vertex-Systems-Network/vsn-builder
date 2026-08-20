# VSN Milestone N.2 — Visual Email Editor & Dynamic Bindings

Version: **2.5.75**
Status: **Developer Mode / N in progress**

## Implemented

- Three-pane visual editor: block palette, design/preview canvas and contextual inspector.
- HTML5 drag/drop block insertion and reordering, plus move, duplicate and danger delete actions.
- Desktop/mobile design and exact compiled HTML preview.
- Email document settings for content width, backgrounds, font, text/link colors, subject, preheader and readiness state.
- 14 email block types: Header, Hero, Section, Columns, Text, Image, Button, Product, Order Summary, Coupon, Social Links, Divider, Spacer and Footer.
- Dynamic token authoring for Shop, Customer, Product, Order, Cart, Discount, Campaign and Form namespaces.
- Authenticated preview hydration from Shopify Shop, latest Product and recent Order where current scopes permit; safe samples fill unavailable namespaces.
- Shared client/server email renderer, responsive column stacking and token-preserving HTML/plain-text export.

## Deliberately deferred

- Production sending providers and campaign delivery.
- Real customer-specific send context outside an actual event/send pipeline.
- Gmail/Outlook pixel screenshots through external inbox-rendering providers.
- MJML source export and advanced client compatibility diagnostics.

No Prisma migration is required for N.2.
