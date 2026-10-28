# Isolated Builder Development runtime acceptance

This **dedicated Local/Dev-only GitHub Actions** workflow gives non-developers a reproducible environment to test the actual application while keeping Cloudflare Staging/Live Workers untouched. A disposable GitHub runner installs the pinned npm lockfile, generates/applies the **SQLite** Prisma schema, builds the actual React Router server and starts `react-router-serve` bound only to loopback `127.0.0.1`. It then makes real HTTP requests and validates:

- `GET /` renders a 200 HTML page with `VSN | Builder (Development)` (not a generic starter template)
- `GET /?shop=...myshopify.com` redirects into the Shopify-authenticated app path
- `GET /app` without a Shopify session never returns protected dashboard content
- Unknown routes are 404

The smoke script runs only with `CI=true`, `NODE_ENV=test`, known static fake Shopify Client ID/secret and `file:./ci.sqlite`, uses a randomly selected loopback port and terminates the server after tests. No live merchant login is possible with these dummy credentials and no Shopify CLI URL linking is performed.

**Limits:** These are genuine local HTTP/rendering checks, **not** a working Shopify development-store installation. Merchant OAuth requires distinct genuine `VSN | Builder (Development)` app credentials and a reachable Shopify CLI tunnel; it cannot be simulated as an authenticated shop. No Staging/Live deployment or GitHub Environment secrets accessed. Existing `npm run start` production protection is NOT bypassed in production: the test runs the React Router serve binary directly *only on isolated CI localhost*.
