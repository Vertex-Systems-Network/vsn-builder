# Local Cloudflare Workerd Worker SDK import test — NOT A DEPLOYED APP

CI uses pinned Wrangler `4.149.0` to run the **actual local Cloudflare `workerd` runtime** with `nodejs_compat`, not a Node.js HTTP server. The CI-only Worker imports the guarded Shopify SDK bootstrap, Prisma Neon adapter/Worker client, React Web Streams SSR and signed webhook module. A route locked to `GET http://127.0.0.1:8788/__vsn_local_workerd_check__` verifies the imports loaded and rejects incomplete project/Shopify configuration. Every other route—including `/app`—returns HTTP 503. There is no database connection or real Shopify API call.

Worker config `wrangler.ci.jsonc` has `APP_ENV=development`, `workers_dev=false`, `preview_urls=false` and no secret bindings. GitHub Actions forbids Cloudflare or Shopify credentials, executes only `wrangler dev --local` (never deploy), installs temporary Wrangler without changing the app lockfile, and discards the runner afterwards. This detects real Workers module/bundle compatibility issues, not full React Router Worker routing, OAuth/webhooks delivery, storage initialization, cloud networking, or a Staging/Production-ready app.

A green result is necessary but **not sufficient** for Shopify Worker deployment: the current `app/entry.server.jsx` is still Node-only, the production Worker React Router fetch handler/Vite plugin and hosted secrets remain unwired, Neon Staging hasn't been migrated and issue #96's full development dependency audit is red. Never substitute this CI-only probe for a real Worker app.

Wrangler is now resolved through an isolated npm exec cache, avoiding root npm re-resolution after npm ci.
