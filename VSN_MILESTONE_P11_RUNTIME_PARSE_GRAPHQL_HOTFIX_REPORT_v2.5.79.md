# VSN Milestone P.1.1 Runtime Parse & GraphQL Hotfix — v2.5.79

## Root causes

1. The Documentation FAQ fallback could be present locally with an incomplete fragment close, causing Vite/esbuild to report `Unexpected end of file before a closing fragment tag`.
2. Multiple Shopify Admin GraphQL template strings placed `#graphql` and the operation on the same line. In GraphQL, `#` comments to the end of the line, so the operation was commented out and Shopify received an empty document, producing `syntax error, unexpected end of file`.

## Fix

- Replaced the FAQ fallback fragment with an explicit container element.
- Normalized all same-line `#graphql query` and `#graphql mutation` call sites under `app/` to place the operation on the following line.
- Added `qa:p11` to reject regressions and parse the Documentation JSX source.

## Data / migration impact

None. No Prisma migration or persisted-schema change.
