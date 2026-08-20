# Permission Standard

Every privileged action has two checks: UI capability visibility/disabled state and server-side authorization. Store owner must resolve to full application authority. Feature plan entitlements and role permissions are separate concerns and should produce different user messages.

## Milestone L — Permissions 2.0

VSN authorization is split into three independent layers:

1. **Shopify authentication/scopes** decide what the app installation can request from Shopify.
2. **VSN system permissions** decide whether a role can open a product area such as Pages, Marketplace, Developer Studio or Plans.
3. **VSN resource/action permissions** decide what the role can do inside a permitted system.

Canonical action contracts currently cover Pages, Marketplace, GraphQL Studio, Global CSS/JS, Plugin SDK and Billing. UI controls must reflect the action matrix, but UI state is never authority: every privileged loader/action must call the server authorization layer again. Store-owner/Admin access remains unconditional. Developer Studio and Plugin SDK are disabled for non-owner roles until explicitly granted by the owner.

Permission persistence remains in `BuilderShopSetting.roleAccessJson`; the normalization layer upgrades older role JSON in memory so this milestone does not require a destructive database migration.
