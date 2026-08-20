# VSN Milestone L — Permissions 2.0 + Idle Runtime Stabilization

Version: **2.5.68**  
Date: **2026-08-08**  
Mode: **Developer Mode**

## Runtime fixes carried into this release

- Fixed the Dashboard `Each child in a list should have a unique key prop` warning by keying the mapped dashboard widget boundary.
- Removed the restricted Shopify `accountOwner` GraphQL lookup that generated `read_users`/plan-level warnings; shell identity continues to use the authenticated online session and safe shop metadata.
- Passive Dashboard monitoring and editor collaboration heartbeat now obtain a fresh App Bridge ID token for background requests, use bounded timeouts, reject overlapping polls and pause while the document is hidden/offline. The editor heartbeat lives in a dedicated hook so PageEditor stays below the Milestone G debt ceiling.
- Added a session recovery guard on normal and focused editor shells. It validates on mount, focus, page-show, visibility return and every 60 seconds while visible; auth refresh problems show a recoverable VSN state instead of being allowed to degrade silently.
- Added a root client render boundary so an unexpected React render failure produces Retry/Reload recovery UI instead of a blank app iframe.

## Milestone L permission model

Milestone L keeps Shopify scopes, VSN system visibility and VSN action authorization separate.

### Canonical resources

- Pages: view, create, edit, publish, delete, restore, import
- Marketplace: browse, favorite, install, rollback
- GraphQL Studio: read queries, run queries, save/manage queries, run mutations
- Global CSS/JS: view, edit, publish/rollback, delete
- Plugin SDK: view, configure/test, install contract
- Billing: view, manage

### Enforcement

- Store owner/Admin always has full VSN access.
- Non-owner roles must pass both the system permission and the resource/action permission.
- Developer Studio and Plugin SDK are disabled for non-owner roles by default and require an explicit owner grant.
- Server route actions enforce permissions even if a user attempts to bypass disabled UI controls.
- Page and editor controls, Developer Studio controls and billing management links mirror the action matrix in the UI.
- Existing `BuilderShopSetting.roleAccessJson` is backward-normalized, so no destructive Prisma migration is required for this permission expansion.

## Developer-mode boundary

No production billing activation, production scope escalation or irreversible storefront operation is performed automatically by this milestone.
