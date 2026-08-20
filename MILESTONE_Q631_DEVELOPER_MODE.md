# Milestone Q.6.3.1 — Developer Mode

Version: **2.5.102**  
Baseline: **v2.5.101 / Q.6.3**  
Status: **Complete — hotfix**

This hotfix keeps Developer Mode and all existing Stock Image Hub behavior intact while fixing credential-entry runtime safety and the Settings integration UI.

## Changes

- Credential input handlers capture DOM values synchronously before state updates, preventing stale SyntheticEvent/currentTarget access during paste/autofill.
- Unsplash now has separate encrypted **Access Key** and **Secret Key** fields. Existing v2.5.101 `apiKey` data remains readable as the Access Key for backward compatibility.
- `UNSPLASH_SECRET_KEY` is supported as an optional server environment fallback.
- Public Unsplash search/import continues to authenticate with the Access Key; the Secret Key is stored for OAuth/user-auth flows and is never exposed to the browser.
- Stock provider Settings UI now uses responsive full-width provider cards, stable credential fields, show/hide controls, provider options and documentation links.
- Stock Images advanced filter handlers use event-safe captured values to avoid the same stale-event class of runtime error.
- No Prisma migration. Existing encrypted integration records remain compatible.
