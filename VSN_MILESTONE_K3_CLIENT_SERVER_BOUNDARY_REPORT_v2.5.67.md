# VSN Milestone K.3 — Client/Server Boundary Stabilization

Version: **2.5.67**  
Mode: **Developer Mode**  
Based on: **v2.5.64 Milestone K**, with the temporary v2.5.65/v2.5.66 transport/hydration workarounds intentionally excluded.

## Root cause

The v2.5.63 baseline route modules imported `canAccessBuilderEditor` from `builder-permissions.server` even where that symbol was unused. The same server module also mixed browser-safe permission definitions/helpers with database-backed authorization helpers. React Router/Vite therefore detected a server-only module in the client route graph and aborted the client transform. SSR HTML could still render, but React hydration did not attach, leaving all click handlers inert.

Observed failing routes included:

- `app/routes/app.jsx`
- `app/routes/app.pages.jsx`

The visual symptom was a normal-looking dashboard with dead Sidebar/TopNav controls because only server-rendered HTML was active.

## Fix

1. Added `app/utils/builder-permissions.js` for browser-safe permission definitions and pure helpers.
2. Reduced `app/utils/builder-permissions.server.js` to persistence-backed authorization only.
3. Updated all route/service imports to use the correct boundary.
4. Removed unused `canAccessBuilderEditor` imports from the parent app route, Pages route, and Builder route.
5. Restored the established SPA Sidebar/TopNav button navigation from v2.5.64; no native-anchor fallback or hydration warning boot layer is included.
6. Added a route-level audit that fails on unused named `*.server` imports.

## Verification

- K.3 client/server boundary audit: 16/16 PASS
- Existing Milestone K/J/I/H/G/F audits rerun after the architecture split.
- Package integrity and codebase health rerun.
- Full dependency-backed React Router build could not be executed in the artifact environment because its internal npm mirror does not provide `lucide-react@1.26.0`; this is an environment registry limitation, not a source failure.

## Expected runtime behavior

After a clean install/restart, React Router client hydration should attach normally. Sidebar/TopNav clicks use SPA navigation again, so the app keeps its previous route loading/screen-switch behavior rather than forcing full-document fallback navigation.
