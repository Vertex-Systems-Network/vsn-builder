# Milestone K.3 — Developer Mode Guardrail

VSN remains in Developer Mode.

This stabilization release fixes a React Router/Vite client-server module boundary regression that was present in the v2.5.63 baseline and carried into v2.5.64. It does not enable production billing, production deployment, or irreversible merchant changes.

## Runtime rule

- Route UI may import only client-safe permission contracts from `app/utils/builder-permissions.js`.
- Database/session-backed authorization remains in `app/utils/builder-permissions.server.js`.
- No unused named import from a `*.server` module is allowed in a route module.
- The established SPA navigation behavior remains authoritative: Sidebar and TopNav use React navigation and preserve route loader transitions.
