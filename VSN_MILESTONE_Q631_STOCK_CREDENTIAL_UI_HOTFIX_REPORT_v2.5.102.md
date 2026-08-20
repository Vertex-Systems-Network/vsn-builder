# VSN Milestone Q.6.3.1 — Stock Image Credential & Settings UI Hotfix

Version: **2.5.102**  
Based on: **v2.5.101 / Q.6.3**

## Runtime fix

The v2.5.101 Settings credential field read `event.currentTarget.value` inside a functional React state updater. That access can occur after the event handler has finished, at which point `currentTarget` is not a stable value. The hotfix captures the input value synchronously in the handler and passes the plain string into state.

The same event-safe pattern is applied to Stock Images advanced provider options.

## Unsplash credentials

Unsplash configuration now models two independent encrypted secrets:

- Access Key — used by VSN public API requests (`Authorization: Client-ID ...`).
- Secret Key — stored server-side for OAuth/user-auth flows; not sent with normal public photo search/import calls.

Legacy encrypted `apiKey` values from v2.5.101 are accepted as the Unsplash Access Key so existing stores do not need to re-enter credentials.

## Settings UI

The three provider integrations are now rendered as full-width responsive cards instead of three compressed columns. Inputs use `min-width: 0`, full-width sizing, stable password visibility controls, responsive option grids and dark-mode styling.

## Database

No Prisma migration. `BuilderIntegration.secretJson` already supports the additional encrypted Unsplash Secret Key.

## QA

- Q6.3.1 credential/UI hotfix audit: **35/35 PASS**
- Q6.3 Stock Image Hub regression: **83/83 PASS**
- Full `npm run qa:release`: **EXIT 0**
- JS/JSX parser: **314 files / 0 blocking errors**
- Codebase health: **0 failures / 0 warnings**
- Package integrity: **196 required files PASS**
- No new Prisma migration
- Packaged SQLite is byte-for-byte unchanged from v2.5.101
