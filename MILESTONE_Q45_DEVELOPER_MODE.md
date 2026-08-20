# Milestone Q.4.5 — Embedded Mutation Origin Hotfix

Version: 2.5.89
Mode: Developer / embedded Shopify Admin compatible

## Purpose

Q.4.5 fixes an over-strict Q.2 mutation-origin guard that compared the browser `Origin` only with `request.url.origin`. Shopify embedded Admin and Shopify CLI reverse proxies can legitimately present a Shopify Admin or public tunnel origin while the server-side request URL is a local/proxied origin.

## Trust model

Authenticated Builder mutations continue to require `authenticate.admin`. The supplemental mutation-origin guard now accepts:

- the request URL origin;
- `SHOPIFY_APP_URL`;
- standard `Forwarded` host/proto;
- `X-Forwarded-Host` + `X-Forwarded-Proto`;
- `https://admin.shopify.com`;
- HTTPS merchant `*.myshopify.com` origins.

It rejects malformed origins, arbitrary cross-site origins, Shopify lookalike domains and cross-site browser requests that omit Origin.

No Prisma/schema migration is required.
