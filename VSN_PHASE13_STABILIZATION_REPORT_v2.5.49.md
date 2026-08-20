# VSN Builder v2.5.49 — Phase 13 Stabilization & UX Reliability

Status: Developer Mode. This release does not start Phase 14.

## Scope
This stabilization release addresses the pre-Phase-14 Builder workspace review: Growth navigation, managed asset uploads, notice scoping, Phase 12 spacing, campaign/floating editing, readable UI values, System Health consolidation, Library UX, owner permissions and editor tooltips.

## Fixes
- Campaigns and CRO Experiments remain complete Builder > Growth panels and were removed from the outer Shopify app navigation to avoid duplicate navigation.
- Custom Font and SVG Builder uploads now submit true multipart FormData. Upload parser, type and size errors are returned as readable panel-scoped notifications.
- Workspace action notices are tied to the panel that produced them and clear when the user leaves that screen. Pages feedback follows the same rule.
- Phase 12 Builder panels received spacing, asset-grid, submission and responsive layout polish.
- Popup/campaign and Floating Element records are workspace-only template types: they are excluded from the normal Pages dashboard and open in the existing Page Editor app-window from their Builder Growth panel.
- Dynamic codes/enum values are passed through human-readable label formatting in Builder panels and Pages template filters/metadata.
- Health and Diagnostics are consolidated as Builder > System > System Health. The old Health route redirects to the unified panel. System Health includes overall score, actionable checks, runtime/database, Shopify identity, feature flags, engines, widget registry/category counts, content, assets, forms, collaboration, operations and sanitized service configuration.
- Saved Library cards render actual VSN design previews. Builder Library and the compatibility direct Library route both have 12-item pagination and Favorites.
- The editor Library popup has 12-item pagination while retaining favorites and design previews.
- Builder workspace height/overflow rules constrain scrolling to the active workspace screen instead of nested page-level scroll contexts.
- Destructive actions use danger treatment for Trash/Delete/Delete forever controls.
- Shopify admin auth is configured for online sessions so `associated_user.account_owner` is available. The store owner maps to Builder `admin` and Collaboration `publisher`, restoring publish rights without faking permissions from shop identity alone.
- Tooltip flicker/click blocking was traced to rendering the tooltip inside a full-screen modal portal. Tooltip rendering now uses the non-blocking overlay root, suppresses during pointer activation and has no pointer events. Widget cards no longer render tooltip attributes.

## Upload limits
- Fonts: WOFF2 / WOFF / TTF / OTF, maximum 8 MB.
- SVG: sanitized SVG, maximum 512 KB.
- These managed assets are stored by the app; Shopify Files permission is not required for this upload path.

## Owner session note
After switching the embedded app to online tokens, an existing development tab may need one normal app refresh/re-authentication so Shopify creates the staff-specific online session. The app does not elevate offline sessions to owner artificially.

## QA
Use `npm run qa:phase13-stabilization` for the stabilization contract, followed by Phase 10–13 regression, package integrity, security and performance audits before the next phase.
