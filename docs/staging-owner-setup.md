# Staging setup — owner checklist

These steps need account access that AI agents do not have. They unblock Tier 2 (Staging) in `.ai/ENVIRONMENT-PROMOTION.md`. Do them in order. Never paste secret values into GitHub issues, PRs, chat or committed files.

Canonical identifiers come from `config/deployment/environments.json` and `wrangler.staging.jsonc`.

## 1. GitHub (unblocks T013/T014, Issue #158)

1. Repository **Settings → Branches → Add branch ruleset** for `development`:
   - require a pull request before merging;
   - require status checks to pass (select the Production Confidence / CI checks);
   - block force pushes and deletions.
2. **Settings → Environments → New environment** `cloudflare-staging`:
   - add yourself as a **required reviewer**;
   - **Deployment branches**: only `development`.
3. In `cloudflare-staging`, add environment secrets (values from Cloudflare/Neon/Shopify, never from Production):
   - `CLOUDFLARE_API_TOKEN` (token scoped to Workers edit for `vsn-builder-staging` only);
   - `CLOUDFLARE_ACCOUNT_ID`;
   - `DATABASE_URL` (Neon Staging **pooled** URL) and `DIRECT_URL` (Neon Staging **direct** URL, used only by the protected migration workflow `phase3-staging-neon-migration.yml`);
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_STAGING_CLIENT_ID` and `SHOPIFY_APP_URL` (Staging app only);
   - `NEON_API_KEY` if you want read-only Neon checks to run.
   The exact names each workflow reads are in `.github/workflows/*staging*.yml`.

## 2. Shopify Partner Dashboard (unblocks T015, Issue #159)

1. Keep exactly **one public app**: `VSN | Builder`.
2. Confirm the internal Staging app `VSN | Builder (Staging)` has Client ID `0ecd6b7151485b41ea65924fe827806a` and matches `shopify.app.staging.toml`.
3. Set its App URL and redirect URLs to the Staging Worker HTTPS URL from step 3.4.
4. Use only the existing test store `staging-oath3rth.myshopify.com`. Billing stays in test mode.

## 3. Cloudflare (unblocks T019, Issue #161)

1. Open Workers → `vsn-builder-staging` → **Settings → Variables and Secrets**.
2. Add encrypted secrets: `DATABASE_URL` (Neon Staging pooled URL), `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` (Staging app only).
3. Do not add any Production value or a `DIRECT_URL` here.
4. Enable the `workers.dev` route (or attach a Staging custom domain) and note the HTTPS URL for step 2.3.

## 4. Neon (unblocks T018, Issue #160)

1. Project `shiny-violet-61219572`, database `neondb`: confirm the pre-migration snapshot exists before anything else.
2. Do **not** run migrations by hand. The protected workflow `phase3-staging-neon-migration.yml` is dispatched from protected `development`; you approve it in the `cloudflare-staging` environment.

## 5. Tell the AI

After each section, reply with which steps are done (no secret values). The AI then verifies read-only, records evidence in `TASKS.md`, and continues with T020/T021 (Worker merchant router and Staging deploy).

Production setup is a separate, later checklist and requires a Staging-certified release first.
