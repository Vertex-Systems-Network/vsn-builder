# VSN Milestone Q.6.3 — Stock Image Hub & Persistent View Settings

Version: **2.5.101**  
Date: **2026-08-10**

## Delivered

- Dashboard aside z-index 99.
- Durable Dashboard preference schema v2 and durable Templates List/Grid/settings persistence.
- Templates view control order: List first, Grid second.
- Unified Stock Images screen for Unsplash, Pexels, Pixabay.
- Empty-query discovery uses native Unsplash photo listing, Pexels curated photos, and Pixabay popular results; query search uses provider-native search.
- Search-all round-robin result alignment plus provider-specific filters.
- Favorites, Shopify import, source refresh/update, and permanent Shopify file deletion.
- Encrypted per-shop provider API keys in Settings, masked client state, optional environment-key fallback, and provider connection tests.
- Unsplash hotlink/download-tracking compliance, Pexels attribution, and Pixabay 24-hour caching/no permanent remote hotlink behavior.
- Shopify `write_files` scope plus staged upload/file create/update/delete lifecycle.
- Stock Image role/system permissions.
- One additive cache/preferences migration; no destructive SQL.

## Release guard

The dedicated Q6.3 audit locks persistence, provider contracts, secret handling, Shopify Files lifecycle, migration shape, navigation, permissions, exact billing handles, and package baseline/version alignment.
