# VSN Milestone M.2.2 — Runtime & Motion Catalog Cleanup Report

Version: **2.5.73**  
Mode: **Developer Mode**

## Theme runtime

The Page Renderer no longer emits direct app-proxy CSS or JavaScript `href/src` tags. A Shopify-hosted `vsn-global-code-loader.js` theme asset now builds the same contextual app-proxy URLs at runtime and injects the Global CSS/JS resources. This keeps dynamic Global Code behavior while removing the Theme Check `RemoteAsset` warning source.

## npm startup

Removed `shamefully-hoist=true` from `.npmrc`. It is a pnpm-oriented setting and was producing npm's unknown-project-config warning.

## Motion catalog cleanup

- Removed legacy duplicate **Fade In** because the Animate.css catalog already supplies `fadeIn`.
- Removed legacy duplicate **Zoom In** because the Animate.css catalog already supplies `zoomIn`.
- Preserved all **97 Animate.css** named presets.
- Preserved all **960 VSN generated** presets.
- Preserved the remaining four legacy VSN core presets.
- New built-in total: **1,061**.
- Fixed direction matching to prioritize compound tokens and support both Top/Bottom and Up/Down diagonal naming. This removes behavior-level duplicates among Animate.css diagonal fade/rotate variants.

## React Router v8

The current v8 future flags are deliberately **not enabled** in this cleanup. Recent VSN releases fixed a client/server route-module boundary regression; route splitting/middleware/environment behavior should only be opted into through a dedicated compatibility milestone with full dev-runtime verification.

## Database

No Prisma migration is required.
